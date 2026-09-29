/**
 * E-mail provider abstraction.
 * Development uses MockEmailProvider (messages are stored in the
 * notification_deliveries table and visible at /dev/mailbox – nothing is sent).
 * To send real e-mail implement EmailProvider (SMTP, SES, Postmark, …) and
 * register it in `getEmailProvider()` behind EMAIL_PROVIDER=<name>.
 */
export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type SendResult = { provider: string; status: "SENT" | "MOCKED" | "FAILED"; error?: string };

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<SendResult>;
}

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email";
  async send(msg: EmailMessage): Promise<SendResult> {
    if (process.env.MOCK_PROVIDERS_LOG !== "0") {
      console.info(`[mock-email] to=${msg.to} subject="${msg.subject}"`);
    }
    return { provider: this.name, status: "MOCKED" };
  }
}

/** Example real provider using an HTTP webhook (e.g. your mail relay). */
export class WebhookEmailProvider implements EmailProvider {
  readonly name = "webhook-email";
  constructor(private url: string, private token?: string) {}
  async send(msg: EmailMessage): Promise<SendResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: JSON.stringify(msg),
      });
      if (!res.ok) return { provider: this.name, status: "FAILED", error: `HTTP ${res.status}` };
      return { provider: this.name, status: "SENT" };
    } catch (e) {
      return { provider: this.name, status: "FAILED", error: (e as Error).message };
    }
  }
}

let instance: EmailProvider | null = null;
export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  const kind = process.env.EMAIL_PROVIDER ?? "mock";
  if (kind === "webhook" && process.env.EMAIL_WEBHOOK_URL) {
    instance = new WebhookEmailProvider(process.env.EMAIL_WEBHOOK_URL, process.env.EMAIL_WEBHOOK_TOKEN);
  } else {
    instance = new MockEmailProvider();
  }
  return instance;
}
export function setEmailProvider(p: EmailProvider) {
  instance = p;
}
