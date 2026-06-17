# CLAUDE.md

## Deploy Configuration (configured by /setup-deploy)
- Platform: Cloudflare Pages (web) + Cloudflare Worker (api)
- Frontend URL: https://baqsha-web.pages.dev
- API URL: https://baqsha-worker.nurbakhyt.workers.dev
- Deploy workflow: push to main → GitHub Action деплоит фронт + воркер
- Merge method: merge commit
- Project type: e-commerce web app (Next.js frontend + Cloudflare Worker API)

### Deploy flow
1. PR → merge в main
2. GitHub Action автоматически:
   - Деплоит фронт на Cloudflare Pages (`npx wrangler pages deploy apps/web/out --project-name baqsha-web`)
   - Деплоит воркер (`npx wrangler deploy`)
3. Фронт: https://baqsha-web.pages.dev
4. API: https://baqsha-worker.nurbakhyt.workers.dev

## CopilotKit AI Integration

### Архитектура
```
Frontend (CopilotKit React) → GraphQL → Worker (CopilotKit Runtime) → OpenRouter API
         ↓                                        ↓
    useCopilotAction                     CopilotRuntime + OpenAIAdapter
    (addToCart, showCart, etc.)           ( GraphQL yoga endpoint )
```

### Ключевые файлы
- `apps/worker/src/routes/copilot.ts` — CopilotKit runtime endpoint
- `apps/web/components/copilot/CopilotKitProvider.tsx` — frontend provider
- `apps/web/components/copilot/CopilotTools.tsx` — инструменты (addToCart, removeFromCart, showCart, clearCart)

### Secrets (Worker)
- `OPENROUTER_API_KEY` — ключ OpenRouter
- `OPENROUTER_MODEL` — модель (по умолчанию `openrouter/free`)

### Зависимости (Worker)
- `@copilotkit/runtime@^1.8.13` — CopilotKit v1 runtime
- `graphql-yoga@^5.21.2` — GraphQL сервер
- `openai@^4.85.1` — OpenAI SDK для OpenRouter
