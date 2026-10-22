# Graph Report - bagdja-website  (2026-10-22)

## Corpus Check
- 173 files · ~92,167 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .example 1, .css 1)

## Summary
- 1075 nodes · 2878 edges · 61 communities (43 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a83e4940`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Page Route Types
- react
- session.ts
- orders-content.tsx
- Gathering API Handlers
- Renderer Auth State
- package.json
- Product Order Models
- Template Catalog Components
- next
- Theme Typography Tokens
- orders/[id]/route.ts
- Catalog Mapping Utilities
- Website README
- Gathering Invite Components
- Gathering Group Steps
- store-classic-catalog.tsx
- Invitation Operations
- store-classic-icons.tsx
- TypeScript Compiler Config
- Route Middleware Metadata
- Store and Barber Views
- Order Fulfillment Metadata
- Gathering Invoice UI
- buildBlogPostHref
- invitation-content/route.ts
- Fulfillment Form Fields
- [id]/steps/complete/route.ts
- [id]/complete/route.ts
- Invitation List Rows
- Profile Wallet UI
- Cart and Plan Rows
- Gathering Plan Controls
- backend-api.ts
- Invitation Management
- Public Gathering Invoice
- Gathering Calendar Content
- Plan Invitation Routes
- Gathering Plan Routes
- Barber Sample Catalog
- Store Sample Catalog
- [stepName]/dispute/route.ts
- Cancel Plan Route
- transactions/[id]/route.ts
- Collective Checkout Route
- Checkout Cancellation Route
- tailwindcss
- Registration Rejection Route
- Private Invitation Status
- Order Step Completion
- Step Release Approval
- Checkout Retry Route
- Installment Payment Route
- ESLint Configuration
- Next.js Configuration
- api-client.ts
- devDependencies
- dependencies
- scripts
- purchase-controls.tsx

## God Nodes (most connected - your core abstractions)
1. `backendFetch()` - 118 edges
2. `next` - 111 edges
3. `loadTenant()` - 58 edges
4. `StoreClassicView()` - 47 edges
5. `react` - 47 edges
6. `BarberClassicView()` - 43 edges
7. `toCatalogItem()` - 43 edges
8. `WorkshopView()` - 38 edges
9. `sanitizeWebsiteTheme()` - 32 edges
10. `extractTemplateTheme()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `backendFetch()`  [EXTRACTED]
  app/api/gathering/plans/[id]/cancel/route.ts → lib/backend-api.ts
- `POST()` --calls--> `backendFetch()`  [EXTRACTED]
  app/api/gathering/plans/[id]/confirm-event/route.ts → lib/backend-api.ts
- `POST()` --calls--> `backendFetch()`  [EXTRACTED]
  app/api/gathering/plans/[id]/confirm-reservations/route.ts → lib/backend-api.ts
- `PATCH()` --calls--> `backendFetch()`  [EXTRACTED]
  app/api/gathering/plans/[id]/invitation-content/route.ts → lib/backend-api.ts
- `GET()` --calls--> `backendFetch()`  [EXTRACTED]
  app/api/gathering/plans/[id]/invitations/operation/route.ts → lib/backend-api.ts

## Import Cycles
- None detected.

## Communities (61 total, 18 thin omitted)

### Community 0 - "Page Route Types"
Cohesion: 0.08
Nodes (104): BlogArticlePage(), BlogArticlePageProps, revalidate, CalendarPage(), CalendarPageProps, generateMetadata(), revalidate, DraftOrderPage() (+96 more)

### Community 1 - "react"
Cohesion: 0.06
Nodes (42): metadata, CalendarBadge(), CalendarPlanCountRow, CartBadge(), CartBadgeProps, ServerOrder, CheckoutContent(), DraftProduct (+34 more)

### Community 2 - "session.ts"
Cohesion: 0.16
Nodes (19): GET(), RouteContext, GET(), safeNextPath(), GET(), GET(), base64url(), buildAuthorizeUrl() (+11 more)

### Community 3 - "orders-content.tsx"
Cohesion: 0.06
Nodes (50): buildChatReferenceHref(), ChatReferenceButton(), openChat(), ChatReferenceButtonProps, threadLabelFromReference(), ChatReferenceCard(), ChatReference, createChatReferenceMessage() (+42 more)

### Community 4 - "Gathering API Handlers"
Cohesion: 0.06
Nodes (29): GET(), POST(), GET(), POST(), POST(), GET(), DELETE(), PATCH() (+21 more)

### Community 5 - "Renderer Auth State"
Cohesion: 0.14
Nodes (27): GET(), RFC-6265, syncUserToBackend(), consumeOAuthState(), consumeSessionHandoff(), cookieKeyFor(), generateStateId(), getCachedRedisClient() (+19 more)

### Community 6 - "package.json"
Cohesion: 0.13
Nodes (14): description, name, private, version, autoprefixer, eslint, eslint-config-next, postcss (+6 more)

### Community 7 - "Product Order Models"
Cohesion: 0.11
Nodes (33): OrderDetailContent(), SocialIcon(), AboutSection(), BarberClassicProfile, BarberClassicView(), BlogArticleSection(), BlogCollectionSection(), BlogListSection() (+25 more)

### Community 8 - "Template Catalog Components"
Cohesion: 0.14
Nodes (34): StoreClassicBlogSidebar(), CategoryListingSection(), ProductGridSection(), MailIcon(), MapPinIcon(), PhoneIcon(), AboutSection(), BlogArticleSection() (+26 more)

### Community 9 - "next"
Cohesion: 0.06
Nodes (15): POST(), RouteContext, GET(), RouteContext, GET(), RouteContext, POST(), RouteContext (+7 more)

### Community 10 - "Theme Typography Tokens"
Cohesion: 0.07
Nodes (41): BarberClassicTemplate(), SearchParams, SearchParams, StoreClassicTemplate(), SearchParams, WorkshopTemplate(), getTemplateBySlug(), buildTemplateDefaultsPreview() (+33 more)

### Community 11 - "orders/[id]/route.ts"
Cohesion: 0.20
Nodes (8): POST(), RouteContext, DELETE(), GET(), PATCH(), POST(), RouteContext, backendFetchFormData()

### Community 12 - "Catalog Mapping Utilities"
Cohesion: 0.20
Nodes (26): getString(), isCatalogItem(), pickCategoryImage(), SectionHeading(), WorkshopAbout(), WorkshopBlogArticle(), WorkshopBlogCards(), WorkshopBlogGrid() (+18 more)

### Community 13 - "Website README"
Cohesion: 0.08
Nodes (26): Bagdja Website README, Bagdja Website Builder, Barber Classic Template Content, Barber Classic Template, Custom Domain Support, Default Port 5005, Dynamic Template Loader, Dynamic Tenant Route (+18 more)

### Community 14 - "Gathering Invite Components"
Cohesion: 0.15
Nodes (14): PrivateGatheringInvitePage(), PrivateGatheringInvitePageProps, GatheringInvitePage(), GatheringInvitePageProps, formatLocalDate(), GatheringInvitationPreview(), submitRsvp(), verifyRsvp() (+6 more)

### Community 15 - "Gathering Group Steps"
Cohesion: 0.15
Nodes (15): buildGroupSteps(), buyerStepKey(), formatIDR(), FulfillmentProgress(), renderTerminCard(), saveBuyerDraft(), submitBuyerStep(), GroupItem (+7 more)

### Community 16 - "store-classic-catalog.tsx"
Cohesion: 0.16
Nodes (14): BlogRelatedProducts(), sortAxisKeys(), VariantTreeSelector(), handleSelect(), AXIS_PRIORITY, CheckIcon(), ChevronDownIcon(), CustomSelect() (+6 more)

### Community 17 - "Invitation Operations"
Cohesion: 0.08
Nodes (20): formatLocalDate(), GatheringInvitationCard(), formatDate(), GatheringOperationProgress, GatheringOptionSnapshot, GatheringWorkflowSteps(), invitationFilterKey(), InvitationHistoryRow (+12 more)

### Community 18 - "store-classic-icons.tsx"
Cohesion: 0.16
Nodes (18): ModelViewerElement(), ModelViewerElementProps, BarberClassicGalleryCarousel(), ChevronLeftIcon(), ChevronRightIcon(), FullscreenIcon(), Slide, Slide (+10 more)

### Community 19 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "Route Middleware Metadata"
Cohesion: 0.18
Nodes (15): DraftOrderPage(), DraftOrderPageProps, generateMetadata(), getTenantSlugFromRequest(), PLATFORM_HOSTNAMES, resolvePlatformSubdomain(), config, hasSession() (+7 more)

### Community 21 - "Store and Barber Views"
Cohesion: 0.51
Nodes (11): BarberClassicViewProps, StoreClassicViewProps, WorkshopViewProps, BlogPostItem, CatalogItem, CategoryItem, FaqItem, LocationItem (+3 more)

### Community 22 - "Order Fulfillment Metadata"
Cohesion: 0.15
Nodes (17): allFulfillmentStepsCompleted(), COURIER_LABELS, formatCourierCode(), formatLocalDateTime(), FulfillmentStepFormFieldFilledBy, GatheringPlanOrderView(), LegacyOrderView(), OrderDetail (+9 more)

### Community 23 - "Gathering Invoice UI"
Cohesion: 0.16
Nodes (13): formatDate(), formatMoney(), GatheringInvoiceGroup, GatheringInvoiceRow, pillBg(), STATUS_LABEL, STATUS_TONE, StatusPillTone (+5 more)

### Community 24 - "buildBlogPostHref"
Cohesion: 0.53
Nodes (5): BarberClassicBlogSearch(), BarberClassicBlogSearchProps, CloseIcon(), SearchIcon(), buildBlogPostHref()

### Community 26 - "Fulfillment Form Fields"
Cohesion: 0.25
Nodes (11): FulfillmentFieldInput(), MediaValue, normalizeMediaValues(), FulfillmentFieldValue(), MediaValue, normalizeMediaValues(), FulfillmentStepFormField, PraorderStepList() (+3 more)

### Community 29 - "Invitation List Rows"
Cohesion: 0.18
Nodes (6): GatheringInvitationAppearance(), InvitationOperationProgress, InvitationRow, PendingContact, qrcode, xlsx

### Community 30 - "Profile Wallet UI"
Cohesion: 0.23
Nodes (9): formatDate(), formatMoney(), ProfileContent(), ProfileContentProps, WalletBalance, WalletTransactionRow, WalletTransactionsResult, formatWalletTransactionType() (+1 more)

### Community 31 - "Cart and Plan Rows"
Cohesion: 0.27
Nodes (10): canCheckoutLine(), CartContent(), CartIcon(), CartLine, checkoutBlockedReason(), GATHERING_STATUS_LABELS, GatheringPlanRow, RemoveIcon() (+2 more)

### Community 32 - "Gathering Plan Controls"
Cohesion: 0.20
Nodes (8): ConfirmDialog(), DraftOrderCancelButton(), GatheringPlanControls(), savePlan(), GatheringPlanOption, readableErrorMessage(), toIso(), toLocalParts()

### Community 33 - "backend-api.ts"
Cohesion: 0.07
Nodes (19): POST(), RouteContext, POST(), RouteContext, GET(), RouteContext, POST(), RouteContext (+11 more)

### Community 34 - "Invitation Management"
Cohesion: 0.25
Nodes (3): GatheringInvitationManager(), makeShareUrl(), submitInvitationStage()

### Community 35 - "Public Gathering Invoice"
Cohesion: 0.36
Nodes (5): GatheringInvoiceRoute(), GatheringInvoiceRouteProps, formatLocalDate(), GatheringInvoicePage(), PublicGatheringInvoice

### Community 36 - "Gathering Calendar Content"
Cohesion: 0.33
Nodes (6): CALENDAR_TABS, formatDate(), GatheringCalendarContent(), PlanRow, STATUS_LABELS, STEP_LABELS

### Community 37 - "Plan Invitation Routes"
Cohesion: 0.60
Nodes (4): GET(), POST(), query(), RouteContext

### Community 38 - "Gathering Plan Routes"
Cohesion: 0.60
Nodes (4): GET(), PATCH(), RouteContext, websiteQuery()

### Community 39 - "Barber Sample Catalog"
Cohesion: 0.40
Nodes (4): BARBER_SAMPLE_IMAGES, BARBER_SAMPLE_PRODUCTS, BARBER_SAMPLE_SERVICES, BarberCatalogItem

### Community 40 - "Store Sample Catalog"
Cohesion: 0.40
Nodes (3): STORE_SAMPLE_IMAGES, STORE_SAMPLE_PRODUCTS, StoreCatalogItem

### Community 62 - "api-client.ts"
Cohesion: 0.06
Nodes (50): generateMetadata(), generateMetadata(), TenantLayoutProps, generateMetadata(), generateMetadata(), AXIS_PRIORITY, CatalogGridSection(), loadMore() (+42 more)

### Community 68 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, eslint, eslint-config-next, postcss, tailwindcss, @types/node, @types/qrcode (+3 more)

### Community 70 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @google/model-viewer, ioredis, next, qrcode, react, react-dom, socket.io-client (+1 more)

### Community 73 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 74 - "purchase-controls.tsx"
Cohesion: 0.21
Nodes (11): AddToCartButton(), AddToCartButtonProps, GatheringPlanButton(), GatheringPlanButtonProps, PurchaseControls(), PurchaseControlsProps, WorkshopProductDetail(), CheckoutPaymentMode (+3 more)

## Knowledge Gaps
- **30 isolated node(s):** `next/core-web-vitals`, `RFC-6265`, `RFC-6265`, `@types/node`, `@types/qrcode` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 386 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `Page Route Types`, `react`, `session.ts`, `orders-content.tsx`, `Gathering API Handlers`, `Renderer Auth State`, `package.json`, `orders/[id]/route.ts`, `Gathering Invite Components`, `Gathering Group Steps`, `store-classic-catalog.tsx`, `Invitation Operations`, `Route Middleware Metadata`, `invitation-content/route.ts`, `Fulfillment Form Fields`, `[id]/steps/complete/route.ts`, `[id]/complete/route.ts`, `Invitation List Rows`, `Cart and Plan Rows`, `Gathering Plan Controls`, `backend-api.ts`, `Public Gathering Invoice`, `Gathering Calendar Content`, `Plan Invitation Routes`, `Gathering Plan Routes`, `[stepName]/dispute/route.ts`, `Cancel Plan Route`, `transactions/[id]/route.ts`, `Collective Checkout Route`, `Checkout Cancellation Route`, `Registration Rejection Route`, `Private Invitation Status`, `Order Step Completion`, `Step Release Approval`, `Checkout Retry Route`, `Installment Payment Route`, `api-client.ts`, `purchase-controls.tsx`?**
  _High betweenness centrality (0.387) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `RFC-6265`, `RFC-6265` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Route Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0758655168103987 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Page Route Types`, `orders-content.tsx`, `package.json`, `Catalog Mapping Utilities`, `Gathering Invite Components`, `Gathering Group Steps`, `store-classic-catalog.tsx`, `Invitation Operations`, `store-classic-icons.tsx`, `Order Fulfillment Metadata`, `Gathering Invoice UI`, `buildBlogPostHref`, `Fulfillment Form Fields`, `Invitation List Rows`, `Profile Wallet UI`, `Cart and Plan Rows`, `Gathering Plan Controls`, `Public Gathering Invoice`, `Gathering Calendar Content`, `api-client.ts`, `purchase-controls.tsx`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.06363636363636363 - nodes in this community are weakly interconnected._
- **Why does `backendFetch()` connect `Gathering API Handlers` to `Page Route Types`, `session.ts`, `next`, `orders/[id]/route.ts`, `invitation-content/route.ts`, `[id]/steps/complete/route.ts`, `[id]/complete/route.ts`, `backend-api.ts`, `Plan Invitation Routes`, `Gathering Plan Routes`, `[stepName]/dispute/route.ts`, `Cancel Plan Route`, `transactions/[id]/route.ts`, `Collective Checkout Route`, `Checkout Cancellation Route`, `Registration Rejection Route`, `Private Invitation Status`, `Order Step Completion`, `Step Release Approval`, `Checkout Retry Route`, `Installment Payment Route`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `orders-content.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06240084611316764 - nodes in this community are weakly interconnected._