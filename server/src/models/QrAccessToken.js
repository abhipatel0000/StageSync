const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const QrAccessToken = sequelize.define('QrAccessToken', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  token_hash: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'qr_access_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = QrAccessToken;
