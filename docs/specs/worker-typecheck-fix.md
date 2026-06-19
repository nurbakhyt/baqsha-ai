# Spec: Worker TypeScript Typecheck Fix

## Objective
Make `pnpm typecheck --filter worker` pass (currently ~70 errors, all pre-existing, none from the AI-checkout work). The worker builds fine via wrangler (esbuild ignores tsc), but `tsc --noEmit` is red — so the typecheck gate in CI/agents is non-functional for the worker. Fix the root causes so the gate is trustworthy again. Demo-only codebase, but type safety here is cheap and prevents real bugs (e.g. `c.get("user")` silently typed as `never`/`unknown` today).

**User:** the engineer/agent running `pnpm typecheck`. **Success:** `pnpm typecheck` is green across all 3 packages; no behaviour change at runtime; wrangler build still succeeds.

## Tech Stack
Cloudflare Workers · Hono 4 · `@cloudflare/workers-types` · `@baqsha/shared` (Zod) · TypeScript 5.5 strict.

## Commands
```
Typecheck (worker):  pnpm typecheck --filter worker
Typecheck (all):     pnpm typecheck
Build (worker):      pnpm build --filter worker
Deploy (worker):     pnpm deploy:worker
```

## Root-Cause Analysis (4 independent buckets)

### Bucket A — Hono Env generic plumbing (~60 errors, the big one)
**Symptom:** `c.env` is `unknown` in every route; `c.get("user")`/`c.set("user", ...)` resolve to `never`; `app.use("/api/cart/*", authMiddleware)` overload mismatches in `index.ts`.

**Cause:**
- `apps/worker/src/index.ts`: app is `Hono<{ Bindings: Bindings; Variables: Variables }>` (good), but `Variables = { user: any; session: any }` uses `any` and `Bindings` is locally redeclared (not shared).
- `apps/worker/src/middleware/auth.ts`: `AuthEnv = { DB; CACHE; JWT_SECRET }` has no `IMAGES`/`AI`/`CORS_ORIGIN` and **no Variables at all** → `c.set("user")` is `never`, and `AuthEnv` "has no properties in common with" the app's Bindings.
- Every route file (`auth.ts`, `cart.ts`, `orders.ts`, `admin.ts`, `catalog.ts`) does `new Hono()` with **no generic** → `c.env` defaults to `unknown`, `c.get("user")` is `never`.

**Fix:** Introduce one shared `AppEnv` type = `{ Bindings: AppBindings; Variables: AppVariables }` in a new `apps/worker/src/types.ts`. `AppBindings` = the full binding set (DB, CACHE, IMAGES, AI, JWT_SECRET, CORS_ORIGIN, + OPENROUTER_*). `AppVariables` = `{ user: User; session: Session }` (typed, not `any`). Use `Hono<AppEnv>` for the app and every sub-router; type middleware as `MiddlewareHandler<AppEnv>`. Delete the local `AuthEnv` and the duplicated `Bindings`/`Variables` in `index.ts`. Now `c.env.DB` is typed and `c.get("user")` returns `User`.

### Bucket B — rootDir vs path mapping (~1 error, TS6059)
**Symptom:** `File 'packages/shared/src/index.ts' is not under 'rootDir' 'apps/worker/src'`.

**Cause:** `worker/tsconfig.json` has `"rootDir": "./src"` but `"paths": {"@baqsha/shared": ["../../packages/shared/src"]}`. `@baqsha/shared` ships source (`main`/`types` → `src/index.ts`, no build), so tsc pulls shared source into the program, which is outside rootDir. wrangler/esbuild doesn't care, but tsc does.

**Fix:** Drop `"rootDir": "./src"` from `apps/worker/tsconfig.json`. `outDir`/`declaration` are irrelevant under `tsc --noEmit` and wrangler ignores them. (Alternative: project references + composite — rejected as overkill for a demo.)

### Bucket C — Shared schema drift (~3 errors)
**Symptom:** `input.isActive` missing on `UpdateCategoryInput`/`UpdateProductInput`; `inStockOnly` missing in `{}` for `ProductFilters`.

**Cause:**
- `UpdateCategoryInputSchema = CreateCategoryInputSchema.partial().extend({id})` — `CreateCategoryInputSchema` has no `isActive`, so `categoryRepository.update` line 79 (`input.isActive ?? existing.isActive`) is a type error.
- Same for `UpdateProductInputSchema` / `productRepository.update` line 141.
- `ProductFiltersSchema.inStockOnly = z.boolean().default(true)` → `z.infer` (output type) makes `inStockOnly: boolean` **required**, so `findAll({})` / `count({})` fail. Runtime is fine (undefined → falsy → no filter) but the type lies.

**Fix (in `packages/shared/src/index.ts`):**
- Add `isActive: z.boolean().optional()` to `UpdateCategoryInputSchema` (after the `.partial().extend`).
- Add `isActive: z.boolean().optional()` to `UpdateProductInputSchema`.
- Change `export type ProductFilters = z.infer<typeof ProductFiltersSchema>` → `export type ProductFilters = z.input<typeof ProductFiltersSchema>` so `inStockOnly` is optional for callers; keep `.default(true)` so route parsing still applies the default. In repos, read `filters.inStockOnly ?? true` where the "default true" intent matters (audit `productRepository.findAll`/`count`).

### Bucket D — Verify no regressions
Re-run full `pnpm typecheck` + `pnpm build`; confirm zero new errors and runtime behaviour unchanged (routes still respond).

## Project Structure (touched only)
```
apps/worker/src/types.ts               # NEW — shared AppEnv (Bindings + Variables)
apps/worker/src/index.ts               # use AppEnv, drop local Bindings/Variables
apps/worker/src/middleware/auth.ts     # drop AuthEnv, use MiddlewareHandler<AppEnv>
apps/worker/src/routes/auth.ts         # new Hono<AppEnv>
apps/worker/src/routes/cart.ts         # new Hono<AppEnv>
apps/worker/src/routes/orders.ts       # new Hono<AppEnv>
apps/worker/src/routes/admin.ts        # new Hono<AppEnv>
apps/worker/src/routes/catalog.ts      # new Hono<AppEnv>
apps/worker/tsconfig.json              # drop rootDir
packages/shared/src/index.ts           # isActive on update schemas; ProductFilters -> z.input
apps/worker/src/domain/repositories/productRepository.ts  # inStockOnly ?? true (if needed)
```

## Code Style
One shared env type, used everywhere — no per-file `Bindings`/`AuthEnv` duplicates:
```ts
// apps/worker/src/types.ts
import type { D1Database, KVNamespace, R2Bucket, Ai } from "@cloudflare/workers-types";
import type { User, Session } from "@baqsha/shared";

export interface AppBindings {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
}

export interface AppVariables {
  user: User;
  session: Session;
}

export type AppEnv = { Bindings: AppBindings; Variables: AppVariables };

// routes
const orders = new Hono<AppEnv>();
orders.post("/", async (c) => {
  const user = c.get("user");   // User  (was: never)
  const db = c.env.DB;          // D1Database (was: unknown)
  ...
});

// middleware
import { MiddlewareHandler } from "hono";
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  ...
  c.set("user", user);          // OK, typed
};
```

## Testing Strategy
None (demo MVP). Verification = `pnpm typecheck` green + `pnpm build` green + spot-check `wrangler dev` that `/health`, `/api/catalog/products`, and an authenticated `POST /api/orders` still respond identically. If shipping to real users: add Vitest with Miniflare for the auth middleware + one route per bucket.

## Boundaries
- **Always:** run `pnpm typecheck` + `pnpm build` before a task is "done"; use the shared `AppEnv` everywhere (no per-file env types); keep `User`/`Session` typed in Variables (not `any`); preserve all route paths and response shapes.
- **Ask first:** changing `wrangler.toml` bindings; renaming/restructuring route files; changing `@baqsha/shared` exported type names that the web app imports.
- **Never:** change runtime behaviour (this is types-only + the 3 schema-optionality additions); touch `apps/worker/src/routes/copilot.ts` OpenRouter wiring; drop the `Variables` typing back to `any`; commit `.dev.vars`.

## Success Criteria
1. `pnpm typecheck` exits 0 across `@baqsha/shared`, `web`, and `worker` (today: shared ✅, web ✅, worker ❌). **DONE — all 3 green; worker went from ~70 errors to 0.**
2. `c.get("user")` infers `User` (not `never`/`unknown`) in every route and middleware. **DONE.**
3. `c.env.DB`/`c.env.CACHE`/etc. infer the correct CF binding types in every route (not `unknown`). **DONE — explicit `import type { D1Database, KVNamespace, R2Bucket, Ai } from "@cloudflare/workers-types"` in `types.ts` was required to avoid global-vs-module `KVNamespace` generic mismatch with `CacheService`.**
4. `pnpm build --filter worker` still succeeds (wrangler dry-run, same bundle size ±minor). **DONE — 9292.37 KiB (was 9292.26), bindings intact.**
5. No route path, status code, or JSON response shape changes (runtime-equivalent). **DONE — types-only + 3 schema-optionality additions; no handler logic touched.**
6. `@baqsha/shared` and `web` typecheck stay green (no regressions from the schema-optionality changes). **DONE.**

## Resolved Questions
1. **Project references vs drop rootDir?** → Drop `rootDir` (Bucket B). Shared ships source; references/composite is overkill for a demo and would force a shared build step.
2. **`ProductFilters` as input or output type?** → Input type (`z.input<typeof ProductFiltersSchema>`). Keeps `.default(true)` for route parsing; makes repo callers (`{}`) legal; `?? true` in repo preserves intent.
3. **`Variables` typed or `any`?** → Typed (`User`, `Session`). The whole point is to kill `c.get("user")` → `never`; `any` would silence errors but defeat the purpose.

---

## Phase 2 — Plan (implementation order)
1. **Bucket C (shared schemas)** — smallest, unblocks nothing else but isolated. Add `isActive` to update schemas; flip `ProductFilters` to `z.input`.
2. **Bucket A (AppEnv)** — create `types.ts`, convert `index.ts` + middleware + 5 route files. Biggest task; do in one pass to avoid half-converted state.
3. **Bucket B (tsconfig)** — drop `rootDir`. One line.
4. **Bucket D (verify)** — typecheck + build + spot-check.

## Phase 3 — Tasks
- [ ] **Task 1 — Fix shared schema drift (Bucket C)**
  - Acceptance: `UpdateCategoryInputSchema` & `UpdateProductInputSchema` include `isActive?: boolean`; `ProductFilters = z.input<typeof ProductFiltersSchema>` (so `inStockOnly?` optional); repo reads `filters.inStockOnly ?? true` where it branches on it; `pnpm typecheck --filter @baqsha/shared` green; `pnpm typecheck --filter web` still green.
  - Verify: `pnpm typecheck --filter @baqsha/shared && pnpm typecheck --filter web`
  - Files: `packages/shared/src/index.ts`, `apps/worker/src/domain/repositories/productRepository.ts` (if `?? true` needed)

- [ ] **Task 2 — Introduce shared AppEnv + convert app & middleware (Bucket A, part 1)**
  - Acceptance: `apps/worker/src/types.ts` exports `AppBindings`, `AppVariables`, `AppEnv`; `index.ts` uses `Hono<AppEnv>` and drops local `Bindings`/`Variables`; `middleware/auth.ts` drops `AuthEnv`, exports `authMiddleware`/`adminGuard`/`optionalAuthMiddleware` as `MiddlewareHandler<AppEnv>`; `c.set("user", user)`/`c.get("user")` type-check.
  - Verify: `pnpm typecheck --filter worker` — the `middleware/auth.ts` and `index.ts` overload errors gone (route errors may remain until Task 3).
  - Files: `apps/worker/src/types.ts` (NEW), `apps/worker/src/index.ts`, `apps/worker/src/middleware/auth.ts`

- [ ] **Task 3 — Convert all sub-routers to Hono<AppEnv> (Bucket A, part 2)**
  - Acceptance: `routes/auth.ts`, `cart.ts`, `orders.ts`, `admin.ts`, `catalog.ts` each use `new Hono<AppEnv>()`; `c.env.*` typed; `c.get("user")` → `User`; no `any` casts added.
  - Verify: `pnpm typecheck --filter worker` — zero `c.env is of type 'unknown'` / `c.get("user")` overload errors.
  - Files: 5 route files under `apps/worker/src/routes/`

- [ ] **Task 4 — Drop rootDir from worker tsconfig (Bucket B)**
  - Acceptance: `apps/worker/tsconfig.json` has no `rootDir`; `TS6059` gone; `outDir`/`declaration` kept (harmless under noEmit).
  - Verify: `pnpm typecheck --filter worker` — no `TS6059` errors.
  - Files: `apps/worker/tsconfig.json`

- [ ] **Task 5 — Verify green + no runtime regression (Bucket D)**
  - Acceptance: `pnpm typecheck` green (3/3); `pnpm build` green (2/2); `wrangler dev` → `/health` 200, `GET /api/catalog/products` 200 with data, authenticated `POST /api/orders` 201 (re-run the AI-checkout flow once). Remind user to run `pnpm deploy:worker`.
  - Verify: run the commands + one manual chat flow.
  - Files: none
