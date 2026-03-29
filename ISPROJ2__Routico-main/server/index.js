const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load environment variables FIRST
dotenv.config();

// Import database AFTER environment variables are loaded
const db = require('./config/database');
const fileStorageService = require('./services/fileStorageService');
const PermissionCacheService = require('./services/permissionCacheService');
const { runMigration } = require('./migrations/001_rbac_tables');
const { runAuditLogMigration } = require('./migrations/002_audit_logs');
const { runFleetMigration } = require('./migrations/003_fleet_management');
const { runNameFieldsMigration } = require('./migrations/004_separate_name_fields');
const AuditLogService = require('./services/auditLogService');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());

// Stripe webhook needs raw body BEFORE express.json() parses it
const stripeWebhookRoute = require('./routes/stripe');
app.use('/api/stripe', (req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
}, stripeWebhookRoute);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
let firebaseApp;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_KEY !== '{"type":"service_account","project_id":"your-project-id",...}') {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    console.log('Firebase features will be disabled.');
  }
} else {
  console.log('Firebase service account key not configured. Firebase features will be disabled.');
}

// Make database and file storage available globally for routes
app.locals.db = db;
app.locals.fileStorage = fileStorageService;

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Connected',
    firebase: firebaseApp ? 'Initialized' : 'Not initialized'
  });
});

// Audit logging middleware (captures all mutating requests)
const auditMiddleware = require('./middleware/auditMiddleware');
app.use(auditMiddleware);

// Import and use routes
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const billingRoutes = require('./routes/billing');
const driversRoutes = require('./routes/drivers');
const routeOptimizationRoutes = require('./routes/routeOptimization');
const trackingRoutes = require('./routes/tracking');
const issuesRoutes = require('./routes/issues');
const aiAnalyticsRoutes = require('./routes/ai-analytics');
const rolesRoutes = require('./routes/roles');
const auditLogRoutes = require('./routes/auditLogs');
const vehiclesRoutes = require('./routes/vehicles');
const reportsRoutes = require('./routes/reports');
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/routes', routeOptimizationRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/ai-analytics', aiAnalyticsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/reports', reportsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize file storage, RBAC, and start server
async function startServer() {
  try {
    await fileStorageService.initializeBuckets();

    // Run RBAC migration (creates tables if they don't exist)
    try {
      await runMigration(db);
    } catch (migrationError) {
      console.error('RBAC migration error:', migrationError);
    }

    // Run audit logs migration
    try {
      await runAuditLogMigration(db);
    } catch (migrationError) {
      console.error('Audit logs migration error:', migrationError);
    }

    // Run fleet management migration
    try {
      await runFleetMigration(db);
    } catch (migrationError) {
      console.error('Fleet management migration error:', migrationError);
    }

    // Run name fields migration
    try {
      await runNameFieldsMigration(db);
    } catch (migrationError) {
      console.error('Name fields migration error:', migrationError);
    }

    // Initialize audit log service
    app.locals.auditLog = new AuditLogService(db);

    // Initialize permission cache
    try {
      const permissionCache = new PermissionCacheService(db);
      await permissionCache.loadAll();
      app.locals.permissionCache = permissionCache;
    } catch (cacheError) {
      console.error('Permission cache initialization error:', cacheError);
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }
}

startServer();
