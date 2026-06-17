import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const studyToolLinks = [
  { to: '/progress', label: 'Progress' },
  { to: '/graph', label: 'Knowledge Graph' },
  { to: '/mistakes', label: 'Mistake Log' },
  { to: '/flashcards/pending', label: 'Pending Eval' },
  { to: '/arena', label: 'Crisis Mode' },
]

export default function NavBar() {
  const [toolsOpen, setToolsOpen] = useState(false)
  const location = useLocation()
  const toolsActive = studyToolLinks.some(link => location.pathname === link.to)

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
          to="/algorithms"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Algorithms
        </NavLink>
        <NavLink
          to="/flashcards"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Flashcards 🃏
        </NavLink>
        <div
          className="nav-dropdown"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setToolsOpen(false)
          }}
        >
          <button
            type="button"
            className={`nav-link nav-dropdown-trigger${toolsActive ? ' active' : ''}`}
            aria-haspopup="menu"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen(open => !open)}
          >
            Study Tools
            <span className="nav-dropdown-caret" aria-hidden="true">▾</span>
          </button>
          {toolsOpen && (
            <div className="nav-dropdown-menu" role="menu">
              {studyToolLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  role="menuitem"
                  className={({ isActive }) => `nav-dropdown-item${isActive ? ' active' : ''}`}
                  onClick={() => setToolsOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
