const express = require('express');
const router = express.Router();
const choferCtrl = require('../controllers/choferController');
const { requireSession, requireRoles } = require('../services/sessionAccess');

const driverAccess = [requireSession, requireRoles('CHOFER', 'ADMIN_COOP', 'SUPERADMIN')];

// Listar viajes asignados/activos del chofer
router.get('/viajes', ...driverAccess, choferCtrl.obtenerViajesChofer);
router.get('/viajes-hoy', ...driverAccess, choferCtrl.obtenerViajesChofer);

// Manifiesto de pasajeros de un viaje específico
router.get('/viajes/:id/manifiesto', ...driverAccess, choferCtrl.obtenerManifiestoViaje);

// Controles operativos de trayecto (Requerimiento RUTA-16 del docente)
router.post('/viajes/:id/iniciar', ...driverAccess, choferCtrl.iniciarViaje);
router.put('/viajes/:id/iniciar', ...driverAccess, choferCtrl.iniciarViaje);
router.post('/viajes/:id/finalizar', ...driverAccess, choferCtrl.finalizarViaje);
router.put('/viajes/:id/finalizar', ...driverAccess, choferCtrl.finalizarViaje);

// Validación de boleto QR en puerta (Requerimiento VENT-05)
router.post('/validar-qr', ...driverAccess, choferCtrl.validarBoletoPuerta);

// Alternar abordaje manual de emergencia
router.post('/boletos/:boleto_id/toggle-abordaje', ...driverAccess, choferCtrl.toggleAbordajeManual);

module.exports = router;
