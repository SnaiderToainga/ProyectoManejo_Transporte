const express = require('express');
const router = express.Router();
const choferCtrl = require('../controllers/choferController');

// Listar viajes asignados/activos del chofer
router.get('/viajes', choferCtrl.obtenerViajesChofer);
router.get('/viajes-hoy', choferCtrl.obtenerViajesChofer);

// Manifiesto de pasajeros de un viaje específico
router.get('/viajes/:id/manifiesto', choferCtrl.obtenerManifiestoViaje);

// Controles operativos de trayecto (Requerimiento RUTA-16 del docente)
router.post('/viajes/:id/iniciar', choferCtrl.iniciarViaje);
router.put('/viajes/:id/iniciar', choferCtrl.iniciarViaje);
router.post('/viajes/:id/finalizar', choferCtrl.finalizarViaje);
router.put('/viajes/:id/finalizar', choferCtrl.finalizarViaje);

// Validación de boleto QR en puerta (Requerimiento VENT-05)
router.post('/validar-qr', choferCtrl.validarBoletoPuerta);

// Alternar abordaje manual de emergencia
router.post('/boletos/:boleto_id/toggle-abordaje', choferCtrl.toggleAbordajeManual);

module.exports = router;

