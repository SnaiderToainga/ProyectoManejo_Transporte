const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyCooperativaOwnership } = require('../middlewares/authMiddleware');
const { requireSession, requireRoles } = require('../services/sessionAccess');

// 1. Autenticación y roles
router.post('/login', adminController.login);

// 2. Cooperativas y branding
router.get('/cooperativas', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getCooperativas);
router.post('/cooperativas', requireSession, requireRoles('SUPERADMIN'), adminController.crearCooperativa);
router.put('/cooperativas/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), verifyCooperativaOwnership, adminController.actualizarCooperativa);
router.delete('/cooperativas/:id', requireSession, requireRoles('SUPERADMIN'), adminController.eliminarCooperativa);

// 3. Usuarios de cooperativa
router.get('/usuarios', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getUsuarios);
router.post('/usuarios', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.crearUsuario);

// 4. Flota de buses y Plantillas Matriciales de Asientos (CR-09 / CR-01)
router.get('/buses', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getBuses);
router.get('/buses/:id/asientos', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getAsientosBus);
router.post('/buses', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.crearBus);
router.put('/buses/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.actualizarBus);
router.delete('/buses/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.eliminarBus);
router.post('/plantillas/preview', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.generarVistaPreviaPlantilla);
router.post('/buses/:id/plantilla', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.asignarPlantillaABus);

// 5. Frecuencias oficiales ANT
router.get('/frecuencias', adminController.getFrecuencias);
router.post('/frecuencias', adminController.crearFrecuencia);
router.put('/frecuencias/:id', adminController.actualizarFrecuencia);
router.delete('/frecuencias/:id', adminController.eliminarFrecuencia);

module.exports = router;
