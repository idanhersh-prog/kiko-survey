# הקמת האזור האישי (KIKO Hub) – פעם אחת, כ־10 דקות

## 1. גיליון חדש
1. ב־Google Sheets פותחים גיליון ריק חדש וקוראים לו **KIKO Hub**.
2. לא צריך ליצור לשוניות – הן נוצרות לבד: `Users`, `Children`, `Access`, `Recommendations`, `Feedback`.

## 2. הקוד
1. בגיליון: **Extensions → Apps Script** (תוספים → Apps Script).
2. מוחקים את מה שיש בעורך, ומדביקים את כל התוכן של `backend/Hub_Code.gs` מהמאגר.
3. שומרים (💾).
4. בתפריט העליון בוחרים את הפונקציה **setup** ולוחצים **Run**. Google יבקש אישור הרשאות – מאשרים (Advanced → Go to … → Allow). אחרי זה יופיעו בגיליון 5 הלשוניות.

## 3. פרסום
1. **Deploy → New deployment**.
2. סוג: **Web app**.
3. Execute as: **Me**. Who has access: **Anyone**.
4. **Deploy** ← מעתיקים את ה־**Web app URL** (מסתיים ב־`/exec`).
5. שולחים את הכתובת ל־Claude, או מדביקים אותה בעצמכם ב־`assets/kiko-hub.js` בשורה `const HUB_URL = '';`.

## עדכון קוד בעתיד
אחרי שינוי ב־`Hub_Code.gs`: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. הכתובת נשארת אותה כתובת.

## שחזור קוד / סיסמה
פותחים את הלשונית `Users` ומחפשים לפי שם או טלפון/מייל. הקוד בעמודה `user_code` והסיסמה בעמודה `pin`.

## פרטיות
- הגיליון מכיל סיסמאות ומידע על ילדים – **לא לשתף אותו** עם אף אחד.
- באפליקציה מבקשים שם פרטי או כינוי בלבד, לא שם מלא.
