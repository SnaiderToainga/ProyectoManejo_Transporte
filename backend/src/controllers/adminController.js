const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../services/passwords');

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
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.rol, u.password_hash,
              c.id AS cooperativa_id, c.nombre AS cooperativa_nombre
       FROM usuarios u LEFT JOIN cooperativas c ON c.id = u.cooperativa_id
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

    const redirectPath = usuario.rol === 'OFICINISTA' ? '/oficina' : '/admin';

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        telefono: usuario.telefono,
        cooperativa_id: usuario.cooperativa_id,
        cooperativa_nombre: usuario.cooperativa_nombre
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
  const { nombre, ruc, color_distintivo, cuenta_bancaria, banco, activo } = req.body;

  try {
    const query = `
      UPDATE cooperativas
      SET nombre = COALESCE($1, nombre),
          ruc = COALESCE($2, ruc),
          color_distintivo = COALESCE($3, color_distintivo),
          cuenta_bancaria = COALESCE($4, cuenta_bancaria),
          banco = COALESCE($5, banco),
          activo = COALESCE($6, activo)
      WHERE id = $7
      RETURNING *
    `;
    const result = await db.query(query, [
      nombre,
      ruc,
      color_distintivo,
      cuenta_bancaria,
      banco,
      activo,
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
  try {
    const result = await db.query(
      'SELECT id, nombre, correo, telefono, rol, creado_en FROM usuarios ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearUsuario = async (req, res) => {
  const { nombre, correo, telefono, rol, password, cooperativa_id } = req.body;

  if (typeof nombre !== 'string' || !nombre.trim() || typeof correo !== 'string' || !correo.trim() || !rol) {
    return res.status(400).json({ error: 'Nombre, correo y rol son obligatorios' });
  }

  const rolesPermitidos = ['ADMIN_COOP', 'OFICINISTA', 'SUPERADMIN'];
  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no permitido para gestión administrativa' });
  }

  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 128 caracteres' });
  }
  const coopId = rol === 'ADMIN_COOP' ? Number(cooperativa_id) : null;
  if (rol === 'ADMIN_COOP' && (!Number.isInteger(coopId) || coopId < 1 || coopId > 2147483647)) {
    return res.status(400).json({ error: 'Selecciona una cooperativa válida' });
  }
  try {
    const passHash = await hashPassword(password);
    const query = `
      INSERT INTO usuarios (nombre, correo, telefono, rol, password_hash, cooperativa_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombre, correo, telefono, rol, creado_en, cooperativa_id
    `;
    const result = await db.query(query, [
      nombre.trim(),
      correo.trim().toLowerCase(),
      telefono || '',
      rol,
      passHash,
      coopId
    ]);

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23503') return res.status(400).json({ error: 'La cooperativa seleccionada no existe' });
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
    estado = 'OPERATIVO'
  } = req.body;

  if (!cooperativa_id || !numero_disco || !placa || !capacidad) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el bus' });
  }

  const numCapacidad = parseInt(capacidad, 10);
  if (numCapacidad !== 40 && numCapacidad !== 41) {
    return res.status(400).json({ error: 'La capacidad física debe ser exactamente de 40 o 41 asientos' });
  }

  const tieneBano = tiene_bano_posterior !== undefined ? Boolean(tiene_bano_posterior) : (numCapacidad === 40);

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

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

    // 2. Loop atómico generador de los 40 o 41 asientos
    for (let i = 1; i <= numCapacidad; i++) {
      const categoria = i <= 4 ? 'VIP' : 'NORMAL';
      const fila = Math.floor((i - 1) / 4) + 1;
      const columna = ((i - 1) % 4) + 1;

      await client.query(
        `INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
         VALUES ($1, $2, $3, $4, $5)`,
        [nuevoBus.id, i, fila, columna, categoria]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: `Bus #${nuevoBus.numero_disco} registrado con éxito y sus ${numCapacidad} asientos fueron generados en la base de datos.`,
      bus: nuevoBus,
      total_asientos_generados: numCapacidad
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
      SELECT f.*, c.nombre AS cooperativa_nombre, c.color_distintivo
      FROM frecuencias f
      JOIN cooperativas c ON f.cooperativa_id = c.id
      ORDER BY f.id ASC
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
    tipo_servicio = 'DIRECTO'
  } = req.body;

  if (!cooperativa_id || !resolucion_ant || !origen || !destino || !hora_salida || !precio_base) {
    return res.status(400).json({ error: 'Todos los campos de la frecuencia ANT son obligatorios' });
  }

  try {
    const query = `
      INSERT INTO frecuencias (cooperativa_id, resolucion_ant, origen, destino, hora_salida, precio_base, tipo_servicio)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [
      cooperativa_id,
      resolucion_ant.trim(),
      origen.trim(),
      destino.trim(),
      hora_salida,
      parseFloat(precio_base),
      tipo_servicio
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
  const { resolucion_ant, origen, destino, hora_salida, precio_base, tipo_servicio } = req.body;
  try {
    const result = await db.query(
      `UPDATE frecuencias 
       SET resolucion_ant = COALESCE($1, resolucion_ant),
           origen = COALESCE($2, origen),
           destino = COALESCE($3, destino),
           hora_salida = COALESCE($4, hora_salida),
           precio_base = COALESCE($5, precio_base),
           tipo_servicio = COALESCE($6, tipo_servicio)
       WHERE id = $7 RETURNING *`,
      [resolucion_ant, origen, destino, hora_salida, precio_base, tipo_servicio, id]
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
