const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const provider = process.env.STORAGE_PROVIDER || 'local';
const localDir = path.resolve(process.env.LOCAL_STORAGE_DIR || './uploads');

// Setup S3 Client if configured
let s3Client = null;
if (provider === 's3') {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    region: process.env.S3_REGION || 'auto',
    forcePathStyle: true, // Needed for Cloudflare R2 / MinIO compatibility
  });
}

/**
 * Ensures the target local directory exists
 * @param {string} dirPath 
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate upload instructions for the client
 * @param {string} userPublicId 
 * @param {string} eventPublicId 
 * @param {string} filePublicId 
 * @param {string} sanitizedFilename 
 * @param {string} mimeType 
 * @returns {Promise<{ uploadUrl: string, method: string, fields: object, storageKey: string, provider: string }>}
 */
async function initiateUpload(userPublicId, eventPublicId, filePublicId, sanitizedFilename, mimeType) {
  const storageKey = `users/${userPublicId}/events/${eventPublicId}/files/${filePublicId}/${sanitizedFilename}`;

  if (provider === 's3') {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: storageKey,
      ContentType: mimeType,
    });
    // Presigned URL valid for 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return {
      uploadUrl,
      method: 'PUT',
      fields: {},
      storageKey,
      provider: 's3'
    };
  } else {
    // Local storage mode: client uploads directly to backend local-upload route
    const uploadUrl = `/files/upload-local?storageKey=${encodeURIComponent(storageKey)}`;
    return {
      uploadUrl,
      method: 'POST',
      fields: { storageKey },
      storageKey,
      provider: 'local'
    };
  }
}

/**
 * Generate a short-lived download URL for a file
 * @param {string} storageKey 
 * @param {string} originalName 
 * @returns {Promise<string>}
 */
async function getSignedDownloadUrl(storageKey, originalName) {
  if (provider === 's3') {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalName)}"`
    });
    // Signed download URL valid for 5 minutes
    return await getSignedUrl(s3Client, command, { expiresIn: 300 });
  } else {
    // Local storage mode: returns local download route
    return `/api/v1/files/download-local?storageKey=${encodeURIComponent(storageKey)}&filename=${encodeURIComponent(originalName)}`;
  }
}

/**
 * Delete a file object from storage
 * @param {string} storageKey 
 * @returns {Promise<boolean>}
 */
async function deleteObject(storageKey) {
  if (provider === 's3') {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: storageKey,
      });
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error(`S3 Delete Object Error:`, error);
      return false;
    }
  } else {
    try {
      const filePath = path.join(localDir, storageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // Clean up empty directories up to the root upload folder
        let dir = path.dirname(filePath);
        while (dir !== localDir && dir.startsWith(localDir)) {
          if (fs.readdirSync(dir).length === 0) {
            fs.rmdirSync(dir);
            dir = path.dirname(dir);
          } else {
            break;
          }
        }
      }
      return true;
    } catch (error) {
      console.error(`Local Delete Object Error:`, error);
      return false;
    }
  }
}

/**
 * Save an upload stream to local storage (only used in local provider mode)
 * @param {string} storageKey 
 * @param {Buffer} buffer 
 * @returns {Promise<boolean>}
 */
async function saveLocalFile(storageKey, buffer) {
  if (provider !== 'local') return false;
  const filePath = path.join(localDir, storageKey);
  ensureDirExists(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
  return true;
}

/**
 * Get local file read stream or buffer path (only used in local provider mode)
 * @param {string} storageKey 
 * @returns {string|null} File absolute path or null if doesn't exist
 */
function getLocalFilePath(storageKey) {
  if (provider !== 'local') return null;

  // Enforce strict storageKey format to prevent arbitrary file access or traversal
  const storageKeyRegex = /^users\/[a-zA-Z0-9\-_]+\/events\/[a-zA-Z0-9\-_]+\/files\/[a-zA-Z0-9\-_]+\/[a-zA-Z0-9.\-_]+$/;
  if (!storageKeyRegex.test(storageKey)) {
    return null;
  }

  const filePath = path.join(localDir, storageKey);
  const resolvedPath = path.resolve(filePath);

  // Verify that the resolved path is strictly within the uploads directory
  if (!resolvedPath.startsWith(localDir)) {
    return null;
  }

  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

/**
 * Get S3 readable stream for a file (only used in S3 provider mode)
 * @param {string} storageKey 
 * @returns {Promise<any>}
 */
async function getObjectStream(storageKey) {
  if (provider !== 's3') return null;
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: storageKey,
  });
  const response = await s3Client.send(command);
  return response.Body;
}

module.exports = {
  initiateUpload,
  getSignedDownloadUrl,
  deleteObject,
  saveLocalFile,
  getLocalFilePath,
  getObjectStream,
  localDir
};
