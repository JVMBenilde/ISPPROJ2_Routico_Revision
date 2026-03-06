const admin = require('firebase-admin');

/**
 * Utility functions for Firebase operations
 */

/**
 * Delete a Firebase user by UID
 * @param {string} uid - Firebase user UID
 * @returns {Promise<boolean>} - Success status
 */
const deleteFirebaseUser = async (uid) => {
  try {
    await admin.auth().deleteUser(uid);
    console.log(`Firebase user ${uid} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting Firebase user ${uid}:`, error);
    return false;
  }
};

/**
 * Verify if a Firebase user exists
 * @param {string} uid - Firebase user UID
 * @returns {Promise<boolean>} - User exists status
 */
const verifyFirebaseUser = async (uid) => {
  try {
    await admin.auth().getUser(uid);
    return true;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
};

/**
 * Get Firebase user data
 * @param {string} uid - Firebase user UID
 * @returns {Promise<Object>} - User data
 */
const getFirebaseUser = async (uid) => {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName,
      createdAt: userRecord.metadata.creationTime,
      lastSignIn: userRecord.metadata.lastSignInTime
    };
  } catch (error) {
    console.error(`Error getting Firebase user ${uid}:`, error);
    throw error;
  }
};

/**
 * Update Firebase user email
 * @param {string} uid - Firebase user UID
 * @param {string} email - New email
 * @returns {Promise<boolean>} - Success status
 */
const updateFirebaseUserEmail = async (uid, email) => {
  try {
    await admin.auth().updateUser(uid, {
      email: email
    });
    return true;
  } catch (error) {
    console.error(`Error updating Firebase user email ${uid}:`, error);
    return false;
  }
};

module.exports = {
  deleteFirebaseUser,
  verifyFirebaseUser,
  getFirebaseUser,
  updateFirebaseUserEmail
};
