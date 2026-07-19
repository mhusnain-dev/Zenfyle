"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { getMailer } from "@/lib/server/mail";
import { auth, signOut } from "@/auth";

/*
 * Auth write-paths (Section 6.4). Server Actions the auth pages call directly —
 * signup, forgot-password (request a reset link), and reset-password (consume a
 * link). Login/logout go through Auth.js's own handlers; these cover the flows
 * Auth.js's Credentials provider doesn't own. Each returns a plain
 * { ok, error? } so the client forms can render inline errors without throwing.
 *
 * Reset tokens: we store only a SHA-256 hash of a random token (never the token
 * itself), so a DB leak can't be used to reset accounts. The plaintext token
 * travels only in the emailed link and is single-use (deleted on consume).
 */

export type ActionResult = { ok: boolean; error?: string };

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const SignupSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function signup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't reveal whether an email is registered beyond what signup inherently
    // must: offer the path forward instead of a bare "taken".
    return { ok: false, error: "An account with this email already exists. Try logging in." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.create({ data: { email, passwordHash } });
  return { ok: true };
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const valid = z.string().email().safeParse(email).success;

  // Always report success regardless of whether the account exists — never leak
  // which emails are registered (Section 6.4 / standard reset-flow hygiene).
  if (!valid) return { ok: true };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${appUrl}/reset-password?token=${token}`;
    await getMailer().sendPasswordReset(email, link);
  }

  return { ok: true };
}

const ResetSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
});

export async function resetPassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = ResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.expiresAt < new Date()) {
    // Clean up an expired record if we found one.
    if (record) await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    // Single-use: consume this token and any others outstanding for the user.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true };
}

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
});

export async function changePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You're not signed in." };

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) return { ok: false, error: "Account not found." };

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { ok: false, error: "Your current password is incorrect." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return { ok: true };
}

export async function deleteAccount(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  // Disassociate jobs (null user_id) rather than cascade-deleting history rows
  // (§623), then remove the user + any reset tokens.
  await prisma.$transaction([
    prisma.job.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await signOut({ redirectTo: "/" });
}
