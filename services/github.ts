/**
 * GitHub Integration Service
 * Handles repository creation and file management for generated websites
 */

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
}

interface GitHubFile {
  path: string;
  content: string;
}

export class GitHubService {
  private accessToken: string;
  private baseUrl = 'https://api.github.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get authenticated user info
   */
  async getUser(): Promise<{ login: string; email: string; avatar_url: string }> {
    return this.request('/user');
  }

  /**
   * List user's repositories
   */
  async listRepos(): Promise<GitHubRepo[]> {
    return this.request('/user/repos?sort=updated&per_page=100');
  }

  /**
   * Create a new repository
   */
  async createRepo(
    name: string,
    description: string,
    isPrivate = true
  ): Promise<GitHubRepo> {
    return this.request('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
        has_issues: false,
        has_projects: false,
        has_wiki: false,
      }),
    });
  }

  /**
   * Get repository details
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request(`/repos/${owner}/${repo}`);
  }

  /**
   * Delete a repository
   */
  async deleteRepo(owner: string, repo: string): Promise<void> {
    await this.request(`/repos/${owner}/${repo}`, { method: 'DELETE' });
  }

  /**
   * Get the latest commit SHA for a branch
   */
  async getLatestCommitSha(
    owner: string,
    repo: string,
    branch = 'main'
  ): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`
    );
    return ref.object.sha;
  }

  /**
   * Create a blob for file content
   */
  private async createBlob(
    owner: string,
    repo: string,
    content: string
  ): Promise<string> {
    const blob = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          encoding: 'base64',
        }),
      }
    );
    return blob.sha;
  }

  /**
   * Create a tree with multiple files
   */
  private async createTree(
    owner: string,
    repo: string,
    baseTreeSha: string,
    files: Array<{ path: string; sha: string }>
  ): Promise<string> {
    const tree = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: files.map((f) => ({
            path: f.path,
            mode: '100644',
            type: 'blob',
            sha: f.sha,
          })),
        }),
      }
    );
    return tree.sha;
  }

  /**
   * Create a commit
   */
  private async createCommit(
    owner: string,
    repo: string,
    message: string,
    treeSha: string,
    parentSha: string
  ): Promise<string> {
    const commit = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          tree: treeSha,
          parents: [parentSha],
        }),
      }
    );
    return commit.sha;
  }

  /**
   * Update branch reference to new commit
   */
  private async updateRef(
    owner: string,
    repo: string,
    branch: string,
    commitSha: string
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha }),
    });
  }

  /**
   * Push multiple files to a repository in a single commit
   */
  async pushFiles(
    owner: string,
    repo: string,
    files: GitHubFile[],
    commitMessage = 'Update website content via RankForge'
  ): Promise<{ commitSha: string }> {
    // Get the latest commit
    const latestCommitSha = await this.getLatestCommitSha(owner, repo);

    // Get the tree from the latest commit
    const commit = await this.request<{ tree: { sha: string } }>(
      `/repos/${owner}/${repo}/git/commits/${latestCommitSha}`
    );

    // Create blobs for all files
    const blobPromises = files.map(async (file) => ({
      path: file.path,
      sha: await this.createBlob(owner, repo, file.content),
    }));
    const blobs = await Promise.all(blobPromises);

    // Create a new tree
    const newTreeSha = await this.createTree(owner, repo, commit.tree.sha, blobs);

    // Create the commit
    const newCommitSha = await this.createCommit(
      owner,
      repo,
      commitMessage,
      newTreeSha,
      latestCommitSha
    );

    // Update the branch reference
    await this.updateRef(owner, repo, 'main', newCommitSha);

    return { commitSha: newCommitSha };
  }

  /**
   * Create a complete Next.js website repository
   */
  async createWebsiteRepo(
    name: string,
    description: string,
    websiteFiles: GitHubFile[]
  ): Promise<{ repo: GitHubRepo; commitSha: string }> {
    // Create the repository
    const repo = await this.createRepo(name, description);

    // Wait a moment for GitHub to initialize the repo
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get owner from repo
    const owner = repo.full_name.split('/')[0];

    // Push all the website files
    const { commitSha } = await this.pushFiles(
      owner,
      repo.name,
      websiteFiles,
      'Initial website generation via RankForge'
    );

    return { repo, commitSha };
  }
}

/**
 * Generate the standard Next.js website file structure
 */
export function generateWebsiteFiles(
  businessName: string,
  template: string,
  pages: Array<{ slug: string; title: string; content: string }>
): GitHubFile[] {
  const files: GitHubFile[] = [];

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify(
      {
        name: businessName.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.2.0',
        },
      },
      null,
      2
    ),
  });

  // next.config.js
  files.push({
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
`,
  });

  // Dockerfile
  files.push({
    path: 'Dockerfile',
    content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
`,
  });

  // cloudbuild.yaml
  files.push({
    path: 'cloudbuild.yaml',
    content: `steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '\${_SERVICE_NAME}'
      - '--image'
      - 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}'
      - '--region'
      - '\${_REGION}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

substitutions:
  _SERVICE_NAME: website
  _REGION: us-central1

images:
  - 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}'
`,
  });

  // Add basic layout and pages based on template
  // This would be expanded based on the template and generated content

  return files;
}
