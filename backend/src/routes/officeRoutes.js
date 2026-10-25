// backend/src/routes/officeRoutes.js
const express = require('express');
const router = express.Router();
const officeController = require('../controllers/officeController');

// 1. Bandeja de comprobantes pendientes
router.get('/oficina/reservas-pendientes', officeController.getReservasPendientes);
router.get('/oficina/pendientes', officeController.getReservasPendientes);
router.get('/oficina/comprobantes', officeController.getReservasPendientes);
router.get('/reservas-pendientes', officeController.getReservasPendientes);
router.get('/reservas/pendientes', officeController.getReservasPendientes);

// 2. Aprobar o rechazar comprobante (Soporta PUT a /aprobar y /rechazar que llama el frontend)
router.put('/reservas/:id/aprobar', (req, res, next) => { req.body = req.body || {}; req.body.accion = 'APROBAR'; next(); }, officeController.validarComprobante);
router.put('/reservas/:id/rechazar', (req, res, next) => { req.body = req.body || {}; req.body.accion = 'RECHAZAR'; next(); }, officeController.validarComprobante);
router.put('/oficina/reservas/:id/aprobar', (req, res, next) => { req.body = req.body || {}; req.body.accion = 'APROBAR'; next(); }, officeController.validarComprobante);
router.put('/oficina/reservas/:id/rechazar', (req, res, next) => { req.body = req.body || {}; req.body.accion = 'RECHAZAR'; next(); }, officeController.validarComprobante);

router.put('/oficina/reservas/:id/validar', officeController.validarComprobante);
router.post('/oficina/reservas/:id/validar', officeController.validarComprobante);
router.put('/oficina/validar-comprobante/:id', officeController.validarComprobante);
router.put('/reservas/:id/validar', officeController.validarComprobante);

// 3. Venta directa en ventanilla
router.post('/oficina/venta-ventanilla', officeController.crearVentaVentanilla);
router.post('/oficina/ventas', officeController.crearVentaVentanilla);
router.post('/venta-ventanilla', officeController.crearVentaVentanilla);

// 4. Hoja de ruta diaria y cambio de estado
router.get('/oficina/hoja-ruta', officeController.getHojaRutaHoy);
router.get('/hoja-ruta', officeController.getHojaRutaHoy);
router.put('/oficina/hoja-ruta/:id/estado', officeController.actualizarEstadoViaje);
router.put('/hoja-ruta/:id/estado', officeController.actualizarEstadoViaje);

module.exports = router;
