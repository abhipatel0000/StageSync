const sequelize = require('../config/db');
const User = require('./User');
const RefreshToken = require('./RefreshToken');
const PasswordResetToken = require('./PasswordResetToken');
const Event = require('./Event');
const EventCredential = require('./EventCredential');
const File = require('./File');
const GuestSession = require('./GuestSession');
const QrAccessToken = require('./QrAccessToken');
const DownloadLog = require('./DownloadLog');
const AuditLog = require('./AuditLog');
const UploadSession = require('./UploadSession');
const EventPackage = require('./EventPackage');

// Associations

// User associations
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(PasswordResetToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Event, { foreignKey: 'owner_id', onDelete: 'RESTRICT' });
Event.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

User.hasMany(File, { foreignKey: 'uploader_id', onDelete: 'RESTRICT' });
File.belongsTo(User, { foreignKey: 'uploader_id', as: 'uploader' });

User.hasMany(AuditLog, { foreignKey: 'user_id', onDelete: 'SET NULL' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

// Event associations
Event.hasOne(EventCredential, { foreignKey: 'event_id', onDelete: 'CASCADE' });
EventCredential.belongsTo(Event, { foreignKey: 'event_id' });

Event.hasMany(File, { foreignKey: 'event_id', onDelete: 'CASCADE' });
File.belongsTo(Event, { foreignKey: 'event_id' });

Event.hasMany(GuestSession, { foreignKey: 'event_id', onDelete: 'CASCADE' });
GuestSession.belongsTo(Event, { foreignKey: 'event_id' });

Event.hasMany(QrAccessToken, { foreignKey: 'event_id', onDelete: 'CASCADE' });
QrAccessToken.belongsTo(Event, { foreignKey: 'event_id' });

Event.hasMany(DownloadLog, { foreignKey: 'event_id', onDelete: 'CASCADE' });
DownloadLog.belongsTo(Event, { foreignKey: 'event_id' });

Event.hasMany(AuditLog, { foreignKey: 'event_id', onDelete: 'SET NULL' });
AuditLog.belongsTo(Event, { foreignKey: 'event_id' });

Event.hasMany(EventPackage, { foreignKey: 'event_id', onDelete: 'CASCADE' });
EventPackage.belongsTo(Event, { foreignKey: 'event_id' });

// File associations
File.hasMany(DownloadLog, { foreignKey: 'file_id', onDelete: 'SET NULL' });
DownloadLog.belongsTo(File, { foreignKey: 'file_id' });

File.hasOne(UploadSession, { foreignKey: 'file_id', onDelete: 'CASCADE' });
UploadSession.belongsTo(File, { foreignKey: 'file_id' });

// GuestSession associations
GuestSession.hasMany(DownloadLog, { foreignKey: 'guest_session_id', onDelete: 'SET NULL' });
DownloadLog.belongsTo(GuestSession, { foreignKey: 'guest_session_id' });

module.exports = {
  sequelize,
  User,
  RefreshToken,
  PasswordResetToken,
  Event,
  EventCredential,
  File,
  GuestSession,
  QrAccessToken,
  DownloadLog,
  AuditLog,
  UploadSession,
  EventPackage
};
