# N8N + Supabase + MCP Setup Guide

Complete step-by-step guide for setting up the website generation queue system with MCP (Model Context Protocol) integrations.

> **Note**: This guide uses GUI instructions only - no terminal commands required.

---

## Table of Contents

1. [Supabase Setup](#part-1-supabase-setup)
2. [N8N Setup](#part-2-n8n-setup)
3. [MCP Server Setup](#part-3-mcp-server-setup)
4. [Connect Your React App](#part-4-connect-your-react-app)
5. [Testing](#part-5-testing)
6. [GitHub Integration](#part-6-github-integration)
7. [Cloud Run Deployment](#part-7-cloud-run-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Part 1: Supabase Setup

### Step 1.1: Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **Settings** (gear icon) in the left sidebar
3. Click **API** under Configuration
4. Copy these values (you'll need them later):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: (for your React app)
   - **service_role secret key**: (for N8N - keep this secret!)

### Step 1.2: Enable Realtime for Job Updates

1. In Supabase, go to **Database** → **Replication**
2. Click on **Source** next to `supabase_realtime`
3. Find `generation_jobs` table and toggle it **ON**
4. This allows the React app to receive live job updates

### Step 1.3: Add Required Columns to Profiles Table

1. Go to **Table Editor** → **profiles**
2. Click **+ New Column** and add these columns:

| Name | Type | Default | Nullable |
|------|------|---------|----------|
| `github_access_token` | text | (empty) | Yes |
| `gcloud_project_id` | text | (empty) | Yes |

3. Click **Save** after adding each column

### Step 1.4: Add input_payload Column to Generation Jobs

1. Go to **Table Editor** → **generation_jobs**
2. Click **+ New Column** and add:
   - **Name**: `input_payload`
   - **Type**: `jsonb`
   - **Default**: (leave empty)
   - **Nullable**: Yes
3. Click **Save**

---

## Part 2: N8N Setup

### Step 2.1: Create N8N Account

1. Go to [n8n.io](https://n8n.io) and sign up for free
2. Once logged in, you'll see your N8N dashboard

### Step 2.2: Create Supabase Credential in N8N

1. In N8N, click your **profile icon** (bottom left) → **Settings**
2. Go to **Credentials** → **Add Credential**
3. Search for **Supabase** and select it
4. Fill in:
   - **Credential Name**: `Supabase` (must be exactly this)
   - **Host**: Your Supabase URL (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Secret**: Your `service_role` key from Step 1.1
5. Click **Save**

### Step 2.3: Import the MCP-Enhanced Workflow

1. In N8N, click **Workflows** in the left sidebar
2. Click **Add Workflow** → **Import from File**
3. Upload the file: `n8n/website-generation-workflow-mcp.json`
4. The workflow will open with all nodes configured

### Step 2.4: Get Your Webhook URL

1. In the imported workflow, click the **Job Created Webhook** node (first node)
2. Look at the **Webhook URLs** section at the bottom
3. Copy the **Production URL** - it looks like:
   ```
   https://your-name.app.n8n.cloud/webhook/rankforge/job-created
   ```
4. Save this URL - you'll add it to your React app

### Step 2.5: Activate the Workflow

1. In the top-right corner, toggle the **Active** switch to ON
2. The workflow is now running and will:
   - Poll for new jobs every 30 seconds
   - Respond instantly to webhook triggers

---

## Part 3: MCP Server Setup

MCP (Model Context Protocol) servers enhance the workflow with AI-powered capabilities. All MCP servers are **optional** - the workflow falls back to standard HTTP calls if they're not configured.

### 3.1: Enable MCP in N8N

1. In N8N, go to **Settings** → **AI & Automation**
2. Toggle **MCP (Model Context Protocol)** to **ON**
3. You'll now see MCP options in AI nodes

### 3.2: Brave Search MCP (SEO Keywords)

**What it does**: Researches trending SEO keywords for your business niche and location before generating content.

**Setup Instructions**:

1. **Get Brave Search API Key**
   - Go to [brave.com/search/api](https://brave.com/search/api/)
   - Sign up and get a free API key (2,000 queries/month free)
   - Copy your API key

2. **Install Brave Search MCP**
   - In N8N, go to **Settings** → **MCP Servers**
   - Click **Add MCP Server**
   - Fill in:
     - **Name**: `Brave Search`
     - **Type**: `stdio`
     - **Command**: `npx`
     - **Arguments**: `@anthropic/mcp-server-brave-search`
     - **Environment Variables**:
       ```
       BRAVE_API_KEY=your-api-key-here
       ```
   - Click **Save**

3. **Verify Connection**
   - The server should show "Connected" status
   - Available tools: `brave_web_search`, `brave_local_search`

**N8N Cloud Alternative** (if you can't run npx):
1. Use the HTTP Request node instead
2. In the workflow, the "MCP - Brave Search Keywords" node can be replaced with:
   - HTTP Request to `https://api.search.brave.com/res/v1/web/search`
   - Header: `X-Subscription-Token: your-api-key`

---

### 3.3: GitHub MCP (Repository Management)

**What it does**: Enhanced GitHub operations including repo creation, file management, and issue tracking.

**Setup Instructions**:

1. **Get GitHub Personal Access Token**
   - Go to [github.com/settings/tokens](https://github.com/settings/tokens)
   - Click **Generate new token (classic)**
   - Select scopes: `repo`, `delete_repo`
   - Copy the token

2. **Install GitHub MCP**
   - In N8N, go to **Settings** → **MCP Servers**
   - Click **Add MCP Server**
   - Fill in:
     - **Name**: `GitHub`
     - **Type**: `stdio`
     - **Command**: `npx`
     - **Arguments**: `@modelcontextprotocol/server-github`
     - **Environment Variables**:
       ```
       GITHUB_PERSONAL_ACCESS_TOKEN=your-token-here
       ```
   - Click **Save**

3. **Available Tools**:
   - `create_repository` - Create new repos
   - `push_files` - Push multiple files at once
   - `create_issue` - Create issues
   - `create_pull_request` - Create PRs
   - `search_repositories` - Search GitHub

**Note**: The workflow includes a fallback HTTP node that uses the user's GitHub token if MCP isn't configured.

---

### 3.4: Google Cloud MCP (Cloud Run Deployment)

**What it does**: Triggers Google Cloud Build to deploy websites to Cloud Run automatically.

**Setup Instructions**:

1. **Set Up Google Cloud Project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project or select an existing one
   - Enable these APIs:
     - Cloud Build API
     - Cloud Run API
     - Container Registry API

2. **Create Service Account**
   - Go to **IAM & Admin** → **Service Accounts**
   - Click **Create Service Account**
   - Name: `n8n-deployment`
   - Grant roles:
     - Cloud Build Editor
     - Cloud Run Admin
     - Storage Admin
   - Click **Create Key** → **JSON**
   - Download the JSON key file

3. **Install Google Cloud MCP**
   - In N8N, go to **Settings** → **MCP Servers**
   - Click **Add MCP Server**
   - Fill in:
     - **Name**: `Google Cloud`
     - **Type**: `stdio`
     - **Command**: `npx`
     - **Arguments**: `@anthropic/mcp-server-gcloud`
     - **Environment Variables**:
       ```
       GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
       ```
       OR paste the JSON content directly:
       ```
       GOOGLE_CLOUD_CREDENTIALS={"type":"service_account",...}
       ```
   - Click **Save**

4. **Add gcloud_project_id to User Profile**
   - Users need to add their Google Cloud project ID to their profile
   - In Supabase, update the profiles table or add a settings page in your app

**Available Tools**:
- `run_build` - Trigger Cloud Build
- `deploy_cloud_run` - Deploy to Cloud Run
- `list_services` - List Cloud Run services

---

### 3.5: Filesystem MCP (Optional - Local File Operations)

**What it does**: Read/write files locally. Useful for caching templates or storing generated files before pushing.

**Note**: Only works with self-hosted N8N, not N8N Cloud.

**Setup Instructions**:

1. **Install Filesystem MCP**
   - In N8N settings, add MCP Server:
     - **Name**: `Filesystem`
     - **Type**: `stdio`
     - **Command**: `npx`
     - **Arguments**: `@modelcontextprotocol/server-filesystem /allowed/path`
   - Click **Save**

2. **Available Tools**:
   - `read_file` - Read file contents
   - `write_file` - Write/create files
   - `list_directory` - List directory contents

---

## Part 4: Connect Your React App

### Step 4.1: Update Environment Variables

1. Open your project folder
2. Open (or create) `.env.local` file
3. Add/update these values:

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# N8N Webhook (from Step 2.4)
VITE_N8N_WEBHOOK_URL=https://your-name.app.n8n.cloud/webhook/rankforge/job-created
```

### Step 4.2: Restart Dev Server

1. Stop your dev server (Ctrl+C in terminal)
2. Run `npm run dev` again
3. The app will now use the N8N queue

---

## Part 5: Testing

### Step 5.1: Test the Queue

1. Open your app at `http://localhost:3000`
2. Go to **Websites** → **New Website**
3. Fill out the wizard and click **Generate**
4. You should see:
   - "In Queue" with position number
   - Progress updates as each step completes:
     - "Researching keywords" (MCP Brave Search)
     - "Generating website files"
     - "GitHub repository created"
     - "Deploying to Cloud Run" (if configured)

### Step 5.2: Monitor in N8N

1. In N8N, go to **Executions** (left sidebar)
2. You should see your workflow running
3. Click on an execution to see step-by-step progress
4. MCP nodes will show their responses in the output

### Step 5.3: Check Supabase

1. In Supabase, go to **Table Editor** → **generation_jobs**
2. You should see your job with:
   - `status`: changes from `pending` → `processing` → `completed`
   - `progress_percent`: increases as steps complete
   - `current_step`: shows what's happening
   - `output_result`: includes SEO keywords and repo URL

---

## Part 6: GitHub Integration

For users to push generated websites to their own GitHub:

### Step 6.1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - **Application name**: `RankForge`
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it

### Step 6.2: Add GitHub Credentials to App

Add to your `.env.local`:

```env
VITE_GITHUB_CLIENT_ID=your-client-id
```

### Step 6.3: How It Works

1. Users connect GitHub in **Settings** → **Integrations**
2. Their OAuth token is stored in `profiles.github_access_token`
3. N8N reads this token and uses it to create repos on their behalf
4. Each user's websites go to their own GitHub account

---

## Part 7: Cloud Run Deployment

### Step 7.1: Enable for Users

1. Add a settings page where users can enter their Google Cloud project ID
2. Store it in `profiles.gcloud_project_id`
3. The workflow checks this field and deploys if it's set

### Step 7.2: Workflow Behavior

If `gcloud_project_id` is set:
1. After pushing to GitHub, the workflow triggers Cloud Build
2. Cloud Build uses the `cloudbuild.yaml` in the repo
3. Builds a Docker image and deploys to Cloud Run
4. Returns the live URL (e.g., `https://my-website-abc123-uc.a.run.app`)

---

## Troubleshooting

### MCP Server Not Connecting

**Check server status:**
1. Go to N8N → Settings → MCP Servers
2. Click on the server - it should show "Connected"
3. If "Disconnected", check the environment variables

**Verify API keys:**
- Brave Search: Test at `brave.com/search/api/dashboard`
- GitHub: Test with `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user`
- Google Cloud: Run `gcloud auth activate-service-account --key-file=your-key.json`

### Jobs Stuck in "pending"

**Check N8N is active:**
1. Go to N8N → Workflows
2. Make sure the workflow toggle is ON (green)

**Check Supabase credentials:**
1. N8N → Settings → Credentials
2. Click on Supabase credential
3. Verify the Host and Service Role Key are correct

### Jobs Fail at MCP Node

**The workflow has fallbacks:**
- If Brave Search fails → Uses default keywords
- If GitHub MCP fails → Uses HTTP API with user's token

**Check node output:**
1. In N8N Executions, click on the failed execution
2. Click on the MCP node to see the error
3. Common issues:
   - API key expired or invalid
   - Rate limit exceeded
   - Permissions insufficient

### Real-time Updates Not Working

**Enable Realtime:**
1. Supabase → Database → Replication
2. Make sure `generation_jobs` has realtime enabled

**Check browser console:**
1. Open browser DevTools (F12)
2. Look for WebSocket connection errors

---

## Architecture Summary

```
User Creates Website
        ↓
┌───────────────────────────────────────────────────────┐
│   React App                                           │
│   - Creates job in Supabase                          │
│   - Calls N8N webhook                                │
│   - Subscribes to Realtime updates                   │
└─────────────────────┬─────────────────────────────────┘
                      ↓
┌───────────────────────────────────────────────────────┐
│   N8N Workflow (MCP Enhanced)                        │
│                                                       │
│   1. Mark job as processing                          │
│   2. [MCP] Brave Search → SEO keywords               │
│   3. Generate website files with keywords            │
│   4. [MCP] GitHub → Create repository                │
│   5. Push files to GitHub                            │
│   6. [MCP] Google Cloud → Deploy to Cloud Run        │
│   7. Mark as completed                               │
└─────────────────────┬─────────────────────────────────┘
                      ↓
┌───────────────────────────────────────────────────────┐
│   Supabase                                           │
│   - Stores job status and progress                   │
│   - Broadcasts updates via Realtime                  │
└─────────────────────┬─────────────────────────────────┘
                      ↓
┌───────────────────────────────────────────────────────┐
│   React App                                           │
│   - Receives live updates                            │
│   - Shows progress bar and status                    │
│   - Displays repo URL and deployment link            │
└───────────────────────────────────────────────────────┘
```

---

## MCP Benefits Summary

| MCP Server | Benefit | Fallback |
|------------|---------|----------|
| **Brave Search** | Real SEO keywords based on actual search data | Default keywords from business niche |
| **GitHub** | Enhanced repo operations, better error handling | Standard GitHub API via HTTP |
| **Google Cloud** | One-click Cloud Run deployment | Manual deployment required |
| **Filesystem** | Local template caching (self-hosted only) | In-memory processing |

---

## FAQ

**Q: Do I need all MCP servers?**
A: No, they're all optional. Start with just the basic workflow and add MCP servers as needed.

**Q: Do I need N8N paid plan?**
A: No, the free tier works. MCP servers may have their own usage limits.

**Q: Can multiple users generate websites at once?**
A: Yes! The workflow processes up to 3 jobs concurrently. Additional jobs wait in queue.

**Q: Where are the generated files stored?**
A: If GitHub is connected, files go to the user's GitHub repo. Otherwise, the file content is stored in the job's `output_result` field in Supabase.

**Q: How do I add more MCP servers?**
A: Check the [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for more options. Add them in N8N Settings → MCP Servers.

**Q: What if Brave Search hits rate limits?**
A: The free tier has 2,000 queries/month. For higher volume, upgrade to a paid plan or the workflow falls back to default keywords.
