const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { requireCustomer } = require('../services/customerAccess');

router.post('/registro', customerController.registrar);
router.post('/sesion', customerController.iniciarSesion);
router.get('/me', requireCustomer, customerController.obtenerPerfil);
router.get('/por-cedula/:cedula', customerController.buscarPorCedula);

module.exports = router;
