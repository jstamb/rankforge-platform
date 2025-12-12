import { BaseWorker } from '../lib/worker-base.js';
import { updateWebsiteStatus, supabase } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';
import { Octokit } from 'octokit';
import sodium from 'tweetsodium';

interface GeneratedFile {
  path: string;
  content: string;
}

export class DeploymentWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Deployment',
      jobTypes: ['deployment'],  // Only handle deployment jobs - full_generation handled by UnifiedGenerationWorker
      pollInterval: 5000,
      maxConcurrent: 2,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 5;
    let completedSteps = 0;

    const inputPayload = job.input_payload as any || {};
    let business = inputPayload.business;
    const options = inputPayload.options || { deployToGithub: true }; // Default to deploying to GitHub

    // If business not in payload, fetch from database
    if (!business) {
      const { data: website } = await supabase
        .from('websites')
        .select('business_id')
        .eq('id', job.website_id)
        .single();

      if (website?.business_id) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', website.business_id)
          .single();

        business = businessData ? {
          businessName: businessData.business_name,
          phone: businessData.phone,
          email: businessData.email,
          address: {
            street: businessData.address_street,
            city: businessData.address_city,
            state: businessData.address_state,
            zip: businessData.address_zip,
          },
        } : null;
      }
    }

    if (!business) {
      throw new Error('Business data not found');
    }

    // Step 1: Get user's GitHub token and site build files
    this.currentStep = 'Checking deployment credentials';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token, gcloud_service_account_key, gcloud_project_id')
      .eq('id', job.user_id)
      .single();

    if (!profile?.github_access_token && options.deployToGithub) {
      throw new Error('GitHub access token not found. Please connect your GitHub account.');
    }

    // Check for GCP credentials for auto-deploy
    const hasGCPCredentials = profile?.gcloud_service_account_key && profile?.gcloud_project_id;

    // Get files from the site_build job output
    let files: GeneratedFile[] = inputPayload.files || [];

    if (files.length === 0) {
      // Try to get files from the most recent completed site_build job
      const { data: siteBuildJob } = await supabase
        .from('generation_jobs')
        .select('output_result')
        .eq('website_id', job.website_id)
        .eq('job_type', 'site_build')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (siteBuildJob?.output_result?.files) {
        files = siteBuildJob.output_result.files as GeneratedFile[];
      }
    }

    console.log(`[Deployment] Found ${files.length} files to deploy`);
    console.log(`[Deployment] Files before ensureDeploymentFiles:`, files.map(f => f.path).sort());

    // Ensure deployment files are correct (fix old files that may have wrong port)
    files = this.ensureDeploymentFiles(files, business.businessName);
    console.log(`[Deployment] After ensuring deployment files: ${files.length} files`);

    // Log deployment-related files specifically
    const deployFiles = files.filter(f =>
      f.path.includes('github') || f.path.includes('cloudbuild') ||
      f.path === 'Dockerfile' || f.path === 'nginx.conf'
    );
    console.log(`[Deployment] Deployment files after ensure:`, deployFiles.map(f => f.path));

    completedSteps++;

    let repoUrl = '';
    let deploymentUrl = '';

    if (options.deployToGithub && profile?.github_access_token) {
      const octokit = new Octokit({ auth: profile.github_access_token });
      const { data: user } = await octokit.rest.users.getAuthenticated();

      // Step 2: Create GitHub repository
      this.currentStep = 'Creating GitHub repository';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      const repoName = `${business.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-website`;
      const sanitizedRepoName = repoName.replace(/[^a-z0-9-]/g, '-');
      console.log(`[Deployment] Business name: "${business.businessName}", Repo name: "${sanitizedRepoName}"`);

      let repoExists = false;
      try {
        const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
          name: sanitizedRepoName,
          description: `Website for ${business.businessName} - Generated by RankForge`,
          private: false,
          auto_init: false, // Don't auto-init, we'll push all files at once
        });

        repoUrl = repo.html_url;
        console.log(`[Deployment] Created repository: ${repoUrl}`);
      } catch (error: any) {
        if (error.status === 422) {
          repoUrl = `https://github.com/${user.login}/${sanitizedRepoName}`;
          repoExists = true;
          console.log(`[Deployment] Repository already exists: ${repoUrl}`);
        } else {
          throw error;
        }
      }

      completedSteps++;

      // Step 3: Push files to GitHub using Git Data API (create tree + commit)
      this.currentStep = `Pushing ${files.length} files to GitHub`;
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      // Wait for repo to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (files.length > 0) {
        try {
          // Get base tree SHA (if repo exists with commits)
          let baseTreeSha: string | undefined;
          let parentCommitSha: string | undefined;

          if (repoExists) {
            try {
              const { data: ref } = await octokit.rest.git.getRef({
                owner: user.login,
                repo: sanitizedRepoName,
                ref: 'heads/main',
              });
              parentCommitSha = ref.object.sha;

              const { data: commit } = await octokit.rest.git.getCommit({
                owner: user.login,
                repo: sanitizedRepoName,
                commit_sha: parentCommitSha,
              });
              baseTreeSha = commit.tree.sha;
            } catch (e: any) {
              // No existing commits, start fresh
              console.log(`[Deployment] No existing commits, creating initial commit. Error: ${e.message}`);
            }
          }

          console.log(`[Deployment] repoExists: ${repoExists}, baseTreeSha: ${baseTreeSha}, parentCommitSha: ${parentCommitSha}`);

          // Separate files into flat files (no directory path) and nested files (contain /)
          // Git Data API works for flat files but fails to create nested directories
          // Contents API properly handles nested paths like .github/workflows/deploy.yml
          const flatFiles = files.filter(f => !f.path.includes('/'));
          const nestedFiles = files.filter(f => f.path.includes('/'));

          console.log(`[Deployment] File breakdown: ${flatFiles.length} flat files, ${nestedFiles.length} nested files`);
          console.log(`[Deployment] Flat files:`, flatFiles.map(f => f.path));
          console.log(`[Deployment] Nested files:`, nestedFiles.map(f => f.path));

          // Step 1: Push flat files using Git Data API (efficient for bulk operations)
          if (flatFiles.length > 0) {
            // Create blobs only for flat files
            const flatBlobs = await Promise.all(
              flatFiles.map(async (file) => {
                const { data: blob } = await octokit.rest.git.createBlob({
                  owner: user.login,
                  repo: sanitizedRepoName,
                  content: Buffer.from(file.content).toString('base64'),
                  encoding: 'base64',
                });
                return {
                  path: file.path,
                  mode: '100644' as const,
                  type: 'blob' as const,
                  sha: blob.sha,
                };
              })
            );

            const { data: tree } = await octokit.rest.git.createTree({
              owner: user.login,
              repo: sanitizedRepoName,
              tree: flatBlobs,
              base_tree: baseTreeSha,
            });

            console.log(`[Deployment] Created tree for flat files: ${tree.sha}`);

            const { data: commit } = await octokit.rest.git.createCommit({
              owner: user.login,
              repo: sanitizedRepoName,
              message: `RankForge: Generated website with ${flatFiles.length} files\n\n🤖 Generated with RankForge`,
              tree: tree.sha,
              parents: parentCommitSha ? [parentCommitSha] : [],
            });

            console.log(`[Deployment] Created commit: ${commit.sha}`);

            // Update main branch reference
            try {
              await octokit.rest.git.updateRef({
                owner: user.login,
                repo: sanitizedRepoName,
                ref: 'heads/main',
                sha: commit.sha,
                force: true,
              });
            } catch (e) {
              await octokit.rest.git.createRef({
                owner: user.login,
                repo: sanitizedRepoName,
                ref: 'refs/heads/main',
                sha: commit.sha,
              });
            }

            console.log(`[Deployment] Successfully pushed ${flatFiles.length} flat files via Git Data API`);
          }

          // Step 2: Push nested files using Contents API (handles directory creation)
          if (nestedFiles.length > 0) {
            console.log(`[Deployment] Using Contents API for ${nestedFiles.length} nested files`);

            for (const file of nestedFiles) {
              console.log(`[Deployment] Pushing nested file: ${file.path}`);

              // Try to get existing file SHA (needed for updates)
              let existingSha: string | undefined;
              try {
                const { data: existingFile } = await octokit.rest.repos.getContent({
                  owner: user.login,
                  repo: sanitizedRepoName,
                  path: file.path,
                  ref: 'main',
                });
                if (!Array.isArray(existingFile) && existingFile.type === 'file') {
                  existingSha = existingFile.sha;
                }
              } catch (e: any) {
                // File doesn't exist, that's fine - we'll create it
                if (e.status !== 404) {
                  console.warn(`[Deployment] Warning checking existing file ${file.path}: ${e.message}`);
                }
              }

              // Create or update the file - Contents API auto-creates directories
              await octokit.rest.repos.createOrUpdateFileContents({
                owner: user.login,
                repo: sanitizedRepoName,
                path: file.path,
                message: `RankForge: ${existingSha ? 'Update' : 'Add'} ${file.path}\n\n🤖 Generated with RankForge`,
                content: Buffer.from(file.content).toString('base64'),
                branch: 'main',
                ...(existingSha && { sha: existingSha }),
              });

              console.log(`[Deployment] Successfully pushed ${file.path}`);
            }

            console.log(`[Deployment] Successfully pushed ${nestedFiles.length} nested files via Contents API`);
          }

          console.log(`[Deployment] Successfully pushed all ${files.length} files to ${repoUrl}`);
        } catch (error: any) {
          console.error('[Deployment] Error pushing files:', error.message);
          throw new Error(`Failed to push files to GitHub: ${error.message}`);
        }
      } else {
        // No files to push, create a README
        console.log('[Deployment] No files found, creating README only');
        try {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: user.login,
            repo: sanitizedRepoName,
            path: 'README.md',
            message: 'Initial commit - RankForge generated website',
            content: Buffer.from(
              `# ${business.businessName}\n\nWebsite generated by RankForge.\n\n## Setup\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Build\n\n\`\`\`bash\nnpm run build\n\`\`\`\n`
            ).toString('base64'),
          });
        } catch (error) {
          console.log('[Deployment] README already exists');
        }
      }

      // Set up GitHub secrets for auto-deploy if GCP credentials are available
      if (hasGCPCredentials) {
        this.currentStep = 'Setting up auto-deploy secrets';
        await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

        try {
          await this.setupGitHubSecrets(
            octokit,
            user.login,
            sanitizedRepoName,
            profile.gcloud_project_id!,
            profile.gcloud_service_account_key!
          );
          console.log(`[Deployment] GitHub secrets configured for auto-deploy`);
        } catch (error: any) {
          console.warn(`[Deployment] Failed to setup GitHub secrets: ${error.message}`);
          // Don't fail deployment, just warn - user can set up secrets manually
        }
      }

      completedSteps += 2;
    } else {
      // Skip GitHub steps
      completedSteps += 3;
    }

    // Step 5: Update website status
    this.currentStep = 'Finalizing deployment';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    await updateWebsiteStatus(job.website_id, 'deployed', {
      github_repo_url: repoUrl || null,
      cloud_run_service_url: deploymentUrl || null,
      last_deployed_at: new Date().toISOString(),
    });

    completedSteps++;
    await this.progress(job.id, 'Deployment complete', completedSteps, totalSteps);

    return {
      repoUrl,
      deploymentUrl,
      deployed: true,
    };
  }

  /**
   * Set up GitHub secrets for automatic Cloud Run deployment via GitHub Actions
   * Creates GCP_PROJECT_ID and GCP_SA_KEY secrets in the repository
   */
  private async setupGitHubSecrets(
    octokit: Octokit,
    owner: string,
    repo: string,
    projectId: string,
    serviceAccountKey: string
  ): Promise<void> {
    // Get the repository's public key for encrypting secrets
    const { data: publicKey } = await octokit.rest.actions.getRepoPublicKey({
      owner,
      repo,
    });

    // Helper function to encrypt a secret value
    const encryptSecret = (secretValue: string): string => {
      const messageBytes = Buffer.from(secretValue);
      const keyBytes = Buffer.from(publicKey.key, 'base64');
      const encryptedBytes = sodium.seal(messageBytes, keyBytes);
      return Buffer.from(encryptedBytes).toString('base64');
    };

    // Create/update GCP_PROJECT_ID secret
    console.log(`[Deployment] Creating GCP_PROJECT_ID secret for ${owner}/${repo}`);
    await octokit.rest.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: 'GCP_PROJECT_ID',
      encrypted_value: encryptSecret(projectId),
      key_id: publicKey.key_id,
    });

    // Create/update GCP_SA_KEY secret (the full service account JSON)
    console.log(`[Deployment] Creating GCP_SA_KEY secret for ${owner}/${repo}`);
    await octokit.rest.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: 'GCP_SA_KEY',
      encrypted_value: encryptSecret(serviceAccountKey),
      key_id: publicKey.key_id,
    });

    console.log(`[Deployment] GitHub secrets configured successfully`);
  }

  /**
   * Ensure deployment files are correct and present
   * This fixes old files that may have wrong port or missing GitHub Actions workflow
   */
  private ensureDeploymentFiles(files: GeneratedFile[], businessName: string): GeneratedFile[] {
    const serviceName = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Detect if this is a React/Vite app that needs building
    const hasPackageJson = files.some(f => f.path === 'package.json');
    const hasViteConfig = files.some(f => f.path === 'vite.config.ts' || f.path === 'vite.config.js');
    const needsBuild = hasPackageJson && hasViteConfig;

    // Multi-stage Dockerfile for React/Vite apps
    const viteBuildDockerfile = `# Build stage - compile React/Vite app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (use npm install since no package-lock.json exists)
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build the Vite app
RUN npm run build

# Production stage - serve built files with nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for Cloud Run (port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run requires port 8080
ENV PORT=8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]`;

    // Simple Dockerfile for pre-built static sites
    const staticDockerfile = `# Production-ready static site container
FROM nginx:alpine

# Copy all static files to nginx html directory
COPY . /usr/share/nginx/html

# Copy nginx config for Cloud Run (port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run requires port 8080
ENV PORT=8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]`;

    // Use appropriate Dockerfile based on project type
    const correctDockerfile = needsBuild ? viteBuildDockerfile : staticDockerfile;
    console.log(`[Deployment] Using ${needsBuild ? 'Vite/React build' : 'static'} Dockerfile`);

    // Correct nginx.conf with port 8080
    const correctNginxConf = `server {
    # Cloud Run requires port 8080
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Hide nginx version
    server_tokens off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Handle clean URLs for static HTML
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Cache static assets with security headers
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Deny access to sensitive files
    location ~* \\.(env|git|gitignore|dockerignore|md|yml|yaml|lock|log)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}`;

    // GitHub Actions workflow
    const githubActionsWorkflow = `name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: \${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: ${serviceName}
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: \${{ secrets.GCP_PROJECT_ID }}

      - name: Create Artifact Registry repository (if not exists)
        run: |
          gcloud artifacts repositories describe cloud-run-source-deploy \\
            --location=\${{ env.REGION }} \\
            --project=\${{ env.PROJECT_ID }} 2>/dev/null || \\
          gcloud artifacts repositories create cloud-run-source-deploy \\
            --repository-format=docker \\
            --location=\${{ env.REGION }} \\
            --project=\${{ env.PROJECT_ID }} \\
            --description="Docker images for Cloud Run deployments"

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker \${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Build Docker image
        run: |
          docker build -t \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} .
          docker tag \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:latest

      - name: Push Docker image
        run: |
          docker push \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }}
          docker push \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        id: deploy
        run: |
          gcloud run deploy \${{ env.SERVICE_NAME }} \\
            --image \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            --region \${{ env.REGION }} \\
            --platform managed \\
            --allow-unauthenticated \\
            --port 8080 \\
            --memory 512Mi \\
            --cpu 1 \\
            --min-instances 0 \\
            --max-instances 2 \\
            --cpu-throttling

      - name: Get Service URL
        run: |
          URL=\$(gcloud run services describe \${{ env.SERVICE_NAME }} --region \${{ env.REGION }} --format 'value(status.url)')
          echo "## 🚀 Deployment Successful!" >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "**Service URL:** \$URL" >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "Service deployed to: \$URL"
`;

    // cloudbuild.yaml as backup
    const cloudbuildYaml = `# Cloud Build configuration for automatic deployments
# Triggered by GitHub pushes when connected via Cloud Build

steps:
  # Build the Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'
      - '.'

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${serviceName}'
      - '--image'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'
      - '--region'
      - '\$_REGION'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '8080'
      - '--memory'
      - '512Mi'
      - '--cpu'
      - '1'
      - '--min-instances'
      - '0'
      - '--max-instances'
      - '2'
      - '--cpu-throttling'

images:
  - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'

substitutions:
  _REGION: us-central1

options:
  logging: CLOUD_LOGGING_ONLY
`;

    // Remove old versions and add correct ones
    const filesToEnsure = [
      { path: 'Dockerfile', content: correctDockerfile },
      { path: 'nginx.conf', content: correctNginxConf },
      { path: '.github/workflows/deploy.yml', content: githubActionsWorkflow },
      { path: 'cloudbuild.yaml', content: cloudbuildYaml },
    ];

    // Filter out old deployment files
    const filteredFiles = files.filter(f =>
      !['Dockerfile', 'nginx.conf', '.github/workflows/deploy.yml', 'cloudbuild.yaml'].includes(f.path)
    );

    // Add correct deployment files
    return [...filteredFiles, ...filesToEnsure];
  }
}
