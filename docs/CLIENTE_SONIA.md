# Entrega del frontend cliente — Sonia / Sonnia

Implementación local en `feature/portal-cliente-asientos`, basada en RepartoGrupo.pdf (páginas 4, 6–8) y GUIA.pdf. No se creó Pull Request, no se hizo push y no se integraron cambios en develop ni main.

## Qué incluye

| Entrega del plan | Implementación |
| --- | --- |
| Buscador con filtros | Origen, destino, fecha, cooperativa, intervalo horario y tipo de asiento disponible. Estados de carga, error y resultados vacíos. |
| Mapa adaptativo | `frontend/src/components/BusSeatGrid.jsx`: 40 plazas con baño posterior derecho o 41 con cinco plazas posteriores; selección múltiple, Normal/VIP, ocupados y actualización periódica. |
| Temporizador | `ReservationTimer.jsx`: usa `expira_en` del servidor, actualiza al volver a la pestaña y no reinicia los cinco minutos al consultar o recargar. |
| Checkout | `frontend/src/pages/Client/Checkout.jsx`: nombre y cédula por pasajero, creación de reserva, respuesta a conflictos 409, datos bancarios de la API y comprobantes PNG/JPG/PDF de hasta 5 MB. |
| Consulta y boleto | `TicketLookup.jsx` y `TicketCard.jsx`: búsqueda por código, recuperación de la última reserva de la sesión, estados de reserva, QR y descarga de PDF exclusivamente para `PAGADO`. |
| Base compartida | React, Vite, Tailwind CSS, configuración pública de ejemplo y lockfile. Sin cambios en los módulos de Oficinista, SuperAdmin o backend. |

## Ejecutar el frontend

Requiere Node.js 22.12 o superior. Se verificó con Node.js 24.14.1.

Desde la raíz del repositorio, en PowerShell:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abrir la dirección que muestre Vite; normalmente `http://127.0.0.1:5173/`. Dejar la terminal abierta. Detener con Ctrl+C.

El frontend utiliza `/api`, que Vite redirige al backend en `http://127.0.0.1:3000`. No necesita un archivo `.env` para esta configuración predeterminada. Si se cambia de servidor, usar `frontend/.env.example` como referencia. Nunca colocar DATABASE_URL ni credenciales de Supabase en variables VITE_*.

## Demostración sin backend

Abrir `http://127.0.0.1:5173/?demo=1`.

1. Buscar y elegir un viaje de 40 o 41 asientos.
2. Seleccionar asientos e ingresar datos ficticios de pasajeros.
3. Crear la reserva de prueba y observar el temporizador.
4. Subir un archivo de prueba: se muestra el estado de revisión.
5. En **Mi boleto**, utilizar **DEMO-PAGADO** para ver el boleto y QR de ejemplo.

Este modo está identificado visualmente, no realiza solicitudes al backend ni pagos reales, y sus reservas se reinician al recargar. No genera un PDF ficticio como si fuera un boleto real. La descarga real está conectada al endpoint de Cesar y se comprobó con una respuesta PDF simulada en las pruebas de navegador.

## Conectar el backend del equipo

En otra terminal, desde la raíz del repositorio:

```powershell
cd backend
npm.cmd install
node src/index.js
```

Antes de iniciarlo, debe existir `backend/.env` con PORT=3000 y la DATABASE_URL compartida por el líder. Duplicar `.env.example` únicamente si todavía no existe `.env`; completar la configuración local sin subirla a Git. No se creó ni se modificó este archivo durante la entrega.

El `package.json` actual del backend no tiene script `dev`; por eso se utiliza `node src/index.js`. Su modificación local previa se conservó fuera de los commits de esta entrega.

Los datos deben estar preparados por Cristian en Supabase. No volver a ejecutar `01_schema.sql` para probar el frontend: contiene DROP TABLE y afectaría la base compartida. Las pruebas automatizadas de esta entrega no ejecutan SQL ni crean reservas reales.

## Contrato utilizado

| Operación | Ruta existente |
| --- | --- |
| Cooperativas y datos bancarios | GET `/api/cooperativas` |
| Viajes de una fecha | GET `/api/viajes?fecha=YYYY-MM-DD` |
| Asientos por programación | GET `/api/viajes/:programacionId/asientos` |
| Crear reserva | POST `/api/reservas` con `programacion_id`, `asientos` y `pasajeros` |
| Consultar estado y pasajeros | GET `/api/reservas/:codigo` |
| Enviar comprobante | POST `/api/reservas/:codigo/comprobante`, multipart con campo `comprobante` |
| Descargar PDF | GET `/api/reservas/:codigo/boletos/:boletoId/pdf` |

Cada pasajero se envía como `{ nombre, cedula, asiento_id, precio }`, tal como exige el controlador existente. La interfaz usa el precio explícito del asiento si existe y, en caso contrario, `precio_base`. El servidor devuelve el total de la reserva. No se inventó un porcentaje VIP ni se introdujo el BUG-01 en el cliente.

El QR usa el mismo contenido que `ticketService.js`: `{ reserva, boleto_id, asiento, cedula }`.

## Diferencias del backend que debe resolver el equipo

Estas diferencias se encontraron en el código recibido; se documentaron sin modificar la parte de otros compañeros.

| Diferencia con el plan | Comportamiento del frontend / responsable de resolver |
| --- | --- |
| El plan exige validar manualmente el comprobante. El controlador actual lo marca directamente como PAGADO. | La interfaz representa el estado recibido; soporta PENDIENTE_VALIDACION y no muestra QR/PDF mientras haya revisión. Cesar y Daky deben completar la transición de aprobación real. |
| El plan indica VIP del 1 al 8; los seeds actuales solo clasifican del 1 al 4. | Los datos reales del servidor tienen prioridad. La demostración y el valor de respaldo usan 1–8. Cristian debe alinear el catálogo. |
| No hay tarifa VIP, cálculo de descuentos ni cotización autoritativa; el backend suma los precios recibidos del cliente. | Se muestra la tarifa disponible sin inventar recargos ni descuentos. Cesar debe calcular y validar precios en el servidor. Las tarifas preferenciales no están habilitadas en este frontend. |
| Crear una reserva requiere nombres, cédulas y precios; no existe un endpoint para bloquear únicamente al seleccionar asientos. | El reloj empieza al crear la reserva después del formulario, usando expira_en. La pantalla aclara que seleccionar todavía no bloquea. Cesar debe ampliar el contrato si el bloqueo debe comenzar antes. |
| La carga de comprobante no comprueba expira_en en su UPDATE. | La interfaz bloquea envíos vencidos, pero Cesar también debe validar el vencimiento en el servidor. |
| La comprobación de disponibilidad no bloquea filas ni impone unicidad de asiento por viaje; consultar asientos puede repetir registros históricos y considerar ocupadas reservas pendientes vencidas. | El cliente elimina duplicados y conserva el estado más restrictivo. Cesar/Cristian deben asegurar exclusión concurrente y disponibilidad correcta en el backend. |
| El BUG-04 descrito en el PDF no está implementado como filtro PNG en el multer recibido. | La interfaz permite PNG/JPG/PDF según el comportamiento recibido y valida tamaño. La secuencia didáctica de bugs/hotfix corresponde al equipo de backend/SCM. |

La integración con Supabase y un pago real no fue ejecutada. El frontend está implementado y probado contra el contrato existente; el cumplimiento completo del flujo de negocio depende de resolver las diferencias anteriores.

## Pruebas y evidencias

Desde `frontend`:

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

Resultado de la entrega: **8 pruebas unitarias aprobadas**, **11 pruebas de navegador aprobadas** y **compilación de producción correcta**. Las pruebas de navegador interceptan `/api/*` y utilizan datos ficticios; no demuestran una compra real en Supabase. El reporte HTML local queda en `frontend/playwright-report/` (ignorado en Git).

En Windows, las pruebas utilizan Google Chrome instalado. Se puede elegir otro canal compatible mediante PLAYWRIGHT_CHANNEL. El intento con Edge dentro del entorno de ejecución se cerró al arrancar; las verificaciones completas se realizaron con Chrome.

Cobertura: filtros, mapas 40/41, asiento ocupado, selección VIP, formulario y reserva, conflicto 409, temporizador/recarga/vencimiento, comprobante inválido, carga multipart, revisión sin QR, boleto pagado con QR, descarga PDF simulada, errores de servicio, demostración y pantalla móvil.

Para regenerar las capturas, con Vite iniciado:

```powershell
node scripts/capture-evidence.mjs
```

Capturas verificadas visualmente, todas con datos de demostración:

- `docs/evidencias/cliente/01-buscador.png`
- `docs/evidencias/cliente/02-asientos-40.png`
- `docs/evidencias/cliente/03-pasajero.png`
- `docs/evidencias/cliente/04-temporizador-comprobante.png`
- `docs/evidencias/cliente/05-asientos-41.png`
- `docs/evidencias/cliente/06-boleto-qr.png`
- `docs/evidencias/cliente/07-movil.png`

## Commits del alcance de Sonia

| Commit | Entrega |
| --- | --- |
| 4875132 | Base React, Vite y Tailwind |
| 7467caa | Buscador con filtros por cooperativa y horario |
| aba1596 | Mapa interactivo de 40/41 plazas |
| 5bf4baf | Temporizador visual basado en vencimiento |
| 1951724 | Datos de pasajeros y comprobante |
| 76fd77d | Consulta, QR y descarga del boleto |
| 78e2f84 | Pruebas del flujo, accesibilidad y fecha de demostración |

Los cinco commits funcionales corresponden a los cinco ejemplos del apartado D del plan. Sus mensajes están en español y minúsculas. Se añadió un commit final de documentación y capturas.

## Cuando Sonnia decida abrir el PR

1. Revisar las pantallas y coordinar las diferencias de integración descritas arriba.
2. Confirmar la rama con `git branch --show-current` y revisar `git log --oneline develop..HEAD`.
3. Subir la rama solo cuando se decida: `git push -u origin feature/portal-cliente-asientos`.
4. Abrir el PR hacia develop, con Daky y Snaider como revisores obligatorios.
5. Adjuntar las capturas y describir las pruebas y limitaciones reales. Avisar: **Requiere ejecutar npm install dentro de frontend tras sincronizar esta rama**.
6. Esperar ambas aprobaciones; utilizar Create a merge commit y conservar la rama.

Esta entrega no realiza los pasos 3–6. La revisión que Sonia debe hacer al PR de Daky sigue siendo una actividad posterior del grupo.
