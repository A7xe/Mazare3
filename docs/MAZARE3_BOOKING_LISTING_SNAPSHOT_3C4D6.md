# Mazare3 — Booking Listing Snapshot (Phase 3C.4D.6)

**Status:** Implemented (local/dev). Production untouched.  
**Schema version:** `booking-listing-snapshot-v1`  
**Model:** `BookingPropertySnapshot` (kind = `initial`)

## Purpose

Preserve immutable structured evidence of the Customer-facing Property/listing facts at the moment a **NEW** Booking/request is created:

> What Property/service did the Customer actually request/book?

This is **not** a replacement for the live Property listing. Public Property pages continue to show **current** listing data.

## Schema

| Field | Notes |
| --- | --- |
| `id` | cuid |
| `bookingId` + `kind` | Unique — one `initial` row per Booking |
| `schemaVersion` | `booking-listing-snapshot-v1` |
| `propertyId` | Reference only (no FK cascade rewrite of history) |
| `propertyUpdatedAt` | Property source version at capture |
| `payload` | Canonical JSON (Customer-safe listing facts + gate summaries) |
| `integrityHash` | SHA-256 of canonical JSON — integrity aid, **not** a digital signature |
| `createdAt` | Immutable create timestamp |

Additive migration: `packages/db/prisma/migrations/20260917190000_phase3c4d6_booking_listing_snapshot/`.

Also adds `PropertyMedia.removedFromListingAt` for soft-remove retention.

## Snapshot timing

Server-authoritative sequence inside `createBooking`:

1. Validate Property / pricing / bookability gates (pre-TX)
2. Create Booking (+ financial columns) in TX
3. Persist `BookingPropertySnapshot` **in the same TX**
4. Commit — if snapshot persistence fails, Booking create fails

Not created when opening the Property page. Not supplied by the frontend.

For `pending_owner_approval`, the snapshot captures what the Customer requested at request creation. Owner edits during the approval window do **not** rewrite it. Accepting the request accepts those snapshotted facts.

## Immutable fields (payload v1)

- Property identity: id, slug, type, titles, descriptions, `updatedAt`
- Capacity: capacity, bedrooms, bathrooms, overnight/families/youth/events flags
- Amenities: stable key + labels
- Rules: Customer-facing titles
- Activities: stable activity codes
- Pool/safety: poolsCount, indoor/heated flags, Owner-reported profile, attestation version/time (`depthSource: owner_provided`)
- Safety disclosures: active Customer-facing items
- Location: public area / approximate only (no exact coordinates / arrival instructions)
- Media: mediaId, order, primary, public URL refs (not private storage keys)
- Platform verification status (separate from regulatory)
- Gates: regulatory readiness, authority review status, requirement type/status summaries (no licence files)
- Policy version ids: Terms / Cancellation / Booking Terms / Privacy notice ids (no document bodies; no Owner Agreement)
- `financialRef`: display/reference only — **Booking financial columns + BookingLegalSnapshot remain authoritative**

## Financial snapshot relationship

| Concern | Source of truth |
| --- | --- |
| Amounts, commission %, deposit/balance, coupons | Booking columns / existing financial snapshot |
| Legal financial policy key | BookingLegalSnapshot |
| Listing content evidence | BookingPropertySnapshot |

This phase does **not** recalculate money or change 18%/15%, cancellation, refund, no-show, or settlement logic.

## Media retention

Owner “delete” on live listing → soft-remove (`removedFromListingAt`).

- Live/public Property routes filter `removedFromListingAt: null`
- Snapshot media references remain recoverable for authorised Booking history/evidence
- Object storage is **not** deleted on soft-remove
- Private storage keys are never exposed on Customer/Owner snapshot APIs

## Privacy / retention

Snapshot is contractual/evidentiary Booking data.

- Retention: use existing unresolved retention architecture (`DURATION_REQUIRES_LEGAL_REVIEW` / counsel)
- Do not set a final retention period in this phase
- Privacy Policy text **not** modified
- No KYC, regulatory evidence files, admin notes, or unrelated Owner Personal Data in payload

## Regulatory / authority evidence

Lightweight only:

- readiness result / evaluatedAt
- requirement type + applicability + compliance status codes
- authority review status

**Not** stored: uploaded licences, KYC files, reviewer notes, sensitive document numbers.

## Customer / Owner / Admin rendering

| Surface | Behaviour |
| --- | --- |
| Customer My Bookings | Listing snapshot panel; titles/location prefer snapshot when available |
| Owner bookings | On-demand snapshot of what was accepted/requested |
| Admin bookings | Compare **At time of Booking** vs **Current listing** |
| Public Property page | Current listing only |

Legacy Bookings without a row: `LEGACY_SNAPSHOT_UNAVAILABLE` — never fabricated from current Property.

## Reschedule behaviour

Same-Property date reschedule does **not** overwrite the INITIAL listing snapshot.

There is no different-Property reschedule path that silently replaces the original snapshot.

## Deletion / Property identity

- `Booking.propertyId` uses `onDelete: Restrict` — historical Bookings block destructive Property deletion
- Renaming the live listing affects future Customers only
- Snapshot history is never rewritten by Property updates

## Immutability enforcement

- No PATCH routes for listing snapshots
- Property update / media services do not mutate `BookingPropertySnapshot`
- Unique `(bookingId, kind)` + idempotent create (`if existing return`)
- Optional future corrections must be append-only revisions (not implemented; INITIAL only)

## Locked legal documents

Unchanged:

- Terms / Cancellation / Booking Terms / Privacy `1.1.2-advisor-final`
- Owner Agreement `1.1.1-advisor-final`

## Production

Local/dev only. Do not apply this migration to Production in this phase.
