import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './Nav.css'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  return (
    <nav className="nav" aria-label="Main navigation">
      {menuOpen && (
        <div
          className="nav__backdrop"
          aria-hidden
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="nav__inner">
        <button
          type="button"
          className={`nav__menu-btn${menuOpen ? ' nav__menu-btn--open' : ''}`}
          aria-expanded={menuOpen}
          aria-controls="nav-primary-links"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="nav__menu-bar" aria-hidden />
          <span className="nav__menu-bar" aria-hidden />
          <span className="nav__menu-bar" aria-hidden />
        </button>
        <div
          id="nav-primary-links"
          className={`nav__links${menuOpen ? ' nav__links--open' : ''}`}
        >
          <NavLink
            to="/"
            className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            end
            onClick={() => setMenuOpen(false)}
          >
            Home
          </NavLink>
          <NavLink
            to="/blog"
            className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Blog
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
