// Advisory copy for the radar serial configuration. Advisory ONLY — nothing
// here writes to the backend or changes a default. The one action offered
// prefills the draft field (via the existing setField); the user still saves.
//
// The baud confusion is real, not hypothetical: radar_config.json currently
// holds 115200 while ld2450_reader.py defaults to and expects 256000. The
// microcontroller link is a separate, fixed 9600 baud set in server.py.
export const LD2450_EXPECTED_BAUD = 256000
export const CONTROLLER_BAUD = 9600

/**
 * @param draft current editable config
 * @param ctx   { radarConnected, lastError, includeTopology }
 *              includeTopology is opt-in so callers that have not adopted the
 *              wiring explainer keep the advisory set they render today.
 * @returns advisory objects: { id, severity, titleEn/He, bodyEn/He, action }
 *          action (optional): { labelEn/He, field, value }
 */
export function serialAdvisories(draft, { radarConnected, lastError, includeTopology = false } = {}) {
  const out = []
  if (!draft) return out

  // 1. Always: explain which baud this field is (radar UART, not the MCU link).
  out.push({
    id: 'baud-scope',
    severity: 'info',
    titleEn: 'Which baud rate is this?',
    titleHe: 'לאיזה קצב Baud זה מתייחס?',
    bodyEn:
      'This sets the radar UART rate (LD2450). The microcontroller link runs at a fixed ' +
      `${CONTROLLER_BAUD} baud in the backend and is not configurable from this screen.`,
    bodyHe:
      'שדה זה קובע את קצב ה־UART של הרדאר (LD2450). קישור הבקר רץ בקצב קבוע של ' +
      `${CONTROLLER_BAUD} baud המוגדר ב־Backend ואינו ניתן לשינוי ממסך זה.`,
    action: null,
  })

  // 2. Always: name the possible wiring paths. Which one is in use is a physical
  // fact the software cannot read, so this states the options and their
  // implication for the baud field — it never claims to have detected one.
  if (includeTopology) out.push({
    id: 'topology',
    severity: 'info',
    titleEn: 'How is the radar wired?',
    titleHe: 'כיצד מחווט הרדאר?',
    bodyEn:
      'Three wiring paths are possible: LD2450 direct to a UART, LD2450 through a USB-TTL adapter, ' +
      'or LD2450 behind an ESP32 bridge that forwards JSON. The correct baud depends on which one is ' +
      'in use, and the software cannot detect it — confirm against the physical hardware.',
    bodyHe:
      'קיימים שלושה מסלולי חיווט אפשריים: LD2450 ישירות ל־UART, ‏LD2450 דרך מתאם USB-TTL, ' +
      'או LD2450 מאחורי גשר ESP32 שמעביר JSON. קצב ה־Baud הנכון תלוי במסלול בפועל, ' +
      'והתוכנה אינה יכולה לזהות אותו — יש לאמת מול החומרה הפיזית.',
    action: null,
  })

  // 3. Warn when the saved baud differs from the LD2450 factory default.
  const baud = Number(draft.LD2450_BAUD)
  if (Number.isFinite(baud) && baud !== LD2450_EXPECTED_BAUD) {
    out.push({
      id: 'baud-mismatch',
      severity: 'warn',
      titleEn: 'Baud differs from the LD2450 default',
      titleHe: 'קצב ה־Baud שונה מברירת המחדל של LD2450',
      bodyEn:
        `LD2450 modules ship at ${LD2450_EXPECTED_BAUD} baud; the current value is ${baud}. ` +
        'If the radar reports no targets, check this first — or keep it if the module is wired through a converter set to this rate.',
      bodyHe:
        `מודולי LD2450 מגיעים בקצב ${LD2450_EXPECTED_BAUD} baud; הערך הנוכחי הוא ${baud}. ` +
        'אם הרדאר אינו מדווח על מטרות, בדוק זאת תחילה — או השאר אם המודול מחווט דרך ממיר בקצב זה.',
      action: {
        labelEn: `Set ${LD2450_EXPECTED_BAUD}`,
        labelHe: `הגדר ${LD2450_EXPECTED_BAUD}`,
        field: 'LD2450_BAUD',
        value: LD2450_EXPECTED_BAUD,
      },
    })
  }

  // 4. Warn on a port/timeout style connection failure.
  if (radarConnected === false && lastError && /port|timeout|not configured/i.test(String(lastError))) {
    out.push({
      id: 'port-check',
      severity: 'warn',
      titleEn: 'Radar not connected',
      titleHe: 'הרדאר אינו מחובר',
      bodyEn:
        'The radar link is down with a port/timeout error. Verify the serial port matches the radar adapter ' +
        '(and is not the microcontroller port), then test the connection.',
      bodyHe:
        'קישור הרדאר מנותק עם שגיאת פורט/timeout. ודא שהפורט הטורי תואם למתאם הרדאר ' +
        '(ואינו פורט הבקר), ואז בדוק את החיבור.',
      action: null,
    })
  }

  return out
}
