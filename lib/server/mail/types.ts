/*
 * Mail provider interface (Section 6.4 / v1.4.2). Same local-dev/prod swap
 * philosophy as StorageProvider and JobQueue: the app only ever calls
 * sendPasswordReset, and doesn't know whether the link is logged to the console
 * (local dev, no SMTP) or sent via a real transport (production). Selected by
 * env in lib/server/mail/index.ts.
 */
export interface MailProvider {
  /**
   * Send a password-reset link to `email`. The link is fully formed by the
   * caller (it embeds the one-time token), so a provider only delivers it.
   */
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}
