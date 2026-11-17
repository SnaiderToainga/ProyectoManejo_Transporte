import { Armchair, CircleSlash, CircleGauge, Bath } from 'lucide-react';
import { isAvailable, seatCategory, seatPosition, uniqueSeats } from '../lib/seats.js';

export function SeatLegend() {
  return (
    <div className="seat-legend" aria-label="Leyenda de asientos">
      <span><i className="legend-free" />Disponible</span>
      <span><i className="legend-vip" />VIP</span>
      <span><i className="legend-selected" />Tu selección</span>
      <span><i className="legend-occupied" />Ocupado</span>
    </div>
  );
}

export default function BusSeatGrid({ capacity, seats, selected = [], onToggle, category = '', disabled = false, showLegend = true }) {
  const byNumber = new Map(uniqueSeats(seats).map(seat => [seat.numero_asiento, seat]));
  const totalSeats = Number(capacity) > 0 ? Number(capacity) : byNumber.size || 40;

  return (
    <div>
      {showLegend && <SeatLegend />}
      <div className="bus-outline">
        <div className="bus-front">
          <CircleGauge size={24} />
          <span>FRENTE DEL BUS</span>
        </div>
        <div className="seat-grid" role="group" aria-label={`Bus de ${totalSeats} asientos`}>
          {Array.from({ length: totalSeats }, (_, i) => {
            const number = i + 1;
            const seat = byNumber.get(number);
            const available = isAvailable(seat);
            const vip = seat && seatCategory(seat) === 'VIP';
            const chosen = seat && selected.includes(seat.asiento_id);
            const excluded = category && seat && seatCategory(seat) !== category;
            const description = !seat ? 'sin información' : !available ? 'ocupado' : excluded ? 'fuera del filtro' : 'disponible';

            return (
              <button
                type="button"
                key={number}
                style={seatPosition(number, seat)}
                className={`seat ${vip ? 'vip' : ''} ${!available ? 'occupied' : ''} ${chosen ? 'selected' : ''} ${excluded ? 'excluded' : ''}`}
                disabled={disabled || !available || Boolean(excluded)}
                aria-pressed={Boolean(chosen)}
                aria-label={`Asiento ${number}, ${vip ? 'VIP' : 'normal'}, ${chosen ? 'seleccionado' : description}`}
                onClick={() => onToggle(seat)}
              >
                {!available ? <CircleSlash size={16} /> : <Armchair size={20} />}
                <span>{number}</span>
              </button>
            );
          })}
          {Number(capacity) === 40 && (
            <div className="bus-bathroom" style={{ gridRow: 10, gridColumn: 5 }} aria-label="Baño posterior derecho">
              <Bath size={18} />
              <span>WC</span>
            </div>
          )}
        </div>
        <p className="bus-rear">PARTE POSTERIOR</p>
      </div>
    </div>
  );
}

