import { mutation, query, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { auth } from "./auth";
import { getUserPermissions, requirePermission } from "./roles";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Looks up an expenseStatus record by name.
 * Throws ConvexError if not found.
 */
async function getStatusByName(
  ctx: QueryCtx,
  name: string
): Promise<Doc<"expenseStatus">> {
  const status = await ctx.db
    .query("expenseStatus")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (!status) {
    throw new ConvexError(`Expense status "${name}" not found. Run seed first.`);
  }
  return status;
}

/**
 * Core transition engine.
 * Validates the transition is allowed, checks required permissions,
 * records audit history, and updates the expense status.
 */
async function performTransition(
  ctx: MutationCtx,
  expenseId: Id<"expenses">,
  toStatusName: string,
  actorId: Id<"users">,
  note?: string
): Promise<void> {
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found.");
  }

  const toStatus = await getStatusByName(ctx, toStatusName);

  // Find the transition record
  const transitions = await ctx.db
    .query("statusTransition")
    .withIndex("by_fromStatus", (q) => q.eq("fromStatusId", expense.statusId))
    .collect();

  const transition = transitions.find((t) => t.toStatusId === toStatus._id);

  if (!transition) {
    const fromStatus = await ctx.db.get(expense.statusId);
    const fromName = fromStatus?.name ?? expense.statusId;
    throw new ConvexError(
      `Invalid transition: ${fromName} → ${toStatusName}`
    );
  }

  // Gather required permissions for this transition
  const transitionPerms = await ctx.db
    .query("expenseStatusTransitionPermission")
    .withIndex("by_transitionId", (q) =>
      q.eq("transitionId", transition._id)
    )
    .collect();

  const userPermissions = await getUserPermissions(ctx, actorId);

  for (const tp of transitionPerms) {
    const permDoc = await ctx.db.get(tp.permissionId);
    if (!permDoc) continue;
    if (!userPermissions.includes(permDoc.name)) {
      throw new ConvexError(
        `Forbidden: Missing permission "${permDoc.name}".`
      );
    }
  }

  // Record history
  await ctx.db.insert("entityStatusHistory", {
    expenseId,
    fromStatusId: expense.statusId,
    toStatusId: toStatus._id,
    actorId,
    timestamp: Date.now(),
    ...(note !== undefined ? { note } : {}),
  });

  // Patch the expense
  const patch: Partial<Doc<"expenses">> = { statusId: toStatus._id };
  if (toStatusName === "submitted") {
    patch.submissionDate = Date.now();
  }
  if (toStatusName === "rejected" && note !== undefined) {
    patch.rejectionNote = note;
  }
  await ctx.db.patch(expenseId, patch);
}

/**
 * Validates all required fields before submitting an expense.
 * Throws ConvexError listing what's missing.
 */
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
];

async function validateSubmission(
  ctx: QueryCtx,
  expense: Doc<"expenses">
): Promise<void> {
  const errors: string[] = [];

  if (!expense.description?.trim()) errors.push("Description is required.");
  if (!expense.receipt) errors.push("Receipt is required.");
  if (!expense.categoryId) errors.push("Category is required.");
  if (expense.expenseDate === undefined) errors.push("Expense date is required.");
  if (expense.expenseDate !== undefined && expense.expenseDate > Date.now()) errors.push("Expense date cannot be in the future.");
  if (!expense.amount || expense.amount <= 0) errors.push("Amount must be greater than 0.");
  if (!expense.currencyId) errors.push("Currency is required.");

  if (expense.categoryId) {
    const category = await ctx.db.get(expense.categoryId);
    if (category?.name === "Other" && !expense.otherCategory?.trim()) {
      errors.push("Please specify the category when 'Other' is selected.");
    }
  }

  if (errors.length > 0) {
    throw new ConvexError(errors.join(" "));
  }
}

async function validateReceipt(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  const metadata = await ctx.db.system.get(storageId);
  if (!metadata) return;
  if (metadata.size > RECEIPT_MAX_BYTES) {
    throw new ConvexError("Receipt file must be under 5 MB.");
  }
  if (metadata.contentType && !RECEIPT_ALLOWED_TYPES.includes(metadata.contentType)) {
    throw new ConvexError("Receipt must be a JPG, PNG, GIF, WEBP, BMP, or TIFF image.");
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Generates a short-lived upload URL for storing a receipt file.
 * Requires authentication.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a new expense in draft status.
 * Requires ADD_EXPENSE permission.
 */
export const createExpense = mutation({
  args: {
    description: v.string(),
    receipt: v.optional(v.id("_storage")),
    categoryId: v.optional(v.id("expenseCategories")),
    otherCategory: v.optional(v.string()),
    expenseDate: v.optional(v.number()),
    amount: v.optional(v.number()),
    currencyId: v.optional(v.id("currencies")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "ADD_EXPENSE");

    // Validate even in draft: amount must not be negative, date must not be future
    if (args.amount !== undefined && args.amount < 0) {
      throw new ConvexError("Amount cannot be negative.");
    }
    if (args.expenseDate !== undefined && args.expenseDate > Date.now()) {
      throw new ConvexError("Expense date cannot be in the future.");
    }

    const draftStatus = await getStatusByName(ctx, "draft");

    const expenseId = await ctx.db.insert("expenses", {
      userId,
      description: args.description,
      receipt: args.receipt,
      categoryId: args.categoryId,
      otherCategory: args.otherCategory,
      expenseDate: args.expenseDate,
      amount: args.amount,
      currencyId: args.currencyId,
      statusId: draftStatus._id,
    });

    await ctx.db.insert("entityStatusHistory", {
      expenseId,
      fromStatusId: null,
      toStatusId: draftStatus._id,
      actorId: userId,
      timestamp: Date.now(),
    });

    return expenseId;
  },
});

/**
 * Updates an existing draft expense.
 * Only the owner can edit, and only while the expense is in draft status.
 * Requires ADD_EXPENSE permission.
 */
export const updateExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    description: v.optional(v.string()),
    receipt: v.optional(v.id("_storage")),
    categoryId: v.optional(v.id("expenseCategories")),
    otherCategory: v.optional(v.string()),
    expenseDate: v.optional(v.number()),
    amount: v.optional(v.number()),
    currencyId: v.optional(v.id("currencies")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "ADD_EXPENSE");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new ConvexError("Expense not found.");

    if (expense.userId !== userId) {
      throw new ConvexError("Forbidden: You can only edit your own expenses.");
    }

    const currentStatus = await ctx.db.get(expense.statusId);
    if (currentStatus?.name !== "draft" && currentStatus?.name !== "rejected") {
      throw new ConvexError(
        "Forbidden: Only draft or rejected expenses can be edited."
      );
    }

    // Validate even in draft: amount must not be negative, date must not be future
    if (args.amount !== undefined && args.amount < 0) {
      throw new ConvexError("Amount cannot be negative.");
    }
    if (args.expenseDate !== undefined && args.expenseDate > Date.now()) {
      throw new ConvexError("Expense date cannot be in the future.");
    }

    // Build patch with only defined values
    const patch: Record<string, unknown> = {};
    if (args.description !== undefined) patch.description = args.description;
    if (args.receipt !== undefined) patch.receipt = args.receipt;
    if (args.categoryId !== undefined) patch.categoryId = args.categoryId;
    if (args.otherCategory !== undefined) patch.otherCategory = args.otherCategory;
    if (args.expenseDate !== undefined) patch.expenseDate = args.expenseDate;
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.currencyId !== undefined) patch.currencyId = args.currencyId;

    await ctx.db.patch(args.expenseId, patch);

    return args.expenseId;
  },
});

/**
 * Submits an expense for review.
 * The expense must be in draft or rejected status.
 * Validates all required fields before transitioning.
 * Requires ADD_EXPENSE permission.
 */
export const submitExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "ADD_EXPENSE");

    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found.");

    if (expense.userId !== userId) {
      throw new ConvexError("Forbidden: You can only submit your own expenses.");
    }

    const currentStatus = await ctx.db.get(expense.statusId);
    if (
      currentStatus?.name !== "draft" &&
      currentStatus?.name !== "rejected"
    ) {
      throw new ConvexError(
        `Cannot submit an expense with status "${currentStatus?.name}". Only draft or rejected expenses can be submitted.`
      );
    }

    await validateSubmission(ctx, expense);
    if (expense.receipt) await validateReceipt(ctx, expense.receipt);
    await performTransition(ctx, expenseId, "submitted", userId);

    return expenseId;
  },
});

/**
 * Approves a submitted expense.
 * Managers cannot approve their own expenses.
 * Requires REVIEW_EXPENSES permission.
 */
export const approveExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "REVIEW_EXPENSES");

    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found.");

    if (expense.userId === userId) {
      throw new ConvexError(
        "Forbidden: You cannot approve your own expense."
      );
    }

    await performTransition(ctx, expenseId, "approved", userId);

    return expenseId;
  },
});

/**
 * Rejects a submitted expense with a required note.
 * Managers cannot reject their own expenses.
 * Requires REVIEW_EXPENSES permission.
 */
export const rejectExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    note: v.string(),
  },
  handler: async (ctx, { expenseId, note }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "REVIEW_EXPENSES");

    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found.");

    if (expense.userId === userId) {
      throw new ConvexError(
        "Forbidden: You cannot reject your own expense."
      );
    }

    await performTransition(ctx, expenseId, "rejected", userId, note);

    return expenseId;
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns all available currencies.
 * Requires authentication.
 */
export const getCurrencies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    return await ctx.db.query("currencies").collect();
  },
});

/**
 * Returns all available expense categories.
 * Requires authentication.
 */
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    return await ctx.db.query("expenseCategories").collect();
  },
});

/**
 * Returns the current user's own expenses with optional filters.
 * Requires VIEW_OWN_EXPENSES permission.
 */
export const getMyExpenses = query({
  args: {
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("expenseCategories")),
    expenseDateFrom: v.optional(v.number()),
    expenseDateTo: v.optional(v.number()),
    submissionDateFrom: v.optional(v.number()),
    submissionDateTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "VIEW_OWN_EXPENSES");

    let expenses = await ctx.db
      .query("expenses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Apply in-memory filters
    if (args.description) {
      const search = args.description.toLowerCase();
      expenses = expenses.filter((e) =>
        e.description.toLowerCase().includes(search)
      );
    }
    if (args.categoryId) {
      expenses = expenses.filter((e) => e.categoryId === args.categoryId);
    }
    if (args.expenseDateFrom !== undefined) {
      expenses = expenses.filter(
        (e) => e.expenseDate !== undefined && e.expenseDate >= args.expenseDateFrom!
      );
    }
    if (args.expenseDateTo !== undefined) {
      expenses = expenses.filter(
        (e) => e.expenseDate !== undefined && e.expenseDate <= args.expenseDateTo!
      );
    }
    if (args.submissionDateFrom !== undefined) {
      expenses = expenses.filter(
        (e) =>
          e.submissionDate !== undefined &&
          e.submissionDate >= args.submissionDateFrom!
      );
    }
    if (args.submissionDateTo !== undefined) {
      expenses = expenses.filter(
        (e) =>
          e.submissionDate !== undefined &&
          e.submissionDate <= args.submissionDateTo!
      );
    }

    // Join lookup names
    return await Promise.all(
      expenses.map(async (expense) => {
        const [category, currency, status] = await Promise.all([
          expense.categoryId ? ctx.db.get(expense.categoryId) : null,
          expense.currencyId ? ctx.db.get(expense.currencyId) : null,
          ctx.db.get(expense.statusId),
        ]);
        return {
          ...expense,
          categoryName: category?.name ?? null,
          currencyCode: currency?.code ?? null,
          statusName: status?.name ?? null,
        };
      })
    );
  },
});

/**
 * Returns all submitted expenses from other employees, for manager review.
 * Requires VIEW_EXPENSES permission.
 */
export const getExpensesForReview = query({
  args: {
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("expenseCategories")),
    submitterName: v.optional(v.string()),
    expenseDateFrom: v.optional(v.number()),
    expenseDateTo: v.optional(v.number()),
    submissionDateFrom: v.optional(v.number()),
    submissionDateTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    await requirePermission(ctx, userId, "VIEW_EXPENSES");

    const draftStatus = await getStatusByName(ctx, "draft");

    let expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) => e.statusId !== draftStatus._id
    );

    // Exclude the manager's own expenses
    expenses = expenses.filter((e) => e.userId !== userId);

    // Apply in-memory filters
    if (args.description) {
      const search = args.description.toLowerCase();
      expenses = expenses.filter((e) =>
        e.description.toLowerCase().includes(search)
      );
    }
    if (args.categoryId) {
      expenses = expenses.filter((e) => e.categoryId === args.categoryId);
    }
    if (args.expenseDateFrom !== undefined) {
      expenses = expenses.filter(
        (e) => e.expenseDate !== undefined && e.expenseDate >= args.expenseDateFrom!
      );
    }
    if (args.expenseDateTo !== undefined) {
      expenses = expenses.filter(
        (e) => e.expenseDate !== undefined && e.expenseDate <= args.expenseDateTo!
      );
    }
    if (args.submissionDateFrom !== undefined) {
      expenses = expenses.filter(
        (e) =>
          e.submissionDate !== undefined &&
          e.submissionDate >= args.submissionDateFrom!
      );
    }
    if (args.submissionDateTo !== undefined) {
      expenses = expenses.filter(
        (e) =>
          e.submissionDate !== undefined &&
          e.submissionDate <= args.submissionDateTo!
      );
    }

    // Join lookup names + submitter name, then apply submitterName filter
    const joined = await Promise.all(
      expenses.map(async (expense) => {
        const [category, currency, status, submitter] = await Promise.all([
          expense.categoryId ? ctx.db.get(expense.categoryId) : null,
          expense.currencyId ? ctx.db.get(expense.currencyId) : null,
          ctx.db.get(expense.statusId),
          ctx.db.get(expense.userId),
        ]);
        return {
          ...expense,
          categoryName: category?.name ?? null,
          currencyCode: currency?.code ?? null,
          statusName: status?.name ?? null,
          submitterName: submitter?.name ?? null,
        };
      })
    );

    if (args.submitterName) {
      const search = args.submitterName.toLowerCase();
      return joined.filter((e) => e.submitterName?.toLowerCase().includes(search));
    }

    return joined;
  },
});

/**
 * Returns a single expense by ID with full history.
 * The requester must own the expense OR have VIEW_EXPENSES permission.
 */
export const getExpenseById = query({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found.");

    const permissions = await getUserPermissions(ctx, userId);
    const ownsExpense = expense.userId === userId;
    const canViewAll = permissions.includes("VIEW_EXPENSES");

    if (!ownsExpense && !canViewAll) {
      throw new ConvexError(
        "Forbidden: You do not have permission to view this expense."
      );
    }

    const [category, currency, status] = await Promise.all([
      expense.categoryId ? ctx.db.get(expense.categoryId) : null,
      expense.currencyId ? ctx.db.get(expense.currencyId) : null,
      ctx.db.get(expense.statusId),
    ]);

    const historyDocs = await ctx.db
      .query("entityStatusHistory")
      .withIndex("by_expenseId", (q) => q.eq("expenseId", expenseId))
      .collect();

    const history = await Promise.all(
      historyDocs.map(async (h) => {
        const [fromStatus, toStatus, actor] = await Promise.all([
          h.fromStatusId ? ctx.db.get(h.fromStatusId) : null,
          ctx.db.get(h.toStatusId),
          ctx.db.get(h.actorId),
        ]);
        return {
          ...h,
          fromStatusName: fromStatus?.name ?? null,
          toStatusName: toStatus?.name ?? null,
          actorName: actor?.name ?? null,
        };
      })
    );

    return {
      ...expense,
      categoryName: category?.name ?? null,
      currencyCode: currency?.code ?? null,
      statusName: status?.name ?? null,
      history,
    };
  },
});

/**
 * Returns the list of status transitions the current user can trigger on an expense.
 * Applies both permission checks and the business rule that a user cannot
 * approve/reject their own expenses.
 */
export const getAvailableTransitions = query({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new ConvexError("Unauthorized");

    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found.");

    const permissions = await getUserPermissions(ctx, userId);
    const ownsExpense = expense.userId === userId;
    const canViewAll = permissions.includes("VIEW_EXPENSES");

    if (!ownsExpense && !canViewAll) {
      throw new ConvexError(
        "Forbidden: You do not have permission to view this expense."
      );
    }

    const transitions = await ctx.db
      .query("statusTransition")
      .withIndex("by_fromStatus", (q) =>
        q.eq("fromStatusId", expense.statusId)
      )
      .collect();

    const allowed: Array<{
      transitionId: Id<"statusTransition">;
      toStatusName: string;
      toStatusId: Id<"expenseStatus">;
    }> = [];

    for (const transition of transitions) {
      // Check required permissions for this transition
      const transitionPerms = await ctx.db
        .query("expenseStatusTransitionPermission")
        .withIndex("by_transitionId", (q) =>
          q.eq("transitionId", transition._id)
        )
        .collect();

      const hasAllPerms = await Promise.all(
        transitionPerms.map(async (tp) => {
          const permDoc = await ctx.db.get(tp.permissionId);
          return permDoc ? permissions.includes(permDoc.name) : false;
        })
      );

      if (!hasAllPerms.every(Boolean)) continue;

      // Get the target status name
      const toStatus = await ctx.db.get(transition.toStatusId);
      if (!toStatus) continue;

      // Business rule: cannot approve/reject own expenses
      if (
        ownsExpense &&
        (toStatus.name === "approved" || toStatus.name === "rejected")
      ) {
        continue;
      }

      allowed.push({
        transitionId: transition._id,
        toStatusName: toStatus.name,
        toStatusId: toStatus._id,
      });
    }

    return allowed;
  },
});

// ---------------------------------------------------------------------------
// Seed internal mutation
// ---------------------------------------------------------------------------

/**
 * Seeds all lookup data required for the expense workflow:
 * - expenseStatus records
 * - statusTransition records
 * - expenseStatusTransitionPermission links
 * - expenseCategories
 * - currencies
 *
 * Safe to re-run — existing records are skipped (upsert pattern).
 */
export const _seedExpenseLookups = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Upsert expense statuses
    const statusNames = ["draft", "submitted", "approved", "rejected"] as const;
    const statusIds: Record<string, Id<"expenseStatus">> = {};

    for (const name of statusNames) {
      const existing = await ctx.db
        .query("expenseStatus")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();

      if (existing) {
        console.log(`[seed] expenseStatus "${name}" already exists — skipping`);
        statusIds[name] = existing._id;
      } else {
        statusIds[name] = await ctx.db.insert("expenseStatus", { name });
        console.log(`[seed] Created expenseStatus: ${name}`);
      }
    }

    // 2. Upsert status transitions
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
        console.log(`[seed] statusTransition "${key}" already exists — skipping`);
        transitionIds[key] = existing._id;
      } else {
        transitionIds[key] = await ctx.db.insert("statusTransition", {
          fromStatusId: fromId,
          toStatusId: toId,
        });
        console.log(`[seed] Created statusTransition: ${key}`);
      }
    }

    // 3. Get permission IDs
    const addExpensePerm = await ctx.db
      .query("permissions")
      .withIndex("by_name", (q) => q.eq("name", "ADD_EXPENSE"))
      .unique();
    const reviewExpensesPerm = await ctx.db
      .query("permissions")
      .withIndex("by_name", (q) => q.eq("name", "REVIEW_EXPENSES"))
      .unique();

    if (!addExpensePerm || !reviewExpensesPerm) {
      throw new ConvexError(
        "Permissions not found. Run seedAll first to create roles and permissions."
      );
    }

    // 4. Upsert transition permission links
    const transitionPermLinks: Array<[string, Id<"permissions">]> = [
      ["draft→submitted", addExpensePerm._id],
      ["submitted→approved", reviewExpensesPerm._id],
      ["submitted→rejected", reviewExpensesPerm._id],
      ["rejected→submitted", addExpensePerm._id],
    ];

    let transitionPermCount = 0;
    for (const [transitionKey, permissionId] of transitionPermLinks) {
      const transitionId = transitionIds[transitionKey];
      if (!transitionId) continue;

      const existing = await ctx.db
        .query("expenseStatusTransitionPermission")
        .withIndex("by_transitionId", (q) =>
          q.eq("transitionId", transitionId)
        )
        .filter((q) => q.eq(q.field("permissionId"), permissionId))
        .unique();

      if (existing) {
        console.log(
          `[seed] transition permission "${transitionKey}" already exists — skipping`
        );
      } else {
        await ctx.db.insert("expenseStatusTransitionPermission", {
          transitionId,
          permissionId,
        });
        console.log(
          `[seed] Created transition permission: ${transitionKey}`
        );
        transitionPermCount++;
      }
    }

    // 5. Upsert expense categories
    const categoryNames = [
      "Travel",
      "Meals & Entertainment",
      "Office Supplies",
      "Software & Subscriptions",
      "Hardware & Equipment",
      "Marketing",
      "Training & Education",
      "Other",
    ];

    let categoryCount = 0;
    for (const name of categoryNames) {
      const existing = await ctx.db
        .query("expenseCategories")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();

      if (existing) {
        console.log(`[seed] expense_category "${name}" already exists — skipping`);
      } else {
        await ctx.db.insert("expenseCategories", { name });
        console.log(`[seed] Created expense_category: ${name}`);
        categoryCount++;
      }
    }

    // 6. Upsert currencies
    const currencyDefs = [{ code: "USD", name: "US Dollar" }];

    let currencyCount = 0;
    for (const { code, name } of currencyDefs) {
      const existing = await ctx.db
        .query("currencies")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();

      if (existing) {
        console.log(`[seed] currency "${code}" already exists — skipping`);
      } else {
        await ctx.db.insert("currencies", { code, name });
        console.log(`[seed] Created currency: ${code}`);
        currencyCount++;
      }
    }

    console.log("[seed] Expense lookups seeding complete.");

    return {
      statuses: statusNames.length,
      transitions: transitionDefs.length,
      transitionPermissions: transitionPermCount,
      categories: categoryCount,
      currencies: currencyCount,
    };
  },
});
