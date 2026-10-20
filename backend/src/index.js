const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Servir la carpeta de comprobantes de forma estática
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
const catalogRoutes = require('./routes/catalogRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const officeRoutes = require('./routes/officeRoutes');

app.use('/api', catalogRoutes);
app.use('/api', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', officeRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});