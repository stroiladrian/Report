import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { devMailboxEnabled } from "@/lib/dev";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev mailbox", robots: { index: false } };

/** Development-only view of messages captured by the mock e-mail / SMS providers. */
export default async function DevMailbox() {
  if (!devMailboxEnabled()) notFound();
  const items = await db.notificationDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const linkify = (s: string) =>
    s.split(/(https?:\/\/\S+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part} className="link break-all">
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">Dev mailbox</h1>
      <p className="mb-4 text-sm text-slate-600">Messages captured by MockEmailProvider / MockSmsProvider. Nothing was actually sent. Disabled in production.</p>
      <ul className="space-y-3">
        {items.map((m) => (
          <li key={m.id} className="card p-4" data-testid="mail">
            <p className="text-xs text-slate-500">
              {m.channel} · {m.provider} · {m.status} · {m.createdAt.toISOString()}
            </p>
            <p className="font-semibold">To: {m.recipient}</p>
            {m.subject && <p className="font-semibold">{m.subject}</p>}
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">{linkify(m.body)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
