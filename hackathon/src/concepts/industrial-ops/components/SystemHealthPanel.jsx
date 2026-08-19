import { useConcept } from '../../useConcept'
import { useDashboardViewModel } from '../../data/useDashboardViewModel'
import { useFreshness } from '../useFreshness'
import { SensorHealth } from '../../domain/SensorHealth'

// [ SYSTEM HEALTH ] — moved out of OPS in Phase A3.1 and into Configuration.
//
// The operations screen is for handling what is happening in the perimeter;
// which subsystem answered last is a diagnostics question and belongs with the
// other diagnostics. Nothing about the panel's content changed in the move.
//
// One source of truth, deliberately: this renders the SAME <SensorHealth> the
// OPS screen rendered, fed by the SAME useDashboardViewModel + useFreshness that
// fed it there. There is no second health engine, no second set of rules, and no
// place for the two to disagree — because there is only one.
//
// On polling: this component is mounted only while the SYSTEM HEALTH tab is
// open, and the OPS dashboard is a different route, so its view model is not
// mounted at the same time. Opening the tab therefore starts one poll cycle, not
// a second one, and closing it stops that cycle again.

export function SystemHealthPanel() {
  const { t } = useConcept()
  const vm = useDashboardViewModel()
  const fresh = useFreshness(vm, { forcedDemo: vm.demo?.demo === 'forced' })

  return (
    <div className="io2-health-tab">
      <h2 className="io2-panel-title" dir="ltr">[ SYSTEM HEALTH ]</h2>
      {/* States what the reader is looking at before they read a single row:
          where the figures come from, and whether this is live or a narrative. */}
      <p className="io2-panel-note" dir="ltr">
        {t('LIVE SUBSYSTEM STATE — READ ONLY', 'מצב תת־מערכות חי — לקריאה בלבד')}
        {' · '}
        <span className={`io2-health-data io2-health-data--${fresh.dataTone}`}>{fresh.dataState}</span>
        {fresh.lastSuccessLabel ? (
          <>
            {' · '}
            <bdi dir="ltr">RX {fresh.lastSuccessLabel}</bdi>
            {fresh.backendAgeLabel ? <bdi dir="ltr"> (+{fresh.backendAgeLabel})</bdi> : null}
          </>
        ) : null}
      </p>

      <SensorHealth
        snapshot={vm.snapshot}
        sensor={vm.sensor}
        fresh={fresh}
        backendStatus={vm.backendStatus}
      />

      {/* Coverage is a separate judgement from the data link and says so. A
          backend that answers is not proof that anything is being watched. */}
      <div className={`io2-health-coverage io2-health-coverage--${fresh.systemTone}`} dir="ltr">
        <span className="io2-health-coverage-label">{t('COVERAGE', 'כיסוי')}</span>
        <span className="io2-health-coverage-state">{fresh.systemState}</span>
        {fresh.faults.length ? (
          <span className="io2-health-coverage-faults">
            {fresh.faults.map((f) => f.label).join(' · ')}
          </span>
        ) : null}
      </div>
    </div>
  )
}
