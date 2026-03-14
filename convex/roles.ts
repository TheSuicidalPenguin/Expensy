import { internalMutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import type { QueryCtx } from "./_generated/server";

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
    .query("role_permissions")
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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User record not found.");

    const role = user.roleId ? await ctx.db.get(user.roleId) : null;
    const permissions = await getUserPermissions(ctx, userId);

    return {
      role: role?.name ?? null,
      permissions,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations — used by the seed action
// ---------------------------------------------------------------------------

/**
 * Inserts a role if it does not already exist.
 * Returns the roleId (existing or newly created).
 */
export const _upsertRole = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();

    if (existing) {
      console.log(`[seed] Role "${name}" already exists — skipping`);
      return existing._id;
    }

    const id = await ctx.db.insert("roles", { name });
    console.log(`[seed] Created role: ${name}`);
    return id;
  },
});

/**
 * Inserts a permission if it does not already exist.
 * Returns the permissionId (existing or newly created).
 */
export const _upsertPermission = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();

    if (existing) {
      console.log(`[seed] Permission "${name}" already exists — skipping`);
      return existing._id;
    }

    const id = await ctx.db.insert("permissions", { name });
    console.log(`[seed] Created permission: ${name}`);
    return id;
  },
});

/**
 * Links a role to a permission. Safe to call multiple times (idempotent).
 */
export const _linkRolePermission = internalMutation({
  args: {
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  },
  handler: async (ctx, { roleId, permissionId }) => {
    const existing = await ctx.db
      .query("role_permissions")
      .withIndex("by_roleId", (q) => q.eq("roleId", roleId))
      .filter((q) => q.eq(q.field("permissionId"), permissionId))
      .unique();

    if (existing) return;

    await ctx.db.insert("role_permissions", { roleId, permissionId });
  },
});
