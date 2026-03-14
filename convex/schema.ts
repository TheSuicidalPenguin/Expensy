import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Application schema.
 *
 * `authTables` injects the tables required by Convex Auth:
 *   - users              – authenticated user profiles
 *   - authAccounts       – linked OAuth / password accounts
 *   - authSessions       – active sessions (JWTs)
 *   - authVerificationCodes – email verification tokens
 *   - authVerifiers      – PKCE verifiers
 *   - authRateLimits     – brute-force rate limiting per identifier
 *
 * The `users` table is redefined here (overriding the one from authTables) to
 * add a `roleId` FK while preserving all Convex Auth fields.
 *
 * Role / permission tables:
 *   - roles             – named roles (employee, manager)
 *   - permissions       – named permission strings (ADD_EXPENSE, etc.)
 *   - rolePermissions  – many-to-many join: which permissions belong to each role
 */
export default defineSchema({
  ...authTables,

  // Override authTables.users to add roleId FK
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    roleId: v.optional(v.id("roles")),
  }),

  roles: defineTable({
    name: v.string(), // "employee" | "manager"
  }).index("by_name", ["name"]),

  permissions: defineTable({
    name: v.string(), // "ADD_EXPENSE" | "VIEW_OWN_EXPENSES" | etc.
  }).index("by_name", ["name"]),

  /**
   * Maps each role to its set of permissions.
   * Indexed by roleId for efficient permission lookups.
   */
  rolePermissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  }).index("by_roleId", ["roleId"]),

  // ---------------------------------------------------------------------------
  // Expense lookup tables
  // ---------------------------------------------------------------------------

  expenseCategories: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  currencies: defineTable({
    code: v.string(),
    name: v.string(),
  }).index("by_code", ["code"]),

  // ---------------------------------------------------------------------------
  // Expense status / workflow tables
  // ---------------------------------------------------------------------------

  expenseStatus: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  statusTransition: defineTable({
    fromStatusId: v.id("expenseStatus"),
    toStatusId: v.id("expenseStatus"),
  }).index("by_fromStatus", ["fromStatusId"]),

  expenseStatusTransitionPermission: defineTable({
    transitionId: v.id("statusTransition"),
    permissionId: v.id("permissions"),
  }).index("by_transitionId", ["transitionId"]),

  entityStatusHistory: defineTable({
    expenseId: v.id("expenses"),
    fromStatusId: v.union(v.id("expenseStatus"), v.null()),
    toStatusId: v.id("expenseStatus"),
    actorId: v.id("users"),
    timestamp: v.number(),
    note: v.optional(v.string()),
  }).index("by_expenseId", ["expenseId"]),

  // ---------------------------------------------------------------------------
  // Expenses
  // ---------------------------------------------------------------------------

  expenses: defineTable({
    userId: v.id("users"),
    description: v.string(),
    receipt: v.optional(v.id("_storage")),
    categoryId: v.optional(v.id("expenseCategories")),
    otherCategory: v.optional(v.string()),
    expenseDate: v.optional(v.number()),
    submissionDate: v.optional(v.number()),
    amount: v.optional(v.number()),
    currencyId: v.optional(v.id("currencies")),
    statusId: v.id("expenseStatus"),
    rejectionNote: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_statusId", ["statusId"])
    .index("by_userId_statusId", ["userId", "statusId"]),
});
