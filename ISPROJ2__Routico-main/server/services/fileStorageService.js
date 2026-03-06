const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(path.join(UPLOADS_DIR, 'company-documents'));
ensureDir(path.join(UPLOADS_DIR, 'payment-proofs'));

class FileStorageService {
  constructor() {
    this.uploadsDir = UPLOADS_DIR;
  }

  async initializeBuckets() {
    ensureDir(path.join(this.uploadsDir, 'company-documents'));
    ensureDir(path.join(this.uploadsDir, 'payment-proofs'));
    console.log('Local file storage initialized');
  }

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

  async uploadFromBuffer(bucketName, objectKey, buffer, contentType, metadata = {}) {
    const filePath = path.join(this.uploadsDir, objectKey);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);

    // Save metadata alongside the file
    const metaPath = filePath + '.meta.json';
    fs.writeFileSync(metaPath, JSON.stringify({ contentType, metadata, size: buffer.length }));

    console.log(`Saved file: ${filePath}`);
    return { success: true, objectKey, size: buffer.length, contentType };
  }

  async uploadCompanyDocument(buffer, originalFilename, contentType, metadata = {}) {
    const objectKey = this.generateObjectKey(originalFilename, 'company-documents');
    await this.uploadFromBuffer('documents', objectKey, buffer, contentType, metadata);
    return objectKey;
  }

  async uploadPaymentProof(buffer, originalFilename, contentType, metadata = {}) {
    const objectKey = this.generateObjectKey(originalFilename, 'payment-proofs');
    await this.uploadFromBuffer('payments', objectKey, buffer, contentType, metadata);
    return objectKey;
  }

  async downloadAsStream(bucketName, objectKey) {
    const filePath = path.join(this.uploadsDir, objectKey);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(filePath);
  }

  async downloadCompanyDocument(objectKey) {
    return this.downloadAsStream('documents', objectKey);
  }

  async downloadPaymentProof(objectKey) {
    return this.downloadAsStream('payments', objectKey);
  }

  async getFileMetadata(bucketName, objectKey) {
    const filePath = path.join(this.uploadsDir, objectKey);
    const metaPath = filePath + '.meta.json';

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const stat = fs.statSync(filePath);
      return {
        size: stat.size,
        lastModified: stat.mtime,
        contentType: meta.contentType || 'application/octet-stream'
      };
    }

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return { size: stat.size, lastModified: stat.mtime, contentType: 'application/octet-stream' };
    }

    throw new Error('File not found');
  }

  async deleteFile(bucketName, objectKey) {
    const filePath = path.join(this.uploadsDir, objectKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const metaPath = filePath + '.meta.json';
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    return true;
  }

  async fileExists(bucketName, objectKey) {
    return fs.existsSync(path.join(this.uploadsDir, objectKey));
  }

  async findCompanyDocumentByUserId(userId) {
    const docsDir = path.join(this.uploadsDir, 'company-documents');
    if (!fs.existsSync(docsDir)) return null;

    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.meta.json'));
    for (const metaFile of files) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(docsDir, metaFile), 'utf8'));
        const userIdValue = meta.metadata?.userid || meta.metadata?.userId;
        if (userIdValue && userIdValue.toString() === userId.toString()) {
          return 'company-documents/' + metaFile.replace('.meta.json', '');
        }
      } catch (e) { /* skip */ }
    }
    return null;
  }
}

module.exports = new FileStorageService();
