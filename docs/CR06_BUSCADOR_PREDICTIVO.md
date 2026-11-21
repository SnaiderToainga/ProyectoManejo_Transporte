# CR-06 — Buscador predictivo, pasajeros y filtros de venta

Expediente **SCR-USR-2026-002**, cambio Estándar, asignado a Sonia
(@sonnia2002). Rama `hotfix/cr-06-filtro-predictivo-pasajeros`, creada desde
`main` v1.8.1 (`63230a9`). Versión prevista **v1.8.2**. PR único hacia `main`.
Revisores: @joel427 y @SnaiderToainga. Fusión a cargo del responsable SCM.

## Límite del cambio

El trabajo se limita a los requisitos de CR-06. El manual exige filtrar por
chasis y carrocería, pero no prescribe esta migración ni la carga de marcas para
las seis unidades. El archivo SQL es una propuesta técnica de soporte para
revisión del CAB/SCM, no una instrucción de aplicarlo sobre la base compartida.
Permanece sin ejecutar. Tampoco se han modificado credenciales, datos reales,
otras ramas o servicios publicados.

El filtro de marcas está implementado y probado con datos aislados. Su
validación con datos reales queda pendiente de que la base compartida disponga
de esa información; no se considera verificado en producción ni se sustituye
con marcas ficticias.

## Alcance implementado

| Requisito | Comportamiento |
| --- | --- |
| Origen y destino predictivos | Sugerencias del catálogo de frecuencias y sus paradas intermedias; coincidencias sin distinguir tildes o mayúsculas. Selección táctil o mediante flechas, Enter y Escape. Se conserva la entrada manual. |
| Cantidad de pasajeros | Entero de 1 a 65. Los resultados requieren suficientes plazas disponibles en la categoría elegida; no se usa la capacidad física como disponibilidad. |
| Cooperativa | Se combina con los demás filtros y conserva las rutas destacadas. |
| Asiento Normal/VIP | La disponibilidad se cuenta para la categoría solicitada. Sin categoría, se cuentan ambas. |
| Marca de chasis y carrocería | Dos selectores combinables, alimentados por las marcas registradas de los viajes de la fecha consultada. No se atribuyen marcas a buses sin información. |
| Viaje directo/con paradas | Filtra el tipo de servicio oficial de la frecuencia. |
| Conservación de CR-05 | Se mantienen fecha, horario, orden de paradas, selección de subida/bajada, tarifa proporcional y envío del tramo al checkout. Cambiar la bajada conserva el origen obtenido del buscador. |
| Dispositivos móviles | Campos y sugerencias adaptables; comprobación de ausencia de desplazamiento horizontal de página a 320, 390 y 768 px. |

La cantidad de pasajeros se usa para buscar disponibilidad; no bloquea asientos.
La selección y la reserva vuelven a consultar y validar la disponibilidad en el
flujo existente, porque otros usuarios pueden comprar después de una búsqueda.

## API y base de datos compartida

`GET /api/viajes?fecha=...` añade `marca_chasis`, `carroceria`,
`asientos_disponibles`, `asientos_disponibles_normal` y
`asientos_disponibles_vip`. Una consulta obtiene los totales por viaje, evitando
una petición adicional por cada resultado con el backend actualizado.

Un asiento activo se cuenta una vez, excluyendo reservas pagadas y reservas
pendientes con retención vigente. Las retenciones vencidas y reservas rechazadas
no lo ocupan. Se usa la misma regla de inventario del sistema. La consulta de
asientos omite los inactivos para mantener la coherencia con los totales.

El cliente conserva compatibilidad con APIs sin esos totales: consulta los
asientos y cuenta los disponibles de la categoría, sin duplicar números. Si la
consulta falla, muestra un error y permite reintentar; no inventa disponibilidad.

Migración incremental: `backend/database/06_catalogo_busqueda.sql`. Añade
únicamente dos columnas opcionales a `buses`, sin borrar registros ni modificar
reservas. Es repetible. La API también funciona antes de aplicarla: las marcas
ausentes se devuelven como `null`.

Según la indicación del líder confirmada por Sonia, se usa la base compartida del
grupo. Cada integrante configura esa conexión en su `backend/.env`, sin versionar
credenciales. La configuración local ya coincide con el destino facilitado por
el líder. Los cambios de esquema y datos se coordinan una sola vez sobre esa
base; no se recrea la base desde cada equipo. Si el CAB/SCM acepta esta propuesta
de soporte para las marcas, el procedimiento técnico previsto es:

1. Respaldar su base de datos y revisar la migración incremental.
2. Aplicar solo `06_catalogo_busqueda.sql` sobre una base que ya tenga la línea
   base del proyecto. No ejecutar `01_schema.sql` sobre una base existente:
   contiene eliminación de tablas.
3. Completar `buses.marca_chasis` y `buses.carroceria` con información verificada
   de cada unidad, coordinando los identificadores y cambios con el líder.
4. Publicar viajes mediante el flujo autorizado de hojas de ruta y comprobar
   los filtros con su fecha, unidades y reservas reales.

La edición administrativa completa de la ficha del bus corresponde a CR-01;
este cambio incorpora las columnas y su consulta para los filtros de CR-06.
La migración y la carga de marcas en bases reales no se ejecutan automáticamente
desde la aplicación ni desde las pruebas.

## Pruebas reproducibles

Validación local del 21 de noviembre de 2026: 46 pruebas del backend,
25 unitarias del frontend y las 11 pruebas de navegador seleccionadas aprobadas.
La compilación de v1.8.2 terminó correctamente; Vite advierte que el paquete
principal supera 500 kB. La aplicación todavía no se ha publicado en producción.

Comprobación adicional de solo lectura del 21 de noviembre de 2026: conexión
correcta a la base compartida, seis buses registrados y ausencia de las dos
columnas de marcas de CR-06. El catálogo actualizado devolvió HTTP 200 con seis
viajes y totales de asientos para el 22 de noviembre de 2026, próxima fecha con
programación. No se aplicó la migración ni se insertaron o actualizaron datos.

Desde `backend`:

```powershell
npm ci
npm test
```

Desde `frontend`:

```powershell
npm ci
npm test
npm run build
npx playwright test tests/e2e/tripSearch.spec.js tests/e2e/client.spec.js --grep "CR-06|buscar por cooperativa|mapa de" --reporter=list
```

Las pruebas del backend ejecutan PostgreSQL en memoria mediante PGlite y
sustituyen la conexión de la aplicación. No cargan `DATABASE_URL` ni escriben en
Supabase. Cubren inventario por categoría, pagos, retenciones vigentes/vencidas,
asientos inactivos, duplicados, marcas opcionales, migración repetible y paradas.

Las pruebas de navegador interceptan la API con datos simulados. Cubren los
cuatro filtros combinados, cantidad de pasajeros, autocompletado con teclado y
tildes, resultados vacíos, limpieza, API anterior, errores y compra intermedia.
Las capturas `busqueda-filtros-tramo.png` y `busqueda-movil-sugerencias.png` se
generan en `frontend/test-results/`, dentro de la carpeta del caso correspondiente.
Son evidencias de pruebas con datos simulados, no de validación en producción.
Las teselas externas de OpenStreetMap se bloquean durante estos casos para
aislar las pruebas; esas capturas no comprueban la cartografía de producción.

## Evidencias manuales con la base compartida

Sonia aportó las siguientes capturas al probar la aplicación local con datos
reales del grupo para el 22 de noviembre de 2026. Se conservaron sin editar:

| Evidencia | Resultado observado |
| --- | --- |
| [Normal, dos pasajeros](evidencias/cr06/01-normal-dos-pasajeros.png) | ATENAS, Ambato–Guayaquil, 09:30: 36 plazas Normal disponibles para dos pasajeros. |
| [VIP, dos pasajeros](evidencias/cr06/02-vip-dos-pasajeros.png) | La misma salida ofrece cuatro plazas VIP para dos pasajeros. |
| [Tramo intermedio](evidencias/cr06/03-tramo-latacunga-machachi.png) | CITA, 08:30: Latacunga–Machachi, 37 plazas Normal, dos pasajeros y tarifa proporcional de $1,67 sobre $5,00 de la ruta completa. |
| [Formulario móvil](evidencias/cr06/04-movil-formulario.png) | Origen, destino, fecha y pasajeros se distribuyen en el espacio disponible. |
| [Filtros móviles](evidencias/cr06/05-movil-filtros.png) | Selectores y horarios se adaptan a la vista móvil. |
| [Resultado móvil](evidencias/cr06/06-movil-tramo.png) | Se conserva la selección de subida/bajada y la tarifa proporcional en la tarjeta móvil. |

También se aportó un resultado vacío durante la prueba de cinco pasajeros VIP.
Esa captura no muestra los filtros aplicados y, por sí sola, no acredita dicha
combinación. La exclusión por plazas insuficientes está cubierta por las pruebas
automatizadas. Las capturas de resultados tampoco acreditan por sí solas el
despliegue de sugerencias predictivas, cubierto por las pruebas de navegador.

La validación real del filtro de chasis/carrocería sigue pendiente: la base no
dispone de esas columnas ni de marcas registradas. No se modificó la base ni se
crearon reservas para estas comprobaciones. El ticket no debe cerrarse como
cumplido al 100 % mientras esa dependencia siga pendiente.

## Despliegue y reversión

1. Completar las comprobaciones con la base del entorno y adjuntar evidencias al
   ticket. Registrar el PR real en el portal; no usar números de otros cambios.
2. Obtener las dos aprobaciones independientes antes de fusionar hacia `main`.
3. Coordinar respaldo, datos de marcas, ventana y despliegue con el CAB/SCM.
4. Verificar búsquedas, plazas por categoría y compra entre paradas después de
   publicar. Conservar la rama remota.
5. Después del merge, el responsable autorizado crea la etiqueta anotada
   `v1.8.2` sobre el commit oficial de `main`. No crearla en la rama de trabajo
   ni reemplazar una etiqueta publicada.
6. Registrar la revisión posterior y solicitar el cierre formal al CAB.

Si falla el despliegue, coordinar un `git revert` del merge oficial y publicar
el código estable anterior. Las columnas opcionales pueden permanecer: son
compatibles con v1.8.1 y retirarlas eliminaría las marcas registradas. No borrar
reservas, etiquetas ni ramas publicadas. Registrar el resultado en el ticket.
