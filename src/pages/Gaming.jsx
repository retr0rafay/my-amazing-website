import { useEffect, useState } from 'react'
import SEO from '../components/SEO/SEO'
import './Gaming.css'

export default function Gaming() {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/gaming')
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      })
      .then((res) => {
        if (!cancelled) setGames(res.games || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <main className="gaming page">
      <SEO
        title="Gaming"
        description="Recently played PlayStation games and playtime."
        path="/gaming"
      />
      <div className="gaming__inner">
        <header className="gaming__header">
          <h1 className="gaming__title">Gaming</h1>
          <p className="gaming__subtitle">// recently playing</p>
        </header>

        {loading && (
          <div className="gaming__state gaming__state--loading">
            <div className="gaming__loader" aria-hidden />
            <p>Loading from PlayStation…</p>
          </div>
        )}

        {error && !loading && (
          <div className="gaming__state gaming__state--error">
            <p>Couldn’t load games. Make sure PSN is configured on the server.</p>
          </div>
        )}

        {!loading && !error && games && games.length > 0 && (
          <ul className="gaming__grid">
            {games.map((game, i) => (
              <li key={game.name + i} className="gaming__card" style={{ '--i': i }}>
                <div className="gaming__card-cover-wrap">
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl}
                      alt=""
                      className="gaming__card-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="gaming__card-cover gaming__card-cover--placeholder" />
                  )}
                  <div className="gaming__card-glow" />
                </div>
                <div className="gaming__card-info">
                  <h2 className="gaming__card-title">{game.name}</h2>
                  <p className="gaming__card-hours">
                    <span className="gaming__card-hours-value">{game.hoursLabel}</span>
                    <span className="gaming__card-hours-label">played</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && games && games.length === 0 && (
          <div className="gaming__state gaming__state--empty">
            <p>No recent games to show.</p>
          </div>
        )}
      </div>
    </main>
  )
}
