import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
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
  const ownerEmails = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_EMAILS), [])
  const ownerUids = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_UIDS), [])

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
      <div className="nav__inner">
        <NavLink
          to="/"
          className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
          end
        >
          Home
        </NavLink>
        <NavLink
          to="/blog"
          className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        >
          Blog
        </NavLink>
        <NavLink
          to="/my-life"
          className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        >
          My Life
        </NavLink>
        <NavLink
          to="/rafay-thoughts"
          className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        >
          Thoughts
        </NavLink>
        {showOwnerLink && (
          <NavLink
            to="/rafay-bot"
            className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
          >
            Rafay Bot
          </NavLink>
        )}
      </div>
    </nav>
  )
}
