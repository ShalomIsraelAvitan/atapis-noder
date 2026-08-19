import { lazy } from 'react'

// Central concept registry — the ONLY place that knows which concepts exist.
// Each concept contributes: a Shell (nav + chrome, renders <Outlet/>) and one
// lazy view per business page. Business logic never branches on concept id;
// containers resolve the view through this registry.

const shell = (loader) => lazy(loader)
const view = (loader) => lazy(loader)

export const PAGE_IDS = ['dashboard', 'camera', 'history', 'about', 'settings', 'admin']

export const CONCEPTS = {
  minimal: {
    id: 'minimal',
    name: 'Minimal Command',
    nameHe: 'פיקוד מינימלי',
    description: 'Clean, precise command product. Typography-led, color only for risk.',
    descriptionHe: 'מוצר פיקוד נקי ומדויק. מובל־טיפוגרפיה, צבע רק לסיכון.',
    motionProfile: 'subtle',
    tokensClass: 'c-minimal',
    uses3d: false,
    Shell: shell(() => import('./minimal-command/MinimalShell')),
    views: {
      dashboard: view(() => import('./minimal-command/views/MinimalDashboard')),
      camera: view(() => import('./minimal-command/views/MinimalCamera')),
      history: view(() => import('./minimal-command/views/MinimalInvestigation')),
      about: view(() => import('./minimal-command/views/MinimalAbout')),
      settings: view(() => import('./minimal-command/views/MinimalSettings')),
      admin: view(() => import('./minimal-command/views/MinimalAdmin')),
    },
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel 3D',
    nameHe: 'סנטינל תלת־ממד',
    description: 'Futuristic command center around a 3D digital twin of the site.',
    descriptionHe: 'מרכז שליטה עתידני סביב תאום דיגיטלי תלת־ממדי של האתר.',
    motionProfile: 'cinematic',
    tokensClass: 'c-sentinel',
    uses3d: true,
    Shell: shell(() => import('./sentinel-3d/SentinelShell')),
    views: {
      dashboard: view(() => import('./sentinel-3d/views/SentinelDashboard')),
      camera: view(() => import('./sentinel-3d/views/SentinelCamera')),
      history: view(() => import('./sentinel-3d/views/SentinelInvestigation')),
      about: view(() => import('./sentinel-3d/views/SentinelAbout')),
      settings: view(() => import('./sentinel-3d/views/SentinelSettings')),
      admin: view(() => import('./sentinel-3d/views/SentinelAdmin')),
    },
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Ops',
    nameHe: 'תפעול תעשייתי',
    description: 'Dense tactical operations product: tables, logs, hard grid, mono type.',
    descriptionHe: 'מוצר תפעול טקטי צפוף: טבלאות, יומנים, grid קשיח וטיפוגרפיית mono.',
    motionProfile: 'sharp',
    tokensClass: 'c-industrial',
    uses3d: false,
    Shell: shell(() => import('./industrial-ops/IndustrialShell')),
    views: {
      dashboard: view(() => import('./industrial-ops/views/IndustrialDashboard')),
      camera: view(() => import('./industrial-ops/views/IndustrialCamera')),
      history: view(() => import('./industrial-ops/views/IndustrialInvestigation')),
      about: view(() => import('./industrial-ops/views/IndustrialAbout')),
      settings: view(() => import('./industrial-ops/views/IndustrialSettings')),
      admin: view(() => import('./industrial-ops/views/IndustrialAdmin')),
    },
  },
  neural: {
    id: 'neural',
    name: 'Neural Fusion',
    nameHe: 'היתוך עצבי',
    description: 'Intelligence visualization: sensor fusion flows into one risk decision.',
    descriptionHe: 'ויזואליזציית אינטליגנציה: היתוך חיישנים שזורם להחלטת סיכון אחת.',
    motionProfile: 'flow',
    tokensClass: 'c-neural',
    uses3d: false,
    Shell: shell(() => import('./neural-fusion/NeuralShell')),
    views: {
      dashboard: view(() => import('./neural-fusion/views/NeuralDashboard')),
      camera: view(() => import('./neural-fusion/views/NeuralCamera')),
      history: view(() => import('./neural-fusion/views/NeuralInvestigation')),
      about: view(() => import('./neural-fusion/views/NeuralAbout')),
      settings: view(() => import('./neural-fusion/views/NeuralSettings')),
      admin: view(() => import('./neural-fusion/views/NeuralAdmin')),
    },
  },
  'fusion-prime': {
    id: 'fusion-prime',
    name: 'Fusion Prime',
    nameHe: 'פיוז\'ן פריים',
    description: 'The mature blend: minimal clarity, spatial depth, operational tables, fusion storytelling.',
    descriptionHe: 'השילוב הבשל: בהירות מינימלית, עומק מרחבי, טבלאות תפעוליות וסיפור ההיתוך.',
    motionProfile: 'premium',
    tokensClass: 'c-prime',
    uses3d: true,
    Shell: shell(() => import('./fusion-prime/PrimeShell')),
    views: {
      dashboard: view(() => import('./fusion-prime/views/PrimeDashboard')),
      camera: view(() => import('./fusion-prime/views/PrimeCamera')),
      history: view(() => import('./fusion-prime/views/PrimeInvestigation')),
      about: view(() => import('./fusion-prime/views/PrimeAbout')),
      settings: view(() => import('./fusion-prime/views/PrimeSettings')),
      admin: view(() => import('./fusion-prime/views/PrimeAdmin')),
    },
  },
}

export const CONCEPT_LIST = Object.values(CONCEPTS)
