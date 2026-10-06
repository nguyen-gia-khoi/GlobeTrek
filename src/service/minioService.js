const Minio = require('minio');
require('dotenv').config();

const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = parseInt(process.env.MINIO_PORT, 10) || 9000;
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || '';
const secretKey = process.env.MINIO_SECRET_KEY || '';
const bucketName = process.env.MINIO_BUCKET_NAME || 'globetrek-media';
const publicUrl = process.env.MINIO_PUBLIC_URL || `http://${endpoint}:${port}`;

// Initialize MinIO Client
const minioClient = new Minio.Client({
  endPoint: endpoint,
  port: port,
  useSSL: useSSL,
  accessKey: accessKey,
  secretKey: secretKey,
});

/**
 * Ensures that the default bucket exists and has public read access
 */
const initMinioBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      console.log(`[MinIO] Bucket "${bucketName}" does not exist. Creating...`);
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`[MinIO] Bucket "${bucketName}" created successfully.`);

      // Apply public read-only policy for web media access
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };

      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
      console.log(`[MinIO] Public read policy applied to "${bucketName}".`);
    } else {
      console.log(`[MinIO] Connected to bucket "${bucketName}".`);
    }
  } catch (error) {
    const errorMsg = error.message || error.code || error.toString();
    if (error.code === 'ECONNREFUSED' || errorMsg.includes('ECONNREFUSED')) {
      console.warn(`[MinIO] Cảnh báo: Chưa kết nối được MinIO tại ${endpoint}:${port} (MinIO server chưa chạy).`);
      console.warn(`[MinIO] Mẹo: Hãy khởi động MinIO bằng lệnh 'docker compose up -d minio' hoặc kiểm tra cổng 9000.`);
    } else {
      console.error(`[MinIO] Lỗi khởi tạo bucket "${bucketName}":`, errorMsg);
    }
  }
};

/**
 * Upload a file buffer directly to MinIO
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - File name to store
 * @param {string} mimeType - Content type (e.g. image/webp, video/mp4)
 * @param {string} folder - Subdirectory folder (default: 'tourDetails')
 * @returns {Promise<string>} Public URL of uploaded object
 */
const uploadBufferToMinio = async (buffer, fileName, mimeType, folder = 'tourDetails') => {
  try {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedName}`;

    await minioClient.putObject(bucketName, objectName, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    const fileUrl = `${publicUrl}/${bucketName}/${objectName}`;
    return fileUrl;
  } catch (error) {
    console.error('[MinIO] Upload error:', error);
    throw new Error(`Failed to upload to MinIO: ${error.message}`);
  }
};

/**
 * Delete an object from MinIO by its URL
 * @param {string} fileUrl 
 */
const deleteFileFromMinio = async (fileUrl) => {
  try {
    if (!fileUrl || !fileUrl.includes(bucketName)) return;
    const objectName = fileUrl.split(`${bucketName}/`)[1];
    if (objectName) {
      await minioClient.removeObject(bucketName, objectName);
      console.log(`[MinIO] Deleted object: ${objectName}`);
    }
  } catch (error) {
    console.error('[MinIO] Delete error:', error.message);
  }
};

// Automatically attempt to initialize bucket on startup
initMinioBucket();

module.exports = {
  minioClient,
  bucketName,
  initMinioBucket,
  uploadBufferToMinio,
  deleteFileFromMinio,
};
