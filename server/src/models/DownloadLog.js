const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DownloadLog = sequelize.define('DownloadLog', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  file_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  guest_session_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  download_type: {
    type: DataTypes.ENUM('SINGLE_FILE', 'EVENT_PACKAGE'),
    defaultValue: 'SINGLE_FILE',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('REQUESTED', 'AUTHORIZED', 'COMPLETED', 'FAILED'),
    defaultValue: 'AUTHORIZED',
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'download_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = DownloadLog;
