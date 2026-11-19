const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../services/passwords');
const { generarEstructuraCompensada } = require('../services/seatTemplateService');

// ==========================================
// 1. AUTENTICACIÓN Y ROLES
// ==========================================

exports.login = async (req, res) => {
  const { correo, password } = req.body;

  if (typeof correo !== 'string' || !correo.trim() || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.cedula, u.rol, u.password_hash, u.bus_id,
              c.id AS cooperativa_id, c.nombre AS cooperativa_nombre,
              b.numero_disco AS bus_disco, b.placa AS bus_placa
       FROM usuarios u 
       LEFT JOIN cooperativas c ON c.id = u.cooperativa_id
       LEFT JOIN buses b ON b.id = u.bus_id
       WHERE LOWER(TRIM(u.correo)) = $1`,
      [correo.trim().toLowerCase()]
    );

    const usuario = result.rows[0];
    if (!usuario || !await verifyPassword(password, usuario.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (usuario.rol === 'ADMIN_COOP' && !usuario.cooperativa_id) {
      return res.status(403).json({ error: 'Tu cuenta aún no tiene una cooperativa asignada' });
    }
    if (usuario.rol === 'CHOFER' && !usuario.bus_id) {
      return res.status(403).json({ error: 'Esta cuenta de chofer no tiene una unidad de bus asignada' });
    }

    let redirectPath = '/admin';
    if (usuario.rol === 'OFICINISTA') redirectPath = '/oficina';
    if (usuario.rol === 'CHOFER') redirectPath = '/chofer';

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        telefono: usuario.telefono,
        cedula: usuario.cedula,
        cooperativa_id: usuario.cooperativa_id,
        cooperativa_nombre: usuario.cooperativa_nombre,
        bus_id: usuario.bus_id,
        bus_disco: usuario.bus_disco,
        bus_placa: usuario.bus_placa
      },
      redirect: redirectPath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 2. CRUD DE COOPERATIVAS Y BRANDING
// ==========================================

exports.getCooperativas = async (req, res) => {
  try {
    const query = `
      SELECT c.*, 
             COUNT(b.id)::int AS total_buses,
             COUNT(CASE WHEN b.capacidad = 40 THEN 1 END)::int AS buses_40,
             COUNT(CASE WHEN b.capacidad = 41 THEN 1 END)::int AS buses_41
      FROM cooperativas c
      LEFT JOIN buses b ON b.cooperativa_id = c.id
      GROUP BY c.id
      ORDER BY c.id ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearCooperativa = async (req, res) => {
  const {
    nombre,
    ruc,
    color_distintivo,
    cuenta_bancaria,
    banco,
    activo = true,
    gerente
  } = req.body;

  if (!nombre || !ruc) {
    return res.status(400).json({ error: 'Nombre y RUC de la cooperativa son obligatorios' });
  }
  if (gerente?.correo && gerente?.nombre
      && (typeof gerente.password !== 'string' || gerente.password.length < 6 || gerente.password.length > 128)) {
    return res.status(400).json({ error: 'La contraseña del gerente debe tener entre 6 y 128 caracteres' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const insertCoop = `
      INSERT INTO cooperativas (nombre, ruc, color_distintivo, cuenta_bancaria, banco, activo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const coopRes = await client.query(insertCoop, [
      nombre.trim(),
      ruc.trim(),
      color_distintivo || '#1E40AF',
      cuenta_bancaria || '',
      banco || 'Banco Pichincha',
      activo
    ]);

    const nuevaCoop = coopRes.rows[0];

    // Si se envían datos del Gerente, crearlo en la misma transacción
    let usuarioGerente = null;
    if (gerente && gerente.correo && gerente.nombre) {
      const passHash = await hashPassword(gerente.password);
      const insertUser = `
        INSERT INTO usuarios (nombre, correo, telefono, rol, password_hash, cooperativa_id)
        VALUES ($1, $2, $3, 'ADMIN_COOP', $4, $5)
        RETURNING id, nombre, correo, rol, cooperativa_id
      `;
      const userRes = await client.query(insertUser, [
        gerente.nombre.trim(),
        gerente.correo.trim().toLowerCase(),
        gerente.telefono || '',
        passHash,
        nuevaCoop.id
      ]);
      usuarioGerente = userRes.rows[0];
    }

    await client.query('COMMIT');

    res.status(201).json({
      cooperativa: nuevaCoop,
      gerente: usuarioGerente,
      mensaje: 'Cooperativa creada exitosamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.actualizarCooperativa = async (req, res) => {
  const { id } = req.params;
  const { nombre, ruc, color_distintivo, cuenta_bancaria, banco, activo, logo_url, telefono, direccion } = req.body;

  try {
    const query = `
      UPDATE cooperativas
      SET nombre = COALESCE($1, nombre),
          ruc = COALESCE($2, ruc),
          color_distintivo = COALESCE($3, color_distintivo),
          cuenta_bancaria = COALESCE($4, cuenta_bancaria),
          banco = COALESCE($5, banco),
          activo = COALESCE($6, activo),
          logo_url = COALESCE($7, logo_url),
          telefono = COALESCE($8, telefono),
          direccion = COALESCE($9, direccion)
      WHERE id = $10
      RETURNING *
    `;
    const result = await db.query(query, [
      nombre,
      ruc,
      color_distintivo,
      cuenta_bancaria,
      banco,
      activo,
      logo_url,
      telefono,
      direccion,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cooperativa no encontrada' });
    }

    res.json({
      mensaje: 'Cooperativa actualizada correctamente',
      cooperativa: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 3. GESTIÓN DE USUARIOS DE COOPERATIVA
// ==========================================

exports.getUsuarios = async (req, res) => {
  const { cooperativa_id } = req.query;
  try {
    let query = `
      SELECT u.id, u.nombre, u.correo, u.telefono, u.cedula, u.rol, u.creado_en, u.cooperativa_id, u.bus_id,
             c.nombre AS cooperativa_nombre,
             b.numero_disco AS bus_disco, b.placa AS bus_placa
      FROM usuarios u
      LEFT JOIN cooperativas c ON c.id = u.cooperativa_id
      LEFT JOIN buses b ON b.id = u.bus_id
    `;
    const params = [];
    if (cooperativa_id) {
      query += ' WHERE u.cooperativa_id = $1';
      params.push(Number(cooperativa_id));
    }
    query += ' ORDER BY u.id DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearUsuario = async (req, res) => {
  const { nombre, correo, telefono, cedula, rol, password, cooperativa_id, bus_id, creador_rol, creador_coop_id } = req.body;

  if (typeof nombre !== 'string' || !nombre.trim() || typeof correo !== 'string' || !correo.trim() || !rol) {
    return res.status(400).json({ error: 'Nombre, correo y rol son obligatorios' });
  }

  const rolesPermitidos = ['ADMIN_COOP', 'OFICINISTA', 'CHOFER', 'SUPERADMIN'];
  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no permitido para gestión administrativa' });
  }

  // Regla de Negocio del Estudiante (Joel): Solo el Gerente de la Cooperativa puede crear Choferes
  if (rol === 'CHOFER') {
    if (creador_rol && creador_rol !== 'ADMIN_COOP' && creador_rol !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Solo el Gerente de la cooperativa puede crear choferes' });
    }
    if (!bus_id) {
      return res.status(400).json({ error: 'Debes asignar un bus obligatoriamente al chofer' });
    }
  }

  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 128 caracteres' });
  }

  let coopId = cooperativa_id ? Number(cooperativa_id) : (creador_coop_id ? Number(creador_coop_id) : null);
  if ((rol === 'ADMIN_COOP' || rol === 'CHOFER' || rol === 'OFICINISTA') && (!Number.isInteger(coopId) || coopId < 1 || coopId > 2147483647)) {
    return res.status(400).json({ error: 'Selecciona una cooperativa válida' });
  }

  // Validar que el bus pertenezca a la misma cooperativa del Gerente
  let busAsignadoId = null;
  if (bus_id) {
    const busCheck = await db.query('SELECT id, cooperativa_id FROM buses WHERE id = $1', [bus_id]);
    if (busCheck.rows.length === 0) {
      return res.status(404).json({ error: 'El bus asignado no existe' });
    }
    if (busCheck.rows[0].cooperativa_id !== coopId) {
      return res.status(403).json({ error: 'El bus seleccionado no pertenece a la cooperativa del chofer' });
    }
    busAsignadoId = busCheck.rows[0].id;
  }

  try {
    const passHash = await hashPassword(password);
    const query = `
      INSERT INTO usuarios (nombre, correo, telefono, cedula, rol, password_hash, cooperativa_id, bus_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, nombre, correo, telefono, cedula, rol, creado_en, cooperativa_id, bus_id
    `;
    const result = await db.query(query, [
      nombre.trim(),
      correo.trim().toLowerCase(),
      telefono || '',
      cedula || '',
      rol,
      passHash,
      coopId,
      busAsignadoId
    ]);

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23503') return res.status(400).json({ error: 'La cooperativa o bus seleccionado no existe' });
    if (error.code === '23505') return res.status(409).json({ error: 'El correo ya está registrado' });
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 4. GESTIÓN DE BUSES (LOOP 40/41 ASIENTOS)
// ==========================================

exports.getBuses = async (req, res) => {
  try {
    const query = `
      SELECT b.*, c.nombre AS cooperativa_nombre, c.color_distintivo
      FROM buses b
      JOIN cooperativas c ON b.cooperativa_id = c.id
      ORDER BY b.id ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearBus = async (req, res) => {
  const {
    cooperativa_id,
    numero_disco,
    placa,
    capacidad,
    tiene_bano_posterior,
    estado = 'OPERATIVO',
    columnas = 4,
    pisos = 1,
    celdasBloqueadas = [],
    celdasBano = []
  } = req.body;

  if (!cooperativa_id || !numero_disco || !placa || !capacidad) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el bus' });
  }

  const numCapacidad = parseInt(capacidad, 10);
  if (isNaN(numCapacidad) || numCapacidad < 12 || numCapacidad > 65) {
    return res.status(400).json({ error: 'La capacidad física debe ser un valor numérico entre 12 y 65 asientos (BUS-04).' });
  }

  const tieneBano = tiene_bano_posterior !== undefined ? Boolean(tiene_bano_posterior) : (celdasBano.length > 0 || numCapacidad === 40);

  let estructura;
  try {
    estructura = generarEstructuraCompensada({
      capacidad: numCapacidad,
      columnas: parseInt(columnas, 10) || 4,
      pisos: parseInt(pisos, 10) || 1,
      celdasBloqueadas: Array.isArray(celdasBloqueadas) ? celdasBloqueadas : [],
      celdasBano: Array.isArray(celdasBano) ? celdasBano : []
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE buses DROP CONSTRAINT IF EXISTS buses_capacidad_check');

    // 1. Insertar el bus
    const insertBus = `
      INSERT INTO buses (cooperativa_id, numero_disco, placa, capacidad, tiene_bano_posterior, estado)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const busRes = await client.query(insertBus, [
      cooperativa_id,
      numero_disco,
      placa.trim().toUpperCase(),
      numCapacidad,
      tieneBano,
      estado
    ]);

    const nuevoBus = busRes.rows[0];

    // 2. Insertar asientos según la estructura matricial compensada (BUS-11 al BUS-20)
    for (const a of estructura.asientos) {
      await client.query(
        `INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
         VALUES ($1, $2, $3, $4, $5)`,
        [nuevoBus.id, a.numero_asiento, a.fila, a.columna, a.categoria]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: `Bus #${nuevoBus.numero_disco} registrado con éxito y sus ${numCapacidad} asientos fueron generados con estructura personalizada.`,
      bus: nuevoBus,
      estructura_generada: estructura,
      total_asientos_generados: estructura.asientos.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// Vista previa de plantilla con compensación automática al final (CR-09)
exports.generarVistaPreviaPlantilla = (req, res) => {
  try {
    const resultado = generarEstructuraCompensada(req.body || {});
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Asignar o actualizar plantilla matricial a un bus existente (BUS-18, BUS-19)
exports.asignarPlantillaABus = async (req, res) => {
  const { id } = req.params;
  let estructura;
  try {
    estructura = generarEstructuraCompensada(req.body || {});
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE buses DROP CONSTRAINT IF EXISTS buses_capacidad_check');
    await client.query(
      'UPDATE buses SET capacidad = $1, tiene_bano_posterior = $2 WHERE id = $3',
      [estructura.capacidad_total, (req.body.celdasBano || []).length > 0, id]
    );
    await client.query('DELETE FROM asientos WHERE bus_id = $1', [id]);

    for (const a of estructura.asientos) {
      await client.query(
        `INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, a.numero_asiento, a.fila, a.columna, a.categoria]
      );
    }

    await client.query('COMMIT');
    res.json({
      mensaje: `Estructura de ${estructura.capacidad_total} asientos asignada exitosamente al bus #${id}.`,
      estructura
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ==========================================
// 5. GESTIÓN DE FRECUENCIAS (ANT)
// ==========================================

exports.getFrecuencias = async (req, res) => {
  try {
    const query = `
      SELECT f.*, c.nombre AS cooperativa_nombre, c.color_distintivo, c.logo_url
      FROM frecuencias f
      JOIN cooperativas c ON f.cooperativa_id = c.id
      ORDER BY f.es_destacada DESC, f.id ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearFrecuencia = async (req, res) => {
  const {
    cooperativa_id,
    resolucion_ant,
    origen,
    destino,
    hora_salida,
    precio_base,
    tipo_servicio = 'DIRECTO',
    paradas_intermedias = [],
    es_destacada = false,
    patrocinio_inicio = null,
    patrocinio_fin = null
  } = req.body;

  if (!cooperativa_id || !resolucion_ant || !origen || !destino || !hora_salida || !precio_base) {
    return res.status(400).json({ error: 'Todos los campos de la frecuencia ANT son obligatorios' });
  }

  let paradasArray = [];
  if (Array.isArray(paradas_intermedias)) {
    paradasArray = paradas_intermedias.map(p => String(p).trim()).filter(Boolean);
  } else if (typeof paradas_intermedias === 'string' && paradas_intermedias.trim()) {
    paradasArray = paradas_intermedias.split(',').map(p => p.trim()).filter(Boolean);
  }

  try {
    const query = `
      INSERT INTO frecuencias (cooperativa_id, resolucion_ant, origen, destino, hora_salida, precio_base, tipo_servicio, paradas_intermedias, es_destacada, patrocinio_inicio, patrocinio_fin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await db.query(query, [
      cooperativa_id,
      resolucion_ant.trim(),
      origen.trim(),
      destino.trim(),
      hora_salida,
      parseFloat(precio_base),
      tipo_servicio,
      paradasArray,
      Boolean(es_destacada),
      patrocinio_inicio || null,
      patrocinio_fin || null
    ]);

    res.status(201).json({
      mensaje: 'Frecuencia ANT registrada exitosamente',
      frecuencia: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.eliminarCooperativa = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM cooperativas WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cooperativa no encontrada' });
    res.json({ mensaje: 'Cooperativa eliminada con éxito' });
  } catch (error) {
    console.error('Error al eliminar cooperativa:', error);
    res.status(400).json({ error: 'No se puede eliminar la cooperativa porque tiene frecuencias o buses registrados.' });
  }
};

exports.actualizarBus = async (req, res) => {
  const { id } = req.params;
  const { numero_disco, placa, capacidad, tiene_bano_posterior, estado } = req.body;
  try {
    const result = await db.query(
      `UPDATE buses 
       SET numero_disco = COALESCE($1, numero_disco),
           placa = COALESCE($2, placa),
           capacidad = COALESCE($3, capacidad),
           tiene_bano_posterior = COALESCE($4, tiene_bano_posterior),
           estado = COALESCE($5, estado)
       WHERE id = $6 RETURNING *`,
      [numero_disco, placa ? placa.toUpperCase() : null, capacidad, tiene_bano_posterior, estado, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Bus no encontrado' });
    res.json({ mensaje: 'Bus actualizado con éxito', bus: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar bus:', error);
    res.status(500).json({ error: 'Error al actualizar bus' });
  }
};

exports.eliminarBus = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM asientos WHERE bus_id = $1', [id]);
    const result = await db.query('DELETE FROM buses WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Bus no encontrado' });
    res.json({ mensaje: 'Bus y asientos eliminados con éxito' });
  } catch (error) {
    console.error('Error al eliminar bus:', error);
    res.status(400).json({ error: 'No se puede eliminar el bus porque tiene viajes programados en curso.' });
  }
};

exports.actualizarFrecuencia = async (req, res) => {
  const { id } = req.params;
  const {
    cooperativa_id,
    resolucion_ant,
    origen,
    destino,
    hora_salida,
    precio_base,
    tipo_servicio,
    paradas_intermedias,
    es_destacada,
    patrocinio_inicio,
    patrocinio_fin
  } = req.body;

  let paradasArray = undefined;
  if (paradas_intermedias !== undefined) {
    if (Array.isArray(paradas_intermedias)) {
      paradasArray = paradas_intermedias.map(p => String(p).trim()).filter(Boolean);
    } else if (typeof paradas_intermedias === 'string') {
      paradasArray = paradas_intermedias.split(',').map(p => p.trim()).filter(Boolean);
    }
  }

  try {
    const result = await db.query(
      `UPDATE frecuencias 
       SET cooperativa_id = COALESCE($1, cooperativa_id),
           resolucion_ant = COALESCE($2, resolucion_ant),
           origen = COALESCE($3, origen),
           destino = COALESCE($4, destino),
           hora_salida = COALESCE($5, hora_salida),
           precio_base = COALESCE($6, precio_base),
           tipo_servicio = COALESCE($7, tipo_servicio),
           paradas_intermedias = COALESCE($8, paradas_intermedias),
           es_destacada = COALESCE($9, es_destacada),
           patrocinio_inicio = CASE WHEN $10::text IS NOT NULL THEN $10::timestamp ELSE patrocinio_inicio END,
           patrocinio_fin = CASE WHEN $11::text IS NOT NULL THEN $11::timestamp ELSE patrocinio_fin END
       WHERE id = $12 RETURNING *`,
      [
        cooperativa_id || null,
        resolucion_ant || null,
        origen || null,
        destino || null,
        hora_salida || null,
        precio_base || null,
        tipo_servicio || null,
        paradasArray,
        es_destacada !== undefined ? Boolean(es_destacada) : null,
        patrocinio_inicio !== undefined ? (patrocinio_inicio || null) : null,
        patrocinio_fin !== undefined ? (patrocinio_fin || null) : null,
        id
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Frecuencia no encontrada' });
    res.json({ mensaje: 'Frecuencia actualizada con éxito', frecuencia: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar frecuencia:', error);
    res.status(500).json({ error: 'Error al actualizar frecuencia' });
  }
};

exports.eliminarFrecuencia = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM frecuencias WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Frecuencia no encontrada' });
    res.json({ mensaje: 'Frecuencia eliminada con éxito' });
  } catch (error) {
    console.error('Error al eliminar frecuencia:', error);
    res.status(400).json({ error: 'No se puede eliminar la frecuencia porque tiene viajes programados asociados.' });
  }
};
