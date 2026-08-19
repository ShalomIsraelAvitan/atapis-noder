import { useConcept } from '../../useConcept'

// ALL CAMERAS is a STATUS board, not a video wall.
//
// Every mounted MJPEG <img> costs a full YOLO analysis loop on the backend
// (issue H4), so a grid of live thumbnails would multiply the inference load by
// the number of cameras. This view therefore renders zero streams: it lists what
// each camera is doing and lets the operator open exactly one.

export function AllCamerasPanel({ cameras, displayCameraId, onOpen }) {
  const { t } = useConcept()

  if (!cameras.length) {
    return <p className="io2-empty">{t('No cameras configured in this area', 'לא מוגדרות מצלמות באזור זה')}</p>
  }

  return (
    <div className="io2-allcams" data-io2-allcams>
      <p className="io2-panel-note" dir="ltr">
        {t('STATUS ONLY — NO STREAMS LOADED · ONE FEED AT A TIME',
           'סטטוס בלבד — לא נטענים זרמים · feed אחד בכל רגע')}
      </p>
      <table className="dm-table io2-allcams-table" dir="ltr" style={{ '--dm-cols': 5 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('Source', 'מקור')}</th>
            <th>{t('State', 'מצב')}</th>
            <th>{t('Last receive', 'קליטה אחרונה')}</th>
            <th>{t('Open', 'פתח')}</th>
          </tr>
        </thead>
        <tbody>
          {cameras.map((cam) => (
            <tr key={cam.id} className={cam.id === displayCameraId ? 'is-selected' : ''}>
              <td><bdi dir="ltr">{cam.id}</bdi></td>
              <td><bdi dir="ltr">{cam.sourceKey}</bdi></td>
              <td className={cam.connected ? 'dm-tone-safe' : 'dm-tone-danger'}>
                {cam.state}
                {cam.lastError ? (
                  <span className="io2-allcams-err" title={cam.lastError}>· {t('error', 'שגיאה')}</span>
                ) : null}
              </td>
              <td><bdi dir="ltr">{cam.lastFrameTime || '—'}</bdi></td>
              <td>
                <button type="button" className="io2-allcams-open" onClick={() => onOpen(cam.id)}>
                  {t('OPEN', 'פתח')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
