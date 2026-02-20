import { Outlet } from 'react-router-dom'
import SEO from '../SEO/SEO'
import Nav from '../Nav'
import ThemeToggle from '../ThemeToggle'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <SEO />
      <Nav />
      <ThemeToggle />
      <div className="layout__main">
        <Outlet />
      </div>
    </div>
  )
}
