import { useEffect } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Suspense } from 'react'
import AdminRoute from '../components/AdminRoute'
import { CONCEPTS } from './registry'
import { ConceptProvider } from './ConceptContext'
import { DensityProvider } from './DensityProvider'
import { LAST_CONCEPT_KEY } from './concept-context'
import {
  DashboardPage,
  MonitoringPage,
  InvestigationPage,
  AboutPage,
  SettingsPage,
  AdminPage,
} from './pages'
import '../design-lab/shared/motion-tokens.css'
import '../design-lab/design-lab-base.css'
import './concepts-base.css'

function ShellFallback() {
  return <div className="cs-view-fallback" dir="ltr">Loading concept…</div>
}

function ShellRoute() {
  const { conceptId } = useParams()
  const concept = CONCEPTS[conceptId]

  useEffect(() => {
    if (!concept) return
    try {
      localStorage.setItem(LAST_CONCEPT_KEY, concept.id)
    } catch {
      // ignore
    }
  }, [concept])

  if (!concept) return <Navigate to="/design-lab" replace />

  return (
    <ConceptProvider key={concept.id} concept={concept}>
      <DensityProvider conceptId={concept.id}>
        <Suspense fallback={<ShellFallback />}>
          <concept.Shell />
        </Suspense>
      </DensityProvider>
    </ConceptProvider>
  )
}

function RedirectToLast() {
  let last = 'minimal'
  try {
    const stored = localStorage.getItem(LAST_CONCEPT_KEY)
    if (stored && CONCEPTS[stored]) last = stored
  } catch {
    // ignore
  }
  return <Navigate to={`${last}/dashboard`} replace />
}

// Mounted at /concepts/* — the whole experiment environment is one lazy chunk.
export default function ConceptsApp() {
  return (
    <Routes>
      <Route index element={<RedirectToLast />} />
      <Route path=":conceptId" element={<ShellRoute />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="camera" element={<Navigate to="1" replace />} />
        <Route path="camera/:roomId" element={<MonitoringPage />} />
        <Route path="history" element={<InvestigationPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
