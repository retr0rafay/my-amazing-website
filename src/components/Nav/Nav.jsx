import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import './Nav.css'

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export default function Nav() {
  const [showOwnerLink, setShowOwnerLink] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const ownerEmails = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_EMAILS), [])
  const ownerUids = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_UIDS), [])

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setShowOwnerLink(false)
        return
      }
      const ok =
        (u.email && ownerEmails.includes(u.email.toLowerCase())) ||
        (u.uid && ownerUids.includes(u.uid.toLowerCase()))
      setShowOwnerLink(ok)
    })
    return () => unsub()
  }, [ownerEmails, ownerUids])

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
          <NavLink
            to="/my-life"
            className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            My Life
          </NavLink>
          <NavLink
            to="/workouts"
            className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Workouts
          </NavLink>
          <NavLink
            to="/rafay-thoughts"
            className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Thoughts
          </NavLink>
          {showOwnerLink && (
            <NavLink
              to="/rafay-bot"
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              Rafay Bot
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  )
}
