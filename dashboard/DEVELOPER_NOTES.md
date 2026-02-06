# Developer Notes - Jocke Dashboard

## 📋 Viktig information för utvecklare/agenter

Detta dokument sammanfattar viktiga detaljer om dashboarden och dess integration med huvudpipelinen.

---

## 🔄 Data Upload vs Code Deploy

### ⚠️ KRITISKT: Inga redeploys vid data-upload!

**Dashboarden ska INTE redeploya när nya ZIP-bundles uploadas.**

Vad som händer vid data-upload:
1. ✅ ZIP-filen tas emot via `/api/upload/bundle`
2. ✅ Extraheras till `/var/data/YYYYMMDD/`
3. ✅ Data läses och normaliseras (`readDateData`)
4. ✅ SQLite-indexet uppdateras (`indexDateData`)
5. ✅ Sajten läser direkt från `/var/data/` och indexet

**Ingen rebuild eller redeploy behövs!** Data är tillgänglig direkt efter upload.

### När behövs deploy?

**Deploy behövs ENDAST för:**
- ✅ Kodändringar (TypeScript/React-filer)
- ✅ Nya dependencies (`package.json`)
- ✅ Miljövariabler ändras i Render Dashboard
- ✅ Konfigurationsfiler ändras (`next.config.ts`, etc.)

**Deploy behövs INTE för:**
- ❌ Data-upload (ZIP-filer)
- ❌ Excel-filer ändras
- ❌ SQLite-databaser uppdateras

---

## 📊 Nya kolumner i Excel-filer

### "Företagsnamn (normaliserat)" i Personer-sheetet

**Vad:** En ny kolumn som läggs till i `final_YYYYMMDD.xlsx` → sheet "Personer"

**Funktion:** Normaliserar företagsnamn för URL-safe användning:
- Mellanslag → bindestreck (`-`)
- Specialtecken tas bort
- Svenska tecken ersätts (å→a, ä→a, ö→o)
- Gemener

**Exempel:**
- `"AB Exempel Företag"` → `"ab-exempel-foretag"`
- `"Test & Co AB"` → `"test-co-ab"`

**Påverkan på dashboard:**
- ✅ Dashboarden läser denna kolumn om den finns
- ✅ Kan användas för URL-generering eller filtrering
- ✅ Ingen kodändring behövs - dashboarden hanterar den automatiskt

**Var skapas den:**
- `9_dropbox/create_final_excel.py` → `normalize_company_name_for_column()`
- Skapas automatiskt när `final_YYYYMMDD.xlsx` genereras

---

## 🗄️ SQLite Index System

### Automatisk indexering

Dashboarden använder ett SQLite-index (`_index.sqlite`) för snabb sökning och aggregering.

**Var ligger indexet:**
- Produktion: `/var/data/_index.sqlite`
- Lokalt: `10_jocke/data_input/_index.sqlite`

**När uppdateras det:**
- ✅ Automatiskt vid ZIP-upload (via `indexDateData`)
- ✅ Automatiskt vid första anrop till `/api/data/totals` eller `/api/search` (om datum saknas i indexet)

**Vad indexeras:**
- Companies (med `search_text` för fulltext-sökning)
- People (med `search_text`)
- Mails
- Audits
- Evaluations

**Viktigt:**
- Indexet uppdateras automatiskt - ingen manuell åtgärd behövs
- Om indexet saknas eller är korrupt, byggs det automatiskt om
- Indexet raderas när `/api/admin/clear-data` anropas

---

## 🔍 Data Reading Logic

### Prioritering av datakällor

Dashboarden läser data i följande ordning:

1. **Persistent disk** (`/var/data/`) - om den finns
2. **Local data** (`data_input/`) - fallback

**Viktigt:** `data_bundles/` används INTE längre för dataläsning (endast som staging för upload).

### Excel-fil prioritering

När flera Excel-filer finns i samma datum-mapp:

1. **`final_*.xlsx`** - högsta prioritet (mest komplett data)
2. **`kungorelser_*.xlsx`** - sekundär prioritet
3. **`mail_ready_*.xlsx`** - läggs till som kompletterande data
4. **SQLite-databaser** - läses också och mergas med Excel-data

**Logik:** `lib/data-reader.ts` → `readDateData()`

---

## 🚀 Deployment Workflow

### Automatisk deploy från GitHub

Render deployar automatiskt när:
- ✅ Push till `main` branch i `https://github.com/Jakeminator123/jocke`
- ✅ Build körs: `cd dashboard && npm run build`
- ✅ Start körs: `npm start`

### Miljövariabler

**Viktiga miljövariabler i Render:**
- `UPLOAD_SECRET` - API-nyckel för upload-endpoint
- `DASHBOARD_PASSWORD` - Lösenord för login
- `DATA_DIR` - Data-mapp (default: `/var/data`)

**Var sätts de:**
- Render Dashboard → Settings → Environment Variables

---

## 📝 API Endpoints

### Upload
- `POST /api/upload/bundle` - Uploada ZIP-bundle
  - Headers: `Authorization: Bearer <UPLOAD_SECRET>`, `X-Date: YYYYMMDD`
  - Body: ZIP-fil som binary data
  - Returnerar: `{ success: true, filesExtracted: number }`

### Data
- `GET /api/data/totals` - Aggregerad statistik (använder SQLite-index)
- `GET /api/data/dates` - Lista tillgängliga datum
- `GET /api/data/[date]` - Data för specifikt datum
- `GET /api/search` - Global sökning (använder SQLite-index)

### Admin
- `DELETE /api/admin/clear-data` - Rensa all data + index
- `GET /api/admin/clear-data` - Dry-run (visa vad som skulle raderas)

---

## 🐛 Troubleshooting

### Data visas inte efter upload

1. **Kolla upload-loggar:**
   ```bash
   # I Render Dashboard → Logs
   # Sök efter: [UPLOAD]
   ```

2. **Kolla att data extraherats:**
   - Data ska finnas i `/var/data/YYYYMMDD/`
   - ZIP-filen ska också finnas där

3. **Kolla SQLite-index:**
   - Indexet ska uppdateras automatiskt
   - Om inte: första anrop till `/api/data/totals` bygger det

4. **Kolla normalisering:**
   - Se `lib/normalize.ts` för fältmappningar
   - Se `lib/data-reader.ts` för läslogik

### Långsam sökning/totals

- ✅ Använd SQLite-indexet (används automatiskt om tillgängligt)
- ✅ Indexet byggs automatiskt vid upload
- ✅ Om saknas: första anrop bygger det

### Indexet är korrupt eller gammalt

- ✅ Rensa via `/api/admin/clear-data`
- ✅ Eller radera `/var/data/_index.sqlite` manuellt
- ✅ Indexet byggs automatiskt om vid nästa anrop

---

## 🔧 Code Structure

### Viktiga filer

```
dashboard/
├── lib/
│   ├── data-reader.ts      # Läser och normaliserar data från datum-mappar
│   ├── normalize.ts        # Normaliserar fält från olika källor
│   ├── index-db.ts         # SQLite-index hantering
│   └── data-paths.ts       # Hanterar sökvägar (/var/data vs local)
├── app/
│   ├── api/
│   │   ├── upload/bundle/  # ZIP-upload endpoint
│   │   ├── data/           # Data-endpoints
│   │   └── search/         # Sök-endpoint
│   └── page.tsx            # Huvudsida
└── public/
    └── assets/
        └── dataflow_simple.svg  # Dataflödesdiagram
```

### Dataflöde

```
ZIP Upload → Extract → Normalize → Index → API → Frontend
     ↓           ↓          ↓         ↓       ↓        ↓
/var/data/  readDateData  normalize  SQLite  Next.js  React
```

---

## ⚠️ Viktiga regler

1. **ALDRIG redeploy vid data-upload** - Data läses direkt från disk
2. **ALDRIG manuellt ändra SQLite-indexet** - Det uppdateras automatiskt
3. **ALDRIG läsa från `data_bundles/`** - Använd `/var/data/` eller `data_input/`
4. **ALDRIG hårdkoda sökvägar** - Använd `lib/data-paths.ts`

---

## 📚 Ytterligare dokumentation

- `HOW_TO_DEPLOY.md` - Steg-för-steg deploy-guide
- `README.md` - Allmän projektinformation
- `public/assets/dataflow_simple.svg` - Visuellt dataflöde

---

## 🤝 För framtida utvecklare

Om du lägger till nya funktioner:

1. **Nya Excel-kolumner:** Lägg till i `lib/normalize.ts` → field mappings
2. **Nya datatyper:** Lägg till i `NormalizedData` interface
3. **Nya API-endpoints:** Följ mönstret i `app/api/`
4. **Nya sökfunktioner:** Uppdatera `lib/index-db.ts` för att indexera nya fält

**Kom ihåg:** Data-upload ska ALDRIG trigga redeploy - bara indexering!

---

*Senast uppdaterad: 2026-01-22*
