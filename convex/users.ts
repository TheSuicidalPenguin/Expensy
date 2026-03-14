import { internalMutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { auth } from "./auth";

/**
 * Protected query: returns the currently authenticated user's profile.
 *
 * This query is the canonical "token validation" endpoint. The frontend
 * calls it immediately after sign-in to confirm that:
 *   1. The session token issued by Convex Auth is valid.
 *   2. The token is correctly forwarded by the React client.
 *   3. The backend can resolve the token to a user record.
 *
 * @returns Subset of the user document: { _id, name, email, image }
 *
 * @throws ConvexError("Unauthorized")         – no valid session on the request
 * @throws ConvexError("User record not found") – session exists but user doc is missing
 *                                                (should never happen in normal operation)
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);

    if (userId === null) {
      throw new ConvexError(
        "Unauthorized: You must be signed in to access this resource."
      );
    }

    const user = await ctx.db.get(userId);

    if (!user) {
      throw new ConvexError(
        "User record not found: The authenticated user could not be located in the database."
      );
    }

    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
    };
  },
});

/**
 * Internal mutation: inserts a user + password account row.
 *
 * Called exclusively by the `seed:seedUsers` action after it has produced
 * the Scrypt hash. Skips silently if the provider account already exists so
 * the seed is safe to re-run.
 *
 * @param email           The user's email address (also the providerAccountId)
 * @param name            Display name stored on the users row
 * @param hashedPassword  Scrypt hash produced by `new Scrypt().hash(password)`
 */
export const _createUser = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    hashedPassword: v.string(),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, { email, name, hashedPassword, roleId }) => {
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .unique();

    if (existing !== null) {
      console.log(`[seed] Skipping ${email} — account already exists`);
      return;
    }

    const userId = await ctx.db.insert("users", {
      email,
      name,
      emailVerificationTime: Date.now(),
      ...(roleId !== undefined ? { roleId } : {}),
    });

    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      secret: hashedPassword,
    });

    console.log(`[seed] Created user: ${email}`);
  },
});
