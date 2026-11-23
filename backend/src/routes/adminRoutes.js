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

// 4. Flota de buses y Plantillas Matriciales de Asientos (CR-09 / CR-01 / BUS-11..BUS-20)
router.get('/buses', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getBuses);
router.get('/buses/:id/asientos', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getAsientosBus);
router.post('/buses', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.crearBus);
router.put('/buses/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.actualizarBus);
router.delete('/buses/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.eliminarBus);

router.get('/plantillas', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getPlantillas);
router.post('/plantillas', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.crearPlantilla);
router.put('/plantillas/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.actualizarPlantilla);
router.delete('/plantillas/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.eliminarPlantilla);
router.post('/plantillas/preview', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.generarVistaPreviaPlantilla);
router.post('/buses/:id/plantilla', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.asignarPlantillaABus);

// 5. Frecuencias oficiales ANT (protegidas por sesión y rol)
router.get('/frecuencias', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.getFrecuencias);
router.post('/frecuencias', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.crearFrecuencia);
router.put('/frecuencias/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.actualizarFrecuencia);
router.delete('/frecuencias/:id', requireSession, requireRoles('ADMIN_COOP', 'SUPERADMIN'), adminController.eliminarFrecuencia);

module.exports = router;
