const app = require('./app');
const { sequelize } = require('./models');
const { initCleanupJobs } = require('./jobs/cleanupJobs');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[Server] Connecting to database...');
    await sequelize.authenticate();
    console.log('[Server] Database connection established successfully.');

    // Sync database models (creates tables automatically if they do not exist)
    console.log('[Server] Synchronizing database tables...');
    await sequelize.sync();
    console.log('[Server] Database sync complete.');

    // Start background cleanup workers
    initCleanupJobs();

    // Start HTTP listener
    app.listen(PORT, () => {
      console.log(`===========================================================`);
      console.log(` StageSync API Server is running on port ${PORT}`);
      console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Database: ${sequelize.options.dialect.toUpperCase()}`);
      console.log(` Storage Provider: ${process.env.STORAGE_PROVIDER || 'local'}`);
      console.log(`===========================================================`);
    });
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
