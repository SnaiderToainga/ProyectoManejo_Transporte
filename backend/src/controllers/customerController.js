const db = require('../config/db');
const historyAccess = require('../services/historyAccess');
const { hashPassword, verifyPassword } = require('../services/passwords');
const {
  createCustomerToken,
  verifyCustomerToken,
  extractBearerToken,
  loadAuthenticatedCustomer
} = require('../services/customerAccess');
const {
  validarCedulaEcuatoriana,
  validarEmail,
  validarPasswordConSimbolo
} = require('../utils/validators');

const formatCliente = (row) => ({
  id: row.id,
  nombre: row.nombre,
  cedula: row.cedula || '',
  email: row.correo
});

exports.registrar = async (req, res) => {
  const body = req.body || {};
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const cedula = typeof body.cedula === 'string' ? body.cedula.trim() : '';
  const rawEmail = typeof body.email === 'string' ? body.email : body.correo;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const password = body.password;

  res.set('Cache-Control', 'no-store');

  if (nombre.length < 3 || nombre.length > 100) {
    return res.status(400).json({ error: 'Ingresa tu nombre completo (entre 3 y 100 caracteres).' });
  }
  if (!validarCedulaEcuatoriana(cedula)) {
    return res.status(400).json({ error: 'La cédula ingresada no es válida.' });
  }
  if (!email || email.length > 100 || !validarEmail(email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }
  if (!validarPasswordConSimbolo(password)) {
    return res.status(400).json({
      error: 'La contraseña debe tener entre 8 y 128 caracteres, mayúscula, minúscula, número y símbolo.'
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const byEmailRes = await client.query(
      `SELECT id, rol, password_hash
       FROM usuarios
       WHERE LOWER(TRIM(correo)) = $1
       FOR UPDATE`,
      [email]
    );
    const existingByEmail = byEmailRes.rows[0];

    if (existingByEmail && existingByEmail.rol !== 'CLIENTE') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Este correo pertenece a una cuenta operativa del sistema. Usa un correo personal.'
      });
    }
    if (existingByEmail && existingByEmail.password_hash !== 'invitado_sin_password') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Ya existe una cuenta registrada con ese correo electrónico.'
      });
    }

    const byCedulaRes = await client.query(
      `SELECT id
       FROM usuarios
       WHERE cedula = $1
         AND rol = 'CLIENTE'
         AND password_hash <> 'invitado_sin_password'
         AND id IS DISTINCT FROM $2::int`,
      [cedula, existingByEmail?.id || null]
    );
    if (byCedulaRes.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Ya existe una cuenta de cliente registrada con esa cédula.'
      });
    }

    const passwordHash = await hashPassword(password);
    let savedUser;

    if (existingByEmail) {
      // Eleva la cuenta de visitante existente para conservar su historial previo de compras.
      const upgraded = await client.query(
        `UPDATE usuarios
         SET nombre = $1,
             cedula = $2,
             password_hash = $3
         WHERE id = $4
         RETURNING id, nombre, cedula, correo`,
        [nombre, cedula, passwordHash, existingByEmail.id]
      );
      savedUser = upgraded.rows[0];
    } else {
      const inserted = await client.query(
        `INSERT INTO usuarios (nombre, correo, cedula, rol, password_hash)
         VALUES ($1, $2, $3, 'CLIENTE', $4)
         RETURNING id, nombre, cedula, correo`,
        [nombre, email, cedula, passwordHash]
      );
      savedUser = inserted.rows[0];
    }

    await client.query('COMMIT');

    res.status(201).json({
      token: createCustomerToken(savedUser.id),
      cliente: formatCliente(savedUser)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ese correo o cédula ya se encuentra registrado.' });
    }
    console.error('Error al registrar cliente:', error.message);
    res.status(500).json({ error: 'No se pudo completar el registro de cliente.' });
  } finally {
    client.release();
  }
};

exports.iniciarSesion = async (req, res) => {
  const body = req.body || {};
  const rawEmail = typeof body.email === 'string' ? body.email : body.correo;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const password = body.password;

  res.set('Cache-Control', 'no-store');

  if (!email || !validarEmail(email) || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ error: 'Correo y contraseña válidos son obligatorios.' });
  }

  try {
    const result = await db.query(
      `SELECT id, nombre, cedula, correo, rol, password_hash
       FROM usuarios
       WHERE LOWER(TRIM(correo)) = $1`,
      [email]
    );
    const user = result.rows[0];

    if (
      !user ||
      user.rol !== 'CLIENTE' ||
      user.password_hash === 'invitado_sin_password' ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    res.json({
      token: createCustomerToken(user.id),
      cliente: formatCliente(user)
    });
  } catch (error) {
    console.error('Error al iniciar sesión de cliente:', error.message);
    res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
};

exports.obtenerPerfil = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ cliente: req.customer });
};

exports.buscarPorCedula = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Autorización requerida para consultar datos guardados.' });
  }

  let customer = null;
  let scopedEmail = null;

  const customerId = verifyCustomerToken(token);
  if (customerId) {
    customer = await loadAuthenticatedCustomer(customerId);
    if (customer) scopedEmail = customer.email.toLowerCase();
  }

  if (!customer) {
    scopedEmail = historyAccess.verifyToken(token);
  }

  if (!scopedEmail) {
    return res.status(401).json({ error: 'Tu sesión o enlace de historial no es válido o expiró.' });
  }

  const cedula = String(req.params.cedula || '').trim();
  if (!validarCedulaEcuatoriana(cedula)) {
    return res.status(400).json({ error: 'La cédula consultada no es válida.' });
  }

  if (customer && customer.cedula === cedula) {
    return res.json({
      cliente: {
        nombre: customer.nombre,
        cedula: customer.cedula,
        email: customer.email
      }
    });
  }

  try {
    const companionRes = await db.query(
      `SELECT d.nombre_pasajero,
              d.cedula_pasajero,
              u.cedula AS owner_cedula,
              u.correo AS owner_correo
       FROM detalle_boletos d
       JOIN reservas r ON r.id = d.reserva_id
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE d.cedula_pasajero = $1
         AND (
           ($2::int IS NOT NULL AND u.id = $2::int)
           OR LOWER(TRIM(u.correo)) = $3
         )
       ORDER BY r.creado_en DESC, d.id DESC
       LIMIT 1`,
      [cedula, customer?.id || null, scopedEmail]
    );

    const row = companionRes.rows[0];
    if (!row) {
      return res.status(404).json({
        error: 'No encontramos un pasajero frecuente con esa cédula dentro de tu cuenta.'
      });
    }

    res.json({
      cliente: {
        nombre: row.nombre_pasajero,
        cedula: row.cedula_pasajero,
        email: row.owner_cedula === cedula ? row.owner_correo : null
      }
    });
  } catch (error) {
    console.error('Error al consultar pasajero por cédula:', error.message);
    res.status(500).json({ error: 'No se pudo consultar los datos guardados.' });
  }
};
