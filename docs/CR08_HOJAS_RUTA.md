# CR-08 — Matriz de hojas de ruta

Solicitud SCR-EXP-2026-006. Versión objetivo v1.8.0. Rama `feature/cr-08-matriz-hojas-ruta`, creada desde main v1.7.0. Revisores Snaider y Joel.

## Uso por rol

- Gerencia y SuperAdmin acceden a **Grupos y hojas de ruta** en el panel administrativo. Primero crean grupos de buses y de frecuencias del mismo tipo de operación y los vinculan. Una unidad o frecuencia pertenece a un solo grupo. Un grupo de buses puede vincularse a varios grupos de frecuencias.
- En **Grupos, sucursales y oficinistas** también se registran las oficinas por localidad y los oficinistas asociados. Las nuevas cuentas usan una contraseña de al menos ocho caracteres con mayúscula, minúscula y número.
- El oficinista accede desde su panel a **Hoja de Ruta Diaria**. Puede programar los grupos de su cooperativa. La configuración de grupos y personal corresponde a gerencia y SuperAdmin.
- El gerente trabaja exclusivamente con su cooperativa. SuperAdmin selecciona una cooperativa de planificación. Los permisos y el ámbito se verifican en backend a partir de una sesión firmada y del usuario actual en la base de datos.
- Después de actualizar, volver a iniciar sesión para obtener el token de ocho horas. Se firma con `SESSION_SECRET`, o con `HISTORY_TOKEN_SECRET` si está configurado. Sin esas variables, el backend usa una clave efímera que invalida sesiones al reiniciarse.

## Matriz y rotación

Las filas corresponden a frecuencias y las columnas a fechas. Se admiten rangos de uno a 31 días. Cada celda tiene un desplegable y el guardado afecta únicamente a las celdas modificadas.

**Proponer rotación 3+2** prepara una propuesta para revisar y guardar explícitamente. Con cinco buses y tres frecuencias, cada unidad cubre tres jornadas y descansa dos por ciclo. El inicio del ciclo pertenece al grupo y hace que consultar períodos parciales produzca la misma rotación. Para otros tamaños se exigen al menos dos unidades adicionales al número de frecuencias. Cada unidad cubre como máximo una frecuencia diaria dentro de esta planificación.

Las consultas de cliente y chofer dejan de crear viajes con IDs de buses fijos. Devuelven la programación guardada, incluidos los viajes anteriores compatibles. Una fecha sin programación devuelve una lista vacía.

Los reemplazos manuales pueden modificar la distribución inicial del ciclo. La interfaz muestra los días asignados y en parada realmente resultantes para revisarlos. Se exigen dos unidades operativas de reserva por jornada al programar. Una sustitución marcada por avería puede consumir una de ellas y debe conservar al menos una. Las unidades en mantenimiento o con avería registrada para esa fecha quedan excluidas de la asignación. Una avería se registra por fecha y no cambia automáticamente el estado global del bus para los días siguientes.

## Reemplazos y conservación de boletos

Al cambiar de unidad, el servidor bloquea la programación dentro de una transacción y conserva el mismo ID de viaje, reservas y códigos QR. Los detalles de boletos se trasladan a los asientos del bus nuevo con el mismo número y categoría. Si falta alguno de esos asientos, excede la capacidad física o ya hubo un abordaje, se rechaza la operación completa.

La opción **Por avería** registra al bus retirado en parada para esa fecha y libera al sustituto de su descanso. El motivo, autor y buses anterior y nuevo quedan en auditoría. No se permite editar un viaje iniciado o finalizado, ni retirar una asignación con reservas pagadas o pendientes vigentes. Las cancelaciones conservan los viajes históricos y liberan el horario. La venta rechaza viajes que dejaron de estar PROGRAMADO.

Un control de versión detecta ediciones desactualizadas. Los reintentos ya aplicados no duplican asignaciones ni auditoría. Un bloqueo transaccional por cooperativa serializa las operaciones de planificación y los bloqueos de viaje se comparten con las ventas. Las pruebas embebidas verifican SQL, transacciones y conflictos de versión; la concurrencia real entre varias conexiones de Supabase queda para la validación del despliegue.

## Migración y entrega

1. Respaldar la base de datos y probar la restauración en un entorno aislado.
2. Validar `backend/database/04_planificacion_hojas_ruta.sql` en ese entorno. La migración es incremental y repetible. Crea grupos, sucursales, paradas y auditoría, añade campos a usuarios y programación y sustituye la unicidad del horario por un índice que excluye viajes cancelados. No ejecutar `01_schema.sql` en producción porque contiene DROP TABLE.
3. Con aprobación del PR y ventana coordinada, aplicar la migración 04 antes de desplegar el backend nuevo. No se infieren cooperativas o sucursales para cuentas antiguas sin asignación. Revisar esas cuentas antes de usarlas para programar.
4. Desplegar frontend y backend conjuntamente. Verificar login, permisos de gerencia y oficina, matriz 3+2, reemplazo con boletos existentes, venta y consulta del chofer.
5. Snaider integra a main con dos aprobaciones, conserva la rama y publica el tag anotado v1.8.0 sobre el merge. Registrar las evidencias del entorno desplegado y el PIR antes del cierre CAB.

La implementación local prepara la migración. Su ejecución sobre producción y el despliegue requieren completar el flujo anterior.

## Pruebas locales

En backend, ejecutar `npm ci` y `npm test`. La suite usa PostgreSQL embebido PGlite en memoria y sustituye la conexión del proceso de pruebas; no carga DATABASE_URL. Verifica la migración repetida, rotación, roles, aislamiento, sucursales, login, reservas, cancelaciones, intercambios y rollback de lotes.

En frontend, ejecutar `npm ci`, `npm test` y `npm run build`. La advertencia previa de Vite sobre el tamaño del paquete puede seguir apareciendo.

## Rollback operativo

Ante fallos de integridad o disponibilidad, suspender las modificaciones de programación y registrar el incidente. Snaider debe revertir el merge de CR-08 mediante `git revert -m 1 <SHA_DEL_MERGE_CR08>` en una rama de contingencia revisada y desplegar la aplicación anterior compatible, manteniendo ramas y etiquetas.

La migración es aditiva y las tablas nuevas deben conservarse durante el rollback para retener la auditoría. No eliminar reservas, detalles ni viajes creados después de la entrega. La aplicación anterior puede leer los campos originales. Su generador automático vuelve a estar activo, por lo que debe evitarse consultar fechas no planificadas hasta resolver la contingencia. Una restauración total del respaldo exige detener escrituras y conciliar primero las compras posteriores con autorización CAB.

## Correspondencia con la consigna

| Requisitos | Implementación |
| --- | --- |
| FREC-08 a FREC-12 | Grupos de buses y frecuencias, tipo de operación, vínculos y validación previa a programar |
| RUTA-01 y RUTA-02 | Alta de oficinistas desde gerencia y asociación a sucursal/localidad |
| RUTA-03 y RUTA-04 | Matriz accesible para oficinista y gerente de la cooperativa |
| RUTA-05 a RUTA-09, RUTA-12 y RUTA-15 | Matriz de frecuencias × fechas con desplegables, selección de grupos e inventario disponible |
| RUTA-10 y RUTA-11 | Propuesta cíclica 3+2, reservas y resumen de trabajo/descanso |
| RUTA-13 y RUTA-14 | Reemplazo puntual por avería, actualización de paradas, preservación de boletos y auditoría |
