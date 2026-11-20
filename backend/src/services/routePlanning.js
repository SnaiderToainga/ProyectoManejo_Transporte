const { planningError, positiveId, dateRange } = require('./routeRotation');
const { seatIds, occupiedReservation } = require('./seatInventory');

async function catalog(client, cooperativeId) {
  const queries = [
    ['buses', `SELECT b.*, m.grupo_id FROM buses b LEFT JOIN grupo_bus_miembros m ON m.bus_id=b.id
      WHERE b.cooperativa_id=$1 ORDER BY b.numero_disco, b.id`],
    ['frecuencias', `SELECT f.*, m.grupo_id FROM frecuencias f
      LEFT JOIN grupo_frecuencia_miembros m ON m.frecuencia_id=f.id
      WHERE f.cooperativa_id=$1 AND f.activo=TRUE ORDER BY f.hora_salida,f.id`],
    ['grupos_buses', 'SELECT *, inicio_ciclo::text AS inicio_ciclo FROM grupos_buses WHERE cooperativa_id=$1 ORDER BY id'],
    ['grupos_frecuencias', 'SELECT * FROM grupos_frecuencias WHERE cooperativa_id=$1 ORDER BY id'],
    ['vinculos', `SELECT v.* FROM grupo_vinculos v JOIN grupos_buses g ON g.id=v.grupo_buses_id WHERE g.cooperativa_id=$1`],
    ['sucursales', 'SELECT * FROM sucursales WHERE cooperativa_id=$1 ORDER BY nombre']
  ];
  const result = {};
  for (const [key, sql] of queries) result[key] = (await client.query(sql, [cooperativeId])).rows;
  return result;
}

async function createGroup(client, cooperativeId, data) {
  const ids = seatIds(data.miembros);
  if (!ids || ids.length > 100 || typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.trim().length > 100) {
    throw planningError('Indica un nombre de hasta 100 caracteres y miembros únicos para el grupo.');
  }
  if (!['URBANO', 'INTERPROVINCIAL'].includes(data.tipo_operacion)) throw planningError('Tipo de operación inválido.');
  if (!['BUSES', 'FRECUENCIAS'].includes(data.clase)) throw planningError('Clase de grupo inválida.');
  const isBus = data.clase === 'BUSES';
  if (!isBus && ids.length > 20) throw planningError('Un grupo admite hasta 20 frecuencias.');
  const source = isBus ? 'buses' : 'frecuencias';
  const members = await client.query(`SELECT id FROM ${source}
    WHERE cooperativa_id=$1 AND id=ANY($2::int[]) ${isBus ? '' : 'AND activo=TRUE'} FOR SHARE`, [cooperativeId, ids]);
  if (members.rows.length !== ids.length) throw planningError('Los miembros deben pertenecer a tu cooperativa.', 403);
  let group;
  if (isBus) {
    dateRange(data.inicio_ciclo, data.inicio_ciclo);
    group = await client.query(`INSERT INTO grupos_buses(cooperativa_id,nombre,tipo_operacion,inicio_ciclo)
      VALUES($1,$2,$3,$4) RETURNING *`, [cooperativeId, data.nombre.trim(), data.tipo_operacion, data.inicio_ciclo]);
    await client.query(`INSERT INTO grupo_bus_miembros(bus_id,grupo_id) SELECT unnest($1::int[]),$2`, [ids, group.rows[0].id]);
  } else {
    group = await client.query(`INSERT INTO grupos_frecuencias(cooperativa_id,nombre,tipo_operacion)
      VALUES($1,$2,$3) RETURNING *`, [cooperativeId, data.nombre.trim(), data.tipo_operacion]);
    await client.query(`INSERT INTO grupo_frecuencia_miembros(frecuencia_id,grupo_id) SELECT unnest($1::int[]),$2`, [ids, group.rows[0].id]);
  }
  return group.rows[0];
}

async function linkGroups(client, cooperativeId, data) {
  const busesId = positiveId(data.grupo_buses_id);
  const frequenciesId = positiveId(data.grupo_frecuencias_id);
  const groups = await client.query(`SELECT b.tipo_operacion AS bus_tipo, f.tipo_operacion AS frecuencia_tipo
    FROM grupos_buses b CROSS JOIN grupos_frecuencias f
    WHERE b.id=$1 AND f.id=$2 AND b.cooperativa_id=$3 AND f.cooperativa_id=$3`, [busesId, frequenciesId, cooperativeId]);
  if (!groups.rows[0]) throw planningError('Selecciona grupos de tu cooperativa.', 403);
  if (groups.rows[0].bus_tipo !== groups.rows[0].frecuencia_tipo) throw planningError('Los grupos urbano e interprovincial son incompatibles.');
  await client.query(`INSERT INTO grupo_vinculos VALUES($1,$2) ON CONFLICT DO NOTHING`, [busesId, frequenciesId]);
}

async function createBranch(client, cooperativeId, data) {
  if ([data.nombre, data.localidad].some(value => typeof value !== 'string' || !value.trim() || value.trim().length > 100)) {
    throw planningError('Nombre y localidad de la sucursal son obligatorios (hasta 100 caracteres).');
  }
  return (await client.query(`INSERT INTO sucursales(cooperativa_id,nombre,localidad)
    VALUES($1,$2,$3) RETURNING *`, [cooperativeId, data.nombre.trim(), data.localidad.trim()])).rows[0];
}

async function matrix(client, cooperativeId, data) {
  const dates = dateRange(data.desde, data.hasta);
  const busGroupId = positiveId(data.grupo_buses_id);
  const frequencyGroupId = positiveId(data.grupo_frecuencias_id);
  const context = await client.query(`SELECT b.*, b.inicio_ciclo::text AS inicio_ciclo
    FROM grupos_buses b JOIN grupo_vinculos v ON v.grupo_buses_id=b.id
    JOIN grupos_frecuencias f ON f.id=v.grupo_frecuencias_id
    WHERE b.id=$1 AND f.id=$2 AND b.cooperativa_id=$3 AND f.cooperativa_id=$3
      AND b.tipo_operacion=f.tipo_operacion`, [busGroupId, frequencyGroupId, cooperativeId]);
  if (!context.rows[0]) throw planningError('Primero vincula grupos compatibles de tu cooperativa.', 403);
  const buses = (await client.query(`SELECT b.* FROM buses b JOIN grupo_bus_miembros m ON m.bus_id=b.id
    WHERE m.grupo_id=$1 AND b.cooperativa_id=$2 ORDER BY b.numero_disco,b.id`, [busGroupId, cooperativeId])).rows;
  const frequencies = (await client.query(`SELECT f.* FROM frecuencias f JOIN grupo_frecuencia_miembros m ON m.frecuencia_id=f.id
    WHERE m.grupo_id=$1 AND f.cooperativa_id=$2 AND f.activo=TRUE ORDER BY f.hora_salida,f.id`, [frequencyGroupId, cooperativeId])).rows;
  const trips = (await client.query(`SELECT pv.*, pv.fecha_viaje::text AS fecha_viaje
    FROM programacion_viajes pv WHERE pv.frecuencia_id=ANY($1::int[])
      AND pv.fecha_viaje BETWEEN $2 AND $3 AND pv.estado <> 'CANCELADO'
    ORDER BY pv.fecha_viaje,pv.frecuencia_id,pv.id`, [frequencies.map(f => f.id), data.desde, data.hasta])).rows;
  const busy = (await client.query(`SELECT pv.id,pv.bus_id,pv.frecuencia_id,pv.fecha_viaje::text AS fecha_viaje
    FROM programacion_viajes pv WHERE pv.bus_id=ANY($1::int[])
      AND pv.fecha_viaje BETWEEN $2 AND $3 AND pv.estado <> 'CANCELADO'`, [buses.map(b => b.id), data.desde, data.hasta])).rows;
  const stops = (await client.query(`SELECT *,fecha::text AS fecha FROM bus_paradas WHERE bus_id=ANY($1::int[])
    AND fecha BETWEEN $2 AND $3`, [buses.map(b => b.id), data.desde, data.hasta])).rows;
  const history = (await client.query(`SELECT a.*, u.nombre AS autor, pv.fecha_viaje::text AS fecha_viaje, pv.frecuencia_id
    FROM auditoria_hojas_ruta a JOIN usuarios u ON u.id=a.usuario_id
    JOIN programacion_viajes pv ON pv.id=a.programacion_id
    WHERE pv.frecuencia_id=ANY($1::int[]) AND pv.fecha_viaje BETWEEN $2 AND $3 ORDER BY a.id DESC LIMIT 50`,
  [frequencies.map(f => f.id), data.desde, data.hasta])).rows;
  return { fechas: dates, buses, frecuencias: frequencies, viajes: trips, ocupaciones: busy, paradas: stops, historial: history, grupo: context.rows[0] };
}

async function moveTickets(client, tripId, busId) {
  const missing = await client.query(`SELECT d.id FROM detalle_boletos d
    JOIN reservas r ON r.id=d.reserva_id JOIN asientos a ON a.id=d.asiento_id
    LEFT JOIN asientos nuevo ON nuevo.bus_id=$2 AND nuevo.numero_asiento=a.numero_asiento
      AND nuevo.categoria=a.categoria AND nuevo.activo=TRUE
      AND nuevo.numero_asiento <= (SELECT capacidad FROM buses WHERE id=$2)
    WHERE r.programacion_id=$1 AND (nuevo.id IS NULL OR d.validado_en_puerta=TRUE) LIMIT 1`, [tripId, busId]);
  if (missing.rows.length) throw planningError('El reemplazo debe conservar número y categoría de todos los asientos; no puede haber pasajeros abordados.', 409);
  await client.query(`UPDATE detalle_boletos d SET asiento_id=nuevo.id
    FROM reservas r, asientos anterior, asientos nuevo
    WHERE d.reserva_id=r.id AND r.programacion_id=$1 AND anterior.id=d.asiento_id
      AND nuevo.bus_id=$2 AND nuevo.numero_asiento=anterior.numero_asiento
      AND nuevo.categoria=anterior.categoria AND nuevo.activo=TRUE`, [tripId, busId]);
}

async function saveMatrix(client, cooperativeId, userId, data) {
  const dates = dateRange(data.desde, data.hasta);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
  if (!Array.isArray(data.asignaciones) || !data.asignaciones.length || data.asignaciones.length > 620) {
    throw planningError('Envía entre 1 y 620 asignaciones.');
  }
  if (typeof data.motivo !== 'string' || data.motivo.trim().length < 3 || data.motivo.trim().length > 300) {
    throw planningError('Registra el motivo del cambio (entre 3 y 300 caracteres).');
  }
  // Bloquear los mismos registros utilizados por las ventas antes de consultar boletos.
  await client.query(`SELECT pv.id FROM programacion_viajes pv JOIN frecuencias f ON f.id=pv.frecuencia_id
    WHERE f.cooperativa_id=$1 AND pv.fecha_viaje BETWEEN $2 AND $3 ORDER BY pv.id FOR NO KEY UPDATE OF pv`,
  [cooperativeId, data.desde, data.hasta]);
  const current = await matrix(client, cooperativeId, data);
  const seen = new Set();
  const changes = [];
  for (const input of data.asignaciones) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw planningError('Cada asignación debe ser un objeto válido.');
    const frequencyId = positiveId(input.frecuencia_id);
    const date = input.fecha;
    const busId = input.bus_id === null ? null : positiveId(input.bus_id, 'Bus');
    if (!dates.includes(date) || date < today) throw planningError('Las asignaciones deben corresponder al rango y a una fecha presente o futura.');
    if (!current.frecuencias.some(f => f.id === frequencyId)) throw planningError('Frecuencia ajena al grupo.', 403);
    const key = `${frequencyId}:${date}`;
    if (seen.has(key)) throw planningError('Hay celdas repetidas en la solicitud.');
    seen.add(key);
    const matches = current.viajes.filter(v => v.frecuencia_id === frequencyId && v.fecha_viaje === date);
    if (matches.length > 1) throw planningError('Existen varios viajes para esta frecuencia y fecha; revisa la programación existente.', 409);
    const previous = matches[0];
    if (previous?.grupo_buses_id && previous.grupo_buses_id !== current.grupo.id) {
      throw planningError('La frecuencia ya está programada desde otro grupo de buses.', 409);
    }
    if ((previous?.bus_id || null) === busId) continue; // Reintento ya aplicado.
    if (previous && (input.programacion_id !== previous.id || input.version !== previous.version)) {
      throw planningError('La matriz cambió. Recarga antes de guardar.', 409);
    }
    if (!previous && (input.programacion_id != null || input.version != null)) throw planningError('La asignación cambió. Recarga la matriz.', 409);
    if (previous && previous.estado !== 'PROGRAMADO') throw planningError('Solo se puede editar un viaje PROGRAMADO.', 409);
    if (busId && !current.buses.some(b => b.id === busId && b.estado !== 'MANTENIMIENTO')) {
      throw planningError('El bus debe pertenecer al grupo y estar disponible.', 409);
    }
    if (busId && current.paradas.some(p => p.bus_id === busId && p.fecha === date && p.motivo === 'AVERIA')) {
      throw planningError('La unidad está en parada por avería en esa fecha.', 409);
    }
    if (!busId && previous) {
      const reserved = await client.query(`SELECT r.id FROM reservas r WHERE r.programacion_id=$1 AND ${occupiedReservation} LIMIT 1`, [previous.id]);
      if (reserved.rows.length) throw planningError('El viaje tiene reservas vigentes; reemplaza el bus en lugar de retirar la asignación.', 409);
    }
    changes.push({ input, previous, busId, date, frequencyId });
  }
  if (!changes.length) return { actualizados: 0 };

  const previousIds = changes.map(change => change.previous?.id).filter(Boolean);
  const finalBusy = current.ocupaciones.filter(v => !previousIds.includes(v.id));
  finalBusy.push(...changes.filter(c => c.busId).map(c => ({ bus_id: c.busId, fecha_viaje: c.date })));
  const markedBroken = changes.filter(c => c.previous && c.busId && c.input.averia === true);
  for (const change of changes) {
    if (change.busId && finalBusy.filter(v => v.bus_id === change.busId && v.fecha_viaje === change.date).length > 1) {
      throw planningError('Una unidad no puede cubrir dos frecuencias el mismo día en la matriz.', 409);
    }
    if (markedBroken.some(c => c.date === change.date && c.previous.bus_id === change.busId)) {
      throw planningError('Una unidad marcada con avería no puede quedar asignada a otra ruta ese día.', 409);
    }
  }
  for (const date of new Set(changes.map(c => c.date))) {
    const reserve = current.buses.filter(b => b.estado !== 'MANTENIMIENTO'
      && !current.paradas.some(p => p.bus_id === b.id && p.fecha === date && p.motivo === 'AVERIA')
      && !finalBusy.some(v => v.bus_id === b.id && v.fecha_viaje === date)
      && !markedBroken.some(c => c.previous.bus_id === b.id && c.date === date));
    // En avería puede consumirse una de las dos reservas operativas.
    const hasBreakdown = markedBroken.some(c => c.date === date) || current.paradas.some(p => p.fecha === date && p.motivo === 'AVERIA');
    if (reserve.length < (hasBreakdown ? 1 : 2)) {
      throw planningError('La programación necesita dos unidades de reserva; un reemplazo por avería debe conservar al menos una.', 409);
    }
  }

  // Liberar las claves bus/fecha/hora dentro de la transacción para permitir
  // intercambios de dos unidades sin colisionar con la restricción existente.
  if (previousIds.length) await client.query('UPDATE programacion_viajes SET bus_id=NULL WHERE id=ANY($1::int[])', [previousIds]);
  for (const change of changes) {
    const { previous, busId, date, frequencyId } = change;
    let tripId = previous?.id;
    if (previous) {
      if (busId) await moveTickets(client, tripId, busId);
      await client.query(`UPDATE programacion_viajes SET bus_id=$2, estado=$3, grupo_buses_id=$4,version=version+1
        WHERE id=$1`, [tripId, busId || previous.bus_id, busId ? 'PROGRAMADO' : 'CANCELADO', current.grupo.id]);
    } else {
      const frequency = current.frecuencias.find(f => f.id === frequencyId);
      tripId = (await client.query(`INSERT INTO programacion_viajes(frecuencia_id,bus_id,fecha_viaje,hora_salida_programada,grupo_buses_id)
        VALUES($1,$2,$3,$4,$5) RETURNING id`, [frequencyId, busId, date, frequency.hora_salida, current.grupo.id])).rows[0].id;
    }
    await client.query(`INSERT INTO auditoria_hojas_ruta(programacion_id,usuario_id,bus_anterior_id,bus_nuevo_id,motivo)
      VALUES($1,$2,$3,$4,$5)`, [tripId, userId, previous?.bus_id || null, busId, data.motivo.trim()]);
    if (previous && busId && change.input.averia === true) {
      await client.query(`INSERT INTO bus_paradas(bus_id,fecha,motivo,detalle,usuario_id) VALUES($1,$2,'AVERIA',$3,$4)
        ON CONFLICT(bus_id,fecha) DO UPDATE SET motivo='AVERIA',detalle=EXCLUDED.detalle,usuario_id=EXCLUDED.usuario_id`,
      [previous.bus_id, date, data.motivo.trim(), userId]);
    }
  }
  for (const date of new Set(changes.map(c => c.date))) {
    for (const bus of current.buses) {
      if (finalBusy.some(v => v.bus_id === bus.id && v.fecha_viaje === date)) {
        await client.query(`DELETE FROM bus_paradas WHERE bus_id=$1 AND fecha=$2 AND motivo='DESCANSO'`, [bus.id, date]);
      } else {
        await client.query(`INSERT INTO bus_paradas(bus_id,fecha,motivo,usuario_id) VALUES($1,$2,'DESCANSO',$3)
          ON CONFLICT DO NOTHING`, [bus.id, date, userId]);
      }
    }
  }
  return { actualizados: changes.length };
}

module.exports = { catalog, createGroup, linkGroups, createBranch, matrix, saveMatrix };
