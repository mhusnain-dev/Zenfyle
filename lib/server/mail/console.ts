import type { MailProvider } from "./types";

/*
 * Console mail provider (local dev). No SMTP is configured in the dev sandbox,
 * so instead of sending mail we log the reset link to the server console where
 * it's fully testable end-to-end. NEVER selected in production (a real SMTP
 * provider is — see lib/server/mail/index.ts); logging reset links to stdout in
 * prod would be a credential-leak vector.
 */
export class ConsoleMailProvider implements MailProvider {
  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    console.log(
      `\n[mail:console] Password reset for ${email}\n` +
        `[mail:console] Reset link (valid 1h): ${resetUrl}\n`,
    );
  }
}
