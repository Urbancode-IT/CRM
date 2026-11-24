/**
 * PM2 process file for Linode (or any VPS).
 * Usage on server:
 *   cd /var/www/tusion/backend
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'tusion-api',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/tusion/api-error.log',
      out_file: '/var/log/tusion/api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
