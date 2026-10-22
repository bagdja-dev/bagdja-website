# Graph Report - bagdja-website  (2026-10-22)

## Corpus Check
- 173 files · ~92,372 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .example 1, .css 1)

## Summary
- 1077 nodes · 2882 edges · 79 communities (52 shown, 27 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f163c6b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Page Route Types
- react
- api-client.ts
- orders-content.tsx
- Gathering API Handlers
- Renderer Auth State
- package.json
- Product Order Models
- Template Catalog Components
- next
- Theme Typography Tokens
- Route Handler Types
- Catalog Mapping Utilities
- Website README
- Gathering Invite Components
- Gathering Group Steps
- Blog Variant Browsing
- Invitation Operations
- Product Catalog Grid
- TypeScript Compiler Config
- Route Middleware Metadata
- Store and Barber Views
- Order Fulfillment Metadata
- Gathering Invoice UI
- chat-reference.ts
- Draft Order Shipping
- Fulfillment Form Fields
- Invitation History Filtering
- chat-reference-button.tsx
- Invitation List Rows
- Profile Wallet UI
- Cart and Plan Rows
- Gathering Plan Controls
- operation/route.ts
- Invitation Management
- Public Gathering Invoice
- Gathering Calendar Content
- Plan Invitation Routes
- Gathering Plan Routes
- Barber Sample Catalog
- Store Sample Catalog
- Public Invitation Routes
- Cancel Plan Route
- Invitation Submission Route
- Collective Checkout Route
- Checkout Cancellation Route
- Registration Refund Route
- Registration Rejection Route
- Registration Listing Route
- Invoice Resend Route
- Registration Receipt Route
- Seat Order Route
- Order Step Draft Route
- Private RSVP Route
- Private Invitation Status
- Order Step Completion
- Order Step Drafting
- Step Release Approval
- Checkout Retry Route
- Installment Payment Route
- ESLint Configuration
- Next.js Configuration
- template-data.ts
- customer-chat-content.tsx
- workshop/page.tsx
- barber-classic-gallery-carousel.tsx
- store-classic-icons.tsx
- devDependencies
- notification-bell.tsx
- dependencies
- getWebsiteBySlug
- confirm-reservations/route.ts
- scripts
- purchase-controls.tsx
- app/layout.tsx
- invitation-content/route.ts
- [id]/complete/route.ts
- model-viewer.d.ts

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

## Communities (79 total, 27 thin omitted)

### Community 0 - "Page Route Types"
Cohesion: 0.10
Nodes (84): BlogArticlePage(), BlogArticlePageProps, revalidate, CalendarPage(), CalendarPageProps, generateMetadata(), revalidate, DraftOrderPage() (+76 more)

### Community 1 - "react"
Cohesion: 0.14
Nodes (22): CalendarBadge(), CalendarPlanCountRow, CartBadge(), CartBadgeProps, ServerOrder, TagihanBadge(), TagihanBadgeProps, BarberClassicHeader() (+14 more)

### Community 2 - "api-client.ts"
Cohesion: 0.12
Nodes (28): generateMetadata(), AddToCartPaymentMeta, ApiFulfillmentFlow, ApiPagePlacement, ApiWebsite, ApiWebsiteBlogPost, ApiWebsiteCategory, ApiWebsiteFaq (+20 more)

### Community 3 - "orders-content.tsx"
Cohesion: 0.16
Nodes (18): CancelledPreorderRow, EmptyState(), formatDate(), formatMoney(), OrdersContent(), OrdersContentProps, pillBg(), shortId() (+10 more)

### Community 4 - "Gathering API Handlers"
Cohesion: 0.07
Nodes (27): GET(), POST(), GET(), POST(), POST(), GET(), DELETE(), PATCH() (+19 more)

### Community 5 - "Renderer Auth State"
Cohesion: 0.09
Nodes (41): GET(), RFC-6265, GET(), safeNextPath(), GET(), base64url(), buildAuthorizeUrl(), generateCodeChallenge() (+33 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): description, name, private, version, autoprefixer, eslint, eslint-config-next, postcss (+9 more)

### Community 7 - "Product Order Models"
Cohesion: 0.10
Nodes (37): GatheringPlanButton(), GatheringPlanButtonProps, OrderDetailContent(), AboutSection(), BarberClassicProfile, BarberClassicView(), BlogArticleSection(), BlogCollectionSection() (+29 more)

### Community 8 - "Template Catalog Components"
Cohesion: 0.14
Nodes (32): StoreClassicBlogSidebar(), ProductGridSection(), MailIcon(), MapPinIcon(), PhoneIcon(), AboutSection(), BlogArticleSection(), BlogPostCard() (+24 more)

### Community 9 - "next"
Cohesion: 0.08
Nodes (12): POST(), POST(), RouteContext, GET(), RouteContext, POST(), RouteContext, POST() (+4 more)

### Community 10 - "Theme Typography Tokens"
Cohesion: 0.08
Nodes (31): ACCENT_SWATCH, ACCENT_TOKENS, BODY_WEIGHTS, BodyWeight, COLOR_PARAM_MAP, darkenHex(), DEFAULT_TYPOGRAPHY, deriveColorsFromTheme() (+23 more)

### Community 11 - "Route Handler Types"
Cohesion: 0.10
Nodes (18): POST(), RouteContext, POST(), RouteContext, GET(), RouteContext, DELETE(), GET() (+10 more)

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

### Community 16 - "Blog Variant Browsing"
Cohesion: 0.13
Nodes (19): BlogRelatedProducts(), sortAxisKeys(), VariantTreeSelector(), handleSelect(), AXIS_PRIORITY, CategoryListingSection(), CheckIcon(), ChevronDownIcon() (+11 more)

### Community 17 - "Invitation Operations"
Cohesion: 0.15
Nodes (16): formatLocalDate(), GatheringInvitationCard(), formatDate(), GatheringOperationProgress, GatheringOptionSnapshot, GatheringWorkflowSteps(), InvitationHistoryRow, PARTICIPANT_FILTERS (+8 more)

### Community 18 - "Product Catalog Grid"
Cohesion: 0.18
Nodes (15): AXIS_PRIORITY, CatalogGridSection(), loadMore(), CatalogHeading(), CategoryListingSection(), loadMore(), CheckIcon(), ChevronDownIcon() (+7 more)

### Community 19 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "Route Middleware Metadata"
Cohesion: 0.18
Nodes (15): DraftOrderPage(), DraftOrderPageProps, generateMetadata(), getTenantSlugFromRequest(), PLATFORM_HOSTNAMES, resolvePlatformSubdomain(), config, hasSession() (+7 more)

### Community 21 - "Store and Barber Views"
Cohesion: 0.21
Nodes (18): PurchaseControlsProps, BarberClassicBlogSearch(), BarberClassicBlogSearchProps, CloseIcon(), SearchIcon(), BarberClassicViewProps, StoreClassicViewProps, WorkshopViewProps (+10 more)

### Community 22 - "Order Fulfillment Metadata"
Cohesion: 0.15
Nodes (17): allFulfillmentStepsCompleted(), COURIER_LABELS, formatCourierCode(), formatLocalDateTime(), FulfillmentStepFormFieldFilledBy, GatheringPlanOrderView(), LegacyOrderView(), OrderDetail (+9 more)

### Community 23 - "Gathering Invoice UI"
Cohesion: 0.16
Nodes (13): formatDate(), formatMoney(), GatheringInvoiceGroup, GatheringInvoiceRow, pillBg(), STATUS_LABEL, STATUS_TONE, StatusPillTone (+5 more)

### Community 24 - "chat-reference.ts"
Cohesion: 0.35
Nodes (8): buildChatReferenceHref(), ChatReferenceCard(), extractSegment(), getChatReferenceLabel(), isProbablySlug(), resolveChatReferenceHref(), draftOrderHref(), transactionHref()

### Community 25 - "Draft Order Shipping"
Cohesion: 0.19
Nodes (11): CheckoutContent(), COURIERS, DraftProduct, EMPTY_SHIPPING, inputClass(), ServerOrder, ShippingCostOption, ShippingForm (+3 more)

### Community 26 - "Fulfillment Form Fields"
Cohesion: 0.25
Nodes (11): FulfillmentFieldInput(), MediaValue, normalizeMediaValues(), FulfillmentFieldValue(), MediaValue, normalizeMediaValues(), FulfillmentStepFormField, PraorderStepList() (+3 more)

### Community 27 - "Invitation History Filtering"
Cohesion: 0.14
Nodes (4): invitationFilterKey(), matchesParticipantQuery(), ReadOnlyInvitationHistory(), registrationFilterKey()

### Community 28 - "chat-reference-button.tsx"
Cohesion: 0.18
Nodes (12): ChatReferenceButton(), openChat(), ChatReferenceButtonProps, threadLabelFromReference(), ChatReference, createChatReferenceMessage(), ACTION_CONFIG, ActionKind (+4 more)

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

### Community 62 - "template-data.ts"
Cohesion: 0.11
Nodes (21): ApiWebsiteTemplate, AXIS_LABEL_ALIASES, buildCatalogFromSeed(), DEFAULT_SECTIONS, digitsOnly(), GatheringOptionGroup, MasterDefaultsCatalogItem, MasterDefaultsCategoryItem (+13 more)

### Community 63 - "customer-chat-content.tsx"
Cohesion: 0.23
Nodes (12): parseChatReference(), ApiData, asRecord(), CustomerChatContent(), eventString(), fetchJson(), matchesThread(), parseRealtimeEvent() (+4 more)

### Community 65 - "workshop/page.tsx"
Cohesion: 0.38
Nodes (10): BarberClassicTemplate(), SearchParams, SearchParams, StoreClassicTemplate(), SearchParams, WorkshopTemplate(), getTemplateBySlug(), buildTemplateDefaultsPreview() (+2 more)

### Community 66 - "barber-classic-gallery-carousel.tsx"
Cohesion: 0.24
Nodes (9): ModelViewerElement(), ModelViewerElementProps, BarberClassicGalleryCarousel(), ChevronLeftIcon(), ChevronRightIcon(), FullscreenIcon(), Slide, GalleryImageItem (+1 more)

### Community 67 - "store-classic-icons.tsx"
Cohesion: 0.44
Nodes (9): Slide, StoreClassicProductGallery(), ChevronLeftIcon(), ChevronRightIcon(), CloseIcon(), CubeIcon(), FullscreenIcon(), PlayIcon() (+1 more)

### Community 68 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, eslint, eslint-config-next, postcss, tailwindcss, @types/node, @types/qrcode (+3 more)

### Community 69 - "notification-bell.tsx"
Cohesion: 0.42
Nodes (7): formatNotificationTime(), NotificationBell(), readSiteUserId(), resolveActionHref(), WebsiteNotification, playNotificationSound(), unlockNotificationAudio()

### Community 70 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @google/model-viewer, ioredis, next, qrcode, react, react-dom, socket.io-client (+1 more)

### Community 71 - "getWebsiteBySlug"
Cohesion: 0.33
Nodes (5): generateMetadata(), TenantLayoutProps, generateMetadata(), generateMetadata(), getWebsiteBySlug()

### Community 72 - "confirm-reservations/route.ts"
Cohesion: 0.27
Nodes (4): POST(), RouteContext, GET(), RouteContext

### Community 73 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 74 - "purchase-controls.tsx"
Cohesion: 0.60
Nodes (3): AddToCartButton(), AddToCartButtonProps, PurchaseControls()

## Knowledge Gaps
- **30 isolated node(s):** `next/core-web-vitals`, `RFC-6265`, `RFC-6265`, `@types/node`, `@types/qrcode` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 385 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `Page Route Types`, `react`, `Gathering API Handlers`, `Renderer Auth State`, `package.json`, `Route Handler Types`, `Gathering Invite Components`, `Gathering Group Steps`, `Blog Variant Browsing`, `Invitation Operations`, `Product Catalog Grid`, `Route Middleware Metadata`, `chat-reference.ts`, `Draft Order Shipping`, `Fulfillment Form Fields`, `chat-reference-button.tsx`, `Invitation List Rows`, `Cart and Plan Rows`, `Gathering Plan Controls`, `operation/route.ts`, `Public Gathering Invoice`, `Gathering Calendar Content`, `Plan Invitation Routes`, `Gathering Plan Routes`, `Public Invitation Routes`, `Cancel Plan Route`, `Invitation Submission Route`, `Collective Checkout Route`, `Checkout Cancellation Route`, `Registration Refund Route`, `Registration Rejection Route`, `Registration Listing Route`, `Invoice Resend Route`, `Registration Receipt Route`, `Seat Order Route`, `Order Step Draft Route`, `Private RSVP Route`, `Private Invitation Status`, `Order Step Completion`, `Order Step Drafting`, `Step Release Approval`, `Checkout Retry Route`, `Installment Payment Route`, `customer-chat-content.tsx`, `getWebsiteBySlug`, `confirm-reservations/route.ts`, `purchase-controls.tsx`, `app/layout.tsx`, `invitation-content/route.ts`, `[id]/complete/route.ts`?**
  _High betweenness centrality (0.385) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `RFC-6265`, `RFC-6265` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Route Types` be split into smaller, more focused modules?**
  _Cohesion score 0.09919137466307278 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `Page Route Types`, `orders-content.tsx`, `package.json`, `Product Order Models`, `Template Catalog Components`, `Catalog Mapping Utilities`, `Gathering Invite Components`, `Gathering Group Steps`, `Blog Variant Browsing`, `Invitation Operations`, `Product Catalog Grid`, `Store and Barber Views`, `Order Fulfillment Metadata`, `Gathering Invoice UI`, `chat-reference.ts`, `Draft Order Shipping`, `Fulfillment Form Fields`, `chat-reference-button.tsx`, `Invitation List Rows`, `Profile Wallet UI`, `Cart and Plan Rows`, `Gathering Plan Controls`, `Public Gathering Invoice`, `Gathering Calendar Content`, `customer-chat-content.tsx`, `barber-classic-gallery-carousel.tsx`, `store-classic-icons.tsx`, `notification-bell.tsx`, `getWebsiteBySlug`, `purchase-controls.tsx`, `app/layout.tsx`, `model-viewer.d.ts`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `backendFetch()` connect `Gathering API Handlers` to `Page Route Types`, `next`, `Route Handler Types`, `operation/route.ts`, `Plan Invitation Routes`, `Gathering Plan Routes`, `Cancel Plan Route`, `Invitation Submission Route`, `Collective Checkout Route`, `Checkout Cancellation Route`, `Registration Refund Route`, `Registration Rejection Route`, `Registration Listing Route`, `Invoice Resend Route`, `Registration Receipt Route`, `Seat Order Route`, `Order Step Draft Route`, `Private RSVP Route`, `Private Invitation Status`, `Order Step Completion`, `Order Step Drafting`, `Step Release Approval`, `Checkout Retry Route`, `Installment Payment Route`, `confirm-reservations/route.ts`, `invitation-content/route.ts`, `[id]/complete/route.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `api-client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12413793103448276 - nodes in this community are weakly interconnected._