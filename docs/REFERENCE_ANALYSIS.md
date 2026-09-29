# Reference analysis & implementation plan

This document records what was observed on the reference civic-reporting platform
(inspected on 2026-09-24 as an anonymous visitor, desktop 1280×720 and mobile 375×812)
and how each observed behaviour maps onto CivicReport.

The reference was used **only as a functional / UX specification**. No branding, logos,
colours-as-identity, names, real report texts, photographs or personal data were copied.
Everything marked **[ASSUMPTION]** could not be observed directly (it sits behind the
authentication wall) and was inferred from public UI, client-side validation messages and
component names visible in the public JavaScript bundle.

---

## 1. Routes discovered

| Reference route | Behaviour | CivicReport route |
|---|---|---|
| `/` | Full-screen map of reports + floating filter panel + "Add report" CTA | `/` (also `/reports` alias) |
| `/sesizari/{ID}` | Report detail opened as a **modal on top of the map** (intercepted route). Direct load renders the same content. Browser back closes the modal. | `/reports/{number}` (modal when navigated from the map, full page on direct load) |
| `/#adauga` | Opens the "New report" dialog. Anonymous users are redirected to login with `return_to=sesizari/#adauga` | `/reports/new` → `/login?returnTo=/reports/new` when anonymous |
| account site `/login` | Phone-number login (SMS one-time code), national eID login, passkey login, FAQ accordion | `/login` (email + password **and** phone OTP via mock SMS) |
| account site `/register` | 4 numbered sections: Identity, national ID number, Contact, Address, + ID document, GDPR + truthfulness checkboxes | `/register` (numbered sections; national-ID fields intentionally **not** collected — see §8) |
| "All my reports" link inside filter panel (logged-in only) | Map switches to "mine" mode, default period extended to 1 year | `/?mine=1` + `/account/reports` |
| `/api/geocode` (POST) | Forward + reverse geocoding proxy | `POST /api/geocode` |
| `/api/nomenclator/strazi` | Street-name autocomplete from municipal street registry | `GET /api/geocode/search?q=` (address autocomplete via geocoder) **[ASSUMPTION: no public street registry for a fictional city]** |

## 2. Page anatomy — home / map

* **Header** (brand-coloured bar): logo + two-line organisation name (left); desktop nav:
  "Services ▾", "Administration ▾", "My account", search icon, "Official gazette" link.
  Mobile: logo + "Menu ▾" + search icon.
  → CivicReport: configurable nav links from `config/branding.ts`, account menu, language switch.
* **Map** fills the viewport under the header. MapLibre GL, vector tiles, city boundary
  highlighted with a grey mask outside the municipality.
  * Reports drawn as small circles coloured by status (`pointLayer`) + a `labelsLayer`.
  * **Heat-map toggle** button bottom-left ("Toggle heat map").
  * Zoom +/− top-right; attribution bottom-right.
  * **Hover** on a point (desktop) shows a preview card: ID, status badge, date,
    description excerpt, attachment thumbnails, "Details →" button.
    Touch devices open the detail directly.
  * Thumbnails open a **lightbox carousel** (arrow keys, loop, "n / total").
* **Filter panel** (floating card top-left, accordion):
  1. **Status** — collapsed header shows coloured dots; expanded: one row per status
     group with colour dot, label and **count**; click toggles the group.
  2. **Category** — checkbox list with counts, "Deselect all / Select all".
  3. **Period** — collapsed shows "Last 30 days"; expanded: From / To date inputs,
     "Reset" and "Apply" (Apply disabled while unchanged).
  4. (logged in) "All my reports" link.
* **CTA** "Add report" — pill button, bottom-centre, respects `safe-area-inset-bottom`.

### Status model observed
Internal statuses: *Registered, Planned, In progress, Resolved, Declined competence
(redirected), Awaiting clarification, Finalised*.
Public filter groups (plural labels): **Submitted, In progress, Resolved, Planned,
Redirected**. Colours: submitted = dark blue, in progress = amber, resolved = green,
planned = sky blue, redirected = violet, fallback slate.
→ CivicReport: fully data-driven `report_statuses` table, each status belongs to a
`publicGroup`; transitions in `status_transitions`; colours & labels editable by super-admin.

## 3. Report detail (modal)

* Coloured title bar with the **registration number** (`PREFIXyyyy-nnnnnn`) and close (×).
* Left (2/3): full description (pre-wrapped).
* Right (1/3) cards with a brand-coloured top border:
  * **Details**: Registration no., Status (solid colour badge), Category, Subcategory,
    Location (street/area text).
  * **History**: vertical timeline — date + time on the left, coloured dot, status pill.
* Reporter identity is **never** shown publicly.
* Photos (from preview card code) rendered as thumbnails with lightbox.
→ CivicReport adds a mini map, public updates / official response, and attachments list.

## 4. New report flow **[ASSUMPTION — behind login]**

From client-side validation + component names in the public bundle:

* Dialog titled "New report", footer: Cancel / Submit (spinner while submitting).
* **Location selector**: map in "select" mode — pin stays at map centre, user pans the map;
  bottom sheet with **Street** (autocomplete, "clear street", "no street found",
  "N more results — keep typing") + **Number**; reverse geocoding fills the street.
  A report may be submitted **with or without** a location; with location both street and
  coordinates are required.
* **Description**: required, **min 13 chars**, **max 1024**, live counter "n / 1024".
* **Category** (required) → **Subcategory** (required, dependent select).
* A notice for categories handled by the local police.
* **Files**: multiple, **max 10 files, max 25 MB each**, drag & drop area, per-file upload
  progress/success/error icon, 4:3 image previews, red delete button with
  "Are you sure you want to delete the file?" confirmation.
* Account section uses a **step indicator** ("Completion steps", "step x / n").
→ CivicReport implements this as a 5-step wizard + confirmation screen (Location →
  Category → Description → Photos → Review → Confirmation with generated number).

## 5. Authentication observed

* Phone-number + SMS code (primary), national eID (OIDC), passkeys.
* Registration collects identity, contact, address, ID document; GDPR + "false statements"
  consents.
→ CivicReport: email/password (scrypt) + **phone OTP via `SmsProvider`**; email verification
  and password reset via `EmailProvider`; mock providers write to a dev mailbox (`/dev/mailbox`).
  External identity providers are left as an extension point (`lib/auth/providers.ts`).

## 6. Responsive behaviour

| Width | Reference behaviour | CivicReport |
|---|---|---|
| ≥1024 | Full nav, floating filter card, hover previews | same |
| 768–1023 | Condensed nav | same, "Menu" dropdown |
| <768 | "Menu ▾" dropdown, filter card spans width minus gutters, CTA larger, detail dialog is **full-screen** (`inset-0`), no hover (tap → detail) | same + filter panel collapses into a bottom **drawer** below 640px, 44px touch targets |

## 7. Entities implied by the UI

User, Role/Permission, Report (number, description, category, subcategory, status, street,
number, lat/lng, created/updated), ReportStatus (+colour, group), StatusHistory, Attachment
(path, name, size), Category (tree with subcategories, handling department), Department,
Employee, Notification, AuditLog, Geocoding cache.

## 8. Deliberate differences / assumptions

1. **No national ID numbers** are collected at registration — not needed for a generic
   product and high-risk data. The registration form keeps the numbered-section layout.
2. **Title field** added (requested in the brief) — optional in the reference.
3. Address autocomplete uses the geocoder (Nominatim / mock) instead of a municipal
   street registry.
4. Admin back-office of the reference is not public; the admin app is designed from the
   brief and common municipal case-management practice.
5. Demo city is fictional ("Demo City"); seed reports are generated around the
   configurable map centre with fictional street names.
