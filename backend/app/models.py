from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class User(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    id: Optional[str] = None
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: datetime = datetime.now()

class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    profile_image: Optional[str] = None

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None

class Chat(BaseModel):
    id: Optional[str] = None
    chat_type: str  # "single" or "group"
    participants: List[str]  # List of user IDs
    group_name: Optional[str] = None
    group_image: Optional[str] = None
    created_by: str  # User ID
    created_at: datetime = datetime.now()

class Message(BaseModel):
    id: Optional[str] = None
    chat_id: str
    sender_id: str
    message_type: str  # "text", "file", "image"
    content: str
    file_url: Optional[str] = None
    created_at: datetime = datetime.now()

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender_id: str
    sender_name: str
    message_type: str
    content: str
    file_url: Optional[str] = None
    created_at: datetime

class CreateGroupRequest(BaseModel):
    name: str
    participant_emails: List[EmailStr] = []

class AddParticipantsRequest(BaseModel):
    emails: List[EmailStr] = []

class SearchUserRequest(BaseModel):
    query: str  # email or username

