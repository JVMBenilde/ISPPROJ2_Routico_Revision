const admin = require('firebase-admin');

let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully');
      return firebaseApp;
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      return null;
    }
  } else {
    console.log('Firebase service account key not found. Firebase features will be disabled.');
    return null;
  }
};

const getFirebaseApp = () => {
  if (!firebaseApp) {
    firebaseApp = initializeFirebase();
  }
  return firebaseApp;
};

const getAuth = () => {
  const app = getFirebaseApp();
  return app ? app.auth() : null;
};

const getFirestore = () => {
  const app = getFirebaseApp();
  return app ? app.firestore() : null;
};

module.exports = {
  initializeFirebase,
  getFirebaseApp,
  getAuth,
  getFirestore,
};
