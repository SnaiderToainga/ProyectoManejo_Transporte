const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../services/passwords');
const { generarEstructuraCompensada } = require('../services/seatTemplateService');
const { createSession } = require('../services/sessionAccess');
const {
  validarEmail,
  validarPasswordSeguro,
  validarPasswordConSimbolo,
  validarCedulaEcuatoriana,
  validarRucEcuatoriano,
  validarCelularEcuatoriano,
  validarResolucionANT,
  validarUrlImagenSegura,
  validarColorHex,
  validarCuentaBancaria,
  validarBanco
} = require('../utils/validators');

const VALID_BUS_STATES = new Set(['OPERATIVO', 'MANTENIMIENTO', 'PARADA']);

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 2147483647 ? parsed : null;
}

function cleanOptionalText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeBusPhotos(body, fallback = { fotos: [], foto_url: null }) {
  if (body.fotos === undefined && body.foto_url === undefined) {
    return fallback;
  }
  if (body.fotos !== undefined && !Array.isArray(body.fotos)) {
    throw Object.assign(new Error('El campo fotos debe ser un arreglo de URLs.'), { status: 400 });
  }

  const rawList = Array.isArray(body.fotos) ? body.fotos : [];
  const merged = [...rawList];
  if (typeof body.foto_url === 'string' && body.foto_url.trim()) {
    if (merged.length === 0) merged.push(body.foto_url);
  }

  const normalized = [];
  const seen = new Set();
  for (const item of merged) {
    const trimmed = typeof item === 'string' ? item.trim() : '';
    if (!trimmed) continue;
    if (!validarUrlImagenSegura(trimmed)) {
      throw Object.assign(new Error('Las URLs de fotografías deben usar HTTP o HTTPS sin credenciales embebidas.'), { status: 400 });
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }

  return {
    fotos: normalized,
    foto_url: normalized[0] || null
  };
}

async function fetchBusWithCoop(runner, busId) {
  const result = await runner.query(
    `SELECT b.*, c.nombre AS cooperativa_nombre, c.color_distintivo
     FROM buses b
     JOIN cooperativas c ON b.cooperativa_id = c.id
     WHERE b.id = $1`,
    [busId]
  );
  return result.rows[0] || null;
}

async function busHasReservations(runner, busId) {
  const result = await runner.query(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM detalle_boletos d
         JOIN asientos a ON a.id = d.asiento_id
         WHERE a.bus_id = $1
       ) OR EXISTS (
         SELECT 1
         FROM reservas r
         JOIN programacion_viajes pv ON pv.id = r.programacion_id
         WHERE pv.bus_id = $1 AND r.estado IN ('PENDIENTE', 'PAGADO')
       )
     ) AS busy`,
    [busId]
  );
  return Boolean(result.rows[0]?.busy);
}

function handlePgError(res, error, conflictMessage, fallbackMessage) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error?.code === '23505') {
    return res.status(409).json({ error: conflictMessage });
  }
  return res.status(500).json({ error: fallbackMessage || error.message });
}

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
              b.numero_disco AS bus_disco, b.placa AS bus_placa,
              (to_jsonb(u)->>'sucursal_id')::int AS sucursal_id
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
        token: createSession(usuario.id),
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
        bus_placa: usuario.bus_placa,
        sucursal_id: usuario.sucursal_id
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
    const params = [];
    let whereClause = '';
    if (req.user?.rol === 'ADMIN_COOP') {
      whereClause = 'WHERE c.id = $1';
      params.push(req.user.cooperativa_id);
    }

    const query = `
      SELECT c.*,
             COUNT(b.id)::int AS total_buses,
             COUNT(CASE WHEN b.capacidad = 40 THEN 1 END)::int AS buses_40,
             COUNT(CASE WHEN b.capacidad = 41 THEN 1 END)::int AS buses_41
      FROM cooperativas c
      LEFT JOIN buses b ON b.cooperativa_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.id ASC
    `;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearCooperativa = async (req, res) => {
  const {
    nombre,
    ruc,
    resolucion_ant,
    telefono,
    correo,
    direccion,
    color_distintivo = '#1E40AF',
    logo_url,
    cuenta_bancaria,
    banco,
    banco_otro,
    activo = true,
    gerente
  } = req.body || {};

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la cooperativa es obligatorio.' });
  }
  if (!validarRucEcuatoriano(ruc)) {
    return res.status(400).json({ error: 'El RUC debe tener 13 dígitos ecuatorianos válidos y terminar en 001.' });
  }
  if (!validarResolucionANT(resolucion_ant)) {
    return res.status(400).json({ error: 'La resolución ANT debe tener un formato válido (ej. ANT-RES-2026-001).' });
  }
  if (!validarCelularEcuatoriano(telefono)) {
    return res.status(400).json({ error: 'El teléfono institucional debe tener 10 dígitos y comenzar con 09.' });
  }
  if (!validarEmail(correo)) {
    return res.status(400).json({ error: 'El correo institucional no tiene un formato válido.' });
  }
  if (!direccion || typeof direccion !== 'string' || !direccion.trim()) {
    return res.status(400).json({ error: 'La dirección de la matriz es obligatoria.' });
  }
  const colorLimpio = String(color_distintivo || '#1E40AF').trim();
  if (!validarColorHex(colorLimpio)) {
    return res.status(400).json({ error: 'El color distintivo debe ser un código hexadecimal válido (#RRGGBB).' });
  }
  const logoLimpio = cleanOptionalText(logo_url);
  if (logoLimpio && !validarUrlImagenSegura(logoLimpio)) {
    return res.status(400).json({ error: 'El logo debe usar una URL HTTP o HTTPS válida sin credenciales embebidas.' });
  }
  if (!validarBanco(banco, banco_otro)) {
    return res.status(400).json({ error: 'Debes seleccionar una entidad bancaria válida.' });
  }
  const bancoFinal = String(banco).trim().toLowerCase() === 'otro' ? String(banco_otro).trim() : String(banco).trim();
  if (!validarCuentaBancaria(cuenta_bancaria)) {
    return res.status(400).json({ error: 'La cuenta bancaria debe tener entre 6 y 30 dígitos numéricos.' });
  }

  if (!gerente || typeof gerente !== 'object') {
    return res.status(400).json({ error: 'Los datos completos del usuario gerente son obligatorios.' });
  }
  if (!gerente.nombre || typeof gerente.nombre !== 'string' || gerente.nombre.trim().length < 3) {
    return res.status(400).json({ error: 'El nombre completo del gerente debe tener al menos 3 caracteres.' });
  }
  if (!validarCedulaEcuatoriana(gerente.cedula)) {
    return res.status(400).json({ error: 'La cédula del gerente no supera la validación ecuatoriana Módulo 10.' });
  }
  if (!validarEmail(gerente.correo)) {
    return res.status(400).json({ error: 'El correo del gerente no es válido.' });
  }
  if (!validarCelularEcuatoriano(gerente.telefono)) {
    return res.status(400).json({ error: 'El celular del gerente debe iniciar en 09 y tener 10 dígitos.' });
  }
  if (!validarPasswordConSimbolo(gerente.password)) {
    return res.status(400).json({ error: 'La contraseña del gerente requiere de 8 a 128 caracteres, mayúscula, minúscula, número y símbolo.' });
  }
  if (gerente.rol && gerente.rol !== 'ADMIN_COOP') {
    return res.status(400).json({ error: 'El usuario inicial de la cooperativa solo puede crearse con rol ADMIN_COOP.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const coopRes = await client.query(
      `INSERT INTO cooperativas
         (nombre, ruc, resolucion_ant, telefono, correo, direccion, color_distintivo, logo_url, cuenta_bancaria, banco, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        nombre.trim(),
        ruc.trim(),
        resolucion_ant.trim().toUpperCase(),
        telefono.trim(),
        correo.trim().toLowerCase(),
        direccion.trim(),
        colorLimpio,
        logoLimpio,
        cuenta_bancaria.trim(),
        bancoFinal,
        Boolean(activo)
      ]
    );

    const nuevaCoop = coopRes.rows[0];
    const passHash = await hashPassword(gerente.password);

    const userRes = await client.query(
      `INSERT INTO usuarios (nombre, correo, telefono, cedula, rol, password_hash, cooperativa_id)
       VALUES ($1, $2, $3, $4, 'ADMIN_COOP', $5, $6)
       RETURNING id, nombre, correo, telefono, cedula, rol, cooperativa_id`,
      [
        gerente.nombre.trim(),
        gerente.correo.trim().toLowerCase(),
        gerente.telefono.trim(),
        gerente.cedula.trim(),
        passHash,
        nuevaCoop.id
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      cooperativa: nuevaCoop,
      gerente: userRes.rows[0],
      mensaje: 'Cooperativa creada exitosamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return handlePgError(
      res,
      error,
      'Ya existe una cooperativa con ese RUC/nombre o un usuario registrado con ese correo.'
    );
  } finally {
    client.release();
  }
};

exports.actualizarCooperativa = async (req, res) => {
  const coopId = parsePositiveInt(req.params.id);
  if (!coopId) return res.status(400).json({ error: 'ID de cooperativa inválido.' });

  const body = req.body || {};

  try {
    const existingRes = await db.query('SELECT * FROM cooperativas WHERE id = $1', [coopId]);
    const existing = existingRes.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Cooperativa no encontrada' });
    }

    let nextNombre = existing.nombre;
    if (body.nombre !== undefined) {
      if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
        return res.status(400).json({ error: 'El nombre de la cooperativa no puede estar vacío.' });
      }
      nextNombre = body.nombre.trim();
    }

    let nextRuc = existing.ruc;
    if (body.ruc !== undefined && String(body.ruc).trim() !== String(existing.ruc || '').trim()) {
      if (!validarRucEcuatoriano(body.ruc)) {
        return res.status(400).json({ error: 'El RUC debe tener 13 dígitos ecuatorianos válidos y terminar en 001.' });
      }
      nextRuc = String(body.ruc).trim();
    }

    let nextResolucion = existing.resolucion_ant;
    if (body.resolucion_ant !== undefined) {
      const trimmed = String(body.resolucion_ant || '').trim();
      if (trimmed) {
        if (!validarResolucionANT(trimmed)) {
          return res.status(400).json({ error: 'La resolución ANT debe tener un formato válido (ej. ANT-RES-2026-001).' });
        }
        nextResolucion = trimmed.toUpperCase();
      } else if (existing.resolucion_ant) {
        return res.status(400).json({ error: 'La resolución ANT es obligatoria.' });
      } else {
        nextResolucion = null;
      }
    }

    let nextCorreo = existing.correo;
    if (body.correo !== undefined) {
      const trimmed = String(body.correo || '').trim().toLowerCase();
      if (trimmed) {
        if (!validarEmail(trimmed)) {
          return res.status(400).json({ error: 'El correo institucional no tiene un formato válido.' });
        }
        nextCorreo = trimmed;
      } else if (existing.correo) {
        return res.status(400).json({ error: 'El correo institucional es obligatorio.' });
      } else {
        nextCorreo = null;
      }
    }

    let nextTelefono = existing.telefono;
    if (body.telefono !== undefined) {
      const trimmed = String(body.telefono || '').trim();
      if (trimmed !== String(existing.telefono || '').trim()) {
        if (!validarCelularEcuatoriano(trimmed)) {
          return res.status(400).json({ error: 'El teléfono institucional debe tener 10 dígitos y comenzar con 09.' });
        }
        nextTelefono = trimmed;
      }
    }

    let nextDireccion = existing.direccion;
    if (body.direccion !== undefined) {
      const trimmed = String(body.direccion || '').trim();
      if (!trimmed && existing.direccion) {
        return res.status(400).json({ error: 'La dirección institucional no puede quedar vacía.' });
      }
      nextDireccion = trimmed || null;
    }

    let nextColor = existing.color_distintivo;
    if (body.color_distintivo !== undefined) {
      const trimmed = String(body.color_distintivo || '').trim();
      if (!validarColorHex(trimmed)) {
        return res.status(400).json({ error: 'El color distintivo debe ser un código hexadecimal válido (#RRGGBB).' });
      }
      nextColor = trimmed;
    }

    let nextLogo = existing.logo_url;
    if (body.logo_url !== undefined) {
      const trimmed = cleanOptionalText(body.logo_url);
      if (trimmed && !validarUrlImagenSegura(trimmed)) {
        return res.status(400).json({ error: 'El logo debe usar una URL HTTP o HTTPS válida sin credenciales embebidas.' });
      }
      nextLogo = trimmed;
    }

    let nextBanco = existing.banco;
    if (body.banco !== undefined) {
      if (!validarBanco(body.banco, body.banco_otro)) {
        return res.status(400).json({ error: 'Debes seleccionar una entidad bancaria válida.' });
      }
      nextBanco = String(body.banco).trim().toLowerCase() === 'otro'
        ? String(body.banco_otro).trim()
        : String(body.banco).trim();
    }

    let nextCuenta = existing.cuenta_bancaria;
    if (body.cuenta_bancaria !== undefined) {
      const trimmed = String(body.cuenta_bancaria || '').trim();
      if (trimmed !== String(existing.cuenta_bancaria || '').trim()) {
        if (!validarCuentaBancaria(trimmed)) {
          return res.status(400).json({ error: 'La cuenta bancaria debe tener entre 6 y 30 dígitos numéricos.' });
        }
        nextCuenta = trimmed;
      }
    }

    const nextActivo = req.user?.rol === 'SUPERADMIN' && body.activo !== undefined
      ? Boolean(body.activo)
      : existing.activo;

    const result = await db.query(
      `UPDATE cooperativas
       SET nombre = $1,
           ruc = $2,
           resolucion_ant = $3,
           telefono = $4,
           correo = $5,
           direccion = $6,
           color_distintivo = $7,
           logo_url = $8,
           cuenta_bancaria = $9,
           banco = $10,
           activo = $11
       WHERE id = $12
       RETURNING *`,
      [
        nextNombre,
        nextRuc,
        nextResolucion,
        nextTelefono,
        nextCorreo,
        nextDireccion,
        nextColor,
        nextLogo,
        nextCuenta,
        nextBanco,
        nextActivo,
        coopId
      ]
    );

    res.json({
      mensaje: 'Cooperativa actualizada correctamente',
      cooperativa: result.rows[0]
    });
  } catch (error) {
    return handlePgError(
      res,
      error,
      'Ya existe otra cooperativa registrada con ese nombre o RUC.'
    );
  }
};

// ==========================================
// 3. GESTIÓN DE USUARIOS DE COOPERATIVA
// ==========================================

exports.getUsuarios = async (req, res) => {
  if (req.user.rol !== 'SUPERADMIN' && req.query.cooperativa_id != null
      && Number(req.query.cooperativa_id) !== req.user.cooperativa_id) {
    return res.status(403).json({ error: 'No puedes consultar usuarios de otra cooperativa.' });
  }
  const cooperativa_id = req.user.rol === 'SUPERADMIN' ? req.query.cooperativa_id : req.user.cooperativa_id;
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
  const { nombre, correo, telefono, cedula, rol, password, cooperativa_id, bus_id, sucursal_id } = req.body;
  const creador_rol = req.user.rol;
  const creador_coop_id = req.user.cooperativa_id;

  if (creador_rol === 'ADMIN_COOP' && (!['OFICINISTA', 'CHOFER'].includes(rol)
      || (cooperativa_id != null && Number(cooperativa_id) !== creador_coop_id))) {
    return res.status(403).json({ error: 'Solo puedes crear oficinistas y choferes de tu cooperativa.' });
  }

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
  if (rol === 'OFICINISTA' && (!validarEmail(correo) || !validarPasswordSeguro(password))) {
    return res.status(400).json({ error: 'Indica un correo válido y una contraseña de 8 a 128 caracteres con mayúscula, minúscula y número.' });
  }

  const coopId = creador_rol === 'ADMIN_COOP' ? creador_coop_id : (cooperativa_id ? Number(cooperativa_id) : null);
  if ((rol === 'ADMIN_COOP' || rol === 'CHOFER' || rol === 'OFICINISTA') && (!Number.isInteger(coopId) || coopId < 1 || coopId > 2147483647)) {
    return res.status(400).json({ error: 'Selecciona una cooperativa válida' });
  }

  let sucursalId = null;
  if (rol === 'OFICINISTA') {
    if (!Number.isInteger(Number(sucursal_id)) || Number(sucursal_id) < 1 || Number(sucursal_id) > 2147483647) {
      return res.status(400).json({ error: 'Asigna una sucursal al oficinista.' });
    }
    const branch = await db.query('SELECT id FROM sucursales WHERE id=$1 AND cooperativa_id=$2', [Number(sucursal_id), coopId]);
    if (!branch.rows[0]) return res.status(403).json({ error: 'La sucursal no pertenece a tu cooperativa.' });
    sucursalId = branch.rows[0].id;
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
      INSERT INTO usuarios (nombre, correo, telefono, cedula, rol, password_hash, cooperativa_id, bus_id, sucursal_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, nombre, correo, telefono, cedula, rol, creado_en, cooperativa_id, bus_id, sucursal_id
    `;
    const result = await db.query(query, [
      nombre.trim(),
      correo.trim().toLowerCase(),
      telefono || '',
      cedula || '',
      rol,
      passHash,
      coopId,
      busAsignadoId,
      sucursalId
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
    const params = [];
    let whereClause = '';
    if (req.user?.rol === 'ADMIN_COOP') {
      whereClause = 'WHERE b.cooperativa_id = $1';
      params.push(req.user.cooperativa_id);
    } else if (req.query.cooperativa_id) {
      const requestedCoop = parsePositiveInt(req.query.cooperativa_id);
      if (!requestedCoop) return res.status(400).json({ error: 'cooperativa_id inválido.' });
      whereClause = 'WHERE b.cooperativa_id = $1';
      params.push(requestedCoop);
    }

    const query = `
      SELECT b.*, c.nombre AS cooperativa_nombre, c.color_distintivo
      FROM buses b
      JOIN cooperativas c ON b.cooperativa_id = c.id
      ${whereClause}
      ORDER BY b.id ASC
    `;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAsientosBus = async (req, res) => {
  const busId = parsePositiveInt(req.params.id);
  if (!busId) return res.status(400).json({ error: 'ID de bus inválido.' });

  try {
    const bus = await fetchBusWithCoop(db, busId);
    if (!bus) return res.status(404).json({ error: 'Bus no encontrado.' });
    if (req.user?.rol === 'ADMIN_COOP' && Number(bus.cooperativa_id) !== Number(req.user.cooperativa_id)) {
      return res.status(403).json({ error: 'No tienes permiso para consultar los asientos de otra cooperativa.' });
    }

    const seatsRes = await db.query(
      `SELECT id AS asiento_id,
              numero_asiento,
              fila,
              columna,
              categoria,
              'DISPONIBLE' AS estado_ocupacion
       FROM asientos
       WHERE bus_id = $1 AND activo IS DISTINCT FROM false
       ORDER BY numero_asiento ASC`,
      [busId]
    );

    res.json({
      bus_id: bus.id,
      numero_disco: bus.numero_disco,
      placa: bus.placa,
      capacidad: bus.capacidad,
      asientos: seatsRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearBus = async (req, res) => {
  const body = req.body || {};
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
    celdasBano = [],
    marca_chasis,
    carroceria,
    socio_nombre
  } = body;

  const targetCoopId = req.user?.rol === 'ADMIN_COOP'
    ? req.user.cooperativa_id
    : parsePositiveInt(cooperativa_id);

  if (req.user?.rol === 'ADMIN_COOP' && cooperativa_id !== undefined && cooperativa_id !== null
      && Number(cooperativa_id) !== Number(req.user.cooperativa_id)) {
    return res.status(403).json({ error: 'Solo puedes registrar unidades dentro de tu cooperativa asignada.' });
  }
  if (!targetCoopId) {
    return res.status(400).json({ error: 'La cooperativa de la unidad es obligatoria.' });
  }

  const discoNum = parsePositiveInt(numero_disco);
  if (!discoNum) {
    return res.status(400).json({ error: 'El número de disco debe ser un entero positivo.' });
  }
  if (!placa || typeof placa !== 'string' || !placa.trim() || placa.trim().length > 10) {
    return res.status(400).json({ error: 'La placa es obligatoria (máximo 10 caracteres).' });
  }

  const numCapacidad = parseInt(capacidad, 10);
  if (isNaN(numCapacidad) || numCapacidad < 1 || numCapacidad > 100) {
    return res.status(400).json({ error: 'La capacidad física debe ser un entero positivo entre 1 y 100 asientos.' });
  }

  const estadoLimpio = String(estado || 'OPERATIVO').trim().toUpperCase();
  if (!VALID_BUS_STATES.has(estadoLimpio)) {
    return res.status(400).json({ error: 'Estado de bus inválido. Usa OPERATIVO, MANTENIMIENTO o PARADA.' });
  }

  let photos;
  try {
    photos = normalizeBusPhotos(body);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const tieneBano = tiene_bano_posterior !== undefined
    ? Boolean(tiene_bano_posterior)
    : (Array.isArray(celdasBano) && celdasBano.length > 0) || numCapacidad === 40;

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

    const coopCheck = await client.query('SELECT id FROM cooperativas WHERE id = $1', [targetCoopId]);
    if (coopCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La cooperativa indicada no existe.' });
    }

    await client.query('ALTER TABLE buses DROP CONSTRAINT IF EXISTS buses_capacidad_check');

    const busRes = await client.query(
      `INSERT INTO buses
         (cooperativa_id, numero_disco, placa, capacidad, tiene_bano_posterior, estado,
          marca_chasis, carroceria, socio_nombre, foto_url, fotos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        targetCoopId,
        discoNum,
        placa.trim().toUpperCase(),
        numCapacidad,
        tieneBano,
        estadoLimpio,
        cleanOptionalText(marca_chasis) || null,
        cleanOptionalText(carroceria) || null,
        cleanOptionalText(socio_nombre) || null,
        photos.foto_url,
        photos.fotos
      ]
    );

    const busId = busRes.rows[0].id;

    for (const a of estructura.asientos) {
      await client.query(
        `INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
         VALUES ($1, $2, $3, $4, $5)`,
        [busId, a.numero_asiento, a.fila, a.columna, a.categoria]
      );
    }

    const nuevoBus = await fetchBusWithCoop(client, busId);
    await client.query('COMMIT');

    res.status(201).json({
      mensaje: `Bus #${nuevoBus.numero_disco} registrado con éxito y sus ${numCapacidad} asientos fueron generados con estructura personalizada.`,
      bus: nuevoBus,
      estructura_generada: estructura,
      total_asientos_generados: estructura.asientos.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return handlePgError(
      res,
      error,
      'Ya existe una unidad registrada con esa placa o número de disco en la cooperativa.'
    );
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
  const busId = parsePositiveInt(req.params.id);
  if (!busId) return res.status(400).json({ error: 'ID de bus inválido.' });

  let estructura;
  try {
    estructura = generarEstructuraCompensada(req.body || {});
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existingRes = await client.query('SELECT id, cooperativa_id FROM buses WHERE id = $1 FOR UPDATE', [busId]);
    const existing = existingRes.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bus no encontrado' });
    }
    if (req.user?.rol === 'ADMIN_COOP' && Number(existing.cooperativa_id) !== Number(req.user.cooperativa_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permiso para modificar la estructura de otra cooperativa.' });
    }
    if (await busHasReservations(client, busId)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede reemplazar la estructura porque la unidad ya tiene boletos o reservas registradas.' });
    }

    await client.query('ALTER TABLE buses DROP CONSTRAINT IF EXISTS buses_capacidad_check');
    await client.query(
      'UPDATE buses SET capacidad = $1, tiene_bano_posterior = $2 WHERE id = $3',
      [estructura.capacidad_total, (req.body.celdasBano || []).length > 0, busId]
    );
    await client.query('DELETE FROM asientos WHERE bus_id = $1', [busId]);

    for (const a of estructura.asientos) {
      await client.query(
        `INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
         VALUES ($1, $2, $3, $4, $5)`,
        [busId, a.numero_asiento, a.fila, a.columna, a.categoria]
      );
    }

    await client.query('COMMIT');
    res.json({
      mensaje: `Estructura de ${estructura.capacidad_total} asientos asignada exitosamente al bus #${busId}.`,
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
  const busId = parsePositiveInt(req.params.id);
  if (!busId) return res.status(400).json({ error: 'ID de bus inválido.' });

  const body = req.body || {};
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const existingRes = await client.query('SELECT * FROM buses WHERE id = $1 FOR UPDATE', [busId]);
    const existing = existingRes.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bus no encontrado' });
    }

    if (req.user?.rol === 'ADMIN_COOP' && Number(existing.cooperativa_id) !== Number(req.user.cooperativa_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permiso para editar unidades de otra cooperativa.' });
    }
    if (req.user?.rol === 'ADMIN_COOP' && body.cooperativa_id !== undefined && body.cooperativa_id !== null
        && Number(body.cooperativa_id) !== Number(existing.cooperativa_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No puedes transferir una unidad a otra cooperativa.' });
    }

    let nextDisco = existing.numero_disco;
    if (body.numero_disco !== undefined && body.numero_disco !== null) {
      nextDisco = parsePositiveInt(body.numero_disco);
      if (!nextDisco) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El número de disco debe ser un entero positivo.' });
      }
    }

    let nextPlaca = existing.placa;
    if (body.placa !== undefined) {
      if (typeof body.placa !== 'string' || !body.placa.trim() || body.placa.trim().length > 10) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La placa es obligatoria (máximo 10 caracteres).' });
      }
      nextPlaca = body.placa.trim().toUpperCase();
    }

    let nextCapacidad = existing.capacidad;
    if (body.capacidad !== undefined && body.capacidad !== null) {
      const parsedCap = parseInt(body.capacidad, 10);
      if (isNaN(parsedCap) || parsedCap < 1 || parsedCap > 100) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La capacidad física debe estar entre 1 y 100 asientos.' });
      }
      nextCapacidad = parsedCap;
    }

    let nextEstado = existing.estado;
    if (body.estado !== undefined) {
      nextEstado = String(body.estado || '').trim().toUpperCase();
      if (!VALID_BUS_STATES.has(nextEstado)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Estado de bus inválido. Usa OPERATIVO, MANTENIMIENTO o PARADA.' });
      }
    }

    const nextBano = body.tiene_bano_posterior !== undefined
      ? Boolean(body.tiene_bano_posterior)
      : existing.tiene_bano_posterior;
    const nextChasis = body.marca_chasis !== undefined ? cleanOptionalText(body.marca_chasis) : existing.marca_chasis;
    const nextCarroceria = body.carroceria !== undefined ? cleanOptionalText(body.carroceria) : existing.carroceria;
    const nextSocio = body.socio_nombre !== undefined ? cleanOptionalText(body.socio_nombre) : existing.socio_nombre;
    const photos = normalizeBusPhotos(body, {
      fotos: Array.isArray(existing.fotos) ? existing.fotos : [],
      foto_url: existing.foto_url || null
    });

    // Solo si cambia capacidad validamos ausencia de boletos/reservas; en edición técnica se preservan asientos existentes.
    if (nextCapacidad !== existing.capacidad) {
      if (await busHasReservations(client, busId)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'No se puede cambiar la capacidad porque esta unidad ya tiene reservas o boletos emitidos.'
        });
      }
      const nuevaEstructura = generarEstructuraCompensada({ capacidad: nextCapacidad });
      await client.query('DELETE FROM asientos WHERE bus_id = $1', [busId]);
      for (const a of nuevaEstructura.asientos) {
        await client.query(
          `INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
           VALUES ($1, $2, $3, $4, $5)`,
          [busId, a.numero_asiento, a.fila, a.columna, a.categoria]
        );
      }
    }

    await client.query(
      `UPDATE buses
       SET numero_disco = $1,
           placa = $2,
           capacidad = $3,
           tiene_bano_posterior = $4,
           estado = $5,
           marca_chasis = $6,
           carroceria = $7,
           socio_nombre = $8,
           foto_url = $9,
           fotos = $10
       WHERE id = $11`,
      [
        nextDisco,
        nextPlaca,
        nextCapacidad,
        nextBano,
        nextEstado,
        nextChasis,
        nextCarroceria,
        nextSocio,
        photos.foto_url,
        photos.fotos,
        busId
      ]
    );

    const updatedBus = await fetchBusWithCoop(client, busId);
    await client.query('COMMIT');

    res.json({ mensaje: 'Bus actualizado con éxito', bus: updatedBus });
  } catch (error) {
    await client.query('ROLLBACK');
    return handlePgError(
      res,
      error,
      'Ya existe otro bus con esa placa o número de disco en la cooperativa.',
      'Error al actualizar bus'
    );
  } finally {
    client.release();
  }
};

exports.eliminarBus = async (req, res) => {
  const busId = parsePositiveInt(req.params.id);
  if (!busId) return res.status(400).json({ error: 'ID de bus inválido.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existingRes = await client.query('SELECT id, cooperativa_id FROM buses WHERE id = $1 FOR UPDATE', [busId]);
    const existing = existingRes.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bus no encontrado' });
    }
    if (req.user?.rol === 'ADMIN_COOP' && Number(existing.cooperativa_id) !== Number(req.user.cooperativa_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permiso para eliminar unidades de otra cooperativa.' });
    }

    await client.query('DELETE FROM asientos WHERE bus_id = $1', [busId]);
    await client.query('DELETE FROM buses WHERE id = $1', [busId]);
    await client.query('COMMIT');

    res.json({ mensaje: 'Bus y asientos eliminados con éxito' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar bus:', error);
    res.status(400).json({ error: 'No se puede eliminar el bus porque tiene viajes programados en curso.' });
  } finally {
    client.release();
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
