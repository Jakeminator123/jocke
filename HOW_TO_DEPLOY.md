# Guide: Hur man pushar och deployar Jocke Dashboard

## 📋 Översikt

Jocke-dashboarden är ett **separat git-repo** som ligger i `10_jocke/` mappen.
- **GitHub Repo**: `https://github.com/Jakeminator123/jocke`
- **Render URL**: `https://jocke.onrender.com`
- **Auto-deploy**: Render deployar automatiskt när du pushar till `main` branch

---

## 🔄 Två typer av uppdateringar

### 1. **Kodändringar** (kräver push + deploy)
När du ändrar kod i `dashboard/` mappen:
- ✅ Pusha till GitHub → Render deployar automatiskt
- ⏱️ Tar ~2-5 minuter

### 2. **Data-upload** (ingen deploy behövs!)
När du uploadar ZIP-filer med data:
- ✅ Data läses direkt från `/var/data/` på servern
- ✅ Ingen deploy behövs - data är tillgänglig direkt
- ⚡ Omedelbar tillgänglighet

---

## 🚀 Steg-för-steg: Pusha kodändringar

### Steg 1: Navigera till Jocke-repot
```bash
cd 10_jocke
```

### Steg 2: Kolla status
```bash
git status
```

### Steg 3: Lägg till ändringar
```bash
git add dashboard/
# eller specifika filer:
git add dashboard/app/api/search/route.ts
```

### Steg 4: Committa
```bash
git commit -m "Beskrivning av ändringarna"
```

### Steg 5: Pusha till GitHub
```bash
git push origin main
```

### Steg 6: Render deployar automatiskt
- Render detekterar push till `main` branch
- Bygger Next.js-appen automatiskt
- Deployar till `https://jocke.onrender.com`
- Tar ~2-5 minuter

---

## 📤 Steg-för-steg: Uploada data (ingen deploy!)

### Metod 1: Automatiskt via main.py
```bash
python main.py
```
- Steg 6: Skapar ZIP → kopierar till `10_jocke/data_bundles/`
- Steg 8: Uploadar automatiskt till dashboard (om `UPLOAD_SECRET` är satt)

### Metod 2: Manuellt upload
```bash
python 9_dropbox/upload_to_dashboard.py --all
```
eller för specifik datum:
```bash
python 9_dropbox/upload_to_dashboard.py 20260122
```

### Vad händer vid upload:
1. ✅ ZIP skickas till `/api/upload/bundle`
2. ✅ Dashboarden extraherar till `/var/data/YYYYMMDD/`
3. ✅ Data indexeras i SQLite (`_index.sqlite`)
4. ✅ Sajten läser direkt från `/var/data/` - **ingen deploy behövs!**

---

## 🔍 Kontrollera deploy-status

### På Render Dashboard:
1. Gå till https://dashboard.render.com
2. Välj "jocke" service
3. Se "Events" för deploy-status

### Via terminal (efter push):
```bash
# Kolla om deploy är klar
curl https://jocke.onrender.com/api/data/totals
```

---

## ⚠️ Viktiga noteringar

### Data vs Kod
- **Data (ZIP-filer)**: Läses direkt från `/var/data/` → Ingen deploy behövs
- **Kod (TypeScript/React)**: Kräver push + Render deploy

### Git-struktur
```
pang/ (huvudrepo)
└── 10_jocke/ (SEPARAT REPO)
    ├── .git/ (egen git)
    ├── dashboard/ (Next.js-app)
    └── data_bundles/ (ZIP-filer, exkluderade från git)
```

### Render Auto-Deploy
- ✅ Automatisk deploy när du pushar till `main`
- ✅ Bygger med `npm run build`
- ✅ Startar med `npm start`
- ⚙️ Konfigurerat i Render Dashboard

---

## 🛠️ Felsökning

### Problem: Render deployar inte
1. Kolla att du pushade till `main` branch
2. Kolla Render Dashboard för felmeddelanden
3. Kolla build logs i Render

### Problem: Data visas inte efter upload
1. Kolla att upload lyckades (se loggar)
2. Kolla att data finns i `/var/data/YYYYMMDD/`
3. Kolla SQLite-index: `/var/data/_index.sqlite`

### Problem: Git push fungerar inte
```bash
# Kolla remote
git remote -v

# Sätt remote om den saknas
git remote add origin https://github.com/Jakeminator123/jocke.git
```

---

## 📝 Exempel: Komplett workflow

### Scenario: Du har ändrat kod OCH vill uploada ny data

```bash
# 1. Pusha kodändringar
cd 10_jocke
git add dashboard/
git commit -m "Fix search functionality"
git push origin main
# ⏳ Vänta ~3 minuter på Render deploy

# 2. Uploada data (från huvudrepo)
cd ..
python 9_dropbox/upload_to_dashboard.py --all
# ✅ Data är tillgänglig direkt - ingen deploy behövs!
```

---

## 🎯 Snabbreferens

| Vad | Var | Hur | Deploy? |
|---|---|---|---|
| **Kodändringar** | `10_jocke/dashboard/` | `git push` | ✅ Ja (~3 min) |
| **Data-upload** | `10_jocke/data_bundles/*.zip` | `upload_to_dashboard.py` | ❌ Nej (direkt) |
| **Miljövariabler** | Render Dashboard | Settings → Environment | ✅ Ja (om ändrat) |

---

## 💡 Tips

1. **Kodändringar**: Pusha ofta, Render deployar automatiskt
2. **Data-upload**: Kan göras när som helst, ingen deploy behövs
3. **Miljövariabler**: Ändras i Render Dashboard → kräver redeploy
4. **Testa lokalt**: `cd 10_jocke/dashboard && npm run dev`
