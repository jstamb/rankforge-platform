import 'dotenv/config';
import express from 'express';
import { UnifiedGenerationWorker } from './workers/unified-generation.worker.js';
import { SiteBuilderWorker } from './workers/site-builder.worker.js';
import { DeploymentWorker } from './workers/deployment.worker.js';
import { WebsiteEditWorker } from './workers/website-edit.worker.js';
import { jobRecoveryService } from './lib/job-recovery.js';

const PORT = process.env.PORT || 8080;

// Health check server for Cloud Run
const app = express();

app.get('/', async (req, res) => {
  try {
    const stats = await jobRecoveryService.getHealthStats();
    res.json({
      status: 'healthy',
      service: 'rankforge-workers',
      version: '2.1-self-healing',
      timestamp: new Date().toISOString(),
      workers: workers.map(w => ({
        name: w.constructor.name,
        active: w.isRunning,
      })),
      jobs: stats,
    });
  } catch {
    res.json({
      status: 'healthy',
      service: 'rankforge-workers',
      version: '2.1-self-healing',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/health', async (req, res) => {
  try {
    const stats = await jobRecoveryService.getHealthStats();
    res.json({
      status: 'ok',
      jobs: stats,
    });
  } catch {
    res.json({ status: 'ok' });
  }
});

// Worker instances - Using unified generation with Gemini 2.5 Pro
// Single AI call generates: SEO research, architecture, design, and ALL page content
const workers = [
  new UnifiedGenerationWorker(),  // Handles full_generation jobs in ONE Gemini call
  new SiteBuilderWorker(),        // Builds the static site files
  new DeploymentWorker(),         // Deploys to GitHub + sets up secrets for auto-deploy
  new WebsiteEditWorker(),        // Handles chat-initiated website edits
  // Cloud Run deployment happens automatically via GitHub Actions after push
];

// Start all workers and recovery service
async function startWorkers() {
  console.log('Starting RankForge Worker System v2.1 (Self-Healing)...');
  console.log(`Workers: ${workers.map(w => w.constructor.name).join(', ')}`);

  // Start the job recovery service first
  await jobRecoveryService.start();

  for (const worker of workers) {
    worker.start();
  }

  console.log('All workers and recovery service started successfully');

  // Signal ready for PM2
  if (process.send) {
    process.send('ready');
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  // Stop recovery service first
  jobRecoveryService.stop();

  for (const worker of workers) {
    worker.stop();
  }

  // Give workers time to finish current jobs
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('All workers and recovery service stopped. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
app.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  startWorkers();
});
