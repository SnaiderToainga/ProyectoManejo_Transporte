import { useId, useState } from 'react';
import { MapPin } from 'lucide-react';
import { normalize } from '../lib/format.js';

export default function CantonAutocomplete({ name, label, value, options, onChange, placeholder }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = options.filter(option => normalize(option).includes(normalize(value))).slice(0, 8);
  const expanded = open && suggestions.length > 0;
  const choose = option => {
    onChange({ target: { name, value: option } });
    setOpen(false); setActive(-1);
  };
  const keyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return;
      event.preventDefault(); setOpen(true);
      setActive(previous => event.key === 'ArrowDown'
        ? (previous + 1) % suggestions.length
        : (previous <= 0 ? suggestions.length - 1 : previous - 1));
    } else if (event.key === 'Enter' && expanded && active >= 0 && suggestions[active]) {
      event.preventDefault(); choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault(); setOpen(false); setActive(-1);
    }
  };

  return <div className="canton-field">
    <label htmlFor={id}><span><MapPin size={15} /> {label}</span></label>
    <input id={id} name={name} role="combobox" autoComplete="off" aria-autocomplete="list"
      aria-expanded={expanded} aria-controls={`${id}-options`}
      aria-activedescendant={expanded && active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined}
      value={value} maxLength={80} placeholder={placeholder}
      onChange={event => { onChange(event); setOpen(true); setActive(-1); }}
      onFocus={() => { setOpen(true); setActive(-1); }} onBlur={() => setOpen(false)} onKeyDown={keyDown} />
    {expanded && <ul id={`${id}-options`} role="listbox" aria-label={`Sugerencias de ${label.toLowerCase()}`} className="canton-options">
      {suggestions.map((option, index) => <li key={option} id={`${id}-option-${index}`} role="option"
        aria-selected={active === index} onPointerDown={event => event.preventDefault()}
        onClick={() => choose(option)}>{option}</li>)}
    </ul>}
  </div>;
}
