# Deploy gratuit: Vercel + Neon (+ Vercel Blob pentru poze)

Toate planurile de mai jos sunt gratuite. Vercel Hobby este doar pentru uz necomercial (demo / pilot).

## 1. Neon (baza de date)
1. neon.com → cont cu GitHub → proiect nou, regiunea Frankfurt.
2. *Connect*: copiază două șiruri (ambele cu `?sslmode=require`):
   - **direct** (fără `-pooler` în host) → pentru migrări și seed, de pe calculatorul tău;
   - **pooled** (cu `-pooler`) → pentru Vercel.

## 2. Tabele + date (de pe calculatorul tău, o singură dată)
```
DATABASE_URL="<șirul DIRECT>" npx prisma migrate deploy
# demo:
DATABASE_URL="<șirul DIRECT>" SEED_PASSWORD="o-parola-ta" npm run db:seed
# sau lansare reală (un singur super-admin, fără conturi demo):
DATABASE_URL="<șirul DIRECT>" SEED_PRODUCTION=1 SEED_ADMIN_EMAIL="tu@exemplu.ro" SEED_PASSWORD="o-parola-ta" npm run db:seed
```
Nu pune șirurile de conexiune în cod sau în chat.
Notă: dacă rulezi seed-ul de demo (cu poze) înainte să ai Blob, pozele demo nu vor exista online.
Fă pasul 4 (Blob) înainte, apoi adaugă `BLOB_READ_WRITE_TOKEN` și în comanda de seed.

## 3. Vercel
1. vercel.com → cont cu GitHub → *Add New → Project* → `stroiladrian/Report`.
2. Environment Variables:
   - `DATABASE_URL` = șirul **pooled**
   - `APP_URL` = `https://<proiect>.vercel.app` (după primul deploy, apoi redeploy)
   - `GEOCODER=nominatim`, `GEOCODER_CONTACT=<emailul tău>`
   - `EMAIL_PROVIDER=mock`, `SMS_PROVIDER=mock`
3. *Deploy*.

## 4. Poze (Vercel Blob)
Proiect Vercel → *Storage* → *Create* → *Blob* → conectează-l la proiect. Vercel adaugă automat
`BLOB_READ_WRITE_TOKEN`; aplicația trece singură pe Blob când tokenul există. Redeploy după.
Pentru a rula seed-ul cu poze demo pe Blob, copiază tokenul (Storage → Blob → `.env.local`) în comanda de seed.

## Limite
- E-mailurile/SMS-urile sunt `mock` (nu pleacă nicăieri); pe site public nu activa `DEV_MAILBOX`.
- Pozele mari sunt micșorate în browser (max 1920px) pentru limita de ~4,5 MB / cerere a Vercel.
- Neon adoarme baza după inactivitate: prima încărcare poate fi lentă.
