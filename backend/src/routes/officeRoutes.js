const express = require('express');
const router = express.Router();
const officeController = require('../controllers/officeController');

// ==========================================
// RUTAS PARA EL PANEL DE OFICINISTA
// ==========================================

// 1. Bandeja de Validación de Comprobantes
router.get('/reservas-pendientes', officeController.getReservasPendientes);
router.put('/reservas/:reserva_id/aprobar', officeController.aprobarComprobante);
router.put('/reservas/:reserva_id/rechazar', officeController.rechazarComprobante);

// 2. Venta Presencial en Ventanilla
router.post('/venta-ventanilla', officeController.ventaVentanilla);

// 3. Hoja de Ruta Diaria
router.get('/hoja-ruta', officeController.getHojaRutaHoy);
router.put('/hoja-ruta/:programacion_id/estado', officeController.actualizarEstadoViaje);

module.exports = router;