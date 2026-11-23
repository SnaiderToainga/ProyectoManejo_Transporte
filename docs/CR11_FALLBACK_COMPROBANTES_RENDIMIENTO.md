# CR-11 — Fallback local de comprobantes (404 Render) y optimización de consultas

Expediente **CR-11** (Cambio de Emergencia ITIL, tipo `fix`), asignado a **Ing. Cesar (`@Steven9tp`)**.  
Rama: `hotfix/cr-11-fallback-comprobantes` creada desde `main` (`v1.9.0`, commit `54c635c`).  
Versión objetivo: **`v1.9.1`**. Revisores obligatorios: `@SnaiderToainga` y `@joel427`.

---

## Requerimientos cubiertos (`VENT-22`, `VENT-24`, `COOP-16`)

1. **Fallback local de comprobantes ante 404 en disco efímero de Render (`VENT-22`):**
   - En [backend/src/index.js](../backend/src/index.js): respuesta controlada `404` JSON (`RECEIPT_FILE_NOT_FOUND`) con cabecera `X-Receipt-Fallback` cuando un archivo en `/uploads/*` desaparece tras reinicio en Render.
   - En [backend/src/controllers/officeController.js](../backend/src/controllers/officeController.js): `GET /api/reservas-pendientes` añade `comprobante_disponible` verificando existencia segura del archivo en disco.
   - En [frontend/src/pages/Office/ValidacionComprobantes.jsx](../frontend/src/pages/Office/ValidacionComprobantes.jsx):
     - Resolución automática de `/uploads/*` en entorno local (con proxy en [frontend/vite.config.js](../frontend/vite.config.js)) vs producción Render.
     - Si el archivo no está disponible (`comprobante_disponible === false` o error `404` en `<img>`), muestra la tarjeta de **Respaldo local** con todos los datos de verificación (código de reserva, pasajero, cédula, ruta, hora y monto) y botones directos **`Aprobar reserva`**, **`Rechazar reserva`** y **`Reintentar carga`** para que el oficinista **nunca quede bloqueado**.
2. **Optimización de consultas lentas en login y carga (`VENT-24`, `COOP-16`):**
   - Eliminadas 2 subconsultas correlacionadas redundantes en `getReservasPendientes` (`officeController.js`) aprovechando el `LEFT JOIN detalle_boletos` ya existente.
   - Configuración del pool PostgreSQL en [backend/src/config/db.js](../backend/src/config/db.js) (`max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 10000`, `keepAlive: true`).
   - Migración aditiva e idempotente [backend/database/08_cr11_indices_rendimiento.sql](../backend/database/08_cr11_indices_rendimiento.sql) con 5 índices (`idx_usuarios_correo_lower`, `idx_reservas_estado_creado`, `idx_reservas_usuario_creado`, `idx_frecuencias_coop_activo`, `idx_buses_coop_estado`).

---

## Pruebas reproducibles

```powershell
cd backend
node --test tests/*.test.js

cd ../frontend
node --test tests/unit/*.test.js
npx playwright test tests/e2e/cr11.spec.js tests/e2e/cr01.spec.js tests/e2e/formatting.spec.js tests/e2e/tripSearch.spec.js --reporter=line
npm run build
```

---

## Despliegue y plan de reversión (Rollback)

1. Respaldar Supabase y ejecutar **únicamente** `backend/database/08_cr11_indices_rendimiento.sql` (aditiva e idempotente; nunca `01_schema.sql`).
2. Fusionar el PR de `hotfix/cr-11-fallback-comprobantes` hacia `main` con las **2/2 aprobaciones** (`@SnaiderToainga` y `@joel427`), conservando la rama remota.
3. Publicar tag anotado **`v1.9.1`** sobre el commit de merge en `main`.
4. **Rollback:** `git revert -m 1 <SHA_MERGE_CR11>` conservando los índices aditivos (compatibles con `v1.9.0`).
