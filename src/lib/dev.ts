/** Development mailbox (/dev/mailbox) – enabled outside production unless DEV_MAILBOX=0; opt-in in production with DEV_MAILBOX=1. */
export function devMailboxEnabled() {
  return process.env.DEV_MAILBOX === "1" || (process.env.NODE_ENV !== "production" && process.env.DEV_MAILBOX !== "0");
}
