-- ============================================================
-- StageSync - MySQL Database Schema
-- Generated from Sequelize model definitions
--
-- HOW TO USE:
--   1. Open MySQL Workbench / phpMyAdmin / MySQL CLI
--   2. Create the database first (or use an existing one)
--   3. Run this entire file to create all tables
-- ============================================================

-- Create and use the database (change name if needed)
CREATE DATABASE IF NOT EXISTS `stagesync_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `stagesync_db`;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`                  BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `public_id`           CHAR(36)           NOT NULL,
  `full_name`           VARCHAR(150)       NOT NULL,
  `email`               VARCHAR(255)       NOT NULL,
  `password_hash`       VARCHAR(255)       NOT NULL,
  `email_verified_at`   DATETIME           NULL,
  `status`              ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  `created_at`          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`          DATETIME           NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `users_public_id_unique`  (`public_id`),
  UNIQUE KEY `users_email_unique`      (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED  NOT NULL,
  `token_hash`   VARCHAR(255)     NOT NULL,
  `expires_at`   DATETIME         NOT NULL,
  `revoked_at`   DATETIME         NULL,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `refresh_tokens_user_id_idx` (`user_id`),

  CONSTRAINT `fk_refresh_tokens_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id`           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED  NOT NULL,
  `token_hash`   VARCHAR(255)     NOT NULL,
  `expires_at`   DATETIME         NOT NULL,
  `used_at`      DATETIME         NULL,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `password_reset_tokens_user_id_idx` (`user_id`),

  CONSTRAINT `fk_password_reset_tokens_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: events
-- ============================================================
CREATE TABLE IF NOT EXISTS `events` (
  `id`                   BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `public_id`            CHAR(36)           NOT NULL,
  `owner_id`             BIGINT UNSIGNED    NOT NULL,
  `name`                 VARCHAR(255)       NOT NULL,
  `description`          TEXT               NULL,
  `venue_name`           VARCHAR(255)       NULL,
  `event_date`           DATE               NOT NULL,
  `access_starts_at`     DATETIME           NOT NULL,
  `access_expires_at`    DATETIME           NOT NULL,
  `retention_expires_at` DATETIME           NULL,
  `status`               ENUM('DRAFT', 'UPCOMING', 'ACTIVE', 'EXPIRED', 'ARCHIVED', 'DELETED')
                                            NOT NULL DEFAULT 'UPCOMING',
  `allow_download`       TINYINT(1)         NOT NULL DEFAULT 1,
  `allow_download_all`   TINYINT(1)         NOT NULL DEFAULT 1,
  `max_guest_sessions`   INT                NOT NULL DEFAULT 5,
  `created_at`           DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`           DATETIME           NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `events_public_id_unique` (`public_id`),
  KEY `events_owner_id_idx` (`owner_id`),

  CONSTRAINT `fk_events_owner`
    FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: event_credentials
-- ============================================================
CREATE TABLE IF NOT EXISTS `event_credentials` (
  `id`                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `event_id`              BIGINT UNSIGNED  NOT NULL,
  `event_code`            VARCHAR(32)      NOT NULL,
  `pin_hash`              VARCHAR(255)     NOT NULL,
  `pin_expires_at`        DATETIME         NULL,
  `failed_attempts`       INT              NOT NULL DEFAULT 0,
  `locked_until`          DATETIME         NULL,
  `credentials_version`   INT              NOT NULL DEFAULT 1,
  `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `event_credentials_event_id_unique`  (`event_id`),
  UNIQUE KEY `event_credentials_event_code_unique` (`event_code`),

  CONSTRAINT `fk_event_credentials_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: files
-- ============================================================
CREATE TABLE IF NOT EXISTS `files` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `public_id`       CHAR(36)         NOT NULL,
  `event_id`        BIGINT UNSIGNED  NOT NULL,
  `uploader_id`     BIGINT UNSIGNED  NOT NULL,
  `original_name`   VARCHAR(500)     NOT NULL,
  `display_name`    VARCHAR(500)     NOT NULL,
  `storage_key`     VARCHAR(512)     NOT NULL,
  `mime_type`       VARCHAR(255)     NOT NULL,
  `extension`       VARCHAR(32)      NULL,
  `size_bytes`      BIGINT           NOT NULL,
  `checksum`        VARCHAR(255)     NULL,
  `upload_status`   ENUM('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED')
                                     NOT NULL DEFAULT 'PENDING',
  `uploaded_at`     DATETIME         NULL,
  `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`      DATETIME         NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `files_public_id_unique`    (`public_id`),
  UNIQUE KEY `files_storage_key_unique`  (`storage_key`),
  KEY `files_event_id_idx`               (`event_id`),
  KEY `files_uploader_id_idx`            (`uploader_id`),

  CONSTRAINT `fk_files_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_files_uploader`
    FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: guest_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS `guest_sessions` (
  `id`                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `public_id`            CHAR(36)         NOT NULL,
  `event_id`             BIGINT UNSIGNED  NOT NULL,
  `session_token_hash`   VARCHAR(255)     NOT NULL,
  `auth_method`          ENUM('CODE_PIN', 'QR_TOKEN', 'DEVICE_APPROVAL')
                                          NOT NULL DEFAULT 'CODE_PIN',
  `credentials_version`  INT              NOT NULL DEFAULT 1,
  `ip_address`           VARCHAR(45)      NULL,
  `user_agent`           TEXT             NULL,
  `device_name`          VARCHAR(255)     NULL,
  `expires_at`           DATETIME         NOT NULL,
  `revoked_at`           DATETIME         NULL,
  `created_at`           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_activity_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `guest_sessions_public_id_unique`          (`public_id`),
  UNIQUE KEY `guest_sessions_session_token_hash_unique` (`session_token_hash`),
  KEY `guest_sessions_event_id_idx` (`event_id`),

  CONSTRAINT `fk_guest_sessions_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: qr_access_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS `qr_access_tokens` (
  `id`           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `event_id`     BIGINT UNSIGNED  NOT NULL,
  `token_hash`   VARCHAR(255)     NOT NULL,
  `expires_at`   DATETIME         NOT NULL,
  `used_at`      DATETIME         NULL,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_access_tokens_token_hash_unique` (`token_hash`),
  KEY `qr_access_tokens_event_id_idx` (`event_id`),

  CONSTRAINT `fk_qr_access_tokens_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: upload_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS `upload_sessions` (
  `id`          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `file_id`     BIGINT UNSIGNED  NOT NULL,
  `upload_id`   VARCHAR(500)     NULL,
  `status`      ENUM('INITIATED', 'UPLOADING', 'COMPLETED', 'ABORTED', 'EXPIRED')
                                 NOT NULL DEFAULT 'INITIATED',
  `expires_at`  DATETIME         NOT NULL,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `upload_sessions_file_id_unique` (`file_id`),

  CONSTRAINT `fk_upload_sessions_file`
    FOREIGN KEY (`file_id`) REFERENCES `files` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: event_packages
-- ============================================================
CREATE TABLE IF NOT EXISTS `event_packages` (
  `id`           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `event_id`     BIGINT UNSIGNED  NOT NULL,
  `storage_key`  VARCHAR(1000)    NULL,
  `status`       ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED')
                                  NOT NULL DEFAULT 'QUEUED',
  `size_bytes`   BIGINT           NULL,
  `expires_at`   DATETIME         NULL,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `event_packages_event_id_idx` (`event_id`),

  CONSTRAINT `fk_event_packages_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: download_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `download_logs` (
  `id`                BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `event_id`          BIGINT UNSIGNED  NOT NULL,
  `file_id`           BIGINT UNSIGNED  NULL,
  `guest_session_id`  BIGINT UNSIGNED  NULL,
  `download_type`     ENUM('SINGLE_FILE', 'EVENT_PACKAGE')
                                       NOT NULL DEFAULT 'SINGLE_FILE',
  `status`            ENUM('REQUESTED', 'AUTHORIZED', 'COMPLETED', 'FAILED')
                                       NOT NULL DEFAULT 'AUTHORIZED',
  `ip_address`        VARCHAR(45)      NULL,
  `user_agent`        TEXT             NULL,
  `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `download_logs_event_id_idx`         (`event_id`),
  KEY `download_logs_file_id_idx`          (`file_id`),
  KEY `download_logs_guest_session_id_idx` (`guest_session_id`),

  CONSTRAINT `fk_download_logs_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_download_logs_file`
    FOREIGN KEY (`file_id`) REFERENCES `files` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_download_logs_guest_session`
    FOREIGN KEY (`guest_session_id`) REFERENCES `guest_sessions` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT UNSIGNED  NULL,
  `event_id`       BIGINT UNSIGNED  NULL,
  `action`         VARCHAR(100)     NOT NULL,
  `resource_type`  VARCHAR(100)     NULL,
  `resource_id`    VARCHAR(100)     NULL,
  `ip_address`     VARCHAR(45)      NULL,
  `user_agent`     TEXT             NULL,
  `metadata`       JSON             NULL,
  `created_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_idx`  (`user_id`),
  KEY `audit_logs_event_id_idx` (`event_id`),

  CONSTRAINT `fk_audit_logs_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_audit_logs_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Done! All 12 tables created successfully.
-- Tables created (in dependency order):
--   1. users
--   2. refresh_tokens
--   3. password_reset_tokens
--   4. events
--   5. event_credentials
--   6. files
--   7. guest_sessions
--   8. qr_access_tokens
--   9. upload_sessions
--  10. event_packages
--  11. download_logs
--  12. audit_logs
-- ============================================================
