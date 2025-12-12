/**
 * Supabase Edge Function: Deploy to Cloud Run
 * Deploys a static website from GitHub to Cloud Run with continuous deployment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeployRequest {
  jobId: string;
  websiteId: string;
  userId: string;
  serviceName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId, websiteId, userId, serviceName } = await req.json() as DeployRequest;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update job to processing
    await supabase
      .from('generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        current_step: 'Loading configuration',
        progress_percent: 10,
      })
      .eq('id', jobId);

    // Get user's Google Cloud credentials
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gcloud_service_account_key, gcloud_project_id, github_access_token')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.gcloud_service_account_key || !profile?.gcloud_project_id) {
      throw new Error('Google Cloud not configured. Please add your service account key in Integrations.');
    }

    if (!profile?.github_access_token) {
      throw new Error('GitHub not connected. Please connect GitHub in Integrations.');
    }

    // Get website's GitHub repo
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .select('github_repo_url, slug')
      .eq('id', websiteId)
      .single();

    if (websiteError || !website?.github_repo_url) {
      throw new Error('Website has no GitHub repository. Please generate the website first.');
    }

    const serviceAccountKey = JSON.parse(profile.gcloud_service_account_key);
    const projectId = profile.gcloud_project_id;
    const region = 'us-central1';

    // Parse GitHub URL to get owner/repo
    const repoMatch = website.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }
    const [, repoOwner, repoName] = repoMatch;

    // Update progress
    await supabase
      .from('generation_jobs')
      .update({
        current_step: 'Getting access token',
        progress_percent: 20,
      })
      .eq('id', jobId);

    // Get GCP access token
    const accessToken = await getAccessToken(serviceAccountKey);

    // Update progress
    await supabase
      .from('generation_jobs')
      .update({
        current_step: 'Building and deploying to Cloud Run',
        progress_percent: 40,
      })
      .eq('id', jobId);

    // Use Cloud Build to build from GitHub and deploy to Cloud Run
    // This approach clones the repo using the GitHub token
    const buildResult = await triggerCloudBuild(
      accessToken,
      projectId,
      repoOwner,
      repoName,
      serviceName,
      region,
      profile.github_access_token
    );

    if (!buildResult.success) {
      throw new Error(buildResult.error || 'Failed to trigger build');
    }

    // Wait for the build to complete
    await supabase
      .from('generation_jobs')
      .update({
        current_step: 'Building and deploying (this may take 2-3 minutes)',
        progress_percent: 50,
      })
      .eq('id', jobId);

    // Poll for build completion (max 5 minutes)
    const buildId = buildResult.buildId!;
    let buildComplete = false;
    let buildSuccess = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 10s = 5 minutes

    while (!buildComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

      const buildStatus = await checkBuildStatus(accessToken, projectId, buildId);

      if (buildStatus.status === 'SUCCESS') {
        buildComplete = true;
        buildSuccess = true;
      } else if (buildStatus.status === 'FAILURE' || buildStatus.status === 'CANCELLED' || buildStatus.status === 'TIMEOUT') {
        buildComplete = true;
        buildSuccess = false;
        throw new Error(`Build ${buildStatus.status.toLowerCase()}. Check Cloud Build logs in Google Cloud Console for details.`);
      }

      attempts++;

      // Update progress
      const progress = Math.min(50 + (attempts * 1.5), 90);
      await supabase
        .from('generation_jobs')
        .update({
          progress_percent: progress,
        })
        .eq('id', jobId);
    }

    if (!buildComplete) {
      throw new Error('Build timed out. Check Cloud Build logs in Google Cloud Console.');
    }

    // Get the service URL
    await supabase
      .from('generation_jobs')
      .update({
        current_step: 'Getting service URL',
        progress_percent: 95,
      })
      .eq('id', jobId);

    const serviceResponse = await fetch(
      `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    let serviceUrl: string;
    if (serviceResponse.ok) {
      const service = await serviceResponse.json() as { uri?: string };
      serviceUrl = service.uri || `https://${serviceName}-${projectId.replace(/[^a-z0-9]/g, '')}.${region}.run.app`;
    } else {
      serviceUrl = `https://${serviceName}-${projectId.replace(/[^a-z0-9]/g, '')}.${region}.run.app`;
    }

    // Update job as completed
    await supabase
      .from('generation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_step: 'Deployment complete',
        progress_percent: 100,
        output_result: {
          serviceUrl,
          serviceName,
          projectId,
          region,
          repoOwner,
          repoName,
        },
      })
      .eq('id', jobId);

    // Update website with Cloud Run URL
    await supabase
      .from('websites')
      .update({
        cloud_run_service_url: serviceUrl,
      })
      .eq('id', websiteId);

    return new Response(
      JSON.stringify({
        success: true,
        serviceUrl,
        serviceName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Cloud Run deploy error:', err);

    // Try to update job as failed
    try {
      const { jobId } = await req.clone().json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase
        .from('generation_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { message: err.message },
        })
        .eq('id', jobId);
    } catch {}

    // Return 200 with error in body so client can display the actual error message
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Trigger Cloud Build to build and deploy from GitHub
 * Uses Cloud Build with inline Dockerfile for static site hosting
 */
async function triggerCloudBuild(
  accessToken: string,
  projectId: string,
  repoOwner: string,
  repoName: string,
  serviceName: string,
  region: string,
  githubToken: string
): Promise<{ success: boolean; buildId?: string; error?: string }> {
  // Use Artifact Registry instead of deprecated Container Registry
  const imageUri = `${region}-docker.pkg.dev/${projectId}/cloud-run-source-deploy/${serviceName}:latest`;

  // Build configuration that:
  // 1. Clones the GitHub repo using the token
  // 2. Builds a Docker image with nginx to serve static files
  // 3. Pushes to Artifact Registry
  // 4. Deploys to Cloud Run with proper resource settings
  const buildConfig = {
    steps: [
      // Step 1: Clone the repository
      {
        name: 'gcr.io/cloud-builders/git',
        args: ['clone', `https://x-access-token:${githubToken}@github.com/${repoOwner}/${repoName}.git`, '.'],
      },
      // Step 2: Create a Dockerfile for static hosting if it doesn't exist
      {
        name: 'bash',
        args: [
          '-c',
          `if [ ! -f Dockerfile ]; then
            echo 'FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 8080
RUN sed -i "s/listen       80;/listen       8080;/" /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]' > Dockerfile
          fi`
        ],
      },
      // Step 3: Build the Docker image
      {
        name: 'gcr.io/cloud-builders/docker',
        args: ['build', '-t', imageUri, '.'],
      },
      // Step 4: Push to Artifact Registry
      {
        name: 'gcr.io/cloud-builders/docker',
        args: ['push', imageUri],
      },
      // Step 5: Deploy to Cloud Run with proper settings
      // NOTE: --cpu-throttling (default) allows 256Mi, --no-cpu-throttling requires 512Mi minimum
      {
        name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
        entrypoint: 'gcloud',
        args: [
          'run', 'deploy', serviceName,
          '--image', imageUri,
          '--region', region,
          '--platform', 'managed',
          '--allow-unauthenticated',
          '--port', '8080',
          '--memory', '512Mi',
          '--cpu', '1',
          '--min-instances', '0',
          '--max-instances', '2',
          '--cpu-throttling',
        ],
      },
    ],
    options: {
      logging: 'CLOUD_LOGGING_ONLY',
    },
    images: [imageUri],
  };

  const response = await fetch(
    `https://cloudbuild.googleapis.com/v1/projects/${projectId}/builds`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildConfig),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cloud Build error response:', errorText);

    // Parse the error for more helpful message
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        return { success: false, error: `Cloud Build failed: ${errorJson.error.message}` };
      }
    } catch {}

    return { success: false, error: `Cloud Build failed: ${errorText}` };
  }

  const result = await response.json() as { metadata?: { build?: { id?: string } } };
  const buildId = result.metadata?.build?.id;

  if (!buildId) {
    return { success: false, error: 'Cloud Build started but no build ID returned' };
  }

  return { success: true, buildId };
}

/**
 * Check Cloud Build status
 */
async function checkBuildStatus(
  accessToken: string,
  projectId: string,
  buildId: string
): Promise<{ status: string }> {
  const response = await fetch(
    `https://cloudbuild.googleapis.com/v1/projects/${projectId}/builds/${buildId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    return { status: 'UNKNOWN' };
  }

  const build = await response.json() as { status?: string };
  return { status: build.status || 'UNKNOWN' };
}

/**
 * Get OAuth2 access token using service account JWT
 */
async function getAccessToken(serviceAccountKey: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp,
  };

  const jwt = await signJwt(header, payload, serviceAccountKey.private_key);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Sign a JWT using RSA-SHA256
 */
async function signJwt(header: object, payload: object, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(message)
  );

  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${message}.${signatureB64}`;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
