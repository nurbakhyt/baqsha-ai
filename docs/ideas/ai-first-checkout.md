# AI-First Checkout

## Problem Statement

How might we make the entire purchase flow — from browsing to order confirmation — happen through a conversation with an AI assistant, so investors see a genuinely novel commerce experience rather than "just another e-commerce site"?

## Recommended Direction

The CopilotKit AI assistant becomes the primary interface for the entire shopping journey. Instead of separate pages for browse → cart → checkout → confirmation, the user talks to the AI in one continuous flow:

1. **Discovery:** "Покажи мне свежие фрукты" → AI shows products, user says "Добавь 2кг яблок" → cart updates
2. **Checkout:** "Хочу заказать" → AI asks for address and phone → user provides → AI confirms → order created
3. **Post-order:** "Где мой заказ?" → AI shows order status from backend

The traditional UI (product grid, cart dropdown) still exists as a visual complement, but the AI assistant drives the action. This isn't a chatbot widget — it's a conversational commerce engine.

**Why this direction:** Investors need to see something they haven't seen before. A polished e-commerce site is table stakes. An AI that actually handles the buying flow end-to-end — parsing natural language addresses, managing cart state, creating orders — is the demo that gets remembered.

## Key Assumptions to Validate

- [ ] **Investors find conversational checkout impressive, not gimmicky** — Show 3 people the flow. If they say "cool" but wouldn't use it, it's a gimmick. Pivot to polished traditional checkout.
- [ ] **CopilotKit can reliably parse Russian/Kazakh addresses from free text** — Build prototype, test 20 address variations. If >20% fail, add structured fallback (AI suggests, user confirms via button).
- [ ] **Demo without payment is sufficient** — For fresh produce marketplace demo, payment is not needed. Order creation + confirmation proves the concept.
- [ ] **CopilotKit tool calls are fast enough for real-time feel** — If latency >2s per action, the demo feels sluggish. Test with OpenRouter free tier.

## MVP Scope

### In (must have for demo)
- Fix `output: 'export'` conflict (remove from next.config.js or keep Worker-only route — already resolved: Worker-only)
- New CopilotKit action: `createOrder(address, phone, notes?)` → calls `POST /api/orders` with idempotency key
- New CopilotKit action: `getOrderStatus(orderId?)` → calls `GET /api/orders` or `GET /api/orders/:id`
- AI instructions updated: collect address + phone before order creation, confirm with user, show order ID after success
- Checkout flow in chat: AI prompts for address → phone → confirms → creates order → shows confirmation
- Visual order confirmation card (rendered in chat or as overlay)
- Fix frontend API client to send auth token (Bearer header)
- Seed data expansion: ensure enough products for demo variety

### Out (explicitly not building)
- Payment integration (Stripe, Kaspi, etc.)
- Delivery scheduling / time slots
- Order editing after creation
- Admin panel (separate future work)
- User registration / login UI (use seed accounts for demo)
- Product detail pages
- Category routing
- Mobile responsive layout
- Tests (demo-only, not production)
- Email/SMS notifications

## Not Doing (and Why)

- **No traditional checkout form** — defeats the purpose of AI-first. If users want a form, that's Option 4 (Anti-Demo).
- **No payment integration** — adds 2-3 weeks of complexity for a demo. Investors understand "demo mode."
- **No admin panel** — the demo is customer-facing. Admin can be added later.
- **No user registration UI** — use seed accounts (admin@baqsha.kz / customer@example.com). Registration is a solved problem, not the demo's point.
- **No order tracking beyond status** — "delivered/shipped/created" is enough for demo. GPS tracking, time estimates — future.
- **No tests** — this is a demo MVP, not production code. If it ships to real users, add tests then.
- **No i18n beyond ru/kk** — already handled in schema and AI instructions. English is not needed for Kazakhstan demo.
- **No product images from R2** — use placeholder URLs. Image pipeline is not the demo's story.

## Open Questions

1. **Should the AI confirm the full order summary before creating it?** (e.g., "Вы заказали: 2кг яблок (₸1,200), 1кг помидоров (₸800). Итого: ₸2,000. Доставка на ул. Абая 52. Подтвердить?") — I say yes, it builds trust and reduces errors.
2. **What happens if order creation fails (e.g., out of stock)?** — AI should explain naturally: "К сожалению, яблоки закончились. Хотите заменить на груши?"
3. **Should the cart sync with backend or stay client-side?** — For demo, client-side Zustand is fine. Backend sync is for production.
