const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Event = sequelize.define('Event', {
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
  owner_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  venue_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  event_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  access_starts_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  access_expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  retention_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'UPCOMING', 'ACTIVE', 'EXPIRED', 'ARCHIVED', 'DELETED'),
    defaultValue: 'UPCOMING',
    allowNull: false
  },
  allow_download: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  allow_download_all: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  max_guest_sessions: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    allowNull: false
  }
}, {
  tableName: 'events',
  timestamps: true,
  paranoid: true,
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Event;
