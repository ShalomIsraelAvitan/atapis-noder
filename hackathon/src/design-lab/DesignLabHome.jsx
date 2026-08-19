import { Link } from 'react-router-dom'
import DesignLabLayout from './DesignLabLayout'
import { useAtapisData } from './shared/useAtapisData'
import { useLab } from './shared/useLab'
import { ModeBadge, StatusDot } from './shared/status-primitives'
import { backendDotState } from './shared/adapter'
import './DesignLabHome.css'

// Static schematic previews only — no live camera feeds, MJPEG streams or 3D
// scenes are mounted on this screen (each of those costs backend analysis or GPU).
function PreviewMinimal() {
  return (
    <svg viewBox="0 0 200 120" className="dlh-preview-svg" aria-hidden="true">
      <rect x="0" y="0" width="200" height="120" fill="#0c0c0e" />
      <text x="16" y="26" fill="#e8e8ec" fontSize="13" fontWeight="700" fontFamily="sans-serif">SAFE</text>
      <rect x="16" y="38" width="110" height="62" rx="3" fill="#151518" stroke="#2c2c31" />
      <rect x="58" y="52" width="16" height="34" fill="none" stroke="#34c76f" strokeWidth="1.5" />
      <rect x="138" y="38" width="46" height="62" rx="3" fill="#111114" stroke="#2c2c31" />
      <circle cx="161" cy="84" r="2.5" fill="#34c76f" />
      <line x1="138" y1="72" x2="184" y2="72" stroke="#232328" />
      <line x1="138" y1="56" x2="184" y2="56" stroke="#232328" />
    </svg>
  )
}

function PreviewSentinel() {
  return (
    <svg viewBox="0 0 200 120" className="dlh-preview-svg" aria-hidden="true">
      <rect x="0" y="0" width="200" height="120" fill="#06080c" />
      <polygon points="30,100 170,100 140,52 60,52" fill="#0b1220" stroke="#1d3050" />
      <line x1="60" y1="70" x2="140" y2="70" stroke="#3d5a86" strokeDasharray="4 3" />
      <ellipse cx="100" cy="86" rx="42" ry="10" fill="none" stroke="#1d3050" />
      <ellipse cx="100" cy="86" rx="24" ry="6" fill="none" stroke="#274266" />
      <polygon points="100,86 78,56 122,56" fill="#12305a" opacity="0.5" />
      <circle cx="112" cy="66" r="3.5" fill="#f5a623" />
      <rect x="97" y="42" width="6" height="12" fill="#3d5a86" />
    </svg>
  )
}

function PreviewIndustrial() {
  return (
    <svg viewBox="0 0 200 120" className="dlh-preview-svg" aria-hidden="true">
      <rect x="0" y="0" width="200" height="120" fill="#0a0a0a" />
      <rect x="0" y="0" width="200" height="16" fill="#1c1c1c" />
      <rect x="6" y="4" width="34" height="8" fill="#e61919" />
      <text x="46" y="11" fill="#8a8a8a" fontSize="7" fontFamily="monospace">SYS MODE ALERT</text>
      <line x1="88" y1="16" x2="88" y2="120" stroke="#3a3a3a" />
      <rect x="8" y="26" width="70" height="48" fill="none" stroke="#3a3a3a" />
      <rect x="37" y="44" width="6" height="6" fill="#f5a623" />
      <text x="47" y="51" fill="#8a8a8a" fontSize="6" fontFamily="monospace">T1</text>
      <line x1="8" y1="84" x2="78" y2="84" stroke="#3a3a3a" />
      <line x1="8" y1="94" x2="78" y2="94" stroke="#3a3a3a" />
      <line x1="8" y1="104" x2="78" y2="104" stroke="#3a3a3a" />
      <rect x="96" y="26" width="96" height="56" fill="#141414" stroke="#3a3a3a" />
      <text x="100" y="38" fill="#34c76f" fontSize="6" fontFamily="monospace">[ OPTICAL ]</text>
      <rect x="96" y="92" width="96" height="10" fill="#1c1c1c" />
      <rect x="96" y="92" width="20" height="10" fill="#e61919" />
    </svg>
  )
}

function PreviewNeural() {
  return (
    <svg viewBox="0 0 200 120" className="dlh-preview-svg" aria-hidden="true">
      <rect x="0" y="0" width="200" height="120" fill="#090812" />
      <circle cx="100" cy="60" r="44" fill="none" stroke="#2a2450" />
      <circle cx="100" cy="60" r="30" fill="none" stroke="#352c66" />
      <rect x="82" y="46" width="36" height="28" rx="3" fill="#141126" stroke="#453a82" />
      <path d="M32 30 Q 60 45 82 55" fill="none" stroke="#6a5acd" strokeDasharray="5 4" />
      <path d="M32 92 Q 60 78 82 66" fill="none" stroke="#6a5acd" strokeDasharray="5 4" />
      <circle cx="32" cy="30" r="6" fill="#141126" stroke="#6a5acd" />
      <circle cx="32" cy="92" r="6" fill="#141126" stroke="#6a5acd" />
      <circle cx="132" cy="41" r="3" fill="#f5a623" />
      <text x="152" y="66" fill="#8f7ff0" fontSize="11" fontFamily="monospace">58</text>
    </svg>
  )
}

const CARDS = [
  {
    slug: 'minimal-command',
    name: 'Minimal Command',
    Preview: PreviewMinimal,
    desc: ['Clean, focused command view. Camera first, restrained color, strong typography.',
      'תצוגת פיקוד נקייה וממוקדת. המצלמה במרכז, צבע מרוסן, טיפוגרפיה חזקה.'],
    traits: ['Typography-led', 'Color = risk only', 'Single screen'],
    animation: ['Subtle', 'עדינה'],
    density: ['Low', 'נמוכה'],
    uses3d: false,
  },
  {
    slug: 'sentinel-3d',
    name: 'Sentinel 3D',
    Preview: PreviewSentinel,
    desc: ['Abstract 3D digital twin of the perimeter: fence, gate, radar cone and live targets in space.',
      'תאום דיגיטלי תלת־ממדי מופשט של ההיקף: גדר, שער, קונוס רדאר ומטרות חיות במרחב.'],
    traits: ['Digital twin', 'Overview / Focus camera', 'HUD panels'],
    animation: ['Spatial', 'מרחבית'],
    density: ['Medium', 'בינונית'],
    uses3d: true,
  },
  {
    slug: 'industrial-ops',
    name: 'Industrial Ops',
    Preview: PreviewIndustrial,
    desc: ['Dense tactical command center: hard grid, mono type, target table, event timeline.',
      'מרכז שליטה טקטי צפוף: grid קשיח, טיפוגרפיית mono, טבלת מטרות ו־timeline אירועים.'],
    traits: ['High density', 'Tables + timeline', 'Sharp motion'],
    animation: ['Minimal / sharp', 'מינימלית/חדה'],
    density: ['High', 'גבוהה'],
    uses3d: false,
  },
  {
    slug: 'neural-fusion',
    name: 'Neural Fusion',
    Preview: PreviewNeural,
    desc: ['Layered fusion view: data flows from camera + radar into one risk decision, with a threat narrative.',
      'תצוגת היתוך שכבתית: נתונים זורמים ממצלמה ורדאר להחלטת סיכון אחת, עם נרטיב איום.'],
    traits: ['Fusion story', 'Why this risk?', 'Target focus mode'],
    animation: ['Cinematic', 'קולנועית'],
    density: ['Adaptive', 'מסתגלת'],
    uses3d: false,
  },
]

const COMPARISON = [
  {
    slug: 'minimal-command',
    pros: ['Fastest to read at a glance', 'Investor / judge friendly', 'Cheapest to maintain'],
    prosHe: ['הכי מהיר לקריאה במבט', 'ידידותי לשופטים ומשקיעים', 'הכי זול לתחזוקה'],
    cons: ['Least information per screen', 'No target table'],
    consHe: ['הכי מעט מידע למסך', 'אין טבלת מטרות'],
    fit: 'Demos, executive view',
    fitHe: 'הדגמות, תצוגת הנהלה',
    perf: 'Negligible',
    complexity: 'Low',
  },
  {
    slug: 'sentinel-3d',
    pros: ['Most impressive visual', 'Makes fusion tangible in space'],
    prosHe: ['הוויזואל המרשים ביותר', 'הופך את ה־fusion למוחשי במרחב'],
    cons: ['GPU cost', 'Needs WebGL (has 2D fallback)', 'Precision can be over-read'],
    consHe: ['עלות GPU', 'דורש WebGL (יש fallback דו־ממדי)', 'עלול לשדר דיוק־יתר'],
    fit: 'Judge demo wow-moment',
    fitHe: 'רגע ה־wow מול שופטים',
    perf: 'GPU-bound (lazy loaded, capped DPR)',
    complexity: 'High',
  },
  {
    slug: 'industrial-ops',
    pros: ['Most data per screen', 'Best for real operators', 'Event audit trail'],
    prosHe: ['הכי הרבה נתונים למסך', 'הטוב ביותר למפעילים אמיתיים', 'נתיב ביקורת אירועים'],
    cons: ['Intimidating to newcomers', 'Aesthetic is polarizing'],
    consHe: ['מאיים על משתמשים חדשים', 'אסתטיקה מקטבת'],
    fit: 'Control room, daily ops',
    fitHe: 'חדר בקרה, תפעול יומי',
    perf: 'Negligible',
    complexity: 'Medium',
  },
  {
    slug: 'neural-fusion',
    pros: ['Explains WHY risk rose', 'Unique identity', 'Great storytelling'],
    prosHe: ['מסביר למה הסיכון עלה', 'זהות ייחודית', 'סטוריטלינג מצוין'],
    cons: ['Least conventional', 'Radial layout limits tables'],
    consHe: ['הכי פחות קונבנציונלי', 'פריסה רדיאלית מגבילה טבלאות'],
    fit: 'Product vision, analyst view',
    fitHe: 'חזון מוצר, תצוגת אנליסט',
    perf: 'Light (SVG/CSS only)',
    complexity: 'Medium-High',
  },
]

function HomeInner() {
  const { t, lang } = useLab()
  const { snapshot, backendStatus, isDemo } = useAtapisData({ demo: 'auto' })

  return (
    <div className="dlh-page">
      <header className="dlh-header">
        <div>
          <p className="dlh-eyebrow" dir="ltr">ATAPIS · DESIGN LAB</p>
          <h1>{t('Four directions. One system.', 'ארבעה כיוונים. מערכת אחת.')}</h1>
          <p className="dlh-sub">
            {t(
              'Every concept below renders the same live data — camera, radar, behavior and risk — through a completely different design language. The active dashboard is untouched.',
              'כל קונספט מציג את אותם נתונים חיים — מצלמה, רדאר, התנהגות וסיכון — בשפה עיצובית שונה לחלוטין. הדשבורד הפעיל לא שונה.'
            )}
          </p>
        </div>
        <div className="dlh-live-strip" dir="ltr">
          <StatusDot state={backendDotState(backendStatus)} label={`Backend ${backendStatus}`} />
          <ModeBadge mode={snapshot.mode} />
          <span className="dlh-live-metric">Fused risk {snapshot.risks.fused}</span>
          <span className="dlh-live-metric">
            Radar {snapshot.radar.provider ? `${snapshot.radar.status} (${snapshot.radar.provider})` : snapshot.radar.status}
          </span>
          {isDemo ? <span className="dlh-live-demo">DEMO</span> : null}
        </div>
      </header>

      <Link to="/design-lab/compare" className="dlh-compare-banner">
        <span className="dlh-compare-eyebrow" dir="ltr">NEW · FULL-SITE CONCEPTS</span>
        <span className="dlh-compare-title">
          {t(
            'Comparison Center — five complete product experiences, every page, side by side',
            'מרכז השוואה — חמש חוויות מוצר שלמות, כל דף, זו לצד זו'
          )}
        </span>
        <span className="dlh-compare-cta" dir="ltr">↗</span>
      </Link>

      <div className="dlh-grid">
        {CARDS.map((card, index) => (
          <article key={card.slug} className="dlh-card" style={{ '--dlh-i': index }}>
            <Link to={`/design-lab/${card.slug}`} className="dlh-card-preview" aria-label={`Open ${card.name}`}>
              <card.Preview />
            </Link>
            <div className="dlh-card-body">
              <div className="dlh-card-title-row">
                <h2 dir="ltr">{card.name}</h2>
                {card.uses3d ? <span className="dlh-3d-tag" dir="ltr">WebGL 3D</span> : null}
              </div>
              <p className="dlh-card-desc">{lang === 'he' ? card.desc[1] : card.desc[0]}</p>
              <ul className="dlh-card-traits" dir="ltr">
                {card.traits.map((trait) => (
                  <li key={trait}>{trait}</li>
                ))}
              </ul>
              <dl className="dlh-card-meta">
                <div>
                  <dt>{t('Animation', 'אנימציה')}</dt>
                  <dd>{lang === 'he' ? card.animation[1] : card.animation[0]}</dd>
                </div>
                <div>
                  <dt>{t('Density', 'צפיפות')}</dt>
                  <dd>{lang === 'he' ? card.density[1] : card.density[0]}</dd>
                </div>
                <div>
                  <dt>3D</dt>
                  <dd dir="ltr">{card.uses3d ? t('Yes', 'כן') : t('No', 'לא')}</dd>
                </div>
              </dl>
              <Link to={`/design-lab/${card.slug}`} className="dlh-open-btn">
                {t('Open full screen', 'פתיחה במסך מלא')}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <section className="dlh-compare" aria-labelledby="dlh-compare-title">
        <h2 id="dlh-compare-title">{t('Side-by-side comparison', 'השוואה זה לצד זה')}</h2>
        <div className="dlh-compare-scroll">
          <table className="dlh-compare-table">
            <thead>
              <tr>
                <th>{t('Concept', 'קונספט')}</th>
                <th>{t('Strengths', 'יתרונות')}</th>
                <th>{t('Trade-offs', 'חסרונות')}</th>
                <th>{t('Best for', 'שימוש מומלץ')}</th>
                <th>{t('Performance impact', 'השפעה על ביצועים')}</th>
                <th>{t('Build complexity', 'מורכבות להמשך פיתוח')}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => {
                const card = CARDS.find((c) => c.slug === row.slug)
                return (
                  <tr key={row.slug}>
                    <td dir="ltr"><Link to={`/design-lab/${row.slug}`}>{card.name}</Link></td>
                    <td>
                      <ul>{(lang === 'he' ? row.prosHe : row.pros).map((item) => <li key={item}>{item}</li>)}</ul>
                    </td>
                    <td>
                      <ul>{(lang === 'he' ? row.consHe : row.cons).map((item) => <li key={item}>{item}</li>)}</ul>
                    </td>
                    <td>{lang === 'he' ? row.fitHe : row.fit}</td>
                    <td dir="ltr">{row.perf}</td>
                    <td dir="ltr">{row.complexity}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function DesignLabHome() {
  return (
    <DesignLabLayout>
      <HomeInner />
    </DesignLabLayout>
  )
}
