import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  websiteId: string;
  userId: string;
}

interface RepoAnalysis {
  totalPages: number;
  locationPages: Array<{ path: string; name: string }>;
  servicePages: Array<{ path: string; name: string }>;
  blogPages: Array<{ path: string; name: string }>;
  otherPages: Array<{ path: string; name: string }>;
  hasHomepage: boolean;
  hasAboutPage: boolean;
  hasContactPage: boolean;
  lastUpdated: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { websiteId, userId }: AnalyzeRequest = await req.json();

    // Get website and verify ownership
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .select('*, businesses(*)')
      .eq('id', websiteId)
      .eq('user_id', userId)
      .single();

    if (websiteError || !website) {
      throw new Error('Website not found or access denied');
    }

    if (!website.github_repo_url) {
      throw new Error('No GitHub repository linked to this website');
    }

    // Get user's GitHub token
    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token')
      .eq('id', userId)
      .single();

    if (!profile?.github_access_token) {
      throw new Error('GitHub not connected. Please connect GitHub in Integrations.');
    }

    // Parse repo info from URL
    // Format: https://github.com/owner/repo
    const repoMatch = website.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }
    const [, owner, repo] = repoMatch;

    // Fetch repository tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
      {
        headers: {
          'Authorization': `Bearer ${profile.github_access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RankForge-Platform',
        },
      }
    );

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      console.error('GitHub API error:', errorText);
      throw new Error(`Failed to fetch repository: ${treeResponse.status}`);
    }

    const treeData = await treeResponse.json();
    const files = treeData.tree.filter((item: any) => item.type === 'blob');

    // Analyze the file structure
    const analysis: RepoAnalysis = {
      totalPages: 0,
      locationPages: [],
      servicePages: [],
      blogPages: [],
      otherPages: [],
      hasHomepage: false,
      hasAboutPage: false,
      hasContactPage: false,
      lastUpdated: new Date().toISOString(),
    };

    // Detect page patterns
    for (const file of files) {
      const path = file.path.toLowerCase();

      // Skip non-page files
      if (!path.endsWith('.html') && !path.endsWith('.tsx') && !path.endsWith('.jsx')) {
        continue;
      }

      // Skip component files and non-page patterns
      if (path.includes('/components/') || path.includes('node_modules')) {
        continue;
      }

      // Detect page types based on path patterns
      const name = extractPageName(file.path);

      if (path === 'index.html' || path === 'src/pages/home.tsx' || path.includes('/home')) {
        analysis.hasHomepage = true;
        analysis.totalPages++;
      } else if (path.includes('/about') || path.includes('about.')) {
        analysis.hasAboutPage = true;
        analysis.totalPages++;
        analysis.otherPages.push({ path: file.path, name: 'About' });
      } else if (path.includes('/contact') || path.includes('contact.')) {
        analysis.hasContactPage = true;
        analysis.totalPages++;
        analysis.otherPages.push({ path: file.path, name: 'Contact' });
      } else if (path.includes('/services/') || path.includes('/service/')) {
        analysis.servicePages.push({ path: file.path, name });
        analysis.totalPages++;
      } else if (
        path.includes('/locations/') ||
        path.includes('/location/') ||
        path.includes('/neighborhoods/') ||
        path.includes('/areas/')
      ) {
        analysis.locationPages.push({ path: file.path, name });
        analysis.totalPages++;
      } else if (path.includes('/blog/') || path.includes('/posts/') || path.includes('/articles/')) {
        analysis.blogPages.push({ path: file.path, name });
        analysis.totalPages++;
      } else if (path.includes('/pages/') || path.endsWith('.html')) {
        // Generic pages in pages directory or root HTML files
        if (!path.includes('_') && !path.includes('index.html')) {
          analysis.otherPages.push({ path: file.path, name });
          analysis.totalPages++;
        }
      }
    }

    // Update location_pages and service_pages tables from GitHub analysis
    // First clear existing entries and repopulate

    // Update location_pages
    if (analysis.locationPages.length > 0) {
      await supabase.from('location_pages').delete().eq('website_id', websiteId);

      const locationEntries = analysis.locationPages.map(page => ({
        website_id: websiteId,
        city: website.businesses?.address_city || 'Unknown',
        state: website.businesses?.address_state || '',
        neighborhood: page.name,
        page_slug: page.path,
        title_tag: `${page.name} - ${website.businesses?.business_name || website.name}`,
        meta_description: `Services in ${page.name}`,
        h1_heading: page.name,
        status: 'published',
        generated_at: new Date().toISOString(),
      }));

      await supabase.from('location_pages').insert(locationEntries);
    }

    // Update service_pages
    if (analysis.servicePages.length > 0) {
      await supabase.from('service_pages').delete().eq('website_id', websiteId);

      const serviceEntries = analysis.servicePages.map(page => ({
        website_id: websiteId,
        service_name: page.name,
        page_slug: page.path,
        title_tag: `${page.name} - ${website.businesses?.business_name || website.name}`,
        meta_description: `Professional ${page.name} services`,
        h1_heading: page.name,
        status: 'published',
        generated_at: new Date().toISOString(),
      }));

      await supabase.from('service_pages').insert(serviceEntries);
    }

    // Get repo metadata for last update
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `Bearer ${profile.github_access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RankForge-Platform',
        },
      }
    );

    if (repoResponse.ok) {
      const repoData = await repoResponse.json();
      analysis.lastUpdated = repoData.pushed_at || repoData.updated_at;
    }

    // Update website record with analysis timestamp
    await supabase
      .from('websites')
      .update({
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        message: `Found ${analysis.totalPages} pages: ${analysis.servicePages.length} services, ${analysis.locationPages.length} locations, ${analysis.blogPages.length} blog posts`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Analyze repo error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Extract a human-readable page name from a file path
 */
function extractPageName(path: string): string {
  // Get filename without extension
  const filename = path.split('/').pop()?.replace(/\.(html|tsx|jsx)$/i, '') || '';

  // Convert kebab-case or snake_case to title case
  return filename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/index$/i, '')
    .trim() || 'Unknown';
}
