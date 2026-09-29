# Running the app on your own computer (localhost)

This guide gets the platform running at **http://localhost:3000** on a Mac, step by step. Windows and Linux work the same way; only the install commands in step 1 differ.

You need about 15 minutes the first time. After that, starting the app takes one command (step 6).

---

## 1. Install the tools (once)

You need three things:

| Tool | Why |
|---|---|
| **Node.js 22** (20.9 or newer works) | runs the app |
| **PostgreSQL 16** (14 or newer works) | the database |
| **Git** (optional) | to download the code from GitHub |

**On a Mac, with [Homebrew](https://brew.sh):**

```bash
brew install node@22 postgresql@16 git
brew services start postgresql@16      # starts the database now and at every login
```

Check that they work:

```bash
node -v          # v22.x
psql --version   # psql (PostgreSQL) 16.x
```

> **No Homebrew?** Install Node.js from <https://nodejs.org> (the LTS button) and PostgreSQL from <https://postgresapp.com>.
>
> **Prefer Docker?** Skip PostgreSQL. [Docker Desktop](https://www.docker.com/products/docker-desktop/) can run the database for you (step 3, option B).

---

## 2. Get the code

If you already have the `CivicReport` folder, open a Terminal in it and skip to step 3:

```bash
cd ~/Documents/CivicReport
```

From GitHub instead:

```bash
git clone https://github.com/<your-account>/civicreport.git
cd civicreport
```

Then install the app's libraries:

```bash
npm install
```

---

## 3. Create the database

**Option A: PostgreSQL installed with Homebrew or Postgres.app.** Create a user and a database called `civic` / `civicreport`:

```bash
psql postgres -c "CREATE USER civic WITH PASSWORD 'civic' CREATEDB;"
psql postgres -c "CREATE DATABASE civicreport OWNER civic;"
psql postgres -c "CREATE DATABASE civicreport_test OWNER civic;"   # only needed to run the tests
```

**Option B: Docker.** One command starts a database with exactly these settings:

```bash
docker compose up -d db
```

---

## 4. Settings file (`.env`)

```bash
cp .env.example .env
```

The defaults already match step 3, so for a local run you don't have to change anything. The most important lines:

| Setting | Meaning |
|---|---|
| `DATABASE_URL` | where the database is (`civic:civic@localhost:5432/civicreport`) |
| `APP_URL` | `http://localhost:3000` |
| `EMAIL_PROVIDER=mock`, `SMS_PROVIDER=mock` | nothing is really sent. Messages appear at <http://localhost:3000/dev/mailbox> |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional "Continue with Google". Leave empty to hide the button (see the README) |

`.env` holds passwords and keys. It is ignored by Git, so it never ends up on GitHub.

---

## 5. Create the tables and the demo data

```bash
npm run db:deploy     # creates the tables
npm run db:seed       # roles, categories, departments, demo accounts and ~90 demo reports
```

---

## 6. Start the app

```bash
npm run dev
```

Open **<http://localhost:3000>**. Stop it with `Ctrl + C`. Next time, only this step is needed.

### Demo accounts

All of them use the password **`CivicDemo2026!`**.

| Role | E-mail |
|---|---|
| Super admin (everything, incl. the workflow editor) | `superadmin@civicreport.test` |
| Admin | `admin@civicreport.test` |
| Operator (street lighting) | `operator.iluminat@civicreport.test` |
| Citizen | `citizen@civicreport.test` |

The back office is at **<http://localhost:3000/admin>**.

---

## 7. Try it on your phone (optional)

The phone must be on the **same Wi-Fi** as the computer.

1. Start the app as usual with `npm run dev`. Next to `Local:` it also prints a `Network:` address, for example `http://192.168.1.23:3000`. (You can also find the computer's IP in *System Settings → Wi-Fi → Details*.)
2. On the phone, open that `Network:` address.

Over plain `http://`, phones block **"my location"**, **Share** and **copy link**; they require HTTPS. For a temporary HTTPS address, use a free Cloudflare tunnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

It prints an address like `https://something-random.trycloudflare.com`. Open that on the phone. It works as long as the command is running.

---

## 8. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | start the app (development mode) |
| `npm run db:seed` | add the configuration and demo data again (safe to repeat) |
| `npm run db:relocate-demo` | after changing the city in `config/branding.ts`, moves the demo reports to the new city |
| `npm run db:deploy` | apply database changes after updating the code |
| `npm test` | run the automated tests |
| `npm run build && npm start` | run the optimised (production) version locally |

**Changing the look:** logo, colours, name and city map settings are all in `config/branding.ts`. Restart `npm run dev` after editing it.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **"E-mail sau parolă incorecte"** with the demo accounts | The demo data wasn't created. Run `npm run db:seed` and check that it ends without errors. |
| `Can't reach database server at localhost:5432` | PostgreSQL isn't running: `brew services start postgresql@16` (or `docker compose up -d db`). |
| `Environment variable not found: DATABASE_URL` | The `.env` file is missing. Repeat step 4. |
| `Port 3000 is already in use` | Another copy is still running. Close that Terminal, or use `npm run dev -- -p 3001`. |
| **"Harta nu a putut fi încărcată"** / the WebGL message | The browser has graphics acceleration (WebGL) off. Quit Chrome completely (`Cmd + Q`) and reopen it, or try Safari. Also check that an ad blocker isn't blocking `tiles.openfreemap.org`. |
| The phone shows the page but "my location" does nothing | Phones need HTTPS for location. Use the Cloudflare tunnel from step 7. |
| After `git pull`, errors about missing tables or columns | Run `npm install` and `npm run db:deploy`. |
