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
