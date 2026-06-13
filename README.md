# Baqsha.AI 🥬

AI-first платформа для доставки свежих фруктов и овощей на дом.

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
- `POST /api/copilotkit` — AI агент

## AI Agents

### ShopperAssistant
Помогает покупателям:
- Искать товары
- Добавлять в корзину
- Оформлять заказы
- Отслеживать доставку

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
- **AI**: CopilotKit + OpenAI
- **State**: Zustand

## Лицензия

MIT