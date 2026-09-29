/**
 * Seed: roles & permissions, workflow, departments, categories, demo users and
 * ~90 fictional reports with history, comments and generated placeholder photos.
 *
 *   npm run db:seed            – idempotent for configuration; demo data only if no reports exist
 *   SEED_REPORTS=150 npm run db:seed
 *
 * Real launch (no demo accounts, no demo reports, one super admin):
 *   SEED_PRODUCTION=1 SEED_ADMIN_EMAIL=you@example.ro SEED_PASSWORD='a strong one' npm run db:seed
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { deflateSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { branding } from "../config/branding";
import { getStorage } from "../src/server/providers/storage";
import { hashPassword } from "../src/lib/auth/crypto";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DESCRIPTIONS, ROLE_KEYS } from "../src/lib/rbac/permissions";
import { DEFAULT_STATUSES, DEFAULT_TRANSITIONS } from "../src/server/domain/workflow";
import {
  CATEGORIES,
  CITIZENS,
  DEPARTMENTS,
  DISTRICTS,
  INTERNAL_NOTES,
  PUBLIC_UPDATES,
  REDIRECT_TARGETS,
  RESPONSES,
  STREETS,
  TEMPLATES,
} from "./demo-data";

const db = new PrismaClient();
export const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "CivicDemo2026!";

// Deterministic PRNG so every seed produces the same demo city.
let seed = 20260924;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
/** Random point within branding.map.demoRadiusKm of the centre, denser in the middle. */
export function demoPoint(clat: number, clng: number, rand: () => number = rnd) {
  const km = Number(process.env.SEED_RADIUS_KM ?? branding.map.demoRadiusKm);
  const r = Math.sqrt(rand()) * km;
  const a = rand() * Math.PI * 2;
  return {
    lat: clat + (r * Math.sin(a)) / 111.32,
    lng: clng + (r * Math.cos(a)) / (111.32 * Math.cos((clat * Math.PI) / 180)),
  };
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const chance = (p: number) => rnd() < p;

async function seedAccessControl() {
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await db.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  const perms = await db.permission.findMany();
  const names: Record<string, string> = { CITIZEN: "Citizen", OPERATOR: "Operator", ADMIN: "Administrator", SUPER_ADMIN: "Super administrator" };
  for (const [key, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await db.role.upsert({
      where: { key },
      create: { key, name: names[key]!, isSystem: true },
      update: { name: names[key]!, isSystem: true },
    });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: perms.filter((p) => (keys as string[]).includes(p.key)).map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }
}

async function seedWorkflow() {
  let order = 0;
  for (const s of DEFAULT_STATUSES) {
    const data = {
      key: s.key,
      label: { ro: s.ro, en: s.en },
      pluralLabel: { ro: s.roP, en: s.enP },
      publicGroup: s.group,
      color: s.color,
      sortOrder: (order += 10),
      isInitial: "isInitial" in s ? !!s.isInitial : false,
      isTerminal: "isTerminal" in s ? !!s.isTerminal : false,
      isResolved: "isResolved" in s ? !!s.isResolved : false,
    };
    await db.reportStatus.upsert({ where: { key: s.key }, create: data, update: {} });
  }
  if ((await db.statusTransition.count()) === 0) {
    const st = await db.reportStatus.findMany();
    const id = (k: string) => st.find((s) => s.key === k)!.id;
    await db.statusTransition.createMany({
      data: DEFAULT_TRANSITIONS.map(([f, t, req]) => ({ fromStatusId: id(f), toStatusId: id(t), requiresComment: !!req })),
    });
  }
}

async function seedOrganisation() {
  for (const d of DEPARTMENTS) {
    await db.department.upsert({ where: { code: d.code }, create: d, update: {} });
  }
  const depts = await db.department.findMany();
  let order = 0;
  for (const c of CATEGORIES) {
    const dept = depts.find((d) => d.code === c.dept)!;
    const parent = await db.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: { ro: c.ro, en: c.en },
        notice: c.notice,
        color: c.color,
        departmentId: dept.id,
        slaDays: c.sla,
        isSensitive: !!c.sensitive,
        sortOrder: (order += 10),
      },
      update: {},
    });
    let so = 0;
    for (const s of c.subs) {
      await db.category.upsert({
        where: { slug: s.slug },
        create: { slug: s.slug, name: { ro: s.ro, en: s.en }, color: c.color, parentId: parent.id, departmentId: dept.id, sortOrder: (so += 10) },
        update: {},
      });
    }
  }
}

async function upsertUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  dept?: string;
  jobTitle?: string;
  passwordHash: string;
}) {
  const role = await db.role.findUniqueOrThrow({ where: { key: data.role } });
  const user = await db.user.upsert({
    where: { email: data.email },
    create: {
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId: role.id,
      passwordHash: data.passwordHash,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: data.phone ? new Date() : null,
      consentAt: new Date(),
    },
    update: {},
  });
  if (data.dept) {
    const dept = await db.department.findUniqueOrThrow({ where: { code: data.dept } });
    await db.employee.upsert({
      where: { userId: user.id },
      create: { userId: user.id, departmentId: dept.id, jobTitle: data.jobTitle },
      update: {},
    });
  }
  return user;
}

async function seedUsers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await upsertUser({ email: "superadmin@civicreport.test", firstName: "Sam", lastName: "Superadmin", role: ROLE_KEYS.SUPER_ADMIN, passwordHash });
  await upsertUser({ email: "admin@civicreport.test", firstName: "Adriana", lastName: "Admin", role: ROLE_KEYS.ADMIN, passwordHash, dept: "BUILD", jobTitle: "Coordonator dispecerat" });
  const operators = [
    ["operator.drumuri@civicreport.test", "Ovidiu", "Drumaru", "ROADS"],
    ["operator.iluminat@civicreport.test", "Irina", "Luminescu", "LIGHT"],
    ["operator.salubrizare@civicreport.test", "Sorin", "Curățeanu", "SANIT"],
    ["operator.verde@civicreport.test", "Vera", "Verdeanu", "GREEN"],
    ["operator.trafic@civicreport.test", "Tudor", "Semaforescu", "TRAFFIC"],
    ["operator.utilitati@civicreport.test", "Ursula", "Apostol", "UTIL"],
    ["operator.patrimoniu@civicreport.test", "Paul", "Clădirescu", "BUILD"],
    ["operator.politie@civicreport.test", "Petra", "Ordinescu", "POLICE"],
  ] as const;
  for (const [email, fn, ln, dept] of operators) {
    await upsertUser({ email, firstName: fn, lastName: ln, role: ROLE_KEYS.OPERATOR, passwordHash, dept, jobTitle: "Operator" });
  }
  let i = 0;
  for (const [fn, ln] of CITIZENS) {
    i++;
    const email = i === 1 ? "citizen@civicreport.test" : `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`;
    await upsertUser({ email, firstName: fn, lastName: ln, role: ROLE_KEYS.CITIZEN, passwordHash, phone: i === 1 ? "+40700000001" : undefined });
  }
}

// ─── Placeholder images (PNG encoder, no dependencies) ─────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Generates an abstract "photo" placeholder: sky/ground gradient, category-coloured shape. */
export function placeholderPng(color: string, variant: number, w = 480, h = 360): Buffer {
  const [cr, cg, cb] = hex(color);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const horizon = Math.floor(h * (0.45 + (variant % 3) * 0.07));
  const cx = w * (0.3 + ((variant * 37) % 40) / 100);
  const cy = horizon + h * 0.12;
  const rad = h * (0.18 + (variant % 4) * 0.03);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      let r: number, g: number, b: number;
      if (y < horizon) {
        const t = y / horizon;
        r = 150 + 60 * t;
        g = 190 + 40 * t;
        b = 230 + 15 * t;
      } else {
        const t = (y - horizon) / (h - horizon);
        const stripe = ((x + y * 2) >> 4) % 2 === 0 ? 8 : 0;
        r = 120 - 40 * t + stripe;
        g = 118 - 40 * t + stripe;
        b = 112 - 40 * t + stripe;
      }
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < rad * rad) {
        const shade = 0.75 + 0.25 * (1 - (dx * dx + dy * dy) / (rad * rad));
        r = cr * shade;
        g = cg * shade;
        b = cb * shade;
      }
      const o = row + 1 + x * 3;
      raw[o] = Math.max(0, Math.min(255, r));
      raw[o + 1] = Math.max(0, Math.min(255, g));
      raw[o + 2] = Math.max(0, Math.min(255, b));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Demo reports ──────────────────────────────────────────────────

const PATHS: Record<string, string[]> = {
  submitted: ["submitted"],
  accepted: ["submitted", "accepted"],
  needs_info: ["submitted", "needs_info"],
  assigned: ["submitted", "accepted", "assigned"],
  planned: ["submitted", "accepted", "planned"],
  in_progress: ["submitted", "accepted", "assigned", "in_progress"],
  resolved: ["submitted", "accepted", "assigned", "in_progress", "resolved"],
  closed: ["submitted", "accepted", "assigned", "in_progress", "resolved", "closed"],
  redirected: ["submitted", "redirected"],
};
const FINAL_WEIGHTS: [string, number][] = [
  ["submitted", 12], ["accepted", 6], ["needs_info", 4], ["assigned", 8], ["planned", 6],
  ["in_progress", 22], ["resolved", 28], ["closed", 8], ["redirected", 6],
];
function weighted() {
  const total = FINAL_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let x = rnd() * total;
  for (const [k, w] of FINAL_WEIGHTS) if ((x -= w) < 0) return k;
  return "submitted";
}

async function seedReports() {
  if ((await db.report.count()) > 0) {
    console.log("Reports already exist – skipping demo reports.");
    return;
  }
  const count = Number(process.env.SEED_REPORTS ?? 90);
  const storage = getStorage();
  const statuses = await db.reportStatus.findMany();
  const sid = (k: string) => statuses.find((s) => s.key === k)!.id;
  const cats = await db.category.findMany({ where: { parentId: null }, include: { children: true } });
  const citizens = await db.user.findMany({ where: { role: { key: "CITIZEN" } } });
  const employees = await db.employee.findMany({ include: { user: true } });
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@civicreport.test" } });
  const { lat: clat, lng: clng } = branding.map.defaultLocation;
  const now = Date.now();
  const year = new Date().getFullYear();
  let seq = 0;

  const catWeights = cats.map((c) => ({ c, w: c.slug === "integrity" ? 1 : c.slug === "roads" || c.slug === "traffic" || c.slug === "green" ? 5 : 3 }));
  const pickCat = () => {
    let x = rnd() * catWeights.reduce((a, b) => a + b.w, 0);
    for (const { c, w } of catWeights) if ((x -= w) < 0) return c;
    return cats[0]!;
  };

  for (let i = 0; i < count; i++) {
    const cat = pickCat();
    const tpl = pick(TEMPLATES[cat.slug] ?? TEMPLATES.other!);
    const sub = tpl.sub ? cat.children.find((c) => c.slug === tpl.sub) ?? null : cat.children[0] ?? null;
    const final = weighted();
    const path_ = PATHS[final]!;
    // 55% within the last 30 days, the rest up to 180 days back
    const ageDays = chance(0.55) ? rnd() * 30 : 30 + rnd() * 150;
    const createdAt = new Date(now - ageDays * 86_400_000);
    const { lat, lng } = demoPoint(clat, clng);
    const street = pick(STREETS);
    const nr = String(1 + Math.floor(rnd() * 90));
    const reporter = pick(citizens);
    const dept = cat.departmentId;
    const deptEmployees = employees.filter((e) => e.departmentId === dept && e.user.email?.startsWith("operator"));
    const assignee = path_.includes("assigned") && deptEmployees.length ? pick(deptEmployees) : null;
    const sla = cat.slaDays ?? 30;
    const number = `${branding.reportNumberPrefix}${year}-${String(++seq).padStart(6, "0")}`;

    // timestamps for each step spread across the report age
    const span = Math.max(ageDays, 0.2) * 86_400_000;
    const stamps = path_.map((_, idx) => new Date(createdAt.getTime() + (idx === 0 ? 0 : (span * idx) / (path_.length + 0.5)) ));
    const last = stamps[stamps.length - 1]!;
    const finalStatus = statuses.find((s) => s.key === final)!;

    const history: Prisma.ReportStatusHistoryCreateWithoutReportInput[] = path_.map((k, idx) => ({
      toStatusId: sid(k),
      fromStatusId: idx ? sid(path_[idx - 1]!) : null,
      createdAt: stamps[idx]!,
      isPublic: true,
      note: k === "redirected" ? `Redirecționată către ${pick(REDIRECT_TARGETS)}.` : k === "needs_info" ? "Vă rugăm să precizați locul exact și să adăugați o fotografie." : null,
      actor: { connect: { id: idx === 0 ? reporter.id : assignee?.userId ?? admin.id } },
    }));

    const comments: Prisma.ReportCommentCreateWithoutReportInput[] = [];
    if (["in_progress", "resolved", "closed", "planned"].includes(final)) {
      comments.push({ body: pick(PUBLIC_UPDATES), kind: "UPDATE", visibility: "PUBLIC", createdAt: new Date(stamps[Math.min(2, stamps.length - 1)]!.getTime() + 3_600_000), author: { connect: { id: assignee?.userId ?? admin.id } } });
    }
    if (final === "resolved" || final === "closed") {
      comments.push({ body: pick(RESPONSES), kind: "RESPONSE", visibility: "PUBLIC", createdAt: new Date(last.getTime() + 60_000), author: { connect: { id: assignee?.userId ?? admin.id } } });
    }
    if (chance(0.3) && path_.length > 1) {
      comments.push({ body: pick(INTERNAL_NOTES), kind: "NOTE", visibility: "INTERNAL", createdAt: new Date(stamps[1]!.getTime() + 1_800_000), author: { connect: { id: assignee?.userId ?? admin.id } } });
    }
    if (final === "needs_info" && chance(0.5)) {
      comments.push({ body: "Problema este chiar în dreptul intrării principale. Am adăugat o fotografie.", kind: "CITIZEN", visibility: "PUBLIC", createdAt: new Date(last.getTime() + 7_200_000), author: { connect: { id: reporter.id } } });
    }

    const photos: Prisma.ReportAttachmentCreateWithoutReportInput[] = [];
    const nPhotos = chance(0.65) ? 1 + Math.floor(rnd() * 3) : 0;
    for (let p = 0; p < nPhotos; p++) {
      const key = `demo/${randomUUID()}.png`;
      const buf = placeholderPng(cat.color, i * 3 + p);
      await storage.put(key, buf, "image/png");
      photos.push({ storageKey: key, originalName: `foto-${p + 1}.png`, mimeType: "image/png", size: buf.length, kind: "CITIZEN", isPublic: true, createdAt, uploader: { connect: { id: reporter.id } } });
    }
    if ((final === "resolved" || final === "closed") && chance(0.4)) {
      const key = `demo/${randomUUID()}.png`;
      const buf = placeholderPng("#15803d", i + 99);
      await storage.put(key, buf, "image/png");
      photos.push({ storageKey: key, originalName: "dupa-interventie.png", mimeType: "image/png", size: buf.length, kind: "ADMIN", isPublic: true, createdAt: last, uploader: { connect: { id: assignee?.userId ?? admin.id } } });
    }

    const report = await db.report.create({
      data: {
        number,
        title: tpl.title,
        description: tpl.description,
        category: { connect: { id: cat.id } },
        subcategory: sub ? { connect: { id: sub.id } } : undefined,
        status: { connect: { id: finalStatus.id } },
        reporter: { connect: { id: reporter.id } },
        department: dept ? { connect: { id: dept } } : undefined,
        assignee: assignee ? { connect: { id: assignee.id } } : undefined,
        redirectedTo: final === "redirected" ? pick(REDIRECT_TARGETS) : null,
        resolution: final === "resolved" || final === "closed" ? "Intervenție finalizată de echipa de teren." : null,
        dueAt: new Date(createdAt.getTime() + sla * 86_400_000),
        resolvedAt: final === "resolved" || final === "closed" ? stamps[path_.indexOf("resolved")]! : null,
        closedAt: finalStatus.isTerminal ? last : null,
        createdAt,
        updatedAt: last,
        location: {
          create: { lat, lng, street, streetNumber: nr, district: pick(DISTRICTS), formattedAddress: `${street} ${nr}`, source: "map" },
        },
        history: { create: history },
        comments: { create: comments },
        attachments: { create: photos },
      },
    });
    await db.auditLog.create({
      data: { actorId: reporter.id, action: "report.create", entityType: "report", entityId: report.id, data: { number, seed: true }, createdAt },
    });
  }
  await db.counter.upsert({ where: { key: `report:${year}` }, create: { key: `report:${year}`, value: seq }, update: { value: seq } });

  // A few in-app notifications for the demo citizen
  const demo = await db.user.findUniqueOrThrow({ where: { email: "citizen@civicreport.test" } });
  const mine = await db.report.findMany({ where: { reporterId: demo.id }, include: { status: true }, take: 3, orderBy: { updatedAt: "desc" } });
  for (const r of mine) {
    await db.notification.create({
      data: {
        userId: demo.id,
        type: "status_changed",
        title: `Sesizarea ${r.number}: ${(r.status.label as Record<string, string>).ro}`,
        body: `Starea sesizării „${r.title}” s-a schimbat în „${(r.status.label as Record<string, string>).ro}”.`,
        link: `/reports/${r.number}`,
        reportId: r.id,
        createdAt: r.updatedAt,
      },
    });
  }
  console.log(`Created ${count} demo reports.`);
}

/** Production: one super admin with the e-mail and password from the environment. */
async function seedProductionAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "";
  if (!email || !email.includes("@")) throw new Error("SEED_PRODUCTION=1 needs SEED_ADMIN_EMAIL (the first administrator's e-mail).");
  if (password.length < 12 || password === "CivicDemo2026!") {
    throw new Error("SEED_PRODUCTION=1 needs a strong SEED_PASSWORD (at least 12 characters, not the demo password).");
  }
  await upsertUser({ email, firstName: "Administrator", lastName: "Platformă", role: ROLE_KEYS.SUPER_ADMIN, passwordHash: await hashPassword(password) });
  console.log(`Super admin ready: ${email} (the password is the SEED_PASSWORD you set; change it after the first login).`);
}

async function main() {
  const production = process.env.SEED_PRODUCTION === "1";
  await seedAccessControl();
  await seedWorkflow();
  await seedOrganisation();
  if (production) {
    await seedProductionAdmin();
    console.log("Production seed complete: roles, workflow, departments and categories (edit them in the back office). No demo accounts or reports were created.");
    return;
  }
  await seedUsers();
  if (process.env.SEED_SKIP_REPORTS !== "1") await seedReports();
  console.log(`Seed complete. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
