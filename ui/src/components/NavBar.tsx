import { NavLink } from 'react-router-dom'

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">🎙</span>
        <span className="navbar-title">Mock Interview</span>
      </div>
      <div className="navbar-links">
        <NavLink
          to="/sessions"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Sessions
        </NavLink>
        <NavLink
          to="/graph"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Knowledge Graph
        </NavLink>
        <NavLink
          to="/flashcards"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Flashcards 🃏
        </NavLink>
        <NavLink
          to="/mistakes"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Mistake Log
        </NavLink>
      </div>
    </nav>
  )
}
