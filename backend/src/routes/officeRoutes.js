// backend/src/routes/officeRoutes.js
const express = require('express');
const router = express.Router();
const officeController = require('../controllers/officeController');
const { officeAccess } = require('../services/officeAccess');

// 1. Bandeja de comprobantes pendientes
router.get('/oficina/reservas-pendientes', ...officeAccess, officeController.getReservasPendientes);
router.get('/oficina/pendientes', ...officeAccess, officeController.getReservasPendientes);
router.get('/oficina/comprobantes', ...officeAccess, officeController.getReservasPendientes);
router.get('/reservas-pendientes', ...officeAccess, officeController.getReservasPendientes);
router.get('/reservas/pendientes', ...officeAccess, officeController.getReservasPendientes);

// 2. Aprobar o rechazar comprobante (Soporta PUT a /aprobar y /rechazar que llama el frontend)
router.put('/reservas/:id/aprobar', ...officeAccess, (req, res, next) => { req.body = req.body || {}; req.body.accion = 'APROBAR'; next(); }, officeController.validarComprobante);
router.put('/reservas/:id/rechazar', ...officeAccess, (req, res, next) => { req.body = req.body || {}; req.body.accion = 'RECHAZAR'; next(); }, officeController.validarComprobante);
router.put('/oficina/reservas/:id/aprobar', ...officeAccess, (req, res, next) => { req.body = req.body || {}; req.body.accion = 'APROBAR'; next(); }, officeController.validarComprobante);
router.put('/oficina/reservas/:id/rechazar', ...officeAccess, (req, res, next) => { req.body = req.body || {}; req.body.accion = 'RECHAZAR'; next(); }, officeController.validarComprobante);

router.put('/oficina/reservas/:id/validar', ...officeAccess, officeController.validarComprobante);
router.post('/oficina/reservas/:id/validar', ...officeAccess, officeController.validarComprobante);
router.put('/oficina/validar-comprobante/:id', ...officeAccess, officeController.validarComprobante);
router.put('/reservas/:id/validar', ...officeAccess, officeController.validarComprobante);

// 3. Venta directa en ventanilla y consulta de pasajero frecuente (VENT-19)
router.get('/oficina/pasajero/:cedula', ...officeAccess, officeController.buscarPasajeroPorCedula);
router.get('/pasajero/:cedula', ...officeAccess, officeController.buscarPasajeroPorCedula);
router.post('/oficina/venta-ventanilla', ...officeAccess, officeController.crearVentaVentanilla);
router.post('/oficina/ventas', ...officeAccess, officeController.crearVentaVentanilla);
router.post('/venta-ventanilla', ...officeAccess, officeController.crearVentaVentanilla);

// 4. Hoja de ruta diaria y cambio de estado
router.get('/oficina/hoja-ruta', ...officeAccess, officeController.getHojaRutaHoy);
router.get('/hoja-ruta', ...officeAccess, officeController.getHojaRutaHoy);
router.put('/oficina/hoja-ruta/:id/estado', ...officeAccess, officeController.actualizarEstadoViaje);
router.put('/hoja-ruta/:id/estado', ...officeAccess, officeController.actualizarEstadoViaje);

module.exports = router;
