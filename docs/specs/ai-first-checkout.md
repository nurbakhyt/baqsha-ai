# Spec: AI-First Checkout — Remaining Work

## Objective
Close the gap between the existing uncommitted AI checkout implementation and a working investor demo. The showstopper: the AI cart lives in Zustand (client) but `POST /api/orders` reads the server cart, so every AI-driven order fails with `"Cart is empty"`. Fix by making the order endpoint accept cart items in the request body, clean up the contradictory web build config, and remove dead code. Success = an investor can sit down, chat in Russian/Kazakh, add produce, confirm, and see a real order created end-to-end with a visual confirmation card.

**User:** investor demo participant (Kazakhstan, ru/kk). **Success:** AI chat → add → order → confirmation, no manual form, no login friction.

## Tech Stack
Next.js 14 (static export) · React 18 · Zustand · CopilotKit 1.8 · Cloudflare Workers + Hono · D1 · `@baqsha/shared` (Zod) · OpenRouter. Demo-only — no tests, no payment.

## Commands
```
Dev:        pnpm dev
Build:      pnpm build
Typecheck:  pnpm typecheck
Lint:       pnpm lint
DB local:   pnpm db:migrate:local
Deploy WK:  pnpm deploy:worker   # after apps/worker/ changes
```

## Project Structure (touched only)
```
packages/shared/src/index.ts        # Zod schemas (order input)
apps/worker/src/routes/orders.ts    # POST /api/orders rewrite
apps/web/components/copilot/CopilotTools.tsx  # createOrder action
apps/web/app/api/copilotkit/route.ts         # DELETE (dead)
apps/web/lib/workers-ai-adapter.ts           # DELETE (dead)
apps/web/lib/agents/{adminTools,shopperTools}.ts  # DELETE (dead)
apps/web/next.config.js                       # keep output:'export' (no change)
```

## Code Style
Server builds the order snapshot from DB — client sends only `{productId, quantity}` (never trusts client price):
```ts
// packages/shared
export const CreateOrderItemInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});
export const CreateOrderInputSchema = z.object({
  idempotencyKey: z.string(),
  items: z.array(CreateOrderItemInputSchema).min(1),
  deliveryAddress: z.string().min(1).max(500),
  contactPhone: z.string().min(1).max(50),
  notes: z.string().optional(),
});
```

## Testing Strategy
None (demo MVP, per idea doc). Verification = `pnpm typecheck` + `pnpm build` + manual chat flow. If shipped to real users: add Vitest for `orderRepository` + Zod schema tests.

## Boundaries
- **Always:** run typecheck + build before a task is "done"; validate all inputs with Zod; preserve idempotency; keep AI instructions ru/kk; server re-fetches price/name from DB (never trust client).
- **Ask first:** DB migration changes, new dependencies, `wrangler.toml` binding changes, OpenRouter model/config changes.
- **Never:** commit `.dev.vars`/secrets; remove the existing auth or order-cancel routes; touch `apps/worker/src/routes/copilot.ts` OpenRouter wiring.

## Success Criteria
1. Chat "Добавь 2кг яблок" → Zustand cart updates (already works, must not regress).
2. "Хочу заказать" → AI collects address + phone, confirms summary, calls `createOrder` → **order is created (201)** and `OrderConfirmation` card renders with order ID + items + total.
3. `POST /api/orders` with `items[]` creates order, decrements stock, returns order; same `idempotencyKey` returns the original order (idempotent).
4. Out-of-stock item → server returns **409** with `{productId, name, available}`; AI relays naturally: "К сожалению, яблоки закончились…".
5. `pnpm build` (web) succeeds with `output: 'export'`; no dead-route build error.
6. `pnpm typecheck` passes; no imports of deleted files.
7. After worker changes: user runs `pnpm deploy:worker`.

## Resolved Questions
1. **Auto-login demo customer** → **YES.** Task 6 is now active (not optional). On mount, if no `user`, auto-login `customer@example.com`/`customer123` so the AI checkout has an authed session with zero friction.
2. **Stock concurrency race** → **Accepted for demo.** Two simultaneous orders could both pass the pre-flight check then one's `UPDATE … WHERE stock>=?` affects 0 rows while the order row still inserts. Acceptable for the investor demo; flag if shipping to real users.
3. **Cart routes (`/api/cart`) retention** → **Leave dormant now, improve next iteration.** Unused by the AI flow after this change; kept for the UI dropdown. Will be revisited in the next iteration.

---

## Phase 2 — Plan (implementation order)
1. **Schema** (shared) — foundation; everything depends on it.
2. **Worker order route** — rewrite to accept `items[]`, lookup products, validate stock, build DB snapshot, decrement, 409 on insufficient stock. Depends on 1.
3. **AI createOrder action** — send `items: cart.map(...)`; map 409 → ru/kk natural message. Depends on 2.
4. **Build-config cleanup** — delete dead web files; verify no imports. Independent — parallelizable with 1–3.
5. **Verify** — typecheck, build, manual chat flow + out-of-stock case.
6. *(Optional)* Demo auto-login.

## Phase 3 — Tasks
- [ ] **Task 1 — Extend order input schema**
  - Acceptance: `CreateOrderInputSchema` includes `items: array({productId, quantity}).min(1)`; `CreateOrderItemInputSchema` exported.
  - Verify: `pnpm typecheck --filter @baqsha/shared`
  - Files: `packages/shared/src/index.ts`

- [ ] **Task 2 — Rewrite POST /api/orders**
  - Acceptance: reads `items[]` from body (not server cart); looks up products from DB; validates active + `stock >= qty` (→ 409 `{success:false, error, productId, name, available}`); builds snapshot from DB (price/name/package/unit); computes total; batch insert order + `UPDATE products SET stock=stock-? WHERE id=? AND stock>=?`; idempotency preserved; no longer imports `cartRepo`.
  - Verify: `pnpm typecheck --filter worker`; manual curl with items → 201; repeat idempotencyKey → same order; out-of-stock → 409.
  - Files: `apps/worker/src/routes/orders.ts` (+ shared schema from T1)

- [ ] **Task 3 — Update AI createOrder action**
  - Acceptance: handler sends `items: cart.map(i => ({productId, quantity}))` alongside idempotency/address/phone; on `!success` with 409, returns Russian message naming the product + available qty (AI relays it); success path + `OrderConfirmation` render unchanged; `clearCart()` still clears Zustand.
  - Verify: `pnpm typecheck --filter web`; manual chat: add → order → confirmation; force out-of-stock → AI explains.
  - Files: `apps/web/components/copilot/CopilotTools.tsx`

- [ ] **Task 4 — Delete dead web code**
  - Acceptance: remove `app/api/copilotkit/route.ts`, `lib/workers-ai-adapter.ts`, `lib/agents/adminTools.ts`, `lib/agents/shopperTools.ts`; no remaining imports; `output: 'export'` stays; (optional) remove unused `@copilotkit/runtime` + `@cloudflare/next-on-pages` from web deps.
  - Verify: `pnpm build --filter web` succeeds; `pnpm typecheck --filter web`.
  - Files: 4 deletions + `apps/web/package.json` (optional).

- [ ] **Task 5 — End-to-end verify**
  - Acceptance: `pnpm typecheck` + `pnpm build` green; full chat flow works (add → confirm → order card); idempotency; out-of-stock message; remind user to run `pnpm deploy:worker`.
  - Verify: run `pnpm dev`, exercise the flow.
  - Files: none.

- [ ] **Task 6 — Demo auto-login**
  - Acceptance: if no `user` on mount, auto-login `customer@example.com`/`customer123` so checkout has an authed session.
  - Verify: fresh load → `user` populated → AI checkout completes without manual login.
  - Files: `apps/web/app/page.tsx` or `CopilotKitProvider.tsx`.
