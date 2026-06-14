# CLAUDE.md

## Deploy Configuration (configured by /setup-deploy)
- Platform: Cloudflare Pages (web) + Cloudflare Worker (api)
- Production URL: https://baqsha-ai.nurbakhyt.workers.dev
- Deploy workflow: auto-deploy on push to main — Cloudflare Pages picks it up automatically
- Deploy status command: HTTP health check at https://baqsha-ai.nurbakhyt.workers.dev
- Merge method: merge commit
- Project type: e-commerce web app (Next.js frontend + Cloudflare Worker API)
- Post-deploy health check: https://baqsha-ai.nurbakhyt.workers.dev

### Custom deploy hooks
- Pre-merge: `pnpm build` (verify build passes)
- Deploy trigger: push to main (Cloudflare Pages auto-deploy for web; `pnpm deploy:worker` for worker)
- Deploy status: poll production URL until 200 response
- Health check: https://baqsha-ai.nurbakhyt.workers.dev
