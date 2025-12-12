import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  websiteId: string;
  userId: string;
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

// Tools that Claude can use to make website changes
const tools = [
  {
    name: 'add_blog_section',
    description: 'Add a blog section to the website with initial blog posts. Use this when the user wants to add a blog or news section.',
    input_schema: {
      type: 'object',
      properties: {
        blog_topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of blog post topics to create (3-5 recommended)',
        },
        blog_style: {
          type: 'string',
          enum: ['professional', 'casual', 'educational', 'promotional'],
          description: 'The writing style for blog posts',
        },
      },
      required: ['blog_topics', 'blog_style'],
    },
  },
  {
    name: 'add_service_page',
    description: 'Add a new service page to the website. Use this when the user wants to add a new service.',
    input_schema: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'Name of the service to add',
        },
        service_description: {
          type: 'string',
          description: 'Brief description of the service',
        },
      },
      required: ['service_name', 'service_description'],
    },
  },
  {
    name: 'add_location_page',
    description: 'Add a new location/service area page. Use this when the user wants to target a new neighborhood or city.',
    input_schema: {
      type: 'object',
      properties: {
        location_name: {
          type: 'string',
          description: 'Name of the neighborhood or city',
        },
        state: {
          type: 'string',
          description: 'State abbreviation (e.g., WA, CA)',
        },
      },
      required: ['location_name'],
    },
  },
  {
    name: 'update_content',
    description: 'Update content on an existing page. Use this for text changes, SEO improvements, or content updates.',
    input_schema: {
      type: 'object',
      properties: {
        page_slug: {
          type: 'string',
          description: 'The URL slug of the page to update (e.g., "/services/plumbing" or "/")',
        },
        changes: {
          type: 'string',
          description: 'Description of the content changes to make',
        },
      },
      required: ['page_slug', 'changes'],
    },
  },
  {
    name: 'update_design',
    description: 'Update the website design (colors, fonts, layout). Use this for visual/styling changes.',
    input_schema: {
      type: 'object',
      properties: {
        primary_color: {
          type: 'string',
          description: 'New primary color (hex code)',
        },
        secondary_color: {
          type: 'string',
          description: 'New secondary color (hex code)',
        },
        heading_font: {
          type: 'string',
          description: 'New heading font family',
        },
        body_font: {
          type: 'string',
          description: 'New body font family',
        },
      },
    },
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { websiteId, userId, message, conversationHistory }: ChatRequest = await req.json();

    // Verify user owns this website
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .select('*, businesses(*)')
      .eq('id', websiteId)
      .eq('user_id', userId)
      .single();

    if (websiteError || !website) {
      throw new Error('Website not found or access denied');
    }

    // Get user's GitHub token for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token, github_username')
      .eq('id', userId)
      .single();

    const hasGitHub = !!(profile?.github_access_token && website.github_repo_url);

    // Get website content for context
    const { data: contentIndex } = await supabase
      .from('content_index')
      .select('page_slug, page_type, title, target_keywords')
      .eq('website_id', websiteId)
      .limit(20);

    const { data: designSystem } = await supabase
      .from('design_systems')
      .select('color_palette, typography')
      .eq('website_id', websiteId)
      .single();

    // Build context
    const websiteContext = `
Website: ${website.name}
Business: ${website.businesses?.business_name}
Business Type: ${website.businesses?.business_type}
Location: ${website.businesses?.address_city}, ${website.businesses?.address_state}
Services: ${website.businesses?.services?.join(', ') || 'Not specified'}
GitHub Repo: ${website.github_repo_url || 'Not connected'}
Can Push Changes: ${hasGitHub ? 'YES' : 'NO - GitHub not connected'}

Current Pages:
${contentIndex?.map(p => `- ${p.title} (${p.page_type}) - ${p.page_slug}`).join('\n') || 'No pages indexed yet'}

Design System:
- Primary Color: ${designSystem?.color_palette?.primary || 'Not set'}
- Secondary Color: ${designSystem?.color_palette?.secondary || 'Not set'}
- Heading Font: ${designSystem?.typography?.headingFont || 'Not set'}
- Body Font: ${designSystem?.typography?.bodyFont || 'Not set'}
`;

    const systemPrompt = `You are an AI assistant that helps users edit their website "${website.name}".

WEBSITE CONTEXT:
${websiteContext}

YOUR CAPABILITIES:
You have tools to make REAL changes to the website:
- add_blog_section: Add a blog with posts
- add_service_page: Add a new service page
- add_location_page: Add a new location/area page
- update_content: Update text/content on existing pages
- update_design: Change colors, fonts, styling

IMPORTANT GUIDELINES:
1. When the user asks for a change, USE THE APPROPRIATE TOOL to make it happen
2. Don't just describe what you would do - actually call the tool
3. If you need clarification before making a change, ask first
4. After using a tool, explain what you did and that changes are being processed
5. ${hasGitHub ? 'Changes will be pushed to GitHub and deployed automatically.' : 'NOTE: GitHub is not connected. Changes cannot be pushed until the user connects GitHub in Integrations.'}

Be helpful, concise, and action-oriented. When the user wants something done, do it!`;

    const messages = [
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Call Claude with tools
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        tools,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errorText);
      throw new Error(`Anthropic API error (${anthropicResponse.status}): ${errorText.substring(0, 200)}`);
    }

    const anthropicData = await anthropicResponse.json();

    // Process the response - check for tool use
    let assistantResponse = '';
    let changesMade = false;
    const toolResults: any[] = [];
    const createdJobIds: string[] = [];

    for (const block of anthropicData.content) {
      if (block.type === 'text') {
        assistantResponse += block.text;
      } else if (block.type === 'tool_use') {
        // Claude wants to use a tool - create a job!
        console.log(`Tool called: ${block.name}`, block.input);

        if (!hasGitHub) {
          toolResults.push({
            tool_use_id: block.id,
            content: 'Error: GitHub is not connected. Please connect GitHub in Integrations before making changes.',
          });
          assistantResponse += `\n\n⚠️ I tried to make the change, but GitHub is not connected. Please go to **Integrations** and connect your GitHub account first.`;
          continue;
        }

        // Create a website_edit job that workers will process
        const { data: job, error: jobError } = await supabase
          .from('generation_jobs')
          .insert({
            user_id: userId,
            website_id: websiteId,
            job_type: 'website_edit',
            priority: 10,
            status: 'pending',
            total_steps: 3,
            completed_steps: 0,
            progress_percent: 0,
            input_payload: {
              action: block.name,
              parameters: block.input,
              github_repo_url: website.github_repo_url,
              business: {
                name: website.businesses?.business_name,
                type: website.businesses?.business_type,
                city: website.businesses?.address_city,
                state: website.businesses?.address_state,
                services: website.businesses?.services,
              },
            },
          })
          .select()
          .single();

        if (jobError) {
          console.error('Error creating job:', jobError);
          toolResults.push({
            tool_use_id: block.id,
            content: `Error creating edit job: ${jobError.message}`,
          });
        } else {
          changesMade = true;
          createdJobIds.push(job.id);
          toolResults.push({
            tool_use_id: block.id,
            content: `Success! Created job ${job.id} to process this change. The change will be pushed to GitHub shortly.`,
          });
          assistantResponse += `\n\n✅ **Change queued!** I've created a job to ${getActionDescription(block.name, block.input)}. The changes will be pushed to GitHub and deployed automatically.`;
        }
      }
    }

    // If tools were used, we might need to continue the conversation
    // For now, we'll just return the response with the tool results embedded

    return new Response(
      JSON.stringify({
        response: assistantResponse || 'I apologize, I was unable to generate a response.',
        changesMade,
        jobIds: createdJobIds.length > 0 ? createdJobIds : undefined,
        toolsUsed: toolResults.length > 0 ? toolResults.map(t => t.content) : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getActionDescription(action: string, params: any): string {
  switch (action) {
    case 'add_blog_section':
      return `add a blog section with ${params.blog_topics?.length || 0} posts`;
    case 'add_service_page':
      return `add a "${params.service_name}" service page`;
    case 'add_location_page':
      return `add a page for ${params.location_name}`;
    case 'update_content':
      return `update content on ${params.page_slug}`;
    case 'update_design':
      return `update the website design`;
    default:
      return `process your request`;
  }
}
