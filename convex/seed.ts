"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Seed data for local development.
 *
 * Run once (safe to re-run — existing records are skipped):
 *   npx convex run seed:seedAll
 *
 * What this seeds:
 *   1. Roles: employee, manager
 *   2. Permissions: ADD_EXPENSE, VIEW_OWN_EXPENSES, VIEW_EXPENSES, REVIEW_EXPENSES
 *   3. Role → Permission mappings per the access matrix below
 *   4. Users with their assigned roles
 *
 * Access matrix:
 *   employee → ADD_EXPENSE, VIEW_OWN_EXPENSES
 *   manager  → ADD_EXPENSE, VIEW_OWN_EXPENSES, VIEW_EXPENSES, REVIEW_EXPENSES
 */

const PERMISSIONS = [
  "ADD_EXPENSE",
  "VIEW_OWN_EXPENSES",
  "VIEW_EXPENSES",
  "REVIEW_EXPENSES",
] as const;

type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  employee: ["ADD_EXPENSE", "VIEW_OWN_EXPENSES"],
  manager: ["ADD_EXPENSE", "VIEW_OWN_EXPENSES", "VIEW_EXPENSES", "REVIEW_EXPENSES"],
};

const SEED_USERS = [
  {
    email: "rami.kanj@outlook.com",
    name: "Rami Kanj",
    password: "Password-123",
    role: "manager" as const,
  },
  {
    email: "employee@expensy.com",
    name: "Jane Smith",
    password: "Password-123",
    role: "employee" as const,
  },
] as const;

export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Upsert roles
    const roleIds: Record<string, Id<"roles">> = {};
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      roleIds[role] = await ctx.runMutation(internal.roles._upsertRole, {
        name: role,
      });
    }

    // 2. Upsert permissions
    const permissionIds: Record<string, Id<"permissions">> = {};
    for (const perm of PERMISSIONS) {
      permissionIds[perm] = await ctx.runMutation(
        internal.roles._upsertPermission,
        { name: perm }
      );
    }

    // 3. Link roles → permissions
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const perm of perms) {
        await ctx.runMutation(internal.roles._linkRolePermission, {
          roleId: roleIds[role],
          permissionId: permissionIds[perm],
        });
      }
    }

    // 4. Seed users with roles
    const { Scrypt } = await import("lucia");
    for (const user of SEED_USERS) {
      const hashedPassword = await new Scrypt().hash(user.password);
      await ctx.runMutation(internal.users._createUser, {
        email: user.email,
        name: user.name,
        hashedPassword,
        roleId: roleIds[user.role],
      });
    }

    console.log("[seed] Done seeding roles, permissions, and users.");
  },
});
