import bcrypt from "bcryptjs";

/*
 * Password hashing (Section 6.4). bcryptjs is pure-JS (no native build step, so
 * it works in this sandbox) — the spec's "don't build custom auth/crypto" rule
 * (§368) means we lean on a vetted library, not a hand-rolled KDF. Cost 12 is a
 * reasonable 2020s default for interactive logins.
 */
const BCRYPT_COST = 12;

/** Minimum password length enforced at signup and reset (Section 6.4). */
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
