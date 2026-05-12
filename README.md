# Saukele — Digital Wedding Registry API

A production-grade backend for managing Kazakh wedding gift registries with family tree kinship, multi-currency pool funding, and role-based logistics.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS |
| Framework | Express.js 4.x |
| ORM | Prisma 5.x |
| Database | PostgreSQL 15+ |
| Queue | BullMQ + Upstash Redis |
| Email | Resend API |
| Auth | JWT (access 15m / refresh 7d) + bcrypt |
| Validation | Zod |
| Docs | Swagger UI at `/docs` |
| Tests | Jest + Supertest |

## Quick Start

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 15+
- A free [Resend](https://resend.com) account (email)
- A free [Upstash](https://upstash.com) Redis account (queue)

### 2. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/saukele-backend
cd saukele-backend
npm install
```

### 3. Environment
```bash
cp .env.example .env
# Edit .env with your actual values
```

Required values to fill in:
- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — random 64-char strings
- `RESEND_API_KEY` — from resend.com dashboard
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — from upstash.com

### 4. Database
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Run
```bash
npm run dev       # development with nodemon
npm start         # production
```

Server starts at `http://localhost:3000`  
Swagger UI at `http://localhost:3000/docs`

### 6. Tests
```bash
npm test          # all tests with coverage
npm run test:unit # unit tests only
```

## Architecture

```
Request → Zod validate → requireAuth → requireRole → Service → Repository (Prisma) → PostgreSQL
                                                          ↓
                                                    BullMQ Queue → Resend Email API
```

### Layered design
- **Routes** — bind HTTP methods, apply middleware chain
- **Services** — all business logic, atomic transactions
- **Prisma** — single ORM client, no raw SQL (except recursive CTE)
- **Queue** — async email delivery via BullMQ + Redis

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Register (sends verification email) |
| GET | `/api/v1/auth/verify-email?token=` | — | Verify email |
| POST | `/api/v1/auth/resend-verification` | — | Resend verification email |
| POST | `/api/v1/auth/login` | — | Login → access + refresh tokens |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Bearer | Revoke refresh token |
| GET | `/api/v1/auth/me` | Bearer | Current user profile |
| POST | `/api/v1/auth/forgot-password` | — | Send password reset email |
| POST | `/api/v1/auth/reset-password` | — | Reset password with token |

### Registries (HOST)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/registries` | Create registry |
| GET | `/api/v1/registries` | List registries (paginated) |
| GET | `/api/v1/registries/:id` | Get registry |
| PATCH | `/api/v1/registries/:id` | Update registry |
| DELETE | `/api/v1/registries/:id` | Delete registry |

### Gifts (HOST + GUEST)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/registries/:id/gifts` | Add gift |
| GET | `/api/v1/registries/:id/gifts` | List gifts (tier-filtered) |
| PATCH | `/api/v1/registries/:id/gifts/:gid` | Update gift |
| DELETE | `/api/v1/registries/:id/gifts/:gid` | Delete gift |
| GET | `/api/v1/gifts/:id` | Get single gift |
| PATCH | `/api/v1/gifts/:id/cancel` | Cancel gift (HOST) |
| GET | `/api/v1/gifts/:id/contributions` | List contributions |
| POST | `/api/v1/gifts/:id/contributions` | Make contribution (atomic) |

### Guests / Family Tree (HOST)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/registries/:id/guests` | Add guest to tree |
| GET | `/api/v1/registries/:id/guests` | List guests |
| PATCH | `/api/v1/registries/:id/guests/:gid` | Update guest |
| DELETE | `/api/v1/registries/:id/guests/:gid` | Remove guest |
| GET | `/api/v1/guests/:id/family-tree` | **Recursive CTE** tree query |

### Vendor (VENDOR role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vendor/gifts` | List FUNDED gifts available to purchase |
| PATCH | `/api/v1/vendor/gifts/:id/purchase` | Mark as PURCHASED → sends email |
| GET | `/api/v1/vendor/gifts/my` | My assigned gifts |

### Courier (COURIER role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/courier/gifts` | List PURCHASED gifts to deliver |
| PATCH | `/api/v1/courier/gifts/:id/deliver` | Mark as DELIVERED → sends email |
| GET | `/api/v1/courier/gifts/my` | My deliveries |

### Admin (ADMIN role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/users` | List all users |
| PATCH | `/api/v1/admin/users/:id/activate` | Activate/deactivate user |
| GET | `/api/v1/admin/queue-status` | BullMQ queue stats |

## Business Rules

### Gift State Machine
```
PENDING → FUNDED (auto, when contributions reach target)
FUNDED  → PURCHASED (vendor confirms)
PURCHASED → DELIVERED (courier confirms)
PENDING/FUNDED → CANCELLED (host cancels, contributions refunded)
```

### Currency Snapshot
Every contribution records `exchangeRate` and `rateLockedAt` at the moment of the transaction. These fields are **immutable** — never recalculated.

### Tier Access
Guests have a `tierRank` (0 = closest family, higher = more distant). Gifts have `requiredTierRank`. Guests can only see and contribute to gifts where `guest.tierRank ≤ gift.requiredTierRank`.

### Email Events (3 business emails)
1. **Email verification** — on registration
2. **Gift fully funded** — when contributions reach target
3. **Gift purchased** — when vendor confirms
4. **Gift delivered** — when courier confirms
5. **Password reset** — on forgot-password request

## Email Verification Flow
1. Register → system sends verification email
2. Click link → `GET /auth/verify-email?token=...`
3. Account activated → can now login
4. Unverified users get `403` on login

## Running Tests
```bash
npm test
```
Output shows 18+ tests across unit and integration suites.

## Environment Variables Reference
See `.env.example` for full list with descriptions.