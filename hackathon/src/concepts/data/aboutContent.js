// About content for all five concepts — single source of truth.
// Per product decision (2026-07-16): honest MVP framing based on the verified
// project facts (CLAUDE.md) + the existing non-numeric Landing copy.
// No invented customers, accuracy percentages, deployments or partners.
// Future items are explicitly marked as vision.

export const ABOUT = {
  product: 'ATAPIS',
  fullName: 'Autonomous Threat Assessment & Perimeter Intelligence System',
  tagline: {
    en: 'Perimeter security that understands intent — not just presence.',
    he: 'אבטחה היקפית שמבינה כוונה — לא רק נוכחות.',
  },
  problem: {
    title: { en: 'The Problem', he: 'הבעיה' },
    body: {
      en: 'Conventional camera systems can say "there is a person in the frame" — but not what that person is about to do. Without context, every passerby looks the same as an intruder, and real threats are noticed too late.',
      he: 'מערכות מצלמה רגילות יודעות לומר "יש אדם בפריים" — אבל לא מה הוא עומד לעשות. בלי הקשר, כל עובר אורח נראה כמו פורץ, ואיומים אמיתיים מזוהים מאוחר מדי.',
    },
  },
  innovation: {
    title: { en: 'The Innovation', he: 'החידוש' },
    body: {
      en: 'ATAPIS fuses video understanding (detection, tracking, behavior analysis) with a 24GHz radar (distance, angle, velocity) into a single dynamic Risk Score and a global system state: SAFE / ALERT / DANGER.',
      he: 'ATAPIS ממזגת הבנת וידאו (זיהוי, מעקב, ניתוח התנהגות) עם רדאר 24GHz (מרחק, זווית, מהירות) לכדי Risk Score דינמי אחד ומצב מערכת גלובלי: SAFE / ALERT / DANGER.',
    },
  },
  pillars: [
    {
      id: 'camera',
      title: { en: 'Camera Intelligence', he: 'אינטליגנציית מצלמה' },
      body: {
        en: 'YOLO-based person detection with per-track behavior analysis: speed, heading, dwell time, proximity to fence and gate, and weapon association.',
        he: 'זיהוי אנשים מבוסס YOLO עם ניתוח התנהגות לכל מעקב: מהירות, כיוון, זמן שהייה, קרבה לגדר ולשער ושיוך נשק.',
      },
    },
    {
      id: 'radar',
      title: { en: 'Radar Sensing', he: 'חישת רדאר' },
      body: {
        en: 'HLK-LD2450 24GHz radar tracks up to three targets with position, distance, angle and velocity — day, night, and in poor visibility.',
        he: 'רדאר HLK-LD2450 בתדר 24GHz עוקב אחר עד שלוש מטרות עם מיקום, מרחק, זווית ומהירות — ביום, בלילה ובראות לקויה.',
      },
    },
    {
      id: 'fusion',
      title: { en: 'Sensor Fusion', he: 'היתוך חיישנים' },
      body: {
        en: 'Camera risk and radar risk are combined into one fused decision, so a fast-approaching target confirmed by both sensors escalates faster than either alone.',
        he: 'סיכון המצלמה וסיכון הרדאר משולבים להחלטה ממוזגת אחת — מטרה שמתקרבת במהירות ומאושרת על ידי שני החיישנים מסלימה מהר יותר מכל חיישן לבדו.',
      },
    },
    {
      id: 'risk',
      title: { en: 'Risk Engine', he: 'מנוע הסיכון' },
      body: {
        en: 'A stateful engine accumulates and decays risk per tracked person based on behavior: approaching the gate, loitering at the fence, running, or carrying a weapon.',
        he: 'מנוע בעל זיכרון צובר ומפחית סיכון לכל אדם במעקב לפי התנהגות: התקרבות לשער, שהייה ליד הגדר, ריצה או נשיאת נשק.',
      },
    },
  ],
  architecture: {
    title: { en: 'Architecture', he: 'ארכיטקטורה' },
    flow: ['Camera', 'Detection', 'Tracking', 'Behavior', 'Radar', 'Fusion', 'Risk Decision'],
    body: {
      en: 'Local webcam and Dahua RTSP feeds run through YOLO person + weapon models; a serial radar reader parses LD2450 frames in parallel. A Flask backend fuses both signals and streams annotated video and live status to a React dashboard.',
      he: 'זרמי webcam מקומי ו־Dahua RTSP עוברים דרך מודלי YOLO לאדם ולנשק; קורא רדאר טורי מפענח מסגרות LD2450 במקביל. שרת Flask ממזג את שני האותות ומזרים וידאו מנותח וסטטוס חי לדשבורד React.',
    },
  },
  mvp: {
    title: { en: 'Current MVP', he: 'ה־MVP הנוכחי' },
    items: [
      { en: 'Live person detection with tracking and behavior states', he: 'זיהוי אנשים חי עם מעקב ומצבי התנהגות', status: 'working' },
      { en: 'Weapon detection model (fault-tolerant when unavailable)', he: 'מודל זיהוי נשק (עמיד לתקלות כשאינו זמין)', status: 'working' },
      { en: 'Radar pipeline with full parser + scenario simulator', he: 'צינור רדאר עם מפענח מלא + סימולטור תרחישים', status: 'working' },
      { en: 'Scalar sensor fusion into SAFE / ALERT / DANGER', he: 'היתוך חיישנים סקלרי למצבי SAFE / ALERT / DANGER', status: 'working' },
      { en: 'Persistent detection log with evidence snapshots', he: 'יומן זיהויים קבוע עם תמונות ראיה', status: 'working' },
      { en: 'Live radar hardware integration', he: 'אינטגרציית חומרת רדאר חיה', status: 'in-verification' },
    ],
  },
  vision: {
    title: { en: 'Vision', he: 'חזון' },
    note: {
      en: 'Future direction — not yet implemented.',
      he: 'כיוון עתידי — טרם מומש.',
    },
    items: [
      { en: 'Spatial fusion: matching each radar target to its camera track', he: 'היתוך מרחבי: שיוך כל מטרת רדאר למעקב המצלמה שלה' },
      { en: 'Multi-camera, multi-zone site coverage', he: 'כיסוי אתר מרובה מצלמות ואזורים' },
      { en: 'Fused confidence metric for every decision', he: 'מדד ביטחון ממוזג לכל החלטה' },
      { en: 'Automatic incident timelines and reporting', he: 'צירי זמן ודוחות אירועים אוטומטיים' },
    ],
  },
}
