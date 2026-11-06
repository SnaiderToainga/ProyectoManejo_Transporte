# Ficha técnica de frecuencias y buses

## Frecuencias

Cada frecuencia registra:

- Cooperativa responsable.
- Resolución ANT almacenada en `resolucion_ant`.
- Origen y destino.
- Hora de salida.
- Tarifa base.
- Tipo de servicio: `DIRECTO` o `PARADAS`.

La interfaz muestra la resolución registrada en la base de datos.
Su visualización no verifica su autenticidad ante la ANT.

## Buses

Cada bus registra:

- Número de disco.
- Placa.
- Capacidad: 40 o 41 asientos.
- Disponibilidad de baño posterior.
- Estado operativo.

El esquema actual no incluye fabricante ni modelo de carrocería.

## Consulta de viajes

Endpoint:

GET /api/viajes?fecha=AAAA-MM-DD

La respuesta incluye `resolucion_ant`, `tipo_servicio`,
`capacidad` y `tiene_bano_posterior`, junto con los datos
de programación, ruta y cooperativa.

## Comprobantes de transferencia

Formatos MIME permitidos:

- image/png
- image/jpeg
- image/jpg
- application/pdf

Tamaño máximo: 5.242.880 bytes.

Errores de carga:

- 400: formato no permitido.
- 413: archivo que supera el tamaño máximo.

El filtro de formatos comprueba el MIME declarado;
no verifica el contenido binario del archivo.

## Disponibilidad de asientos

Endpoint:

GET /api/viajes/:programacionId/asientos

Devuelve el identificador, número, fila, columna, categoría
y estado de ocupación de cada asiento.

La consulta utiliza EXISTS para evitar duplicar asientos
cuando existen varios detalles de reservas asociados.

Un asiento se muestra como OCUPADO cuando tiene una reserva
del mismo viaje en estado PAGADO o PENDIENTE.
En los demás casos se muestra como DISPONIBLE.