import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import SessionsPage from './pages/SessionsPage'
import ReportPage from './pages/ReportPage'
import GraphPage from './pages/GraphPage'
import FlashcardsPage from './pages/FlashcardsPage'
import PendingFlashcardAnswersPage from './pages/PendingFlashcardAnswersPage'
import MistakesPage from './pages/MistakesPage'
import TopicsPage from './pages/TopicsPage'
import ProgressPage from './pages/ProgressPage'
import ForgeArenaPage from './pages/ForgeArenaPage'

export default function App() {
  const location = useLocation()
  const isGraph = location.pathname === '/graph'

  return (
    <div className="app">
      <NavBar />
      <main className={isGraph ? 'graph-main' : 'main-content'}>
        <Routes>
          <Route path="/" element={<Navigate to="/sessions" replace />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<ReportPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/flashcards/pending" element={<PendingFlashcardAnswersPage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/arena" element={<ForgeArenaPage />} />
        </Routes>
      </main>
    </div>
  )
}
