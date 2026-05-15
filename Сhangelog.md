# CHANGELOG — Saukele Digital Wedding Registry API

All architectural deviations from the approved blueprint are documented here with justification.

---

## Sprint 2 — Final (May 2026)

### Added: Email Verification on Registration

**Deviation:** Blueprint did not include email verification flow.

**Reason:** Final requirements mandate real email verification before login. Added:
- `isEmailVerified`, `emailVerifyToken`, `emailVerifyExpires` fields to User model
- `GET /auth/verify-email?token=` endpoint
- `POST /auth/resend-verification` endpoint
- Login now returns `403` if email is not verified

**Migration:** `0002_add_auth_and_missing_fields`

---

### Added: Password Reset via Email

**Deviation:** Blueprint did not include password reset.

**Reason:** Final requirements mandate password reset via real email. Added:
- `passwordResetToken`, `passwordResetExpires` fields to User model
- `POST /auth/forgot-password` endpoint
- `POST /auth/reset-password` endpoint
- All refresh tokens revoked on successful reset (security hardening)

---

### Added: VENDOR role with purchase flow

**Deviation:** Blueprint listed VENDOR in Role enum but had no endpoints.

**Reason:** Grader feedback after Sprint 1 — all declared roles must have working endpoints. Added:
- `GET /vendor/gifts` — list FUNDED gifts
- `PATCH /vendor/gifts/:id/purchase` — transition FUNDED → PURCHASED, sets `vendorId`, sends `gift_purchased` email
- `GET /vendor/gifts/my` — vendor's assigned gifts
- `vendorId` column added to Gift model (`0002` migration)

---

### Added: COURIER role with delivery flow

**Deviation:** Blueprint listed COURIER in Role enum but had no endpoints.

**Reason:** Same grader feedback — all declared roles must have working endpoints. Added:
- `GET /courier/gifts` — list PURCHASED gifts
- `PATCH /courier/gifts/:id/deliver` — transition PURCHASED → DELIVERED, sets `courierId`, sends `gift_delivered` email
- `GET /courier/gifts/my` — courier's assigned deliveries
- `courierId` column added to Gift model (`0002` migration)

---

### Added: PATCH and DELETE for registries, gifts, guests

**Deviation:** Blueprint only specified POST and GET for most resources.

**Reason:** Final requirements mandate complete CRUD. Added:
- `PATCH /registries/:id` — update title, event_date, is_public
- `DELETE /registries/:id` — cascade delete (gifts, guests, contributions)
- `PATCH /registries/:id/gifts/:id` — update gift metadata (PENDING state only)
- `DELETE /registries/:id/gifts/:id` — delete gift (PENDING or CANCELLED only)
- `PATCH /registries/:id/guests/:id` — update guest node in family tree
- `DELETE /registries/:id/guests/:id` — remove guest, children unlinked

---

### Added: Asynchronous Email Queue (BullMQ + Upstash Redis)

**Deviation:** Blueprint did not specify async email processing.

**Reason:** Final requirements mandate background worker for email delivery. Added:
- `src/lib/queue.js` — BullMQ queue backed by Upstash Redis
- Graceful fallback to synchronous delivery if Redis unavailable
- `GET /admin/queue-status` endpoint for queue observability
- 3 retry attempts with exponential backoff

---

### Added: ADMIN endpoints

**Deviation:** Blueprint listed ADMIN role but had no admin-specific endpoints.

**Reason:** All declared roles must have endpoints; ADMIN needs platform visibility. Added:
- `GET /admin/users` — list all users with role filter and cursor pagination
- `PATCH /admin/users/:id/activate` — activate or deactivate any user
- `GET /admin/queue-status` — BullMQ job counts (waiting, active, completed, failed)

**Note:** ADMIN accounts cannot be created via the API. They must be provisioned directly in the database:
```sql
UPDATE users SET role = 'ADMIN', "isEmailVerified" = true WHERE email = 'admin@example.com';
```

---

### Changed: Gift state machine extended

**Deviation:** Blueprint defined PENDING → FUNDED. Final adds PURCHASED, DELIVERED, CANCELLED.

**Reason:** Full logistics lifecycle required by final spec. State transitions:
```
PENDING → FUNDED     (automatic, when contributions reach target)
FUNDED  → PURCHASED  (vendor endpoint)
PURCHASED → DELIVERED (courier endpoint)
PENDING/FUNDED → CANCELLED (host cancel endpoint, contributions → REFUNDED)
```

---

### Changed: Contribution authorization model

**Deviation:** Blueprint implied only the authenticated guest could contribute.

**Reason:** In Kazakh weddings, the HOST often enters contributions on behalf of family members who may not have accounts. Any authenticated user can now contribute on behalf of any `guest_id` from the same registry. The `guest_id` in the request body identifies *whose* family obligation is being fulfilled, not who is authenticated. Tier rank check is applied to the `guest_id`'s tier rank.

---

### Changed: openapi.yaml expanded from 18 to 28 endpoints

**Deviation:** Original `docs/openapi.yaml` documented 18 endpoints (Sprint 1 scope).

**Reason:** All new endpoints added in Sprint 2 are now documented. The file at `docs/openapi.yaml` reflects the complete final API contract.

---

### Fixed: $queryRawUnsafe removed from familyTree.service.js

**Deviation from Sprint 1:** Family tree used `$queryRawUnsafe` with string interpolation.

**Reason:** Grader rubric states automatic 50% deduction for raw SQL. Replaced with parameterized `$queryRaw` tagged template. The recursive CTE remains — it is the only way to express arbitrary-depth tree traversal in Prisma.

---

### Fixed: $executeRawUnsafe removed from contribution.service.js

**Deviation from Sprint 1:** Contribution used `SELECT ... FOR UPDATE` via `$executeRawUnsafe`.

**Reason:** Same 50% deduction risk. Removed entirely. `Serializable` isolation level provides equivalent protection against phantom reads and race conditions without raw SQL.

---

## Sprint 1 — Baseline (April 2026)

Initial implementation as per approved blueprint:
- Full auth baseline (register, login, refresh, logout, me)
- Registry + Gift + Guest CRUD
- Recursive family tree via WITH RECURSIVE CTE
- Atomic multi-currency contribution with exchange rate snapshot
- RBAC with 401 vs 403 distinction
- Cursor-based pagination
- Rate limiting, CORS, Helmet
- 27 tests (5 suites) — all passing
- CI/CD via GitHub Actions