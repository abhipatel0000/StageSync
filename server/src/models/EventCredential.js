const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const EventCredential = sequelize.define('EventCredential', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    unique: true
  },
  event_code: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true
  },
  pin_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  pin_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failed_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  locked_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  credentials_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  }
}, {
  tableName: 'event_credentials',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EventCredential;
