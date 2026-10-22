# Graph Report - bagdja-website  (2026-10-22)

## Corpus Check
- 176 files · ~92,702 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .example 1, .css 1)

## Summary
- 1082 nodes · 2895 edges · 71 communities (46 shown, 25 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d5e34751`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Page Route Types
- store-classic-header.tsx
- ReadOnlyInvitationHistory
- orders-content.tsx
- Gathering API Handlers
- Renderer Auth State
- package.json
- Product Order Models
- Template Catalog Components
- next
- Theme Typography Tokens
- backend-api.ts
- Catalog Mapping Utilities
- Website README
- Gathering Invite Components
- Gathering Group Steps
- barber-classic-catalog.tsx
- Invitation Operations
- barber-classic-gallery-carousel.tsx
- TypeScript Compiler Config
- Route Middleware Metadata
- Store and Barber Views
- Order Fulfillment Metadata
- Gathering Invoice UI
- ConfirmDialog
- invitation-content/route.ts
- Fulfillment Form Fields
- react
- [id]/complete/route.ts
- Invitation List Rows
- Profile Wallet UI
- Cart and Plan Rows
- Gathering Plan Controls
- download-url/route.ts
- Invitation Management
- checkout-content.tsx
- Gathering Calendar Content
- Plan Invitation Routes
- Gathering Plan Routes
- Barber Sample Catalog
- Store Sample Catalog
- notification-bell.tsx
- Cancel Plan Route
- store-classic-icons.tsx
- Collective Checkout Route
- Checkout Cancellation Route
- [token]/route.ts
- Registration Rejection Route
- operation/route.ts
- submit/route.ts
- refund/route.ts
- registrations/route.ts
- resend-invoices/route.ts
- receipt/route.ts
- Private Invitation Status
- Order Step Completion
- seat-order/route.ts
- Step Release Approval
- [id]/steps/draft/route.ts
- Installment Payment Route
- ESLint Configuration
- Next.js Configuration
- api-client.ts
- private-rsvp/route.ts
- transactions/[id]/cancel/route.ts
- [id]/dispute/route.ts
- devDependencies
- dependencies
- scripts
- purchase-controls.tsx

## God Nodes (most connected - your core abstractions)
1. `backendFetch()` - 120 edges
2. `next` - 113 edges
3. `loadTenant()` - 58 edges
4. `react` - 49 edges
5. `StoreClassicView()` - 47 edges
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

## Communities (71 total, 25 thin omitted)

### Community 0 - "Page Route Types"
Cohesion: 0.08
Nodes (104): BlogArticlePage(), BlogArticlePageProps, revalidate, CalendarPage(), CalendarPageProps, generateMetadata(), revalidate, DraftOrderPage() (+96 more)

### Community 1 - "store-classic-header.tsx"
Cohesion: 0.16
Nodes (19): CalendarBadge(), CalendarPlanCountRow, CartBadge(), TagihanBadge(), TagihanBadgeProps, BarberClassicHeader(), BarberClassicHeaderProps, CloseIcon() (+11 more)

### Community 2 - "ReadOnlyInvitationHistory"
Cohesion: 0.14
Nodes (4): invitationFilterKey(), matchesParticipantQuery(), ReadOnlyInvitationHistory(), registrationFilterKey()

### Community 3 - "orders-content.tsx"
Cohesion: 0.07
Nodes (45): buildChatReferenceHref(), openChat(), ChatReferenceButtonProps, threadLabelFromReference(), ChatReferenceCard(), ChatReference, createChatReferenceMessage(), extractSegment() (+37 more)

### Community 4 - "Gathering API Handlers"
Cohesion: 0.06
Nodes (28): GET(), POST(), GET(), POST(), POST(), GET(), DELETE(), PATCH() (+20 more)

### Community 5 - "Renderer Auth State"
Cohesion: 0.09
Nodes (41): GET(), RFC-6265, GET(), safeNextPath(), GET(), base64url(), buildAuthorizeUrl(), generateCodeChallenge() (+33 more)

### Community 6 - "package.json"
Cohesion: 0.12
Nodes (15): description, name, private, version, autoprefixer, eslint, eslint-config-next, postcss (+7 more)

### Community 7 - "Product Order Models"
Cohesion: 0.12
Nodes (32): CheckoutContent(), OrderDetailContent(), AboutSection(), BarberClassicProfile, BarberClassicView(), BlogArticleSection(), BlogCollectionSection(), BlogListSection() (+24 more)

### Community 8 - "Template Catalog Components"
Cohesion: 0.13
Nodes (32): StoreClassicBlogSidebar(), MailIcon(), MapPinIcon(), PhoneIcon(), AboutSection(), BlogArticleSection(), BlogPostCard(), BlogSearchSection() (+24 more)

### Community 9 - "next"
Cohesion: 0.07
Nodes (13): POST(), RouteContext, POST(), RouteContext, GET(), RouteContext, POST(), RouteContext (+5 more)

### Community 10 - "Theme Typography Tokens"
Cohesion: 0.07
Nodes (41): BarberClassicTemplate(), SearchParams, SearchParams, StoreClassicTemplate(), SearchParams, WorkshopTemplate(), getTemplateBySlug(), buildTemplateDefaultsPreview() (+33 more)

### Community 11 - "backend-api.ts"
Cohesion: 0.10
Nodes (18): POST(), RouteContext, GET(), RouteContext, DELETE(), GET(), PATCH(), POST() (+10 more)

### Community 12 - "Catalog Mapping Utilities"
Cohesion: 0.23
Nodes (24): getString(), isCatalogItem(), pickCategoryImage(), SectionHeading(), WorkshopAbout(), WorkshopBlogArticle(), WorkshopBlogCards(), WorkshopBlogGrid() (+16 more)

### Community 13 - "Website README"
Cohesion: 0.08
Nodes (26): Bagdja Website README, Bagdja Website Builder, Barber Classic Template Content, Barber Classic Template, Custom Domain Support, Default Port 5005, Dynamic Template Loader, Dynamic Tenant Route (+18 more)

### Community 14 - "Gathering Invite Components"
Cohesion: 0.15
Nodes (14): PrivateGatheringInvitePage(), PrivateGatheringInvitePageProps, GatheringInvitePage(), GatheringInvitePageProps, formatLocalDate(), GatheringInvitationPreview(), submitRsvp(), verifyRsvp() (+6 more)

### Community 15 - "Gathering Group Steps"
Cohesion: 0.15
Nodes (15): buildGroupSteps(), buyerStepKey(), formatIDR(), FulfillmentProgress(), renderTerminCard(), saveBuyerDraft(), submitBuyerStep(), GroupItem (+7 more)

### Community 16 - "barber-classic-catalog.tsx"
Cohesion: 0.09
Nodes (31): BlogRelatedProducts(), AXIS_PRIORITY, CatalogGridSection(), loadMore(), CatalogHeading(), CategoryListingSection(), loadMore(), CheckIcon() (+23 more)

### Community 17 - "Invitation Operations"
Cohesion: 0.15
Nodes (16): formatLocalDate(), GatheringInvitationCard(), formatDate(), GatheringOperationProgress, GatheringOptionSnapshot, GatheringWorkflowSteps(), InvitationHistoryRow, PARTICIPANT_FILTERS (+8 more)

### Community 18 - "barber-classic-gallery-carousel.tsx"
Cohesion: 0.24
Nodes (9): ModelViewerElement(), ModelViewerElementProps, BarberClassicGalleryCarousel(), ChevronLeftIcon(), ChevronRightIcon(), FullscreenIcon(), Slide, GalleryImageItem (+1 more)

### Community 19 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "Route Middleware Metadata"
Cohesion: 0.18
Nodes (15): DraftOrderPage(), DraftOrderPageProps, generateMetadata(), getTenantSlugFromRequest(), PLATFORM_HOSTNAMES, resolvePlatformSubdomain(), config, hasSession() (+7 more)

### Community 21 - "Store and Barber Views"
Cohesion: 0.30
Nodes (15): BarberClassicBlogSearch(), BarberClassicBlogSearchProps, CloseIcon(), SearchIcon(), BarberClassicViewProps, StoreClassicViewProps, WorkshopViewProps, BlogPostItem (+7 more)

### Community 22 - "Order Fulfillment Metadata"
Cohesion: 0.13
Nodes (19): DigitalAssetDownloadButton(), DirectPaymentStatusRefresh(), allFulfillmentStepsCompleted(), COURIER_LABELS, formatCourierCode(), formatLocalDateTime(), FulfillmentStepFormFieldFilledBy, GatheringPlanOrderView() (+11 more)

### Community 23 - "Gathering Invoice UI"
Cohesion: 0.16
Nodes (13): formatDate(), formatMoney(), GatheringInvoiceGroup, GatheringInvoiceRow, pillBg(), STATUS_LABEL, STATUS_TONE, StatusPillTone (+5 more)

### Community 24 - "ConfirmDialog"
Cohesion: 0.23
Nodes (6): ConfirmDialog(), DraftOrderCancelButton(), ACTION_CONFIG, ActionKind, BUTTON_STYLE, OrderActionButtons()

### Community 26 - "Fulfillment Form Fields"
Cohesion: 0.25
Nodes (11): FulfillmentFieldInput(), MediaValue, normalizeMediaValues(), FulfillmentFieldValue(), MediaValue, normalizeMediaValues(), FulfillmentStepFormField, PraorderStepList() (+3 more)

### Community 27 - "react"
Cohesion: 0.18
Nodes (6): metadata, CartBadgeProps, ServerOrder, react, IntrinsicElements, JSX

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
Cohesion: 0.27
Nodes (6): GatheringPlanControls(), savePlan(), GatheringPlanOption, readableErrorMessage(), toIso(), toLocalParts()

### Community 33 - "download-url/route.ts"
Cohesion: 0.27
Nodes (4): POST(), RouteContext, POST(), RouteContext

### Community 34 - "Invitation Management"
Cohesion: 0.25
Nodes (3): GatheringInvitationManager(), makeShareUrl(), submitInvitationStage()

### Community 35 - "checkout-content.tsx"
Cohesion: 0.22
Nodes (9): DraftProduct, EMPTY_SHIPPING, inputClass(), ServerOrder, ShippingCostOption, ShippingForm, ShippingAreaOption, ShippingAreaSearch() (+1 more)

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

### Community 41 - "notification-bell.tsx"
Cohesion: 0.31
Nodes (9): formatNotificationTime(), NotificationBell(), readSiteUserId(), resolveActionHref(), WebsiteNotification, playNotificationSound(), unlockNotificationAudio(), react-dom (+1 more)

### Community 43 - "store-classic-icons.tsx"
Cohesion: 0.44
Nodes (9): Slide, StoreClassicProductGallery(), ChevronLeftIcon(), ChevronRightIcon(), CloseIcon(), CubeIcon(), FullscreenIcon(), PlayIcon() (+1 more)

### Community 62 - "api-client.ts"
Cohesion: 0.07
Nodes (40): generateMetadata(), GatheringInvoiceRoute(), GatheringInvoiceRouteProps, generateMetadata(), TenantLayoutProps, generateMetadata(), generateMetadata(), formatLocalDate() (+32 more)

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
Cohesion: 0.18
Nodes (16): AddToCartButton(), AddToCartButtonProps, ChatReferenceButton(), GatheringPlanButton(), GatheringPlanButtonProps, PurchaseControls(), PurchaseControlsProps, ProductDetailSection() (+8 more)

## Knowledge Gaps
- **30 isolated node(s):** `next/core-web-vitals`, `RFC-6265`, `RFC-6265`, `@types/node`, `@types/qrcode` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 387 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `Page Route Types`, `store-classic-header.tsx`, `orders-content.tsx`, `Gathering API Handlers`, `Renderer Auth State`, `package.json`, `backend-api.ts`, `Gathering Invite Components`, `Gathering Group Steps`, `barber-classic-catalog.tsx`, `Invitation Operations`, `Route Middleware Metadata`, `Order Fulfillment Metadata`, `ConfirmDialog`, `invitation-content/route.ts`, `Fulfillment Form Fields`, `react`, `[id]/complete/route.ts`, `Invitation List Rows`, `Cart and Plan Rows`, `Gathering Plan Controls`, `download-url/route.ts`, `checkout-content.tsx`, `Gathering Calendar Content`, `Plan Invitation Routes`, `Gathering Plan Routes`, `Cancel Plan Route`, `Collective Checkout Route`, `Checkout Cancellation Route`, `[token]/route.ts`, `Registration Rejection Route`, `operation/route.ts`, `submit/route.ts`, `refund/route.ts`, `registrations/route.ts`, `resend-invoices/route.ts`, `receipt/route.ts`, `Private Invitation Status`, `Order Step Completion`, `seat-order/route.ts`, `Step Release Approval`, `[id]/steps/draft/route.ts`, `Installment Payment Route`, `api-client.ts`, `private-rsvp/route.ts`, `transactions/[id]/cancel/route.ts`, `[id]/dispute/route.ts`, `purchase-controls.tsx`?**
  _High betweenness centrality (0.382) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `RFC-6265`, `RFC-6265` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Route Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0758655168103987 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Page Route Types`, `store-classic-header.tsx`, `orders-content.tsx`, `package.json`, `Template Catalog Components`, `Catalog Mapping Utilities`, `Gathering Invite Components`, `Gathering Group Steps`, `barber-classic-catalog.tsx`, `Invitation Operations`, `barber-classic-gallery-carousel.tsx`, `Store and Barber Views`, `Order Fulfillment Metadata`, `Gathering Invoice UI`, `ConfirmDialog`, `Fulfillment Form Fields`, `Invitation List Rows`, `Profile Wallet UI`, `Cart and Plan Rows`, `Gathering Plan Controls`, `checkout-content.tsx`, `Gathering Calendar Content`, `notification-bell.tsx`, `store-classic-icons.tsx`, `api-client.ts`, `purchase-controls.tsx`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `ReadOnlyInvitationHistory` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `backendFetch()` connect `Gathering API Handlers` to `Page Route Types`, `next`, `backend-api.ts`, `invitation-content/route.ts`, `[id]/complete/route.ts`, `download-url/route.ts`, `Plan Invitation Routes`, `Gathering Plan Routes`, `Cancel Plan Route`, `Collective Checkout Route`, `Checkout Cancellation Route`, `Registration Rejection Route`, `operation/route.ts`, `submit/route.ts`, `refund/route.ts`, `registrations/route.ts`, `resend-invoices/route.ts`, `receipt/route.ts`, `Private Invitation Status`, `Order Step Completion`, `seat-order/route.ts`, `Step Release Approval`, `[id]/steps/draft/route.ts`, `Installment Payment Route`, `private-rsvp/route.ts`, `transactions/[id]/cancel/route.ts`, `[id]/dispute/route.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `orders-content.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07058001397624039 - nodes in this community are weakly interconnected._