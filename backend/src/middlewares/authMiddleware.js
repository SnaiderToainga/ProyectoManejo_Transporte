exports.verifyCooperativaOwnership = (req, res, next) => {
  const userRole = req.headers['x-user-role'] || (req.user && req.user.rol);
  const userCoopId = req.headers['x-user-cooperativa-id'] || (req.user && req.user.cooperativa_id);
  const targetCoopId = req.params.id;

  // Si es SuperAdmin de la UTA, tiene acceso global
  if (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') {
    return next();
  }

  // Si es Administrador de Cooperativa, solo puede modificar su propia cooperativa
  if (userRole === 'ADMIN_COOP') {
    if (String(userCoopId) !== String(targetCoopId)) {
      return res.status(403).json({
        error: 'Acceso denegado: No tiene autorización para mutar datos de otra cooperativa (Cross-Tenant Restriction).'
      });
    }
    return next();
  }

  return res.status(403).json({ error: 'Permisos insuficientes para realizar esta operación.' });
};