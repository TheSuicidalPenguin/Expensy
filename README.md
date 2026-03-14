# Expensy
An expense tracker exercise built with Convex + React. It supports draft expenses, submission and review workflows, receipt uploads, and role-based access for employees and managers.

## What This Project Does
- Employees (and managers acting as employees) can create draft expenses and submit them for review.
- Managers can review and approve/reject submitted expenses (but cannot approve their own).
- Expenses keep a full status history for auditability.
- Receipts are uploaded to Convex storage and validated on submission.
- Expense dates are stored separately from submission dates (UTC in storage, local in UI).

This follows the Q&A constraints: no signup UI (users are seeded), no notification system, and the architecture is set up for future features without implementing them yet.

## Architecture Overview
The backend separates:
- **Auth & roles** (Convex Auth + role/permission tables).
- **Workflow state** (status, transitions, and transition permissions).
- **Domain data** (expenses + lookup tables for categories and currencies).

This makes the workflow extensible: new statuses or transitions can be added as data, without changing core mutation logic. The transition engine validates both allowed transitions and required permissions, then writes a history record.

## Database Structure
All tables are defined in `convex/schema.ts`.

### Auth & Access Control
- `users` (from Convex Auth, extended with `roleId`)
- `roles` (`employee`, `manager`)
- `permissions` (e.g. `ADD_EXPENSE`, `VIEW_EXPENSES`, `REVIEW_EXPENSES`)
- `rolePermissions` (many-to-many role ↔ permission)

### Workflow Tables
- `expenseStatus` (`draft`, `submitted`, `approved`, `rejected`)
- `statusTransition` (allowed state transitions)
- `expenseStatusTransitionPermission` (required permission per transition)
- `entityStatusHistory` (audit log of state changes)

### Domain Tables
- `expenses` (core expense data, including `expenseDate` and `submissionDate`)
- `expenseCategories` (lookup table; configurable later)
- `currencies` (lookup table for supported currency codes)

> Note on currencies: this is intentionally a lookup table to signal future multi-currency support even though USD is the only seeded value today.

## Workflow Design (Extensible by Design)
The expense workflow is data-driven. The transition engine:
1. Looks up the current status.
2. Checks whether the transition is allowed.
3. Verifies required permissions for the transition.
4. Writes a history record and updates the expense.

Because transitions live in tables, it is easy to add new states (e.g. `needs_changes`, `reimbursed`) or new transitions later without touching the mutation logic.

## Seeded Data
Local development seeds:
- Roles, permissions, and role ↔ permission mappings
- Users (no signup flow)
- Expense statuses, transitions, categories, and currencies

Seed command (safe to re-run):
```
npx convex run seed:seedAll
```

## Running Locally
Prereqs:
- Node.js 18+ and npm
- Convex CLI (installed via `npx` in the steps below)

1. Install dependencies:
```
npm install
```

2. Start Convex dev (generates a dev deployment and `.env.local` values):
```
npx convex dev
```

3. Seed data (roles, permissions, users, statuses, lookups):
```
npx convex run seed:seedAll
```

4. Start the web app:
```
npm run dev
```

If you need to re-seed, you can re-run step 3 any time.

## Why This Architecture
This setup keeps business rules explicit and data-driven:
- **Permission checks** are centralized and reusable.
- **Transitions** are data, not hardcoded branches.
- **History** is always captured for auditability.
- **Lookup tables** (categories, currencies) make future configuration changes straightforward.
