# Property media providers (Phase 8A / 8B)

Mazare3 supports optional storage backends for owner property gallery uploads. The API surface (`POST /owner/properties/:id/media`, etc.) is the same regardless of provider.

## Providers

| `MEDIA_PROVIDER` | Status | Use case |
|------------------|--------|----------|
| `local` (default) | Active | Developer machines, QA, trials without Cloudinary |
| `cloudinary` | Active (Phase 8B) | Hosted images when env credentials are set |
| `s3` | Placeholder | Not implemented yet |

## Environment variables

```env
MEDIA_PROVIDER=local
MAX_UPLOAD_SIZE_MB=8
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp

# Only when MEDIA_PROVIDER=cloudinary:
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- Never put secrets in code or `NEXT_PUBLIC_*`.
- Never commit real `.env` values to Git.

If `MEDIA_PROVIDER=cloudinary` and any Cloudinary variable is missing, file uploads return **`CLOUDINARY_NOT_CONFIGURED`** (HTTP 503).

## Upload rules

- **Who:** Approved owners only (`OWNER_NOT_APPROVED` otherwise).
- **Types:** JPEG, PNG, WebP only (no SVG).
- **Size:** `MAX_UPLOAD_SIZE_MB` per file (multer limit).
- **Count:** Up to 12 images per property.

### Stored fields (`PropertyMedia`)

| Field | Local | Cloudinary | URL import |
|-------|-------|------------|------------|
| `url` | `/uploads/property-media/...` | `https://res.cloudinary.com/...` | External URL |
| `storageKey` | Relative file path | Cloudinary `public_id` | `null` |
| `type` | `image` | `image` | `image` |
| `altAr` / `altEn` | Optional | Optional | Optional |
| `sortOrder` | `0` = cover | `0` = cover | `0` = cover |

## Delete behavior

1. Load media row from DB.
2. If `storageKey` is set (file upload via local or Cloudinary), attempt remote delete:
   - **Local:** remove file under `uploads/property-media/`.
   - **Cloudinary:** `destroy(public_id)` best-effort.
3. Always delete the DB row and re-pack `sortOrder`.

**External URL media** (`storageKey` null) only removes the DB record — nothing is deleted from Cloudinary.

If Cloudinary delete fails (network, already removed), the API **still deletes the DB record** and logs a safe error (no secrets in logs).

## QA

- `pnpm qa:media` — full media API QA on **`MEDIA_PROVIDER=local`** (no Cloudinary keys required).
- Config check (no network): `pnpm qa:media` includes Cloudinary misconfiguration test via compiled API helpers.

## Switching providers

1. Set `MEDIA_PROVIDER` and provider credentials in `.env`.
2. Restart API.
3. New uploads use the active provider. Existing rows keep their original `url` / `storageKey`.
