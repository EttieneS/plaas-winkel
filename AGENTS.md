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

## Sell entry point

Sell (`/sell`) is the database-driven product selection entry point for farmer/business listings. Its Material selector loads active products through ProductService from GET `/api/products`. The API follows ProductController -> ProductService -> ProductRepository -> Product and the established JSON envelope. ProductSeeder seeds Cattle and Cabbage by unique slug without overwriting catalogue edits. Selection navigates by stable slug to `/sell/cattle` or `/sell/cabbage`, with independent domain pages. Cattle loads the signed-in user's cattle sales into a Material table and provides an inline Create Sale form. Add Cabbage Listing remains disabled. Products without an implemented route receive a Coming soon notification. See `codex_instructions.md` for the database-driven product type rule and cattle sale contract.

Sell pages live in `mercatur/src/app/routes/sell/index/`, `routes/sell/cattle/index/` and `routes/sell/cabbage/index/`, assembled by `routes/sell.routes.ts`. Reusable components belong under components; interfaces and services retain their existing directories. The products table defines availability, while separate domain workflows define selling units and business rules (cattle is weight/carcass based, cabbage is quantity based). Do not put domain fields on products or create a universal listing schema with nullable product-specific columns.

Sell drawer visibility, all Sell routes and GET `/api/products` reuse central permission checks with the existing `cattle.create` capability. FARMER (the current business/seller role) and ADMIN receive this permission through RBAC; BUYER does not by default. There is no separate BUSINESS role or role-code bypass. The drawer contains only Sales, Sell and Users subject to permissions; no product-specific entries. The existing `/cattle/create` carcass form remains separately accessible; Create Sale does not invoke it.

## Cattle sales

`products` defines available product types; `cattle_sales` records individual farmer-owned cattle sales. Estimated sellable kg is an estimate of weight available for sale, not live animal weight or verified carcass weight. The old carcass `cattle_listings` implementation remains separate.

GET and POST `/api/cattle-sales` use Sanctum and `cattle.create`, with CattleSaleController -> CattleSaleService -> CattleSaleRepository -> CattleSale. GET returns an array of only the actor's sales, newest first. POST accepts estimated_weight_kg, price_per_kg and optional description and returns the created sale in the standard envelope (HTTP 201, `Cattle sale created successfully.`). Owner, reference, available weight and status are server-controlled. A unique CS-UUID reference is generated server-side; status is OPEN and available kg initially equals estimated kg. Decimal weights are stored as DECIMAL(9,3), price as DECIMAL(8,2), and serialized as strings. Positive values, matching precision/storage limits and max 10,000-character descriptions are validated server-side. owner_user_id references users with restricted deletion, and both sides expose the ownership relationship. ADMIN can only list its own sales through this endpoint.

The inline Reactive Form keeps values on failure and uses ApiFeedbackService -> UtilToastService for one operation notification. Success closes/resets the form and reloads the MatTable. Table columns are Reference, Estimated kg, Price / kg (rand), Available kg, Status, Created and disabled Details. Buyer kg reservations are now implemented in Sales, separately from this seller UI. No purchases, payment, slaughter, actual weight, cuts, boxes, fulfilment, delivery, or multiple-animal sales are implemented.

### Buyer cattle commitments

`/sales` is buyer-facing and replaces the former demo beef-box data; `/sell/cattle` remains seller-facing. BUYER receives cattle.view and cattle.reserve, FARMER receives cattle.view plus cattle.create, and ADMIN receives all three through RBAC. A user with cattle.reserve cannot reserve its own sale, including ADMIN or mixed-role accounts. Cattle reservation controls use backend can_reserve plus central AuthService permission checks. Backend validation and permission checks are authoritative.

GET `/api/cattle-sales/marketplace` lists OPEN sales; GET `/api/cattle-sales/{cattleSale}` returns a sale's allocation (both require cattle.view). POST `/api/cattle-sales/{cattleSale}/commitments` requires cattle.reserve and accepts only quantity_kg. New commitments are CONFIRMED, with buyer_user_id from authentication and price_per_kg copied from the sale. Buyer IDs, owner IDs and commitment collections are omitted from buyer responses. Commitment edit/cancellation endpoints do not exist.

cattle_sale_commitments uses restricted sale/user foreign keys, DECIMAL(9,3) quantity, DECIMAL(8,2) price and PENDING/CONFIRMED/CANCELLED statuses. total_amount is calculated using Brick Math and rounded half up to two decimals; it is not stored. confirmed kg is summed with exact decimal arithmetic; pending/cancelled kg does not count. remaining = estimated - confirmed. The stored cattle_sales.available_weight_kg column is removed; both owner and buyer responses expose available_weight_kg only as a calculated alias of remaining_weight_kg, together with committed_weight_kg and percentage_committed. Allocation fields cannot be submitted by Angular.

CattleSaleCommitmentController -> CattleSaleCommitmentService -> CattleSaleCommitmentRepository -> CattleSaleCommitment handles reservations. The service orchestrates a transaction, uses CattleSaleRepository to lock the sale row and read its commitments under lock, checks ownership/status/capacity, creates the commitment and changes OPEN to FULLY_COMMITTED when remaining reaches zero. Lock order is sale then commitments; deadlocks are retried up to five times. FULLY_COMMITTED is not SOLD. No slaughter or actual weight reconciliation is implied.

Buyer UI uses CattleMarketplaceService and reusable components/sales/cattle-reservation with Material progress and Reactive Forms. Estimated cost is informational. The reservation response returns freshly calculated allocation, which replaces the displayed sale without a browser refresh; fully committed sales hide reservation controls. Existing ApiFeedbackService -> UtilToastService handles one success/error notification.

Apply the commitment and availability migrations, then seed RbacSeeder and reload the user profile for new permissions. The availability migration preserves sale/commitment records; rollback reconstructs its legacy column from confirmed kg. Tests cover capacity/ownership, exact decimals, migration preservation/rollback, and overlapping MySQL requests against a temporary cattle_reservation_test_* database (enable RUN_CATTLE_MYSQL_CONCURRENCY=1). Products remain unchanged.

## Existing carcass listing creation

Implemented scope: creating a slaughtered-cattle carcass listing only. Do not infer purchasing, reservation, publishing, payment, processing, or group-buying functionality from the statuses or table.

- POST `/api/cattle` requires Sanctum authentication and `cattle.create`. The Angular route `/cattle/create` requires the same permission through the existing central guards. Its former Cattle drawer entry has been removed in favour of generic Sell navigation.
- `RbacSeeder` grants `cattle.create` to FARMER and ADMIN through role_permissions, preserving custom grants on repeated runs. BUYER receives cattle.view/cattle.reserve but no cattle.create. Role codes alone never authorize creation.
- Creation follows CattleListingController -> CattleListingService -> CattleListingRepository, with StoreCattleListingRequest validation. The authenticated user supplies ownership; client farmer_id, status, published_at, and total_value fields are rejected.
- Input: title (required, max 255), optional description (max 10,000), positive carcass_weight_kg (up to 3 decimal places), positive price_per_kg (up to 2 decimal places). Storage is DECIMAL(9,3) for kg and DECIMAL(8,2) for rand/kg; validation caps values at 999999.999 kg and R999999.99/kg to match storage.
- Status values are centralized in App\CattleListingStatus: DRAFT, PUBLISHED, SOLD, CANCELLED. Creation always produces DRAFT with null published_at. No status-transition endpoints exist.
- Success uses the established envelope, HTTP 201, message "Cattle listing created successfully.", and the created listing directly in data. Decimal quantities and total_value are JSON strings. Total value is derived on the backend using the already-installed Brick Math library, rounded half up to 2 decimal places; no total column or client-authoritative total is stored.
- The farmer foreign key references users with restricted deletion, retaining ownership links. User::cattleListings() and CattleListing::farmer() expose the relationship.
- The Angular Reactive Form is under pages/cattle/create, communicates through CattleService, and uses ApiFeedbackService -> UtilToastService for one normalized operation toast. The live estimate is display only; the saved confirmation displays the server value.
- Apply the new cattle_listings migration with `php artisan migrate`, then run `php artisan db:seed --class=RbacSeeder`. Existing users need FARMER or another role granting cattle.create. Reload or sign in again after seeding to refresh effective permissions.
- Coverage includes permission enforcement/revocation, authenticated ownership/spoof rejection, validation, draft defaults, exact totals/rounding, repeatable seeding, frontend estimate/submission/error feedback, and direct-route/drawer permission checks.
