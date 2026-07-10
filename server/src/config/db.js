const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// Support both custom DB_* env vars and Railway's default MYSQL* env vars
const dbDialect = process.env.DB_DIALECT || (process.env.MYSQLHOST ? 'mysql' : 'sqlite');

if (dbDialect === 'mysql' && process.env.NODE_ENV !== 'test') {
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE;
  const dbUser = process.env.DB_USER || process.env.MYSQLUSER;
  const dbPass = process.env.DB_PASS || process.env.MYSQLPASSWORD;
  const dbHost = process.env.DB_HOST || process.env.MYSQLHOST;
  const dbPort = process.env.DB_PORT || process.env.MYSQLPORT || 3306;

  sequelize = new Sequelize(
    dbName,
    dbUser,
    dbPass,
    {
      host: dbHost,
      port: dbPort,
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
} else {
  const storagePath = process.env.NODE_ENV === 'test'
    ? './database.test.sqlite'
    : (process.env.DB_STORAGE || './database.sqlite');

  // Default to SQLite local file database for out-of-the-box running
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false
  });
}

module.exports = sequelize;
