import { Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar'
import SessionsPage from './pages/SessionsPage'
import ReportPage from './pages/ReportPage'
import GraphPage from './pages/GraphPage'

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/sessions" replace />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<ReportPage />} />
          <Route path="/graph" element={<GraphPage />} />
        </Routes>
      </main>
    </div>
  )
}
