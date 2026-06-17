# Baqsha.AI 🥬

AI-first платформа для доставки свежих фруктов и овощей на дом.

**Demo:** https://baqsha-web.pages.dev

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Storefront  │  │     Cart     │  │   CopilotKit │        │
│  │   Products    │  │   Checkout   │  │   Sidebar    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Worker API (Cloudflare Workers)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │     Auth     │  │   Catalog    │  │    Orders    │        │
│  │  JWT + Session│  │  Products/Cat│  │   Checkout   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │     Cart     │  │    Admin     │  │  CopilotKit  │        │
│  │  CRUD + Sync │  │   CRUD Guard │  │   Runtime    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │   D1    │          │   KV    │          │   R2    │
   │  (SQL)  │          │ (Cache) │          │(Images) │
   └─────────┘          └─────────┘          └─────────┘
```

## Быстрый старт

### 1. Установка зависимостей

```bash
pnpm install
```

### 2. Настройка Cloudflare

```bash
# Войти в Cloudflare
npx wrangler login

# Создать D1 базу
npx wrangler d1 create baqsha-ai

# Создать KV namespace
npx wrangler kv namespace create CACHE

# Создать R2 bucket
npx wrangler r2 bucket create baqsha-images
```

Обновите `apps/worker/wrangler.toml` с вашими ID.

### 3. Миграции базы данных

```bash
pnpm db:migrate
```

### 4. Создание админа

```bash
# Seed данные
pnpm db:seed
```

### 5. Запуск

```bash
# Development
pnpm dev

# Worker: http://localhost:8787
# Web: http://localhost:3000
```

### 6. Настройка AI (CopilotKit + OpenRouter)

```bash
# Получить API ключ на https://openrouter.ai/keys
cd apps/worker
echo 'sk-or-v1-...' | npx wrangler secret put OPENROUTER_API_KEY
echo 'openrouter/free' | npx wrangler secret put OPENROUTER_MODEL
```

**Бесплатные модели:**
- `openrouter/free` — автоматический выбор бесплатной модели
- `meta-llama/llama-3.3-70b-instruct:free` — стабильная модель с tool calling
- `nvidia/nemotron-3-super-120b-a12b:free` — быстрая модель

**Лимиты бесплатного тарифа:** 20 запросов/мин, 50 запросов/день. С кредитом $5+ лимиты вырастают.

## API Endpoints

### Auth
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход
- `GET /api/auth/me` — текущий пользователь

### Catalog (Public)
- `GET /api/catalog/products` — список товаров
- `GET /api/catalog/products/:id` — товар по ID
- `GET /api/catalog/categories` — категории
- `GET /api/catalog/categories/:slug` — категория по slug

### Cart (Auth Required)
- `GET /api/cart` — корзина
- `POST /api/cart/items` — добавить товар
- `PUT /api/cart/items/:productId` — обновить количество
- `DELETE /api/cart/items/:productId` — удалить товар
- `DELETE /api/cart` — очистить корзину

### Orders (Auth Required)
- `POST /api/orders` — создать заказ (идемпотентно)
- `GET /api/orders` — мои заказы
- `GET /api/orders/:id` — детали заказа
- `POST /api/orders/:id/cancel` — отменить заказ

### Admin (Admin Required)
- `POST /api/admin/categories` — создать категорию
- `PUT /api/admin/categories/:id` — обновить категорию
- `DELETE /api/admin/categories/:id` — удалить категорию
- `POST /api/admin/products` — создать товар
- `PUT /api/admin/products/:id` — обновить товар
- `DELETE /api/admin/products/:id` — удалить товар
- `POST /api/admin/products/:id/stock` — изменить остаток
- `GET /api/admin/orders` — все заказы
- `PUT /api/admin/orders/:id/status` — изменить статус заказа

### CopilotKit
- `POST /api/copilotkit` — AI агент (GraphQL endpoint)

## AI Agents

### ShopperAssistant (CopilotKit)
Помогает покупателям:
- Искать товары по каталогу
- Добавлять в корзину (`addToCart`)
- Показывать корзину (`showCart`)
- Удалять товары (`removeFromCart`)
- Очищать корзину (`clearCart`)

**Реализация:**
- Frontend: `apps/web/components/copilot/CopilotTools.tsx` — инструменты через `useCopilotAction`
- Runtime: `apps/worker/src/routes/copilot.ts` — CopilotKit v1.8.13 на Cloudflare Workers
- AI Provider: OpenRouter (`openrouter/free` — автоматический выбор бесплатных моделей)
- Протокол: GraphQL (graphql-yoga) с `@copilotkit/runtime-client-gql`
- Язык: русский + казахский (нормализация кириллицы для поиска товаров)

### AdminAssistant
Помогает админам:
- Управлять каталогом
- Обрабатывать заказы
- Изменять остатки

## Стек

- **Frontend**: Next.js 14 + React + Tailwind CSS
- **Backend**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Storage**: Cloudflare R2
- **AI**: CopilotKit + OpenRouter
- **State**: Zustand

## Лицензия

MIT