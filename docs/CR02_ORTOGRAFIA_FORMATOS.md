# CR-02 — Corrección ortográfica y formatos de moneda y hora

Expediente **SCR-USR-2026-003**, cambio Estándar, asignado a Sonia
(@sonnia2002). Rama `hotfix/cr-02-correccion-ortografica`, creada desde `main`
después del merge de CR-06 (`c1f2b43`). Versión prevista **v1.8.3**.
Revisores: @joel427 y @SnaiderToainga. PR único hacia `main` y fusión por SCM.

## Alcance y comportamiento

El cambio se limita al frontend aprobado por el CAB para CR-02 / COOP-08:
ortografía, puntuación, etiquetas y presentación de importes y horarios.
No modifica backend, contratos de la API, valores almacenados, credenciales,
estructura de la base de datos, descuentos ni cálculos de tarifas.

| Elemento | Antes | Después |
| --- | --- | --- |
| Moneda del cliente | Formato dependiente del locale, por ejemplo `$9,50`, sin sufijo USD | `$ 9.50 USD`, dos decimales, punto decimal y sin agrupación de miles |
| Moneda de administración | `$9.50` con formato independiente | La función compartida `money`, igual que cliente y operación |
| Moneda de comprobantes | Concatenación del símbolo con el valor de la API | Función compartida, con dos decimales y USD |
| Horarios de administración y comprobantes | Podían mostrar `07:05:00` | `07:05` |
| Vista previa institucional | `FECHA & HORA`, `CÓDIGO RESERVA`, `N°`, `07:00 AM` | `FECHA Y HORA`, `CÓDIGO DE RESERVA`, `N.º`, `07:00` |
| Etiquetas y mensajes | Mayúsculas interiores, porcentajes sin espacio, puntuación inconsistente | Redacción y puntuación normalizadas en los textos revisados de acceso, frecuencias, descuentos y comprobantes |

Las tildes correctas ya presentes se conservan. No se alteran nombres de
personas, cooperativas, ciudades ni otros datos recibidos de la base.
Los identificadores `NIÑO`, `TERCERA_EDAD`, `NORMAL`, etc. conservan sus valores
internos; solo cambia su etiqueta visible cuando corresponde.

`money` aplica el formato visual a los valores existentes. Los formularios
numéricos conservan su valor sin símbolo ni sufijo; la reserva continúa enviando
números a la API. Se mantienen el cálculo proporcional de CR-05 y los descuentos
de CR-07, incluidos sus redondeos.

`shortTime` presenta horarios en `HH:mm`, completa ceros iniciales y usa
`--:--` si no hay una hora válida. Se reutiliza en cliente, administración,
comprobantes, cabina del chofer, grupos y hojas de ruta. La hora de vencimiento
del patrocinio se presenta explícitamente en ciclo de 24 horas.

La fecha exacta de compra de CR-07 conserva segundos y zona de Ecuador mediante
`purchaseTime`: no es un horario de salida. El temporizador de reserva conserva
su duración `mm:ss`. No se convierten ni se sobrescriben marcas temporales.

El PDF y el correo generados por el backend quedan fuera de esta modificación
del frontend; no se modifican los formatos ni la lógica de esos servicios.

## Validación

- 29 pruebas unitarias del frontend aprobadas: incluyen formatos, ceros,
  centavos, negativos, entradas inválidas, horarios y conservación de cálculos.
- 17 pruebas de navegador seleccionadas aprobadas: nueve de CR-02 y ocho de
  regresión de CR-06. Se verifican cliente, administración, vista previa,
  comprobantes, chofer, boleto, historial y datos enviados por checkout.
- Ausencia de desbordamiento horizontal de la página comprobada a 320, 390 y
  768 px, incluyendo un importe largo con USD.
- Compilación del frontend correcta. Se conserva la advertencia no bloqueante
  de Vite por el tamaño del paquete principal.

Desde `frontend`:

```powershell
npm test
npm run build
npx playwright test tests/e2e/formatting.spec.js tests/e2e/tripSearch.spec.js --reporter=list
```

Las pruebas de navegador interceptan la API con datos simulados. Los perfiles
de administración y operación usan sesiones ficticias locales dentro de las
pruebas. La creación de reserva comprobada se intercepta: no escribe en la base
compartida ni envía correos. Las demás comprobaciones solo consultan datos
simulados y no guardan cambios administrativos.

## Evidencias

El [resultado real de CR-06 en v1.8.2](evidencias/cr06/01-normal-dos-pasajeros.png)
sirve como referencia del formato monetario anterior. Las capturas siguientes
son del nuevo formato con datos simulados y no acreditan despliegue productivo:

- [Cliente: moneda y horario](evidencias/cr02/01-cliente-formato.png).
- [Administración: moneda y horario](evidencias/cr02/02-administracion-formato.png).
- [Vista móvil: importe completo con USD](evidencias/cr02/03-movil-formato.png).

Sonia aportó además las siguientes capturas de su comprobación local con los
datos reales de ATENAS, en la ruta Ambato–Guayaquil:

- [Cliente con datos reales](evidencias/cr02/04-real-cliente-moneda-hora.png):
  la tarifa aparece como `$ 9.50 USD` y la salida como `09:30`.
- [Tarjeta móvil con datos reales](evidencias/cr02/05-real-movil-moneda-hora.png):
  se ven completos el importe, el horario y el botón de selección de asientos.

Estas capturas se conservaron sin editar y acreditan la presentación observada,
no el despliegue productivo. La ausencia de desbordamiento de página a los anchos
indicados se verificó también mediante las pruebas automatizadas.
El registro del PR en el portal se completará al publicarlo. Las comprobaciones
de formato no requieren crear reservas ni guardar cambios de catálogo en la
base compartida.

## Integración y reversión

Después de la revisión local, registrar los commits con Conventional Commits y
abrir un único PR hacia `main`. Vincular su número y URL al ticket y solicitar
las revisiones de Joel y Snaider. Conservar la rama remota.

Tras las dos aprobaciones, SCM coordina el merge y despliegue. La persona
autorizada crea el tag anotado `v1.8.3` sobre el commit oficial de `main`
después del merge. El CAB realiza la verificación posterior y el cierre.

Si se detecta una regresión, coordinar con CAB/SCM un `git revert` del merge de
CR-02 y desplegar el código estable anterior. No se requiere una reversión de
base de datos porque este cambio no altera su esquema ni sus datos.
