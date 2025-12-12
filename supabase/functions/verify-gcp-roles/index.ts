/**
 * Supabase Edge Function: Verify GCP Roles
 * Checks if a service account has the required roles for Cloud Run deployment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyRequest {
  userId: string;
}

interface RoleCheckResult {
  role: string;
  displayName: string;
  required: boolean;
  found: boolean;
}

const REQUIRED_ROLES = [
  { role: 'roles/run.admin', displayName: 'Cloud Run Admin' },
  { role: 'roles/cloudbuild.builds.editor', displayName: 'Cloud Build Editor' },
  { role: 'roles/storage.admin', displayName: 'Storage Admin' },
  { role: 'roles/iam.serviceAccountUser', displayName: 'Service Account User' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json() as VerifyRequest;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's GCP credentials
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gcloud_service_account_key, gcloud_project_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.gcloud_service_account_key || !profile?.gcloud_project_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Google Cloud not configured',
          configured: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceAccountKey = JSON.parse(profile.gcloud_service_account_key);
    const projectId = profile.gcloud_project_id;
    const serviceAccountEmail = serviceAccountKey.client_email;

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey);

    // Check IAM policy for the project
    const iamResponse = await fetch(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!iamResponse.ok) {
      const errorText = await iamResponse.text();

      // Check for specific API not enabled error
      if (errorText.includes('Cloud Resource Manager API has not been used') ||
          errorText.includes('accessNotConfigured')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Cloud Resource Manager API not enabled. Please enable it in your GCP project.',
            configured: true,
            apiNotEnabled: true,
            enableUrl: `https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com?project=${projectId}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for permission denied error
      if (errorText.includes('403') || errorText.includes('permission') || errorText.includes('Permission')) {
        return new Response(
          JSON.stringify({
            success: true,
            configured: true,
            projectId,
            serviceAccountEmail,
            allRolesFound: false,
            roles: [],
            missingRoles: ['Unable to verify - service account needs "Security Reviewer" role or resourcemanager.projects.getIamPolicy permission'],
            permissionError: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Failed to get IAM policy: ${errorText}`);
    }

    const iamPolicy = await iamResponse.json() as { bindings?: Array<{ role: string; members: string[] }> };
    const bindings = iamPolicy.bindings || [];

    // Check each required role
    const roleResults: RoleCheckResult[] = REQUIRED_ROLES.map(({ role, displayName }) => {
      const binding = bindings.find(b => b.role === role);
      const found = binding?.members?.some(
        m => m === `serviceAccount:${serviceAccountEmail}`
      ) || false;

      return {
        role,
        displayName,
        required: true,
        found,
      };
    });

    // Also check for alternative roles that grant the same permissions
    // Cloud Build Editor can be granted via cloudbuild.builds.builder too
    const buildEditorResult = roleResults.find(r => r.role === 'roles/cloudbuild.builds.editor');
    if (buildEditorResult && !buildEditorResult.found) {
      const altBinding = bindings.find(b =>
        b.role === 'roles/cloudbuild.builds.builder' ||
        b.role === 'roles/cloudbuild.editor'
      );
      if (altBinding?.members?.some(m => m === `serviceAccount:${serviceAccountEmail}`)) {
        buildEditorResult.found = true;
      }
    }

    const allRolesFound = roleResults.every(r => r.found);
    const missingRoles = roleResults.filter(r => !r.found);

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        projectId,
        serviceAccountEmail,
        allRolesFound,
        roles: roleResults,
        missingRoles: missingRoles.map(r => r.displayName),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('GCP role verification error:', err);
    // Always return 200 with error in body so the client can display the error message
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Unknown error occurred',
        configured: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
