const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  public_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    unique: true,
    allowNull: false
  },
  event_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  uploader_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  original_name: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  display_name: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  storage_key: {
    type: DataTypes.STRING(512),
    unique: true,
    allowNull: false
  },
  mime_type: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  extension: {
    type: DataTypes.STRING(32),
    allowNull: true
  },
  size_bytes: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  checksum: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  upload_status: {
    type: DataTypes.ENUM('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED'),
    defaultValue: 'PENDING',
    allowNull: false
  },
  uploaded_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'files',
  timestamps: true,
  paranoid: true,
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = File;
