import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LabProvider } from './shared/LabContext'
import { useLab } from './shared/useLab'
import './shared/motion-tokens.css'
import './design-lab-base.css'
import './compare.css'

// Comparison Center — all five FULL-SITE concept experiences side by side.
// Everything on this screen is STATIC: schematic SVG wireframes only.
// No MJPEG feeds, no three.js scenes, no polling, no per-preview data hooks —
// the real experiences open behind the "open" links (with the labeled demo
// scenario preselected for a fair comparison).

const DEMO_QS = '?demo=1&phase=approach'
const PAGES = [
  { id: 'dashboard', route: 'dashboard', en: 'Dashboard', he: 'דשבורד' },
  { id: 'camera', route: 'camera/1', en: 'Camera', he: 'מצלמה' },
  { id: 'history', route: 'history', en: 'Investigation', he: 'חדר חקירה' },
  { id: 'about', route: 'about', en: 'About', he: 'אודות' },
  { id: 'settings', route: 'settings', en: 'Settings', he: 'הגדרות' },
  { id: 'admin', route: 'admin', en: 'Admin', he: 'ניהול' },
]

// ---------------------------------------------------------------------------
// Concept metadata (display only; the routes come from the /concepts registry).
const META = [
  {
    id: 'minimal',
    name: 'Minimal Command',
    accent: '#e8e8ec',
    desc: { en: 'Typography-led command product; color is reserved for risk.', he: 'מוצר פיקוד מובל־טיפוגרפיה; צבע שמור לסיכון בלבד.' },
    nav: { en: 'Slim top bar', he: 'סרגל עליון צר' },
    motion: { en: 'Subtle (≤250ms)', he: 'עדין (עד 250ms)' },
    density: { en: 'Low', he: 'נמוכה' },
    uses3d: false,
    futuristic: 1,
    perf: { en: 'Lightest — text + SVG only', he: 'הקל ביותר — טקסט ו-SVG בלבד' },
    pros: {
      en: ['Instant readability', 'Calm for long shifts', 'Smallest bundle'],
      he: ['קריאות מיידית', 'רוגע במשמרות ארוכות', 'ה-bundle הקטן ביותר'],
    },
    cons: {
      en: ['Least "wow" for judges', 'Low data density'],
      he: ['הכי פחות "וואו" לשופטים', 'צפיפות נתונים נמוכה'],
    },
    recommended: { en: 'Daily operation, small screens', he: 'תפעול יומיומי, מסכים קטנים' },
  },
  {
    id: 'sentinel',
    name: 'Sentinel 3D',
    accent: '#4fd6e8',
    desc: { en: 'Futuristic command center around a 3D digital twin of the site.', he: 'מרכז שליטה עתידני סביב תאום דיגיטלי תלת־ממדי של האתר.' },
    nav: { en: 'Floating top dock', he: 'דוק צף עליון' },
    motion: { en: 'Cinematic on twin pages', he: 'קולנועי בעמודי התאום' },
    density: { en: 'Medium', he: 'בינונית' },
    uses3d: true,
    futuristic: 5,
    perf: { en: 'Heaviest — WebGL on twin pages (lazy, 2D fallback)', he: 'הכבד ביותר — WebGL בעמודי התאום (lazy, עם fallback דו־ממדי)' },
    pros: {
      en: ['Strongest demo impact', 'Spatial intuition of the site', 'Target focus in scene'],
      he: ['אימפקט ההדגמה החזק ביותר', 'אינטואיציה מרחבית של האתר', 'מיקוד מטרה בסצנה'],
    },
    cons: {
      en: ['GPU dependent', 'Least efficient for long ops'],
      he: ['תלוי GPU', 'הכי פחות יעיל לתפעול ממושך'],
    },
    recommended: { en: 'Judge demos, situational awareness', he: 'הדגמות לשופטים, מודעות מצבית' },
  },
  {
    id: 'industrial',
    name: 'Industrial Ops',
    accent: '#e61919',
    desc: { en: 'Dense tactical operations: tables, logs, hard grid, mono type.', he: 'תפעול טקטי צפוף: טבלאות, יומנים, grid קשיח וטיפוגרפיית mono.' },
    nav: { en: 'Fixed side rail + ⌥1–6 shortcuts', he: 'מסילה צדית קבועה + קיצורי ⌥1–6' },
    motion: { en: 'Snap (80–160ms), zero decoration', he: 'חד (80–160ms), אפס דקורציה' },
    density: { en: 'High', he: 'גבוהה' },
    uses3d: false,
    futuristic: 2,
    perf: { en: 'Light — DOM tables and one SVG plot', he: 'קל — טבלאות DOM ו-plot SVG אחד' },
    pros: {
      en: ['Most data per screen', 'Keyboard-first', 'Reads like real ops software'],
      he: ['הכי הרבה נתונים למסך', 'מקלדת תחילה', 'נראה כמו תוכנת תפעול אמיתית'],
    },
    cons: {
      en: ['Intimidating to newcomers', 'Cramped on small screens'],
      he: ['מאיים על משתמשים חדשים', 'צפוף במסכים קטנים'],
    },
    recommended: { en: 'Expert operators, admin work', he: 'מפעילים מומחים, עבודת ניהול' },
  },
  {
    id: 'neural',
    name: 'Neural Fusion',
    accent: '#8f7ff0',
    desc: { en: 'Intelligence visualization: sensor flows into one risk decision.', he: 'ויזואליזציית אינטליגנציה: חיישנים זורמים להחלטת סיכון אחת.' },
    nav: { en: 'Vertical node dock', he: 'דוק צמתים אנכי' },
    motion: { en: 'Data-flow (animated dashes)', he: 'זרימת נתונים (קווים מונפשים)' },
    density: { en: 'Medium', he: 'בינונית' },
    uses3d: false,
    futuristic: 4,
    perf: { en: 'Light-medium — CSS/SVG animations only', he: 'קל-בינוני — אנימציות CSS/SVG בלבד' },
    pros: {
      en: ['Best "why" storytelling', 'Explains fusion visually', 'Distinct identity'],
      he: ['סיפור ה"למה" הטוב ביותר', 'מסביר את ההיתוך ויזואלית', 'זהות מובחנת'],
    },
    cons: {
      en: ['Decorative for daily ops', 'Flow lines need wide screens'],
      he: ['דקורטיבי לתפעול יומי', 'קווי הזרימה דורשים מסך רחב'],
    },
    recommended: { en: 'Explaining the fusion story', he: 'הסבר סיפור ההיתוך' },
  },
  {
    id: 'fusion-prime',
    name: 'Fusion Prime',
    accent: '#c9a24b',
    desc: { en: 'The mature blend: minimal clarity, compact twin, operational tables, fusion reasoning.', he: 'השילוב הבשל: בהירות מינימלית, תאום קומפקטי, טבלאות תפעוליות והסבר ההיתוך.' },
    nav: { en: 'Clean top bar + persistent bottom command strip', he: 'סרגל עליון נקי + פס פיקוד תחתון קבוע' },
    motion: { en: 'Controlled: cinematic in twin only', he: 'מבוקר: קולנועי בתאום בלבד' },
    density: { en: 'Medium-high', he: 'בינונית-גבוהה' },
    uses3d: true,
    futuristic: 3,
    perf: { en: 'Medium — WebGL on dashboard only; tables elsewhere', he: 'בינוני — WebGL בדשבורד בלבד; טבלאות בשאר' },
    pros: {
      en: ['Best overall balance', 'State always visible (strip)', 'Real actions everywhere'],
      he: ['האיזון הכולל הטוב ביותר', 'מצב תמיד גלוי (פס פיקוד)', 'פעולות אמיתיות בכל דף'],
    },
    cons: {
      en: ['Less extreme than any single parent', 'Twin still needs GPU'],
      he: ['פחות קיצוני מכל הורה בודד', 'התאום עדיין דורש GPU'],
    },
    recommended: { en: 'The product candidate — demo AND operation', he: 'מועמד המוצר — גם הדגמה וגם תפעול' },
  },
]

// ---------------------------------------------------------------------------
// Schematic wireframes: 200×120 SVG, abstract blocks only.
// kind: s=surface, o=outline, a=accent, f=feed(green box), r=ring(circle)
function Wire({ spec, accent, title }) {
  return (
    <svg viewBox="0 0 200 120" className="cc-wire" role="img" aria-label={title}>
      <rect width="200" height="120" fill="#0b0b0f" />
      {spec.map((b, i) => {
        if (b.k === 'r') {
          return <circle key={i} cx={b.x} cy={b.y} r={b.w} fill="none" stroke={b.a ? accent : '#2e2e36'} opacity={b.a ? 0.9 : 1} />
        }
        const fill = b.k === 's' ? '#17171d' : b.k === 'a' ? accent : 'none'
        const stroke = b.k === 'o' ? '#33333c' : b.k === 'f' ? '#34c76f' : 'none'
        return (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2"
            fill={fill} stroke={stroke} opacity={b.k === 'a' ? 0.9 : 1} />
        )
      })}
    </svg>
  )
}

// Per-concept chrome + per-page content blocks.
const chrome = {
  minimal: [{ k: 'a', x: 8, y: 6, w: 60, h: 3 }],
  sentinel: [{ k: 'a', x: 60, y: 5, w: 80, h: 6 }],
  industrial: [{ k: 's', x: 168, y: 0, w: 32, h: 120 }, { k: 'a', x: 172, y: 8, w: 24, h: 5 }],
  neural: [{ k: 's', x: 184, y: 30, w: 12, h: 60 }, { k: 'a', x: 188, y: 38, w: 4, h: 4 }],
  'fusion-prime': [{ k: 'a', x: 8, y: 6, w: 60, h: 3 }, { k: 's', x: 0, y: 112, w: 200, h: 8 }, { k: 'a', x: 8, y: 114, w: 26, h: 4 }],
}

const content = {
  dashboard: {
    minimal: [{ k: 'a', x: 130, y: 20, w: 56, h: 14 }, { k: 's', x: 20, y: 44, w: 166, h: 30 }, { k: 's', x: 20, y: 80, w: 80, h: 28 }, { k: 's', x: 106, y: 80, w: 80, h: 28 }],
    sentinel: [{ k: 'o', x: 30, y: 30, w: 140, h: 70 }, { k: 'r', x: 100, y: 68, w: 26 }, { k: 'a', x: 108, y: 52, w: 5, h: 9 }, { k: 's', x: 8, y: 20, w: 44, h: 22 }, { k: 's', x: 148, y: 20, w: 44, h: 26 }, { k: 's', x: 8, y: 86, w: 44, h: 22 }, { k: 's', x: 148, y: 84, w: 44, h: 22 }],
    industrial: [{ k: 's', x: 8, y: 16, w: 152, h: 10 }, { k: 'o', x: 8, y: 32, w: 48, h: 40 }, { k: 'o', x: 60, y: 32, w: 48, h: 40 }, { k: 'o', x: 112, y: 32, w: 48, h: 40 }, { k: 'o', x: 8, y: 76, w: 100, h: 26 }, { k: 'o', x: 112, y: 76, w: 48, h: 26 }, { k: 'a', x: 8, y: 106, w: 20, h: 6 }],
    neural: [{ k: 'r', x: 90, y: 60, w: 34 }, { k: 's', x: 76, y: 46, w: 30, h: 26 }, { k: 's', x: 130, y: 30, w: 34, h: 18 }, { k: 's', x: 130, y: 74, w: 34, h: 18 }, { k: 'a', x: 24, y: 52, w: 26, h: 20 }],
    'fusion-prime': [{ k: 'a', x: 150, y: 18, w: 40, h: 10 }, { k: 's', x: 104, y: 34, w: 88, h: 38 }, { k: 'f', x: 138, y: 44, w: 10, h: 18 }, { k: 'o', x: 8, y: 34, w: 90, h: 38 }, { k: 'r', x: 52, y: 54, w: 14 }, { k: 's', x: 8, y: 78, w: 184, h: 14 }, { k: 's', x: 8, y: 96, w: 90, h: 12 }, { k: 's', x: 104, y: 96, w: 88, h: 12 }],
  },
  camera: {
    minimal: [{ k: 'f', x: 70, y: 22, w: 116, h: 74 }, { k: 's', x: 8, y: 22, w: 54, h: 34 }, { k: 's', x: 8, y: 62, w: 54, h: 34 }],
    sentinel: [{ k: 'o', x: 30, y: 30, w: 140, h: 70 }, { k: 'f', x: 8, y: 18, w: 56, h: 38 }, { k: 's', x: 140, y: 78, w: 52, h: 26 }, { k: 'r', x: 110, y: 70, w: 20 }],
    industrial: [{ k: 'f', x: 8, y: 20, w: 76, h: 50 }, { k: 'o', x: 90, y: 20, w: 70, h: 50 }, { k: 's', x: 8, y: 76, w: 76, h: 26 }, { k: 's', x: 90, y: 76, w: 70, h: 26 }],
    neural: [{ k: 'r', x: 150, y: 26, w: 26 }, { k: 'f', x: 8, y: 20, w: 108, h: 58 }, { k: 's', x: 8, y: 84, w: 108, h: 18 }, { k: 's', x: 124, y: 20, w: 60, h: 38 }, { k: 's', x: 124, y: 62, w: 60, h: 40 }],
    'fusion-prime': [{ k: 'f', x: 8, y: 20, w: 120, h: 52 }, { k: 's', x: 134, y: 20, w: 58, h: 40 }, { k: 's', x: 8, y: 76, w: 120, h: 10 }, { k: 's', x: 8, y: 90, w: 88, h: 16 }, { k: 's', x: 102, y: 90, w: 90, h: 16 }],
  },
  history: {
    minimal: [{ k: 's', x: 8, y: 18, w: 184, h: 12 }, { k: 's', x: 8, y: 36, w: 88, h: 70 }, { k: 'o', x: 102, y: 36, w: 90, h: 70 }],
    sentinel: [{ k: 's', x: 8, y: 18, w: 184, h: 12 }, { k: 'o', x: 8, y: 36, w: 88, h: 70 }, { k: 'a', x: 44, y: 66, w: 7, h: 7 }, { k: 's', x: 102, y: 36, w: 90, h: 70 }],
    industrial: [{ k: 's', x: 8, y: 16, w: 152, h: 10 }, { k: 'o', x: 8, y: 30, w: 60, h: 74 }, { k: 'o', x: 74, y: 30, w: 86, h: 74 }, { k: 'a', x: 78, y: 42, w: 78, h: 4 }],
    neural: [{ k: 's', x: 8, y: 18, w: 172, h: 12 }, { k: 'a', x: 16, y: 40, w: 4, h: 62 }, { k: 's', x: 28, y: 38, w: 64, h: 16 }, { k: 's', x: 28, y: 60, w: 64, h: 16 }, { k: 's', x: 28, y: 82, w: 64, h: 16 }, { k: 'o', x: 102, y: 38, w: 78, h: 64 }],
    'fusion-prime': [{ k: 's', x: 8, y: 16, w: 184, h: 26 }, { k: 'a', x: 16, y: 30, w: 168, h: 2 }, { k: 's', x: 8, y: 48, w: 184, h: 10 }, { k: 's', x: 8, y: 64, w: 88, h: 42 }, { k: 'o', x: 102, y: 64, w: 90, h: 42 }],
  },
  about: {
    minimal: [{ k: 'a', x: 60, y: 22, w: 80, h: 8 }, { k: 's', x: 40, y: 40, w: 120, h: 12 }, { k: 's', x: 40, y: 58, w: 120, h: 12 }, { k: 's', x: 40, y: 76, w: 120, h: 12 }],
    sentinel: [{ k: 'r', x: 100, y: 62, w: 30 }, { k: 'a', x: 92, y: 56, w: 16, h: 12 }, { k: 's', x: 22, y: 30, w: 44, h: 20 }, { k: 's', x: 134, y: 30, w: 44, h: 20 }, { k: 's', x: 22, y: 86, w: 44, h: 20 }, { k: 's', x: 134, y: 86, w: 44, h: 20 }],
    industrial: [{ k: 'a', x: 8, y: 20, w: 100, h: 8 }, { k: 'o', x: 8, y: 36, w: 152, h: 1 }, { k: 's', x: 8, y: 44, w: 152, h: 8 }, { k: 'o', x: 8, y: 60, w: 152, h: 1 }, { k: 's', x: 8, y: 68, w: 152, h: 8 }, { k: 'o', x: 8, y: 84, w: 152, h: 1 }, { k: 's', x: 8, y: 92, w: 152, h: 8 }],
    neural: [{ k: 'a', x: 20, y: 30, w: 4, h: 70 }, { k: 's', x: 34, y: 28, w: 130, h: 16 }, { k: 's', x: 34, y: 52, w: 130, h: 16 }, { k: 's', x: 34, y: 76, w: 130, h: 16 }],
    'fusion-prime': [{ k: 'a', x: 50, y: 22, w: 100, h: 8 }, { k: 'a', x: 8, y: 40, w: 184, h: 1 }, { k: 's', x: 8, y: 48, w: 184, h: 14 }, { k: 'a', x: 8, y: 70, w: 184, h: 1 }, { k: 's', x: 8, y: 78, w: 88, h: 28 }, { k: 's', x: 104, y: 78, w: 88, h: 28 }],
  },
  settings: {
    minimal: [{ k: 'o', x: 50, y: 20, w: 100, h: 26 }, { k: 'o', x: 50, y: 52, w: 100, h: 26 }, { k: 'o', x: 50, y: 84, w: 100, h: 22 }],
    sentinel: [{ k: 's', x: 24, y: 24, w: 90, h: 80 }, { k: 's', x: 122, y: 24, w: 56, h: 50 }, { k: 's', x: 122, y: 80, w: 56, h: 24 }],
    industrial: [{ k: 'a', x: 120, y: 16, w: 40, h: 8 }, { k: 'o', x: 8, y: 30, w: 70, h: 74 }, { k: 'o', x: 84, y: 30, w: 76, h: 74 }],
    neural: [{ k: 's', x: 16, y: 24, w: 100, h: 80 }, { k: 's', x: 124, y: 24, w: 56, h: 46 }, { k: 's', x: 124, y: 76, w: 56, h: 28 }],
    'fusion-prime': [{ k: 'o', x: 8, y: 20, w: 110, h: 60 }, { k: 'a', x: 8, y: 86, w: 110, h: 20 }, { k: 's', x: 126, y: 20, w: 66, h: 50 }, { k: 's', x: 126, y: 76, w: 66, h: 30 }],
  },
  admin: {
    minimal: [{ k: 's', x: 8, y: 20, w: 28, h: 14 }, { k: 's', x: 40, y: 20, w: 28, h: 14 }, { k: 'o', x: 8, y: 42, w: 116, h: 64 }, { k: 's', x: 130, y: 42, w: 62, h: 64 }],
    sentinel: [{ k: 's', x: 12, y: 24, w: 112, h: 80 }, { k: 'o', x: 22, y: 52, w: 92, h: 44 }, { k: 's', x: 132, y: 24, w: 56, h: 80 }],
    industrial: [{ k: 's', x: 8, y: 16, w: 152, h: 10 }, { k: 'o', x: 8, y: 32, w: 104, h: 72 }, { k: 'a', x: 12, y: 40, w: 20, h: 5 }, { k: 's', x: 118, y: 32, w: 42, h: 72 }],
    neural: [{ k: 's', x: 12, y: 24, w: 112, h: 80 }, { k: 'r', x: 40, y: 44, w: 9 }, { k: 'o', x: 60, y: 56, w: 56, h: 40 }, { k: 's', x: 132, y: 24, w: 56, h: 80 }],
    'fusion-prime': [{ k: 's', x: 8, y: 18, w: 28, h: 14 }, { k: 'o', x: 8, y: 40, w: 116, h: 66 }, { k: 's', x: 130, y: 40, w: 62, h: 66 }],
  },
}

function conceptWire(conceptId, pageId) {
  return [...chrome[conceptId], ...content[pageId][conceptId]]
}

// ---------------------------------------------------------------------------
function Stars({ level }) {
  return (
    <span className="cc-stars" aria-label={`${level}/5`} dir="ltr">
      {'●'.repeat(level)}
      <span className="cc-stars-off">{'●'.repeat(5 - level)}</span>
    </span>
  )
}

function ConceptCard({ meta }) {
  const { t, lang } = useLab()
  const L = (obj) => obj[lang] || obj.en
  return (
    <article className="cc-card" style={{ '--cc-accent': meta.accent }}>
      <div className="cc-card-preview">
        <Wire spec={conceptWire(meta.id, 'dashboard')} accent={meta.accent} title={`${meta.name} dashboard schematic`} />
      </div>
      <div className="cc-card-body">
        <h3 className="cc-card-name" dir="ltr">{meta.name}</h3>
        <p className="cc-card-desc">{L(meta.desc)}</p>
        <dl className="cc-meta">
          <div><dt>{t('Navigation', 'ניווט')}</dt><dd>{L(meta.nav)}</dd></div>
          <div><dt>{t('Motion', 'תנועה')}</dt><dd>{L(meta.motion)}</dd></div>
          <div><dt>{t('Density', 'צפיפות')}</dt><dd>{L(meta.density)}</dd></div>
          <div><dt>3D</dt><dd>{meta.uses3d ? t('Yes (lazy)', 'כן (lazy)') : t('No', 'לא')}</dd></div>
          <div><dt>{t('Futuristic', 'עתידניות')}</dt><dd><Stars level={meta.futuristic} /></dd></div>
          <div><dt>{t('Performance', 'ביצועים')}</dt><dd>{L(meta.perf)}</dd></div>
        </dl>
        <div className="cc-proscons">
          <div>
            <h4>{t('Pros', 'יתרונות')}</h4>
            <ul>{L(meta.pros).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h4>{t('Cons', 'חסרונות')}</h4>
            <ul>{L(meta.cons).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <p className="cc-recommended"><b>{t('Best for:', 'מומלץ ל:')}</b> {L(meta.recommended)}</p>
        <Link to={`/concepts/${meta.id}/dashboard${DEMO_QS}`} className="cc-open">
          {t('Open full experience', 'פתיחת החוויה המלאה')} <span dir="ltr">↗</span>
        </Link>
      </div>
    </article>
  )
}

function PageComparison() {
  const { t, lang } = useLab()
  const [pageId, setPageId] = useState('dashboard')
  const page = PAGES.find((p) => p.id === pageId)
  return (
    <section className="cc-pages" aria-label={t('Per-page comparison', 'השוואה לפי דף')}>
      <h2>{t('Compare by page', 'השוואה לפי דף')}</h2>
      <div className="cc-page-tabs" role="tablist">
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === pageId}
            className={`cc-page-tab ${p.id === pageId ? 'is-active' : ''}`}
            onClick={() => setPageId(p.id)}
          >
            {lang === 'he' ? p.he : p.en}
          </button>
        ))}
      </div>
      <div className="cc-page-grid">
        {META.map((meta) => (
          <figure key={meta.id} className="cc-page-cell" style={{ '--cc-accent': meta.accent }}>
            <Wire spec={conceptWire(meta.id, pageId)} accent={meta.accent}
              title={`${meta.name} ${page.en} schematic`} />
            <figcaption dir="ltr">{meta.name}</figcaption>
            <Link to={`/concepts/${meta.id}/${page.route}${DEMO_QS}`} className="cc-page-open">
              {t('Open', 'פתיחה')} <span dir="ltr">↗</span>
            </Link>
          </figure>
        ))}
      </div>
      <p className="cc-note">
        {t(
          'Schematic previews only — open a concept to see the live experience (demo scenario preselected, clearly labeled).',
          'תצוגות סכמטיות בלבד — פתחו קונספט לחוויה החיה (תרחיש הדמו נבחר מראש ומסומן בבירור).'
        )}
      </p>
    </section>
  )
}

function CompareInner() {
  const { t, dir, toggleLang, lang } = useLab()
  return (
    <div className="design-lab-scope cc-root" dir={dir}>
      <header className="cc-head">
        <div>
          <p className="cc-eyebrow" dir="ltr">ATAPIS · FULL-SITE CONCEPTS</p>
          <h1>{t('Comparison Center', 'מרכז השוואה')}</h1>
          <p className="cc-sub">
            {t(
              'Five complete product experiences over the same live system — same data, same pages, five languages of design.',
              'חמש חוויות מוצר שלמות מעל אותה מערכת חיה — אותם נתונים, אותם דפים, חמש שפות עיצוב.'
            )}
          </p>
        </div>
        <div className="cc-head-actions">
          <button type="button" className="cc-lang" onClick={toggleLang}
            aria-label={t('Switch interface language', 'החלפת שפת ממשק')}>
            {lang === 'he' ? 'EN' : 'עב'}
          </button>
          <Link to="/design-lab" className="cc-back">{t('Old Design Lab', 'מעבדת העיצוב הישנה')}</Link>
        </div>
      </header>

      <div className="cc-cards">
        {META.map((meta) => <ConceptCard key={meta.id} meta={meta} />)}
      </div>

      <PageComparison />
    </div>
  )
}

export default function CompareCenter() {
  return (
    <LabProvider>
      <CompareInner />
    </LabProvider>
  )
}
