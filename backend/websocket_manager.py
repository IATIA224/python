from socketio import AsyncServer, ASGIApp
from typing import Set, Dict
import json
import logging
from datetime import datetime
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def serialize_ticket(ticket_data: dict) -> dict:
    """
    Convert ticket data to JSON-serializable format
    Handles ObjectId, datetime, and other special types
    """
    serialized = {}
    for key, value in ticket_data.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = serialize_ticket(value)
        elif isinstance(value, list):
            serialized[key] = [serialize_ticket(item) if isinstance(item, dict) else item for item in value]
        else:
            serialized[key] = value
    return serialized

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
    logger.info(f"Admin connected: {sid} | Total admins: {len(connected_admins)}")
    print(f"[ADMIN CONNECT] Admin connected: {sid} | Total admins: {len(connected_admins)}")
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
    logger.info(f"Attempting to broadcast new ticket. Connected admins: {len(connected_admins)}")
    print(f"[BROADCAST] Attempting to broadcast new ticket. Connected admins: {len(connected_admins)}")
    
    if connected_admins:
        serialized_ticket = serialize_ticket(ticket_data)
        try:
            await sio.emit(
                'new_ticket',
                {
                    'ticket': serialized_ticket,
                    'message': f"New ticket created: {ticket_data.get('title', 'Untitled')}",
                    'timestamp': datetime.utcnow().isoformat()
                },
                to=list(connected_admins),
                namespace='/admin'
            )
            logger.info(f"Success: Broadcast new ticket to {len(connected_admins)} admins")
            print(f"[BROADCAST SUCCESS] Broadcast new ticket to {len(connected_admins)} admins")
        except Exception as e:
            logger.error(f"Error broadcasting ticket: {str(e)}", exc_info=True)
            print(f"[BROADCAST ERROR] Error broadcasting ticket: {str(e)}")
    else:
        logger.warning("No admins connected - cannot broadcast")
        print("[BROADCAST WARNING] No admins connected - cannot broadcast")


async def broadcast_ticket_update(ticket_id: str, ticket_data: dict, update_type: str = 'status_update'):
    """
    Broadcast ticket update to all connected admins and the ticket reporter
    
    Args:
        ticket_id: The ticket ID
        ticket_data: Updated ticket data
        update_type: Type of update (status_update, new_response, etc.)
    """
    serialized_ticket = serialize_ticket(ticket_data)
    
    # Broadcast to all admins
    if connected_admins:
        await sio.emit(
            'ticket_updated',
            {
                'ticket_id': ticket_id,
                'ticket': serialized_ticket,
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
                'ticket': serialized_ticket,
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
    serialized_ticket = serialize_ticket(ticket_data)
    reporter_email = ticket_data.get('reporter_email')
    
    # Notify all admins
    if connected_admins:
        await sio.emit(
            'new_response',
            {
                'ticket_id': ticket_id,
                'ticket': serialized_ticket,
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
                'ticket': serialized_ticket,
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
