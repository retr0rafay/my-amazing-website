/**
 * Rafay Bot — anime-style portrait + CSS moods (cyan / water theme).
 * Moods: idle | thinking | preparing | speaking (jaw/lip motion when speaking).
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
      <div className="rafay-bot-avatar__figure">
        <img
          className="rafay-bot-avatar__img"
          src="/rafay-bot-mascot.png"
          alt=""
          width={200}
          height={200}
          decoding="async"
        />
        {speaking ? (
          <img
            className="rafay-bot-avatar__jaw"
            src="/rafay-bot-mascot.png"
            alt=""
            width={200}
            height={200}
            decoding="async"
            aria-hidden
          />
        ) : null}
      </div>
      {subtitle ? (
        <p className="rafay-bot-avatar__caption" title={subtitle}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
