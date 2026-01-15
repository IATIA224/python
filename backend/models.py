from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class TicketStatus(str, Enum):
    """Enum for ticket status values"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class TicketBase(BaseModel):
    """Base Ticket model with common fields"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    status: TicketStatus = TicketStatus.OPEN


class TicketCreate(TicketBase):
    """Model for creating a new ticket"""
    pass


class Ticket(TicketBase):
    """Full Ticket model with metadata"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
