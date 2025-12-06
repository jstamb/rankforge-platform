# RankForge Workers - Deployment Guide

## Prerequisites

1. **Google Cloud Project** with these APIs enabled:
   - Cloud Run
   - Cloud Build
   - Container Registry (or Artifact Registry)
   - Secret Manager

2. **gcloud CLI** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Secrets** stored in Google Secret Manager:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Supabase service role key (not anon key)
   - `GEMINI_API_KEY` - Google AI Studio API key

## Creating Secrets

```bash
# Create secrets in Secret Manager
echo -n "https://YOUR_PROJECT.supabase.co" | \
  gcloud secrets create SUPABASE_URL --data-file=-

echo -n "YOUR_SUPABASE_SERVICE_KEY" | \
  gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-

echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding SUPABASE_URL \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SUPABASE_SERVICE_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Deployment Options

### Option 1: Automated with Cloud Build (Recommended)

```bash
cd workers
gcloud builds submit --config cloudbuild.yaml
```

### Option 2: Manual Deployment

```bash
# Build locally
npm install
npm run build

# Build and push Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/rankforge-workers .
docker push gcr.io/YOUR_PROJECT_ID/rankforge-workers

# Deploy to Cloud Run
gcloud run deploy rankforge-workers \
  --image gcr.io/YOUR_PROJECT_ID/rankforge-workers \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets "SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

## Local Development

```bash
# Copy env example
cp .env.example .env

# Fill in your local .env values
# Then run:
npm install
npm run dev
```

## Architecture

The worker system consists of 6 specialized workers:

1. **SEO Research Worker** - Analyzes keywords, competitors, search intent
2. **Content Architecture Worker** - Plans hub-and-spoke site structure
3. **Content Generation Worker** - Creates page content with AI
4. **Design Generation Worker** - Generates unique Tailwind design systems
5. **Site Builder Worker** - Compiles complete React/Next.js website
6. **Deployment Worker** - Pushes to GitHub, deploys to hosting

Each worker polls for jobs of its type and processes them independently.

## Job Flow

For a `full_generation` job:
1. SEO Research runs first (type: `seo_research`)
2. Content Architecture plans the site (type: `content_architecture`)
3. Design Generation creates unique styles (type: `design_generation`)
4. Content Generation creates all pages (type: `content_generation`)
5. Site Builder compiles the website (type: `site_build`)
6. Deployment Worker publishes (type: `deployment`)

Jobs are chained via the `next_job_type` field in job output.

## Monitoring

- View logs: `gcloud run logs read --service rankforge-workers`
- Health check: `curl https://YOUR_SERVICE_URL/health`
- Cloud Run console: https://console.cloud.google.com/run

## Scaling

The Cloud Run service auto-scales based on:
- Min instances: 1 (always-on for job polling)
- Max instances: 10 (handles concurrent jobs)
- CPU: 1 vCPU per instance
- Memory: 1GB per instance

Adjust in `cloudbuild.yaml` or via gcloud commands as needed.
