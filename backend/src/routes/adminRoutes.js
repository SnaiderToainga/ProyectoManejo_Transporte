const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 1. Autenticación y roles
router.post('/login', adminController.login);

// 2. Cooperativas y branding
router.get('/cooperativas', adminController.getCooperativas);
router.post('/cooperativas', adminController.crearCooperativa);
router.put('/cooperativas/:id', adminController.actualizarCooperativa);

// 3. Usuarios de cooperativa
router.get('/usuarios', adminController.getUsuarios);
router.post('/usuarios', adminController.crearUsuario);

// 4. Flota de buses (con loop automático de 40/41 asientos)
router.get('/buses', adminController.getBuses);
router.post('/buses', adminController.crearBus);

// 5. Frecuencias oficiales ANT
router.get('/frecuencias', adminController.getFrecuencias);
router.post('/frecuencias', adminController.crearFrecuencia);

module.exports = router;
