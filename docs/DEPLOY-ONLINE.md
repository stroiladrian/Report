# Putting the app online

This guide takes the platform from your computer to a real address such as **https://sesizari.primaria-exemplu.ro** that residents can open on their phones.

---

## First: why not GitHub Pages?

**GitHub Pages** hosts *static* websites only: fixed HTML, CSS and JavaScript files. It cannot run a server program and it has no database.

This platform needs both:

- a **Node.js server** for logins, saving reports, uploading photos, sending notifications and checking permissions
- a **PostgreSQL database** where the reports, users and history live

So GitHub Pages won't work here. GitHub is still useful: it keeps your code safe and versioned, and hosting services can deploy straight from it.

The plan:

1. Put the code on **GitHub** (a private repository).
2. Run it on a **server** that can run Node.js and PostgreSQL:
   - **Option A (recommended):** your own small cloud server (a VPS). You get full control and can keep the data in the EU.
   - **Option B:** a hosting platform that deploys from GitHub for you (for example Render).

---

## Step 1: Put the code on GitHub

1. Create an account at <https://github.com>, then create a **new private repository** (for example `civicreport`). Don't add a README, `.gitignore` or licence; the project already has them.
2. In a Terminal, inside the project folder:

   ```bash
   cd ~/Documents/Report
   git init
   git add .
   git commit -m "Report"
   git branch -M main
   git remote add origin https://github.com/stroiladrian/Report.git
   git push -u origin main
   ```

   When Git asks for a password, use a **personal access token**, not your GitHub password. Create one under *GitHub → Settings → Developer settings → Personal access tokens*. [GitHub Desktop](https://desktop.github.com) is a click-through alternative.

3. **Check that no secrets went up.** The `.gitignore` file already excludes `.env` (passwords and keys), `node_modules`, `.next` and `storage/` (uploaded photos). On GitHub, `.env` must **not** appear in the file list; `.env.example` is fine.

After a change, you publish it with:

```bash
git add . && git commit -m "Describe the change" && git push
```

---

## Step 2, option A: your own server (VPS) with Docker

The project includes everything needed to run on a server:

| File | Role |
|---|---|
| `docker-compose.prod.yml` | starts the database, the app and Caddy together |
| `deploy/Caddyfile` | Caddy, the web server that gets and renews the free HTTPS certificate |
| `deploy/env.production.example` | the settings template for the server |

### What you need

- **A server:** Ubuntu 24.04, at least **2 GB RAM** (4 GB is more comfortable when the app is being built), about 20 GB of disk. Any provider works: Hetzner, DigitalOcean, OVH, or a Romanian provider. Choose an EU data centre, since the data includes residents' personal details.
- **A domain or subdomain**, for example `sesizari.primaria-exemplu.ro`. In the domain's DNS settings, add an **A record** that points it to the server's IP address.

### Install

Connect to the server (the provider gives you the IP and root access):

```bash
ssh root@<SERVER-IP>
```

**1. Install Docker and a basic firewall:**

```bash
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

**2. Download the code from GitHub:**

```bash
git clone https://github.com/stroiladrian/Report.git
cd Report
```

The repository is private, so Git asks for your GitHub username and the access token from step 1.

**3. Create the server settings:**

```bash
cp deploy/env.production.example .env
nano .env
```

Fill in at least:

| Setting | Example |
|---|---|
| `DOMAIN` | `sesizari.primaria-exemplu.ro` |
| `APP_URL` | `https://sesizari.primaria-exemplu.ro` |
| `POSTGRES_PASSWORD` | a long random value: run `openssl rand -hex 24` and paste the result |
| `SEED_ADMIN_EMAIL` | the first administrator's e-mail |
| `SEED_PASSWORD` | their first password (at least 12 characters) |

Save with `Ctrl + O`, `Enter`, and exit with `Ctrl + X`.

**4. Start everything:**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes a few minutes. The database tables are created automatically when the app starts, and Caddy requests the HTTPS certificate on its own.

**5. Add the starting data (once):**

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm tools
```

With `SEED_PRODUCTION=1` (the template's default) this creates:

- the roles, the report workflow, and a starting set of departments and categories, which you can edit in the back office
- **one super admin** with `SEED_ADMIN_EMAIL` / `SEED_PASSWORD`

It creates no demo accounts and no demo reports. For a **demo server** full of sample data (like your localhost), set `SEED_PRODUCTION=` (empty) before this step.

**6. Open `https://<your domain>`**, log in with the admin account, and then:

- change the password (*Contul meu → Setări*)
- review **Departamente** and **Categorii** in the back office
- create accounts for the staff (**Utilizatori**)

### Everyday tasks

| Task | Command (inside the `civicreport` folder on the server) |
|---|---|
| Update to the latest code from GitHub | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| See the logs | `docker compose -f docker-compose.prod.yml logs -f app` |
| Restart | `docker compose -f docker-compose.prod.yml restart app` |
| Stop everything | `docker compose -f docker-compose.prod.yml down` (data is kept) |

### Backups (please set these up)

Everything important lives in two places: the **database** and the **uploaded photos**.

```bash
# Database → a dated file
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U civic civicreport | gzip > backup-$(date +%F).sql.gz

# Photos → a dated archive
docker run --rm -v civicreport_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Copy these files off the server regularly (most providers also offer automatic server snapshots). The volume name is `<folder name>_uploads`; check it with `docker volume ls`.

---

## Step 2, option B: a hosting platform connected to GitHub (Render)

Platforms such as [Render](https://render.com) build and restart the app automatically on every `git push`, with no server to maintain. In the Render dashboard:

1. **New → PostgreSQL.** Create a database and copy its **Internal Database URL**.
2. **New → Web Service → connect your GitHub repository.** Render detects the `Dockerfile`.
3. **Environment:** add the same settings as in `deploy/env.production.example`:
   - `DATABASE_URL` = the URL from step 1
   - `APP_URL` = the service's `https://…onrender.com` address, or your own domain after you add it under *Settings → Custom Domains*
   - `UPLOAD_DIR=/app/storage/uploads`
4. **Disks:** add a persistent disk mounted at `/app/storage/uploads`. Without it, uploaded photos disappear at every deploy.
5. Deploy. For the first data, run once from your own computer against the Render database (use its **External** URL):

   ```bash
   DATABASE_URL="<external database url>" SEED_PRODUCTION=1 SEED_ADMIN_EMAIL=you@example.ro SEED_PASSWORD='a strong password' npm run db:seed
   ```

**Know the limits of free plans.** Render's free tier is fine for a quick trial only:

- free web services go to sleep when idle
- free services have no persistent disk
- the free PostgreSQL database expires after 30 days

For real use you need paid plans. Check the current prices on the provider's site. Railway and Fly.io work in a similar way.

---

## Before real residents use it: production checklist

- [ ] **HTTPS works** (Caddy or the platform handles it) and `APP_URL` is the `https://` address.
- [ ] **E-mail is real.** With `EMAIL_PROVIDER=mock` nothing is sent, so residents never get the account-verification e-mail and cannot submit reports. Connect a mail service through `EMAIL_PROVIDER=webhook` (see *Notifications* in the README). *Continue with Google* also works without e-mail, because Google accounts arrive already verified.
- [ ] **SMS**, if you want login by phone code: `SMS_PROVIDER=webhook` with your SMS provider.
- [ ] **Google login** (optional): add `https://<domain>/api/auth/google/callback` as a redirect URI in Google Cloud and set the two `GOOGLE_*` keys.
- [ ] **Branding:** name, logo, colours and city in `config/branding.ts`. Push the change and update the server.
- [ ] **No demo accounts** remain. If you seeded demo data, deactivate those users in **Utilizatori**.
- [ ] **Backups** are scheduled (see above).
- [ ] **Privacy policy** page (`/privacy`) reviewed with the city hall's data protection officer (DPO).
- [ ] **Address search:** the free OpenStreetMap Nominatim service allows about one request per second, which is fine for a town. Set `GEOCODER_CONTACT` to a real e-mail, as its usage policy requires.
