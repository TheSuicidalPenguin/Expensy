"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const SEED_USERS = [
  { email: "rami.kanj@outlook.com",      name: "Rami Kanj",     password: "Password-123", role: "manager"  as const },
  { email: "bobtheemployee@airdev.co",   name: "Bob Smith",     password: "Password-123", role: "employee" as const },
  { email: "frankthemanager@airdev.co",  name: "Frank Johnson", password: "Password-123", role: "manager"  as const },
  { email: "vlad@airdev.co",             name: "Vlad Leytus",   password: "Password-123", role: "manager"  as const },
] as const;

/**
 * Seeds all lookup data and users.
 * Safe to re-run — all operations are idempotent (upsert pattern).
 *
 * Run with:
 *   npx convex run seed:seedAll
 */
export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const { Scrypt } = await import("lucia");
    const usersWithHashes = await Promise.all(
      SEED_USERS.map(async (user) => ({
        email: user.email,
        name: user.name,
        hashedPassword: await new Scrypt().hash(user.password),
        role: user.role,
      }))
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).seed_mutation._performSeed, { users: usersWithHashes });
    console.log("[seed] Done.");
  },
});
