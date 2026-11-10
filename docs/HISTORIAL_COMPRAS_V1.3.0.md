# Historial de compras y cooperativas

## Preparar el entorno

1. En una base existente, aplica `backend/database/03_usuarios_cooperativa.sql` antes de iniciar esta versión del backend. `01_schema.sql` es para instalaciones nuevas y elimina tablas existentes.
2. Configura en el backend `FRONTEND_URL` con la URL pública de la aplicación, `RESEND_API_KEY`, `RESEND_FROM` con un remitente autorizado y `HISTORY_TOKEN_SECRET` con un secreto aleatorio de al menos 32 bytes. Puedes generarlo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Conserva el mismo valor en las instancias del backend y fuera del repositorio.
3. La migración vincula las cuentas existentes de CITA y Pelileo por correo exacto y RUC. Si una cuenta no existe, créala desde Administración seleccionando el rol de gerente, la cooperativa y una contraseña propia. Cierra sesión y vuelve a ingresar para que el panel reciba la asignación actualizada.

## Probar

- Abre **Mis compras**, solicita un enlace y ábrelo desde el buzón. Solo se muestran reservas asociadas a ese correo. El enlace vence en 15 minutos y las reservas sin usuario asociado no aparecen.
- Prueba la lista vacía, el filtro por fecha y el botón para consultar un boleto. Una consulta directa a `GET /api/mis-compras?email=...` sin enlace válido debe devolver 401.
- Para un boleto pagado, si la generación del QR en el navegador falla o demora, la imagen se obtiene desde la API de Transporte UTA. El código de reserva no se envía a un servicio externo para generar el QR web.
- Comprueba que las cuentas de gerencia de CITA y Pelileo vean en el panel la cooperativa que devuelve su inicio de sesión. Este cambio registra y muestra la asignación; la autorización de todas las operaciones administrativas en el servidor es un trabajo separado.
