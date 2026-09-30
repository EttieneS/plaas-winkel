# Marketplace product types

Marketplace product types are database-driven. Product types such as
Cattle and Cabbage must come from the products table/API and must never
be hard-coded as Angular navigation or dropdown options. Stable product
slugs are used when product-specific application behaviour is required.

/sell is the database-driven product selection entry point. Selecting a
product navigates to its product-specific selling workflow using the
stable product slug. Product-specific routes are not side-drawer
navigation items. Different agricultural products have independent
selling rules and units; for example cattle is weight/carcass based while
cabbage is quantity based.
`ProductService` retrieves active products from `GET /api/products` using the
standard JSON envelope. The API follows ProductController -> ProductService ->
ProductRepository -> Product. Both the endpoint and Sell use the existing
`cattle.create` permission; role codes do not bypass permission checks.

ProductSeeder creates Cattle (`cattle`) and Cabbage (`cabbage`) by stable slug,
without overwriting existing names, descriptions or active status on reseeding.
The drawer contains Sell / List farm products, with no product-specific entries.
The Sell entry component loads products and uses their stable slugs to navigate
to supported workflow routes. Route pages live in `src/app/routes/sell/`:
`index/sell-index.component.*`, `cattle/index/cattle-index.component.*` and
`cabbage/index/cabbage-index.component.*`. Routes are `/sell`, `/sell/cattle`
and `/sell/cabbage`. Cattle manages the authenticated user's cattle sales in a
Material table with an inline Create Sale form. Add Cabbage Listing remains
disabled. An API product without
an implemented workflow route remains available in the selector and receives
a Coming soon notification. Reusable UI belongs under `src/app/components/`.

The products table defines what can be sold, not how it is sold. Product domain
code owns its selling units and rules. Do not add product-specific fields to
products or create a universal listing schema with nullable domain columns.
Seller cattle sale creation/listing and buyer kg commitments are implemented. The old `/cattle/create` route
remains available separately but is not linked from the drawer or Sell selector.

Apply the products migration from `mercatur-api` with `php artisan migrate`,
then seed with `php artisan db:seed --class=ProductSeeder`. DatabaseSeeder also
runs ProductSeeder. Preserve the standing instruction hierarchy in AGENTS.md.

products defines what product types the marketplace supports.
cattle_sales represents individual cattle sale listings. A cattle sale
starts with an estimated sellable weight in kilograms. This estimate is
not the animal's live weight. Product-specific selling rules belong in
their product domain, not dbo.products.

GET and POST `/api/cattle-sales` require authentication and `cattle.create`.
Both use CattleSaleController -> CattleSaleService -> CattleSaleRepository ->
CattleSale, with the existing JSON envelope. GET returns only the signed-in
user's sales as an array; there is no ADMIN ownership bypass. POST accepts
estimated_weight_kg, price_per_kg and optional description. Server-controlled
owner, reference, available weight and status cannot be supplied by the client.
The owner_user_id FK references users with restricted deletion. The server
generates a unique CS-UUID reference and sets OPEN. Initially, derived available
weight equals estimated weight. Weights are DECIMAL(9,3), price is DECIMAL(8,2), and API
decimals are strings. Validation caps values to storage precision, requires
positive values and limits description to 10,000 characters.

Creation uses central success/error toasts, resets/closes the form and reloads
the table only on success. Failure retains entered values. Details is disabled.
This iteration implements no purchases, payments,
slaughter, actual carcass weight, cuts, boxes, fulfilment, delivery or multiple
animals in a sale. The old cattle_listings domain remains separate.

Cattle sales use a group-buy commitment model. Buyers reserve kilograms
against an OPEN cattle sale. Availability is derived from confirmed
commitments rather than trusted frontend state. The cattle sale becomes
FULLY_COMMITTED when confirmed committed kilograms reach the estimated
sellable weight. FULLY_COMMITTED is not equivalent to SOLD; slaughter,
actual carcass weight and reconciliation occur later.

Commitment creation must be transactional and lock the cattle sale while
checking remaining capacity to prevent overselling.

Buyer Sales no longer uses demo beef boxes, packages or box inventory.
`/sales` (including its existing `/sales/index` and `/sales/:id` routes) is buyer-facing;
`/sell/cattle` remains seller-facing and has no buyer reservation controls.
GET `/api/cattle-sales/marketplace` lists OPEN cattle sales, and GET
`/api/cattle-sales/{cattleSale}` returns allocation details. Both require
`cattle.view`. POST `/api/cattle-sales/{cattleSale}/commitments` requires
`cattle.reserve` and accepts only quantity_kg. BUYER receives both permissions,
FARMER receives cattle.view plus existing cattle.create, and ADMIN receives all
through RBAC relationships. Owners cannot reserve their own sale, including
ADMIN or users with both buyer and farmer roles. No role-code bypass exists.

cattle_sale_commitments stores sale/buyer foreign keys (restricted deletion),
quantity_kg DECIMAL(9,3), the sale's authoritative price_per_kg DECIMAL(8,2),
status and timestamps. New commitments are CONFIRMED; PENDING and CANCELLED
do not consume capacity. There are no edit/cancellation endpoints. Buyer ID,
price, status and calculated allocation/total fields cannot be submitted by
Angular. Calculated total_amount is rounded half up to rand cents and is not stored.

The stored cattle_sales.available_weight_kg column is removed by migration.
API available_weight_kg is only an alias of remaining_weight_kg, calculated as
estimated_weight_kg minus the sum of CONFIRMED quantity_kg. Committed, remaining
and available kg are serialized as decimal strings; percentage_committed is
rounded to two decimal places for display. Brick Math handles authoritative
kg and monetary arithmetic. UI estimated totals are informational only.

The commitment service starts a transaction, locks the sale via
CattleSaleRepository::lock (lockForUpdate), reads commitments under lock,
validates capacity/ownership/status, inserts the commitment with the sale price,
sets FULLY_COMMITTED at zero remaining, and returns refreshed allocation after
the atomic operation. Concurrent reservations follow the same sale-first lock
order; deadlocks are retried up to five times. Tests include rollback, exact
decimal boundaries and a real overlapping MySQL reservation test against a
random isolated database (`RUN_CATTLE_MYSQL_CONCURRENCY=1 php artisan test`).
The isolated test creates/removes only its own cattle_reservation_test_* database.

Buyer responses omit private owner/buyer data and include can_reserve for UI
presentation; backend checks remain authoritative. CattleMarketplaceService and
CattleReservationComponent reuse ApiFeedbackService -> UtilToastService. The
reservation response's freshly calculated sale replaces the displayed allocation
without a browser refresh. Fully committed sales have no reservation controls.
Apply the two commitment/availability migrations and reseed RbacSeeder, then
reload/sign in to retrieve cattle.view and cattle.reserve. No payment or final
fulfilment behaviour is implemented.
