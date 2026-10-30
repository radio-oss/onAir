// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'irib-isfahan-broadcast-conductor',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PLAYOUT_SERVER_HOST: '127.0.0.1',
        PLAYOUT_SERVER_PORT: '5250',
      },
    },
    {
      name: 'irib-isfahan-casparcg-simulator',
      script: 'scripts/mock-casparcg-server.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PLAYOUT_SERVER_PORT: '5250',
      },
    },
  ],
};
