const { requireSession, requireRoles } = require('./sessionAccess');

const officeAccess = [requireSession, requireRoles('OFICINISTA', 'SUPERADMIN'), (req, res, next) => {
  if (req.user.rol !== 'SUPERADMIN' && !Number.isInteger(req.user.cooperativa_id)) {
    return res.status(403).json({ error: 'La cuenta de taquilla necesita una cooperativa asignada por gerencia.' });
  }
  next();
}];

const officeScope = req => [req.user.rol === 'SUPERADMIN', req.user.cooperativa_id || null];

// Invocar dentro de la transacción después de bloquear la programación. Los
// datos de ámbito proceden de la sesión consultada en BD, nunca de cabeceras.
async function assertOfficeTrip(client, req, trip) {
  if (!trip) return;
  const { rows } = await client.query(`SELECT f.cooperativa_id AS frecuencia_coop, b.cooperativa_id AS bus_coop
    FROM programacion_viajes pv JOIN frecuencias f ON f.id=pv.frecuencia_id
    JOIN buses b ON b.id=pv.bus_id WHERE pv.id=$1 FOR SHARE OF f,b`, [trip.id]);
  if (req.user.rol !== 'SUPERADMIN' && (!rows[0]
      || rows[0].frecuencia_coop !== req.user.cooperativa_id || rows[0].bus_coop !== req.user.cooperativa_id)) {
    const error = new Error('No tienes permiso para operar viajes de otra cooperativa.');
    error.status = 403; throw error;
  }
}

module.exports = { officeAccess, officeScope, assertOfficeTrip };
