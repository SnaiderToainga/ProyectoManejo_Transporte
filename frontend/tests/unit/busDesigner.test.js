import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_BUS_TEMPLATES,
  adjustCapacityPreservingLayout,
  applyCellOperation,
  applyFirstRowBus17,
  buildInitialDesign,
  deleteEmptyRow,
  moveOrSwapCell,
  sanitizeDesign,
  switchDesignFloors
} from '../../src/lib/busLayoutEngine.js';

test('Diseñador Bus: eliminar asiento solitario en última fila lo borra sin recorrer ni crear bloques fantasma', () => {
  // Estándar 40 tiene el asiento #40 solo en la fila 11 col 1 (por el baño en fila 10 col 4)
  const initial = buildInitialDesign(BUILTIN_BUS_TEMPLATES[0]);
  const lastSeat = initial.asientos.find((s) => s.numero_asiento === 40);
  assert.equal(lastSeat.fila_piso, 11);
  assert.equal(lastSeat.columna, 1);

  const { design: afterDelete } = applyCellOperation(initial, {
    tool: 'borrar',
    piso: 1,
    fila: 11,
    columna: 1,
    autoCompensate: true
  });

  assert.equal(afterDelete.capacidad, 39);
  assert.equal(afterDelete.asientos.length, 39);
  // No debe recorrer el asiento a fila 11 col 2 ni dejar celdas BLOQUEADO fantasma
  assert.equal(afterDelete.asientos.some((s) => s.fila_piso === 11), false);
  assert.equal(afterDelete.celdasBloqueadas.length, 0);

  // Clic con borrar en celda vacía no hace nada
  const { design: afterEmptyClick } = applyCellOperation(afterDelete, {
    tool: 'borrar',
    piso: 1,
    fila: 11,
    columna: 2,
    autoCompensate: true
  });
  assert.equal(afterEmptyClick.capacidad, 39);
  assert.equal(afterEmptyClick.celdasBloqueadas.length, 0);
});

test('Diseñador Bus: colocar Baño WC o Fila 1 (BUS-17) compensa solo los desplazados conservando VIPs', () => {
  const initial = buildInitialDesign(BUILTIN_BUS_TEMPLATES[1]); // 41 continuo
  const { design: afterBath } = applyCellOperation(initial, {
    tool: 'bano',
    piso: 1,
    fila: 2,
    columna: 4,
    autoCompensate: true
  });
  assert.equal(afterBath.capacidad, 41);
  assert.equal(afterBath.celdasBano.length, 1);
  assert.equal(afterBath.asientos.filter((s) => s.categoria === 'VIP').length, 4);

  const { design: afterRow1, displacedCount } = applyFirstRowBus17(initial);
  assert.equal(displacedCount, 3);
  assert.equal(afterRow1.capacidad, 41);
  assert.equal(afterRow1.asientos.filter((s) => s.fila_piso === 1).length, 1);
  assert.equal(afterRow1.celdasBloqueadas.some((c) => c.fila === 1 && c.tipo === 'PUERTA'), true);
});

test('Diseñador Bus: agregar Normal o VIP en celda vacía, mover/intercambiar y eliminar fila vacía funcionan en sitio', () => {
  const initial = buildInitialDesign(BUILTIN_BUS_TEMPLATES[0]);
  // Agregar un Normal en fila 11 col 2 aumenta capacidad sin regenerar VIPs existentes
  const { design: added } = applyCellOperation(initial, {
    tool: 'normal',
    piso: 1,
    fila: 11,
    columna: 2,
    autoCompensate: true
  });
  assert.equal(added.capacidad, 41);
  assert.equal(added.asientos.some((s) => s.fila_piso === 11 && s.columna === 2 && s.categoria === 'NORMAL'), true);

  // Mover un asiento a una celda libre y ajustar capacidad preservando VIPs
  const { design: moved } = moveOrSwapCell(added, { piso: 1, fila: 11, columna: 2 }, { piso: 1, fila: 11, columna: 4 });
  assert.equal(moved.asientos.some((s) => s.fila_piso === 11 && s.columna === 4), true);

  const shrunk = adjustCapacityPreservingLayout(moved, 35);
  assert.equal(shrunk.capacidad, 35);
  assert.equal(shrunk.asientos.filter((s) => s.categoria === 'VIP').length, 4);

  // Vaciar una fila intermedia y eliminarla recorre hacia arriba limpiamente
  let d = buildInitialDesign({ pisos: 1, capacidad: 8, columnas: 4, celdasBano: [], celdasBloqueadas: [] });
  for (let c = 1; c <= 4; c++) {
    d = applyCellOperation(d, { tool: 'borrar', piso: 1, fila: 1, columna: c }).design;
  }
  const collapsed = deleteEmptyRow(d, 1, 1);
  assert.equal(collapsed.asientos.every((s) => s.fila_piso === 1), true);
  assert.equal(collapsed.capacidad, 4);
});

test('Diseñador Bus: pasar de Estándar 40 (4 cols) a 2 Pisos (3 cols P1) no deja baños ocultos fuera de rango', () => {
  const std40 = buildInitialDesign(BUILTIN_BUS_TEMPLATES[0]);
  assert.equal(std40.celdasBano.length, 1);
  assert.equal(std40.celdasBano[0].columna, 4);

  const twoFloors = switchDesignFloors(std40, 2);
  assert.equal(twoFloors.pisos, 2);
  assert.equal(twoFloors.columnas, 3);
  // El baño reubicado queda dentro del rango válido (col <= 3), nunca oculto en col 4
  assert.equal(twoFloors.celdasBano.length, 1);
  assert.equal(twoFloors.celdasBano[0].columna <= 3, true);

  // Agregar un segundo baño en Piso 2 cuenta exactamente 2 WC (jamás 3)
  const { design: withSecondBath } = applyCellOperation(twoFloors, {
    tool: 'bano',
    piso: 2,
    fila: 8,
    columna: 4,
    autoCompensate: true
  });
  assert.equal(withSecondBath.celdasBano.length, 2);

  // sanitizeDesign también descarta baños fuera de columna o duplicados si llegan de estado previo
  const dirty = {
    ...withSecondBath,
    celdasBano: [
      ...withSecondBath.celdasBano,
      { piso: 1, fila: 10, columna: 4 },
      { piso: 2, fila: 8, columna: 4 }
    ]
  };
  const clean = sanitizeDesign(dirty);
  assert.equal(clean.celdasBano.length, 2);
});
