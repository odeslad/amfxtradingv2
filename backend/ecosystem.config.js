// Single pm2 definition shared by scripts/deploy.ps1 and infra/scripts/startup.ps1.
module.exports = {
  apps: [
    {
      name: 'amfxtrading-backend',
      script: 'C:/amfxtradingv2/backend/dist/index.js',
      node_args: '--expose-gc --max-old-space-size=1024',
      max_memory_restart: '1200M',
    },
  ],
};
