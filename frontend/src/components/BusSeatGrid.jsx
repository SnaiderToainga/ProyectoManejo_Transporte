import { Armchair, CircleSlash, CircleGauge, Bath, Crown, DoorOpen, ArrowUpDown } from 'lucide-react';
import {
  aisleAfterColumn,
  gridColumnForLogical,
  isAvailable,
  isLargeSeat,
  seatCategory,
  seatPosition,
  uniqueSeats
} from '../lib/seats.js';

export function SeatLegend({ hasTwoFloors = false }) {
  return (
    <div className="seat-legend" aria-label="Leyenda de asientos">
      <span><i className="legend-free" />Disponible</span>
      <span><i className="legend-vip" />VIP (Más amplio)</span>
      <span><i className="legend-selected" />Tu selección</span>
      <span><i className="legend-occupied" />Ocupado</span>
      <span><i className="legend-wc" />Baño WC</span>
      {hasTwoFloors && <span><i className="legend-stairs" />Escalera / Puerta</span>}
    </div>
  );
}

function buildGridTemplateColumns(cols, aisleAfter, wideVipFloor = false) {
  const parts = [];
  for (let c = 1; c <= cols; c++) {
    // En distribuciones 2+1 o pisos VIP damos mayor anchura a las columnas de asiento
    parts.push(wideVipFloor ? 'minmax(58px, 1.25fr)' : 'minmax(48px, 1fr)');
    if (c === aisleAfter) {
      parts.push('minmax(22px, 0.48fr)');
    }
  }
  return parts.join(' ');
}

function renderFloor({
  piso,
  totalFloors,
  floorSeats,
  cols,
  aisleAfter,
  baths,
  blocked,
  capacity,
  tieneBanoPosterior,
  selected,
  category,
  disabled,
  onToggle,
  legacyMode
}) {
  const hasAnyLarge = floorSeats.some(isLargeSeat);
  const wideVipFloor = cols === 3 || (totalFloors === 2 && piso === 1 && hasAnyLarge);

  const occupiedCoords = new Set();
  for (const s of floorSeats) {
    const pos = seatPosition(s.numero_asiento, s, aisleAfter);
    occupiedCoords.add(`${pos.gridRow}-${pos.gridColumn}`);
  }

  // Baño legado SOLO si no hay celdasBano explícitas y el asiento 40 NO ocupa (10, 5)
  const shouldRenderLegacyBath =
    baths.length === 0 &&
    piso === 1 &&
    (tieneBanoPosterior === true || (tieneBanoPosterior !== false && Number(capacity) === 40)) &&
    !occupiedCoords.has('10-5');

  const maxSeatRow = floorSeats.reduce((m, s) => {
    const r = Number(s.fila_piso || s.fila || seatPosition(s.numero_asiento, s, aisleAfter).gridRow);
    return Math.max(m, r);
  }, 0);
  const maxSpecialRow = [...baths, ...blocked].reduce((m, c) => Math.max(m, Number(c.fila || 0)), 0);
  const totalRows = Math.max(maxSeatRow, maxSpecialRow, legacyMode ? 10 : 1);

  return (
    <div key={`floor-${piso}`} className={`bus-outline ${totalFloors === 2 ? 'bus-outline-floor' : ''} ${cols === 3 ? 'bus-outline-wide-vip' : ''}`}>
      <div className="bus-front">
        <CircleGauge size={22} />
        <span>
          {totalFloors === 2
            ? (piso === 1 ? 'PISO 1 · SALÓN INFERIOR' : 'PISO 2 · PANORÁMICO')
            : 'FRENTE DEL BUS'}
        </span>
        {totalFloors === 2 && (
          <strong className="floor-pill">{floorSeats.length} plazas</strong>
        )}
      </div>

      <div
        className="seat-grid seat-grid-dynamic"
        role="group"
        aria-label={totalFloors === 2 ? `Piso ${piso} (${floorSeats.length} asientos)` : `Bus de ${capacity || floorSeats.length} asientos`}
        style={{
          gridTemplateColumns: buildGridTemplateColumns(cols, aisleAfter, wideVipFloor),
          gridTemplateRows: `repeat(${totalRows}, minmax(52px, auto))`
        }}
      >
        {floorSeats.map((seat) => {
          const number = seat.numero_asiento;
          const available = isAvailable(seat);
          const vip = seatCategory(seat) === 'VIP';
          const large = isLargeSeat(seat);
          const chosen = Boolean(seat.asiento_id) && selected.includes(seat.asiento_id);
          const excluded = Boolean(category && seatCategory(seat) !== category);
          const description = !seat.asiento_id ? 'sin información' : !available ? 'ocupado' : excluded ? 'fuera del filtro' : 'disponible';

          return (
            <button
              type="button"
              key={`seat-${piso}-${number}`}
              style={seatPosition(number, seat, aisleAfter)}
              className={`seat ${vip ? 'vip' : ''} ${large ? 'seat-large' : ''} ${!available ? 'occupied' : ''} ${chosen ? 'selected' : ''} ${excluded ? 'excluded' : ''}`}
              disabled={disabled || !available || excluded}
              aria-pressed={chosen}
              aria-label={`Asiento ${number}, ${vip ? 'VIP amplio' : 'normal'}${totalFloors === 2 ? `, piso ${piso}` : ''}, ${chosen ? 'seleccionado' : description}`}
              onClick={() => onToggle?.(seat)}
            >
              {!available ? (
                <CircleSlash size={16} />
              ) : vip ? (
                <span className="seat-vip-head">
                  <Crown size={12} />
                  <Armchair size={large ? 22 : 19} />
                </span>
              ) : (
                <Armchair size={19} />
              )}
              <span className="seat-num">{number}</span>
              {large && vip && <span className="seat-tag-vip">VIP</span>}
            </button>
          );
        })}

        {baths.map((bath, idx) => (
          <div
            key={`wc-${piso}-${idx}`}
            className="bus-bathroom"
            style={{ gridRow: Number(bath.fila), gridColumn: gridColumnForLogical(bath.columna, aisleAfter) }}
            aria-label="Baño WC"
          >
            <Bath size={18} />
            <span>WC</span>
          </div>
        ))}

        {blocked.map((cell, idx) => {
          const tipo = String(cell.tipo || 'BLOQUEADO').toUpperCase();
          if (tipo === 'BLOQUEADO') {
            return (
              <div
                key={`blk-${piso}-${idx}`}
                className="bus-empty-slot"
                style={{ gridRow: Number(cell.fila), gridColumn: gridColumnForLogical(cell.columna, aisleAfter) }}
                aria-hidden="true"
              />
            );
          }
          const isStairs = tipo === 'ESCALERA';
          return (
            <div
              key={`spc-${piso}-${idx}`}
              className={`bus-special-cell ${isStairs ? 'is-stairs' : 'is-door'}`}
              style={{ gridRow: Number(cell.fila), gridColumn: gridColumnForLogical(cell.columna, aisleAfter) }}
              aria-label={isStairs ? 'Escalera entre pisos' : 'Puerta de acceso'}
            >
              {isStairs ? <ArrowUpDown size={15} /> : <DoorOpen size={15} />}
              <span>{isStairs ? 'ESC' : 'PUERTA'}</span>
            </div>
          );
        })}

        {shouldRenderLegacyBath && (
          <div className="bus-bathroom" style={{ gridRow: 10, gridColumn: 5 }} aria-label="Baño posterior derecho">
            <Bath size={18} />
            <span>WC</span>
          </div>
        )}
      </div>

      <p className="bus-rear">PARTE POSTERIOR</p>
    </div>
  );
}

export default function BusSeatGrid({
  capacity,
  seats = [],
  layout = null,
  tieneBanoPosterior = undefined,
  selected = [],
  onToggle,
  category = '',
  disabled = false,
  showLegend = true
}) {
  const unique = uniqueSeats(seats);
  const resolvedLayout = layout || seats.find((s) => s?.bus_layout)?.bus_layout || null;
  const hasRealCoords = unique.some((s) => s.fila && s.columna);

  // Compatibilidad con mocks/tests legacy sin coordenadas
  const legacyMode = !hasRealCoords && !resolvedLayout;
  const normalizedSeats = legacyMode
    ? Array.from({ length: Number(capacity) > 0 ? Number(capacity) : unique.length || 40 }, (_, i) => {
        const number = i + 1;
        const found = unique.find((s) => s.numero_asiento === number);
        return found || { numero_asiento: number, estado_ocupacion: 'OCUPADO' };
      })
    : unique;

  const totalFloors = resolvedLayout?.pisos === 2 || normalizedSeats.some((s) => Number(s.piso) === 2) ? 2 : 1;
  const colsP1 = Number(resolvedLayout?.columnas) || 4;
  const colsP2 = Number(resolvedLayout?.columnas_piso2) || colsP1;
  const aisleP1 = aisleAfterColumn(colsP1, resolvedLayout?.pasillo_despues_col);
  const aisleP2 = aisleAfterColumn(colsP2, resolvedLayout?.pasillo_despues_col_piso2);

  const allBaths = Array.isArray(resolvedLayout?.celdasBano) ? resolvedLayout.celdasBano : [];
  const allBlocked = Array.isArray(resolvedLayout?.celdasBloqueadas) ? resolvedLayout.celdasBloqueadas : [];

  const floors = totalFloors === 2 ? [1, 2] : [1];

  return (
    <div>
      {showLegend && <SeatLegend hasTwoFloors={totalFloors === 2} />}
      {resolvedLayout?.plantilla_nombre && (
        <p className="bus-layout-caption">
          Estructura: <strong>{resolvedLayout.plantilla_nombre}</strong> · {totalFloors === 2 ? '2 Pisos' : '1 Piso'}
        </p>
      )}
      <div className={`bus-floors-wrapper ${totalFloors === 2 ? 'has-two-floors' : ''}`}>
        {floors.map((piso) => {
          const floorSeats = totalFloors === 2
            ? normalizedSeats.filter((s) => (Number(s.piso) === 2 ? 2 : 1) === piso)
            : normalizedSeats;
          const cols = piso === 2 ? colsP2 : colsP1;
          const aisleAfter = piso === 2 ? aisleP2 : aisleP1;
          const baths = allBaths.filter((b) => (Number(b.piso) === 2 ? 2 : 1) === piso);
          const blocked = allBlocked.filter((b) => (Number(b.piso) === 2 ? 2 : 1) === piso);

          return renderFloor({
            piso,
            totalFloors,
            floorSeats,
            cols,
            aisleAfter,
            baths,
            blocked,
            capacity,
            tieneBanoPosterior,
            selected,
            category,
            disabled,
            onToggle,
            legacyMode
          });
        })}
      </div>
    </div>
  );
}
