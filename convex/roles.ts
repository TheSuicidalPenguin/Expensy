import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Internal helpers (plain async functions – not RPCs)
// Import and call these from other mutations/queries that need auth checks.
// ---------------------------------------------------------------------------

/**
 * Returns the list of permission names for a given user.
 * Returns [] if the user has no role or the role has no permissions.
 */
export async function getUserPermissions(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<string[]> {
  const user = await ctx.db.get(userId);
  if (!user?.roleId) return [];

  const rolePerms = await ctx.db
    .query("rolePermissions")
    .withIndex("by_roleId", (q) => q.eq("roleId", user.roleId!))
    .collect();

  const permissions = await Promise.all(
    rolePerms.map((rp) => ctx.db.get(rp.permissionId))
  );

  return permissions.filter((p) => p !== null).map((p) => p!.name);
}

/**
 * Throws `ConvexError("Forbidden")` if the user does not hold `permission`.
 * Use at the top of any mutation that requires a specific permission.
 */
export async function requirePermission(
  ctx: QueryCtx,
  userId: Id<"users">,
  permission: string
): Promise<void> {
  const permissions = await getUserPermissions(ctx, userId);
  if (!permissions.includes(permission)) {
    throw new ConvexError(`Forbidden: Missing permission "${permission}".`);
  }
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Returns the current user's role name and permission list.
 * Used by the frontend to conditionally render role-specific UI.
 *
 * @throws ConvexError("Unauthorized") – no valid session
 */
export const getMyRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    const user = await ctx.db.get(userId) as Doc<"users"> | null;
    if (!user) throw new ConvexError("User record not found.");

    const role = user.roleId ? await ctx.db.get(user.roleId) as Doc<"roles"> | null : null;
    const permissions = await getUserPermissions(ctx, userId);

    return {
      role: role?.name ?? null,
      permissions,
    };
  },
});

