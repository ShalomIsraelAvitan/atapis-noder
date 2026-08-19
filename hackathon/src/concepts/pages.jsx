import { Suspense } from 'react'
import { useConcept } from './useConcept'
import { useDashboardViewModel } from './data/useDashboardViewModel'
import { useMonitoringViewModel } from './data/useMonitoringViewModel'
import { useInvestigationViewModel } from './data/useInvestigationViewModel'
import { useAboutViewModel } from './data/useAboutViewModel'
import { useSettingsViewModel } from './data/useSettingsViewModel'
import { useAdminViewModel } from './data/useAdminViewModel'

// Page containers — the single place where business view models are created.
// Concept views are pure presentation: they receive `vm` and never fetch.

function ViewFallback() {
  return <div className="cs-view-fallback" dir="ltr">Loading…</div>
}

function ConceptView({ page, vm }) {
  const { concept } = useConcept()
  const View = concept.views[page]
  return (
    <Suspense fallback={<ViewFallback />}>
      <View vm={vm} />
    </Suspense>
  )
}

export function DashboardPage() {
  const vm = useDashboardViewModel()
  return <ConceptView page="dashboard" vm={vm} />
}

export function MonitoringPage() {
  const vm = useMonitoringViewModel()
  return <ConceptView page="camera" vm={vm} />
}

export function InvestigationPage() {
  const vm = useInvestigationViewModel()
  return <ConceptView page="history" vm={vm} />
}

export function AboutPage() {
  const vm = useAboutViewModel()
  return <ConceptView page="about" vm={vm} />
}

export function SettingsPage() {
  const vm = useSettingsViewModel()
  return <ConceptView page="settings" vm={vm} />
}

export function AdminPage() {
  const vm = useAdminViewModel()
  return <ConceptView page="admin" vm={vm} />
}
