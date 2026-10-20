# Entrega del Módulo Administrativo y Gestión de Flota — Joel

Implementación en la rama `feature/superadmin-cooperativas`, basada en la **Guía de Trabajo: Fase 3 (Daky y Joel)** y los requerimientos de la cátedra de Manejo y Configuración de Software (UTA - FISEI).

---

## 📋 Resumen de Alcance Entregado

| Módulo / Requerimiento | Componentes / Archivos | Descripción de Implementación |
| :--- | :--- | :--- |
| **1. Login y Control por Roles** | `frontend/src/pages/Admin/Login.jsx`<br>`backend/src/controllers/adminController.js` | Vista en `/login` y `#login`. Valida contra la tabla `usuarios`. Si ingresa como `SUPERADMIN` o `ADMIN_COOP` conduce al panel `/admin`; si ingresa como `OFICINISTA` lo redirige a `/oficina` (panel de Daky). Incluye selectores rápidos de prueba para agilizar la evaluación. |
| **2. CRUD Cooperativas y Configuración** | `frontend/src/pages/Admin/GestionCooperativas.jsx`<br>`frontend/src/pages/Admin/ModalNuevaCooperativa.jsx`<br>`frontend/src/pages/Admin/PersonalizacionBranding.jsx` | Alta, listado y edición de cooperativas (nombre, RUC de 13 dígitos, datos bancarios, estado activo/inactivo). Asignación y creación de usuarios con rol `ADMIN_COOP` u `OFICINISTA`. Personalización de color de marca y contacto. |
| **3. Flota de Buses (40 vs 41 plazas)** | `backend/src/controllers/adminController.js`<br>`frontend/src/pages/Admin/GestionCooperativas.jsx` | Registro de unidades asociando cooperativa, disco, placa, estado y capacidad (40 o 41 asientos con indicador de baño posterior). **Al registrar el bus en la base de datos, se dispara la transacción atómica que genera automáticamente sus 40 o 41 asientos en la tabla `asientos` (filas 1 a 10, columnas 1 a 4, categoría VIP filas 1 y NORMAL resto)**. |
| **4. Frecuencias Oficiales (ANT)** | `backend/src/controllers/adminController.js`<br>`frontend/src/pages/Admin/GestionCooperativas.jsx` | Registro y catálogo de rutas oficiales autorizadas con código de Resolución ANT (`resolucion_ant`), origen, destino, horario de salida, tarifa base ($) y tipo de servicio (`DIRECTO` o `PARADAS`). |
| **5. Rutas y API Backend** | `backend/src/routes/adminRoutes.js`<br>`backend/src/index.js` | Endpoints REST bajo `/api/admin` (`/login`, `/cooperativas`, `/usuarios`, `/buses`, `/frecuencias`), integrados al servidor Express principal. |

---

## 🚀 Instrucciones para Ejecutar y Evaluar el Módulo

### 1. Backend
Desde la raíz del proyecto:
```bash
cd backend
npm install
npm run dev # o node src/index.js
```
El servidor correrá en `http://localhost:3000` exponiendo las rutas administrativas en `/api/admin`.

### 2. Frontend
Desde la raíz del proyecto:
```bash
cd frontend
npm install
npm run dev
```
Abrir en el navegador: `http://127.0.0.1:5173/`

### 3. Rutas de Navegación Rápida
- **Portal Público Clientes:** `http://127.0.0.1:5173/#buscar`
- **Inicio de Sesión por Roles:** `http://127.0.0.1:5173/#login` (también accesible desde el botón *"Administración"* en la cabecera).
- **Panel SuperAdmin y Flotas:** `http://127.0.0.1:5173/#admin`
- **Panel Oficinista (Daky):** `http://127.0.0.1:5173/#oficina`

---

## 👥 Credenciales de Prueba Rápida

Para facilitar la revisión por parte del líder (**Snaider**) y la compañera (**Daky**), la pantalla de login cuenta con botones de acceso directo:

* **SuperAdmin General:**
  - Correo: `admin@transporteuta.com`
  - Contraseña: `hash_admin_123` (o `admin123`)
  - Redirección: `/admin`
* **Gerente de Cooperativa (`ADMIN_COOP`):**
  - Correo: `gerente@cita.com`
  - Contraseña: `admin123`
  - Redirección: `/admin`
* **Oficinista Taquilla (`OFICINISTA`):**
  - Correo: `taquilla@transporteuta.com`
  - Contraseña: `hash_oficina_123`
  - Redirección: `/oficina` (Panel asignado a Daky)

---

## 📌 Historial de Commits de la Rama (Gitflow Estricto)

1. `084a887 feat(admin): definir datos simulados de cooperativas y metricas de flota para pruebas locales`
2. `dd24381 feat(superadmin): implementar formulario de creacion de cooperativas y credenciales`
3. `6affb39 feat(cooperativa): agregar panel de personalizacion de logo colores y contacto`
4. `06b8632 chore(git): sincronizar rama con los ultimos cambios de develop`
5. `bb85ff7 feat(admin): implementar controladores y rutas para login, cooperativas, buses y frecuencias`
6. `7337354 feat(auth): implementar vista de login con control de acceso por roles y redireccion`
7. `1c448cf feat(admin): implementar panel de cooperativas buses 40-41 y frecuencias ant`
8. `docs(auditoria): documentar modulo superadmin cooperativas buses 40-41 y login`
