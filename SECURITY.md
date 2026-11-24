# Política de Seguridad del Sistema

La integridad, confidencialidad y control de la información son prioridades en el ciclo de vida del sistema **"En Ruta — Transporte Interprovincial UTA"**.

## Versiones Soportadas

| Versión | Soportada | Estado |
| :--- | :---: | :--- |
| `1.9.x` | :white_check_mark: | **Línea base activa en producción (v1.9.2)** |
| `1.8.x` | :white_check_mark: | Versión previa estable |
| `< 1.8.0` | :x: | Obsoleta tras migración de seguridad y RBAC |

## Buenas Prácticas de Desarrollo y Manejo de Secretos

1. **Gestión Segura de Variables de Entorno:**
   * Las cadenas de conexión a Supabase, contraseñas y llaves de Stripe Sandbox jamás se versionan en Git.
   * Toda credencial reside exclusivamente en `.env` local y en el dashboard de Render, excluidos mediante `.gitignore`.
2. **Autenticación HMAC y RBAC:**
   * Eliminada la confianza en cabeceras HTTP manipulables; el sistema valida roles (`SUPERADMIN`, `ADMIN_COOP`, `OFICINISTA`, `CHOFER`, `CLIENTE`) mediante firmas HMAC criptográficas en cada petición.
3. **Validación de Archivos Adjuntos:**
   * La recepción de comprobantes de pago bancarios restringe tipos MIME válidos (PNG, JPG, PDF) con límites de tamaño para evitar desbordamiento en servidor.

## Reporte de Incidentes de Seguridad

Si detectas un fallo de seguridad o vulnerabilidad:
1. Notifícalo de inmediato al Líder SCM o al Presidente del CAB vía canal privado.
2. Todo parche de seguridad se tramita formalmente como un **Cambio de Emergencia (Hotfix)** bajo autorización del CAB.
