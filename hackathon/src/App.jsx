import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Rooms from './pages/Rooms'
import CameraRoom from './pages/CameraRoom'
import History from './pages/History'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import './App.css'

// Design Lab (design comparison environment) — lazy loaded so it adds zero
// weight to the active dashboard bundle. Heavy 3D code loads only on entry.
const DesignLabHome = lazy(() => import('./design-lab/DesignLabHome'))
const MinimalCommand = lazy(() => import('./design-lab/concepts/minimal-command/MinimalCommand'))
const Sentinel3D = lazy(() => import('./design-lab/concepts/sentinel-3d/Sentinel3D'))
const IndustrialOps = lazy(() => import('./design-lab/concepts/industrial-ops/IndustrialOps'))
const NeuralFusion = lazy(() => import('./design-lab/concepts/neural-fusion/NeuralFusion'))
const CompareCenter = lazy(() => import('./design-lab/CompareCenter'))

const labFallback = (
  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
    Loading Design Lab…
  </div>
)

const lab = (element) => (
  <ProtectedRoute>
    <Suspense fallback={labFallback}>{element}</Suspense>
  </ProtectedRoute>
)

// Full-site concept experiences (5 complete product experiences) — one lazy
// chunk mounting its own nested routes under /concepts/:conceptId/*.
const ConceptsApp = lazy(() => import('./concepts/ConceptsApp'))

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="app-container">
            <Navbar />
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/rooms"
              element={
                <ProtectedRoute>
                  <Rooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/camera/:roomId"
              element={
                <ProtectedRoute>
                  <CameraRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="/design-lab" element={lab(<DesignLabHome />)} />
            <Route path="/design-lab/compare" element={lab(<CompareCenter />)} />
            <Route path="/design-lab/minimal-command" element={lab(<MinimalCommand />)} />
            <Route path="/design-lab/sentinel-3d" element={lab(<Sentinel3D />)} />
            <Route path="/design-lab/industrial-ops" element={lab(<IndustrialOps />)} />
            <Route path="/design-lab/neural-fusion" element={lab(<NeuralFusion />)} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            <Route
              path="/concepts/*"
              element={
                <ProtectedRoute>
                  <Suspense fallback={labFallback}>
                    <ConceptsApp />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
