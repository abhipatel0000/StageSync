const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const EventPackage = sequelize.define('EventPackage', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  storage_key: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'),
    defaultValue: 'QUEUED',
    allowNull: false
  },
  size_bytes: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'event_packages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EventPackage;
