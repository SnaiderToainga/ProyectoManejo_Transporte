const express = require('express');
const router = express.Router();
const bookingCtrl = require('../controllers/bookingController');
const upload = require('../config/multer');

router.post('/reservas', bookingCtrl.crearReserva);
router.get('/reservas/:codigo', bookingCtrl.obtenerReservaPorCodigo);
router.post('/reservas/:codigo/comprobante', upload.single('comprobante'), bookingCtrl.subirComprobante);
router.get('/reservas/:codigo/boletos/:boletoId/pdf', bookingCtrl.descargarBoletoPDF);
router.post('/boletos/validar-qr', bookingCtrl.validarQRBoleto);


module.exports = router;