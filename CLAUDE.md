# RankForge Platform - Claude Code Instructions

## Project Overview

RankForge is an AI-powered website generation platform that creates SEO-optimized static websites for local service businesses. It generates 30-100+ page websites and auto-deploys to GitHub and Google Cloud Run.

**Full architecture docs**: `/Users/cosmodrome/Library/Mobile Documents/iCloud~md~obsidian/Documents/Second Brain/8 - Projects/Rank n Bank/Platform/RankForge Architecture.md`

## Quick Start

```bash
# Terminal 1: Start frontend
cd /Users/cosmodrome/Local\ Sites/rank-n-bank-platform
npm run dev

# Terminal 2: Start workers (ONLY ONE INSTANCE!)
cd /Users/cosmodrome/Local\ Sites/rank-n-bank-platform/workers
npm run dev
```

**IMPORTANT**: Only run ONE worker instance. Multiple instances cause race conditions.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **AI**: Google Gemini 2.5 Pro
- **Deployment**: GitHub + GitHub Actions + Google Cloud Run

## Key Directories

```
/components/          # React components
/services/            # Frontend services (CLEANED - only active services)
  - auth.ts           # Authentication helpers
  - db.ts             # Database queries
  - geminiService.ts  # Frontend AI preview
  - jobQueue.ts       # Job creation and subscriptions
  - websiteGenerator.ts # Types for BusinessInput
/lib/                 # Supabase client
/supabase/functions/  # Deno Edge Functions
/workers/src/         # Node.js background workers
  /workers/           # Active workers (CLEANED)
    - unified-generation.worker.ts  # Main AI orchestrator
    - site-builder.worker.ts        # HTML/CSS generation
    - deployment.worker.ts          # GitHub push + secrets
  /lib/               # Shared utilities
```

## Important Files

| File | Purpose |
|------|---------|
| `components/WebsiteWizard.tsx` | Website creation wizard |
| `components/WebsiteSettings.tsx` | Website management, triggers generation |
| `services/jobQueue.ts` | Creates jobs, subscribes to progress |
| `workers/src/workers/unified-generation.worker.ts` | Main AI generation orchestrator |
| `workers/src/workers/site-builder.worker.ts` | Generates HTML/CSS/JS files |
| `workers/src/workers/deployment.worker.ts` | GitHub deployment + secrets |
| `workers/src/lib/html-builder.ts` | Static HTML generation |
| `workers/src/lib/seo-generation.ts` | Gemini API integration |

## Worker Pipeline

```
full_generation job (UnifiedGenerationWorker)
  ↓ AI generates architecture, design, content
  ↓ Creates site_build job & waits

site_build job (SiteBuilderWorker)
  ↓ Generates HTML, CSS, JS, sitemap, robots.txt
  ↓ Generates Dockerfile, nginx.conf, GitHub Actions workflow
  ↓ Returns files in output_result

deployment job (DeploymentWorker)
  ↓ Creates/updates GitHub repo
  ↓ Pushes all files (flat via Git Data API, nested via Contents API)
  ↓ Sets up GitHub secrets (GCP_PROJECT_ID, GCP_SA_KEY)

GitHub Actions (triggered on push to main)
  ↓ Creates Artifact Registry repo if needed
  ↓ Builds & pushes Docker image
  ↓ Deploys to Cloud Run
  → Live URL: https://{service}-{hash}.{region}.run.app
```

## Database Tables

- `profiles` - User accounts, GitHub/GCP credentials
- `businesses` - Business info (name, address, services)
- `websites` - Website records, status, URLs
- `generation_jobs` - Job queue with status/progress

## Environment Variables

### Frontend (`.env.local`)
```
VITE_SUPABASE_URL=https://iqcbuqmhqljuwzpvsqmr.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Workers (`/workers/.env`)
```
SUPABASE_URL=https://iqcbuqmhqljuwzpvsqmr.supabase.co
SUPABASE_SERVICE_KEY=... (service role)
GEMINI_API_KEY=AIzaSy...
```

## Common Tasks

### Deploy Edge Function
```bash
npx supabase functions deploy <function-name> --no-verify-jwt
```

### Check Worker Logs
Workers log to console. Look for `[WorkerName]` prefixes.

### Kill Zombie Workers
```bash
pkill -f "tsx.*rank-n-bank-platform/workers"
```

### Restart Workers
Kill any existing processes, then restart with single `npm run dev`

## Known Constraints

### Only ONE Worker Instance
Running multiple worker instances causes:
- Race conditions on job claims
- Jobs showing progress in UI but logs show "0 jobs returned"
- Duplicate processing attempts

### Cloud Run Memory
- Must use `--memory 512Mi` with `--cpu-throttling`
- `256Mi` with `--no-cpu-throttling` causes errors

### GitHub Nested Directories
- Git Data API with `base_tree` can't create nested dirs like `.github/workflows/`
- DeploymentWorker uses full tree approach for deployment files

### GitHub Actions Auto-Deploy
Requires these secrets in the repo (auto-created by DeploymentWorker):
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GCP_SA_KEY` - Service account JSON key

**Required GCP Service Account Roles:**
```
- Artifact Registry Administrator (or Writer)
- Cloud Run Admin (or Developer)
- Service Account User
```

The GitHub Actions workflow automatically:
1. Creates Artifact Registry repo `cloud-run-source-deploy` if not exists
2. Builds Docker image from Dockerfile
3. Pushes to Artifact Registry
4. Deploys to Cloud Run with correct settings

## Debugging Tips

1. **Jobs stuck in pending**: Check only ONE worker is running
2. **Jobs show progress but logs say "0 jobs"**: Kill all workers, restart ONE
3. **Gemini errors**: Verify `GEMINI_API_KEY` in `/workers/.env`
4. **GitHub push fails**: Check `github_access_token` in profiles table
5. **Cloud Run deploy fails**: Check service account permissions
6. **Real-time not updating**: Check Supabase realtime is enabled for `generation_jobs`
7. **`.github/workflows/` not created**: Check deployment logs for Git Data API approach

## Related Obsidian Docs

- `RankForge Architecture.md` - Full system architecture
- `system prompt - website generator.md` - SEO generation prompt (1000+ lines)
- `Concurrency Queue Architecture.md` - Job queue design
