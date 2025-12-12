module.exports = {
  apps: [
    {
      name: 'rankforge-workers',
      script: 'dist/index.js',
      // Horizontal scaling - multiple instances can now run safely
      // Each instance gets a unique worker_id and uses atomic job claiming
      instances: process.env.WORKER_INSTANCES || 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        // Each worker can process up to MAX_CONCURRENT_JOBS jobs
        MAX_CONCURRENT_JOBS: 3,
      },
      // Auto-restart on crash with exponential backoff
      exp_backoff_restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      // Health check - restart if unresponsive
      listen_timeout: 10000,
      kill_timeout: 5000,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      combine_logs: true,
      // Graceful shutdown
      shutdown_with_message: true,
      wait_ready: true,
      // Instance-specific settings
      instance_var: 'INSTANCE_ID',
    },
  ],
};
