import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      throw new ConvexError(
        "Unauthorized: You must be signed in to access this resource."
      );
    }

    const user = await ctx.db.get(userId) as Doc<"users"> | null;

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

