# LifeLine — Blood Bank & Donor Network

LifeLine is a production-grade blood donor coordination platform and REST API built with Node.js, Express, MongoDB, EJS, HTML, CSS and JavaScript.

---

## Project Structure & Architecture

The application is structured into decoupled frontend, backend, test, and deployment modules:

```text
BloodBankManagement/
├── backend/
│   ├── src/
│   │   ├── config/              # Database connection & environment validation
│   │   ├── controllers/         # Request handling & business logic
│   │   ├── middleware/          # Security, Auth, CSRF, Rate Limiting & File Uploads
│   │   ├── models/              # Mongoose schemas (User, Donor, Stock, Requests, etc.)
│   │   ├── routes/              # Web SSR routes and REST API endpoints (/api/v1/...)
│   │   ├── utils/               # Blood compatibility rules, CSV escaping, transactions
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # Server entrypoint with graceful shutdown
│   └── package.json             # Backend package descriptor for standalone deploy
├── frontend/
│   ├── public/                  # Static client assets
│   │   ├── css/style.css        # Responsive styles
│   │   ├── js/script.js         # Client interactivity, modals & animations
│   │   └── images/              # Optimized image assets (kebab-case naming)
│   └── views/                   # Server-rendered EJS templates & partials
├── scripts/
│   ├── make-admin.js            # CLI utility to promote users to administrator
│   └── seed.js                  # Database seeder (sample banks, inventory, donors, admin)
├── tests/                       # Automated unit, view rendering, and API test suites
├── uploads/donors/              # Local storage for donor profile photos (git-ignored)
├── legacy/flask-mysql/          # Archived Flask & MySQL v1 codebase (retained reference)
├── docker-compose.yml           # Production Docker Compose (App + Mongo Replica Set)
├── Dockerfile                   # Lean production Docker container build
├── ecosystem.config.cjs         # PM2 cluster configuration
├── .env.example                 # Environment template
└── package.json                 # Root automation & task scripts
```

---

## Requirements

- **Node.js 20+** (LTS recommended)
- **MongoDB 4.0+** running as a **replica set** (required for multi-document transactions in donor requests, stock fulfillment, and account deactivation).

---

## How to Set Up the Database

Multi-document transactions are required for core operations. A replica set must be active. Choose **one** of the three methods below:

### Method 1: Docker Compose (Recommended & Fastest)

If you have Docker installed, you can spin up MongoDB as a configured single-node replica set (`rs0`) alongside the application with a single command:

```powershell
docker compose up -d
```

This starts:
1. MongoDB 6.0 with replica set `rs0` automatically initiated on `localhost:27017`.
2. The LifeLine Node.js application running on `http://localhost:3000`.

To seed initial sample data inside the container:
```powershell
docker compose exec app npm run seed
```

---

### Method 2: Local MongoDB Replica Set (Windows / macOS / Linux)

If you are running MongoDB installed locally on your machine:

#### Step 1: Create a data folder
```powershell
mkdir C:\data\db
```

#### Step 2: Start `mongod` with the replica set flag
Open a terminal and start the MongoDB daemon:
```powershell
mongod --replSet rs0 --dbpath C:\data\db
```

#### Step 3: Initiate the replica set in `mongosh`
Open a second terminal window and run:
```powershell
mongosh
```
Inside the `mongosh` prompt, run:
```javascript
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "127.0.0.1:27017" }]
})
```
Check that the status returns `"ok": 1`:
```javascript
rs.status()
```

#### Step 4: Configure `.env`
Set the connection string in your `.env` file:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/lifeline?replicaSet=rs0
```

---

### Method 3: Cloud Database (MongoDB Atlas)

All free (M0) and paid clusters on MongoDB Atlas are 3-node replica sets by default.

1. Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a cluster (e.g., `Cluster0`).
3. Under **Security > Database Access**, create a user with read/write privileges.
4. Under **Security > Network Access**, add your current IP address (or `0.0.0.0/0` for cloud deployment).
5. Click **Connect > Drivers** and copy your connection string.
6. Paste it into your `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/lifeline?retryWrites=true&w=majority
   ```

---

## Local Setup & Quick Start

1. Install dependencies:
   ```powershell
   npm install
   ```

2. Create your `.env` file:
   ```powershell
   cp .env.example .env
   ```
   Ensure `.env` contains:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/lifeline?replicaSet=rs0
   SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters-long
   NODE_ENV=development
   ```

3. Seed initial database records (stock, verified blood banks, sample donors, and default admin):
   ```powershell
   npm run seed
   ```
   > Default seeded administrator: **`admin@lifeline.org`** / Password: **`Admin@12345`**

4. Start the application:
   ```powershell
   # Development with automatic restart on file change:
   npm run dev

   # Production mode:
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Admin Management

To promote any registered user to an administrator:

```powershell
npm run make-admin user@example.com
```

Alternatively, run in `mongosh`:
```javascript
use lifeline
db.users.updateOne({ email: "user@example.com" }, { $set: { role: "admin" } })
```

---

## REST API Endpoints (Decoupled Frontend Support)

In addition to server-rendered pages, the backend exposes REST API endpoints under `/api`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint returning status, uptime and timestamp |
| `GET` | `/api/inventory` | Returns real-time blood stock counts across all 8 blood groups |
| `GET` | `/api/donors` | Returns list of consented, available donors with optional filters (`bloodGroup`, `city`) |
| `GET` | `/api/emergency-match` | Returns compatible donor matches for a recipient blood group (`?bloodGroup=A+&city=...`) |
| `GET` | `/api/blood-banks` | Returns list of administrator-verified blood bank facilities |
| `GET` | `/api/user/requests` | Returns requests submitted by the currently authenticated session |

---

## Running Automated Tests

Run the full Node.js test suite:

```powershell
npm test
```

This executes:
- **Unit & Logic Tests**: Blood compatibility mapping, magic-byte photo validation, sanitization.
- **View Compilation Tests**: EJS template syntax and rendering fixtures across all 17 page templates.
- **API Tests**: JSON response validation and authentication protection.
- **Integration Tests**: Phone uniqueness, transaction handling, and account deactivation (automatically executed when MongoDB is active, cleanly skipped otherwise).

To run the legacy Flask/MySQL workflow tests:
```powershell
python -m unittest discover legacy/flask-mysql/tests
```

---

## Production Deployment

### 1. Docker Deployment
Build and run the production image:
```bash
docker build -t lifeline-bloodbank .
docker run -p 3000:3000 --env-file .env lifeline-bloodbank
```

### 2. Standalone Backend Deployment (Render, Railway, Fly.io)
If deploying the backend independently:
- Root directory: `backend` (or project root with `npm start`)
- Build command: `npm install --omit=dev`
- Start command: `node backend/src/server.js`
- Set environment variables: `PORT`, `MONGODB_URI`, `SESSION_SECRET`, `NODE_ENV=production`.

### 3. Process Manager (PM2 on Linux VPS)
```bash
npm install -g pm2
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

---

## Medical Disclaimer

LifeLine is a voluntary donor and blood bank coordination tool. Clinical blood eligibility, testing, screening, and transfusion compatibility must always be verified by qualified medical professionals. For medical emergencies, contact a hospital or emergency medical service directly.
