# Routico - Delivery Route Optimization System

A web-based delivery management platform for business owners to manage orders, drivers, fleet vehicles, and route optimization.

## Prerequisites

Download and install the following before setting up the project:

### Software

| # | Software | Download Link | Notes |
|---|----------|---------------|-------|
| 1 | **Node.js** (v20+) | https://nodejs.org | npm is bundled with it |
| 2 | **MySQL** (v8.0+) | https://dev.mysql.com/downloads/installer/ | Or use **XAMPP** (https://www.apachefriends.org) which bundles MySQL + phpMyAdmin |
| 3 | **Git** | https://git-scm.com/downloads | For cloning the repository |
| 4 | **MinIO** | https://min.io/download | For file storage (documents, payment proofs) |

### Accounts / Services (Free Tier)

| # | Service | Link | What You Need |
|---|---------|------|---------------|
| 5 | **Firebase** | https://console.firebase.google.com | Create a project, enable Email/Password authentication |
| 6 | **Google Maps Platform** | https://console.cloud.google.com | Enable Maps JavaScript API, Geocoding API, Places API |
| 7 | **Anthropic API** (optional) | https://console.anthropic.com | Only needed for AI predictive analytics feature |

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/riveroalecjoseph/Routico.git
cd Routico/ISPROJ2__Routico-main
```

### 2. Set Up the Database

1. Open MySQL (or phpMyAdmin if using XAMPP)
2. Run the SQL file to create all tables:

```bash
mysql -u root -p < routico-schema.sql
```

Or in phpMyAdmin: go to **Import** tab and upload `routico-schema.sql`.

### 3. Configure the Backend

1. Navigate to the server folder:

```bash
cd server
```

2. Create a `.env` file with the following variables:

```env
# MySQL Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=routico_db
DB_PORT=3306

# Server
PORT=3001
NODE_ENV=development

# Firebase Admin SDK
# Download from: Firebase Console > Project Settings > Service Accounts > Generate New Private Key
# Paste the entire JSON content as a single line
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/...","universe_domain":"googleapis.com"}

# MinIO File Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_DOCUMENTS=routico-documents
MINIO_BUCKET_PAYMENTS=routico-payment-proofs

# Anthropic API (optional - for AI features)
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

3. Install backend dependencies:

```bash
npm install
```

### 4. Configure the Frontend

1. Navigate to the frontend folder:

```bash
cd ../frontend
```

2. Create a `.env.local` file with the following variables:

```env
# Firebase Web Client Config
# Get from: Firebase Console > Project Settings > General > Your Apps > Web App
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Google Maps API
# Get from: https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

3. Install frontend dependencies:

```bash
npm install
```

### 5. Start MinIO (File Storage)

Run MinIO server before starting the app:

```bash
minio server /data
```

Default login at http://localhost:9000 is `minioadmin` / `minioadmin`.

### 6. Run the Application

Open **two terminals** and run:

**Terminal 1 - Backend (port 3001):**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend (port 5173):**
```bash
cd frontend
npm run dev
```

The app will be available at **http://localhost:5173**.

## Project Structure

```
ISPROJ2__Routico-main/
├── frontend/               # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Dashboard pages (Admin, Business Owner, Driver)
│   │   └── config/         # Firebase config
│   └── .env.local          # Frontend environment variables (create this)
├── server/                 # Express.js backend
│   ├── routes/             # API route handlers
│   ├── middleware/          # Auth & RBAC middleware
│   ├── migrations/         # Database migrations (run automatically on start)
│   ├── index.js            # Server entry point
│   └── .env                # Backend environment variables (create this)
├── routico-schema.sql      # Database schema (import this first)
└── database-schema.sql     # Database documentation
```

## User Roles

| Role | Description |
|------|-------------|
| **Administrator** | Manages all users, subscriptions, billing, and system settings |
| **Business Owner** | Manages orders, drivers, fleet vehicles, and customers |
| **Driver** | Views assigned deliveries and updates delivery status |

## Troubleshooting

- **"ECONNREFUSED" on server start** - Make sure MySQL is running and your `.env` credentials are correct
- **"Firebase Admin SDK" errors** - Check that `FIREBASE_SERVICE_ACCOUNT_KEY` in `server/.env` is valid JSON on a single line
- **Frontend shows blank page** - Check that `frontend/.env.local` exists with valid Firebase config
- **File uploads not working** - Make sure MinIO is running on port 9000
- **Database migration errors** - The server runs migrations automatically on start; check the console output for details
