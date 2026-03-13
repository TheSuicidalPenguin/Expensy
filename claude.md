---
name: fullstack-dev
description: Claude full-stack developer agent for Expensy, handling Convex backend + frontend, password auth, role-permission system, React, Next.js, and full-stack guidance
---
# Project: Expensy

## Tech Stack
- **Backend**: Convex v1.25+ (Cloud-native reactive database)
- **Auth**: Convex Auth (Built-in, Password provider only)
- **Frontend**: React 18+, Next.js 14/15
- **Node.js**: v22.16.0
- **Package Manager**: npm
- **Libraries**: @convex-dev/auth v1+, @auth/core@0.37.0

## Project Structure
- `convex/`: Backend schema, queries, mutations, auth logic, role-permission tables
- `src/`: Frontend React source code
- `src/components/`: Reusable UI components
- `src/hooks/`: Custom React hooks (including Convex hooks)
- `src/context/`: AuthContext and provider setup for password auth
- `src/pages/` or `src/app/`: Next.js route-based pages

## Core Commands
- **Dev Backend**: `npx convex dev`
- **Dev Frontend**: `npm run dev`
- **Typegen**: Handled automatically by `convex dev`

## App Overview
Internal expense tracking application with two roles: **Manager** and **Employee**. Frontend and backend flows are integrated via Convex RPC APIs with built-in password authentication. All mutations validate user auth, role, and permissions. Frontend uses useConvexAuth() to conditionally render UI components and prevent unauthorized actions.

## Roles & Permissions

| Role | Permissions |
|------|------------|
| Employee | ADD_EXPENSE, VIEW_OWN_EXPENSES |
| Manager | ADD_EXPENSE, VIEW_OWN_EXPENSES, VIEW_EXPENSES, REVIEW_EXPENSES |

- Roles are linked to users via a **user table** with a `role` field.
- Backend mutations check both `auth.getUserId(ctx)` and the user’s permissions before executing any action.
- Frontend uses `<Authenticated>` wrappers and `useConvexAuth()` to hide or disable UI elements if the user lacks required permissions.
- Edge cases such as missing permissions or invalid roles throw **custom errors**.

## Lookup Tables
- **`expense_category`** – predefined expense categories (used as FK on expenses)
- **`currency`** – supported currencies (currently USD only; extensible)
- **`user`** – stores user info, role, and associated permissions
- **`role_permissions`** – maps each role to its set of permissions

## Expense Fields
All fields are required.

| Field | Type | Notes |
|-------|------|-------|
| description | Text | — |
| receipt | File upload | Max 5MB; accepted: JPG, JPEG, PNG, GIF, WEBP, BMP, TIFF |
| expense_category | Lookup (FK) | References `expense_category` table |
| other_expense_category | Text | For category "Other" |
| expense_date | Date | Date the expense occurred |
| submission_date | Date | Date the expense was submitted |
| amount | Number (decimal) | — |
| currency | Lookup (FK) | References `currency` table |

## Expense Lifecycle
Draft → Submitted → Approved
                  ↘ Rejected → Resubmitted → Approved
                  ↘ Rejected

- Expenses can be saved as draft before submission.
- Managers can approve or reject submitted expenses.
- Rejected expenses can be resubmitted.
- All status changes are tracked as an audit trail.

## Filters (Expense List)
Applicable on all expense list views:
- Description
- Expense date
- Expense category
- Submission date

## Authentication
- Login via **email and password** only (no self-signup).
- Password reset via email.
- Backend uses Convex Auth with password provider only.
- AuthContext is defined in `src/context/` and wraps the app with `<ConvexAuthProvider client={convex}>`.
- Frontend components use `useConvexAuth()` to check auth state before rendering content.
- Conditional UI uses `<Authenticated>`, `<Unauthenticated>`, and `<AuthLoading>` to show proper views.

## User Flows

### Employee
1. Log in with email & password
2. Dashboard:
   - Submit a new expense (requires ADD_EXPENSE permission)
   - View own draft/submitted expenses (requires VIEW_OWN_EXPENSES)
3. Backend mutations validate `auth.getUserId(ctx)` and check role/permissions.
4. Frontend hides buttons/actions if permissions are missing.

### Manager
1. Log in with email & password
2. Dashboard:
   - Submit a new expense (ADD_EXPENSE)
   - View own draft/submitted expenses (VIEW_OWN_EXPENSES)
   - View all employee-submitted expenses (VIEW_EXPENSES)
   - Approve/reject expenses (REVIEW_EXPENSES)
3. Backend enforces role/permissions and throws custom errors for invalid actions.
4. Frontend conditionally renders UI components based on permissions.

## Full-Stack Integration Notes
- Backend mutations and queries enforce authentication and role/permission checks using `auth.getUserId(ctx)` and the user’s role.
- Frontend uses `useConvexAuth()` to verify session state and conditionally render UI components.
- All RPC calls handle errors with custom messages.
- Edge cases (expired tokens, missing permissions, invalid input, network failures) are explicitly handled; agent should ask clarifying questions if behavior is ambiguous.
- Schema, routes, hooks, and UI flows are documented with detailed descriptions for every method, component, and mutation.
- SSR and client-side fetching in Next.js are documented with guidance on when to prefer each.
- All integration between frontend and backend is fully annotated to serve as a reference for the agent.

## Convex Auth Setup
- Install libraries: `npm install @convex-dev/auth @auth/core@0.37.0` and initialize: `npx @convex-dev/auth`
- Add auth tables to schema: `defineSchema({ ...authTables, /* your tables including user and role_permissions */ })`
- Configure backend routes: initialize `convexAuth({ providers: ["password"] })` and add HTTP routes via httpRouter
- Wrap app with `<ConvexAuthProvider client={convex}>` in `src/context/` or main entry
- Frontend uses `useConvexAuth()` for client-side auth checks and conditional UI
- Mutations validate current user with `auth.getUserId(ctx)` and verify role and permissions, throwing custom errors if unauthorized
- All RPC calls and UI flows include detailed documentation, error handling, and edge-case handling