# Merchant Munchies

> **Good Food • Less Queue • More You**

Merchant Munchies is a workplace food-ordering platform designed to reduce cafeteria queues, make employee meal ordering faster, improve vendor demand visibility, and provide a structured workflow for personal meals and corporate catering.

This repository is being implemented with:

- **Frontend:** React + pure JavaScript
- **Backend:** Node.js + Express
- **API documentation:** Swagger / OpenAPI
- **Database:** Online Supabase PostgreSQL
- **Design system:** Existing `design_tokens.md` in the repository

The original project brief defines a solution spanning employee mobile/web experiences, vendor operations, administration, corporate catering, payments, order tracking, reporting, security, integrations, pilot rollout and operational support.

---

## 1. Source of Truth

The functional scope in this README is extracted from the provided **Merchant Munchies Application Development Design Brief**.

The brief defines the product as a **mobile and web-based workplace food-ordering platform** and identifies the initial pilot as **Merchant Place**. It calls for an employee application, vendor portal, administration portal and corporate catering module.

The initial pilot outlets listed in the brief are:

1. Vovo Telo
2. Fresh at First
3. Staff Cafeteria at 1 Merchant Place
4. Staff Cafeteria at 5 Merchant Place
5. Woolworths Food Stop

Participation remains subject to vendor approval, contracts, technical readiness, payment integration and operational feasibility.

---

# 2. Product Vision

## Good food with less waiting

The platform should allow an authenticated employee to:

```text
Sign in
  ↓
Select campus / building
  ↓
Choose vendor
  ↓
Browse menu
  ↓
Search / filter / customise
  ↓
Add to cart
  ↓
Choose collection slot
  ↓
Pay
  ↓
Receive confirmation
  ↓
Track preparation
  ↓
Receive ready notification
  ↓
Present QR / collection reference
  ↓
Collect meal
  ↓
Rate experience
```

The product is not only a food catalogue. It is an operational ordering system connecting employees, vendors, kitchens, administrators, finance/reconciliation users, technical support and authorised corporate-ordering users.

---

# 3. Business Problems the System Solves

The brief identifies the following problems:

- Long lunch-time queues, especially around 12:00–14:00.
- Employees spending approximately 20–30 minutes waiting to order, pay and receive meals.
- Reduced lunch-break recovery and socialisation time.
- Productivity disruption caused by extended time away from workstations.
- Unpredictable demand for food vendors.
- Food shortages, overproduction and avoidable wastage.
- Manual corporate catering handled through email, phone calls and physical collection.
- Limited management information about demand, meal preferences, order volume and service performance.

The application should therefore optimise both the **employee experience** and the **vendor operating workflow**.

---

# 4. Delivery Scope

## 4.1 Employee application

The employee experience must support:

- Secure sign-in.
- Campus selection or automatic campus identification.
- Vendor discovery.
- Current menu browsing.
- Search and filtering.
- Prices and availability.
- Allergen and dietary information.
- Meal customisation.
- Cart management.
- Collection-time selection.
- Payment.
- Order tracking.
- Notifications.
- QR code or order-reference collection.
- Order history and receipts.
- Favourite vendors and meals.
- Repeat previous order.
- Ratings and feedback.
- Cancellation and refund requests where rules permit.

## 4.2 Vendor portal

Vendor staff must be able to:

- Create and maintain menu items.
- Upload descriptions and photographs.
- Set prices.
- Set daily stock quantities.
- Mark items available, limited or sold out.
- Receive new orders.
- Accept/reject where permitted.
- Update order status.
- Manage collection slots.
- View upcoming orders by preparation time.
- Manage corporate catering requests.
- Record completed collections and deliveries.
- View sales, settlement and operational reports.

## 4.3 Administration portal

Administrators must be able to:

- Register and approve campuses, buildings, vendors and collection points.
- Activate/deactivate vendors.
- Manage roles and permissions.
- Configure operating hours and order rules.
- Configure pilot and rollout locations.
- Monitor transaction volume and application performance.
- View feedback.
- Manage complaints and disputes.
- View audit trails.
- Generate reports.
- Configure announcements and service notifications.

## 4.4 Corporate catering

The corporate module supports authorised users such as executives, assistants and meeting/event organisers.

It must support:

- Future-dated catering.
- Meeting attendees.
- Meeting venue / room details.
- Dietary and allergen requirements.
- Delivery instructions.
- Large-order cut-off times.
- Minimum / maximum quantities.
- Custom quotations.
- Approval workflows.
- Cost-centre allocation where approved.
- Ordering on behalf of another person.
- Delivery confirmation.
- Corporate invoices and supporting documentation.
- Reporting by executive office, department, cost centre, vendor or event.

---

# 5. User Roles

The platform is role-driven.

| Role | Core responsibilities |
|---|---|
| Employee | Browse, order, pay, collect, track, favourite, rate |
| Executive | Personal ordering and corporate catering |
| Executive Assistant / Personal Assistant | Order on behalf of executives / organisers |
| Meeting / Event Organiser | Schedule corporate catering |
| Vendor Staff | Menus, stock, orders, preparation, statuses, catering |
| Vendor Manager | Vendor profile, staff, prices, operating hours, reconciliation, reporting |
| Company Administrator | Campuses, vendors, roles, configuration, reporting |
| Finance / Reconciliation | Transactions, settlements, refunds, exceptions |
| Technical Support | Incidents, monitoring, user queries, configuration |
| System Auditor | Read-only audit evidence and logs |

Every route, API operation and database query must respect the authenticated user's role and organisation boundaries.

---

# 6. Platform Architecture

## 6.1 Target architecture

```text
                     ┌─────────────────────┐
                     │   React Frontend    │
                     │   Pure JavaScript   │
                     └──────────┬──────────┘
                                │ HTTPS / JSON
                                ▼
                     ┌─────────────────────┐
                     │    Express API      │
                     │    Node.js          │
                     └──────────┬──────────┘
                                │
                ┌───────────────┼─────────────────┐
                │               │                 │
                ▼               ▼                 ▼
        ┌──────────────┐ ┌──────────────┐ ┌───────────────┐
        │  Supabase    │ │ Payment      │ │ Notifications │
        │ PostgreSQL   │ │ Provider     │ │ / Email /     │
        │ Auth / RLS*  │ │              │ │ Push / SMS*   │
        └──────────────┘ └──────────────┘ └───────────────┘
```

`*` External integrations remain subject to stakeholder approval and final implementation decisions.

## 6.2 Implementation principles

- React is the presentation layer.
- Express owns business APIs and server-side validation.
- Supabase PostgreSQL is the primary persistent data store.
- API consumers communicate through documented REST endpoints.
- Swagger/OpenAPI is the API contract.
- Sensitive business operations must not rely on client-side validation.
- Authorisation must be enforced server-side for every protected resource.
- Database access must enforce tenant/vendor/role boundaries.
- External integrations should sit behind service modules so providers can be replaced without rewriting business logic.

---

# 7. Recommended Repository Structure

```text
merchant-munchies/
│
├── client/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── features/
│       │   ├── auth/
│       │   ├── home/
│       │   ├── vendors/
│       │   ├── menu/
│       │   ├── cart/
│       │   ├── checkout/
│       │   ├── orders/
│       │   ├── favourites/
│       │   ├── profile/
│       │   ├── notifications/
│       │   ├── corporate/
│       │   └── support/
│       ├── layouts/
│       ├── routes/
│       ├── services/
│       ├── hooks/
│       ├── utils/
│       ├── constants/
│       └── styles/
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validators/
│   │   ├── integrations/
│   │   ├── utils/
│   │   ├── docs/
│   │   └── app.js
│   └── tests/
│
├── database/
│   ├── migrations/
│   ├── seed/
│   └── docs/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── workflows/
│   └── operations/
│
├── design_tokens.md
├── README.md
└── .env.example
```

This is a proposed implementation structure; it is not prescribed verbatim by the original brief.

---

# 8. Frontend Design Plan

The existing `design_tokens.md` remains the visual source of truth. This README does not duplicate those tokens.

The product UI should consistently use the established visual system:

- Bright light-blue primary action colour.
- White dominant surfaces.
- Very subtle blue-tinted surfaces.
- Greyish-black primary text.
- Muted grey supporting text.
- Rounded cards and controls.
- Thin borders.
- Minimal shadows.
- Realistic food photography.
- Simple line icons.
- Spacious mobile-first layouts.

The interface should feel like a polished corporate/workplace product rather than a generic consumer food-delivery clone.

### Design priorities

1. **Fast scanning:** important information is visible without excessive interaction.
2. **Low friction:** minimise unnecessary checkout steps.
3. **Operational clarity:** order state, collection time and vendor status are always understandable.
4. **Trust:** prices, fees, availability and payment state are explicit.
5. **Campus/building awareness:** the employee must always know where the order is being collected.
6. **Accessibility:** statuses should never rely on colour alone.
7. **Theme readiness:** all UI must consume existing semantic design tokens.

---

# 9. Employee Screen Plan

The following is the full employee-facing screen plan. It combines the supplied UI design sequence with functional requirements from the design brief.

## A. Authentication & onboarding

### 1. Splash / Brand

Purpose: establish the product identity while the application initialises.

Key UI:

- Merchant Munchies logo.
- Product name.
- Short value proposition.
- Minimal loading state if required.

### 2. Onboarding — Skip the Queue

Purpose: explain the value proposition quickly.

Key message:

> Skip the queue.

Supporting concepts:

- Order before arrival.
- Choose collection time.
- Track preparation.
- Collect using QR/order reference.

### 3. Login

Fields/actions:

- Employee email / employee number.
- Password.
- Forgot password.
- Sign in.
- SSO where technically permitted.
- Account creation only if the approved identity model supports it.

### 4. Registration / Account activation

The design brief prioritises the company's identity and access management solution and possible SSO. A conventional public sign-up flow should therefore only be implemented if stakeholders approve it.

Potential UI states:

- Account activation.
- Identity verification.
- SSO handoff.
- Access denied / inactive employee.

---

## B. Discovery

### 5. Home / Discover

Primary starting point.

Recommended sections:

- Greeting.
- Current campus/building.
- Search.
- Campus cafeterias/vendors.
- Popular meals.
- Availability/status.
- Current promotions if approved.
- Active order shortcut.
- Notifications.

### 6. Campus & Building Selection

Required because vendor availability is location-dependent.

UI should support:

- Campus selector.
- Building selector.
- Saved/default campus.
- Collection point context.
- Clear location confirmation.

The active location should remain visible throughout ordering to prevent an accidental order from the wrong campus.

### 7. Vendor Directory / Cafeteria Selection

Each vendor should show:

- Vendor name/logo.
- Campus/building.
- Operating hours.
- Order cut-off.
- Preparation estimate.
- Available collection slots.
- Service status.
- Rating.
- Collection instructions.
- Catering availability.
- Support/contact information.

---

## C. Menu and item ordering

### 8. Cafeteria Menu

Key UI:

- Vendor header.
- Open/closed/busy status.
- Operating hours.
- Collection context.
- Category navigation.
- Menu items.
- Availability states.
- Dietary indicators.
- Allergen information.
- Preparation time.
- Add action.

### 9. Search & Filter

Filters required by the brief:

- Vendor.
- Meal name.
- Category.
- Price range.
- Dietary classification.
- Availability.
- Preparation time.
- Collection slot.
- Rating.
- Favourite meals.
- Current campus/building.

Dietary filters may include vegetarian, vegan, Halaal where confirmed, gluten-conscious/gluten-free where confirmed, dairy-free, nut-free where confirmed, low-sugar and other approved categories.

Serious allergy messaging must be visible because vendor-provided allergen data is not a substitute for direct confirmation with the vendor.

### 10. Food Item Details

Key UI:

- Large food image.
- Name.
- Description.
- Price.
- Portion information.
- Preparation estimate.
- Allergen/dietary information.
- Customisations.
- Optional extras.
- Special instructions.
- Add to cart.

### 11. Customize Order

This can be implemented as part of the Food Details screen or as a dedicated route/modal depending on complexity.

Potential controls:

- Portion selection.
- Extras.
- Ingredient changes.
- Dietary-related options.
- Special instructions.

The vendor controls what customisations are actually available.

---

## D. Cart & checkout

### 12. Cart

The initial pilot supports **one vendor per order**.

Cart must show:

- Vendor.
- Campus/building.
- Collection location.
- Products.
- Quantities.
- Customisations.
- Prices.
- Taxes.
- Service fees.
- Total.
- Availability validation.
- Collection-slot availability.
- Promotion/subsidy rules if approved.

Abandoned carts must be configurable for automatic expiry.

### 13. Collection Time Selection

Required because scheduled collection is core to the operating model.

UI should show only available slots and capacity-aware availability.

The backend must enforce:

- Slot intervals.
- Capacity.
- Preparation capacity.
- Peak-period rules.
- Paused/reduced capacity.
- Immediate collection where supported.
- No overbooking.

### 14. Checkout / Payment

Before submission the employee should review:

- Vendor.
- Campus/building.
- Collection point.
- Items.
- Quantity/customisation.
- Collection date/time.
- Total.
- Payment method.
- Cancellation conditions.
- Preparation estimate.

Payment support is subject to approved providers and may include:

- Bank card.
- Digital wallet.
- Instant electronic payment.
- Employee meal benefit/subsidy.
- Internal cost-centre allocation for authorised corporate orders.
- Approved corporate purchasing mechanisms.

Do not store full card details. Use provider tokenisation when saved payment methods are permitted.

### 15. Order Confirmed

After successful submission:

- Unique order number.
- Payment confirmation.
- Collection time.
- Collection instructions.
- Tracking entry point.
- Digital receipt.

---

## E. Fulfilment and post-order

### 16. Live Order Tracking

The employee needs clear progress through:

```text
Payment pending
→ Order submitted
→ Payment confirmed
→ Order received by vendor
→ Order accepted
→ Order being prepared
→ Ready for collection
→ Collected
→ Completed
```

The UI can simplify this into customer-facing milestone stages while retaining the complete backend status history.

### 17. Pickup / Ready Screen

When ready:

- Strong ready status.
- QR code.
- Order reference.
- Vendor name.
- Collection location.
- Collection instructions.
- Ready time.
- Reminder that the QR/reference should be presented at the express collection point.

QR codes must not expose sensitive employee or payment information.

### 18. My Orders

Sections:

- Active order.
- Past orders.
- Cancelled orders.
- Refunded orders.
- Corporate orders where applicable.

### 19. Order Details / Receipt

Show:

- Order number.
- Vendor.
- Campus/building.
- Collection point.
- Date/time.
- Items.
- Customisations.
- Fees/taxes.
- Payment status.
- Transaction reference where appropriate.
- Receipt.
- Refund/cancellation state.

### 20. Favorites

Support:

- Favourite vendors.
- Favourite meals.
- Quick repeat ordering.

### 21. Student / Employee Profile

The source brief calls for:

- Name.
- Employee number/unique identifier.
- Email.
- Preferred campus.
- Preferred building.
- Dietary preferences.
- Allergy indicators.
- Favourite vendors.
- Favourite meals.
- Order history.
- Saved payment-method token where permitted.
- Notification preferences.

Only collect sensitive information with a defined business purpose and required approvals.

### 22. Notifications

Notification events include:

- Order submitted.
- Payment success/failure.
- Order accepted/rejected.
- Preparing.
- Ready.
- Collection reminder.
- Delayed order.
- Cancellation.
- Refund processed.
- Catering approval.
- Catering delivery.
- Vendor unavailable.

Users may control non-essential notification preferences. Transactional notifications required to complete an order remain active.

### 23. Help / Support

Support should provide:

- Current-order assistance.
- Vendor contact/support.
- Complaint initiation.
- Payment issue guidance.
- Cancellation/refund support.
- Order dispute flow.

---

# 10. Vendor Portal Plan

The vendor interface is operational software and should prioritise speed over visual decoration.

## Main screens

### Vendor Dashboard

- Current order volume.
- New order alerts.
- Orders by collection time.
- Delayed/urgent orders.
- Preparation summary.
- Stock alerts.
- Quick status actions.

### Live Order Queue

Each order needs:

- Order number.
- Customer identity as permitted.
- Items.
- Customisations.
- Dietary/allergy indicators supplied by the customer.
- Collection time.
- Payment status.
- Status controls.

Actions:

- Accept.
- Reject with reason.
- Prepare.
- Ready.
- Complete/collected.
- Cancel where permitted.

### Menu Management

- Create/edit item.
- Description.
- Image.
- Price.
- Category.
- Portion.
- Ingredients.
- Allergens.
- Dietary classification.
- Extras/customisations.
- Stock quantity.
- Availability.
- Schedule visibility.
- Sold-out state.
- Weekly menu / copy previous menu.

### Collection Slot Management

- Slot interval.
- Capacity.
- Preparation capacity.
- Open/close slot.
- Pause/reduce capacity.
- Peak period rules.

### Catering Management

- View requests.
- Quote/customise.
- Accept/decline.
- Propose substitutions.
- Confirm preparation.
- Dispatch.
- Confirm delivery.
- Supporting documents.

### Vendor Reports

- Sales.
- Orders.
- Items sold.
- Sold-out items.
- Rejected orders.
- Delays.
- Preparation time.
- Ratings.
- Refunds/cancellations.
- Catering revenue.
- Settlement.
- Reconciliation.
- Demand by slot/item.

---

# 11. Administration Portal Plan

## Administration dashboard

Show a consolidated operational view:

- Current order volume.
- Active vendors.
- System health.
- Failed transactions.
- Vendor delays.
- User adoption.
- Estimated queue-time reduction.
- Employee satisfaction.
- Vendor performance.
- Demand/wastage trends.
- Corporate catering activity.

## Configuration areas

- Campuses.
- Buildings/floors.
- Collection points.
- Delivery locations.
- Vendor onboarding.
- Operating hours.
- Vendor service areas.
- Menu categories.
- Dietary classifications.
- Order capacity.
- Collection intervals.
- Corporate thresholds.
- Approval levels.
- Cancellation rules.
- Refund rules.
- Fees.
- Tax configuration.
- User roles.
- Notification templates.
- Complaint categories.
- Announcements.
- Maintenance notices.
- Pilot configuration.
- Feature activation per campus/vendor.

All configuration changes must be auditable.

---

# 12. Corporate Catering Plan

## Corporate order form

Capture:

- Requester.
- Person ordering on behalf of.
- Department/business unit.
- Cost centre where applicable.
- Event name.
- Date.
- Start/end time.
- Required delivery time.
- Campus.
- Building.
- Floor.
- Room/venue.
- Number of attendees.
- Food and refreshments.
- Dietary requirements.
- Allergy information.
- Delivery/setup requirements.
- Disposable/reusable serving requirements.
- Special instructions.
- PO/internal reference where applicable.

## Approval flow

```text
Draft
→ Submitted
→ Awaiting approval
→ Approved / Rejected / Amendment requested
→ Vendor confirmed
→ Preparing
→ Dispatched
→ Delivered
→ Recipient confirmed
→ Closed
```

Approvals may depend on:

- User role.
- Value.
- Cost centre.
- Business unit.
- Event type.
- Attendee count.
- Vendor.
- Lead time.

The system must prevent fulfilment before required approvals are complete.

---

# 13. Order State Model

Use an explicit state machine rather than free-form status strings.

## Core states

```text
PAYMENT_PENDING
ORDER_SUBMITTED
PAYMENT_CONFIRMED
VENDOR_RECEIVED
ACCEPTED
PREPARING
READY_FOR_COLLECTION
COLLECTED
COMPLETED
CANCELLED
REJECTED
REFUND_PENDING
REFUNDED
COLLECTION_NOT_COMPLETED
```

## Corporate-specific states

```text
DELIVERY_IN_PROGRESS
DELIVERED
```

Every status transition must retain:

- Timestamp.
- Actor (user/system).
- Previous state.
- New state.
- Reason for rejection/cancellation/refund where applicable.

This event history becomes the basis for auditing and reporting.

---

# 14. Supabase Database Plan

The exact schema should be finalised during database design, but the functional requirements imply the following major entities.

## Identity & access

```text
profiles
roles
permissions
user_roles
sessions / authentication metadata
```

## Organisation & locations

```text
sites
buildings
floors
collection_points
delivery_locations
```

## Vendors

```text
vendors
vendor_users
vendor_operating_hours
vendor_service_areas
vendor_collection_rules
```

## Menu

```text
menu_categories
menus
menu_items
menu_item_images
menu_item_options
menu_item_option_values
menu_item_dietary_tags
menu_item_allergens
menu_item_stock
```

## Ordering

```text
carts
cart_items
orders
order_items
order_item_options
order_status_history
collection_slots
order_collection
```

## Payment

```text
payment_transactions
payment_methods_tokens
refunds
settlements
reconciliation_records
```

## User preferences

```text
favourite_vendors
favourite_meals
user_dietary_preferences
user_allergy_indicators
notification_preferences
```

## Communications

```text
notifications
notification_templates
announcements
```

## Feedback/support

```text
ratings
feedback
complaints
complaint_categories
complaint_events
support_cases
```

## Corporate catering

```text
corporate_orders
corporate_order_items
corporate_attendees
corporate_approvals
corporate_quotes
corporate_delivery
corporate_cost_allocations
```

## Administration / auditing

```text
audit_logs
configuration
feature_flags
maintenance_windows
```

### Database design principles

- Foreign keys for relational integrity.
- Database constraints for critical invariants.
- Unique constraints for order numbers and transaction references.
- Index high-volume lookup paths.
- Use timestamps consistently in UTC.
- Keep status transitions auditable.
- Avoid storing payment card data.
- Use Supabase Row Level Security where appropriate, but do not rely on RLS alone for complex business rules; validate authorisation in the API service layer as well.
- Never expose service-role credentials to the React client.

---

# 15. REST API Plan

Express should expose versioned APIs.

Base path:

```text
/api/v1
```

## Authentication

```text
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
POST   /auth/forgot-password
```

SSO endpoints should be added only after the approved identity provider is confirmed.

## User profile

```text
GET    /profile
PATCH  /profile
GET    /profile/preferences
PATCH  /profile/preferences
```

## Locations

Employee-facing reads (active-only, cached `max-age=60`) — implemented (tag `Sites`):

```text
GET    /sites
GET    /sites/:siteId
GET    /sites/:siteId/buildings
GET    /buildings/:buildingId/floors
GET    /buildings/:buildingId/collection-points
```

Planned:

```text
GET    /buildings/:buildingId/vendors
```

## Vendors

```text
GET    /vendors
GET    /vendors/:vendorId
GET    /vendors/:vendorId/hours
GET    /vendors/:vendorId/collection-slots
GET    /vendors/:vendorId/menu
```

## Search

```text
GET    /search/meals
GET    /search/vendors
GET    /search/filters
```

## Cart

```text
GET    /cart
POST   /cart/items
PATCH  /cart/items/:itemId
DELETE /cart/items/:itemId
POST   /cart/validate
POST   /cart/expire
```

## Collection slots

```text
GET    /vendors/:vendorId/collection-slots?date=...
POST   /orders/validate-slot
```

## Orders

```text
POST   /orders
GET    /orders
GET    /orders/:orderId
POST   /orders/:orderId/cancel
GET    /orders/:orderId/status
GET    /orders/:orderId/receipt
GET    /orders/:orderId/collection
```

## Payments

```text
POST   /payments/intent
POST   /payments/confirm
GET    /payments/:paymentId
POST   /payments/:paymentId/refund
```

Payment-provider-specific webhook routes should be isolated under `/webhooks/...` and must verify signatures.

## Favorites

```text
GET    /favorites/vendors
POST   /favorites/vendors/:vendorId
DELETE /favorites/vendors/:vendorId
GET    /favorites/meals
POST   /favorites/meals/:mealId
DELETE /favorites/meals/:mealId
```

## Notifications

```text
GET    /notifications
PATCH  /notifications/:notificationId/read
GET    /notification-preferences
PATCH  /notification-preferences
```

## Feedback / support

```text
POST   /orders/:orderId/feedback
POST   /complaints
GET    /support/cases
GET    /support/cases/:caseId
```

## Vendor API namespace

```text
GET    /vendor/orders
PATCH  /vendor/orders/:orderId/status
POST   /vendor/orders/:orderId/reject
GET    /vendor/menu
POST   /vendor/menu/items
PATCH  /vendor/menu/items/:itemId
DELETE /vendor/menu/items/:itemId
PATCH  /vendor/menu/items/:itemId/stock
GET    /vendor/collection-slots
PATCH  /vendor/collection-slots/:slotId
GET    /vendor/reports
```

## Administration API namespace

Campus hierarchy (implemented, tag `Administration`): all writes are admin-only, rate-limited, audited, and return `409` on duplicate name/code (`23505`).

```text
GET    /admin/sites
POST   /admin/sites
GET    /admin/sites/:siteId
PATCH  /admin/sites/:siteId
GET    /admin/sites/:siteId/buildings
POST   /admin/sites/:siteId/buildings
GET    /admin/buildings/:buildingId
PATCH  /admin/buildings/:buildingId
GET    /admin/buildings/:buildingId/floors
POST   /admin/buildings/:buildingId/floors
PATCH  /admin/floors/:floorId
GET    /admin/buildings/:buildingId/collection-points
POST   /admin/buildings/:buildingId/collection-points
PATCH  /admin/collection-points/:cpId
GET    /admin/buildings/:buildingId/delivery-locations
POST   /admin/buildings/:buildingId/delivery-locations
PATCH  /admin/delivery-locations/:dlId
```

Planned (users/vendors/reports/configuration):

```text
GET    /admin/dashboard
GET    /admin/vendors
POST   /admin/vendors
PATCH  /admin/vendors/:vendorId
GET    /admin/users
PATCH  /admin/users/:userId/roles
GET    /admin/audit-logs
GET    /admin/reports
PATCH  /admin/configuration
```

Corporate routes should live under a dedicated namespace such as `/corporate/...` to make permissions and documentation clear.

---

# 16. Swagger / OpenAPI Plan

Maintain an OpenAPI 3 specification covering every public API endpoint.

Swagger documentation should define:

- Endpoint.
- HTTP method.
- Authentication requirement.
- Required roles.
- Request parameters.
- Request body schemas.
- Response schemas.
- Pagination.
- Validation errors.
- Business errors.
- HTTP status codes.
- Example payloads.
- Idempotency requirements where applicable.

Recommended top-level tags:

```text
Authentication
Profile
Sites
Vendors
Menus
Search
Cart
Collection Slots
Orders
Payments
Notifications
Favorites
Feedback
Support
Vendor Operations
Administration
Corporate Catering
Reports
Webhooks
```

The OpenAPI specification should be treated as a contract between the React application, Express backend and any future integrations.

---

# 17. Backend Service Boundaries

Recommended Express service layer:

```text
AuthService
UserService
SiteService
VendorService
MenuService
SearchService
CartService
CollectionSlotService
OrderService
PaymentService
NotificationService
FavoriteService
FeedbackService
ComplaintService
CorporateOrderService
ReportingService
AuditService
```

Repositories should isolate Supabase/database access from business logic.

Example:

```text
Controller
   ↓
Service
   ↓
Repository
   ↓
Supabase
```

External providers should follow:

```text
Service
   ↓
Integration Adapter
   ↓
Provider
```

This keeps payment, identity, notification and future integrations replaceable.

---

# 18. Critical Business Rules

These rules must be enforced server-side.

### One vendor per pilot order

The initial pilot permits items from only one vendor per order.

### Slot capacity

A collection slot cannot exceed configured capacity.

### Availability

Inventory must be revalidated before payment/order confirmation.

### Payment release

An order must not be released for preparation until payment is confirmed when payment is required.

### Duplicate protection

The system must prevent duplicate orders and duplicate charges, especially under retries/timeouts.

### Cancellation

Cancellation is allowed only within vendor-defined rules/cut-off periods.

### Refund

Refund status must be explicit, traceable and reconciled.

### Role isolation

Users must not access another employee's order history or another vendor's information.

### QR / collection

Collection must be uniquely verifiable and duplicate collection prevented.

### Location safety

The selected campus/building/collection point must remain explicit throughout the ordering journey.

---

# 19. Security Plan

The brief requires:

- Role-based access control.
- Least-privilege permissions.
- Separation of employee/vendor/admin/finance/support/audit access.
- Vendor tenant isolation.
- Employee order isolation.
- Elevated protection for administrative functions.
- Immediate access deactivation.
- Encryption in transit and at rest for sensitive data.
- Data minimisation.
- Secure storage and masking of sensitive information.
- Approved data-retention periods.
- Secure deletion/anonymisation where required.
- No storage of full payment-card information.
- Protection of credentials and keys.
- Audit logging.
- Vulnerability/dependency scanning.
- Threat modelling.
- Code review.
- Penetration testing.
- Separate development/test/production environments.

The project must account for applicable South African privacy requirements, including the Protection of Personal Information Act (POPIA), as stated in the source brief.

---

# 20. Audit Logging

Audit events should include at minimum:

- Login/logout.
- Failed authentication.
- User/role changes.
- Vendor onboarding/deactivation.
- Menu creation/amendments.
- Price changes.
- Stock changes.
- Order status changes.
- Payment/refund events.
- Approval decisions.
- Corporate order amendments.
- Administrative configuration changes.
- Report exports.
- Access to sensitive information.
- Support overrides.

Logs must be access controlled, retained according to policy and protected against unauthorised tampering.

---

# 21. Notifications Architecture

Notification channels named in the brief:

```text
In-app
Push
Email
SMS (only when approved and operationally necessary)
```

Use an event-driven application pattern:

```text
Order state changes
      ↓
Domain event
      ↓
Notification service
      ↓
Channel adapters
      ↓
In-app / push / email / SMS
```

This prevents order logic from becoming tightly coupled to a specific notification provider.

---

# 22. Reporting & Analytics Plan

## Employee/order reporting

- Registered users.
- Active users.
- Orders.
- Completed/cancelled orders.
- Order value.
- Average basket value.
- Popular meals/vendors.
- Peak ordering times.
- Peak collection times.
- Average preparation time.
- Average collection waiting time.
- Uncollected orders.
- Refunds.
- Failed payments.
- Ratings.
- Complaints/resolution time.

## Vendor reporting

- Daily/weekly/monthly sales.
- Number/value of orders.
- Items sold.
- Sold-out items.
- Rejected/delayed orders.
- Preparation time.
- Ratings.
- Refunds/cancellations.
- Catering revenue.
- Settlement/reconciliation.
- Demand by slot/item.

## Food waste reporting

Where vendors provide reliable data:

- Planned quantity.
- Ordered quantity.
- Produced quantity.
- Unsold quantity.
- Wasted quantity.
- Expected-vs-actual demand.
- Trends over time/campus.

The platform must not claim food-waste reduction unless reliable baseline and post-implementation data support the claim.

## Corporate reporting

- Corporate orders/value.
- Business unit.
- Cost centre.
- Meeting type.
- Requester.
- Vendor.
- Approval time.
- Delivery performance.
- Disputes.
- Recurring requirements.

Reports should support approved CSV, Excel or PDF export with access control.

---

# 23. Performance Plan

The original brief requires the system to:

- Perform acceptably under normal conditions.
- Support peak ordering between 12:00 and 14:00.
- Handle simultaneous transactions without duplicate orders/payments.
- Refresh vendor queues promptly.
- Scale across campuses/vendors/users.
- Maintain acceptable performance during menu uploads and reporting.

Implementation priorities:

- Paginate large lists.
- Index common Supabase queries.
- Cache low-volatility reference data where useful.
- Debounce search.
- Avoid unnecessary React re-renders.
- Optimise food-image delivery.
- Use server-side pagination/filtering for large datasets.
- Make order creation idempotent.
- Perform load/stress testing against realistic pilot volumes.

Exact response-time and availability targets remain stakeholder decisions and are not invented in this README.

---

# 24. Reliability & Resilience

The system must:

- Protect confirmed orders from data loss.
- Recover incomplete transactions safely.
- Provide maintenance mode.
- Give user-friendly outage messages.
- Give vendors an approved fallback process for confirmed orders.
- Maintain tested backup/recovery and disaster-recovery procedures.

For order and payment flows, prefer explicit transaction states over assuming that a request failure means the operation failed.

---

# 25. Testing Strategy

Testing must cover:

### Frontend

- Unit tests.
- Component tests.
- Form validation.
- Accessibility.
- Responsive layouts.
- Navigation/route protection.
- Loading/error/empty states.

### Backend

- Unit tests.
- Integration tests.
- API contract tests.
- Authorisation tests.
- Validation tests.
- Database integration tests.
- Payment webhook tests.
- Notification event tests.

### System

- End-to-end ordering.
- Payment success/failure/interruption.
- Duplicate submission.
- Unavailable items.
- Slot exhaustion.
- Delayed vendor.
- Refund failure.
- QR validation.
- Corporate approval workflow.
- Vendor operations.
- Admin operations.
- Notification delivery.

### Non-functional

- Performance.
- Load/stress.
- Security.
- Penetration testing.
- Browser compatibility.
- Mobile device testing.
- Accessibility.
- Disaster recovery.

The source brief explicitly calls for unit, integration, system, UAT, mobile, browser, payment, access-control, security, penetration, performance, load/stress, disaster-recovery, notification, refund/cancellation, reconciliation, vendor, accessibility and corporate-workflow testing.

---

# 26. Acceptance Criteria

The product should not enter production until the following minimum conditions are met:

1. Employees authenticate securely.
2. Employees select the correct campus/vendor.
3. Vendors maintain menus.
4. Availability is accurate.
5. Orders can be placed and paid successfully.
6. Duplicate orders/payments are prevented adequately.
7. Vendors receive/manage orders in real time.
8. Collection slots cannot be overbooked.
9. Employees receive accurate status notifications.
10. QR/collection references can be validated.
11. Cancellation/refund flows work as designed.
12. Corporate approvals operate correctly.
13. Financial/operational reports reconcile to transactions.
14. Roles/permissions are tested.
15. Audit logs are complete/protected.
16. Security findings above the approved risk threshold are resolved.
17. UAT is formally approved.
18. Support, backup, recovery and escalation processes exist.
19. Participating vendors are operationally trained.
20. Required business, technology, risk, compliance, privacy and security approvals are obtained.

---

# 27. Development Phases

## Phase 0 — Discovery & decisions

Resolve the stakeholder-confirmation items before locking implementation assumptions:

- Final vendors.
- Pilot employee population.
- Mobile-development approach.
- Identity/SSO integration.
- Approved payment methods.
- Transaction-fee allocation.
- Refund responsibility.
- Vendor settlement.
- Corporate delivery responsibility.
- Corporate approval levels.
- Cost-centre integration.
- Tax/invoicing rules.
- Data ownership.
- Hosting environment.
- Availability target.
- Data retention.
- Support ownership.
- Vendor onboarding criteria/contracts.
- Subsidy/meal benefits.
- Woolworths participation.
- Standalone vs existing employee-platform integration.
- Branding/IP ownership.

## Phase 1 — Foundation

Build:

- React application shell.
- Express API.
- Supabase database foundation.
- Environment configuration.
- Authentication/authorisation foundation.
- Swagger/OpenAPI.
- Logging/error handling.
- Role model.
- Design token integration.

## Phase 2 — Employee ordering MVP

Build the critical path:

```text
Login
→ Campus
→ Vendor
→ Menu
→ Food details
→ Cart
→ Collection slot
→ Payment
→ Confirmation
→ Tracking
→ Pickup
```

## Phase 3 — Vendor operations

Build:

- Vendor dashboard.
- Live queue.
- Menu management.
- Stock/availability.
- Collection slots.
- Status management.
.

## Phase 4 — Admin operations

Build:

- Vendor/campus management.
- Roles.
- Configuration.
- Reports.
- Audit.
- Announcements.

## Phase 5 — Corporate catering

Build:

- Catering form.
- Approval workflow.
- Quotes.
- Cost centres.
- Delivery.
- Confirmation.
- Corporate reporting.

## Phase 6 — Hardening

- Security review.
- Performance testing.
- Accessibility testing.
- UAT.
- Recovery testing.
- Monitoring.
- Vendor training.
- Pilot readiness.

## Phase 7 — Merchant Place Pilot

Pilot with the approved Merchant Place population and participating vendors.

Measure:

- Adoption.
- Queue-time reduction.
- Satisfaction.
- Order accuracy.
- Preparation performance.
- Collection performance.
- Vendor participation.
- Payment reliability.
- Demand/forecast performance.
- Food-waste data where available.
- Catering efficiency.
- Reliability.

## Phase 8 — Expansion

Subject to pilot results and approvals, expand to additional locations named in the brief, including:

- Sandton.
- Bank City.
- Fairland.
- Other approved company locations.

Expansion should follow documented pilot results, security review, vendor readiness and support capacity.

---

# 28. Recommended Build Order for the React UI

Do not build every screen at once.

Build in this order:

```text
1. App shell / navigation
2. Authentication
3. Home / Discover
4. Campus & vendor selection
5. Vendor menu
6. Food details / customisation
7. Cart
8. Collection slot
9. Checkout/payment
10. Order confirmation
11. Live tracking
12. Pickup / QR
13. Order history
14. Profile / favourites / notifications
15. Support
16. Vendor portal
17. Admin portal
18. Corporate catering
```

For each feature, finish the full flow before moving to the next one.

---

# 29. UI State Requirements

Every production screen should account for:

```text
Default
Loading
Empty
Error
Disabled
Success
Permission denied
Offline / connection failure where relevant
```

Examples:

### Menu

```text
Loading menu
No menu published
Item available
Item limited
Item sold out
Vendor closed
Vendor temporarily unavailable
```

### Cart

```text
Normal
Item unavailable
Price changed
Collection slot unavailable
Cart expired
Validation failed
```

### Payment

```text
Ready
Processing
Successful
Failed
Interrupted
Pending confirmation
Refund pending
Refunded
```

### Order tracking

```text
Submitted
Confirmed
Vendor received
Accepted
Preparing
Ready
Collected
Completed
Rejected
Cancelled
Delayed
```

---

# 30. Data Ownership & Integration Boundaries

External integrations should be documented before implementation.

The brief calls out possible integrations for:

- Identity and access management.
- SSO.
- Payment providers.
- Email/notification services.
- Mobile push notifications.
- Employee directory.
- Cost-centre/approval systems.
- Vendor settlement/reconciliation.
- Service desk / incident management.
- Reporting/analytics.
- Building/boardroom location data.

For every integration document:

```text
Fields exchanged
Direction of flow
Update frequency
Authentication
Error handling
Reconciliation
Ownership
Support responsibility
Security classification
Retention
```

---

# 31. Environment Strategy

Use separate environments:

```text
Development
Testing / Staging
Production
```

Recommended variables:

```text
NODE_ENV
PORT
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
API_BASE_URL
SWAGGER_BASE_URL
PAYMENT_* 
NOTIFICATION_* 
AUTH_* 
```

Never commit secrets.

The React client must never receive the Supabase service-role key or other privileged backend credentials.

---

# 32. Error Handling Standard

All APIs should return a predictable error envelope.

Recommended shape:

```json
{
  "success": false,
  "error": {
    "code": "COLLECTION_SLOT_FULL",
    "message": "The selected collection slot is no longer available."
  },
  "requestId": "..."
}
```

Use stable error codes for frontend handling and human-readable messages for users.

Never expose raw database errors, provider secrets or stack traces in production responses.

---

# 33. Pagination & Query Rules

For large datasets:

- Paginate vendor lists.
- Paginate menus where necessary.
- Paginate orders.
- Paginate audit logs.
- Paginate reports/data exports where applicable.
- Apply server-side filtering for large datasets.

Keep the API response shape consistent between list endpoints.

---

# 34. Deployment Plan

Deployment should include:

```text
Build React frontend
        ↓
Build/test Express API
        ↓
Run database migrations
        ↓
Run automated tests
        ↓
Run security/dependency checks
        ↓
Deploy staging
        ↓
UAT
        ↓
Production approval
        ↓
Production deployment
        ↓
Post-deployment monitoring
```

Database migrations must be version controlled.

Production deployment must have a rollback/recovery plan.

---

# 35. Observability

Track at minimum:

- API error rate.
- Authentication failures.
- Order creation failures.
- Payment failures.
- Duplicate-prevention events.
- Notification failures.
- Vendor queue delays.
- Slow API requests.
- Database query issues.
- Background job failures.
- Unhandled exceptions.
- Client-side critical errors.

Include correlation/request IDs so a failed customer order can be traced across API, payment, notification and database logs.

---

# 36. Developer Deliverables

The original brief expects the final project to produce or maintain:

- Business requirements specification.
- Functional requirements specification.
- Non-functional requirements specification.
- Solution architecture.
- Data-flow diagrams.
- Process-flow diagrams.
- Database/data-model design.
- Integration design.
- Security/privacy design.
- UI prototypes.
- User journeys.
- Source code.
- API documentation.
- Test strategy and test cases.
- Test results and defect register.
- Security assessment results.
- Deployment/release plan.
- Backup/recovery plan.
- Administration manual.
- Vendor guide.
- Employee guide.
- Support/maintenance procedures.
- Incident/escalation matrix.
- Training materials.
- Pilot implementation plan.
- Pilot performance dashboard.
- Post-implementation review.
- Source-code ownership/licensing/handover documentation.

---

# 37. Definition of Done

A feature is not considered complete when the happy-path UI works.

A production-ready feature must include:

```text
UI
+ Loading state
+ Empty state
+ Error state
+ Validation
+ API integration
+ Backend validation
+ Authorisation
+ Database persistence
+ Audit/event handling where required
+ Notification handling where required
+ Tests
+ Swagger documentation where an API exists
+ Accessibility review
+ Responsive review
```

For payment/order features, also require:

```text
Idempotency
Failure recovery
Duplicate protection
State reconciliation
Refund/cancellation handling
```

---

# 38. Important Implementation Notes

### React + pure JavaScript

Keep the frontend JavaScript-first as requested. Use clear feature-based modules and reusable components instead of introducing unnecessary abstraction.

### Node.js + Express

Keep business rules in services rather than controllers. Controllers should translate HTTP requests into service calls and format responses.

### Supabase

Use Supabase PostgreSQL as the system of record. Keep privileged database operations on the server. Use migrations and controlled seed data.

### Swagger

Document the actual implementation rather than maintaining a disconnected API document. Prefer one source of truth for request/response schemas where practical.

### Design tokens

The repository already contains `design_tokens.md`. Treat it as the visual source of truth and keep page-specific styling derived from those tokens rather than inventing new colours or spacing values screen by screen.

---

# 39. Current MVP Recommendation

For the first usable Merchant Place release, prioritise:

```text
Authentication
Campus selection
Vendor directory
Menu browsing
Search/filter
Food details/customisation
Cart
Collection slots
Payment
Order confirmation
Live order status
Ready/QR collection
Order history
Basic notifications
Vendor live queue
Vendor menu management
Basic admin vendor/site configuration
Core reporting
Audit logging
```

Corporate catering can be implemented after the employee meal journey is stable, unless the pilot specifically requires controlled catering testing from day one.

This sequencing is a project recommendation, not a change to the original brief.

---

# 40. Final Product Standard

Merchant Munchies should ultimately feel like a reliable workplace utility rather than a generic restaurant marketplace.

The product should make these questions immediately answerable:

> **Where am I ordering from?**
>
> **What can I order?**
>
> **Is it available?**
>
> **When can I collect it?**
>
> **Have I paid?**
>
> **What is happening to my order?**
>
> **Where do I collect it?**
>
> **What happens if something goes wrong?**

The core success loop is:

```text
DISCOVER
→ ORDER
→ PAY
→ TRACK
→ COLLECT
→ FEEDBACK
```

The wider platform loop is:

```text
EMPLOYEE DEMAND
→ VENDOR PREPARATION
→ SCHEDULED COLLECTION
→ TRANSACTION / RECONCILIATION
→ OPERATIONAL ANALYTICS
→ BETTER DEMAND PLANNING
```

That loop is the foundation for the platform's queue reduction, convenience, vendor efficiency and management-information objectives.
