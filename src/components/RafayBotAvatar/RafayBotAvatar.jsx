/**
 * Stylized assistant “orb” — SVG + CSS only, matches site cyan/water theme.
 * Moods: idle | thinking | preparing | speaking (mouth animates when speaking).
 */
import './RafayBotAvatar.css'

export default function RafayBotAvatar({ mood, subtitle }) {
  const speaking = mood === 'speaking'
  const thinking = mood === 'thinking'
  const preparing = mood === 'preparing'

  return (
    <div
      className={`rafay-bot-avatar${speaking ? ' rafay-bot-avatar--speaking' : ''}${thinking ? ' rafay-bot-avatar--thinking' : ''}${preparing ? ' rafay-bot-avatar--preparing' : ''}`}
      aria-hidden="true"
    >
      <div className="rafay-bot-avatar__glow" />
      <svg className="rafay-bot-avatar__svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rafay-bot-avatar-face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--persona-cyan, #22d3ee)" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--persona-blue-bright, #2563eb)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--persona-blue, #1e3a5f)" stopOpacity="0.9" />
          </linearGradient>
          <filter id="rafay-bot-avatar-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="rafay-bot-avatar__orbit-spin" transform="translate(100 100)">
          <circle
            className="rafay-bot-avatar__orbit"
            r="88"
            fill="none"
            stroke="var(--persona-accent, #22d3ee)"
            strokeWidth="1.5"
            strokeOpacity="0.35"
          />
          <circle
            className="rafay-bot-avatar__orbit--inner"
            r="76"
            fill="none"
            stroke="var(--persona-accent, #22d3ee)"
            strokeWidth="0.75"
            strokeOpacity="0.2"
          />
        </g>
        {/* Face disc */}
        <circle cx="100" cy="100" r="64" fill="url(#rafay-bot-avatar-face)" filter="url(#rafay-bot-avatar-soft)" />
        <ellipse cx="100" cy="100" rx="58" ry="58" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {/* Eyes */}
        <ellipse className="rafay-bot-avatar__eye rafay-bot-avatar__eye--l" cx="78" cy="88" rx="10" ry="12" fill="rgba(10,14,20,0.85)" />
        <ellipse className="rafay-bot-avatar__eye rafay-bot-avatar__eye--r" cx="122" cy="88" rx="10" ry="12" fill="rgba(10,14,20,0.85)" />
        <ellipse cx="78" cy="86" rx="3" ry="4" fill="rgba(255,255,255,0.35)" />
        <ellipse cx="122" cy="86" rx="3" ry="4" fill="rgba(255,255,255,0.35)" />
        {/* Mouth — scales when speaking */}
        <rect
          className="rafay-bot-avatar__mouth"
          x="86"
          y="118"
          width="28"
          height="10"
          rx="5"
          fill="rgba(10,14,20,0.75)"
        />
        {/* Cheek accents */}
        <ellipse cx="62" cy="108" rx="8" ry="5" fill="var(--persona-cyan, #22d3ee)" fillOpacity="0.15" />
        <ellipse cx="138" cy="108" rx="8" ry="5" fill="var(--persona-cyan, #22d3ee)" fillOpacity="0.15" />
      </svg>
      {subtitle ? (
        <p className="rafay-bot-avatar__caption" title={subtitle}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
