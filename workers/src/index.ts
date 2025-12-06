import express from 'express';
import { SEOResearchWorker } from './workers/seo-research.worker.js';
import { ContentArchitectureWorker } from './workers/content-architecture.worker.js';
import { ContentGenerationWorker } from './workers/content-generation.worker.js';
import { DesignGenerationWorker } from './workers/design-generation.worker.js';
import { SiteBuilderWorker } from './workers/site-builder.worker.js';
import { DeploymentWorker } from './workers/deployment.worker.js';
import { OrchestratorWorker } from './workers/orchestrator.worker.js';

const PORT = process.env.PORT || 8080;

// Health check server for Cloud Run
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rankforge-workers',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Worker instances
const workers = [
  new OrchestratorWorker(),      // Handles full_generation jobs
  new SEOResearchWorker(),
  new ContentArchitectureWorker(),
  new ContentGenerationWorker(),
  new DesignGenerationWorker(),
  new SiteBuilderWorker(),
  new DeploymentWorker(),
];

// Start all workers
async function startWorkers() {
  console.log('Starting RankForge Worker System...');
  console.log(`Workers: ${workers.map(w => w.constructor.name).join(', ')}`);

  for (const worker of workers) {
    worker.start();
  }

  console.log('All workers started successfully');
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  for (const worker of workers) {
    worker.stop();
  }

  // Give workers time to finish current jobs
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('All workers stopped. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
app.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  startWorkers();
});
