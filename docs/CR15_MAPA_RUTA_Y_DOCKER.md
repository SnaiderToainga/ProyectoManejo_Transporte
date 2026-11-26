# CR-15: Mapa Interactivo por Ruta, Barra de Navegación Limpia y Empaquetado Docker (`v1.10.0`)

- **Ticket ITIL / CAB:** `CR-15` (Normal — Mejora Funcional e Infraestructura)
- **Rama de trabajo:** `feature/cr-15-mapa-ruta-y-docker` (base `main`)
- **Responsable técnico:** Ing. Snaider Toainga (`@SnaiderToainga`)
- **Revisores designados:** `@joel427`, `@Cristian-1402`
- **Versión objetivo:** `v1.10.0`

---

## 1. Mapa de Ruta Independiente y Bajo Demanda

1. **`frontend/src/components/RouteMap.jsx`**
   - Acepta contexto completo de la frecuencia o tramo seleccionado: `origen`, `destino`, `tipoServicio`, `paradasIntermedias`, `cooperativa`, `numeroDisco`, `horaSalida` y prop `compact`.
   - Recalcula dimensiones con `requestAnimationFrame(() => { map.invalidateSize(); map.fitBounds(...); })` para evitar renderizado en gris al abrir acordeones o modales dinámicos.
   - Muestra marcadores numerados (`Origen`, paradas intermedias y `Destino`) con popup y leyenda diferenciada.

2. **`frontend/src/pages/Client/SearchTrips.jsx`**
   - Se elimina el mapa único superior acoplado únicamente a `trips[0]`.
   - Cada tarjeta `.trip-card` incorpora el botón **`Ver mapa de ruta`** / **`Ocultar mapa`** que carga `<RouteMap compact />` de forma diferida (`React.lazy` + `Suspense`) usando el tramo activo (`tramoOrigen`, `tramoDestino`, `tramoParadas = itinerary.slice(startIdx + 1, endIdx)`), cooperativa y disco de esa tarjeta.

3. **`frontend/src/pages/Driver/ChoferPanel.jsx`**
   - El panel de turno seleccionado (`viajeSeleccionado`) agrega un botón **`Ver mapa de ruta`** bajo demanda para que el conductor visualice origen, paradas intermedias y destino de su turno activo sin recargar el lector QR.

4. **`frontend/src/pages/Office/HojaRuta.jsx`**
   - Cada fila de frecuencia en la matriz pizarrón incluye el botón **`Mapa`**, que abre un modal ligero con `<RouteMap compact />` del recorrido (`origen → destino`, paradas intermedias, hora de salida y resolución ANT).

---

## 2. Barra de Navegación Limpia, Filtros Interactivos y Rediseño de Tarjetas

1. **`frontend/src/App.jsx` y `frontend/src/styles.css`**
   - En la barra pública (`<nav id="main-navigation">`), se retira el botón `Administración` y se organiza **`Buscar viaje`** a la izquierda con **`Mi cuenta`** (o **`Hola, <Nombre>`** + **`Salir`**) alineado a la derecha como botón tipo píldora junto a un enlace compacto y discreto **`Acceso operativo`**.
   - Se mantienen activas todas las rutas directas de personal (`/#admin`, `/#login`, `/admin`, `/oficina`, `/chofer`).
   - Al hacer clic en **`Elegir asientos`** desde `SearchTrips`, el visitante ingresa directamente a **`SeatSelection`** para explorar pisos/asientos antes de pasar a **`Checkout`**, donde el portal solicita iniciar sesión o crear cuenta de cliente en caso de no estar autenticado.

2. **`frontend/src/pages/Client/SearchTrips.jsx` y `frontend/tests/e2e/cr15.spec.js`**
   - Buscador interactivo con botón **⇄ Intercambiar origen y destino**, filtrado inmediato en selectores rápidos (`Cooperativa`, `Tipo de asiento`, `Tipo de viaje`), barra de **chips removibles**, botón **`Limpiar todo`** y contador de opciones encontradas.
   - Rediseño visual de tarjetas `.trip-card` con trazado origen-destino y conteo de paradas, acento lateral para rutas destacadas, píldora de disponibilidad y especificaciones técnicas ordenadas.

---

## 3. Empaquetado Docker Compose (Sin Afectar Vercel / Render)

- **`backend/package.json`:** agrega script `"start": "node src/index.js"`.
- **`backend/src/index.js`:** expone endpoint ligero `GET /api/health` (`{ ok: true, service, uptime }`) para sondeo de salud del contenedor.
- **`backend/Dockerfile` y `backend/.dockerignore`:** imagen `node:22-alpine` con dependencias de producción (`npm ci --omit=dev`), carpetas `/app/uploads` y `/app/data`, puerto `3000`.
- **`frontend/Dockerfile`, `frontend/nginx.conf` y `frontend/.dockerignore`:** compilación multi-stage pasando `ARG VITE_API_URL=/api` para enrutar `/api/` y `/uploads/` mediante Nginx hacia `http://backend:3000` (manteniendo `frontend/src/lib/env.js` compatible con Vercel + Render), más `try_files $uri $uri/ /index.html` para rutas SPA.
- **`docker-compose.yml`:** orquesta `backend` (con `healthcheck`, `env_file` opcional desde `./backend/.env`, puerto `BACKEND_PORT` `3001` por defecto y volúmenes persistentes `backend_uploads:/app/uploads` y `backend_data:/app/data`) y `frontend` (`depends_on: service_healthy`, puerto configurable `FRONTEND_PORT`, por defecto `8088`).

### Comandos de Operación Docker
```bash
cp backend/.env.example backend/.env
# Completar DATABASE_URL, SESSION_SECRET, CUSTOMER_SESSION_SECRET y FRONTEND_URL=http://localhost:8088
docker compose up --build -d
docker compose ps
docker compose down
```

### Plan de Backout / Reversión
Si surgiera algún inconveniente tras el merge hacia `main`:
```bash
git revert -m 1 <SHA_MERGE_CR15>
git push origin main
```
