יש מנגנון **`entity_changes`** בקוד, והוא מבוסס על מנגנון ה-Pub/Sub הפנימי של PostgreSQL שנקרא **`LISTEN / NOTIFY`**.

הוא מאפשר לבסיס הנתונים "לצעוק" בזמן אמת לכל רכיב במערכת שמאזין לו ברגע שחלים שינויים ביישות.

### איך זה עובד שלב-אחר-שלב?

**1. השרשור בבסיס הנתונים (Database Trigger והפרדת ערוצים)**

- בעת הרצת `trg_entities_notify`, נבנה ה-Payload שמכיל את ה-`mission_id`, ה-`entity_id`, וה-`last_change_seq` (הנגזר מהמונה המשימתי `missions.last_change_seq`).
    
- **הפרדת ערוצים (Topics):** השרת מפיץ את ההתראה ל-NATS Subject מבוסס משימה, למשל `events.mission.<mission_id>.entities`. הפרדה זו מבטיחה שמשתמשים הרשומים למשימה X יקבלו אך ורק את האירועים הרלוונטיים אליהם ולא ייחשפו לשינויים של משימות אחרות במערכת.


**2. סנכרון דלתה דינמי (Delta Sync) באמצעות שעון וקטורי (Vector Clock)**

- **מבנה הגרסה וההודעות:** כל עדכון והודעת התראה ב-NATS נושאים את מזהה הצומת שיצר את השינוי (`origin_node`) ואת המונה המשימתי שלו (`mission_change_seq`). שילוב זה מייצר מזהה גרסה ייחודי (למשל `PC1-1`, `PC2-3`), המונע התנגשויות או בלבול בין מונים של מחשבים שונים בזמן נתק.
    
- **שעון וקטורי דינמי בלקוח:** ה-Frontend אינו מניח מספר קבוע של מחשבים (1, 2 או 3), אלא מחזיק בזיכרון מילון דינמי המתעדכן אוטומטית מתוך רשימת הישויות:
    ```typescript
    const vectorClock: Record<string, number> = entities.reduce((acc, entity) => {
      if (entity.origin_node) {
        acc[entity.origin_node] = Math.max(acc[entity.origin_node] ?? 0, entity.mission_change_seq);
      }
      return acc;
    }, {});
    ```
    
- **תמיכה במחיקה רכה (Soft Delete):** השאילתה מחזירה את כל השורות שעודכנו, כולל שורות עם `isDeleted = true`. הלקוח ב-Frontend מקבל את הישות ומסיר/מעדכן אותה במפה בהתאם לדגל.
    
- **שאילתת דלתה מבוססת JSONB:** הלקוח מעביר את ה-`vectorClock` שלו כפרמטר JSONB (`$2`), והשאילתה שולפת באופן דינמי אך ורק ישויות שהתחדשו ביחס למה שהלקוח מכיר לכל צומת:
    
    ```sql
    SELECT * 
    FROM entities e
    WHERE e.mission_id = $1 
      AND e.mission_change_seq > COALESCE(($2 ->> e.origin_node)::bigint, 0)
    ORDER BY e.mission_change_seq ASC;
    ```
    
    *יתרונות המימוש:*
    - דינמיות מלאה לכל כמות צמתים ללא שינוי קוד.
    - אם בבסיס הנתונים קיימות ישויות מצומת חדש שהלקוח טרם הכיר, `COALESCE` יחזיר `0` וימשוך את כל הישויות מאותו צומת.
    - אם אין נתונים חדשים יותר מאף צומת, השאילתה מחזירה 0 שורות והשרת מחזיר `304 Not Modified`.
   
- **אינדקס ייעודי לביצועי שליפת דלתה:**
    
    ```sql
    CREATE INDEX IF NOT EXISTS idx_entities_mission_delta 
    ON entities (mission_id, origin_node, mission_change_seq ASC);
    ```


**3. סיכום הזרימה המלאה**

1. **שינוי במידע**: משתמש/שירות מעדכן `properties` או מיקום ביישות.
    
2. **טריגר עדכון נתונים ומונה**: `trg_route_lww_backup` מעלה את ה-`version` של היישות, מגבה ל-`route_backups`, ומקדם אטומית את `missions.last_change_seq` המועבר ל-`mission_change_seq`.
    
3. **טריגר התראה**: `trg_entities_notify` יורה הודעת JSON לערוץ **`entity_changes`**.
    
4. **אפליקציה מאזינה**: שירות הקוד (שמבצע `LISTEN entity_changes`) מקבל את ההודעה, מזהה שמשהו השתנה ב-`mission_id`, ומבקש רק את השינויים החדשים (`getEntityDeltaSince`).