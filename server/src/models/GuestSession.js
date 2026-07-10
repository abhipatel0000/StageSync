const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GuestSession = sequelize.define('GuestSession', {
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
  session_token_hash: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  auth_method: {
    type: DataTypes.ENUM('CODE_PIN', 'QR_TOKEN', 'DEVICE_APPROVAL'),
    defaultValue: 'CODE_PIN',
    allowNull: false
  },
  credentials_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  device_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'guest_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'last_activity_at'
});

module.exports = GuestSession;
