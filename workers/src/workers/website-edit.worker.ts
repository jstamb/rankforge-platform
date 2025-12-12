/**
 * Website Edit Worker
 *
 * Processes chat-initiated website changes:
 * - add_blog_section: Add blog posts
 * - add_service_page: Add a new service page
 * - add_location_page: Add a location/area page
 * - update_content: Update existing page content
 * - update_design: Update design system (colors, fonts)
 *
 * Supports multiple project types:
 * - React SPA (Vite) - generates .tsx components
 * - Next.js - generates App Router components
 * - Static HTML - generates .html files
 */

import { BaseWorker } from '../lib/worker-base.js';
import { supabase } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';
import { Octokit } from 'octokit';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude Opus client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper to mimic Gemini's generateContent interface but use Claude Opus
const jsonModel = {
  async generateContent(prompt: string): Promise<{ response: { text: () => string } }> {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown code blocks, no explanation text - just the raw JSON object.`,
        },
      ],
    });

    // Extract text content from Claude's response
    const textContent = response.content.find(block => block.type === 'text');
    const text = textContent?.type === 'text' ? textContent.text : '';

    // Clean up any markdown code blocks that might slip through
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();

    return {
      response: {
        text: () => cleanedText,
      },
    };
  },
};

/**
 * Basic JSX validation to catch obvious syntax errors
 * Checks for balanced tags and common issues
 */
function validateJSX(content: string, filename: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for balanced Link tags
  const linkOpenCount = (content.match(/<Link\b/g) || []).length;
  const linkCloseCount = (content.match(/<\/Link>/g) || []).length;
  if (linkOpenCount !== linkCloseCount) {
    errors.push(`Unbalanced Link tags: ${linkOpenCount} opening, ${linkCloseCount} closing`);
  }

  // Check for balanced Route tags
  const routeOpenCount = (content.match(/<Route\b/g) || []).length;
  const routeSelfClose = (content.match(/<Route[^>]*\/>/g) || []).length;
  const routeCloseCount = (content.match(/<\/Route>/g) || []).length;
  if (routeOpenCount !== routeSelfClose + routeCloseCount) {
    errors.push(`Unbalanced Route tags`);
  }

  // Check for obvious nested link issues (link inside link)
  if (/<Link[^>]*>[^<]*<Link/.test(content)) {
    errors.push(`Detected nested Link tags - likely syntax error`);
  }

  // Check for empty Link tags (no content between > and </)
  if (/<Link[^>]*>\s*<\/Link>/.test(content)) {
    errors.push(`Detected empty Link tag with no content`);
  }

  if (errors.length > 0) {
    console.error(`[WebsiteEdit] JSX validation failed for ${filename}:`, errors);
  }

  return { valid: errors.length === 0, errors };
}

type ProjectType = 'react-spa' | 'nextjs' | 'static-html';

interface EditPayload {
  action: string;
  parameters: any;
  github_repo_url: string;
  business: {
    name: string;
    type: string;
    city: string;
    state: string;
    services: string[];
  };
}

interface GeneratedFile {
  path: string;
  content: string;
}

export class WebsiteEditWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'WebsiteEdit',
      jobTypes: ['website_edit'],
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

    const payload = job.input_payload as unknown as EditPayload;
    const { action, parameters, github_repo_url, business } = payload;

    console.log(`[WebsiteEdit] Processing ${action} for ${business.name}`);

    // Step 1: Get GitHub credentials
    this.currentStep = 'Checking credentials';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token')
      .eq('id', job.user_id)
      .single();

    if (!profile?.github_access_token) {
      throw new Error('GitHub access token not found');
    }

    if (!github_repo_url) {
      throw new Error('No GitHub repository connected to this website');
    }

    const octokit = new Octokit({ auth: profile.github_access_token });

    // Parse repo URL to get owner and repo name
    const repoMatch = github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }
    const [, owner, repo] = repoMatch;

    completedSteps++;

    // Step 2: Detect project type
    this.currentStep = 'Detecting project type';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const projectType = await this.detectProjectType(octokit, owner, repo);
    console.log(`[WebsiteEdit] Detected project type: ${projectType}`);

    completedSteps++;

    // Step 3: Generate content based on action and project type
    this.currentStep = `Generating ${action.replace(/_/g, ' ')}`;
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    let files: GeneratedFile[] = [];

    switch (action) {
      case 'add_blog_section':
        if (projectType === 'react-spa') {
          files = await this.generateReactBlogSection(octokit, owner, repo, business, parameters);
        } else if (projectType === 'nextjs') {
          files = await this.generateNextJSBlogSection(octokit, owner, repo, business, parameters);
        } else {
          files = await this.generateStaticBlogSection(business, parameters);
        }
        break;
      case 'add_service_page':
        files = await this.generateServicePage(business, parameters);
        break;
      case 'add_location_page':
        files = await this.generateLocationPage(business, parameters);
        break;
      case 'update_content':
        // All sites are React SPAs - always use React content update
        files = await this.updateReactContent(octokit, owner, repo, business, parameters);
        break;
      case 'update_design':
        files = await this.updateDesign(octokit, owner, repo, parameters);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[WebsiteEdit] Generated ${files.length} files`);
    completedSteps++;

    // Step 4: Push to GitHub
    this.currentStep = 'Pushing changes to GitHub';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    await this.pushToGitHub(octokit, owner, repo, files, action, parameters);
    completedSteps++;

    // Step 5: Update tracking tables
    this.currentStep = 'Updating website records';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Track new pages in location_pages/service_pages tables
    if (action === 'add_location_page') {
      await supabase.from('location_pages').insert({
        website_id: job.website_id,
        location_name: parameters.location_name,
        state: parameters.state || business.state,
        slug: `/locations/${parameters.location_name.toLowerCase().replace(/\s+/g, '-')}/`,
      });
    } else if (action === 'add_service_page') {
      await supabase.from('service_pages').insert({
        website_id: job.website_id,
        service_name: parameters.service_name,
        slug: `/services/${parameters.service_name.toLowerCase().replace(/\s+/g, '-')}/`,
      });
    }

    completedSteps++;
    await this.progress(job.id, 'Changes pushed successfully', completedSteps, totalSteps);

    // Reset website status back to deployed (it was set to 'generating' when job started)
    await supabase
      .from('websites')
      .update({ status: 'deployed' })
      .eq('id', job.website_id);

    return {
      action,
      projectType,
      filesGenerated: files.length,
      filePaths: files.map(f => f.path),
    };
  }

  /**
   * Detect project type by checking for framework-specific files
   */
  private async detectProjectType(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<ProjectType> {
    const checkFile = async (path: string): Promise<boolean> => {
      try {
        await octokit.rest.repos.getContent({ owner, repo, path, ref: 'main' });
        return true;
      } catch {
        return false;
      }
    };

    // Check for Next.js (next.config.js or next.config.mjs)
    if (await checkFile('next.config.js') || await checkFile('next.config.mjs') || await checkFile('next.config.ts')) {
      return 'nextjs';
    }

    // Check for React SPA (vite.config.ts + src/App.tsx)
    if (await checkFile('vite.config.ts') && await checkFile('src/App.tsx')) {
      return 'react-spa';
    }

    // Default to static HTML
    return 'static-html';
  }

  /**
   * Generate React SPA blog section
   * Creates: Blog.tsx, BlogPost.tsx, blogPosts.ts data, updates App.tsx, Header.tsx, Footer.tsx
   */
  private async generateReactBlogSection(
    octokit: Octokit,
    owner: string,
    repo: string,
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { blog_topics: string[]; blog_style: string }
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate blog content via AI
    const prompt = `Generate SEO-optimized blog content for a ${business.type} business called "${business.name}" in ${business.city}, ${business.state}.

Blog Style: ${params.blog_style}
Topics: ${params.blog_topics.join(', ')}

Generate the following as a JSON object:
{
  "blog_index": {
    "meta_title": "Blog title (60 chars max)",
    "meta_description": "Blog description (155 chars max)",
    "intro": "Brief intro paragraph for the blog landing page"
  },
  "posts": [
    {
      "slug": "url-friendly-slug",
      "title": "Post title",
      "meta_description": "155 char description",
      "excerpt": "2-3 sentence excerpt",
      "content_paragraphs": ["paragraph 1", "paragraph 2", "..."],
      "headings": [{"level": 2, "text": "Section heading", "content": "Content under this heading"}],
      "published_date": "2024-12-08"
    }
  ]
}

Generate one post for each topic. Content should be helpful, local SEO focused, and written in ${params.blog_style} style.
IMPORTANT: Generate content_paragraphs as an array of plain text paragraphs (no HTML). Generate headings as structured data.`;

    const result = await jsonModel.generateContent(prompt);
    const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));

    // 1. Generate blog posts data file
    files.push({
      path: 'src/data/blogPosts.ts',
      content: this.generateBlogPostsData(data.posts, data.blog_index),
    });

    // 2. Generate Blog listing page component
    files.push({
      path: 'src/pages/Blog.tsx',
      content: this.generateReactBlogPage(business, data.blog_index),
    });

    // 3. Generate BlogPost page component
    files.push({
      path: 'src/pages/BlogPost.tsx',
      content: this.generateReactBlogPostPage(business),
    });

    // 4. Update App.tsx with blog routes
    const appContent = await this.getFileContent(octokit, owner, repo, 'src/App.tsx');
    if (appContent) {
      const updatedApp = await this.updateAppWithBlogRoutes(appContent);
      files.push({
        path: 'src/App.tsx',
        content: updatedApp,
      });
    }

    // 5. Update Header.tsx with blog link
    const headerContent = await this.getFileContent(octokit, owner, repo, 'src/components/Header.tsx');
    if (headerContent) {
      const updatedHeader = await this.updateHeaderWithBlogLink(headerContent);
      files.push({
        path: 'src/components/Header.tsx',
        content: updatedHeader,
      });
    }

    // 6. Update Footer.tsx with blog link
    const footerContent = await this.getFileContent(octokit, owner, repo, 'src/components/Footer.tsx');
    if (footerContent) {
      const updatedFooter = await this.updateFooterWithBlogLink(footerContent);
      files.push({
        path: 'src/components/Footer.tsx',
        content: updatedFooter,
      });
    }

    return files;
  }

  /**
   * Helper to get file content from GitHub
   */
  private async getFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string
  ): Promise<string | null> {
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: 'main' });
      if (!Array.isArray(data) && data.type === 'file') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch {
      console.log(`[WebsiteEdit] File ${path} not found`);
    }
    return null;
  }

  /**
   * Generate blog posts TypeScript data file
   */
  private generateBlogPostsData(
    posts: Array<{
      slug: string;
      title: string;
      meta_description: string;
      excerpt: string;
      content_paragraphs?: string[];
      headings?: Array<{ level: number; text: string; content: string }>;
      published_date: string;
    }>,
    blogIndex: { meta_title: string; meta_description: string; intro: string }
  ): string {
    const postsJson = posts.map(post => ({
      slug: post.slug,
      title: post.title,
      metaDescription: post.meta_description,
      excerpt: post.excerpt,
      contentParagraphs: post.content_paragraphs || [],
      headings: post.headings || [],
      publishedDate: post.published_date,
    }));

    return `// Blog posts data - auto-generated by RankForge
export interface BlogPost {
  slug: string;
  title: string;
  metaDescription: string;
  excerpt: string;
  contentParagraphs: string[];
  headings: Array<{ level: number; text: string; content: string }>;
  publishedDate: string;
}

export const blogConfig = {
  title: ${JSON.stringify(blogIndex.meta_title)},
  description: ${JSON.stringify(blogIndex.meta_description)},
  intro: ${JSON.stringify(blogIndex.intro)},
};

export const blogPosts: BlogPost[] = ${JSON.stringify(postsJson, null, 2)};

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}
`;
  }

  /**
   * Generate React Blog listing page
   */
  private generateReactBlogPage(
    business: { name: string; city: string; state: string },
    blogIndex: { meta_title: string; meta_description: string; intro: string }
  ): string {
    return `import { Link } from 'react-router-dom';
import { blogPosts, blogConfig } from '../data/blogPosts';

export default function Blog() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-primary text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{blogConfig.title}</h1>
          <p className="text-xl opacity-90 max-w-2xl">{blogConfig.intro}</p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article key={post.slug} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <time className="text-sm text-gray-500" dateTime={post.publishedDate}>
                    {new Date(post.publishedDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                  <h2 className="text-xl font-bold mt-2 mb-3">
                    <Link to={\`/blog/\${post.slug}\`} className="text-gray-900 hover:text-primary">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-gray-600 mb-4">{post.excerpt}</p>
                  <Link
                    to={\`/blog/\${post.slug}\`}
                    className="text-primary font-semibold hover:underline"
                  >
                    Read More →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
`;
  }

  /**
   * Generate React BlogPost page
   */
  private generateReactBlogPostPage(
    business: { name: string; city: string; state: string }
  ): string {
    return `import { useParams, Link, Navigate } from 'react-router-dom';
import { getBlogPostBySlug } from '../data/blogPosts';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-primary text-white py-16">
        <div className="container mx-auto px-4">
          <Link to="/blog" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Back to Blog
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
          <time className="text-white/80" dateTime={post.publishedDate}>
            {new Date(post.publishedDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </div>
      </section>

      {/* Article Content */}
      <article className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="bg-white rounded-lg shadow-md p-8">
            {/* Introduction paragraphs */}
            {post.contentParagraphs.map((paragraph, index) => (
              <p key={index} className="text-gray-700 mb-4 leading-relaxed">
                {paragraph}
              </p>
            ))}

            {/* Headings with content */}
            {post.headings.map((heading, index) => (
              <div key={index} className="mt-8">
                {heading.level === 2 ? (
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{heading.text}</h2>
                ) : (
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{heading.text}</h3>
                )}
                <p className="text-gray-700 leading-relaxed">{heading.content}</p>
              </div>
            ))}
          </div>

          {/* Back to Blog */}
          <div className="mt-8 text-center">
            <Link
              to="/blog"
              className="inline-block bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              ← Back to All Posts
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
`;
  }

  /**
   * Update App.tsx to include blog routes
   * Uses multiple strategies to ensure reliable modification
   */
  private async updateAppWithBlogRoutes(appContent: string): Promise<string> {
    // Check if already has blog routes
    if (appContent.includes('path="/blog"') || appContent.includes("path='/blog'")) {
      console.log('[WebsiteEdit] Blog routes already exist in App.tsx');
      return appContent;
    }

    let updated = appContent;

    // Strategy 1: Add imports
    if (!updated.includes("import Blog from") && !updated.includes("import Blog,")) {
      const importMatch = updated.match(/import .+ from ['"][^'"]+['"];?\n/g);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        updated = updated.replace(
          lastImport,
          lastImport + "import Blog from './pages/Blog'\nimport BlogPost from './pages/BlogPost'\n"
        );
      }
    }

    // Strategy 2: Try multiple route patterns
    const routePatterns = [
      // Pattern: <Route path="/" element={<Home />} />
      /(<Route\s+path=["']\/["']\s+element=\{<Home\s*\/>\}\s*\/>)/,
      // Pattern: <Route path="/" element={<Home/>} />  (no space)
      /(<Route\s+path=["']\/["']\s+element=\{<Home\/>\}\s*\/>)/,
      // Pattern: <Route element={<Home />} path="/" />  (reversed order)
      /(<Route\s+element=\{<Home\s*\/>\}\s+path=["']\/["']\s*\/>)/,
      // Any first Route element
      /(<Route[^>]+path=["']\/["'][^>]*\/>)/,
    ];

    let routeInserted = false;
    for (const pattern of routePatterns) {
      const match = updated.match(pattern);
      if (match) {
        updated = updated.replace(
          match[0],
          match[0] + '\n          <Route path="/blog" element={<Blog />} />\n          <Route path="/blog/:slug" element={<BlogPost />} />'
        );
        routeInserted = true;
        console.log('[WebsiteEdit] Added blog routes after home route');
        break;
      }
    }

    // Strategy 3: Fallback - insert before </Routes>
    if (!routeInserted) {
      const routesCloseMatch = updated.match(/(\s*<\/Routes>)/);
      if (routesCloseMatch) {
        updated = updated.replace(
          routesCloseMatch[0],
          '\n          <Route path="/blog" element={<Blog />} />\n          <Route path="/blog/:slug" element={<BlogPost />} />' + routesCloseMatch[0]
        );
        routeInserted = true;
        console.log('[WebsiteEdit] Added blog routes before </Routes>');
      }
    }

    // Strategy 4: Use AI to modify the file
    if (!routeInserted) {
      console.log('[WebsiteEdit] Using AI to modify App.tsx');
      try {
        const result = await jsonModel.generateContent(`
Modify this React App.tsx file to add blog routes.

CURRENT FILE:
${updated}

REQUIREMENTS:
1. Add these imports at the top (after existing imports):
   import Blog from './pages/Blog'
   import BlogPost from './pages/BlogPost'

2. Add these routes inside <Routes> (after the home route):
   <Route path="/blog" element={<Blog />} />
   <Route path="/blog/:slug" element={<BlogPost />} />

Return ONLY the complete modified file content as JSON:
{"content": "...the full modified App.tsx content..."}
`);
        const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));
        if (data.content && data.content.includes('/blog')) {
          updated = data.content;
          console.log('[WebsiteEdit] AI successfully modified App.tsx');
        }
      } catch (e) {
        console.error('[WebsiteEdit] AI modification failed:', e);
      }
    }

    return updated;
  }

  /**
   * Update Header.tsx to include blog link
   * Uses multiple strategies including AI fallback
   */
  private async updateHeaderWithBlogLink(headerContent: string): Promise<string> {
    // Check if blog link already exists
    if (headerContent.includes('/blog') || headerContent.includes('"Blog"') || headerContent.includes("'Blog'")) {
      console.log('[WebsiteEdit] Blog link already exists in Header.tsx');
      return headerContent;
    }

    let updated = headerContent;
    let linkInserted = false;

    // Strategy 1: Find complete Link elements and insert Blog before them
    // Patterns for different nav link styles
    const linkPatterns = [
      // React Router Link: <Link to="/contact" className="...">Contact</Link>
      /(<Link[^>]*to=["']\/contact["'][^>]*>)([^<]*)(<\/Link>)/g,
      // React Router Link: <Link to="/" ...>Home</Link> (insert after Home)
      /(<Link[^>]*to=["']\/["'][^>]*>)([^<]*)(<\/Link>)/g,
      // Standard anchor: <a href="/contact" ...>Contact</a>
      /(<a[^>]*href=["']\/contact["'][^>]*>)([^<]*)(<\/a>)/g,
    ];

    // Try Contact link first
    const contactPattern = /(<Link[^>]*to=["']\/contact["'][^>]*>)([^<]*)(<\/Link>)/g;
    const contactMatches = [...updated.matchAll(contactPattern)];

    if (contactMatches.length > 0) {
      for (const match of contactMatches) {
        const fullMatch = match[0];
        const openTag = match[1];
        const closeTag = match[3];
        const blogOpenTag = openTag.replace('/contact', '/blog');
        const blogLink = blogOpenTag + 'Blog' + closeTag;
        updated = updated.replace(fullMatch, blogLink + '\n          ' + fullMatch);
      }
      linkInserted = true;
      console.log('[WebsiteEdit] Added Blog links before Contact in Header.tsx');
    }

    // Strategy 2: If no Contact link, try inserting after Home link
    if (!linkInserted) {
      const homePattern = /(<Link[^>]*to=["']\/["'][^>]*>)([^<]*)(<\/Link>)/g;
      const homeMatches = [...updated.matchAll(homePattern)];

      if (homeMatches.length > 0) {
        for (const match of homeMatches) {
          const fullMatch = match[0];
          const openTag = match[1];
          const closeTag = match[3];
          const blogOpenTag = openTag.replace('to="/"', 'to="/blog"').replace("to='/'", "to='/blog'");
          const blogLink = blogOpenTag + 'Blog' + closeTag;
          updated = updated.replace(fullMatch, fullMatch + '\n          ' + blogLink);
        }
        linkInserted = true;
        console.log('[WebsiteEdit] Added Blog links after Home in Header.tsx');
      }
    }

    // Strategy 3: Use AI to modify the header
    if (!linkInserted) {
      console.log('[WebsiteEdit] Using AI to modify Header.tsx');
      try {
        const result = await jsonModel.generateContent(`
Modify this React Header component to add a Blog navigation link.

CURRENT FILE:
${headerContent}

REQUIREMENTS:
1. Add a "Blog" link to the navigation (both desktop and mobile menus if they exist)
2. The Blog link should point to "/blog"
3. Use the same styling/classes as existing nav links
4. Place it logically in the navigation (usually after Home, before Contact)
5. If using React Router Link component, use: <Link to="/blog">Blog</Link>

Return ONLY the complete modified file content as JSON:
{"content": "...the full modified Header.tsx content..."}
`);
        const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));
        if (data.content && data.content.includes('/blog')) {
          updated = data.content;
          linkInserted = true;
          console.log('[WebsiteEdit] AI successfully modified Header.tsx');
        }
      } catch (e) {
        console.error('[WebsiteEdit] AI modification of Header.tsx failed:', e);
      }
    }

    return updated;
  }

  /**
   * Update Footer.tsx to include blog link
   * Uses multiple strategies including AI fallback
   */
  private async updateFooterWithBlogLink(footerContent: string): Promise<string> {
    // Check if blog link already exists
    if (footerContent.includes('/blog') || footerContent.includes('"Blog"') || footerContent.includes("'Blog'")) {
      console.log('[WebsiteEdit] Blog link already exists in Footer.tsx');
      return footerContent;
    }

    let updated = footerContent;
    let linkInserted = false;

    // Strategy 1: Find complete Link elements to Contact and insert Blog before them
    const contactPattern = /(<Link[^>]*to=["']\/contact["'][^>]*>)([^<]*)(<\/Link>)/g;
    const contactMatches = [...updated.matchAll(contactPattern)];

    if (contactMatches.length > 0) {
      for (const match of contactMatches) {
        const fullMatch = match[0];
        const openTag = match[1];
        const closeTag = match[3];
        const blogOpenTag = openTag.replace('/contact', '/blog');
        const blogLink = blogOpenTag + 'Blog' + closeTag;
        updated = updated.replace(fullMatch, blogLink + '\n              ' + fullMatch);
      }
      linkInserted = true;
      console.log('[WebsiteEdit] Added Blog link to Footer.tsx');
    }

    // Strategy 2: Use AI to modify the footer
    if (!linkInserted) {
      console.log('[WebsiteEdit] Using AI to modify Footer.tsx');
      try {
        const result = await jsonModel.generateContent(`
Modify this React Footer component to add a Blog navigation link.

CURRENT FILE:
${footerContent}

REQUIREMENTS:
1. Add a "Blog" link to any navigation section in the footer
2. The Blog link should point to "/blog"
3. Use the same styling/classes as existing footer links
4. Place it logically (usually with other navigation links)
5. If using React Router Link component, use: <Link to="/blog">Blog</Link>

Return ONLY the complete modified file content as JSON:
{"content": "...the full modified Footer.tsx content..."}
`);
        const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));
        if (data.content && data.content.includes('/blog')) {
          updated = data.content;
          console.log('[WebsiteEdit] AI successfully modified Footer.tsx');
        }
      } catch (e) {
        console.error('[WebsiteEdit] AI modification of Footer.tsx failed:', e);
      }
    }

    return updated;
  }

  /**
   * Generate Next.js App Router blog section (placeholder for future)
   */
  private async generateNextJSBlogSection(
    octokit: Octokit,
    owner: string,
    repo: string,
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { blog_topics: string[]; blog_style: string }
  ): Promise<GeneratedFile[]> {
    // TODO: Implement Next.js App Router specific blog generation
    // For now, fall back to static generation
    console.log('[WebsiteEdit] Next.js blog generation not yet implemented, using static fallback');
    return this.generateStaticBlogSection(business, params);
  }

  /**
   * Generate static HTML blog section (original implementation)
   */
  private async generateStaticBlogSection(
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { blog_topics: string[]; blog_style: string }
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const prompt = `Generate SEO-optimized blog content for a ${business.type} business called "${business.name}" in ${business.city}, ${business.state}.

Blog Style: ${params.blog_style}
Topics: ${params.blog_topics.join(', ')}

Generate the following as a JSON object:
{
  "blog_index": {
    "meta_title": "Blog title (60 chars max)",
    "meta_description": "Blog description (155 chars max)",
    "intro": "Brief intro paragraph for the blog landing page"
  },
  "posts": [
    {
      "slug": "url-friendly-slug",
      "title": "Post title",
      "meta_description": "155 char description",
      "excerpt": "2-3 sentence excerpt",
      "content": "Full blog post HTML content (800-1200 words, with h2/h3 headings, paragraphs, lists)",
      "published_date": "2024-12-08"
    }
  ]
}

Generate one post for each topic. Content should be helpful, local SEO focused, and written in ${params.blog_style} style.`;

    const result = await jsonModel.generateContent(prompt);
    const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));

    // Generate blog index page
    files.push({
      path: 'blog/index.html',
      content: this.generateBlogIndexHtml(business, data.blog_index, data.posts),
    });

    // Generate each blog post
    for (const post of data.posts) {
      files.push({
        path: `blog/${post.slug}.html`,
        content: this.generateBlogPostHtml(business, post),
      });
    }

    return files;
  }

  /**
   * Generate a new service page
   */
  private async generateServicePage(
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { service_name: string; service_description: string }
  ): Promise<GeneratedFile[]> {
    const slug = params.service_name.toLowerCase().replace(/\s+/g, '-');

    const prompt = `Generate SEO-optimized content for a "${params.service_name}" service page.

Business: ${business.name} (${business.type})
Location: ${business.city}, ${business.state}
Service Description: ${params.service_description}

Generate as JSON:
{
  "meta_title": "Service page title (60 chars, include city)",
  "meta_description": "155 char description with call to action",
  "hero_headline": "Compelling headline",
  "hero_subheadline": "Supporting subheadline",
  "intro": "2-3 paragraph introduction to the service",
  "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
  "process_steps": [
    {"title": "Step title", "description": "Step description"}
  ],
  "faq": [
    {"question": "FAQ question", "answer": "Detailed answer"}
  ],
  "cta_headline": "Call to action headline",
  "cta_text": "CTA button text"
}

Content should be 1500+ words equivalent, locally focused, and include local SEO terms.`;

    const result = await jsonModel.generateContent(prompt);
    const rawText = result.response.text();
    let data;
    try {
      data = JSON.parse(rawText.replace(/```json\n?|\n?```/g, ''));
    } catch (parseError) {
      console.error('[WebsiteEdit] Failed to parse service page JSON:', parseError);
      console.error('[WebsiteEdit] Raw AI response:', rawText.substring(0, 500));
      throw new Error(`Failed to parse AI response for service page: ${parseError}`);
    }

    return [{
      path: `services/${slug}.html`,
      content: this.generateServicePageHtml(business, params.service_name, data),
    }];
  }

  /**
   * Generate a new location page
   */
  private async generateLocationPage(
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { location_name: string; state?: string }
  ): Promise<GeneratedFile[]> {
    const slug = params.location_name.toLowerCase().replace(/\s+/g, '-');
    const state = params.state || business.state;

    const prompt = `Generate SEO-optimized content for a location/service area page.

Business: ${business.name} (${business.type})
Target Location: ${params.location_name}, ${state}
Services Offered: ${business.services.join(', ')}

Generate as JSON:
{
  "meta_title": "${business.type} Services in ${params.location_name} (60 chars)",
  "meta_description": "155 char description about serving ${params.location_name}",
  "hero_headline": "Compelling local headline",
  "hero_subheadline": "Supporting local subheadline",
  "intro": "2-3 paragraphs about serving this area, mention local landmarks or neighborhoods",
  "services_in_area": [
    {"name": "Service name", "description": "How this service helps ${params.location_name} residents"}
  ],
  "local_info": "Paragraph about the area and why local service matters",
  "service_area_description": "Description of coverage in and around ${params.location_name}",
  "cta_headline": "Local call to action",
  "cta_text": "CTA button text"
}

Make content highly localized with mentions of ${params.location_name} throughout.`;

    const result = await jsonModel.generateContent(prompt);
    const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));

    return [{
      path: `locations/${slug}.html`,
      content: this.generateLocationPageHtml(business, params.location_name, state, data),
    }];
  }

  /**
   * Update content on an existing page
   * Uses a two-step approach:
   * 1. Identify specific HTML sections to modify
   * 2. Apply targeted changes while preserving the rest
   */
  private async updateContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { page_slug: string; changes: string }
  ): Promise<GeneratedFile[]> {
    // Determine file path from slug
    let filePath = params.page_slug;
    if (filePath === '/') filePath = 'index.html';
    else if (!filePath.endsWith('.html')) filePath = `${filePath.replace(/^\/|\/$/g, '')}/index.html`;
    else filePath = filePath.replace(/^\//, '');

    // Try to fetch existing content - FULL content, no truncation
    let existingContent = '';
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: 'main',
      });
      if (!Array.isArray(data) && data.type === 'file') {
        existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (e) {
      console.log(`[WebsiteEdit] File ${filePath} not found, will create new`);
    }

    if (!existingContent) {
      throw new Error(`Cannot update content: file ${filePath} does not exist`);
    }

    console.log(`[WebsiteEdit] Fetched ${filePath}: ${existingContent.length} characters`);

    // Step 1: Analyze the page and identify what needs to change
    const analysisPrompt = `Analyze this HTML page and identify the EXACT sections that need to be modified.

BUSINESS: ${business.name} (${business.type}) in ${business.city}, ${business.state}
SERVICES: ${business.services?.join(', ') || 'Not specified'}

CHANGES REQUESTED: ${params.changes}

CURRENT HTML (full content):
${existingContent}

Respond with JSON containing:
{
  "sections_to_modify": [
    {
      "description": "What section this is",
      "current_html": "EXACT HTML to find and replace (copy verbatim from above)",
      "new_html": "The replacement HTML with changes applied",
      "reason": "Why this change addresses the request"
    }
  ],
  "summary": "Brief summary of all changes being made"
}

CRITICAL RULES:
1. The "current_html" MUST be an EXACT match from the page - copy it character-for-character
2. Only modify sections directly relevant to the requested changes
3. Preserve all existing CSS classes, IDs, and structure
4. If adding links, use proper <a href="..."> tags with correct paths
5. For service pages, link format should be: /services/[service-name-lowercase-hyphenated].html
6. If making text uppercase, apply CSS text-transform or actually change the text
7. Include enough context in current_html to make it unique (not just a single tag)`;

    console.log(`[WebsiteEdit] Analyzing page for changes...`);
    const analysisResult = await jsonModel.generateContent(analysisPrompt);
    const rawAnalysis = analysisResult.response.text();

    let analysis;
    try {
      analysis = JSON.parse(rawAnalysis.replace(/```json\n?|\n?```/g, ''));
    } catch (parseError) {
      console.error('[WebsiteEdit] Failed to parse analysis JSON:', parseError);
      console.error('[WebsiteEdit] Raw response:', rawAnalysis.substring(0, 1000));
      throw new Error('Failed to analyze page for changes');
    }

    console.log(`[WebsiteEdit] Analysis summary: ${analysis.summary}`);
    console.log(`[WebsiteEdit] Found ${analysis.sections_to_modify?.length || 0} sections to modify`);

    // Step 2: Apply the changes using find-and-replace
    let updatedContent = existingContent;
    let changesApplied = 0;

    for (const section of analysis.sections_to_modify || []) {
      if (!section.current_html || !section.new_html) {
        console.warn(`[WebsiteEdit] Skipping invalid section: ${section.description}`);
        continue;
      }

      // Normalize whitespace for comparison
      const normalizedCurrent = section.current_html.trim();
      const normalizedNew = section.new_html.trim();

      if (updatedContent.includes(normalizedCurrent)) {
        updatedContent = updatedContent.replace(normalizedCurrent, normalizedNew);
        changesApplied++;
        console.log(`[WebsiteEdit] Applied change: ${section.description}`);
      } else {
        // Try with more flexible matching (ignore some whitespace differences)
        const flexiblePattern = normalizedCurrent
          .replace(/\s+/g, '\\s+')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        try {
          const regex = new RegExp(flexiblePattern, 's');
          if (regex.test(updatedContent)) {
            updatedContent = updatedContent.replace(regex, normalizedNew);
            changesApplied++;
            console.log(`[WebsiteEdit] Applied change (flexible match): ${section.description}`);
          } else {
            console.warn(`[WebsiteEdit] Could not find section to replace: ${section.description}`);
            console.warn(`[WebsiteEdit] Looking for: ${normalizedCurrent.substring(0, 200)}...`);
          }
        } catch (regexError) {
          console.warn(`[WebsiteEdit] Regex error for section: ${section.description}`);
        }
      }
    }

    if (changesApplied === 0) {
      console.error('[WebsiteEdit] WARNING: No changes were applied!');
      // Fall back to regeneration approach but with full content
      console.log('[WebsiteEdit] Falling back to full page regeneration...');

      const fallbackPrompt = `Modify this HTML page with the following changes. Return ONLY the modified HTML.

CHANGES TO MAKE: ${params.changes}

CURRENT HTML:
${existingContent}

Return JSON with the complete modified HTML:
{
  "html": "The complete HTML with all requested changes applied"
}

IMPORTANT:
- Keep ALL existing content, structure, styles intact
- ONLY modify the specific parts mentioned in the changes
- For links to service pages, use format: /services/[name].html
- Ensure changes are actually visible in the output`;

      const fallbackResult = await jsonModel.generateContent(fallbackPrompt);
      const fallbackData = JSON.parse(fallbackResult.response.text().replace(/```json\n?|\n?```/g, ''));
      updatedContent = fallbackData.html;
    }

    console.log(`[WebsiteEdit] Total changes applied: ${changesApplied}`);

    return [{
      path: filePath,
      content: updatedContent,
    }];
  }

  /**
   * Update content in a React SPA project
   * Edits the relevant .tsx component files, NOT the HTML
   * This triggers a rebuild via GitHub Actions to generate new JS bundle
   */
  private async updateReactContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    business: { name: string; type: string; city: string; state: string; services: string[] },
    params: { page_slug: string; changes: string }
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Determine which component to edit based on page_slug
    let componentPath = 'src/App.tsx';
    if (params.page_slug === '/' || params.page_slug === '/index' || params.page_slug === 'index.html') {
      componentPath = 'src/App.tsx';
    } else if (params.page_slug.includes('services/')) {
      componentPath = 'src/pages/Services.tsx';
    } else if (params.page_slug.includes('contact')) {
      componentPath = 'src/pages/Contact.tsx';
    } else if (params.page_slug.includes('about')) {
      componentPath = 'src/pages/About.tsx';
    }

    // Try to fetch the component
    let existingContent = '';
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: componentPath,
        ref: 'main',
      });
      if (!Array.isArray(data) && data.type === 'file') {
        existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (e) {
      console.log(`[WebsiteEdit] Component ${componentPath} not found, trying src/App.tsx`);
      // Fallback to App.tsx if specific page component doesn't exist
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: 'src/App.tsx',
          ref: 'main',
        });
        if (!Array.isArray(data) && data.type === 'file') {
          existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
          componentPath = 'src/App.tsx';
        }
      } catch (e2) {
        throw new Error(`Cannot find React component for page ${params.page_slug}`);
      }
    }

    console.log(`[WebsiteEdit] Fetched React component ${componentPath}: ${existingContent.length} characters`);

    // Also fetch constants.ts which may contain business data
    let constantsContent = '';
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'src/constants.ts',
        ref: 'main',
      });
      if (!Array.isArray(data) && data.type === 'file') {
        constantsContent = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (e) {
      console.log('[WebsiteEdit] constants.ts not found');
    }

    // Use Claude to analyze and update the React component
    const analysisPrompt = `You are editing a React TypeScript component for a ${business.type} business website.

BUSINESS: ${business.name} (${business.type}) in ${business.city}, ${business.state}
SERVICES: ${business.services?.join(', ') || 'Not specified'}

CHANGES REQUESTED: ${params.changes}

CURRENT REACT COMPONENT (${componentPath}):
\`\`\`tsx
${existingContent}
\`\`\`

${constantsContent ? `CONSTANTS FILE (src/constants.ts):
\`\`\`typescript
${constantsContent}
\`\`\`` : ''}

Analyze the React code and make the requested changes. Return JSON with:
{
  "files_to_update": [
    {
      "path": "file path (e.g., src/App.tsx or src/constants.ts)",
      "content": "complete updated file content"
    }
  ],
  "summary": "Brief description of changes made"
}

CRITICAL RULES:
1. Return the COMPLETE file content, not just snippets
2. Preserve all imports, exports, and component structure
3. Make changes that affect the actual rendered output
4. If the change involves data (like service names), update constants.ts if it exists
5. Ensure valid TypeScript/JSX syntax
6. Keep Tailwind CSS classes intact unless specifically asked to change styling
7. If making text uppercase, either change the actual text OR add className="uppercase"
8. If adding links, use <Link to="/path"> from react-router-dom`;

    console.log('[WebsiteEdit] Analyzing React component for changes...');
    const result = await jsonModel.generateContent(analysisPrompt);
    const rawResult = result.response.text();

    let analysis;
    try {
      analysis = JSON.parse(rawResult.replace(/```json\n?|\n?```/g, ''));
    } catch (parseError) {
      console.error('[WebsiteEdit] Failed to parse React update JSON:', parseError);
      console.error('[WebsiteEdit] Raw response:', rawResult.substring(0, 1000));
      throw new Error('Failed to generate React component updates');
    }

    console.log(`[WebsiteEdit] React update summary: ${analysis.summary}`);

    // Add all updated files
    for (const file of analysis.files_to_update || []) {
      if (file.path && file.content) {
        files.push({
          path: file.path,
          content: file.content,
        });
        console.log(`[WebsiteEdit] Will update: ${file.path}`);
      }
    }

    if (files.length === 0) {
      throw new Error('No files to update from React analysis');
    }

    return files;
  }

  /**
   * Update design system (colors, fonts)
   */
  private async updateDesign(
    octokit: Octokit,
    owner: string,
    repo: string,
    params: { primary_color?: string; secondary_color?: string; heading_font?: string; body_font?: string }
  ): Promise<GeneratedFile[]> {
    // Fetch existing CSS
    let existingCSS = '';
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'assets/css/styles.css',
        ref: 'main',
      });
      if (!Array.isArray(data) && data.type === 'file') {
        existingCSS = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (e) {
      console.log('[WebsiteEdit] styles.css not found');
    }

    const prompt = `Update the CSS with new design values.

Current CSS:
${existingCSS.substring(0, 3000)}${existingCSS.length > 3000 ? '...(truncated)' : ''}

Changes to apply:
${params.primary_color ? `- Primary color: ${params.primary_color}` : ''}
${params.secondary_color ? `- Secondary color: ${params.secondary_color}` : ''}
${params.heading_font ? `- Heading font: ${params.heading_font}` : ''}
${params.body_font ? `- Body font: ${params.body_font}` : ''}

Generate the complete updated CSS as JSON:
{
  "css": "Complete CSS content with the design changes applied"
}

Update CSS custom properties (--primary-color, etc.) and any hardcoded color values. Maintain all existing styles.`;

    const result = await jsonModel.generateContent(prompt);
    const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));

    return [{
      path: 'assets/css/styles.css',
      content: data.css,
    }];
  }

  /**
   * Push files to GitHub with validation and auto-fix
   */
  private async pushToGitHub(
    octokit: Octokit,
    owner: string,
    repo: string,
    files: GeneratedFile[],
    action: string,
    params: any
  ): Promise<void> {
    const commitMessage = this.getCommitMessage(action, params);

    for (const file of files) {
      let content = file.content;

      // Validate .tsx files before pushing
      if (file.path.endsWith('.tsx')) {
        const validation = validateJSX(content, file.path);
        if (!validation.valid) {
          console.log(`[WebsiteEdit] Validation failed for ${file.path}, attempting AI fix...`);
          try {
            // Use AI to fix the broken JSX
            const result = await jsonModel.generateContent(`
Fix the syntax errors in this React/JSX file.

FILE: ${file.path}
ERRORS DETECTED: ${validation.errors.join(', ')}

CURRENT CONTENT:
${content}

REQUIREMENTS:
1. Fix all JSX syntax errors (unbalanced tags, nested elements, etc.)
2. Ensure all Link, Route, and other JSX tags are properly opened and closed
3. Maintain the original functionality and styling
4. Return valid JSX that will compile without errors

Return ONLY the fixed file content as JSON:
{"content": "...the complete fixed file content..."}
`);
            const data = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));
            if (data.content) {
              const revalidation = validateJSX(data.content, file.path);
              if (revalidation.valid) {
                content = data.content;
                console.log(`[WebsiteEdit] AI successfully fixed ${file.path}`);
              } else {
                console.error(`[WebsiteEdit] AI fix still has errors for ${file.path}:`, revalidation.errors);
              }
            }
          } catch (e) {
            console.error(`[WebsiteEdit] AI fix failed for ${file.path}:`, e);
          }
        }
      }

      // Check if file exists
      let existingSha: string | undefined;
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: 'main',
        });
        if (!Array.isArray(data) && data.type === 'file') {
          existingSha = data.sha;
        }
      } catch (e) {
        // File doesn't exist
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: `${commitMessage}\n\n🤖 Generated via RankForge Website Assistant`,
        content: Buffer.from(content).toString('base64'),
        branch: 'main',
        ...(existingSha && { sha: existingSha }),
      });

      console.log(`[WebsiteEdit] Pushed ${file.path}`);
    }
  }

  private getCommitMessage(action: string, params: any): string {
    switch (action) {
      case 'add_blog_section':
        return `Add blog section with ${params.blog_topics?.length || 0} posts`;
      case 'add_service_page':
        return `Add ${params.service_name} service page`;
      case 'add_location_page':
        return `Add ${params.location_name} location page`;
      case 'update_content':
        return `Update content on ${params.page_slug}`;
      case 'update_design':
        return 'Update website design';
      default:
        return 'Website update';
    }
  }

  /**
   * Generate blog index HTML
   */
  private generateBlogIndexHtml(
    business: { name: string; city: string; state: string },
    index: { meta_title: string; meta_description: string; intro: string },
    posts: Array<{ slug: string; title: string; excerpt: string; published_date: string }>
  ): string {
    const postCards = posts.map(post => `
        <article class="blog-card">
            <h2><a href="/blog/${post.slug}.html">${post.title}</a></h2>
            <p class="excerpt">${post.excerpt}</p>
            <div class="meta">
                <time datetime="${post.published_date}">${new Date(post.published_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            </div>
            <a href="/blog/${post.slug}.html" class="read-more">Read More →</a>
        </article>
    `).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${index.meta_title}</title>
    <meta name="description" content="${index.meta_description}">
    <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
    <main class="blog-listing">
        <div class="container">
            <header class="page-header">
                <h1>${index.meta_title}</h1>
                <p class="intro">${index.intro}</p>
            </header>
            <div class="blog-grid">
                ${postCards}
            </div>
        </div>
    </main>
</body>
</html>`;
  }

  /**
   * Generate individual blog post HTML
   */
  private generateBlogPostHtml(
    business: { name: string; city: string; state: string },
    post: { title: string; meta_description: string; content: string; published_date: string }
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title} | ${business.name}</title>
    <meta name="description" content="${post.meta_description}">
    <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
    <article class="blog-post">
        <div class="container">
            <header class="post-header">
                <h1>${post.title}</h1>
                <time datetime="${post.published_date}">${new Date(post.published_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            </header>
            <div class="post-content">
                ${post.content}
            </div>
            <footer class="post-footer">
                <p><a href="/blog/">← Back to Blog</a></p>
            </footer>
        </div>
    </article>
</body>
</html>`;
  }

  /**
   * Generate service page HTML
   */
  private generateServicePageHtml(
    business: { name: string; city: string; state: string },
    serviceName: string,
    data: any
  ): string {
    // Add defensive checks for all array fields
    const benefitsArray = Array.isArray(data.benefits) ? data.benefits : [];
    const processStepsArray = Array.isArray(data.process_steps) ? data.process_steps : [];
    const faqArray = Array.isArray(data.faq) ? data.faq : [];

    const benefits = benefitsArray.map((b: string) => `<li>${b}</li>`).join('\n                    ');
    const steps = processStepsArray.map((s: { title: string; description: string }, i: number) => `
            <div class="process-step">
                <span class="step-number">${i + 1}</span>
                <h3>${s.title}</h3>
                <p>${s.description}</p>
            </div>
        `).join('\n');
    const faqs = faqArray.map((f: { question: string; answer: string }) => `
            <div class="faq-item">
                <h3>${f.question}</h3>
                <p>${f.answer}</p>
            </div>
        `).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.meta_title}</title>
    <meta name="description" content="${data.meta_description}">
    <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
    <main>
        <section class="hero service-hero">
            <div class="container">
                <h1>${data.hero_headline}</h1>
                <p class="hero-subtitle">${data.hero_subheadline}</p>
                <a href="/contact/" class="btn btn-primary">${data.cta_text}</a>
            </div>
        </section>

        <section class="service-intro">
            <div class="container">
                ${data.intro}
            </div>
        </section>

        <section class="benefits">
            <div class="container">
                <h2>Benefits of Our ${serviceName}</h2>
                <ul class="benefits-list">
                    ${benefits}
                </ul>
            </div>
        </section>

        <section class="process">
            <div class="container">
                <h2>Our Process</h2>
                <div class="process-steps">
                    ${steps}
                </div>
            </div>
        </section>

        <section class="faq">
            <div class="container">
                <h2>Frequently Asked Questions</h2>
                <div class="faq-grid">
                    ${faqs}
                </div>
            </div>
        </section>

        <section class="cta-section">
            <div class="container">
                <h2>${data.cta_headline}</h2>
                <a href="/contact/" class="btn btn-primary btn-lg">${data.cta_text}</a>
            </div>
        </section>
    </main>
</body>
</html>`;
  }

  /**
   * Generate location page HTML
   */
  private generateLocationPageHtml(
    business: { name: string; type: string; city: string; state: string },
    locationName: string,
    state: string,
    data: any
  ): string {
    const services = data.services_in_area.map((s: { name: string; description: string }) => `
            <div class="area-service">
                <h3>${s.name}</h3>
                <p>${s.description}</p>
            </div>
        `).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.meta_title}</title>
    <meta name="description" content="${data.meta_description}">
    <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
    <main>
        <section class="hero location-hero">
            <div class="container">
                <h1>${data.hero_headline}</h1>
                <p class="hero-subtitle">${data.hero_subheadline}</p>
                <a href="/contact/" class="btn btn-primary">${data.cta_text}</a>
            </div>
        </section>

        <section class="location-intro">
            <div class="container">
                ${data.intro}
            </div>
        </section>

        <section class="services-in-area">
            <div class="container">
                <h2>Our Services in ${locationName}</h2>
                <div class="services-grid">
                    ${services}
                </div>
            </div>
        </section>

        <section class="local-info">
            <div class="container">
                <h2>About ${locationName}, ${state}</h2>
                <p>${data.local_info}</p>
            </div>
        </section>

        <section class="service-area">
            <div class="container">
                <h2>Service Area Coverage</h2>
                <p>${data.service_area_description}</p>
            </div>
        </section>

        <section class="cta-section">
            <div class="container">
                <h2>${data.cta_headline}</h2>
                <a href="/contact/" class="btn btn-primary btn-lg">${data.cta_text}</a>
            </div>
        </section>
    </main>
</body>
</html>`;
  }
}
