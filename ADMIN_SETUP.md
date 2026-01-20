# Admin Dashboard Setup Guide

## 🎯 Overview

This document provides setup instructions for the **Pacific Support Admin Dashboard** - a concurrent development environment that runs the backend API alongside the admin frontend interface.

---

## 📁 Directory Structure

```
pacific-support-system/
├── backend/                    # FastAPI Backend
│   ├── main.py
│   ├── models.py
│   └── requirements.txt
├── frontend/                   # User Frontend (Port 5173)
│   └── src/
├── frontend_admin/            # Admin Dashboard (Port 3001)
│   ├── src/
│   │   ├── AdminDashboard.jsx
│   │   ├── AdminDashboard.css
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── package.json               # Root scripts
```

---

## 🚀 Quick Start Commands

### Step 1: Install Admin Dashboard Dependencies

Navigate to the admin folder and install packages:

```bash
cd frontend_admin
npm install
```

### Step 2: Run Backend + Admin Dashboard

From the **root directory**, execute:

```bash
npm run dev:admin
```

This command will:
- ✅ Start the **FastAPI Backend** on `http://localhost:8000`
- ✅ Start the **Admin Dashboard** on `http://localhost:3001`
- ❌ **NOT** start the User Frontend

### Step 3: Run Backend + User Frontend (Default)

To run the original user-facing setup:

```bash
npm run dev
```

This will:
- ✅ Start the **FastAPI Backend** on `http://localhost:8000`
- ✅ Start the **User Frontend** on `http://localhost:5173`
- ❌ **NOT** start the Admin Dashboard

---

## 📜 Available Scripts

All scripts are defined in the **root `package.json`**:

| Script | Description |
|--------|-------------|
| `npm run dev` | Run Backend + User Frontend |
| `npm run dev:admin` | Run Backend + Admin Dashboard |
| `npm run backend` | Run Backend only |
| `npm run frontend` | Run User Frontend only |
| `npm run frontend:admin` | Run Admin Dashboard only |
| `npm run build` | Build User Frontend for production |
| `npm run build:admin` | Build Admin Dashboard for production |

---

## 🎨 Design Consistency

The Admin Dashboard uses the **same design system** as the User Frontend:

### Color Palette
- **Primary**: `#1e3a8a` (Deep Blue)
- **Primary Light**: `#3b82f6`
- **Primary Dark**: `#1e40af`
- **Accent**: `#f59e0b` (Amber)
- **Success**: `#10b981` (Green)
- **Danger**: `#ef4444` (Red)
- **Warning**: `#f59e0b` (Amber)

### Design Elements
- Gradient headers with sticky positioning
- Consistent button styles and hover effects
- Matching card layouts and shadows
- Unified typography and spacing
- Responsive grid systems

---

## 🛠️ Admin Dashboard Features

### Reports Management
- **View All Tickets**: Browse all user-submitted support tickets in a table view
- **Search & Filter**: Search by keywords, filter by status and priority
- **Real-time Statistics**: Dashboard cards showing ticket counts by status
- **Detailed View**: Click any ticket to see full details including attachments

### Actions
- **Update Status**: Change ticket status (Open → In Progress → Resolved → Closed)
- **Delete Tickets**: Remove tickets with confirmation dialog
- **Add Replies**: Submit replies or internal notes (backend extension needed)
- **View Attachments**: Display uploaded images from tickets

### User Experience
- Responsive design for mobile and desktop
- Loading states and error handling
- Success/error notifications
- Modal dialogs for detailed interactions

---

## 🔌 API Endpoints Used

The Admin Dashboard connects to these FastAPI endpoints:

### GET Requests
- `GET /tickets` - Fetch all tickets
- `GET /tickets/{ticket_id}` - Get specific ticket details

### PATCH Requests
- `PATCH /tickets/{ticket_id}` - Update ticket status

### DELETE Requests
- `DELETE /tickets/{ticket_id}` - Delete a ticket

---

## 🧪 Testing the Setup

### 1. Verify Backend is Running
```bash
curl http://localhost:8000/
# Expected: {"message": "Welcome to PacificSupport API"}
```

### 2. Check Admin Dashboard Access
Open your browser to: `http://localhost:3001`

You should see:
- Admin Dashboard header with gradient styling
- Statistics cards showing ticket counts
- Search and filter controls
- Table of all tickets (if any exist)

### 3. Test Admin Actions
- Click the **👁️ (eye icon)** to view ticket details
- Use the status buttons to update ticket status
- Click **🗑️ (trash icon)** to delete a ticket
- Use search/filter to find specific tickets

---

## 📦 Dependencies

### Frontend Admin (`frontend_admin/package.json`)
```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "vite": "^7.2.4",
    "eslint": "^9.39.1"
  }
}
```

### Root (`package.json`)
```json
{
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

---

## 🔧 Configuration

### Vite Configuration (`frontend_admin/vite.config.js`)
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001  // Different port to avoid conflicts
  }
})
```

### API Base URL (`frontend_admin/src/AdminDashboard.jsx`)
```javascript
const API_BASE_URL = 'http://localhost:8000'
```

---

## 🌐 Port Allocations

| Service | Port | URL |
|---------|------|-----|
| Backend API | 8000 | http://localhost:8000 |
| User Frontend | 5173 | http://localhost:5173 |
| Admin Dashboard | 3001 | http://localhost:3001 |

---

## 📝 Development Workflow

### For User Frontend Development
```bash
npm run dev
# Backend runs on :8000
# User Frontend runs on :5173
```

### For Admin Dashboard Development
```bash
npm run dev:admin
# Backend runs on :8000
# Admin Dashboard runs on :3001
```

### Run All Services (Advanced)
If you need all three services running simultaneously:
```bash
# Terminal 1: Backend
npm run backend

# Terminal 2: User Frontend
npm run frontend

# Terminal 3: Admin Dashboard
npm run frontend:admin
```

---

## 🐛 Troubleshooting

### Port Already in Use
If you get a port conflict error:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3001 | xargs kill -9
```

### Backend Not Responding
Ensure the backend is running:
```bash
cd backend
python -m uvicorn main:app --reload
```

### CORS Errors
Make sure the backend `main.py` includes admin port in CORS:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],
    ...
)
```

---

## 🔐 Security Notes

⚠️ **Important**: This admin dashboard currently has **no authentication**. For production:

1. **Add Authentication**:
   - Implement JWT or session-based auth
   - Require admin credentials to access dashboard
   - Protect admin routes on backend

2. **Add Authorization**:
   - Role-based access control (RBAC)
   - Restrict certain actions to super admins
   - Audit logging for admin actions

3. **Secure Deployment**:
   - Use HTTPS in production
   - Configure proper CORS origins
   - Add rate limiting
   - Implement CSRF protection

---

## 📚 Next Steps

### Backend Extensions
To fully support admin features, add these endpoints to `backend/main.py`:

```python
# Add reply/comment to ticket
@app.post("/tickets/{ticket_id}/replies")
async def add_reply(ticket_id: str, reply: ReplyCreate):
    # Implementation needed
    pass

# Get ticket history
@app.get("/tickets/{ticket_id}/history")
async def get_ticket_history(ticket_id: str):
    # Implementation needed
    pass

# Bulk operations
@app.post("/tickets/bulk-update")
async def bulk_update(ticket_ids: list[str], updates: dict):
    # Implementation needed
    pass
```

### Frontend Enhancements
- Add user authentication UI
- Implement ticket assignment to admins
- Add real-time notifications (WebSockets)
- Create analytics/reporting dashboards
- Add export functionality (CSV, PDF)
- Implement bulk actions

---

## ✅ Completion Checklist

- [x] Admin dashboard folder created (`frontend_admin`)
- [x] React app scaffolded with Vite
- [x] Design consistency maintained with user frontend
- [x] Reports Management component implemented
- [x] Table view with all tickets
- [x] Search and filter functionality
- [x] Status update actions
- [x] Delete ticket functionality
- [x] Reply/note interface (UI ready)
- [x] Root `package.json` updated with concurrent scripts
- [x] `dev:admin` script configured
- [x] Port 3001 configured for admin dashboard
- [x] Documentation provided

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs in the terminal
3. Check browser console for frontend errors
4. Verify all dependencies are installed

---

**Happy Coding! 🚀**
