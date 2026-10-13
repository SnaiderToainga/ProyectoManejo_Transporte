const express = require('express');
const router = express.Router();
const catalogCtrl = require('../controllers/catalogController');

router.get('/cooperativas', catalogCtrl.getCooperativas);
router.get('/frecuencias', catalogCtrl.getFrecuencias);
router.get('/viajes', catalogCtrl.getViajesProgramados);
router.get('/viajes/:programacionId/asientos', catalogCtrl.getAsientosPorViaje);

module.exports = router;