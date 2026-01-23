from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from datetime import datetime
from bson.objectid import ObjectId
from models import Ticket, TicketCreate, TicketStatus, AdministratorResponse
import os
from dotenv import load_dotenv
import uuid
from email_service import send_email_async, generate_ticket_update_email

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="PacificSupport API",
    description="A full-stack ticketing system API",
    version="1.0.0"
)

# Add CORS middleware to allow React frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],  # User, production, and admin URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pacific_support")
TICKETS_COLLECTION = "tickets"

# Global database reference
db: AsyncIOMotorDatabase = None


@app.on_event("startup")
async def startup_db():
    """Connect to MongoDB on startup"""
    global db
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")


@app.on_event("shutdown")
async def shutdown_db():
    """Close MongoDB connection on shutdown"""
    if db is not None:
        db.client.close()
        print("Disconnected from MongoDB")


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to PacificSupport API"}


@app.get("/tickets", response_model=list[Ticket])
async def get_tickets():
    """
    Retrieve all tickets from the database.
    
    Returns:
        List of all tickets sorted by creation date (newest first)
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        tickets = []
        
        # Find all tickets and sort by created_at in descending order
        cursor = tickets_collection.find().sort("created_at", -1)
        async for ticket in cursor:
            # Convert MongoDB _id ObjectId to string and rename to id
            ticket["id"] = str(ticket["_id"])
            del ticket["_id"]
            
            # Provide defaults for backward compatibility with old documents
            if "reporter_name" not in ticket:
                ticket["reporter_name"] = "Unknown"
            if "reporter_email" not in ticket:
                ticket["reporter_email"] = "unknown@example.com"
            if "reporter_department" not in ticket:
                ticket["reporter_department"] = "N/A"
            if "category" not in ticket:
                ticket["category"] = "other"
            if "priority" not in ticket:
                ticket["priority"] = "medium"
            if "location" not in ticket:
                ticket["location"] = "N/A"
            if "access_token" not in ticket:
                ticket["access_token"] = str(uuid.uuid4())
            
            tickets.append(Ticket(**ticket))
        
        return tickets
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tickets: {str(e)}"
        )


@app.post("/tickets", response_model=Ticket, status_code=status.HTTP_201_CREATED)
async def create_ticket(ticket: TicketCreate):
    """
    Create a new ticket.
    
    Args:
        ticket: Ticket data to create
        
    Returns:
        The created ticket with generated ID and access token
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Generate unique access token
        access_token = str(uuid.uuid4())
        
        # Prepare ticket document with timestamps
        ticket_doc = {
            "reporter_name": ticket.reporter_name,
            "reporter_email": ticket.reporter_email,
            "reporter_department": ticket.reporter_department,
            "title": ticket.title,
            "description": ticket.description,
            "category": ticket.category,
            "priority": ticket.priority,
            "location": ticket.location,
            "status": ticket.status,
            "image_data": ticket.image_data,
            "access_token": access_token,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert into database
        result = await tickets_collection.insert_one(ticket_doc)
        
        # Retrieve the created ticket
        created_ticket = await tickets_collection.find_one({"_id": result.inserted_id})
        created_ticket["id"] = str(created_ticket["_id"])
        del created_ticket["_id"]
        
        return Ticket(**created_ticket)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating ticket: {str(e)}"
        )


@app.get("/tickets/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str):
    """
    Retrieve a specific ticket by ID.
    
    Args:
        ticket_id: The MongoDB ObjectId of the ticket
        
    Returns:
        The requested ticket
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(ticket_id)
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ticket ID format"
            )
        
        ticket = await tickets_collection.find_one({"_id": obj_id})
        
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        ticket["id"] = str(ticket["_id"])
        del ticket["_id"]
        return Ticket(**ticket)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving ticket: {str(e)}"
        )


@app.get("/tickets/token/{access_token}", response_model=Ticket)
async def get_ticket_by_token(access_token: str):
    """
    Retrieve a specific ticket by access token (without authentication).
    
    Args:
        access_token: The unique access token for the ticket
        
    Returns:
        The requested ticket if token is valid
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        ticket = await tickets_collection.find_one({"access_token": access_token})
        
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found with this token"
            )
        
        ticket["id"] = str(ticket["_id"])
        del ticket["_id"]
        return Ticket(**ticket)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving ticket: {str(e)}"
        )


@app.patch("/tickets/{ticket_id}", response_model=Ticket)
async def update_ticket(ticket_id: str, status_update: dict):
    """
    Update a ticket's status.
    
    Args:
        ticket_id: The MongoDB ObjectId of the ticket
        status_update: Dictionary containing the new status
        
    Returns:
        The updated ticket
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(ticket_id)
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ticket ID format"
            )
        
        # Validate status value
        new_status = status_update.get("status")
        if new_status:
            try:
                TicketStatus(new_status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status value. Must be one of: {', '.join([s.value for s in TicketStatus])}"
                )
        
        # Get the ticket before updating to access reporter email
        ticket_before = await tickets_collection.find_one({"_id": obj_id})
        if not ticket_before:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Update the ticket
        update_data = {"updated_at": datetime.utcnow()}
        if new_status:
            update_data["status"] = new_status
        
        result = await tickets_collection.update_one(
            {"_id": obj_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Retrieve and return the updated ticket
        updated_ticket = await tickets_collection.find_one({"_id": obj_id})
        updated_ticket["id"] = str(updated_ticket["_id"])
        del updated_ticket["_id"]
        
        # Send email notification asynchronously
        if new_status and ticket_before.get("reporter_email"):
            try:
                email_subject = f"Ticket Update: {ticket_before.get('title', 'Your Support Ticket')}"
                email_html = generate_ticket_update_email(
                    reporter_name=ticket_before.get("reporter_name", "User"),
                    ticket_id=str(obj_id),
                    ticket_title=ticket_before.get("title", "N/A"),
                    new_status=new_status
                )
                # Send email asynchronously without blocking the response
                await send_email_async(ticket_before.get("reporter_email"), email_subject, email_html)
            except Exception as e:
                # Log the error but don't fail the request
                print(f"Warning: Failed to send email notification: {str(e)}")
        
        return Ticket(**updated_ticket)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating ticket: {str(e)}"
        )


@app.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    """
    Delete a ticket by ID.
    
    Args:
        ticket_id: The MongoDB ObjectId of the ticket to delete
        
    Returns:
        No content (204 status code)
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(ticket_id)
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ticket ID format"
            )
        
        # Delete the ticket
        result = await tickets_collection.delete_one({"_id": obj_id})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting ticket: {str(e)}"
        )


@app.post("/tickets/{ticket_id}/responses")
async def add_admin_response(ticket_id: str, response_data: dict):
    """
    Add an admin response to a ticket.
    
    Args:
        ticket_id: The MongoDB ObjectId of the ticket
        response_data: Dictionary containing admin_name and response_text
        
    Returns:
        The updated ticket with the new response
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(ticket_id)
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ticket ID format"
            )
        
        # Validate response data
        admin_name = response_data.get("admin_name", "").strip()
        response_text = response_data.get("response_text", "").strip()
        response_image_data = response_data.get("response_image_data", None)
        
        if not admin_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin name is required"
            )
        
        if not response_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Response text is required"
            )
        
        # Create new response document
        new_response = {
            "response_id": str(uuid.uuid4()),
            "admin_name": admin_name,
            "response_text": response_text,
            "response_image_data": response_image_data,
            "created_at": datetime.utcnow(),
            "is_read": False
        }
        
        # Find the ticket and check if it exists
        ticket = await tickets_collection.find_one({"_id": obj_id})
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        # Add response to ticket
        update_data = {
            "$push": {"admin_responses": new_response},
            "$set": {
                "updated_at": datetime.utcnow(),
                "last_response_date": datetime.utcnow()
            }
        }
        
        await tickets_collection.update_one(
            {"_id": obj_id},
            update_data
        )
        
        # Retrieve and return the updated ticket
        updated_ticket = await tickets_collection.find_one({"_id": obj_id})
        updated_ticket["id"] = str(updated_ticket["_id"])
        del updated_ticket["_id"]
        
        # Send email notification asynchronously to ticket reporter
        if ticket.get("reporter_email"):
            try:
                email_subject = f"New Response on Ticket: {ticket.get('title', 'Your Support Ticket')}"
                email_html = generate_ticket_update_email(
                    reporter_name=ticket.get("reporter_name", "User"),
                    ticket_id=str(obj_id),
                    ticket_title=ticket.get("title", "N/A"),
                    new_status=ticket.get("status", "open"),
                    admin_name=admin_name,
                    response_text=response_text
                )
                # Send email asynchronously without blocking the response
                await send_email_async(ticket.get("reporter_email"), email_subject, email_html)
            except Exception as e:
                # Log the error but don't fail the request
                print(f"Warning: Failed to send email notification: {str(e)}")
        
        return updated_ticket
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding response: {str(e)}"
        )


@app.post("/tickets/{ticket_id}/responses/mark-read/{response_id}")
async def mark_response_as_read(ticket_id: str, response_id: str):
    """
    Mark an admin response as read by the user.
    
    Args:
        ticket_id: The MongoDB ObjectId of the ticket
        response_id: The response ID to mark as read
        
    Returns:
        The updated ticket
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(ticket_id)
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ticket ID format"
            )
        
        # Update the response's is_read status
        result = await tickets_collection.update_one(
            {"_id": obj_id, "admin_responses.response_id": response_id},
            {"$set": {"admin_responses.$.is_read": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket or response not found"
            )
        
        # Retrieve and return the updated ticket
        updated_ticket = await tickets_collection.find_one({"_id": obj_id})
        updated_ticket["id"] = str(updated_ticket["_id"])
        del updated_ticket["_id"]
        
        return updated_ticket
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error marking response as read: {str(e)}"
        )


@app.delete("/admin/clear-history", status_code=status.HTTP_200_OK)
async def clear_admin_history():
    """
    Delete all closed and resolved tickets from the database (admin history cleanup).
    
    Returns:
        Dictionary with count of deleted tickets
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Delete all tickets with status 'closed' or 'resolved'
        result = await tickets_collection.delete_many({
            "status": {"$in": ["closed", "resolved"]}
        })
        
        return {
            "message": f"Successfully deleted {result.deleted_count} closed/resolved tickets from history",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing history: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
