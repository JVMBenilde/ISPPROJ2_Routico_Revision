const bcrypt = require('bcryptjs');
const { deleteFirebaseUser } = require('../utils/firebaseUtils');
const fileStorageService = require('./fileStorageService');

/**
 * Registration service to handle user registration with data integrity
 */
class RegistrationService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Register a new business owner with data integrity checks
   * @param {Object} userData - User registration data
   * @param {Object} fileData - Uploaded file data
   * @returns {Promise<Object>} - Registration result
   */
  async registerBusinessOwner(userData, fileData = null) {
    const { fullName, email, phone, password, firebase_uid } = userData;
    
    // Start database transaction
    await this.db.query('START TRANSACTION');
    
    try {
      // Step 1: Validate input data
      await this.validateRegistrationData(userData);
      
      // Step 2: Check for existing users
      await this.checkExistingUser(email);
      
      // Step 3: Store document metadata temporarily (will update with userId after user creation)
      let documentKey = null;
      let documentBuffer = null;
      let documentMetadata = null;
      if (fileData) {
        documentBuffer = fileData.buffer;
        documentMetadata = {
          originalname: fileData.originalname,
          mimetype: fileData.mimetype,
          userEmail: email
        };
      }
      
      // Step 4: Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Step 5: Insert user into database
      const result = await this.db.query(
        `INSERT INTO users (
          full_name, email, password_hash, phone, account_status, 
          active_status, role, created_at
        ) VALUES (?, ?, ?, ?, 'pending', 'inactive', 'business_owner', NOW())`,
        [
          fullName,
          email,
          passwordHash,
          phone
        ]
      );
      
      const userId = result[0].insertId;
      
      // Step 6: Create business owner record
      await this.db.query(
        `INSERT INTO businessowners (user_id, company_name) 
         VALUES (?, ?)`,
        [userId, `${fullName}'s Business`] // Placeholder company name
      );
      
      console.log(`Business owner record created for user ${userId}`);
      
      // Step 7: Upload document to MinIO with userId in metadata (after user creation)
      if (documentBuffer && documentMetadata) {
        try {
          documentKey = await fileStorageService.uploadCompanyDocument(
            documentBuffer,
            documentMetadata.originalname,
            documentMetadata.mimetype,
            { 
              userId: userId.toString(),
              userEmail: documentMetadata.userEmail,
              uploadedAt: new Date().toISOString()
            }
          );
          console.log(`Company document uploaded to MinIO: ${documentKey} for user ${userId}`);
        } catch (uploadError) {
          console.error('Error uploading to MinIO:', uploadError);
          // Don't fail registration if document upload fails
          console.warn('Registration will proceed without document');
        }
      }
      
      // Step 8: Commit transaction
      await this.db.query('COMMIT');
      
      return {
        success: true,
        userId: result[0].insertId,
        message: 'User registered successfully. Account is pending approval.'
      };
      
    } catch (error) {
      // Rollback transaction on any error
      await this.db.query('ROLLBACK');
      
      // Clean up uploaded file from MinIO if exists
      if (documentKey) {
        try {
          await fileStorageService.deleteFile('documents', documentKey);
          console.log(`Cleaned up MinIO file: ${documentKey}`);
        } catch (cleanupError) {
          console.error('Error cleaning up MinIO file:', cleanupError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Validate registration data
   * @param {Object} userData - User data to validate
   */
  async validateRegistrationData(userData) {
    const { fullName, email, phone, password } = userData;
    
    // Check required fields
    if (!fullName || !email || !phone || !password) {
      throw new Error('All fields are required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    // Validate phone format (more flexible for international numbers)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^[\+]?[0-9][0-9]*$/;
    if (!phoneRegex.test(cleanPhone) || cleanPhone.length < 8 || cleanPhone.length > 16) {
      throw new Error('Please enter a valid phone number (8-16 digits)');
    }
    
    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
  }

  /**
   * Check if user already exists
   * @param {string} email - User email
   * @param {string} firebase_uid - Firebase UID
   */
  async checkExistingUser(email) {
    const result = await this.db.query(
      'SELECT user_id, email FROM users WHERE email = ?',
      [email]
    );
    
    if (result[0].length > 0) {
      throw new Error('User with this email already exists');
    }
  }

  /**
   * Cleanup failed registration (delete Firebase user if database insert fails)
   * @param {string} firebase_uid - Firebase UID to delete
   */
  async cleanupFailedRegistration(firebase_uid) {
    try {
      await deleteFirebaseUser(firebase_uid);
      console.log(`Cleaned up Firebase user: ${firebase_uid}`);
    } catch (error) {
      console.error(`Failed to cleanup Firebase user ${firebase_uid}:`, error);
    }
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} - User data
   */
  async getUserByEmail(email) {
    const result = await this.db.query(
      'SELECT user_id, full_name, email, phone, account_status, active_status, role, created_at FROM users WHERE email = ?',
      [email]
    );
    
    if (result[0].length === 0) {
      throw new Error('User not found');
    }
    
    return result[0][0];
  }
}

module.exports = RegistrationService;
