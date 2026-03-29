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
    const { firstName, lastName, middleName, email, phone, password } = userData;
    const fullName = middleName
      ? `${firstName} ${middleName} ${lastName}`
      : `${firstName} ${lastName}`;
    
    let documentKey = null;
    let documentBuffer = null;
    let documentMetadata = null;

    // Start database transaction
    await this.db.query('START TRANSACTION');

    try {
      // Step 1: Validate input data
      await this.validateRegistrationData(userData);

      // Step 2: Check for existing users
      await this.checkExistingUser(email);
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
      
      // Step 5: Get the business_owner role_id
      const [roleRows] = await this.db.query(
        "SELECT role_id FROM roles WHERE role_name = 'business_owner'"
      );
      const roleId = roleRows.length > 0 ? roleRows[0].role_id : null;

      // Step 6: Insert user into database
      const result = await this.db.query(
        `INSERT INTO users (
          full_name, first_name, last_name, middle_name, email, password_hash, phone, account_status,
          active_status, role, role_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'inactive', 'business_owner', ?, NOW())`,
        [
          fullName,
          firstName,
          lastName,
          middleName || null,
          email,
          passwordHash,
          phone,
          roleId
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
    const { firstName, lastName, email, phone, password } = userData;

    // Check required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      throw new Error('All fields are required');
    }

    // Validate name fields (letters, spaces, hyphens, apostrophes only)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(firstName)) {
      throw new Error('First name must contain only letters');
    }
    if (!nameRegex.test(lastName)) {
      throw new Error('Last name must contain only letters');
    }
    if (userData.middleName && !nameRegex.test(userData.middleName)) {
      throw new Error('Middle name must contain only letters');
    }
    
    // Validate email format (must have 2+ chars before @, valid domain, 2+ char TLD)
    const emailRegex = /^[a-zA-Z0-9._%+-]{2,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address (e.g., name@example.com)');
    }

    // Validate phone format (must be Philippine number: +63 followed by 10 digits)
    if (!/^\+63\d{10}$/.test(phone)) {
      throw new Error('Please enter a valid Philippine phone number (e.g., +639171234567)');
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
