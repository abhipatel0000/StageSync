const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UploadSession = sequelize.define('UploadSession', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  file_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  upload_id: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('INITIATED', 'UPLOADING', 'COMPLETED', 'ABORTED', 'EXPIRED'),
    defaultValue: 'INITIATED',
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'upload_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = UploadSession;
