# PacificSupport - Full Stack Setup

## Prerequisites
- **Node.js** (v18+)
- **Python** (v3.8+)
- **MongoDB** running locally or remote connection

## Installation

### 1. Install Root Dependencies
```bash
npm install
```

### 2. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

## Running Concurrently (Development)

From the root directory, run both frontend and backend together:

```bash
npm run dev
```

This will start:
- **Backend**: `http://localhost:8000` (FastAPI)
- **Frontend**: `http://localhost:5173` (Vite React)

### Troubleshooting Concurrent Run
If ports are already in use, you can run them separately:

**Terminal 1 - Backend:**
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Environment Variables

Create a `.env` file in the `backend` folder:

```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=pacific_support
```

If MongoDB is remote:
```
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=pacific_support
```

## Building for Production

```bash
npm run build
```

## Deployment Notes

### Frontend
- Deploy built files from `frontend/dist/` to a static host (Vercel, Netlify, AWS S3, etc.)
- Update API URL in `Dashboard.jsx` to your backend domain

### Backend
- Deploy to a server (Heroku, AWS EC2, DigitalOcean, Railway, etc.)
- Ensure MongoDB connection is configured via environment variables
- CORS is already configured for production URLs

### Security During Deployment
- **Frontend**: Served as static files (CDN/static host)
- **Backend**: Running on a separate server/domain
- **CORS**: Configured to only allow requests from your frontend domain
- No security issues from concurrent development setup
