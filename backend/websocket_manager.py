from socketio import AsyncServer, ASGIApp
from typing import Set, Dict
import json
from datetime import datetime

# Create a socketio instance
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Allow all origins, restrict in production
    ping_timeout=60,
    ping_interval=25
)

# Track connected admin clients
connected_admins: Set[str] = set()
connected_users: Dict[str, str] = {}  # Maps session_id to ticket_id for user tracking


@sio.on('connect', namespace='/admin')
async def admin_connect(sid, environ):
    """Handle admin dashboard connection"""
    connected_admins.add(sid)
    print(f"Admin connected: {sid}")
    await sio.emit('connection_response', {
        'status': 'connected',
        'message': 'Connected to real-time notifications'
    }, to=sid, namespace='/admin')


@sio.on('disconnect', namespace='/admin')
async def admin_disconnect(sid):
    """Handle admin dashboard disconnection"""
    connected_admins.discard(sid)
    print(f"Admin disconnected: {sid}")


@sio.on('connect', namespace='/user')
async def user_connect(sid, environ):
    """Handle user/reporter connection"""
    print(f"User connected: {sid}")
    await sio.emit('connection_response', {
        'status': 'connected',
        'message': 'Connected to ticket updates'
    }, to=sid, namespace='/user')


@sio.on('disconnect', namespace='/user')
async def user_disconnect(sid):
    """Handle user/reporter disconnection"""
    if sid in connected_users:
        del connected_users[sid]
    print(f"User disconnected: {sid}")


async def broadcast_new_ticket(ticket_data: dict):
    """
    Broadcast new ticket creation to all connected admins
    
    Args:
        ticket_data: The newly created ticket data
    """
    if connected_admins:
        await sio.emit(
            'new_ticket',
            {
                'ticket': ticket_data,
                'message': f"New ticket created: {ticket_data.get('title', 'Untitled')}",
                'timestamp': datetime.utcnow().isoformat()
            },
            to=list(connected_admins),
            namespace='/admin'
        )
        print(f"Broadcast new ticket to {len(connected_admins)} admins")


async def broadcast_ticket_update(ticket_id: str, ticket_data: dict, update_type: str = 'status_update'):
    """
    Broadcast ticket update to all connected admins and the ticket reporter
    
    Args:
        ticket_id: The ticket ID
        ticket_data: Updated ticket data
        update_type: Type of update (status_update, new_response, etc.)
    """
    # Broadcast to all admins
    if connected_admins:
        await sio.emit(
            'ticket_updated',
            {
                'ticket_id': ticket_id,
                'ticket': ticket_data,
                'update_type': update_type,
                'timestamp': datetime.utcnow().isoformat()
            },
            to=list(connected_admins),
            namespace='/admin'
        )
    
    # Broadcast to the reporter (if connected)
    reporter_email = ticket_data.get('reporter_email')
    if reporter_email:
        await sio.emit(
            'ticket_updated',
            {
                'ticket_id': ticket_id,
                'ticket': ticket_data,
                'update_type': update_type,
                'timestamp': datetime.utcnow().isoformat()
            },
            to=[sid for sid, email in connected_users.items() if email == reporter_email],
            namespace='/user'
        )


async def notify_new_response(ticket_id: str, ticket_data: dict, admin_name: str, response_text: str):
    """
    Notify about a new admin response
    
    Args:
        ticket_id: The ticket ID
        ticket_data: Updated ticket data
        admin_name: Name of the admin who responded
        response_text: The response text
    """
    reporter_email = ticket_data.get('reporter_email')
    
    # Notify all admins
    if connected_admins:
        await sio.emit(
            'new_response',
            {
                'ticket_id': ticket_id,
                'ticket': ticket_data,
                'admin_name': admin_name,
                'response_text': response_text,
                'timestamp': datetime.utcnow().isoformat()
            },
            to=list(connected_admins),
            namespace='/admin'
        )
    
    # Notify the reporter (if connected)
    if reporter_email:
        await sio.emit(
            'new_response',
            {
                'ticket_id': ticket_id,
                'ticket': ticket_data,
                'admin_name': admin_name,
                'response_text': response_text,
                'timestamp': datetime.utcnow().isoformat()
            },
            to=[sid for sid, email in connected_users.items() if email == reporter_email],
            namespace='/user'
        )


# Get the ASGI app
def get_socketio_app(app):
    """Wrap the FastAPI app with SocketIO"""
    return ASGIApp(sio, app)
