# Real-Time Notifications Setup Guide

## Overview
Your Pacific Support System now has **real-time notifications** for the admin dashboard. When a new ticket is submitted or an admin responds to a ticket, connected admin users will see instant notifications without needing to refresh the page.

## What Was Implemented

### Backend Changes
1. **WebSocket Support** (`websocket_manager.py`)
   - Socket.IO integration for real-time communication
   - Admin namespace (`/admin`) - receives all ticket updates
   - User namespace (`/user`) - reporters receive their ticket updates
   - Event broadcasting for new tickets, updates, and responses

2. **API Updates** (`main.py`)
   - Integrated WebSocket with FastAPI
   - Broadcast notifications on ticket creation
   - Broadcast notifications on ticket status updates
   - Broadcast notifications on admin responses
   - Email notifications continue to work alongside WebSocket

3. **Email Service** (`email_service.py`)
   - Sends HTML emails when tickets are created/updated
   - Asynchronous to avoid blocking API responses

### Frontend Admin Changes
1. **Real-Time Updates** (`AdminDashboard.jsx`)
   - Socket.IO client connection on component mount
   - Automatic ticket list updates when new tickets arrive
   - Automatic ticket updates when status changes
   - Automatic response notifications
   - Toast-style notifications that auto-dismiss

2. **Notification UI** (`AdminDashboard.css`)
   - Beautiful notification badges with animations
   - Color-coded by event type:
     - 🟢 Green: New Ticket
     - 🔵 Blue: Ticket Updated
     - 🟣 Purple: New Response
   - Slide-in animation
   - Close button for manual dismissal

### Dependencies
- `python-socketio==5.10.0` - WebSocket support for Python
- `python-engineio==4.8.0` - Engine.IO protocol
- `aioredis==2.0.1` - For scaling in production
- `socket.io-client==4.7.2` - Frontend WebSocket client

## How It Works

### New Ticket Created
1. User submits a ticket via the user dashboard
2. Backend receives the ticket and broadcasts it to all connected admins
3. All admin dashboards instantly receive the notification
4. The new ticket appears at the top of their ticket list
5. Toast notification shows with "New ticket created: [Title]"
6. Reporter receives an email confirmation

### Admin Updates Ticket Status
1. Admin clicks "Update Status" on a ticket
2. Backend broadcasts update to:
   - All connected admins
   - The reporter (if connected)
   - Email notification sent to reporter
3. Admin dashboard instantly reflects the change

### Admin Responds to Ticket
1. Admin writes a response and submits it
2. Backend broadcasts the response to:
   - All connected admins
   - The reporter (if connected)
   - Email notification sent to reporter
3. Dashboard updates with the response
4. Notification shows "Admin Name responded to ticket"

## Getting Started

### 1. Install Dependencies
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend Admin
cd frontend_admin
npm install
```

### 2. Configure Email (Optional but Recommended)
In `backend/.env`:
```env
GMAIL_EMAIL=testeremailiatia@gmail.com
GMAIL_PASSWORD=srhbjoas uyhf qvhu
```

### 3. Start the Services

**Backend:**
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Admin:**
```bash
cd frontend_admin
npm run dev  # Runs on http://localhost:3001
```

**Frontend User:**
```bash
cd frontend
npm run dev  # Runs on http://localhost:5173
```

## How It Works in Deployment

Yes, **real-time notifications work perfectly in deployment!** Here's why:

### WebSocket Benefits
✅ **Works in production** - Socket.IO automatically falls back to polling if WebSocket isn't available
✅ **Bidirectional** - Server can send instant updates without client polling
✅ **Scalable** - Redis adapter can be configured for multiple server instances
✅ **Fallback support** - Uses HTTP long-polling if WebSocket fails
✅ **No page refresh needed** - Instant updates via persistent connection

### Deployment Considerations
1. **WebSocket Port** - Ensure port 8000 is open for both HTTP and WebSocket
2. **Reverse Proxy** - If using Nginx/Apache, configure WebSocket support:
   ```nginx
   # Nginx example
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```
3. **Scaling** - For multiple backend instances, configure Redis:
   ```python
   # In websocket_manager.py (optional)
   sio = AsyncServer(
       async_mode='asgi',
       client_manager=AsyncRedisManager('redis://localhost:6379'),
       cors_allowed_origins='*'
   )
   ```

## Event Types

### Admin Notifications
- **new_ticket** - A new support ticket was created
- **ticket_updated** - A ticket's status was changed
- **new_response** - An admin responded to a ticket

### User Notifications (When Connected)
- **ticket_updated** - Their ticket's status changed
- **new_response** - They received a response

## Testing Real-Time Features

1. **Open Admin Dashboard** - http://localhost:3001
2. **Open User Dashboard in Another Window** - http://localhost:5173
3. **Submit a Ticket** from the user side
4. **Observe instant notification** on the admin side
5. **Update the ticket status** in admin
6. **See automatic update** in user dashboard (if they're on the ticket)

## Connection Status

The admin dashboard connects to the WebSocket server automatically. You'll see console logs:
- `Connected to real-time notifications` - When successfully connected
- `Disconnected from real-time notifications` - When connection drops
- The system automatically reconnects with exponential backoff

## What About Auto-Refresh?

The website **automatically updates without refreshing** via:
1. **WebSocket Real-Time Updates** - Instant updates for all connected admins
2. **React State Management** - `setTickets()` updates the list immediately
3. **No Manual Refresh Needed** - The UI stays in sync with the server

This works in:
- ✅ Development (localhost)
- ✅ Production (with proper WebSocket configuration)
- ✅ Multiple devices
- ✅ Multiple browser tabs

## Troubleshooting

### Not Receiving Notifications?
1. Check browser console for connection errors
2. Verify backend is running on `http://localhost:8000`
3. Check that port 8000 is not blocked by firewall
4. Restart backend service

### WebSocket Connection Fails
- The system falls back to HTTP polling (slower but works)
- Check CORS settings in `main.py`
- Verify `allow_origins` includes your frontend URLs

### Notifications Not Auto-Dismissing
- They auto-dismiss after 5 seconds
- Close manually with the ✕ button
- Check browser console for JavaScript errors

## Architecture

```
Admin Dashboard
    ↓
   Socket.IO Client
    ↓
   HTTP/WebSocket
    ↓
FastAPI Backend (main.py)
    ↓
Socket.IO Server (websocket_manager.py)
    ↓
Real-time Events Broadcast
    ↓
All Connected Admins Receive Update Instantly
```

## Email vs WebSocket

Both work together:
- **WebSocket** - Instant UI updates for admins on the dashboard
- **Email** - Notifications even if reporter isn't on the website
- **Zero conflicts** - They're completely independent systems

## Future Enhancements

Potential additions:
- Push notifications on mobile
- Email digest for offline updates
- Sound alerts for urgent tickets
- Custom notification preferences per admin
- Redis scaling for multiple servers

---

**Status**: ✅ Fully Implemented and Ready for Use
**Tested**: ✅ Local Development
**Production Ready**: ✅ Yes (with proper WebSocket proxy configuration)
