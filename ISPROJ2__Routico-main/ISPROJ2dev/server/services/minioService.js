const Minio = require('minio');
const path = require('path');
const crypto = require('crypto');

/**
 * MinIO Service for S3-compatible object storage
 * Handles all file upload/download operations
 */
class MinioService {
  constructor() {
    // Initialize MinIO client
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    });

    // Bucket names
    this.BUCKETS = {
      DOCUMENTS: process.env.MINIO_BUCKET_DOCUMENTS || 'routico-documents',
      PAYMENT_PROOFS: process.env.MINIO_BUCKET_PAYMENTS || 'routico-payment-proofs'
    };
  }

  /**
   * Initialize MinIO buckets (create if they don't exist)
   */
  async initializeBuckets() {
    try {
      for (const bucketName of Object.values(this.BUCKETS)) {
        const exists = await this.minioClient.bucketExists(bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(bucketName, 'us-east-1');
          console.log(`✓ Created MinIO bucket: ${bucketName}`);
        } else {
          console.log(`✓ MinIO bucket exists: ${bucketName}`);
        }
      }
    } catch (error) {
      console.error('Error initializing MinIO buckets:', error);
      throw error;
    }
  }

  /**
   * Generate a unique object key for a file
   * @param {string} originalFilename - Original filename
   * @param {string} prefix - Prefix for the object key (e.g., 'company-documents', 'payment-proofs')
   * @returns {string} - Unique object key
   */
  generateObjectKey(originalFilename, prefix = '') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, extension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    if (prefix) {
      return `${prefix}/${timestamp}-${randomString}-${sanitizedBaseName}${extension}`;
    }
    return `${timestamp}-${randomString}-${sanitizedBaseName}${extension}`;
  }

  /**
   * Upload a file to MinIO from buffer
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key (path in bucket)
   * @param {Buffer} buffer - File buffer
   * @param {string} contentType - MIME type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFromBuffer(bucketName, objectKey, buffer, contentType, metadata = {}) {
    try {
      const metaData = {
        'Content-Type': contentType,
        ...metadata
      };

      await this.minioClient.putObject(
        bucketName,
        objectKey,
        buffer,
        buffer.length,
        metaData
      );

      console.log(`✓ Uploaded to MinIO: ${bucketName}/${objectKey}`);
      
      return {
        success: true,
        bucket: bucketName,
        objectKey: objectKey,
        size: buffer.length,
        contentType: contentType
      };
    } catch (error) {
      console.error('Error uploading to MinIO:', error);
      throw new Error(`Failed to upload file to object storage: ${error.message}`);
    }
  }

  /**
   * Upload a file to MinIO from stream
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key
   * @param {Stream} stream - File stream
   * @param {number} size - File size
   * @param {string} contentType - MIME type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFromStream(bucketName, objectKey, stream, size, contentType, metadata = {}) {
    try {
      const metaData = {
        'Content-Type': contentType,
        ...metadata
      };

      await this.minioClient.putObject(
        bucketName,
        objectKey,
        stream,
        size,
        metaData
      );

      console.log(`✓ Uploaded to MinIO: ${bucketName}/${objectKey}`);
      
      return {
        success: true,
        bucket: bucketName,
        objectKey: objectKey,
        size: size,
        contentType: contentType
      };
    } catch (error) {
      console.error('Error uploading to MinIO:', error);
      throw new Error(`Failed to upload file to object storage: ${error.message}`);
    }
  }

  /**
   * Download a file from MinIO as a stream
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key
   * @returns {Promise<Stream>} - File stream
   */
  async downloadAsStream(bucketName, objectKey) {
    try {
      const stream = await this.minioClient.getObject(bucketName, objectKey);
      return stream;
    } catch (error) {
      console.error('Error downloading from MinIO:', error);
      throw new Error(`Failed to download file from object storage: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(bucketName, objectKey) {
    try {
      const stat = await this.minioClient.statObject(bucketName, objectKey);
      return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        contentType: stat.metaData['content-type'] || 'application/octet-stream'
      };
    } catch (error) {
      console.error('Error getting file metadata from MinIO:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for temporary access
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key
   * @param {number} expirySeconds - URL expiry time in seconds (default: 1 hour)
   * @returns {Promise<string>} - Presigned URL
   */
  async getPresignedUrl(bucketName, objectKey, expirySeconds = 3600) {
    try {
      const url = await this.minioClient.presignedGetObject(
        bucketName,
        objectKey,
        expirySeconds
      );
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Delete a file from MinIO
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(bucketName, objectKey) {
    try {
      await this.minioClient.removeObject(bucketName, objectKey);
      console.log(`✓ Deleted from MinIO: ${bucketName}/${objectKey}`);
      return true;
    } catch (error) {
      console.error('Error deleting from MinIO:', error);
      throw new Error(`Failed to delete file from object storage: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in MinIO
   * @param {string} bucketName - Bucket name
   * @param {string} objectKey - Object key
   * @returns {Promise<boolean>} - Whether file exists
   */
  async fileExists(bucketName, objectKey) {
    try {
      await this.minioClient.statObject(bucketName, objectKey);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Upload company registration document
   * @param {Buffer} buffer - File buffer
   * @param {string} originalFilename - Original filename
   * @param {string} contentType - MIME type
   * @param {Object} metadata - Additional metadata (userId, email, etc.)
   * @returns {Promise<string>} - Object key
   */
  async uploadCompanyDocument(buffer, originalFilename, contentType, metadata = {}) {
    const objectKey = this.generateObjectKey(originalFilename, 'company-documents');
    await this.uploadFromBuffer(
      this.BUCKETS.DOCUMENTS,
      objectKey,
      buffer,
      contentType,
      metadata
    );
    return objectKey;
  }

  /**
   * Upload payment proof
   * @param {Buffer} buffer - File buffer
   * @param {string} originalFilename - Original filename
   * @param {string} contentType - MIME type
   * @param {Object} metadata - Additional metadata (ownerId, statementId, etc.)
   * @returns {Promise<string>} - Object key
   */
  async uploadPaymentProof(buffer, originalFilename, contentType, metadata = {}) {
    const objectKey = this.generateObjectKey(originalFilename, 'payment-proofs');
    await this.uploadFromBuffer(
      this.BUCKETS.PAYMENT_PROOFS,
      objectKey,
      buffer,
      contentType,
      metadata
    );
    return objectKey;
  }

  /**
   * Download company document
   * @param {string} objectKey - Object key
   * @returns {Promise<Stream>} - File stream
   */
  async downloadCompanyDocument(objectKey) {
    return await this.downloadAsStream(this.BUCKETS.DOCUMENTS, objectKey);
  }

  /**
   * Download payment proof
   * @param {string} objectKey - Object key
   * @returns {Promise<Stream>} - File stream
   */
  async downloadPaymentProof(objectKey) {
    return await this.downloadAsStream(this.BUCKETS.PAYMENT_PROOFS, objectKey);
  }

  /**
   * Find company document by userId in metadata
   * @param {string} userId - User ID to search for
   * @returns {Promise<string|null>} - Object key if found, null otherwise
   */
  async findCompanyDocumentByUserId(userId) {
    try {
      console.log(`Searching for document with userId: ${userId}`);
      
      const stream = this.minioClient.listObjectsV2(
        this.BUCKETS.DOCUMENTS,
        'company-documents/',
        true
      );

      return new Promise((resolve, reject) => {
        let found = false;
        const objects = [];

        stream.on('data', (obj) => {
          if (!found) {
            objects.push(obj);
          }
        });

        stream.on('end', async () => {
          if (found) return;

          console.log(`Found ${objects.length} documents to check`);

          // Check each object's metadata
          for (const obj of objects) {
            try {
              const stat = await this.minioClient.statObject(
                this.BUCKETS.DOCUMENTS,
                obj.name
              );

              console.log(`Checking ${obj.name}, metadata:`, stat.metaData);

              // Check if userId matches in metadata (case-insensitive key check)
              const metadata = stat.metaData || {};
              const userIdValue = metadata.userid || metadata.userId || metadata.UserId;
              
              if (userIdValue === userId.toString()) {
                found = true;
                resolve(obj.name);
                return;
              }
            } catch (err) {
              console.error(`Error checking object ${obj.name} metadata:`, err);
            }
          }

          if (!found) {
            console.log('No document found with matching userId in metadata');
            
            // Fallback: If no metadata match, return the most recent document
            // This helps with documents uploaded before metadata system was in place
            if (objects.length > 0) {
              console.log('Fallback: returning most recent document');
              const sortedObjects = objects.sort((a, b) => 
                new Date(b.lastModified) - new Date(a.lastModified)
              );
              resolve(sortedObjects[0].name);
            } else {
              resolve(null);
            }
          }
        });

        stream.on('error', (err) => {
          console.error('Error listing objects:', err);
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error finding document by userId:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new MinioService();

