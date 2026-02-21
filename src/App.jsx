import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import TeamSelection from './pages/TeamSelection'
import Predictions from './pages/Predictions'
import Calendar from './pages/Calendar'
import Leagues from './pages/Leagues'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import RaceOverview from './pages/RaceOverview'
import PlayerOverview from './pages/PlayerOverview'
import RaceResults from './pages/RaceResults'
import ScoringRules from './pages/ScoringRules'
import ResultsOverview from './pages/ResultsOverview'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()
    if (loading) return <div className="loading"><div className="spinner"></div></div>
    if (!user) return <Navigate to="/login" />
    return children
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="team/:raceId" element={<TeamSelection />} />
                <Route path="predictions/:raceId" element={<Predictions />} />
                <Route path="race/:raceId" element={<RaceOverview />} />
                <Route path="results/:raceId/player/:userId" element={<PlayerOverview />} />
                <Route path="results/:raceId" element={<RaceResults />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="history" element={<ResultsOverview />} />
                <Route path="rules" element={<ScoringRules />} />
                <Route path="leagues" element={<Leagues />} />
                <Route path="profile" element={<Profile />} />
                <Route path="admin" element={<AdminDashboard />} />
            </Route>
        </Routes>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    )
}
