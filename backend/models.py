from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid


class TicketStatus(str, Enum):
    """Enum for ticket status values"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IssuePriority(str, Enum):
    """Enum for issue priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class IssueCategory(str, Enum):
    """Enum for issue categories"""
    FURNITURE = "furniture"
    IT_EQUIPMENT = "it_equipment"
    FACILITY = "facility"
    UTILITIES = "utilities"
    SAFETY = "safety"
    OTHER = "other"


class TicketBase(BaseModel):
    """Base Ticket model with common fields"""
    reporter_name: str = Field(..., min_length=1, max_length=100)
    reporter_email: str
    reporter_department: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    category: IssueCategory
    priority: IssuePriority = IssuePriority.MEDIUM
    location: str = Field(..., min_length=1, max_length=200)
    status: TicketStatus = TicketStatus.OPEN


class TicketCreate(TicketBase):
    """Model for creating a new ticket"""
    pass


class Ticket(TicketBase):
    """Full Ticket model with metadata"""
    id: str
    access_token: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
