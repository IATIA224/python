# 🚀 Quick Start Commands

## Initial Setup (One-Time)

### 1. Install Admin Dashboard Dependencies
```bash
cd frontend_admin
npm install
cd ..
```

---

## Running the Application

### Option A: Backend + Admin Dashboard (Recommended for Admin Work)
```bash
npm run dev:admin
```
**Runs:**
- Backend API: http://localhost:8000
- Admin Dashboard: http://localhost:3001

---

### Option B: Backend + User Frontend (Default)
```bash
npm run dev
```
**Runs:**
- Backend API: http://localhost:8000
- User Frontend: http://localhost:5173

---

## Individual Services

### Backend Only
```bash
npm run backend
```

### User Frontend Only
```bash
npm run frontend
```

### Admin Dashboard Only
```bash
npm run frontend:admin
```

---

## Production Build

### Build User Frontend
```bash
npm run build
```

### Build Admin Dashboard
```bash
npm run build:admin
```

---

## 🎯 Script Reference

| Command | Description | Ports |
|---------|-------------|-------|
| `npm run dev:admin` | Backend + Admin | 8000, 3001 |
| `npm run dev` | Backend + User | 8000, 5173 |
| `npm run backend` | Backend only | 8000 |
| `npm run frontend` | User frontend only | 5173 |
| `npm run frontend:admin` | Admin frontend only | 3001 |

---

## ✅ Verification

After running `npm run dev:admin`, verify:

1. **Backend**: http://localhost:8000
   - Should show: `{"message": "Welcome to PacificSupport API"}`

2. **Admin Dashboard**: http://localhost:3001
   - Should display the admin interface

---

## 📋 Complete Setup Checklist

- [ ] Navigate to `frontend_admin` folder
- [ ] Run `npm install`
- [ ] Return to root directory
- [ ] Run `npm run dev:admin`
- [ ] Open browser to http://localhost:3001
- [ ] Verify admin dashboard loads successfully

---

## 🛠️ Troubleshooting

### Dependencies Not Installed
```bash
# Install all dependencies
cd frontend && npm install && cd ..
cd frontend_admin && npm install && cd ..
cd backend && pip install -r requirements.txt && cd ..
```

### Port Conflicts
```bash
# Windows - Kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Python Environment
```bash
# Activate virtual environment if using one
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

---

**For full documentation, see [ADMIN_SETUP.md](ADMIN_SETUP.md)**
