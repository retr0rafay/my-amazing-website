import './AgentIntegrations.css'

/** Brand hex for Simple Icons CDN (no #). Tesla / Firebase / Google use Simple Icons defaults; Anthropic & ElevenLabs use lighter tints (SI uses near-black) so marks read on dark UI. */
const INTEGRATIONS = [
  { name: 'Anthropic', slug: 'anthropic', href: 'https://www.anthropic.com/', color: 'D97757' },
  { name: 'ElevenLabs', slug: 'elevenlabs', href: 'https://elevenlabs.io/', color: 'FF375F' },
  { name: 'Tesla Fleet', slug: 'tesla', href: 'https://developer.tesla.com/docs/fleet-api', color: 'CC0000' },
  { name: 'Firebase', slug: 'firebase', href: 'https://firebase.google.com/', color: 'DD2C00' },
  { name: 'Google', slug: 'google', href: 'https://developers.google.com/identity', color: '4285F4' },
]

export default function AgentIntegrations({ className = '' }) {
  return (
    <div className={`agent-integrations${className ? ` ${className}` : ''}`}>
      <p className="agent-integrations__label">Integrations</p>
      <ul className="agent-integrations__list">
        {INTEGRATIONS.map(({ name, slug, href, color }) => (
          <li key={slug} className="agent-integrations__item">
            <a
              href={href}
              className="agent-integrations__link"
              target="_blank"
              rel="noopener noreferrer"
              title={name}
            >
              <img
                className="agent-integrations__logo"
                src={`https://cdn.simpleicons.org/${slug}/${color}`}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                decoding="async"
              />
              <span className="agent-integrations__name">{name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
