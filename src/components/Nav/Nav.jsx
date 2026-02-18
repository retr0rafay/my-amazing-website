import { NavLink } from 'react-router-dom'
import './Nav.css'

export default function Nav() {
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
      </div>
    </nav>
  )
}
