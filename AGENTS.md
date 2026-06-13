# AGENTS.md — Baqsha.AI

## Project Overview

Baqsha.AI is an AI-first B2C e-commerce platform for home delivery of fresh fruits and vegetables. Single merchant model.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, CopilotKit |
| Backend | Cloudflare Workers, Hono |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Storage | Cloudflare R2 |
| AI | CopilotKit + OpenAI |
| State | Zustand |
| Monorepo | Turborepo + pnpm workspaces |
| Validation | Zod |
| Auth | Session-based (JWT tokens in D1) |

## Project Structure

```
baqsha-ai/
├── apps/
│   ├── worker/        # Cloudflare Worker API (Hono + CopilotKit)
│   └── web/           # Next.js frontend
├── packages/
│   └── shared/        # Types, Zod schemas, constants
├── turbo.json
└── package.json
```

## Commands

```bash
# Development
pnpm dev                    # Start all services (worker:8787, web:3000)

# Build
pnpm build                  # Build all packages

# Database
pnpm db:migrate             # Apply D1 migrations (remote)
pnpm db:migrate:local       # Apply D1 migrations (local)
pnpm db:seed                # Seed initial data

# Deploy
pnpm deploy:worker          # Deploy Cloudflare Worker
pnpm deploy:web             # Deploy Next.js (Vercel/Cloudflare)

# Quality
pnpm lint                   # Lint all packages
pnpm typecheck              # Type check all packages
```

## Architecture

### Aggregates (DDD)

- **Category** — product categories with tree structure (parent_id)
- **Product** — SKU, price (minor units), stock, package, i18n, media
- **Cart** — per-user, items with price snapshots
- **Order** — idempotent creation, status FSM, item snapshots
- **User** — email/password auth, roles: customer | admin

### Order Status FSM

```
created → paid → shipped → delivered
   ↓        ↓
cancelled  cancelled
```

### Cache Strategy

| Data | Storage | TTL | Invalidation |
|------|---------|-----|-------------|
| Product catalog | KV `catalog:products` | 1h | On product CRUD |
| Category tree | KV `catalog:categories` | 1h | On category CRUD |
| User session | D1 `sessions` | 7d | On logout/expiry |
| Cart | D1 `carts` | 24h | On order creation |

### API Routes

| Route | Auth | Description |
|-------|------|-------------|
| `POST /api/auth/register` | Public | Register customer |
| `POST /api/auth/login` | Public | Login |
| `GET /api/auth/me` | Auth | Current user |
| `GET /api/catalog/products` | Public | List products (cached) |
| `GET /api/catalog/categories` | Public | List categories (cached) |
| `GET /api/cart` | Auth | Get cart |
| `POST /api/cart/items` | Auth | Add to cart |
| `POST /api/orders` | Auth | Create order (idempotent) |
| `GET /api/orders` | Auth | My orders |
| `POST /api/admin/*` | Admin | Catalog management |
| `PUT /api/admin/orders/:id/status` | Admin | Update order status |
| `POST /api/copilotkit` | Public | CopilotKit AI endpoint |

## Conventions

### Code Style

- TypeScript strict mode
- Zod for all validation schemas (in `packages/shared`)
- Repository pattern for data access
- Hono middleware for auth/guards
- Functional components only (React)

### Naming

- Files: `camelCase.ts` for repos/services, `PascalCase.tsx` for components
- DB columns: `snake_case`
- API fields: `camelCase`
- Routes: `/api/{resource}`

### Database

- IDs: UUID v4 (`crypto.randomUUID()`)
- Timestamps: Unix milliseconds (`Date.now()`)
- Prices: Minor units (tiyin/kopek) as integers
- Enums: String values in CHECK constraints
- JSON fields: Serialized strings in D1

### Error Handling

- All responses: `{ success: boolean, data?: T, error?: string }`
- HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 500
- Validation errors: flatten field errors from Zod

## Key Patterns

### Idempotent Order Creation

```typescript
// Client sends idempotencyKey (UUID v4)
// Server checks D1 for existing order with that key
// If exists → return existing order
// If not → create order + decrement stock in D1 batch
```

### Cache Invalidation

```typescript
// After any admin mutation:
await cache.invalidateProducts();  // or invalidateCategories()
// KV.delete() removes the key, next read rebuilds from D1
```

### Admin Guard

```typescript
// Middleware chain: authMiddleware → adminGuard
// Checks user.role === 'admin' after JWT verification
```

## Environment Variables

### Worker (wrangler.toml)

| Variable | Description |
|----------|-------------|
| `DB` | D1 database binding |
| `CACHE` | KV namespace binding |
| `IMAGES` | R2 bucket binding |
| `AI` | Workers AI binding |
| `JWT_SECRET` | Min 32 chars |
| `CORS_ORIGIN` | Frontend URL |

### Web (.env.local)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Worker URL (default: http://localhost:8787) |

## Deploy Notes

After changes to `apps/worker/` — run `pnpm deploy:workers`.

Workers deploy separately from the web app. Web app deploys via Vercel or Cloudflare Pages.
