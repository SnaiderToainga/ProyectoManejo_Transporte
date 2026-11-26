# CR-14 — Corrección de fallos en producción (Vercel/Render) y cierre de brechas de rúbrica

Expediente **CR-14** (`SCR-EXP-2026-010`, cambio de **Emergencia** ITIL, tipo `fix`), asignado a **Ing. Cristian Sivinta (`@Cristian-1402`)**.
Solicitante / Líder SCM: **Ing. Snaider Toainga (`@SnaiderToainga`)**.
Rama: `hotfix/cr-14-produccion-y-rubrica` creada desde `main` (`v1.9.2`, commit `9c3eb41`).
Versión objetivo: **`v1.9.3`**. Revisores obligatorios: `@SnaiderToainga` y `@joel427`.

---

## Problemas corregidos y requerimientos cubiertos

### 1. Origen único del backend y URLs de imágenes en Vercel

- **Problema:** `api.js` y `ChoferPanel.jsx` caían a `'/api'` cuando faltaba `VITE_API_URL`, lo que rompía el portal público y la cabina del chofer en Vercel. Además, los logos y fotos subidos se guardan como rutas relativas (`/uploads/media/...`), que en Vercel apuntaban al propio frontend y devolvían **404**.
- **Solución:** nuevo módulo [frontend/src/lib/env.js](../frontend/src/lib/env.js) con:
  - `isLocalRuntime()`: `localhost`, `127.0.0.1`, redes `192.168.*`, `10.*`, `172.*` o `import.meta.env.DEV` (seguro en pruebas Node sin `window`).
  - `API_BASE`: `VITE_API_URL` si está definida (incluido `'/api'` explícito para Docker); si no, `'/api'` en local y Render en producción.
  - `BACKEND_ORIGIN`: origen absoluto del backend, o `''` cuando la API es relativa.
  - `resolveMediaUrl(url)`: antepone `BACKEND_ORIGIN` a las rutas `/uploads/...`, conserva URLs `http(s)` y `data:image`, descarta `javascript:`, URLs con credenciales y `//host`, y codifica comillas y paréntesis para no romper `src` ni `url("...")` en CSS.
- **Archivos que usan el helper:** `api.js`, `planningApi.js`, `officeApi.js`, `mediaUpload.js`, `Login.jsx`, `GestionCooperativas.jsx`, `ChoferPanel.jsx` y `ValidacionComprobantes.jsx`.
- **Imágenes resueltas con `resolveMediaUrl`:** `SearchTrips.jsx`, `BusDetails.jsx`, `GestionCooperativas.jsx` (banner y tarjetas), `PersonalizacionBranding.jsx` (formulario y vista previa), `BusForm.jsx` y `ModalNuevaCooperativa.jsx`.

### 2. Enrutamiento SPA en Vercel

- [frontend/vercel.json](../frontend/vercel.json) reescribe todas las rutas a `index.html`, así recargar `/admin`, `/oficina`, `/chofer` o `/validar` ya no devuelve `404: NOT_FOUND`. Vercel sigue sirviendo primero los archivos estáticos existentes.

### 3. CORS explícito y persistencia segura en Render

- [backend/src/config/corsOptions.js](../backend/src/config/corsOptions.js) reemplaza `cors()` abierto:
  - Permite `https://proyecto-web.online`, `https://www.proyecto-web.online`, `FRONTEND_URL` y la lista separada por comas `CORS_ORIGINS`.
  - Permite `localhost`, `127.0.0.1` y redes LAN privadas en cualquier puerto.
  - Permite peticiones sin cabecera `Origin` (webhook de Stripe, `curl`, healthchecks de Render).
  - Métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
  - Cabeceras `Content-Type`, `Authorization` e `Idempotency-Key`, más **`x-user-role` y `x-user-cooperativa-id`**, que el panel administrativo (`GestionCooperativas.jsx`) envía en cada petición: sin ellas el navegador bloquearía el preflight y el panel dejaría de funcionar en producción.
- [backend/src/services/busLayoutStore.js](../backend/src/services/busLayoutStore.js):
  - Crea `backend/data/` si no existe (disco efímero de Render).
  - Usa las plantillas del sistema si `bus_layouts.json` falta, está vacío o corrupto.
  - Escribe de forma atómica (archivo temporal + `rename`) para que un reinicio no deje el JSON truncado.

### 4. Redes sociales y canales de soporte (rúbrica: «logo, colores, redes sociales, soporte»)

- **Migración** [backend/database/09_cr14_branding_soporte.sql](../backend/database/09_cr14_branding_soporte.sql) (aditiva e idempotente): `facebook_url`, `instagram_url`, `whatsapp_soporte` y `correo_soporte` en `cooperativas`. Se ejecuta también en el fixture PGlite de pruebas ([backend/tests/helpers/planningFixture.js](../backend/tests/helpers/planningFixture.js)).
- **Backend:**
  - `validarUrlSocialSegura` y `normalizarWhatsapp` en [validators.js](../backend/src/utils/validators.js): solo URLs `http(s)` sin credenciales ni comillas; se rechazan `javascript:` y `data:`.
  - `crearCooperativa` y `actualizarCooperativa` aceptan los 4 campos opcionales validados y solo actualizan los que llegan en la petición.
  - `getFrecuencias` y `getViajesProgramados` devuelven los canales con `NULLIF(BTRIM(to_jsonb(c)->>...), '')`, compatible con una base que aún no tenga la migración.
- **Frontend:**
  - `PersonalizacionBranding.jsx` agrega los 4 campos con validación en vivo y vista previa.
  - Los canales se muestran en la ficha «Ver más» del bus (`BusDetails.jsx`) y en un directorio «¿Necesitas ayuda con tu viaje?» al final de los resultados de búsqueda (`SearchTrips.jsx`).
  - Los enlaces externos usan `target="_blank" rel="noopener noreferrer"` y se generan con [supportChannels.js](../frontend/src/lib/supportChannels.js) (`https://wa.me/593…` para WhatsApp y `mailto:` para el correo).

### 5. «Comprar otro boleto» al finalizar la compra (rúbrica: «ofrecer la opción de adquirir otro»)

- `App.jsx` pasa `onBuyAnother={goSearch}` a `Checkout`, y este lo entrega a `PaymentPanel`.
- Al terminar el pago, junto a «Consultar mi boleto» aparece el botón **Comprar otro boleto**. `goSearch` limpia `trip`, `seats`, `selectedIds`, `checkoutDraft` y `reserved`, y vuelve a la búsqueda.

### 6. Notificaciones por correo en cada paso relevante

- [emailService.js](../backend/src/services/emailService.js):
  - `despacharCorreo` es el transporte compartido: Resend HTTPS, luego SMTP (Brevo, host propio o Gmail) y, si ninguno funciona, respaldo local. Nunca lanza excepciones al flujo HTTP. `enviarBoletoEmail` lo reutiliza sin cambiar su plantilla.
  - `enviarNotificacionEstadoReserva` usa una plantilla propia y no incluye QR de abordaje:
    - `COMPROBANTE_EN_REVISION`: asunto «🕒 Comprobante recibido: origen a destino (código)».
    - `RECHAZADO`: asunto «⚠️ Reserva rechazada: origen a destino (código)», indica que los asientos quedaron liberados.
- `notifyReservationStatus(pool, code, kind)` en [receiptData.js](../backend/src/services/receiptData.js) solo envía el aviso si el estado real de la reserva coincide.
- **Dónde se dispara:**
  - `subirComprobante` (`bookingController.js`): aviso de revisión, asíncrono, después del `COMMIT`.
  - `validarComprobante` (`officeController.js`): aviso de rechazo cuando `aprobar === false`. La aprobación sigue usando `notifyReservation` (boleto con QR).
- **Nunca se envía el boleto** («Pago Validado») al subir un comprobante ni al rechazarlo.

### 7. Metadatos del repositorio

- [CITATION.cff](../CITATION.cff) pasa a `version: 1.9.3` y `date-released: 2026-11-25`, con un resumen de la gobernanza SCM bajo ITIL 4 y los nombres completos de los autores.

---

## Pruebas reproducibles

```powershell
cd backend
npm test

cd ../frontend
npm test
npm run build
```

- **`backend/tests/cr14.test.js` (9 pruebas):**
  - Migración 09 repetible.
  - Guardado de redes y soporte, y vaciado de un canal.
  - Rechazo de `javascript:`, `data:`, URLs con credenciales, `ftp:`, comillas, WhatsApp y correo inválidos.
  - Aislamiento entre cooperativas.
  - Canales en el catálogo público.
  - Rechazo de comprobante con HTTP 200 sin SMTP/Resend.
  - Avisos con plantilla propia y respaldo local.
  - Escape de HTML en la plantilla.
  - Política CORS.
- **`frontend/tests/unit/cr14.test.js` (4 pruebas):**
  - `API_BASE` en local, Docker (`/api` explícito), Vercel (Render) y con URL explícita.
  - `BACKEND_ORIGIN`.
  - `resolveMediaUrl` con rutas, URLs absolutas, `data:` y casos peligrosos.
  - Enlaces seguros de redes y soporte.

---

## Despliegue y plan de reversión (Rollback)

1. Respaldar Supabase y ejecutar **únicamente** `backend/database/09_cr14_branding_soporte.sql` (aditiva e idempotente; nunca `01_schema.sql`). Debe aplicarse **antes** de desplegar el backend: guardar los canales de soporte escribe en las columnas nuevas.
2. En Render, si el frontend se sirve desde otro dominio, definir `FRONTEND_URL` o `CORS_ORIGINS` (lista separada por comas).
3. En Vercel, el `vercel.json` se toma de la carpeta `frontend/`. `VITE_API_URL` es opcional: sin ella se usa Render.
4. Fusionar el PR de `hotfix/cr-14-produccion-y-rubrica` hacia `main` con las **2/2 aprobaciones** (`@SnaiderToainga` y `@joel427`), conservando la rama remota.
5. Publicar el tag anotado **`v1.9.3`** sobre el commit de merge en `main`.
6. **Rollback:** `git revert -m 1 <SHA_MERGE_CR14>`. Las columnas de la migración 09 se conservan (son compatibles con `v1.9.2`, que no las lee).
