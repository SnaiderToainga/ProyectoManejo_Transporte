# CR-01: frontend de Sonia y entrega al backend de César

Ticket: **SCR-EXP-2026-007**. Sonia (`@sonnia2002`) es titular del frontend; César (`@Steven9tp`) es coautor del backend.
Rama compartida: `feature/cr-01-ux-wizard-cooperativa`, desde `main`. Versión prevista: `v1.9.0`.

## Estado de esta entrega

Se implementó el frontend y se verificó con API simulada. **Esta entrega no certifica la integración real, el despliegue ni cobros con tarjeta.** César debe completar y probar los contratos descritos abajo antes de presentar el PR final.

Se modificaron frontend, pruebas de frontend y esta documentación. No se modificaron backend, archivos SQL, variables de entorno ni datos de la base compartida. No se publicaron commits, PR, tags ni despliegues desde esta entrega.

El archivo PDF del repositorio `REQUERIMIENTOS_COMPLETOS_REVISION_DOCENTE_10-11-2026.pdf` se contrastó con el alcance de CR-01 del manual operativo. Las rutas nuevas de API que siguen son **propuestas concretas de integración**, no nombres exigidos por el docente; si César acuerda otros nombres, debe ajustar también el adaptador `frontend/src/lib/api.js` y las pruebas.

## Frontend realizado

| Requisitos | Interfaz y comportamiento |
| --- | --- |
| COOP-04, COOP-10 a COOP-15 | Wizard: 1) institución y normativa, 2) banco e identidad visual, 3) usuario gerente, 4) revisión y guardado conjunto. Valida antes de avanzar, conserva datos al retroceder, diferencia los dos correos y envía el gerente completo en la misma petición. |
| COOP-19 a COOP-21 | Editar perfil con datos precargados, logo en el modal y cabecera administrativa existente. La edición no reemplaza contraseñas ni roles. Se informa un error si el servidor no confirma el guardado. |
| COOP-22, COOP-23 | Navegación de cliente separada del panel administrativo; acceso administrativo con el guardián de roles existente. Menú de cooperativas/branding, buses, frecuencias, grupos/hojas de ruta y consulta de estructuras. Se reutiliza la planificación anterior y no se reimplementa el editor de CR-09. |
| BUS-01 a BUS-10 | Alta/edición de unidad en modal: disco, placa, capacidad numérica positiva (sin limitar la interfaz a 40/41), chasis, carrocería, fotos por URL, socio, baño y estado. Gerencia usa su cooperativa de sesión, sin selector de otras entidades. |
| VENT-07 a VENT-09 | Compra como visitante; registro e inicio de sesión opcional en Mi cuenta; historial de la cuenta. Se conserva como alternativa el acceso anterior por enlace de correo. |
| VENT-15, VENT-16 | Se conserva la información destacada de unidad/ruta/hora y se añade Ver más con fotografías y ficha técnica en resultados y administración. Datos ausentes se presentan como no registrados. |
| VENT-17 | Cambiar asientos conserva la selección y el borrador de pasajeros en memoria. Al recargar, restaura viaje/tramo e IDs durante hasta 30 minutos y vuelve a consultar disponibilidad antes de continuar. No almacena nombres, cédulas o correos en ese borrador de sesión. La selección no bloquea asientos. |
| VENT-19, VENT-20 | Al iniciar sesión se precargan el comprador y el primer pasajero vacío. Consulta por cédula válida con demora de 400 ms y acceso autorizado; también hay botón para reintentar. Una respuesta tardía no sobrescribe cambios posteriores. No se deducen descuentos de la identidad. |
| Métodos de pago del manual CR-01 | Transferencia, depósito con comprobante y tarjeta de débito/crédito mediante enlace a pasarela alojada. No se piden PAN/CVV en la aplicación. Solo el estado confirmado por el backend permite emitir un boleto. |

## Contratos que debe completar César

Todas las URLs siguientes son relativas al prefijo `/api`. Los errores deben devolver JSON `{ "error": "Mensaje comprensible" }` y el estado HTTP correspondiente. El frontend envía Bearer cuando hay sesión; las cabeceras de rol que existen por compatibilidad no sustituyen la autorización del backend.

### 1. Cooperativa y gerente: operación atómica

`POST /admin/cooperativas`, autorizado para SuperAdmin. Ejemplo de cuerpo (datos ficticios, no ejecutar en la base compartida):

```json
{
  "nombre": "Cooperativa de prueba",
  "ruc": "1890012345001",
  "resolucion_ant": "ANT-RES-2026-001",
  "telefono": "0991234567",
  "correo": "institucion@example.test",
  "direccion": "Terminal de prueba",
  "color_distintivo": "#214e44",
  "logo_url": "https://example.test/logo.png",
  "banco": "Banco Pichincha",
  "cuenta_bancaria": "1234567890",
  "gerente": {
    "nombre": "Gerente de prueba",
    "cedula": "1710034065",
    "correo": "gerente@example.test",
    "telefono": "0981234567",
    "password": "ClaveFicticia9!",
    "rol": "ADMIN_COOP"
  }
}
```

Respuesta: `{ "cooperativa": { "id": 1, "nombre": "...", "...": "campos persistidos" }, "gerente": { "id": 2 } }`.
El servidor valida los campos, aplica el rol permitido y vincula el gerente a la cooperativa recién creada en una transacción. No devolver contraseñas ni hashes.

`PUT /admin/cooperativas/:id` edita el perfil de la cooperativa propia (o SuperAdmin) y devuelve `{ "cooperativa": { ... } }`. Recibe los campos institucionales, bancarios y de marca, **sin** `gerente` ni credenciales. No cambiar el rol o las claves durante esta edición.

**Situación al preparar la entrega:** el backend existente ya inserta cooperativa y gerente en una transacción, pero omite parte de los campos institucionales del alta y la cédula del gerente. También debe admitir el correo institucional y la resolución en edición. César debe completar la persistencia y confirmar que GET devuelve los campos guardados; una respuesta HTTP 200 por sí sola no demuestra persistencia de todos ellos.

### 2. Unidades y ficha técnica

`POST /admin/buses` y `PUT /admin/buses/:id`: cuerpo con `cooperativa_id`, `numero_disco` numérico, `placa`, `capacidad` numérica positiva, `marca_chasis`, `carroceria`, `socio_nombre`, `fotos` (array de URL), `foto_url` (primera foto, compatibilidad), `tiene_bano_posterior` y `estado`. Respuesta `{ "bus": { "id": 15, ... } }` con los datos persistidos. Validar pertenencia y permisos en el servidor; no confiar en IDs o cabeceras de rol enviadas por el navegador.

`GET /admin/buses` y el catálogo público `GET /viajes?fecha=...` deben incluir las marcas, fotos y datos públicos del socio necesarios para Ver más, además de conservar la disponibilidad/categorías de CR-06 y los campos anteriores. No publicar documentos o contactos privados del propietario.

`GET /admin/buses/:id/asientos` (autorizado y limitado a su cooperativa): devolver un array o `{ "asientos": [...] }` para la consulta de estructuras del menú. Los elementos usan `asiento_id`, `numero_asiento`, `categoria`, `fila`, `columna` y `estado_ocupacion` del mapa existente. Este endpoint es de lectura; no llamar al endpoint de reemplazo de plantillas para consultar o editar solo los datos técnicos de una unidad.

**Situación al preparar la entrega:** completar estos campos y el endpoint de consulta; comprobar que una edición de metadatos no elimina asientos vendidos ni altera la estructura. Si cambiar capacidad requiere reconstruir asientos, el backend debe rechazar cambios incompatibles con reservas existentes y coordinar su tratamiento. No ejecutar reconstrucciones o migraciones automáticamente desde esta entrega frontend.

### 3. Cuenta personal de cliente

| Endpoint | Entrada | Respuesta usada por el frontend |
| --- | --- | --- |
| `POST /clientes/registro` | `{ "nombre", "cedula", "email", "password" }` | `{ "token": "...", "cliente": { "id", "nombre", "cedula", "email" } }` |
| `POST /clientes/sesion` | `{ "email", "password" }` | La misma estructura de sesión |
| `GET /clientes/me` | `Authorization: Bearer <token>` | `{ "cliente": { "id", "nombre", "cedula", "email" } }` |
| `GET /clientes/por-cedula/:cedula` | Token de cliente autorizado; opcionalmente admitir el enlace previo de historial con el mismo alcance | `{ "cliente": { "nombre", "cedula", "email" } }`; 404 cuando no hay coincidencia autorizada |
| `GET /mis-compras` | Admitir también el token de cuenta personal | Mantener el array de reservas existente y limitarlo al cliente autenticado |

El token de cuenta se conserva en `sessionStorage` y se verifica al recargar. Es independiente de `transporte_auth` administrativo. El frontend no convierte el cliente en gerente ni guarda la contraseña. Logout elimina el acceso local y las compras visibles.

El backend debe impedir consultar datos personales de terceros con solo conocer una cédula. Definir el alcance de acompañantes conocidos según la cuenta; no crear un buscador público de cédulas. Los visitantes mantienen el ingreso manual y la compra sin cuenta. Preservar `/mis-compras/acceso` y los enlaces anteriores.

**Situación al preparar la entrega:** estos endpoints de cuenta y precarga no existen en el backend actual. Si no están implementados, la interfaz muestra error y permite continuar como visitante; no fabrica usuarios ni datos precargados.

### 4. Tarjeta en pasarela y comprobantes

`POST /reservas/:codigo/pago-tarjeta`: `{ "metodo_pago": "TARJETA" }`, cabecera `Idempotency-Key: cr01-<codigo>`.

Respuesta: `{ "checkout_url": "https://<dominio-oficial-del-proveedor>/<sesion>" }`. El frontend solo acepta HTTPS sin credenciales embebidas y ofrece abrir esa sesión en otra pestaña. César debe validar el dominio oficial del proveedor en el servidor, obtener el importe desde la reserva y fijar las URLs de retorno desde configuración confiable; no aceptar importes o callbacks arbitrarios del cliente. La idempotencia debe aplicarse en el backend y no depender solo de que el botón esté bloqueado.

Implementar la confirmación del proveedor (webhook/verificación servidor a servidor), autenticidad y protección frente a doble liquidación entre métodos. Preservar los estados y la caducidad de reservas. Volver de la pasarela no equivale a pago aprobado: el panel sigue consultando `GET /reservas/:codigo` cada 15 s y solo muestra pago confirmado cuando el servidor devuelve ese estado. El código de reserva sirve para recuperar la consulta si la navegación se interrumpe. Utilizar sandbox del proveedor antes de cualquier cobro real.

`POST /reservas/:codigo/comprobante` conserva multipart con archivo `comprobante` y añade `metodo_pago=TRANSFERENCIA` o `DEPOSITO`. Debe devolver `{ "reserva": { ... } }` con estado de revisión y registrar el método. La validación por oficinista, generación de boletos y correo siguen siendo del backend existente. No aprobar automáticamente por subir una imagen ni por elegir tarjeta.

**Situación al preparar la entrega:** la sesión de tarjeta no existe todavía. La carga de comprobante anterior se conserva; el backend debe registrar el campo adicional. Un endpoint de tarjeta no disponible muestra una alternativa bancaria, sin simular un cobro.

## Verificación y evidencias

Pruebas de frontend con respuestas de API interceptadas: no consultan ni mutan la base compartida y no realizan cargos, correos, registro real de usuarios ni modificaciones reales de cooperativas.

```powershell
cd frontend
npm test
npx playwright test tests/e2e/cr01.spec.js tests/e2e/formatting.spec.js tests/e2e/tripSearch.spec.js --reporter=line
npm run build
```

Resultado: **35 pruebas unitarias aprobadas**, **34 pruebas de navegador aprobadas** (17 de CR-01, 9 de CR-02 y 8 de CR-06) y **compilación de producción correcta**. Vite mantiene el aviso de tamaño de bundle mayor de 500 kB y el menú administrativo anterior emite una advertencia de estilos de borde de React; no impidieron la compilación ni las verificaciones.

El conjunto incluye validación de cuatro pasos y alta conjunta, edición con respuesta de error simulada del servidor, unidad con capacidad 35, fotos y socio, foco del modal, selección persistente y revalidación de asiento ocupado, cuentas e historial, precarga automática/autorizada y respuesta tardía, tarjeta sin aprobación ficticia, rechazo de URL insegura y depósito pendiente de validación. Se incluyen regresiones de CR-02 y CR-06.

Capturas revisadas visualmente, todas con **datos y servicios simulados**:

- [Confirmación del wizard](evidencias/cr01/01-wizard-confirmacion.png).
- [Ficha del bus](evidencias/cr01/02-ficha-bus.png).
- [Métodos de pago](evidencias/cr01/03-metodos-pago.png).
- [Wizard en móvil](evidencias/cr01/04-wizard-movil.png).

No se reescriben las plantillas de CR-09 ni la lógica de descuentos, tarifas proporcionales, QR, fecha/hora de compra o validación de taquilla de los cambios anteriores.

## Continuación en la rama compartida

1. Sonia guarda y publica esta entrega frontend en la rama compartida. No enviar todavía el ticket a Revisión CAB como si el cambio conjunto estuviera completo.
2. César descarga esa misma rama e implementa su backend coordinando cualquier cambio SQL con el responsable de la base. No abrir otra rama/PR para el mismo CR-01.
3. Antes de cada publicación, comprobar `git status`, descargar cambios de la rama y resolver cualquier divergencia sin `push --force`. Coordinar quién edita cada archivo, especialmente el adaptador API y sus pruebas.
4. Integrar y verificar ambos trabajos con servicios reales en un entorno acordado, registrar las pruebas de backend y de integración y completar las evidencias faltantes.
5. Sonia abre el único PR hacia `main`, identifica a ambos autores y solicita revisiones de Joel y Snaider. El informe del ticket debe distinguir lo probado de lo pendiente.
6. Después del merge autorizado y de la verificación de despliegue: tag anotado `v1.9.0` en el commit oficial y cierre por CAB/SCM. Conservar la rama remota.
