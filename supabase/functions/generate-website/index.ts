/**
 * Supabase Edge Function: Generate Website
 * Generates website files using Gemini AI
 *
 * This runs server-side with access to API keys
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessInput {
  businessName: string;
  niche: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  description: string;
  services: string[];
  targetCities: Array<{ name: string; state: string; county?: string }>;
  colorScheme: { primary: string; secondary: string; accent: string };
  webhookUrl?: string;
  yearsInBusiness?: number;
}

interface GeneratedFile {
  path: string;
  content: string;
}

const WEBSITE_GENERATION_PROMPT = `Role:
You are a Senior Frontend Engineer and Technical SEO Strategist specializing in high-conversion local service business websites.

Objective:
Create a complete React SPA for a local service business with Programmatic SEO support.

Tech Stack:
- React 19 + TypeScript
- Tailwind CSS (via CDN)
- React Router DOM v6
- Lucide React icons

Requirements:
1. src/constants.ts - All business data as source of truth
2. src/types.ts - TypeScript interfaces
3. src/components/Header.tsx - Sticky header with call button
4. src/components/Footer.tsx - Footer with service areas
5. src/components/LeadForm.tsx - Form with webhook support
6. src/pages/Home.tsx - Homepage with hero, services, testimonials
7. src/pages/CityLanding.tsx - Dynamic city pages (/locations/:citySlug)
8. src/pages/Contact.tsx - Contact page
9. index.html - HTML with Tailwind CDN
10. package.json, tsconfig.json, vite.config.ts

Design Rules:
- Sticky header with prominent "Call Now" button
- Lead form above fold on desktop, sticky on mobile
- Trust badges: "Licensed & Insured", "5-Star Rated"
- High-contrast CTA buttons

Output as JSON: { "files": [{ "path": "...", "content": "..." }] }`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId, business, useAI } = await req.json() as {
      jobId: string;
      business: BusinessInput;
      useAI: boolean;
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update job status
    await supabase
      .from('generation_jobs')
      .update({
        current_step: 'Generating website files',
        progress_percent: 15,
      })
      .eq('id', jobId);

    let files: GeneratedFile[];

    if (useAI) {
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const userPrompt = buildUserPrompt(business);

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: WEBSITE_GENERATION_PROMPT },
              { text: userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100000,
        },
      });

      const text = result.response.text();
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                        text.match(/\{[\s\S]*"files"[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      files = parsed.files;
    } else {
      // Static template generation
      files = generateStaticFiles(business);
    }

    // Update progress
    await supabase
      .from('generation_jobs')
      .update({
        current_step: 'Files generated',
        progress_percent: 30,
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({
        success: true,
        files,
        metadata: {
          totalFiles: files.length,
          totalPages: 2 + business.targetCities.length + business.services.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Generation error:', err);
    // Return 200 with error in body so client can display the error message
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Unknown error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildUserPrompt(input: BusinessInput): string {
  return `Generate a complete React website for:

Business: ${input.businessName}
Niche: ${input.niche}
Phone: ${input.phone}
Email: ${input.email}
Address: ${input.address.street}, ${input.address.city}, ${input.address.state} ${input.address.zip}
Description: ${input.description}

Services: ${input.services.join(', ')}

Target Cities:
${input.targetCities.map(c => `- ${c.name}, ${c.state}`).join('\n')}

Colors:
- Primary: ${input.colorScheme.primary}
- Secondary: ${input.colorScheme.secondary}
- Accent: ${input.colorScheme.accent}

Webhook URL: ${input.webhookUrl || 'https://hooks.example.com/lead'}

Generate ALL files as JSON.`;
}

function generateStaticFiles(input: BusinessInput): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const slug = input.businessName.toLowerCase().replace(/\s+/g, '-');

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: slug,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
        'react-router-dom': '^6.20.0',
        'lucide-react': '^0.400.0',
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.2.0',
        'typescript': '^5.3.0',
        'vite': '^5.0.0',
      },
    }, null, 2),
  });

  // index.html
  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${input.businessName} | ${input.niche} Services</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '${input.colorScheme.primary}',
            secondary: '${input.colorScheme.secondary}',
            accent: '${input.colorScheme.accent}',
          }
        }
      }
    }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
  });

  // src/constants.ts
  files.push({
    path: 'src/constants.ts',
    content: `export const BUSINESS = {
  name: '${input.businessName}',
  niche: '${input.niche}',
  phone: '${input.phone}',
  email: '${input.email}',
  address: ${JSON.stringify(input.address)},
  description: \`${input.description}\`,
  webhookUrl: '${input.webhookUrl || ''}',
  yearsInBusiness: ${input.yearsInBusiness || 10},
};

export const SERVICES = ${JSON.stringify(input.services)};
export const TARGET_CITIES = ${JSON.stringify(input.targetCities)};
export const COLORS = ${JSON.stringify(input.colorScheme)};

export const TRUST_BADGES = [
  'Licensed & Insured',
  '5-Star Rated',
  '24/7 Emergency Service',
  'Free Estimates',
];`,
  });

  // Add more files as needed...
  // (keeping it shorter for this example - full implementation in websiteGenerator.ts)

  return files;
}
