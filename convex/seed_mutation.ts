import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Seed data constants (shared with seed.ts action)
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  "ADD_EXPENSE",
  "VIEW_OWN_EXPENSES",
  "VIEW_EXPENSES",
  "REVIEW_EXPENSES",
] as const;

type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  employee: ["ADD_EXPENSE", "VIEW_OWN_EXPENSES"],
  manager: ["ADD_EXPENSE", "VIEW_OWN_EXPENSES", "VIEW_EXPENSES", "REVIEW_EXPENSES"],
};

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals & Entertainment",
  "Office Supplies",
  "Software & Subscriptions",
  "Hardware & Equipment",
  "Marketing",
  "Training & Education",
  "Other",
];

export const CURRENCIES = [{ code: "USD", name: "US Dollar" }];

// ---------------------------------------------------------------------------
// Internal mutation — all DB writes, safe to call from a Node.js action
// ---------------------------------------------------------------------------

export const _performSeed = internalMutation({
  args: {
    users: v.array(
      v.object({
        email: v.string(),
        name: v.string(),
        hashedPassword: v.string(),
        role: v.string(),
      })
    ),
  },
  handler: async (ctx, { users: seedUsers }) => {
    // 1. Upsert roles
    const roleIds: Record<string, Id<"roles">> = {};
    for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", roleName))
        .unique();
      if (existing) {
        roleIds[roleName] = existing._id;
        console.log(`[seed] Role "${roleName}" already exists — skipping`);
      } else {
        roleIds[roleName] = await ctx.db.insert("roles", { name: roleName });
        console.log(`[seed] Created role: ${roleName}`);
      }
    }

    // 2. Upsert permissions
    const permissionIds: Record<string, Id<"permissions">> = {};
    for (const permName of PERMISSIONS) {
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_name", (q) => q.eq("name", permName))
        .unique();
      if (existing) {
        permissionIds[permName] = existing._id;
        console.log(`[seed] Permission "${permName}" already exists — skipping`);
      } else {
        permissionIds[permName] = await ctx.db.insert("permissions", { name: permName });
        console.log(`[seed] Created permission: ${permName}`);
      }
    }

    // 3. Link roles → permissions
    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permName of perms) {
        const roleId = roleIds[roleName];
        const permissionId = permissionIds[permName];
        const existing = await ctx.db
          .query("rolePermissions")
          .withIndex("by_roleId", (q) => q.eq("roleId", roleId))
          .filter((q) => q.eq(q.field("permissionId"), permissionId))
          .unique();
        if (!existing) {
          await ctx.db.insert("rolePermissions", { roleId, permissionId });
          console.log(`[seed] Linked ${roleName} → ${permName}`);
        }
      }
    }

    // 4. Upsert users
    for (const { email, name, hashedPassword, role } of seedUsers) {
      const roleId = roleIds[role];
      const existing = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", email)
        )
        .unique();

      if (existing !== null) {
        if (roleId !== undefined) {
          await ctx.db.patch(existing.userId, { roleId });
          console.log(`[seed] Updated roleId for existing user: ${email}`);
        } else {
          console.log(`[seed] Skipping ${email} — account already exists`);
        }
        continue;
      }

      const userId = await ctx.db.insert("users", {
        email,
        name,
        emailVerificationTime: Date.now(),
        roleId,
      });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: email,
        secret: hashedPassword,
      });
      console.log(`[seed] Created user: ${email}`);
    }

    // 5. Upsert expense statuses
    const statusNames = ["draft", "submitted", "approved", "rejected"] as const;
    const statusIds: Record<string, Id<"expenseStatus">> = {};
    for (const name of statusNames) {
      const existing = await ctx.db
        .query("expenseStatus")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (existing) {
        statusIds[name] = existing._id;
        console.log(`[seed] expenseStatus "${name}" already exists — skipping`);
      } else {
        statusIds[name] = await ctx.db.insert("expenseStatus", { name });
        console.log(`[seed] Created expenseStatus: ${name}`);
      }
    }

    // 6. Upsert status transitions
    const transitionDefs: Array<[string, string]> = [
      ["draft", "submitted"],
      ["submitted", "approved"],
      ["submitted", "rejected"],
      ["rejected", "submitted"],
    ];
    const transitionIds: Record<string, Id<"statusTransition">> = {};
    for (const [fromName, toName] of transitionDefs) {
      const fromId = statusIds[fromName];
      const toId = statusIds[toName];
      const key = `${fromName}→${toName}`;
      const existing = await ctx.db
        .query("statusTransition")
        .withIndex("by_fromStatus", (q) => q.eq("fromStatusId", fromId))
        .filter((q) => q.eq(q.field("toStatusId"), toId))
        .unique();
      if (existing) {
        transitionIds[key] = existing._id;
        console.log(`[seed] statusTransition "${key}" already exists — skipping`);
      } else {
        transitionIds[key] = await ctx.db.insert("statusTransition", {
          fromStatusId: fromId,
          toStatusId: toId,
        });
        console.log(`[seed] Created statusTransition: ${key}`);
      }
    }

    // 7. Upsert transition → permission links
    const addExpensePerm = await ctx.db
      .query("permissions")
      .withIndex("by_name", (q) => q.eq("name", "ADD_EXPENSE"))
      .unique();
    const reviewExpensesPerm = await ctx.db
      .query("permissions")
      .withIndex("by_name", (q) => q.eq("name", "REVIEW_EXPENSES"))
      .unique();

    if (!addExpensePerm || !reviewExpensesPerm) {
      throw new ConvexError("Permissions not found. Roles/permissions must be seeded first.");
    }

    const transitionPermLinks: Array<[string, Id<"permissions">]> = [
      ["draft→submitted", addExpensePerm._id],
      ["submitted→approved", reviewExpensesPerm._id],
      ["submitted→rejected", reviewExpensesPerm._id],
      ["rejected→submitted", addExpensePerm._id],
    ];
    for (const [key, permissionId] of transitionPermLinks) {
      const transitionId = transitionIds[key];
      if (!transitionId) continue;
      const existing = await ctx.db
        .query("expenseStatusTransitionPermission")
        .withIndex("by_transitionId", (q) => q.eq("transitionId", transitionId))
        .filter((q) => q.eq(q.field("permissionId"), permissionId))
        .unique();
      if (!existing) {
        await ctx.db.insert("expenseStatusTransitionPermission", { transitionId, permissionId });
        console.log(`[seed] Created transition permission: ${key}`);
      }
    }

    // 8. Upsert expense categories
    for (const name of EXPENSE_CATEGORIES) {
      const existing = await ctx.db
        .query("expenseCategories")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (!existing) {
        await ctx.db.insert("expenseCategories", { name });
        console.log(`[seed] Created expenseCategory: ${name}`);
      }
    }

    // 9. Upsert currencies
    for (const { code, name } of CURRENCIES) {
      const existing = await ctx.db
        .query("currencies")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!existing) {
        await ctx.db.insert("currencies", { code, name });
        console.log(`[seed] Created currency: ${code}`);
      }
    }

    console.log("[seed] All seed data applied.");
  },
});
