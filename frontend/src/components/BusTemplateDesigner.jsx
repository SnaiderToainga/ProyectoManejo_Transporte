import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  ArrowUpDown,
  Bath,
  CircleGauge,
  Crown,
  DoorOpen,
  GripVertical,
  Hash,
  Layers,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2
} from 'lucide-react';
import { aisleAfterColumn, gridColumnForLogical } from '../lib/seats.js';
import {
  BUILTIN_BUS_TEMPLATES,
  adjustCapacityPreservingLayout,
  applyCellOperation,
  applyFirstRowBus17,
  buildInitialDesign,
  coordKey,
  deleteEmptyRow,
  designToApiPayload,
  floorOf,
  generateSeatsFromDesign,
  moveOrSwapCell,
  renumberSeats,
  rowOf,
  sanitizeDesign,
  switchDesignFloors
} from '../lib/busLayoutEngine.js';

export {
  BUILTIN_BUS_TEMPLATES,
  adjustCapacityPreservingLayout,
  buildInitialDesign,
  designToApiPayload,
  generateSeatsFromDesign
};

function buildEditorGridTemplate(cols, aisleAfter, wideVipFloor) {
  const parts = ['26px'];
  for (let c = 1; c <= cols; c++) {
    parts.push(wideVipFloor ? 'minmax(60px, 1.25fr)' : 'minmax(48px, 1fr)');
    if (c === aisleAfter) parts.push('minmax(18px, 0.38fr)');
  }
  parts.push('30px');
  return parts.join(' ');
}

const TOOLS = [
  { id: 'vip', label: 'VIP Grande', hint: 'Alterna VIP ↔ Normal o crea asiento VIP en celda vacía', icon: Crown, tone: 'vip' },
  { id: 'normal', label: 'Normal', hint: 'Coloca asiento normal o quita VIP', icon: Armchair, tone: 'default' },
  { id: 'mover', label: 'Mover / Intercambiar', hint: 'Haz clic en origen y luego en destino para mover o intercambiar', icon: Move, tone: 'default' },
  { id: 'bano', label: 'Baño WC', hint: 'Coloca o quita baño (auto-compensa al final si está activo)', icon: Bath, tone: 'default' },
  { id: 'puerta', label: 'Puerta / Escalera', hint: 'Coloca acceso o escalera entre pisos', icon: DoorOpen, tone: 'default' },
  { id: 'borrar', label: 'Eliminar', hint: 'Elimina el asiento o elemento sin mover los demás', icon: Trash2, tone: 'danger' }
];

export default function BusTemplateDesigner({
  templates = BUILTIN_BUS_TEMPLATES,
  value,
  onChange,
  compact = false
}) {
  const [tool, setTool] = useState('vip');
  const [autoCompensate, setAutoCompensate] = useState(true);
  const [moveSource, setMoveSource] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [dragOverKey, setDragOverKey] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [history, setHistory] = useState([]);

  const templateList = templates && templates.length > 0 ? templates : BUILTIN_BUS_TEMPLATES;
  const design = useMemo(() => sanitizeDesign(value || buildInitialDesign(templateList[0])), [value, templateList]);

  const [capInput, setCapInput] = useState(String(design.capacidad || 40));
  const [capP1Input, setCapP1Input] = useState(String(design.capacidad_piso1 || 16));
  const noteTimerRef = useRef(null);

  useEffect(() => {
    setCapInput(String(design.capacidad || 1));
    setCapP1Input(String(design.capacidad_piso1 || 1));
  }, [design.capacidad, design.capacidad_piso1]);

  useEffect(() => {
    setMoveSource(null);
  }, [tool, design.pisos]);

  useEffect(() => () => {
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
  }, []);

  function flashNote(text) {
    setStatusNote(text || '');
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    if (text) {
      noteTimerRef.current = setTimeout(() => setStatusNote(''), 4200);
    }
  }

  function commit(nextDesign, note = '') {
    setHistory((prev) => [...prev.slice(-24), design]);
    onChange?.(nextDesign);
    if (note) flashNote(note);
  }

  function handleUndo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setMoveSource(null);
    onChange?.(previous);
    flashNote('Cambio deshecho.');
  }

  const stats = useMemo(() => {
    const seats = design.asientos || [];
    const vip = seats.filter((s) => s.categoria === 'VIP').length;
    const p1 = seats.filter((s) => floorOf(s) === 1).length;
    const p2 = seats.filter((s) => floorOf(s) === 2).length;
    return {
      total: seats.length,
      vip,
      normal: seats.length - vip,
      p1,
      p2,
      baths: (design.celdasBano || []).length,
      doors: (design.celdasBloqueadas || []).length
    };
  }, [design]);

  function applyTemplate(tplId) {
    const found = templateList.find((t) => t.id === tplId);
    if (!found) return;
    setMoveSource(null);
    commit(buildInitialDesign(found), `Plantilla "${found.nombre}" cargada.`);
  }

  function handleCapacityCommit(rawValue) {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isInteger(parsed)) {
      setCapInput(String(design.capacidad));
      return;
    }
    const clamped = Math.max(1, Math.min(100, parsed));
    setCapInput(String(clamped));
    if (clamped === design.capacidad) return;
    commit(
      adjustCapacityPreservingLayout(design, clamped),
      `Capacidad ajustada a ${clamped} asientos conservando tu diseño.`
    );
  }

  function handleP1CapacityCommit(rawValue) {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isInteger(parsed)) {
      setCapP1Input(String(design.capacidad_piso1));
      return;
    }
    const clampedP1 = Math.max(1, Math.min(Math.max(1, design.capacidad - 1), parsed));
    setCapP1Input(String(clampedP1));
    if (clampedP1 === design.capacidad_piso1) return;
    const merged = { ...design, capacidad_piso1: clampedP1 };
    const nextSeats = generateSeatsFromDesign({
      ...merged,
      asientosVip: (design.asientos || []).filter((s) => s.categoria === 'VIP').map((s) => s.numero_asiento),
      asientosGrandes: (design.asientos || []).filter((s) => s.tamano === 'GRANDE').map((s) => s.numero_asiento)
    });
    commit({
      ...merged,
      capacidad: nextSeats.length,
      capacidad_piso1: nextSeats.filter((s) => floorOf(s) === 1).length,
      asientos: nextSeats,
      extraRowsP1: 0,
      extraRowsP2: 0
    }, `Piso 1 ajustado a ${clampedP1} plazas.`);
  }

  function handleFloorsChange(nextPisos) {
    const p = Number(nextPisos) === 2 ? 2 : 1;
    if (p === design.pisos) return;
    const next = switchDesignFloors(design, p);
    commit(next, p === 2 ? 'Estructura convertida a 2 pisos.' : 'Estructura convertida a 1 piso.');
  }

  function handleColsChange(piso, rawCols) {
    const c = Math.max(2, Math.min(5, parseInt(rawCols, 10) || 4));
    const field = piso === 2 ? 'columnas_piso2' : 'columnas';
    const aisleField = piso === 2 ? 'pasillo_despues_col_piso2' : 'pasillo_despues_col';
    const cleanedBaths = (design.celdasBano || []).filter((b) => !(floorOf(b) === piso && Number(b.columna) > c));
    const cleanedBlocked = (design.celdasBloqueadas || []).filter((b) => !(floorOf(b) === piso && Number(b.columna) > c));
    const nextBase = {
      ...design,
      [field]: c,
      [aisleField]: aisleAfterColumn(c),
      celdasBano: cleanedBaths,
      celdasBloqueadas: cleanedBlocked
    };
    const seats = generateSeatsFromDesign({
      ...nextBase,
      asientosVip: (design.asientos || []).filter((s) => s.categoria === 'VIP').map((s) => s.numero_asiento),
      asientosGrandes: (design.asientos || []).filter((s) => s.tamano === 'GRANDE').map((s) => s.numero_asiento)
    });
    commit({
      ...nextBase,
      asientos: seats,
      capacidad: seats.length,
      capacidad_piso1: seats.filter((s) => floorOf(s) === 1).length,
      extraRowsP1: 0,
      extraRowsP2: 0
    }, `Distribución del piso ${piso} cambiada a ${c} columnas.`);
  }

  function handleCellClick(piso, fila, columna) {
    if (tool === 'mover') {
      const hasAnything =
        (design.asientos || []).some((s) => floorOf(s) === piso && rowOf(s) === fila && Number(s.columna) === columna) ||
        (design.celdasBano || []).some((b) => floorOf(b) === piso && Number(b.fila) === fila && Number(b.columna) === columna) ||
        (design.celdasBloqueadas || []).some((b) => floorOf(b) === piso && Number(b.fila) === fila && Number(b.columna) === columna);

      if (!moveSource) {
        if (!hasAnything) return;
        const foundSeat = (design.asientos || []).find((s) => floorOf(s) === piso && rowOf(s) === fila && Number(s.columna) === columna);
        setMoveSource({ piso, fila, columna, label: foundSeat ? `Asiento #${foundSeat.numero_asiento}` : 'Elemento' });
        return;
      }
      if (moveSource.piso === piso && moveSource.fila === fila && moveSource.columna === columna) {
        setMoveSource(null);
        return;
      }
      const { design: nextDesign, note } = moveOrSwapCell(design, moveSource, { piso, fila, columna });
      setMoveSource(null);
      commit(nextDesign, note);
      return;
    }

    const { design: nextDesign, note } = applyCellOperation(design, {
      tool,
      piso,
      fila,
      columna,
      autoCompensate
    });
    if (nextDesign !== design) {
      commit(nextDesign, note);
    } else if (note) {
      flashNote(note);
    }
  }

  function handleToggleRowVip(piso, fila) {
    const seats = [...(design.asientos || [])];
    const rowSeats = seats.filter((s) => floorOf(s) === piso && rowOf(s) === fila);
    if (!rowSeats.length) return;
    const allVip = rowSeats.every((s) => s.categoria === 'VIP');
    const nextSeats = seats.map((s) => (
      floorOf(s) === piso && rowOf(s) === fila
        ? { ...s, categoria: allVip ? 'NORMAL' : 'VIP', tamano: allVip ? 'NORMAL' : 'GRANDE' }
        : s
    ));
    commit(
      { ...design, asientos: nextSeats },
      `Fila ${fila} marcada como ${allVip ? 'Normal' : 'VIP Grande'}.`
    );
  }

  function handleDeleteEmptyRow(piso, fila) {
    const next = deleteEmptyRow(design, piso, fila);
    if (next !== design) {
      commit(next, `Fila vacía F${fila} eliminada.`);
    }
  }

  function handleFirstRowDemo() {
    const { design: nextDesign, displacedCount } = applyFirstRowBus17(design);
    commit(
      nextDesign,
      `Fila 1 configurada con 1 asiento + puerta · ${displacedCount} plaza(s) compensadas al final (total: ${nextDesign.capacidad}).`
    );
  }

  const floors = design.pisos === 2 ? [1, 2] : [1];
  const activeToolObj = TOOLS.find((t) => t.id === tool) || TOOLS[0];

  return (
    <div className={`bus-designer ${compact ? 'is-compact' : ''}`}>
      {/* Barra superior: plantilla base + pisos + capacidad + columnas */}
      <div className="bus-designer-controls">
        <label className="designer-template-select">
          <span>Plantilla base del bus</span>
          <select
            value={templateList.some((t) => t.id === design.plantilla_id) ? design.plantilla_id : ''}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="" disabled>Estructura personalizada</option>
            {templateList.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="designer-segmented" role="group" aria-label="Cantidad de pisos">
          <button
            type="button"
            className={design.pisos === 1 ? 'is-active' : ''}
            onClick={() => handleFloorsChange(1)}
          >
            <Layers size={14} /> 1 Piso
          </button>
          <button
            type="button"
            className={design.pisos === 2 ? 'is-active' : ''}
            onClick={() => handleFloorsChange(2)}
          >
            <Layers size={14} /> 2 Pisos
          </button>
        </div>

        <div className="designer-mini-field">
          <label className="designer-field-caption" htmlFor="designer-cap-input">Total asientos</label>
          <div className="designer-stepper">
            <button
              type="button"
              aria-label="Restar un asiento"
              disabled={design.capacidad <= 1}
              onClick={() => handleCapacityCommit(design.capacidad - 1)}
            >
              <Minus size={14} />
            </button>
            <input
              id="designer-cap-input"
              type="number"
              min={1}
              max={100}
              value={capInput}
              onChange={(e) => {
                setCapInput(e.target.value);
                const parsed = parseInt(e.target.value, 10);
                if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 && parsed !== design.capacidad) {
                  commit(adjustCapacityPreservingLayout(design, parsed));
                }
              }}
              onBlur={() => handleCapacityCommit(capInput)}
            />
            <button
              type="button"
              aria-label="Sumar un asiento"
              disabled={design.capacidad >= 100}
              onClick={() => handleCapacityCommit(design.capacidad + 1)}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {design.pisos === 2 && (
          <label className="designer-mini-field">
            <span>Plazas Piso 1</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, design.capacidad - 1)}
              value={capP1Input}
              onChange={(e) => setCapP1Input(e.target.value)}
              onBlur={() => handleP1CapacityCommit(capP1Input)}
            />
          </label>
        )}

        <label className="designer-mini-field">
          <span>{design.pisos === 2 ? 'Cols. Piso 1' : 'Distribución'}</span>
          <select value={design.columnas} onChange={(e) => handleColsChange(1, e.target.value)}>
            <option value={3}>2+1 (VIP Grande · 3 cols)</option>
            <option value={4}>2+2 (Clásico · 4 cols)</option>
            <option value={5}>2+3 (Alta cap. · 5 cols)</option>
          </select>
        </label>

        {design.pisos === 2 && (
          <label className="designer-mini-field">
            <span>Cols. Piso 2</span>
            <select value={design.columnas_piso2} onChange={(e) => handleColsChange(2, e.target.value)}>
              <option value={3}>2+1 (VIP Grande · 3 cols)</option>
              <option value={4}>2+2 (Clásico · 4 cols)</option>
              <option value={5}>2+3 (Alta cap. · 5 cols)</option>
            </select>
          </label>
        )}
      </div>

      {/* Paleta de herramientas de edición */}
      <div className="bus-designer-toolbar">
        <div className="designer-tools-row" role="group" aria-label="Herramientas de diseño">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`designer-tool-btn ${tool === t.id ? `is-active is-${t.tone}` : ''}`}
                title={t.hint}
                onClick={() => setTool(t.id)}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="designer-quick-actions">
          <label className="designer-checkbox" title="Al colocar un baño o puerta sobre un asiento, mueve ese asiento al final para no perder capacidad">
            <input
              type="checkbox"
              checked={autoCompensate}
              onChange={(e) => setAutoCompensate(e.target.checked)}
            />
            <span>Auto-compensar al colocar WC/Puerta (BUS-17)</span>
          </label>
          <button type="button" className="designer-link-btn" onClick={handleFirstRowDemo} title="Deja 1 asiento en la fila 1 + puerta y compensa los demás al final">
            <Sparkles size={14} /> Fila 1 (1 asiento)
          </button>
          <button
            type="button"
            className="designer-link-btn"
            onClick={() => commit({ ...design, asientos: renumberSeats(design.asientos || []) }, 'Asientos renumerados del 1 al final.')}
            title="Ordena los números 1..N desde el frente hacia atrás"
          >
            <Hash size={14} /> Renumerar
          </button>
          <button
            type="button"
            className="designer-link-btn"
            disabled={!history.length}
            onClick={handleUndo}
            title="Deshacer último cambio"
          >
            <Undo2 size={14} /> Deshacer
          </button>
          <button
            type="button"
            className="designer-link-btn"
            onClick={() => applyTemplate(design.plantilla_id || templateList[0].id)}
          >
            <RotateCcw size={14} /> Restablecer
          </button>
        </div>
      </div>

      {/* Guía dinámica de la herramienta activa + métricas */}
      <div className="designer-helper-strip">
        <div className="bus-designer-stats">
          <span className="designer-stat"><strong>{stats.total}</strong> asientos</span>
          <span className="designer-stat is-vip"><Crown size={13} /> <strong>{stats.vip}</strong> VIP Grandes</span>
          <span className="designer-stat"><strong>{stats.normal}</strong> Normales</span>
          <span className="designer-stat"><Bath size={13} /> <strong>{stats.baths}</strong> WC</span>
          {stats.doors > 0 && (
            <span className="designer-stat is-comp"><DoorOpen size={13} /> <strong>{stats.doors}</strong> Puerta/Esc</span>
          )}
        </div>
        <span className="designer-tool-hint">
          <GripVertical size={13} /> {activeToolObj.hint} · También puedes <strong>arrastrar y soltar</strong> cualquier asiento o baño.
        </span>
      </div>

      {statusNote && (
        <p className="designer-status-toast" role="status">{statusNote}</p>
      )}

      {tool === 'mover' && (
        <p className="designer-move-banner" role="status">
          {moveSource
            ? `${moveSource.label} seleccionado (Piso ${moveSource.piso}, Fila ${moveSource.fila}). Haz clic en otra celda o asiento para moverlo/intercambiarlo.`
            : 'Modo Mover activo: haz clic en un asiento o elemento y luego en su destino (o arrástralo directamente).'}
        </p>
      )}

      {/* Lienzo interactivo por piso */}
      <div className={`bus-floors-wrapper ${design.pisos === 2 ? 'has-two-floors' : ''}`}>
        {floors.map((piso) => {
          const cols = piso === 2 ? design.columnas_piso2 : design.columnas;
          const aisleAfter = aisleAfterColumn(cols, piso === 2 ? design.pasillo_despues_col_piso2 : design.pasillo_despues_col);
          const floorSeats = (design.asientos || []).filter((s) => floorOf(s) === piso);
          const floorBaths = (design.celdasBano || []).filter((b) => floorOf(b) === piso);
          const floorBlocked = (design.celdasBloqueadas || []).filter((b) => floorOf(b) === piso);

          const usedMaxRow = Math.max(
            ...floorSeats.map((s) => rowOf(s)),
            ...floorBaths.map((b) => Number(b.fila || 1)),
            ...floorBlocked.map((b) => Number(b.fila || 1)),
            1
          );
          const extraKey = piso === 2 ? 'extraRowsP2' : 'extraRowsP1';
          const extraRows = design[extraKey] || 0;
          const maxRow = Math.min(40, usedMaxRow + extraRows);

          const seatMap = new Map(floorSeats.map((s) => [coordKey(piso, rowOf(s), Number(s.columna)), s]));
          const bathMap = new Map(floorBaths.map((b) => [coordKey(piso, Number(b.fila), Number(b.columna)), b]));
          const blkMap = new Map(floorBlocked.map((b) => [coordKey(piso, Number(b.fila), Number(b.columna)), b]));

          const wideVipFloor = cols === 3 || (design.pisos === 2 && piso === 1 && floorSeats.some((s) => s.tamano === 'GRANDE'));
          const rightActionCol = cols + 3;

          const cells = [];
          for (let r = 1; r <= maxRow; r++) {
            const rowHasSeats = floorSeats.some((s) => rowOf(s) === r);
            const rowIsEmpty =
              !rowHasSeats &&
              !floorBaths.some((b) => Number(b.fila) === r) &&
              !floorBlocked.some((b) => Number(b.fila) === r);
            const rowAllVip = rowHasSeats && floorSeats.filter((s) => rowOf(s) === r).every((s) => s.categoria === 'VIP');

            cells.push(
              <span
                key={`row-label-${piso}-${r}`}
                className="designer-row-tag"
                style={{ gridRow: r, gridColumn: 1 }}
              >
                F{r}
              </span>
            );

            for (let c = 1; c <= cols; c++) {
              const key = coordKey(piso, r, c);
              const seat = seatMap.get(key);
              const bath = bathMap.get(key);
              const blk = blkMap.get(key);
              const isMoveOrigin = moveSource && moveSource.piso === piso && moveSource.fila === r && moveSource.columna === c;
              const isDragOver = dragOverKey === key;
              const gridCol = gridColumnForLogical(c, aisleAfter) + 1;
              const style = { gridRow: r, gridColumn: gridCol };

              const dragHandlers = {
                onDragOver: (e) => {
                  e.preventDefault();
                  if (dragOverKey !== key) setDragOverKey(key);
                },
                onDragLeave: () => {
                  if (dragOverKey === key) setDragOverKey('');
                },
                onDrop: (e) => {
                  e.preventDefault();
                  setDragOverKey('');
                  if (!dragSource) return;
                  const { design: nextDesign, note } = moveOrSwapCell(design, dragSource, { piso, fila: r, columna: c });
                  setDragSource(null);
                  if (nextDesign !== design) commit(nextDesign, note);
                }
              };

              if (seat) {
                const isVip = seat.categoria === 'VIP';
                const isLarge = seat.tamano === 'GRANDE';
                cells.push(
                  <button
                    key={key}
                    type="button"
                    draggable
                    style={style}
                    className={`seat designer-cell ${isVip ? 'vip' : ''} ${isLarge ? 'seat-large' : ''} ${isMoveOrigin ? 'is-move-origin' : ''} ${isDragOver ? 'is-drag-over' : ''} ${tool === 'borrar' ? 'is-delete-cursor' : ''}`}
                    onDragStart={() => setDragSource({ piso, fila: r, columna: c })}
                    onDragEnd={() => { setDragSource(null); setDragOverKey(''); }}
                    {...dragHandlers}
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`Asiento #${seat.numero_asiento} (${isVip ? 'VIP Grande' : 'Normal'}) · Fila ${r}, Col ${c} · Arrastra para mover`}
                  >
                    {isVip ? (
                      <span className="seat-vip-head">
                        <Crown size={12} />
                        <Armchair size={isLarge ? 22 : 19} />
                      </span>
                    ) : (
                      <Armchair size={18} />
                    )}
                    <span className="seat-num">{seat.numero_asiento}</span>
                    {isVip && isLarge && <span className="seat-tag-vip">VIP</span>}
                  </button>
                );
              } else if (bath) {
                cells.push(
                  <button
                    key={key}
                    type="button"
                    draggable
                    style={style}
                    className={`bus-bathroom designer-cell ${isMoveOrigin ? 'is-move-origin' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                    onDragStart={() => setDragSource({ piso, fila: r, columna: c })}
                    onDragEnd={() => { setDragSource(null); setDragOverKey(''); }}
                    {...dragHandlers}
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`Baño WC (Fila ${r}, Col ${c}) · Clic para editar o arrastra para mover`}
                  >
                    <Bath size={18} />
                    <span>WC</span>
                  </button>
                );
              } else if (blk) {
                const isStairs = blk.tipo === 'ESCALERA';
                cells.push(
                  <button
                    key={key}
                    type="button"
                    draggable
                    style={style}
                    className={`bus-special-cell designer-cell ${isStairs ? 'is-stairs' : 'is-door'} ${isMoveOrigin ? 'is-move-origin' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                    onDragStart={() => setDragSource({ piso, fila: r, columna: c })}
                    onDragEnd={() => { setDragSource(null); setDragOverKey(''); }}
                    {...dragHandlers}
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`${isStairs ? 'Escalera' : 'Puerta'} (Fila ${r}, Col ${c}) · Clic para editar o arrastra para mover`}
                  >
                    {isStairs ? <ArrowUpDown size={15} /> : <DoorOpen size={15} />}
                    <span>{isStairs ? 'ESC' : 'PUERTA'}</span>
                  </button>
                );
              } else {
                cells.push(
                  <button
                    key={key}
                    type="button"
                    style={style}
                    className={`designer-empty-cell ${isDragOver ? 'is-drag-over' : ''}`}
                    {...dragHandlers}
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`Espacio vacío (Fila ${r}, Col ${c}) · Clic para colocar ${activeToolObj.label}`}
                  >
                    <span>+</span>
                  </button>
                );
              }
            }

            cells.push(
              rowHasSeats ? (
                <button
                  key={`row-act-${piso}-${r}`}
                  type="button"
                  className={`designer-row-btn ${rowAllVip ? 'is-vip-on' : ''}`}
                  style={{ gridRow: r, gridColumn: rightActionCol }}
                  onClick={() => handleToggleRowVip(piso, r)}
                  title={rowAllVip ? `Convertir toda la fila ${r} a Normal` : `Marcar toda la fila ${r} como VIP Grande`}
                >
                  <Crown size={12} />
                </button>
              ) : rowIsEmpty && maxRow > 1 ? (
                <button
                  key={`row-del-${piso}-${r}`}
                  type="button"
                  className="designer-row-btn is-del"
                  style={{ gridRow: r, gridColumn: rightActionCol }}
                  onClick={() => handleDeleteEmptyRow(piso, r)}
                  title={`Eliminar fila vacía F${r}`}
                >
                  <Trash2 size={12} />
                </button>
              ) : (
                <span key={`row-sp-${piso}-${r}`} style={{ gridRow: r, gridColumn: rightActionCol }} />
              )
            );
          }

          return (
            <div key={`editor-floor-${piso}`} className={`bus-outline bus-outline-editor ${cols === 3 ? 'bus-outline-wide-vip' : ''}`}>
              <div className="bus-front">
                <CircleGauge size={20} />
                <span>
                  {design.pisos === 2
                    ? (piso === 1 ? 'PISO 1 · SALÓN INFERIOR' : 'PISO 2 · PANORÁMICO')
                    : 'FRENTE DEL BUS'}
                </span>
                <strong className="floor-pill">{floorSeats.length} plazas</strong>
              </div>

              <div
                className="seat-grid seat-grid-dynamic"
                style={{
                  gridTemplateColumns: buildEditorGridTemplate(cols, aisleAfter, wideVipFloor),
                  gridTemplateRows: `repeat(${maxRow}, minmax(54px, auto))`
                }}
              >
                {cells}
              </div>

              <div className="designer-floor-footer">
                <span className="bus-rear" style={{ margin: 0 }}>PARTE POSTERIOR</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {extraRows > 0 && (
                    <button
                      type="button"
                      className="designer-add-row-btn is-remove"
                      onClick={() => onChange?.({ ...design, [extraKey]: Math.max(0, extraRows - 1) })}
                    >
                      <Minus size={13} /> Quitar fila
                    </button>
                  )}
                  <button
                    type="button"
                    className="designer-add-row-btn"
                    onClick={() => onChange?.({ ...design, [extraKey]: extraRows + 1 })}
                  >
                    <Plus size={13} /> Fila
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
