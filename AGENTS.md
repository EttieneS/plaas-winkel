# Aanlyn Plaas workspace conventions

These standing instructions apply to this entire workspace and future work. They supersede older guidance discouraging repository layers. Read the global product, workflow, and engineering guides under `$HOME/.codex-aanlyn`, this file, applicable application AGENTS.md files, and nested instructions before editing.

## Workspace and product

The root is `$HOME/projects/plaas-winkel` (currently `C:/Users/smith/projects/plaas-winkel`).
- `mercatur/`: Angular frontend.
- `mercatur-api/`: Laravel backend/API.

The intended repository organization is two independent Git repositories, coordinated from this parent workspace. Inspection on 2026-09-30 currently finds a .git directory at the parent and none at either application root. Reinspect each Git root before repository operations; preserve the application boundaries and current Git metadata until a repository-layout change is explicitly requested. Use one Angular application with access determined by authentication/authorization. Laravel owns business rules, permissions, inventory/reservations, and payment state. Keep the modular monolith and MVP simple.

Aanlyn Plaas is farm-to-customer group purchasing, not investment, donations, or crowdfunding. Preserve provenance from animal/source lot through slaughter, carcass, processing batch, packaged product, order, and customer. Unknown evidence must remain unknown. Do not invent payment, cancellation, or unmet-target policies.

## Backend: Controller -> Service -> Repository

- Controllers handle HTTP concerns only, validate/request input through the appropriate request layer, call services, and return the standard JSON response. Do not put business logic or database queries in controllers.
- Services contain business/application logic and coordinate repositories and other services. Keep HTTP presentation concerns out of services.
- Repositories own database/data-access concerns. Keep Eloquent/query logic out of controllers and, where practical, out of services.
- Extend these layers explicitly as needed; avoid speculative abstractions. Do not invent an existing service or repository implementation.
- Server validation and authorization remain mandatory.

## Routes and Angular pages

Laravel `routes/api.php` assembles feature files in `routes/api/`. Preserve feature route grouping, prefixes, middleware, and controller method routing. Auth is grouped under `auth`; products and sales files are included separately.

Angular `src/app/app.routes.ts` assembles feature arrays from `src/app/routes/*.routes.ts`, including `AUTH_ROUTES` and `SALES_ROUTES`. Keep child routes in the feature file and layouts/guards at the appropriate parent boundary.

Route-level screens belong in `src/app/pages/<domain>/<action>/`: `index` for lists/overviews, `create` for creation, `edit` for editing, and `view` for individual resources. Keep reusable UI under components, separate from pages. Existing sales `details` is legacy; do not rename URLs or pages incidentally.

Angular services own HTTP communication and application services. Components must not duplicate API calls or response/error parsing.

## Actual API JSON contract

The established envelope is implemented by `mercatur-api/app/Support/ApiResponse.php`, used by the base Controller helpers and API exception renderer, and mirrored by `mercatur/src/app/interfaces/api-response.interface.ts`:

```json
{ "success": true, "message": "OK", "data": null }
```

```json
{ "success": false, "message": "Validation failed.", "data": null, "errors": { "email": ["The email field is required."] } }
```

- `success` is boolean; `message` is a string; `data` is the operation payload or null.
- `errors` is optional and maps field names to arrays of validation messages.
- `Controller::success(data, message, status)` defaults to message `OK` and HTTP 200.
- `Controller::error(message, status, data, errors)` defaults to HTTP 400, null data, and omits errors unless supplied.
- Preserve meaningful HTTP status codes. Login credential rejection currently returns HTTP 401 with `Invalid email or password.`
- All success, validation, authentication/authorization, business-rule, not-found, and unexpected API responses must use this established mechanism/envelope. Do not introduce ad-hoc shapes or change the contract to suit the frontend. Never expose internal exception details as user messages.

Implemented on 2026-09-30: controllers and API exceptions share ApiResponse. Validation errors include field messages; authentication/authorization and not-found errors keep meaningful statuses; unexpected exceptions return a safe generic message without internal details. Authentication and user-management controllers delegate to services and repositories. Login remains `data: { token, user }`; `/api/auth/user` remains the user directly in `data`. Both user objects now include role codes and effective permission codes.

## Toasts and central API feedback

The application-wide user feedback mechanism is `UtilToastService` at `mercatur/src/app/services/util-toast.service.ts`. Components and services must use `toast.success(message)`, `toast.error(message)`, `toast.warning(message)`, and `toast.info(message)`. New pages/features must reuse this service; do not create their own toast/snackbar implementations or use browser `alert()` for normal feedback.

The service wraps the existing Material overlay with the custom `UtilToast` presentation: always top-right, green success, red error, amber warning, blue info, icons, accessible dismissal, readable wrapped text, rounded corners and shadow. Notifications queue sequentially instead of overlapping. Base timeout is 5 seconds, or 10 seconds for errors; long messages receive up to 10 extra seconds. All notifications can be closed manually.

Frontend API services pipe user-triggered operations through `ApiFeedbackService.forOperation()`. It normalizes errors, preserves a usable backend message, appends useful field validation messages, and delegates one notification to `UtilToastService`. The flow is HTTP response -> central API response/error parser -> meaningful backend/field messages -> UtilToastService -> top-right toast. A generic fallback is used only when neither backend nor field messages are usable. HTTP failures remain on the Observable error channel as `ApiFeedbackError`, preserving status and field errors. A response with `success: false` remains a failed application outcome even with HTTP 200; it must not trigger successful UI state.

Success feedback uses the API message where appropriate. Components consume normalized errors for field-level UI if needed, but must not parse HttpErrorResponse or show duplicate operation toasts. Background reads need not show success toasts; operation feedback should be intentional.

## Database-driven roles and permissions

RBAC uses `roles`, `permissions`, `user_roles`, and `role_permissions`. Role/permission codes are unique. Pivot pairs have composite primary keys, foreign keys, and indexes; a user can hold multiple roles and a role multiple permissions. Do not add comma-separated roles/permissions, is_admin-style boolean columns, direct user permission overrides, or frontend-only authorization. Permissions belong to roles; users receive them through their assigned roles.

Initial roles are BUYER, FARMER, and ADMIN. ADMIN represents application administration, not a farmer/business account. It receives `users.view`, `users.create`, `users.edit`, `users.delete`, `roles.view`, `roles.create`, `roles.edit`, `roles.delete`, `roles.assign`, `permissions.view`, and `permissions.assign` through database relationships. BUYER and FARMER initially receive no management permissions. These defaults are not evidence of implemented edit/delete screens or endpoints. No ADMIN-code bypass is permitted.

Use `User::hasRole(code)` and `User::hasPermission(code)` on the backend and the corresponding central `AuthService` methods in Angular. Effective permissions are the deduplicated union of assigned roles' permissions. Prefer permission checks for feature access. Laravel permission middleware and request/service checks are authoritative; Angular permissions only control navigation and UI visibility.

Drawer entries declare an optional `permission` code. The Users entry requires `users.view`; unauthorized entries are hidden. Users routes also declare required permissions and use the central route guard. A stored token is not sufficient: after a reload, `AuthService.ensureUser()` hydrates the user through `/api/auth/user` before protected navigation. Profile permissions stay in memory and never authorize backend requests.

### User management endpoints and request contract

All responses use the existing envelope above:

| Endpoint | Required permissions | Data |
| --- | --- | --- |
| GET `/api/users?page=1` | `users.view` | `{ users: [...], pagination: { current_page, last_page, per_page, total } }`, 25 users per page |
| POST `/api/users` | `users.create`, `roles.assign` | Created user, HTTP 201, message `User created successfully.` |
| GET `/api/roles` | `roles.view`, `roles.assign` | Array of assignable `{ id, name, code }` roles |

Creation input is `{ name, email, password, password_confirmation, role_ids: number[] }`. Use non-empty distinct existing role IDs; role codes and direct permissions are not accepted as grants. Names/emails are limited to 255 characters; passwords require at least 8 characters and matching confirmation. Only intended fields are persisted. Email is trimmed/lowercased and uniqueness is enforced in the database. Validation retains useful field errors.

Role assignment cannot grant permissions the actor does not already hold, even when the role ID is valid. The available-role endpoint filters by the same rule and creation rechecks it on the server. User creation and role attachment occur atomically. Pages live at `/users` and `/users/create`, under `pages/users/index` and `pages/users/create`. The create UI requires `users.create`, `roles.assign`, and `roles.view`; successful create uses the backend message through `ApiFeedbackService` -> `UtilToastService`. Edit/delete capabilities are reserved permissions, not implemented by this task.

### Capability design and administration boundaries

Authentication identifies the user; authorization determines what they may do. Keep those concerns distinct. ROLE = collection of permissions; PERMISSION = ability to perform an action; BACKEND = authority; ANGULAR = UI/UX representation.

Permission codes use stable `<resource>.<action>` names. Do not create vague permissions such as `admin`, `farmer`, `buyer`, `full_access`, or `can_do_everything`. Prefer `hasPermission()` for application features, including future business operations. Only check a role when the role itself matters. Do not substitute ADMIN/FARMER/BUYER comparisons for capability checks.

FARMER represents a seller/farming business account. BUYER represents a marketplace customer. Their capabilities must be permission grants rather than hard-coded role checks. Add business permissions only for implemented or currently required functionality; product/order permission examples are not authorization to invent those features.

Users, Roles, and Permissions are distinct administration concerns. The supported relationship is User -> Role(s) -> Permission(s). Keep their future controllers/services/repositories, feature route files, and Angular pages separate. This task seeds the full administration permission bundle but does not claim role/permission editing endpoints or pages exist. Do not add drawer links to nonexistent routes; future Roles and Permissions entries declare `roles.view` and `permissions.view` respectively and their corresponding endpoints independently enforce access.

Seed definitions by stable code, resolve relationships using those codes rather than hard-coded database IDs, preserve custom grants when reseeding, and never implement an ADMIN allow-everything exception.

### Authorization verification

Changes must test role assignment, permission-to-role relationships, effective permission unions, allowed and rejected endpoint access, ADMIN management grants, and rejection of unprivileged FARMER/BUYER requests. Frontend coverage includes central permission checks, drawer visibility, direct URL guards, and normalized API errors reaching UtilToastService. Run Laravel tests, Angular tests, and the Angular production build; report failures and warnings.

### Migration and safe seeding

Run from `mercatur-api` in the Laragon terminal (or with PHP available on PATH):

```powershell
php artisan migrate
php artisan db:seed
```

`RbacSeeder` upserts definitions and attaches ADMIN permissions without duplicating records or removing custom assignments. `DatabaseSeeder` runs it and, only in local/testing environments, creates the existing development account if absent and attaches ADMIN without resetting an existing name or password. No production user is automatically granted ADMIN. To seed definitions only, use `php artisan db:seed --class=RbacSeeder`.

After seeding, log out/in or reload so Angular retrieves the new permissions. Do not use `migrate:fresh` for setup against an existing database. The RBAC migration only adds authorization tables; its rollback drops those tables and their grants, so rollback is destructive to authorization data.

## Change discipline and validation

Inspect existing implementations and Git state; preserve unrelated work. No commits, pushes, dependency changes, relocation, or destructive operations without authorization. Keep application code cross-platform and secrets out of source and client bundles.

For frontend changes run existing `npm test -- --watch=false` and `npm run build` from mercatur. Report failures and build warnings accurately. For documentation-only edits review paths, contracts, consistency, and scope; builds are unnecessary.
