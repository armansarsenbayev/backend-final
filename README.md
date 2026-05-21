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

---

## Deployment

### Option A — Docker Compose (Local / VPS)

Run the full stack (PostgreSQL + Redis + Backend + Frontend) with a single command:

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — fill in JWT secrets, Resend API key, ADMIN_REGISTRATION_KEY

# 2. Build and start all services
docker compose up --build -d

# 3. Check service health
docker compose ps
docker compose logs backend --tail=50
```

| Service   | Local URL                        | Notes                          |
|-----------|----------------------------------|--------------------------------|
| Backend   | http://localhost:3000            | Express API                    |
| Swagger   | http://localhost:3000/docs       | Interactive API docs           |
| Frontend  | http://localhost:5173            | React SPA served via nginx     |
| Postgres  | localhost:5432                   | saukele / saukele_pass         |
| Redis     | localhost:6379                   | BullMQ queue                   |

Prisma migrations run **automatically** on backend container startup.

To stop and remove volumes:
```bash
docker compose down -v
```

---

### Option B — Render.com (Free tier)

#### Backend (Web Service)
1. Create new **Web Service** → connect your GitHub repo
2. **Build Command:** `npm ci && npx prisma generate`
3. **Start Command:** `npx prisma migrate deploy && node src/server.js`
4. **Environment:** Add all variables from `.env.example`
5. Add a **PostgreSQL** add-on → Render sets `DATABASE_URL` automatically
6. Add an **Upstash Redis** add-on (or use upstash.com free tier) → set `REDIS_URL`

#### Frontend (Static Site)
1. Create new **Static Site** → same repo, set **Root Directory** to `frontend`
2. **Build Command:** `npm ci && npm run build`
3. **Publish Directory:** `frontend/dist`
4. Set environment variable: `VITE_API_URL=https://<your-backend>.onrender.com/api/v1`

---

### Option C — Railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
railway init
railway add postgresql redis
railway up

# Set environment variables
railway variables set JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... ADMIN_REGISTRATION_KEY=...

# Deploy frontend separately
cd frontend
railway up
```

---

### Creating the first ADMIN user

After deployment, create the first admin via the protected endpoint:

```bash
curl -X POST https://<your-backend>/api/v1/admin/register-admin \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: <your-ADMIN_REGISTRATION_KEY>" \
  -d '{"email":"admin@example.com","username":"admin","password":"SecurePass123!"}'
```

Or use the **Admin Dashboard** → **🔐 Создать ADMIN** tab in the frontend UI.

---

### Environment Variables Reference
See `.env.example` for the full annotated list. Key variables:

| Variable                  | Required | Description                                  |
|---------------------------|----------|----------------------------------------------|
| `DATABASE_URL`            | ✅       | PostgreSQL connection string                 |
| `JWT_ACCESS_SECRET`       | ✅       | 64-char random string for access tokens      |
| `JWT_REFRESH_SECRET`      | ✅       | 64-char random string (must differ from above)|
| `RESEND_API_KEY`          | ✅       | API key from resend.com                      |
| `REDIS_URL`               | ✅       | Redis connection string (or Upstash)         |
| `ADMIN_REGISTRATION_KEY`  | ✅       | Min 16-char secret for /admin/register-admin |
| `CORS_ORIGINS`            | ✅       | Comma-separated list of allowed origins      |
| `APP_URL`                 | ✅       | Public URL of the backend (for email links)  |