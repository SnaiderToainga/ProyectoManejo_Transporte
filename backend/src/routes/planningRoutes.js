const express = require('express');
const db = require('../config/db');
const planning = require('../services/routePlanning');
const { planningError, positiveId, proposeRotation } = require('../services/routeRotation');
const { requireSession, requireRoles } = require('../services/sessionAccess');
const router = express.Router();

router.use(requireSession, requireRoles('ADMIN_COOP', 'OFICINISTA', 'SUPERADMIN'));

function action(handler, { write = false, status = 200 } = {}) {
  return async (req, res) => {
    let client;
    try {
      if (!['GET', 'DELETE'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) {
        throw planningError('Envía un objeto JSON válido.');
      }
      const requested = req.query.cooperativa_id ?? req.body?.cooperativa_id;
      const cooperativeId = positiveId(req.user.rol === 'SUPERADMIN' ? requested : req.user.cooperativa_id, 'Cooperativa');
      if (requested != null && positiveId(requested) !== cooperativeId) throw planningError('No puedes acceder a otra cooperativa.', 403);
      client = await db.pool.connect();
      await client.query(write ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      if (write) {
        // Serializa altas y ediciones de la misma cooperativa entre peticiones.
        await client.query('SELECT pg_advisory_xact_lock(1800,$1)', [cooperativeId]);
      }
      const result = await handler(client, cooperativeId, req);
      await client.query('COMMIT');
      res.status(status).json(result || { mensaje: 'Cambios guardados.' });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      const status = error.status || ({ '23505': 409, '23503': 409, '42P01': 503, '42703': 503 }[error.code]) || 500;
      const message = error.status ? error.message : status === 409
        ? 'Los datos ya existen o cambiaron. Recarga antes de continuar.' : status === 503
          ? 'La planificación requiere aplicar la migración 04 antes del despliegue.' : 'No se pudo completar la planificación.';
      res.status(status).json({ error: message });
    } finally {
      client?.release();
    }
  };
}

const managers = requireRoles('ADMIN_COOP', 'SUPERADMIN');
router.get('/catalogo', action((client, coop) => planning.catalog(client, coop)));
router.post('/grupos', managers, action((client, coop, req) => planning.createGroup(client, coop, req.body), { write: true, status: 201 }));
router.post('/grupos/:id/miembros', managers, action((client, coop, req) => planning.addGroupMembers(client, coop, req.params.id, req.body), { write: true }));
router.delete('/grupos/:id/miembros/:miembroId', managers, action((client, coop, req) => planning.removeGroupMember(client, coop, req.params.id, req.params.miembroId, req.query.clase || req.body?.clase), { write: true }));
router.post('/vinculos', managers, action((client, coop, req) => planning.linkGroups(client, coop, req.body), { write: true }));
router.post('/sucursales', managers, action((client, coop, req) => planning.createBranch(client, coop, req.body), { write: true, status: 201 }));
router.get('/matriz', action((client, coop, req) => planning.matrix(client, coop, req.query)));
router.post('/propuesta', action(async (client, coop, req) => {
  const current = await planning.matrix(client, coop, req.body);
  const available = current.buses.filter(b => b.estado !== 'MANTENIMIENTO');
  return { asignaciones: proposeRotation(available, current.frecuencias, current.fechas, current.grupo.inicio_ciclo,
    current.paradas.filter(p => p.motivo === 'AVERIA')) };
}));
router.put('/matriz', action((client, coop, req) => planning.saveMatrix(client, coop, req.user.id, req.body), { write: true }));
module.exports = router;
