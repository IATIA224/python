from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from datetime import datetime
from bson.objectid import ObjectId
from models import Ticket, TicketCreate, TicketStatus
import os
from dotenv import load_dotenv

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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite dev server and production URLs
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
    if db:
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
            tickets.append(Ticket(**ticket))
        
        return tickets
    except Exception as e:
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
        The created ticket with generated ID and timestamps
    """
    try:
        tickets_collection = db[TICKETS_COLLECTION]
        
        # Prepare ticket document with timestamps
        ticket_doc = {
            "title": ticket.title,
            "description": ticket.description,
            "status": ticket.status,
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
