import { Routes, Route } from 'react-router-dom'
import { Header, Footer } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ReportPage } from './pages/ReportPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { StartPage } from './pages/StartPage'
import { ProfilePage } from './pages/ProfilePage'

export default function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/start" element={<StartPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      <Footer />
    </div>
  )
}
