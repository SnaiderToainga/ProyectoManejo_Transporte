# CR-13 — Estabilización General del Sistema, Depuración de Defectos y Control de Calidad

Expediente **CR-13** (Cambio de Emergencia / Hotfix ITIL, tipo `fix`), asignado a **Ing. Joel (`@joel427`)**.  
Rama: `hotfix/cr-13-estabilizacion-general-sistema` sincronizada con `main` (`v1.9.1`).  
Versión objetivo: **`v1.9.2`**.  
Revisores obligatorios: **`@SnaiderToainga`** (Líder SCM) y **`@Cristian-1402`** (Desarrollador Senior).

---

## 1. Alcance Técnico y Defectos Corregidos

1. **Saneamiento de Login Administrativo y Rendimiento (`frontend/src/pages/Admin/Login.jsx`):**
   - Eliminadas credenciales quemadas y el bloque de cuentas de prueba de la vista administrativa.
   - Eliminado el retardo artificial de `700 ms` tras la autenticación, reduciendo el tiempo de inicio de sesión y redirección de `2,214 ms` a `299 ms` (`-86 %`).

2. **Reorganización del Portal del Cliente y Flujo de Cuenta (`frontend/src/App.jsx`, `frontend/src/pages/Client/CustomerAccount.jsx`, `frontend/src/pages/Client/Checkout.jsx`, `frontend/src/pages/Client/TicketLookup.jsx`):**
   - Navegación limpia para visitantes: `[ Buscar viaje ] [ Mi cuenta ] [ Administración ]`, moviendo la consulta de *Mi boleto* dentro de la cuenta del pasajero autenticado (`Mis compras` y `Mi boleto`).
   - Requisito de sesión de cliente antes de iniciar la selección de asientos y compra, con reanudación automática al viaje elegido tras autenticarse o registrarse.
   - Eliminación de tarjetas informativas redundantes y limpieza del modal muerto de Checkout.

3. **Manejo Amigable y Mejoras en Buscador (`frontend/src/pages/Client/SearchTrips.jsx`, `frontend/src/components/RouteMap.jsx`):**
   - Aviso informativo amigable cuando no existen salidas en la fecha consultada, visualización fiel del logo de cooperativa con `object-fit: contain`, badge de doble piso (`2 Pisos`), ficha técnica ampliada y mapa interactivo con selección de tramos proporcionales.

4. **Blindaje de Rutas y Validaciones en Backend/Frontend (`backend/src/routes/adminRoutes.js`, `backend/src/controllers/adminController.js`, `frontend/src/lib/validation.js`, `frontend/src/lib/cooperativeForm.js`, `frontend/src/pages/Admin/ModalNuevaCooperativa.jsx`):**
   - Protección de endpoints administrativos de frecuencias, buses, plantillas y subida de imágenes con middlewares `requireSession` y `requireRoles('ADMIN_COOP', 'SUPERADMIN')`.
   - Sincronización total de la validación de RUC ecuatoriano (13 dígitos, provincia `01–24`, tipo `0–5` Módulo 10 / `6` / `9` y sufijo `001`) y cédula Módulo 10 desde el Paso 1 del asistente de cooperativas, con saneamiento automático de dígitos y diagnóstico en vivo.
   - Corrección del refresco de logotipos en tarjetas y encabezados (`key` + `onLoad`) y conservación de metadatos del gerente al actualizar branding (`GestionCooperativas.jsx`, `PersonalizacionBranding.jsx`).

5. **Subida de Imágenes desde Cualquier Dispositivo (`backend/src/config/imageUpload.js`, `frontend/src/lib/mediaUpload.js`, `frontend/src/components/ImageUploadControl.jsx`):**
   - Nuevo endpoint autenticado `POST /api/admin/imagenes` con soporte para cualquier formato de imagen (`JPG`, `PNG`, `WEBP`, `GIF`, `AVIF`, `SVG`, `HEIC`, etc., hasta `15 MB`) junto al ingreso por URL en `BusForm.jsx`, `ModalNuevaCooperativa.jsx` y `PersonalizacionBranding.jsx`.

6. **Diseñador Visual Interactivo de Estructuras de Buses (`frontend/src/lib/busLayoutEngine.js`, `frontend/src/components/BusTemplateDesigner.jsx`, `frontend/src/components/BusSeatGrid.jsx`, `backend/src/services/busLayoutStore.js`, `backend/src/services/seatTemplateService.js`):**
   - Motor puro determinista con soporte de 1 o 2 pisos, asientos VIP grandes, baño WC, puerta/escalera, arrastrar y soltar, acciones rápidas por fila, deshacer y compensación automática al final (`BUS-17`).
   - Corrección definitiva del desplazamiento infinito al eliminar asientos solitarios y saneamiento `sanitizeDesign()` para impedir baños o elementos fuera de rango al cambiar entre 1 y 2 pisos.

7. **Hojas de Ruta Interactivas y Optimización SQL (`backend/src/services/routePlanning.js`, `backend/src/routes/planningRoutes.js`, `backend/src/config/db.js`, `frontend/src/pages/Office/HojaRuta.jsx`, `frontend/src/pages/Office/PlanningSetup.jsx`):**
   - Endpoints `POST/DELETE /api/planificacion/grupos/:id/miembros` para añadir o retirar buses y frecuencias de grupos existentes en 1 clic.
   - Refresco en sitio sin desmontar ni parpadear la vista al crear grupos, vínculos, sucursales u oficinistas.
   - Consolidación de consultas SQL en catálogo (`9 → 1`) y matriz (`10 → 1` con CTEs), eliminación de transacciones en lecturas `GET` y precalentamiento del pool PostgreSQL (`warmPool(3)`), reduciendo tiempos de respuesta entre `-66 %` y `-86 %`.

8. **Cabina del Chofer, Taquilla y Depuración General (`frontend/src/pages/Driver/ChoferPanel.jsx`, `backend/src/controllers/choferController.js`, `frontend/src/pages/Office/VentaVentanilla.jsx`, `frontend/src/pages/Office/ValidacionComprobantes.jsx`):**
   - Corrección de fecha local Ecuador UTC-5, autorización Bearer y escáner QR en vivo en cabina del chofer.
   - Eliminación de archivo huérfano `frontend/src/pages/Admin/mockDataAdmin.js`, imports sin uso y código muerto.

---

## 2. Archivos Modificados y Añadidos en este Hotfix

### Backend
- `backend/data/bus_layouts.json` *(nuevo)*
- `backend/src/config/db.js`
- `backend/src/config/imageUpload.js` *(nuevo)*
- `backend/src/controllers/adminController.js`
- `backend/src/controllers/bookingController.js`
- `backend/src/controllers/catalogController.js`
- `backend/src/controllers/choferController.js`
- `backend/src/controllers/officeController.js`
- `backend/src/index.js`
- `backend/src/routes/adminRoutes.js`
- `backend/src/routes/choferRoutes.js`
- `backend/src/routes/officeRoutes.js`
- `backend/src/routes/planningRoutes.js`
- `backend/src/services/busLayoutStore.js` *(nuevo)*
- `backend/src/services/routePlanning.js`
- `backend/src/services/seatInventory.js`
- `backend/src/services/seatTemplateService.js`
- `backend/src/services/sessionAccess.js`

### Frontend
- `frontend/src/App.jsx`
- `frontend/src/components/BusSeatGrid.jsx`
- `frontend/src/components/BusTemplateDesigner.jsx` *(nuevo)*
- `frontend/src/components/ImageUploadControl.jsx` *(nuevo)*
- `frontend/src/components/Modal.jsx`
- `frontend/src/components/RouteMap.jsx`
- `frontend/src/lib/api.js`
- `frontend/src/lib/busLayoutEngine.js` *(nuevo)*
- `frontend/src/lib/cooperativeForm.js`
- `frontend/src/lib/format.js`
- `frontend/src/lib/mediaUpload.js` *(nuevo)*
- `frontend/src/lib/reservation.js`
- `frontend/src/lib/seats.js`
- `frontend/src/lib/validation.js`
- `frontend/src/pages/Admin/BusForm.jsx`
- `frontend/src/pages/Admin/BusStructures.jsx`
- `frontend/src/pages/Admin/GestionCooperativas.jsx`
- `frontend/src/pages/Admin/Login.jsx`
- `frontend/src/pages/Admin/ModalNuevaCooperativa.jsx`
- `frontend/src/pages/Admin/PersonalizacionBranding.jsx`
- `frontend/src/pages/Admin/mockDataAdmin.js` *(eliminado)*
- `frontend/src/pages/Client/Checkout.jsx`
- `frontend/src/pages/Client/CustomerAccount.jsx`
- `frontend/src/pages/Client/SearchTrips.jsx`
- `frontend/src/pages/Client/SeatSelection.jsx`
- `frontend/src/pages/Client/TicketLookup.jsx`
- `frontend/src/pages/Driver/ChoferPanel.jsx`
- `frontend/src/pages/Office/HojaRuta.jsx`
- `frontend/src/pages/Office/PlanningSetup.jsx`
- `frontend/src/pages/Office/ValidacionComprobantes.jsx`
- `frontend/src/pages/Office/VentaVentanilla.jsx`
- `frontend/src/pages/Office/planning.css`
- `frontend/src/styles.css`
- `frontend/tests/unit/busDesigner.test.js` *(nuevo)*
- `frontend/tests/unit/cr01.test.js`
- `frontend/vite.config.js`

### Documentación y Gobernanza
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `README.md`
- `docs/CR13_ESTABILIZACION_GENERAL_SISTEMA.md` *(nuevo)*

---

## 3. Pruebas y Validación Local

```powershell
# Pruebas automatizadas en Backend (55/55 PASS)
cd backend
npm test

# Pruebas unitarias y build de producción en Frontend (39/39 PASS, 0 errores)
cd ../frontend
npm test
npm run build
```

---

## 4. Plan de Reversión (Rollback)
En caso de fallo en producción: `git revert -m 1 <SHA_MERGE_CR13>` restaurando la línea base estable a `v1.9.1`.
