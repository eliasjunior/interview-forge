import { NavLink } from 'react-router-dom'

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img className="navbar-logo" src="/favicon.svg" alt="interview-forge logo" />
        <span className="navbar-title">interview-forge</span>
      </div>
      <div className="navbar-links">
        <NavLink
          to="/topics"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Topics
        </NavLink>
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
          to="/progress"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Progress
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
