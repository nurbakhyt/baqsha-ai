# CLAUDE.md

## Deploy Configuration (configured by /setup-deploy)
- Platform: Cloudflare Pages (web) + Cloudflare Worker (api)
- Frontend URL: https://baqsha-ai.nurbakhyt.pages.dev
- API URL: https://baqsha-worker.nurbakhyt.workers.dev
- Deploy workflow: push to main → Pages деплоит фронт + воркер автоматически (через deploy command в Pages)
- Merge method: merge commit
- Project type: e-commerce web app (Next.js frontend + Cloudflare Worker API)

### Deploy flow
1. PR → merge в main
2. Cloudflare Pages автоматически:
   - Собирает фронт (`pnpm build --filter=web`)
   - Деплоит воркер (`cd apps/worker && npx wrangler deploy`)
3. Фронт: https://baqsha-ai.nurbakhyt.pages.dev
4. API: https://baqsha-worker.nurbakhyt.workers.dev
