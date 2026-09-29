/**
 * SMS provider abstraction – same pattern as the e-mail provider.
 * Development: MockSmsProvider (nothing is sent; see /dev/mailbox).
 */
import type { SendResult } from "../email";

export type SmsMessage = { to: string; text: string };

export interface SmsProvider {
  readonly name: string;
  send(msg: SmsMessage): Promise<SendResult>;
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock-sms";
  async send(msg: SmsMessage): Promise<SendResult> {
    if (process.env.MOCK_PROVIDERS_LOG !== "0") console.info(`[mock-sms] to=${msg.to} text="${msg.text}"`);
    return { provider: this.name, status: "MOCKED" };
  }
}

export class WebhookSmsProvider implements SmsProvider {
  readonly name = "webhook-sms";
  constructor(private url: string, private token?: string) {}
  async send(msg: SmsMessage): Promise<SendResult> {
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

let instance: SmsProvider | null = null;
export function getSmsProvider(): SmsProvider {
  if (instance) return instance;
  const kind = process.env.SMS_PROVIDER ?? "mock";
  instance =
    kind === "webhook" && process.env.SMS_WEBHOOK_URL
      ? new WebhookSmsProvider(process.env.SMS_WEBHOOK_URL, process.env.SMS_WEBHOOK_TOKEN)
      : new MockSmsProvider();
  return instance;
}
export function setSmsProvider(p: SmsProvider) {
  instance = p;
}
