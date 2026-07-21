module.exports = {
  apps: [
    {
      name: 'harmony',
      cwd: __dirname,
      script: 'npm',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
