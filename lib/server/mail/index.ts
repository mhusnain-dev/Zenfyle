import type { MailProvider } from "./types";
import { ConsoleMailProvider } from "./console";
import { SmtpMailProvider } from "./smtp";

/*
 * Mail provider selector (Section 6.4). MAIL_PROVIDER=console (default) logs
 * reset links to the server console for local dev; "smtp" sends real mail via
 * nodemailer (SmtpMailProvider, SMTP_* env). Both implement the same
 * MailProvider interface, so callers (auth-actions) never change. nodemailer is
 * a server-only dependency and this module is only imported from server code, so
 * a static import is fine (it never reaches the client bundle).
 *
 * Singleton so we don't reconstruct the provider on every request under dev HMR.
 */
let cached: MailProvider | undefined;

export function getMailer(): MailProvider {
  if (cached) return cached;

  const provider = process.env.MAIL_PROVIDER ?? "console";
  switch (provider) {
    case "console":
      cached = new ConsoleMailProvider();
      break;
    case "smtp":
      cached = new SmtpMailProvider();
      break;
    default:
      throw new Error(`Unknown MAIL_PROVIDER: ${provider}`);
  }
  return cached;
}

export type { MailProvider } from "./types";
