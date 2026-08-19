# Phase D — Review Gate Report (2026-07-18)

24 screenshots (4 concepts × 6 pages) captured at 1600×900 under the identical
frozen demo scenario `?demo=1&phase=approach`, logged in as admin, zero console
or page errors on every route. Artifacts: `docs/full-site-concepts/screenshots/<concept>/`.
Screenshots were re-taken after the fixes below, so the stored set reflects the
post-review state.

## Verdict per differentiation axis (vs concept-page-matrix.md)

| ציר | ממצא |
|---|---|
| Navigation | ✔ שונה בפועל: top bar טקסטואלי (Minimal) / dock צף עליון (Sentinel) / sidebar ימני עם קיצורי ⌥1–6 ומצב מערכת קבוע (Industrial) / node dock אנכי עם קו זרימה (Neural) |
| Dashboard | ✔ עמודה ממורכזת עם מילת מצב ענקית / סצנת 3D עם HUD בפינות / grid 12-עמודות עם טבלאות, session log ו-ticker אדום LIVE / pipeline רדיאלי עם wires מונפשים וצומת החלטה |
| Camera | ✔ פיד מקסימלי / פיד צף מעל התאום + מיקוד מטרה בסצנה / פיד בעמודה עם טבלאות צמודות ו-radar plot אורתוגרפי / פיד בליבת טבעות עם מטרות אורביטליות לחיצות |
| Investigation | ✔ split רשימה/פרטים / spatial replay (מיקום המטרה המשוחזר על grid) / טבלת אירועים צפופה עם record מפורט / timeline אנכי עם שרשרת סיבות כ-chips |
| About | ✔ סיפור אנכי / דיאגרמת orbit סביב ליבת FUSION / מסמך מפרט ממוספר 1.0–6.0 במונו / מסע שלבים עם קו זרימה |
| Settings | ✔ עמודה אחת שקטה / פאנלים צפים ללא 3D / טאבים RADAR-OPERATOR-GENERAL + טבלת ACTIVE VALUES ייחודית / כרטיסי זכוכית לפי חיישן. בכולם הטופס נשאר שמיש ולא עמוס |
| Admin | ✔ טבלה נקייה / פאנל צף / הצפוף ביותר — status strip עליון נוסף, mono, אקצנטים אדומים / כרטיס זכוכית עם גרף-גישה קל. עם משתמש אחד בלבד ההבדל מוגבל מטבעו |
| Motion | ✔ subtle / cinematic רק בתאום / snap ללא דקורציה / dash-flow על ה-wires בלבד. `prefers-reduced-motion` מכובד גלובלית (motion-tokens) |
| Risk display | ✔ מילת מצב + מספר גדול / HUD FUSED / שורת מדדים FUSED-CAM-RDR + גרף אדום / צומת החלטה במרכז ה-pipeline |

בדיקות הדגשה שהתבקשו: Sentinel משתמש ב-3D רק ב-Dashboard+Camera (Investigation/About הם 2D מרחביים, Settings/Admin שקטים לגמרי) ✔; Neural מדגיש flow + "למה הסיכון" בכל עמוד ליבה ✔; Minimal נשאר מאופק ✔; Industrial Admin/Settings צפופים ומבצעיים יותר מהאחרים ✔.

**מסקנה: אף קונספט אינו reskin. עוברים את השער.**

## תיקונים שבוצעו כתוצאה מהביקורת

1. **ניווט כפול (חוצה-קונספטים, המשמעותי ביותר)** — ה-Navbar הגלובלי של האתר
   ("Smart Security") הוצג מעל כל קונספט ושבר את חוויית המוצר המלא ואת בידול
   הניווט. `Navbar.jsx` מחזיר עכשיו `null` על נתיבי `/concepts/*` בלבד (האתר
   הפעיל לא מושפע); `concepts-scope` עודכן ל-`min-height:100vh`.
2. **חיתוך טבלאות ב-RTL (חוצה-קונספטים)** — `.dm-table-scroll` ירש כיוון RTL
   ועיגן את הגלילה לימין, כך שהעמודות הראשונות של טבלאות `dir="ltr"` נחתכו
   (נראה ב-Neural Camera וב-Industrial Dashboard). תוקן ב-`direction:ltr` על
   קונטיינר הגלילה.
3. **bidi ב-Industrial About** — ה-tagline והערת ה-MVP העבריים ישבו בתוך header
   שמוגדר `dir="ltr"` (סגנון המסמך) והנקודה קפצה לצד הלא-נכון. תוקן עם
   `dir="auto"` על שתי הפסקאות; גוף הסעיפים היה תקין (RTL) מלכתחילה.

תיקון עקיף מוקדם יותר באותו סשן (לפני הצילומים): מפתחות אירועים כפולים
ב-`useDetections.js` שגרמו לבחירת אירוע דו-משמעית בכל עמודי ה-Investigation.

## מה לא תוקן במכוון

- הבדל ה-Admin בין הקונספטים מוגבל ויזואלית כשקיים משתמש אחד בלבד — מבני, לא באג.
- 4 שגיאות eslint ידועות-מראש ב-`data/*` (react-compiler style) — קדמו ל-phase,
  משותפות לכל הקונספטים, מתועדות ב-implementation-status.
