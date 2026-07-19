import nodemailer, { type Transporter } from "nodemailer";
import type { MailProvider } from "./types";

/*
 * SMTP mail provider (Section 6.4 / v1.4.2) — the real-delivery counterpart to
 * ConsoleMailProvider. Sends the password-reset link via any SMTP transport
 * (nodemailer) configured through SMTP_HOST/PORT/USER/PASS. Selected by
 * MAIL_PROVIDER=smtp in lib/server/mail/index.ts.
 *
 * NOTE on Gmail (test setup): Gmail's SMTP requires an APP PASSWORD (16 chars,
 * 2-Step Verification must be on) — a normal account password is rejected. Use
 * host smtp.gmail.com, port 587 (STARTTLS). Personal Gmail is fine for low-volume
 * testing but is rate-limited (~500/day) and not meant for production app mail;
 * swap to a transactional provider (Resend/Postmark/SES) before launch — same
 * MailProvider interface, no caller changes.
 */
export class SmtpMailProvider implements MailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const host = requireEnv("SMTP_HOST");
    const port = Number(process.env.SMTP_PORT ?? "587");
    const user = requireEnv("SMTP_USER");
    const pass = requireEnv("SMTP_PASS");

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 = implicit TLS; 587/others = STARTTLS upgrade.
      secure: port === 465,
      auth: { user, pass },
    });

    // Fall back to the authenticating user as the From if MAIL_FROM is unset,
    // since many SMTP servers (Gmail included) require From to match the account.
    this.from = process.env.MAIL_FROM?.trim() || user;
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: "Reset your Zenfyle password",
      text:
        `We received a request to reset your Zenfyle password.\n\n` +
        `Reset it here (link valid for 1 hour):\n${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email.`,
      html:
        `<p>We received a request to reset your Zenfyle password.</p>` +
        `<p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour).</p>` +
        `<p style="color:#64748b;font-size:13px">If you didn't request this, ` +
        `you can safely ignore this email.</p>`,
    });
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `MAIL_PROVIDER=smtp requires ${name} to be set. See lib/server/mail/smtp.ts.`,
    );
  }
  return v;
}
