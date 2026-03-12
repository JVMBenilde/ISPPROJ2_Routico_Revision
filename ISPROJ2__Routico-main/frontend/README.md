# Routico - Delivery Route Optimization System

A full-stack delivery management platform with route optimization, fleet management, and real-time tracking.

## Prerequisites

- **Node.js** (v18 or higher)
- **MySQL** (v8.0 or higher)
- **MinIO** (for file storage)

## Project Structure

```
ISPROJ2dev/
├── frontend/          # React + Vite frontend
├── server/            # Express.js backend API
├── routico-schema.sql # Database schema
└── database-schema.sql # Database reference
```

## Setup Instructions

### 1. Database Setup

1. Open MySQL and create the database:

```sql
CREATE DATABASE IF NOT EXISTS routico_db;
```

2. Import the schema:

```bash
mysql -u root -p routico_db < routico-schema.sql
```

Or open `routico-schema.sql` in your MySQL client and run it.

### 2. Server Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server/` folder:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=routico_db
DB_PORT=3306
PORT=3001
NODE_ENV=development

# Firebase Admin SDK (get from Firebase Console > Project Settings > Service Accounts)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# MinIO (required for file storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_DOCUMENTS=routico-documents
MINIO_BUCKET_PAYMENTS=routico-payment-proofs

# Anthropic API Key (for AI features)
ANTHROPIC_API_KEY=your_api_key_here
```

Start the server:

```bash
npm run dev
```

Server runs at **http://localhost:3001**

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` folder:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Start the frontend:

```bash
npm run dev
```

Frontend runs at **http://localhost:5173**

## Creating an Admin Account

Run the built-in script from the `server/` folder:

```bash
node scripts/createAdminUser.js
```

This creates an admin account with:
- **Email:** `admin@routico.com`
- **Password:** `Admin123!`
- **Role:** `administrator`

## MinIO Setup (Required)

MinIO is used for file storage (company registration documents and payment proofs). You must have it running for the app to work properly.

### Install and run MinIO:

1. Download MinIO from https://min.io/download
2. Run the MinIO server:

```bash
minio server ./data
```

3. MinIO will start at **http://localhost:9000**
   - Default credentials: `minioadmin` / `minioadmin`
   - Admin console: **http://localhost:9001**

The server will automatically create the required buckets (`routico-documents` and `routico-payment-proofs`) on startup.

## Running All Services

Open three terminals:

**Terminal 1 - MinIO:**
```bash
minio server ./data
```

**Terminal 2 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.
