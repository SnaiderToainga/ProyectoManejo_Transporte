import { supportChannels } from '../lib/supportChannels.js';

// Canales de atención y redes sociales configurados por la cooperativa (CR-14).
export default function SupportChannels({ cooperative, title = 'Atención al cliente', compact = false }) {
  const channels = supportChannels(cooperative || {});
  if (!channels.length) return null;
  return <div className={`support-channels${compact ? ' compact' : ''}`}>
    {title && <strong>{title}</strong>}
    <ul>
      {channels.map(channel => <li key={channel.key}>
        <a href={channel.href} {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{channel.label}</a>
      </li>)}
    </ul>
  </div>;
}
