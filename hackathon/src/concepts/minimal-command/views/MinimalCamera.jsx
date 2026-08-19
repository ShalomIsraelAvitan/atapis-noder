import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { SystemMode } from '../../domain/SystemMode'
import { RiskSummary } from '../../domain/RiskSummary'
import { RadarPlot } from '../../domain/RadarPlot'
import { TargetsTable } from '../../domain/TargetsTable'
import { TracksTable } from '../../domain/TracksTable'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { ContactPairCard } from '../../domain/ContactPairCard'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

export default function MinimalCamera({ vm }) {
  const { t } = useConcept()

  return (
    <div className="mn-page mn-camera">
      <header className="mn-camera-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <h1 className="mn-title">{t('Camera room', 'חדר מצלמה')} <span className="mn-muted" dir="ltr">#{vm.roomId}</span></h1>
        </div>
        <SystemMode snapshot={vm.snapshot} showContext={false} className="mn-camera-mode" />
      </header>

      <div className="mn-camera-grid">
        <section className="mn-camera-main" aria-label={t('Live feed', 'זרם חי')}>
          <div className="mn-source-row" dir="ltr">
            <div className="mn-source-tabs" role="tablist" aria-label="Camera source">
              {['webcam', 'dahua'].map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={vm.source === name}
                  className={vm.source === name ? 'is-active' : ''}
                  onClick={() => vm.setSource(name)}
                >
                  {name === 'webcam' ? 'Local' : 'Dahua'}
                </button>
              ))}
            </div>
            <span className="mn-muted">
              {vm.camera.personCount > 0
                ? `${vm.camera.personCount} person(s) in frame`
                : t('No person in frame', 'אין אדם בפריים')}
            </span>
          </div>
          <CameraFeed source={vm.source} active cameraStatus={vm.camera} isDemo={vm.isDemo} />
          <div className="mn-card">
            <h2 className="dm-subtitle">{t('Tracked persons', 'אנשים במעקב')}</h2>
            <TracksTable snapshot={vm.snapshot} />
          </div>
        </section>

        <aside className="mn-camera-side">
          <div className="mn-card">
            <RiskSummary snapshot={vm.snapshot} />
          </div>
          {vm.selectedPair ? (
            <div className="mn-card">
              <div className="mn-card-head">
                <h2 className="dm-subtitle">{t('Selected contact', 'מגע נבחר')}</h2>
                <button type="button" className="dm-btn" onClick={() => vm.setSelectedTargetId(null)}>
                  {t('Close', 'סגירה')}
                </button>
              </div>
              <ContactPairCard pair={vm.selectedPair} />
            </div>
          ) : null}
          <div className="mn-card">
            <div className="mn-card-head">
              <h2 className="dm-subtitle">{t('Radar', 'רדאר')}</h2>
              <span className="mn-muted" dir="ltr">{vm.snapshot.radar.status}</span>
            </div>
            <RadarPlot
              radar={vm.snapshot.radar}
              variant="arcs"
              selectedId={vm.selectedTargetId}
              onSelect={vm.setSelectedTargetId}
            />
            <TargetsTable
              radar={vm.snapshot.radar}
              variant="cards"
              selectedId={vm.selectedTargetId}
              onSelect={vm.setSelectedTargetId}
            />
          </div>
          <div className="mn-card">
            <h2 className="dm-subtitle">{t('Alerts', 'התראות')}</h2>
            <OpenAlerts alerts={vm.alerts} limit={6} variant="compact" />
          </div>
        </aside>
      </div>
    </div>
  )
}
