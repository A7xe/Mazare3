# Cursor Project Brief — Jordan Recreational Farms & Chalets Booking Platform

> **Working name:** Mazare3 Jordan / مزارع الأردن  
> **File purpose:** This file is the source of truth for Cursor. Read it before creating files, database schema, UI, APIs, or business logic.  
> **Important definition:** In this project, the word "farm / مزرعة" means a **private recreational property in Jordan** such as a chalet, villa, istiraha, pool house, event farm, or private resort. It does **not** mean an agricultural farm.

---

## 0. Cursor Operating Rules

Before implementing anything, Cursor must follow these rules:

1. Do not build a generic directory website. This platform must be a trusted booking marketplace.
2. Do not expose owner phone numbers, WhatsApp numbers, exact address, or external contact links before confirmed booking.
3. Do not create multiple admin roles. There is only one all-powerful role: `admin`.
4. Do not mix Prisma and Drizzle in the MVP. Use **Prisma** first unless the project owner explicitly requests Drizzle.
5. Do not implement payments as a fake boolean field only. Build a clean payment abstraction with statuses, transactions, webhooks, provider references, and audit logs.
6. Do not overuse client components in Next.js. Use Server Components where possible and client components only for interactivity.
7. Do not create random UI. Follow the design system in this file.
8. Do not add a library unless it solves a real need.
9. Every endpoint must have authorization, validation, error handling, and rate-limit strategy where needed.
10. Every important business action must create an audit log.
11. Always keep Arabic and English ready from the start.
12. After every implementation phase, report:
    - What changed
    - Files changed
    - Database changes
    - What is not done
    - How to test

---

## 1. Project Vision

Build a premium bilingual marketplace for booking private recreational farms, chalets, villas, pool houses, and istirahat in Jordan.

The platform should solve the current messy booking experience in Jordan:

- WhatsApp-only booking
- Facebook posts with weak search
- Unclear availability
- Old or fake photos
- Untrusted deposits
- Price changes after contacting the owner
- Double-booking
- No reliable reviews
- No refund or dispute process
- No easy comparison between farms

The platform should make users feel:

> "Booking through the platform is safer, clearer, cheaper, and easier than contacting the owner directly."

And make owners feel:

> "Listing on the platform increases my bookings, reduces fake reservations, improves trust, and gives me professional tools I cannot build alone."

---

## 2. Core Positioning

### Arabic positioning

احجز مزرعتك أو شاليهك الخاص في الأردن بثقة — صور حقيقية، أسعار واضحة، توافر مباشر، دفع آمن، وتقييمات من زبائن حقيقيين.

### English positioning

Book verified private farms and chalets in Jordan with confidence — real media, clear prices, live availability, secure payments, and reviews from real guests.

### What we are not

We are not just:
- A farm directory
- A Facebook listing clone
- A WhatsApp lead generator
- A classified ads website

### What we are

We are:
- A verified booking platform
- A trust layer between guests and property owners
- A marketplace for private day-use and overnight stays
- A service platform for full experiences, not only spaces

---

## 3. Why Users Should Book Through the Platform Instead of Outside

This is the most important business problem. The product must create strong reasons to keep the full journey inside the platform.

### 3.1 Guaranteed Booking

Feature name:
- Arabic: الحجز المضمون
- English: Guaranteed Booking

Logic:
- User pays deposit or full amount through the platform.
- Booking receives a confirmed status only after successful payment.
- Owner cannot give the same slot to another customer.
- If the property is unavailable or materially different from the listing, the user can open a dispute.

Platform promise:
- Confirmed availability
- Clear payment proof
- Refund/dispute process
- Support record inside the platform

### 3.2 Verified Photos and Videos

Feature name:
- Arabic: صور وفيديوهات موثقة
- English: Verified Media

Media trust levels:
- `owner_uploaded`
- `platform_reviewed`
- `platform_verified`
- `360_video_verified`

UI badges:
- موثق
- صور حقيقية
- تم التحقق من المزرعة
- Verified
- Real Photos
- Platform Checked

Important:
- Never show all listings as verified by default.
- Verification must be earned/admin-approved.

### 3.3 Real Reviews After Real Bookings Only

Only users with completed bookings can review.

Review categories:
- Cleanliness
- Pool cleanliness
- Privacy
- Owner communication
- Value for money
- Accuracy of photos
- Family suitability
- Youth suitability
- Kids suitability
- Location accuracy
- Air conditioning/heating
- Safety

This creates a trust advantage over Facebook and WhatsApp.

### 3.4 Better In-App Pricing

The platform must offer reasons for prices to be better inside the app.

Mechanisms:
- Early booking discounts
- Mid-week discounts
- Last-minute deals
- Loyalty points
- Platform coupons
- Owner-funded discounts
- New listing boosts
- Seasonal campaigns
- Bundle discounts with add-on services

UI copy:
- "Platform-only deal"
- "خصم خاص بالحجز عبر المنصة"
- "Save more when you book here"

### 3.5 Loyalty and Rewards

Users must feel that booking outside loses benefits.

Points:
- Earn points from every confirmed booking.
- Redeem points for discounts.
- Bonus points for verified reviews.
- Bonus points for inviting friends.
- VIP tier for frequent bookers.

Potential tiers:
- Bronze
- Silver
- Gold
- VIP

### 3.6 Add-on Services

The platform should sell a complete experience, not only a property.

Add-ons:
- BBQ setup
- Chef
- Cleaning
- Birthday decoration
- Wedding/engagement decoration
- DJ
- Photographer
- Kids games
- Inflatable games
- Projector screen
- Extra tables/chairs
- Shisha/argileh setup
- Pool heating
- Extra towels
- Cake
- Snacks and drinks packages
- Transportation later

This creates a strong reason to use the platform even if the user knows the farm owner.

### 3.7 In-App Chat With Protected Contact

Before booking:
- Allow questions through platform chat.
- Hide phone, WhatsApp, email, social links, and exact address.
- Block/flag obvious contact-sharing attempts later if needed.

After confirmed booking:
- Reveal arrival instructions, allowed contact method, and exact location if business policy allows.

### 3.8 Support and Disputes

Users need support when:
- Owner cancels
- Property is not as described
- Pool is dirty
- Location is wrong
- Owner requests extra money
- Booking is double-booked
- Refund is needed

Build dispute records from the start, even if manual in MVP.

---

## 4. Why Owners Should Join Without Begging Them

Owners need to see the platform as a revenue tool, not a tax.

### 4.1 Owner Value Proposition

Arabic:
وجود مزرعتك على المنصة يعني صفحة احترافية، حجوزات أكثر، عربون مضمون، تقليل الحجوزات الوهمية، تقييمات موثوقة، وأدوات تساعدك تعرف أفضل أيامك وأسعارك.

English:
Listing your property gives you a professional page, more bookings, guaranteed deposits, fewer fake reservations, trusted reviews, and tools to understand your best days and prices.

### 4.2 Owner Dashboard

Must include:
- Upcoming bookings
- Revenue summary
- Occupancy rate
- Calendar management
- Pricing by day/season
- Booking requests if instant booking is disabled
- Payout status
- Reviews
- Listing quality score
- Missing requirements checklist
- Promotion tools
- Add-on services setup later

### 4.3 Owner Protection

Owner protection features:
- Required deposit
- Cancellation policy
- Security deposit/holding deposit concept
- Guest identity fields
- Maximum guests
- Rules acceptance before checkout
- Damage report workflow
- No-show policy
- Admin dispute support

### 4.4 Free Professional Listing Setup

To attract supply:
- Free basic listing page
- Free/discounted photography campaign for early owners
- Listing quality checklist
- Optional platform-verified media badge
- Promotional boost for new verified listings

### 4.5 Revenue Tools

Future features:
- Smart pricing suggestions
- Mid-week discount recommendation
- High-season calendar
- Competitor-like local market insights
- Promotion packages
- Featured listing placement

---

## 5. Target Audience

### Guest types

1. Families looking for privacy and cleanliness.
2. Youth groups looking for pool, football field, BBQ, and large space.
3. Couples or small groups seeking premium chalets.
4. Birthday and graduation parties.
5. Engagements and small events.
6. Corporate/team gatherings.
7. Tourists or expats looking for private stays.
8. People searching in Arabic terms such as:
   - مزارع
   - شاليهات
   - استراحات
   - فلل مع مسبح
   - مزارع في عمان
   - مزارع في جرش
   - مزارع في السلط
   - مزارع للايجار اليومي
   - مزارع للعائلات
   - مزارع للشباب

### Owner types

1. Individual farm/chalet owners.
2. Small private resort owners.
3. Property managers.
4. Event farm owners.
5. Owners with seasonal empty days.
6. Owners who rely heavily on Facebook/WhatsApp.

---

## 6. Geographic Scope

MVP country:
- Jordan

Initial cities/areas:
- Amman outskirts
- Salt
- Jerash
- Madaba
- Ajloun
- Dead Sea
- Irbid
- Zarqa outskirts
- Balqa
- Ma'in
- Fuheis/Mahis
- Naour
- Airport Road

Location rules:
- Show approximate location before booking.
- Show exact location only after confirmed booking.
- Use maps, but do not leak exact coordinates before payment.

---

## 7. Tech Stack

### Editor

- Cursor

### Monorepo

Recommended structure:

```txt
apps/
  web/        Next.js frontend
  api/        Express.js backend
packages/
  db/         Prisma schema/client/shared db utils
  shared/     shared types, Zod schemas, constants
  ui/         optional shared UI components later
docs/
  PROJECT_BRIEF_CURSOR.md
```

Use:
- pnpm workspaces
- TypeScript everywhere

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI
- Framer Motion
- next-intl or similar i18n approach
- React Hook Form
- Zod validation
- TanStack Query only where client-side server-state is necessary
- Map provider abstraction, with Google Maps or Mapbox later

### Backend

- Express.js with TypeScript
- Versioned API routes: `/api/v1`
- Modular architecture:
  - routes
  - controllers
  - services
  - repositories
  - validators
  - middlewares
  - jobs
- Prisma ORM
- Neon PostgreSQL
- Redis for:
  - rate limiting
  - cache
  - sessions or token blocklists if needed
  - idempotency locks
  - booking checkout locks
- BullMQ later for background jobs if needed

### Database

- Neon PostgreSQL
- Prisma migrations
- Do not edit production database manually.
- Use migrations for schema changes.
- Use seed data for demo listings.

### Auth

Preferred MVP options:

Option A — Clerk:
- Fastest to implement.
- Good for MFA/social login.
- Express API validates Clerk tokens.
- App roles stored in database.

Option B — Platform-owned auth:
- Express handles email/password, OTP later, sessions via HttpOnly cookies.
- More control, more work.

Decision for MVP:
- If speed is priority: use Clerk.
- If full ownership and local-phone workflows are priority: use Express-owned auth.
- Do not mix both in the same implementation unless explicitly planned.

Required roles:
- `guest_user`
- `owner`
- `admin`

Important:
- There is only one admin role: `admin`.
- Admin can access everything.
- Owners can only access their own listings, bookings, payouts, and messages.
- Guests can only access their own bookings, reviews, favorites, payments, and profile.

### Validation

- Zod on all incoming payloads.
- Shared Zod schemas where frontend and backend can reuse them.
- Server-side validation is mandatory even if frontend validates.

### Security

- Authorization on every protected endpoint
- Rate limiting
- CSP headers
- Helmet
- CORS allowlist
- HttpOnly cookies if using cookie auth
- Secure SameSite cookies
- Input validation
- Output sanitization where needed
- Secrets only in `.env`
- Never commit `.env`
- Upload restrictions:
  - allowed MIME types
  - max file size
  - virus/malware scanning later
  - store via Cloudinary/S3/R2, not local disk in production
- Audit logs
- Admin activity logs
- Payment webhook signature verification
- Idempotency keys for payment and booking creation
- Booking race-condition protection using DB transactions and locks
- WAF through Cloudflare

### Performance

- Use Server Components for static/catalog pages.
- Minimize client-side JS.
- Use image optimization.
- Use CDN for images.
- Cache stable data:
  - amenities
  - locations
  - categories
  - public listing summary
- Use pagination/infinite loading for search.
- Use database indexes for search filters.
- Use proper loading skeletons.
- Optimize Core Web Vitals.

### Quality

- ESLint
- Prettier
- TypeScript strict
- Vitest for unit/service tests
- Playwright for E2E tests
- GitHub Actions:
  - install
  - lint
  - typecheck
  - test
  - build

### Monitoring

- Sentry
- Structured logs
- Analytics events
- Admin-facing operational logs
- Payment event logs

---

## 8. Payment Strategy

The platform must support:

1. Card payments:
   - Visa
   - Mastercard
   - Apple Pay later if gateway supports it

2. Jordan payment options:
   - CliQ
   - QR payment route later if supported by merchant/acquirer
   - Manual proof flow in MVP only if direct integration is not ready

Important implementation decision:
- Build a provider abstraction:
  - `PaymentProvider`
  - `PaymentIntent`
  - `PaymentTransaction`
  - `PaymentWebhookEvent`
- Do not hardcode one gateway into business logic.

Potential providers to evaluate:
- PayTabs Jordan
- Tap Payments Jordan
- HyperPay
- MEPS / bank gateway
- Capital Bank ecommerce gateway
- Network International
- Any licensed local merchant acquirer that can support CliQ/QR/payment acceptance

### Payment states

```txt
payment_pending
payment_authorized
payment_paid
payment_failed
payment_cancelled
payment_refund_pending
payment_refunded
payment_partially_refunded
```

### Booking/payment relation

Booking should not become fully confirmed before payment requirements are met.

Possible payment models:
- Full payment online
- Deposit online + remaining amount at check-in
- Deposit online + remaining amount through platform before check-in
- VIP wallet/credits later

### Escrow-like wording caution

Do not claim legal escrow unless legally supported.
Use safer product wording:
- Protected payment
- Platform-held booking deposit
- Payment protection
- حجز محمي
- عربون مضمون عبر المنصة

### CliQ MVP approach

If direct CliQ merchant integration is not available yet:
- Generate booking reference.
- Show platform CliQ alias/QR/instructions.
- User uploads payment proof or enters transaction reference.
- Admin verifies payment manually.
- Booking remains `payment_review` until verified.

Later:
- Integrate via bank/merchant acquirer/provider.
- Use webhook or reconciliation API.
- Auto-confirm payment when provider confirms.

---

## 9. Business Model

Main revenue:
- Commission on each booking.

Additional revenue:
- Featured listings
- Boosted search placement
- Add-on service commission
- Owner subscription for advanced tools
- VIP user subscription
- Photography/verification package
- Seasonal campaign packages

Suggested MVP commission:
- Configurable per listing or global setting.
- Do not hardcode a percentage.
- Admin can adjust commission in settings later.

---

## 10. Product Differentiators

Must appear clearly in homepage and product pages:

1. Verified listings
2. Real reviews
3. Secure booking
4. Live availability
5. Platform-only deals
6. Add-on services
7. Rewards points
8. Bilingual experience
9. Family/youth suitability filters
10. Support and dispute process

---

## 11. MVP Scope

### MVP Goal

Launch a high-quality web platform that allows users to search, compare, and request/confirm bookings for recreational farms/chalets in Jordan, with owner dashboard and admin moderation.

### MVP must include

Public:
- Home page
- Search/listings page
- Listing details page
- Authentication
- Booking checkout/request flow
- Favorites
- Reviews visible
- Bilingual Arabic/English
- Responsive mobile-first design

Guest:
- Profile
- My bookings
- Booking details
- Payment status
- Review after completed booking
- Rewards points placeholder

Owner:
- Owner onboarding
- Owner dashboard
- Create/edit listing
- Manage calendar
- Manage pricing
- View bookings
- Accept/decline if not instant booking
- View payout status
- Listing quality checklist

Admin:
- One role: `admin`
- Admin dashboard
- Manage users
- Manage owners
- Approve/reject listings
- Verify media
- Manage bookings
- Manage payments
- Manage disputes
- Manage reviews
- Manage amenities/categories/locations
- Manage coupons
- Manage platform settings
- Audit logs

Payments:
- Payment abstraction
- Card provider placeholder
- CliQ manual review flow if no direct integration
- Admin payment verification
- Refund/dispute placeholder

Security:
- Auth
- RBAC
- Rate limits
- Input validation
- Audit logs
- Upload restrictions
- CSP/Helmet
- Secure env

Quality:
- Seed demo data
- Tests for booking conflict logic
- Tests for authorization
- Basic E2E test for search → listing → booking request

---

## 12. Not MVP / Later

Do not implement these in first build unless core MVP is done:

- Native mobile app
- Real-time chat with heavy moderation
- AI recommendations
- Smart pricing
- Split payment between friends
- Full wallet system
- Owner mobile app
- Advanced fraud detection
- 360-degree media viewer if no real media available
- Loyalty marketplace
- Direct bank payout automation
- Multi-country expansion

---

## 13. Key User Journeys

### 13.1 Guest search and booking

1. User opens homepage.
2. Searches by location, date, guests, and property type.
3. Uses filters:
   - families
   - youth
   - pool
   - heated pool
   - indoor pool
   - football field
   - overnight
   - BBQ
   - price
   - capacity
4. Opens listing.
5. Sees verified photos, amenities, calendar, rules, reviews.
6. Selects date and time slot.
7. Chooses add-ons.
8. Logs in or creates account.
9. Accepts rules and cancellation policy.
10. Pays deposit/full amount.
11. Receives confirmation.
12. Exact location and arrival instructions become visible.
13. After stay, user can review.

### 13.2 Owner onboarding

1. Owner creates account.
2. Applies as owner.
3. Adds identity/business info.
4. Adds property details.
5. Uploads media.
6. Sets location approximate/exact.
7. Adds amenities/rules.
8. Sets availability and pricing.
9. Submits listing for review.
10. Admin approves listing.
11. Listing becomes public.

### 13.3 Admin approval

1. Admin sees pending listings.
2. Checks title, description, media, location, price, rules.
3. Approves, rejects, or requests changes.
4. All actions are audit logged.

### 13.4 Payment verification for CliQ manual MVP

1. User chooses CliQ.
2. System creates booking with `payment_review`.
3. System shows payment instructions and unique booking reference.
4. User uploads proof/reference.
5. Admin verifies.
6. Booking becomes confirmed.
7. Owner receives notification.

---

## 14. Main Pages

### Public pages

1. `/`
   - Premium hero
   - Search box
   - Trust badges
   - Featured verified listings
   - Platform-only deals
   - Categories
   - How it works
   - Owner CTA
   - FAQ

2. `/search`
   - Search results
   - Map/list view
   - Filters drawer
   - Sorting
   - Listing cards
   - Skeleton loading
   - Empty state

3. `/properties/[slug]`
   - Gallery
   - Verification badges
   - Title/location summary
   - Rating/reviews
   - Amenities
   - Rules
   - Availability calendar
   - Pricing
   - Add-ons
   - Booking panel
   - Reviews
   - Similar listings

4. `/become-owner`
   - Owner value proposition
   - Benefits
   - Commission explanation
   - Onboarding CTA
   - FAQ

5. `/help`
6. `/terms`
7. `/privacy`
8. `/cancellation-policy`

### Auth pages

- `/login`
- `/signup`
- `/forgot-password` if platform-owned auth
- `/verify` if OTP/email verification exists

### Guest dashboard

- `/dashboard`
- `/dashboard/bookings`
- `/dashboard/bookings/[id]`
- `/dashboard/favorites`
- `/dashboard/rewards`
- `/dashboard/profile`

### Owner dashboard

- `/owner`
- `/owner/listings`
- `/owner/listings/new`
- `/owner/listings/[id]/edit`
- `/owner/calendar`
- `/owner/bookings`
- `/owner/earnings`
- `/owner/reviews`
- `/owner/settings`

### Admin dashboard

- `/admin`
- `/admin/users`
- `/admin/owners`
- `/admin/properties`
- `/admin/properties/pending`
- `/admin/bookings`
- `/admin/payments`
- `/admin/disputes`
- `/admin/reviews`
- `/admin/amenities`
- `/admin/locations`
- `/admin/coupons`
- `/admin/settings`
- `/admin/audit-logs`

---

## 15. Design Direction

### Design goal

The design must feel:
- Premium
- Clean
- Trustworthy
- Jordan/local-market friendly
- Modern marketplace
- Mobile-first
- Not childish
- Not generic Tailwind template
- Not a cheap real-estate website

### Visual references to think about, not copy blindly

Use quality level inspired by:
- Airbnb clarity
- Booking.com conversion logic
- Talabat marketplace confidence
- Luxury resort websites
- Modern SaaS dashboards
- Apple-like spacing
- Premium travel editorial layouts

### Theme

Light theme only in MVP.

Suggested palette:
- Background: warm white / ivory
- Surface: pure white
- Primary: deep emerald or teal
- Accent: soft gold / sand
- Text: near-black charcoal
- Muted text: warm gray
- Borders: soft sand/gray
- Success: emerald
- Warning: amber
- Danger: red

Do not use harsh neon colors.

### Typography

Arabic:
- Use a modern Arabic font such as IBM Plex Sans Arabic, Tajawal, or Cairo.
- Clear hierarchy.
- Avoid tiny Arabic text.

English:
- Inter or similar.

### Layout style

- Large hero with search panel.
- Premium cards with strong image treatment.
- Rounded corners: 20–28px where appropriate.
- Soft shadows, not heavy black shadows.
- Lots of spacing.
- Clear sections.
- Sticky booking panel on listing details desktop.
- Bottom booking CTA on mobile.
- Filter drawer on mobile.
- Map/list split on desktop search if map is enabled.
- Dashboard with clean sidebar and cards.

### Motion

Use Framer Motion only for:
- Hero entrance
- Card hover
- Filter drawer
- Modal transitions
- Step transitions
- Subtle loading states

Do not animate everything.

### Listing card requirements

Each card must show:
- High-quality image or premium fallback if no image
- Verification badge if verified
- Location
- Rating
- Capacity
- Key amenities
- Price starting from
- Date availability hint
- Platform-only deal badge if available
- Favorite button
- Clear CTA

Do not show owner phone.
Do not show exact address.

### Empty image fallback

If no real image exists:
- Do not use a gray empty rectangle.
- Use a premium illustrated/patterned placeholder with gradients, amenity icons, and property type label.
- But production listings should require real media before approval.

### Homepage hero concept

Hero should communicate:
- Search farms/chalets in Jordan
- Verified, trusted, easy booking
- Date/location/guests search
- Strong visual layout
- Trust badges:
  - Verified photos
  - Secure booking
  - Real reviews
  - Platform-only deals

Example Arabic headline:
"احجز مزرعة أو شاليه خاص في الأردن بثقة"

Example English headline:
"Book verified private farms and chalets in Jordan"

Arabic subheadline:
"صور حقيقية، توافر واضح، دفع آمن، وتقييمات من زبائن حقيقيين."

English subheadline:
"Real media, live availability, protected payments, and reviews from real guests."

---

## 16. Internationalization

The site must support:
- Arabic
- English

Approach:
- Use route prefixes:
  - `/ar`
  - `/en`
- Arabic is RTL.
- English is LTR.
- Never hardcode user-facing strings inside components.
- Use translation files:
  - `messages/ar.json`
  - `messages/en.json`

Important:
- Property content may need bilingual fields:
  - titleAr/titleEn
  - descriptionAr/descriptionEn
  - rulesAr/rulesEn
  - area names
  - amenities labels

Fallback:
- If English content is missing, show Arabic with a clear fallback only if acceptable.
- Admin should see missing translation warnings.

---

## 17. Database Model Draft

Use Prisma. This is conceptual. Cursor should refine into `schema.prisma`.

### Enums

```txt
UserRole:
  guest_user
  owner
  admin

UserStatus:
  active
  suspended
  deleted

OwnerStatus:
  pending
  approved
  rejected
  suspended

PropertyStatus:
  draft
  pending_review
  changes_requested
  approved
  published
  unpublished
  suspended
  rejected

VerificationStatus:
  unverified
  owner_uploaded
  platform_reviewed
  platform_verified

BookingStatus:
  draft
  pending_payment
  payment_review
  confirmed
  owner_action_required
  cancelled_by_guest
  cancelled_by_owner
  cancelled_by_admin
  completed
  disputed
  no_show

PaymentStatus:
  pending
  authorized
  paid
  failed
  cancelled
  review_required
  refund_pending
  refunded
  partially_refunded

PaymentMethod:
  card
  cliq
  bank_transfer
  wallet
  cash_remaining

ReviewStatus:
  pending
  published
  hidden
  rejected

DisputeStatus:
  open
  under_review
  waiting_for_guest
  waiting_for_owner
  resolved_refund
  resolved_partial_refund
  resolved_no_refund
  closed

MediaType:
  image
  video
  virtual_tour

PropertyType:
  farm
  chalet
  villa
  istiraha
  private_resort
  pool_house
```

### Main tables

#### User

Fields:
- id
- name
- email
- phone
- passwordHash if platform-owned auth
- externalAuthProvider if using Clerk/Auth provider
- externalAuthId
- role
- status
- locale
- createdAt
- updatedAt

#### OwnerProfile

Fields:
- id
- userId
- displayName
- businessName
- nationalId/company docs reference later
- phone
- payoutPreference
- status
- rejectionReason
- createdAt
- updatedAt

#### Property

Fields:
- id
- ownerId
- slug
- type
- titleAr
- titleEn
- descriptionAr
- descriptionEn
- city
- area
- approximateAddress
- exactAddressEncrypted or exactAddress hidden until booking
- latitudeApprox
- longitudeApprox
- latitudeExact
- longitudeExact
- capacity
- bedrooms
- bathrooms
- poolsCount
- hasIndoorPool
- hasHeatedPool
- hasFootballField
- allowsFamilies
- allowsYouth
- allowsMixedGroups
- allowsEvents
- allowsOvernight
- checkInTime
- checkOutTime
- status
- verificationStatus
- instantBookingEnabled
- basePrice
- currency
- cleaningFee
- serviceFeeMode
- cancellationPolicyId
- createdAt
- updatedAt

#### PropertyMedia

Fields:
- id
- propertyId
- type
- url
- thumbnailUrl
- altAr
- altEn
- sortOrder
- verificationStatus
- uploadedByUserId
- reviewedByAdminId
- createdAt

#### Amenity

Fields:
- id
- key
- labelAr
- labelEn
- icon
- category
- isActive

#### PropertyAmenity

Fields:
- propertyId
- amenityId

#### PropertyRule

Fields:
- id
- propertyId
- titleAr
- titleEn
- descriptionAr
- descriptionEn
- isRequired
- createdAt

#### AvailabilitySlot

Fields:
- id
- propertyId
- date
- startTime
- endTime
- status: available/blocked/booked/maintenance
- priceOverride
- minDeposit
- note
- createdAt
- updatedAt

#### Booking

Fields:
- id
- publicCode
- userId
- propertyId
- ownerId
- date
- startTime
- endTime
- guestsCount
- baseAmount
- addOnsAmount
- cleaningFee
- platformFee
- discountAmount
- totalAmount
- depositAmount
- remainingAmount
- currency
- status
- paymentStatus
- cancellationPolicySnapshot
- rulesAcceptedAt
- exactLocationUnlockedAt
- createdAt
- updatedAt

#### BookingAddOn

Fields:
- id
- bookingId
- addOnServiceId
- quantity
- unitPrice
- totalPrice

#### AddOnService

Fields:
- id
- nameAr
- nameEn
- descriptionAr
- descriptionEn
- basePrice
- category
- isPlatformProvided
- ownerId optional
- isActive

#### PaymentTransaction

Fields:
- id
- bookingId
- userId
- provider
- method
- amount
- currency
- status
- providerReference
- idempotencyKey
- checkoutUrl
- proofUrl for manual CliQ flow
- adminVerifiedById
- verifiedAt
- failureReason
- rawProviderPayload JSON
- createdAt
- updatedAt

#### Review

Fields:
- id
- bookingId
- userId
- propertyId
- ratingOverall
- ratingCleanliness
- ratingPool
- ratingPrivacy
- ratingAccuracy
- ratingValue
- ratingOwner
- comment
- status
- createdAt

#### Favorite

Fields:
- userId
- propertyId
- createdAt

#### Coupon

Fields:
- id
- code
- type
- value
- maxDiscount
- startsAt
- endsAt
- usageLimit
- perUserLimit
- isActive

#### RewardLedger

Fields:
- id
- userId
- bookingId
- points
- type
- description
- expiresAt
- createdAt

#### Conversation

Fields:
- id
- bookingId optional
- propertyId
- guestId
- ownerId
- status
- createdAt

#### Message

Fields:
- id
- conversationId
- senderId
- body
- blockedForContactSharing boolean
- createdAt

#### Dispute

Fields:
- id
- bookingId
- openedByUserId
- status
- reason
- description
- resolution
- refundAmount
- createdAt
- updatedAt

#### AuditLog

Fields:
- id
- actorUserId
- action
- entityType
- entityId
- metadata JSON
- ip
- userAgent
- createdAt

#### PlatformSetting

Fields:
- key
- value JSON
- updatedByAdminId
- updatedAt

---

## 18. Booking Conflict Rules

This is critical.

When creating a booking:
1. Validate property is published.
2. Validate selected slot/date is available.
3. Validate capacity.
4. Validate property rules.
5. Calculate price server-side only.
6. Create booking in transaction.
7. Lock slot or mark it as reserved/pending payment.
8. Create payment intent.
9. If payment fails or expires, release slot.
10. If payment succeeds, confirm booking.

Need expiration:
- Pending payment booking expires after configurable minutes, e.g. 15 minutes for card checkout.
- CliQ manual review may have longer expiration, e.g. 1 hour or configurable.

Indexes:
- propertyId + date + startTime + endTime
- booking status filters
- prevent overlapping confirmed bookings at application and DB logic level.

---

## 19. API Design Draft

Base:
`/api/v1`

### Public

```txt
GET /health
GET /locations
GET /amenities
GET /properties
GET /properties/:slug
GET /properties/:id/availability
GET /properties/:id/reviews
```

### Auth

Depends on auth provider.

If Express-owned auth:
```txt
POST /auth/signup
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET /auth/me
```

If Clerk:
```txt
GET /auth/me
POST /auth/sync-user
```

### Guest

```txt
GET /me
PATCH /me
GET /me/bookings
GET /me/bookings/:id
POST /me/bookings
POST /me/bookings/:id/cancel
POST /me/bookings/:id/review
GET /me/favorites
POST /me/favorites/:propertyId
DELETE /me/favorites/:propertyId
GET /me/rewards
```

### Booking/payment

```txt
POST /bookings/:id/payments/card/create-intent
POST /bookings/:id/payments/cliq/submit-proof
GET /bookings/:id/payments
POST /payments/webhooks/:provider
```

### Owner

```txt
GET /owner/profile
POST /owner/apply
PATCH /owner/profile
GET /owner/dashboard
GET /owner/properties
POST /owner/properties
PATCH /owner/properties/:id
POST /owner/properties/:id/submit-review
GET /owner/properties/:id/calendar
PUT /owner/properties/:id/calendar
GET /owner/bookings
GET /owner/bookings/:id
POST /owner/bookings/:id/accept
POST /owner/bookings/:id/decline
GET /owner/earnings
GET /owner/reviews
```

### Admin

```txt
GET /admin/dashboard
GET /admin/users
PATCH /admin/users/:id/status
GET /admin/owners
PATCH /admin/owners/:id/approve
PATCH /admin/owners/:id/reject
GET /admin/properties
PATCH /admin/properties/:id/approve
PATCH /admin/properties/:id/reject
PATCH /admin/properties/:id/request-changes
PATCH /admin/properties/:id/suspend
GET /admin/bookings
GET /admin/payments
POST /admin/payments/:id/verify
POST /admin/payments/:id/reject
GET /admin/disputes
PATCH /admin/disputes/:id
GET /admin/reviews
PATCH /admin/reviews/:id/status
GET /admin/audit-logs
GET /admin/settings
PATCH /admin/settings
```

---

## 20. Authorization Matrix

| Action | guest_user | owner | admin |
|---|---:|---:|---:|
| Search listings | Yes | Yes | Yes |
| Book property | Yes | Yes, as guest if allowed | Yes |
| Review after booking | Yes | Yes if booked | Yes |
| Create listing | No | Yes | Yes |
| Edit own listing | No | Yes | Yes |
| Edit any listing | No | No | Yes |
| Approve listings | No | No | Yes |
| View own bookings | Yes | Yes for owned properties | Yes |
| Manage payments | Own only | Own property summary only | Yes |
| Manage users | No | No | Yes |
| Manage settings | No | No | Yes |

Important:
- Owners cannot access other owners' data.
- Admin can access everything.
- Do not create moderator/support/finance roles in MVP.

---

## 21. Search and Filter Requirements

Filters:
- Location/city/area
- Date
- Guests count
- Price range
- Property type
- Families allowed
- Youth allowed
- Mixed groups allowed
- Overnight allowed
- Events allowed
- Pool
- Indoor pool
- Heated pool
- Kids pool
- Football field
- Volleyball field
- BBQ
- Bedrooms
- Bathrooms
- Rating
- Verified only
- Platform deals
- Instant booking
- Add-ons available

Sorting:
- Recommended
- Price low to high
- Price high to low
- Highest rated
- Newest
- Most booked
- Deals first
- Distance if location permission exists

Search SEO terms:
- مزارع عمان
- مزارع جرش
- شاليهات الأردن
- استراحات مع مسبح
- مزارع للعائلات
- مزارع للشباب
- chalets in Jordan
- private pool Jordan
- farms for rent Jordan

---

## 22. Admin Quality Checklist for Listing Approval

A listing cannot be published unless:

- Has Arabic title and description.
- Has location area.
- Has approximate location.
- Has capacity.
- Has clear pricing.
- Has at least 5 real images.
- Has rules.
- Has cancellation policy.
- Has availability/pricing configured.
- Has owner approved.
- Does not expose phone/WhatsApp in description/images.
- Does not include external contact instructions.
- Media is reviewed.
- Admin approval recorded in audit log.

---

## 23. Anti Off-Platform Leakage

MVP:
- Do not show owner phone before booking.
- Do not show exact address before booking.
- Do not allow WhatsApp CTA before booking.
- Use internal messaging/request flow.
- Hide contact fields from public listing.
- Admin can detect obvious phone numbers in listing text manually or via regex.

Later:
- Message moderation for phone/email/social links.
- Policy warnings.
- Owner score penalties.
- Benefits only available through platform:
  - rewards
  - support
  - reviews
  - protected payment
  - refunds
  - coupons

---

## 24. Notifications

MVP channels:
- Email
- In-app notifications

Later:
- WhatsApp Business API
- SMS
- Push notifications

Notification events:
- Booking created
- Payment pending
- Payment confirmed
- CliQ proof submitted
- Admin verified payment
- Owner accepted/declined
- Booking reminder
- Review request
- Dispute update
- Listing approved/rejected
- Owner payout update

---

## 25. Environment Variables Draft

```env
# App
NODE_ENV=
APP_URL=
API_URL=
FRONTEND_URL=
DEFAULT_LOCALE=ar

# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Auth - choose provider
AUTH_PROVIDER=clerk
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SECRET=

# If platform-owned auth later
SESSION_SECRET=
JWT_SECRET=

# Uploads
UPLOAD_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Payments
PAYMENT_PROVIDER=
PAYMENT_WEBHOOK_SECRET=
PAYMENT_RETURN_URL=
PAYMENT_CANCEL_URL=

# CliQ manual or provider integration
CLIQ_MODE=manual
CLIQ_ALIAS=
CLIQ_DISPLAY_NAME=
CLIQ_INSTRUCTIONS=

# Security
CORS_ORIGIN=
RATE_LIMIT_REDIS_PREFIX=
CSP_REPORT_URI=

# Monitoring
SENTRY_DSN=
LOG_LEVEL=info
POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

---

## 26. Analytics Events

Track:
- Homepage search submitted
- Listing card clicked
- Filter used
- Favorite added
- Booking checkout started
- Payment method selected
- Payment succeeded
- Payment failed
- CliQ proof submitted
- Booking confirmed
- Booking cancelled
- Review submitted
- Owner signup started
- Owner listing submitted
- Listing approved
- Search no results

Do not collect sensitive data unnecessarily.

---

## 27. Testing Plan

### Unit tests

- Price calculation
- Commission calculation
- Coupon logic
- Booking conflict detection
- Cancellation policy calculation
- Role authorization guards
- Zod validation schemas

### Integration tests

- Create booking
- Prevent double booking
- Payment webhook idempotency
- CliQ manual verification
- Owner cannot access another owner listing
- Guest cannot review without completed booking
- Admin approval flow

### E2E tests

1. Search property.
2. Open listing.
3. Start booking.
4. Login.
5. Select payment method.
6. Submit booking.
7. Admin verifies payment in manual flow.
8. Booking becomes confirmed.

---

## 28. Seed Data

Create realistic demo data:
- 10 properties in Jordan
- Arabic and English content
- Different property types
- Different cities
- Different amenities
- Different price ranges
- Some verified, some unverified
- Some family-only, some youth-friendly
- Some with add-ons
- Reviews for completed bookings

Do not use agricultural farm language.

---

## 29. First Implementation Phases for Cursor

### Phase 1 — Foundation

- Setup monorepo
- Setup Next.js app
- Setup Express API
- Setup Prisma + Neon
- Setup shared package
- Setup Tailwind + shadcn/ui
- Setup i18n routes
- Setup ESLint/Prettier/TypeScript strict
- Setup basic CI
- Add env examples

### Phase 2 — Database + Auth + RBAC

- Prisma schema
- Migrations
- Seed data
- Auth integration
- Roles: guest_user, owner, admin
- Authorization middleware
- Audit log foundation

### Phase 3 — Public Marketplace

- Home page
- Search page
- Listing cards
- Property details page
- Availability display
- Bilingual UI
- Responsive design

### Phase 4 — Booking Core

- Booking creation
- Availability conflict prevention
- Price calculation
- Pending payment expiration
- Booking dashboard

### Phase 5 — Payments

- Payment provider abstraction
- Card payment placeholder/provider integration
- CliQ manual proof flow
- Admin payment verification
- Payment logs/webhook structure

### Phase 6 — Owner Dashboard

- Owner onboarding
- Listing CRUD
- Media upload
- Calendar/pricing
- Booking management

### Phase 7 — Admin Dashboard

- Manage users/owners/properties/bookings/payments
- Approve listings
- Verify media
- Review moderation
- Disputes
- Settings
- Audit logs

### Phase 8 — Quality + Launch Readiness

- Tests
- Security checks
- Performance optimization
- SEO
- Error monitoring
- Staging deployment checklist
- Manual QA checklist

---

## 30. Cursor Prompt to Start the Project

Use this prompt after placing this file in the project root as `PROJECT_BRIEF_CURSOR.md`:

```txt
Read PROJECT_BRIEF_CURSOR.md fully before coding.

I want you to create the foundation for this project as a professional monorepo.

Use:
- Next.js App Router + React + TypeScript for apps/web
- Express.js + TypeScript for apps/api
- Prisma + Neon PostgreSQL for database
- Tailwind CSS + shadcn/ui for design
- Arabic/English i18n from the start
- Single admin role named admin
- Roles: guest_user, owner, admin
- No direct owner phone/exact address shown before confirmed booking

Start with Phase 1 only:
- create the monorepo structure
- configure TypeScript strict
- configure ESLint/Prettier
- setup frontend layout with premium light theme foundation
- setup Express API health route
- setup Prisma package with initial placeholder
- add env examples
- add README with run commands
- do not implement payments yet
- do not implement full database schema yet unless needed for foundation

After implementation, run lint/typecheck/build if possible and give me a report:
1. files created/changed
2. what was implemented
3. what was not implemented
4. next recommended phase
```

---

## 31. Cursor UI Prompt for the Design System

Use this prompt when asking Cursor to design the UI:

```txt
Read PROJECT_BRIEF_CURSOR.md, especially the Design Direction section.

I want a premium light-theme marketplace design for a Jordan recreational farms/chalets booking platform.

Do not create a generic Tailwind layout.
Do not create basic white cards only.
Do not use childish gradients or random colors.

Design requirements:
- Arabic and English ready
- RTL/LTR support
- Warm white/ivory background
- Deep emerald or teal primary color
- Soft gold/sand accent
- Charcoal text
- Large spacing
- Premium rounded cards
- Soft shadows
- Modern search panel
- Trust badges
- Verified listing badges
- High-quality image treatment
- Beautiful fallback card if image is missing
- Mobile-first
- Sticky booking panel on desktop listing page
- Bottom CTA on mobile
- Smooth but subtle Framer Motion

Build reusable components:
- HeroSearch
- TrustBadges
- PropertyCard
- VerifiedBadge
- PriceDisplay
- AmenityPills
- FilterDrawer
- BookingPanel
- SectionHeader
- EmptyState
- DashboardStatCard

Make the UI look like a serious premium marketplace, closer to Airbnb/Booking/luxury travel/SaaS quality, not a simple directory website.
```

---

## 32. Copywriting Samples

### Arabic homepage

Headline:
احجز مزرعة أو شاليه خاص في الأردن بثقة

Subheadline:
اكتشف مزارع وشاليهات موثقة بصور حقيقية، توافر واضح، دفع آمن، وتقييمات من زبائن حقيقيين.

Trust bullets:
- صور وفيديوهات موثقة
- حجز مضمون
- تقييمات بعد الحجز فقط
- عروض خاصة داخل المنصة

CTA:
- ابحث الآن
- أضف مزرعتك

### English homepage

Headline:
Book verified private farms and chalets in Jordan

Subheadline:
Discover trusted stays with real media, live availability, protected payments, and reviews from real guests.

Trust bullets:
- Verified photos and videos
- Protected booking
- Reviews from real bookings only
- Platform-only deals

CTA:
- Search now
- List your property

---

## 33. Critical Success Factors

This project succeeds if it delivers:

1. Trust
2. Real availability
3. Strong design
4. Smooth booking
5. Better in-platform value
6. Owner supply
7. Reliable payment flow
8. Good support
9. Verified reviews
10. SEO for Arabic search terms

The technical implementation matters, but the business moat is:
- protected booking
- verified media
- real reviews
- platform-only discounts
- add-on services
- rewards
- owner tools

---

## 34. Final Reminder to Cursor

Do not treat this as a simple property listing app.

Build it as a trust-based booking marketplace for Jordan, where every product decision answers this question:

> Why would the guest book through us instead of calling the owner directly?

And every owner feature answers this question:

> Why would the owner prefer platform bookings instead of unmanaged WhatsApp bookings?

If a feature does not strengthen trust, booking conversion, owner value, or platform retention, it is not MVP priority.
