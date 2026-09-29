/**
 * Notification service: one entry point for EMAIL, SMS and IN-APP messages.
 * Never throws – a failed delivery is recorded but never breaks the business action.
 */
import { branding } from "@config/branding";
import { appConfig } from "@config/app";
import { db } from "@/lib/db";
import { isLocale, makeT, tr, type Locale } from "@/lib/i18n/core";
import { getEmailProvider } from "@/server/providers/email";
import { getSmsProvider } from "@/server/providers/sms";

export type NotificationEvent =
  | "report_submitted"
  | "status_changed"
  | "report_redirected"
  | "report_resolved"
  | "admin_response"
  | "new_report_staff"
  | "report_assigned"
  | "staff_comment"
  | "staff_status";

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function userLocale(l: string | null | undefined): Locale {
  return isLocale(l) ? l : appConfig.defaultLocale;
}

function footer(locale: Locale) {
  const t = makeT(locale);
  return t("notificationsText.footer", { brand: branding.brandName, org: tr(branding.organizationName, locale) });
}

/**
 * Notify one user about an event. Vars are interpolated in the user's language.
 * `vars.status` may be a localized object – it is resolved per recipient.
 */
export async function notifyUser(
  userId: string,
  event: NotificationEvent,
  vars: Record<string, unknown>,
  opts: { reportId?: string; link?: string; channels?: { email?: boolean; sms?: boolean; inApp?: boolean } } = {},
) {
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return;
    const locale = userLocale(user.locale);
    const t = makeT(locale);
    const v: Record<string, string> = {};
    for (const [k, val] of Object.entries(vars)) v[k] = tr(val, locale);
    const title = t(`notificationsText.${event}.title` as never, v);
    const body = t(`notificationsText.${event}.body` as never, v);
    const ch = { email: true, sms: true, inApp: true, ...opts.channels };

    let notificationId: string | null = null;
    if (ch.inApp && user.notifyInApp) {
      const n = await db.notification.create({
        data: { userId, type: event, title, body, link: opts.link ?? null, reportId: opts.reportId ?? null },
      });
      notificationId = n.id;
    }

    const link = opts.link ? appUrl(opts.link) : null;
    if (ch.email && user.notifyEmail && user.email && user.emailVerifiedAt) {
      const text = [body, link ? t("notificationsText.viewReport", { link }) : "", "", footer(locale)].filter((x) => x !== null).join("\n");
      await deliverEmail({ to: user.email, subject: title, text, notificationId });
    }
    if (ch.sms && user.notifySms && user.phone && user.phoneVerifiedAt) {
      await deliverSms({ to: user.phone, text: `${branding.brandName}: ${title}${link ? ` ${link}` : ""}`, notificationId });
    }
  } catch (err) {
    console.error("[notifications] failed", event, err);
  }
}

export async function notifyMany(userIds: string[], event: NotificationEvent, vars: Record<string, unknown>, opts: Parameters<typeof notifyUser>[3] = {}) {
  await Promise.all([...new Set(userIds)].map((id) => notifyUser(id, event, vars, opts)));
}

export async function deliverEmail(msg: { to: string; subject: string; text: string; notificationId?: string | null }) {
  const provider = getEmailProvider();
  const res = await provider.send({ to: msg.to, subject: msg.subject, text: msg.text });
  await db.notificationDelivery.create({
    data: {
      notificationId: msg.notificationId ?? null,
      channel: "EMAIL",
      provider: res.provider,
      recipient: msg.to,
      subject: msg.subject,
      body: msg.text,
      status: res.status,
      error: res.error ?? null,
    },
  });
  return res;
}

export async function deliverSms(msg: { to: string; text: string; notificationId?: string | null }) {
  const provider = getSmsProvider();
  const res = await provider.send({ to: msg.to, text: msg.text });
  await db.notificationDelivery.create({
    data: {
      notificationId: msg.notificationId ?? null,
      channel: "SMS",
      provider: res.provider,
      recipient: msg.to,
      body: msg.text,
      status: res.status,
      error: res.error ?? null,
    },
  });
  return res;
}

/** Transactional auth e-mails (not stored as in-app notifications). */
export async function sendAuthEmail(
  kind: "email_verify" | "password_reset",
  to: { email: string; name: string; locale?: string | null },
  link: string,
) {
  const locale = userLocale(to.locale);
  const t = makeT(locale);
  const subject = `${branding.brandName}: ${t(`notificationsText.${kind}.subject` as never)}`;
  const text =
    t(`notificationsText.${kind}.body` as never, {
      name: to.name,
      link,
      hours: appConfig.auth.verifyTokenTtlHours,
    }) +
    "\n\n" +
    footer(locale);
  try {
    await deliverEmail({ to: to.email, subject, text });
  } catch (e) {
    console.error("[notifications] auth e-mail failed", e);
  }
}

export async function sendOtpSms(phone: string, code: string, locale: Locale) {
  const t = makeT(locale);
  const text = t("notificationsText.otp.body", { brand: branding.brandName, code, minutes: appConfig.auth.otpTtlMinutes });
  try {
    await deliverSms({ to: phone, text });
  } catch (e) {
    console.error("[notifications] otp sms failed", e);
  }
}
