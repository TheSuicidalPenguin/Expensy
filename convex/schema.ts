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
 *   - role_permissions  – many-to-many join: which permissions belong to each role
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
  role_permissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  }).index("by_roleId", ["roleId"]),
});
