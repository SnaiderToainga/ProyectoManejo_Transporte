const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
const bookingController = require('./controllers/bookingController');
// Webhook Stripe requiere cuerpo crudo (raw JSON) antes del parser JSON global.
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), bookingController.procesarWebhookStripe);
app.use(express.json());

// Servir la carpeta de comprobantes de forma estática con cabecera segura y fallback controlado ante 404 (CR-11)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
app.use('/uploads', (req, res) => {
  res.set('X-Receipt-Fallback', 'missing-on-ephemeral-disk');
  res.status(404).json({
    error: 'El comprobante no está disponible en el almacenamiento temporal del servidor.',
    code: 'RECEIPT_FILE_NOT_FOUND'
  });
});

// Rutas
const catalogRoutes = require('./routes/catalogRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const officeRoutes = require('./routes/officeRoutes');
const choferRoutes = require('./routes/choferRoutes');
const planningRoutes = require('./routes/planningRoutes');
const customerRoutes = require('./routes/customerRoutes');

app.use('/api', catalogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clientes', customerRoutes);
app.use('/api', officeRoutes);
app.use('/api/oficina', officeRoutes);
app.use('/api', bookingRoutes);
app.use('/api/chofer', choferRoutes);
app.use('/api/planificacion', planningRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    const isMediaUpload = req.originalUrl && req.originalUrl.includes('/api/admin/imagenes');
    return res.status(413).json({
      error: isMediaUpload
        ? 'Cada imagen puede pesar como máximo 15 MB.'
        : 'El comprobante no puede superar los 5 MB.'
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Puedes subir hasta 10 imágenes a la vez.'
    });
  }

  if (err.code === 'INVALID_RECEIPT_TYPE' || err.code === 'INVALID_IMAGE_TYPE') {
    return res.status(400).json({
      error: err.message
    });
  }

  next(err);
});

const { warmPool } = require('./config/db');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  warmPool(3);
});
