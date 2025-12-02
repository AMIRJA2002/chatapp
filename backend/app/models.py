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
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime = datetime.now()

class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None

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
    admins: List[str] = []  # List of admin user IDs (for groups)
    is_archived: bool = False
    created_at: datetime = datetime.now()

class Message(BaseModel):
    id: Optional[str] = None
    chat_id: str
    sender_id: str
    message_type: str  # "text", "file", "image"
    content: str
    file_url: Optional[str] = None
    reply_to: Optional[str] = None  # Message ID that this message replies to
    edited_at: Optional[datetime] = None
    is_deleted: bool = False
    status: str = "sent"  # "sent", "delivered", "read"
    reactions: dict = {}  # {user_id: emoji}
    created_at: datetime = datetime.now()

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender_id: str
    sender_name: str
    message_type: str
    content: str
    file_url: Optional[str] = None
    reply_to: Optional[str] = None
    reply_to_message: Optional[dict] = None  # Full message object if replying
    edited_at: Optional[datetime] = None
    is_deleted: bool = False
    status: str = "sent"
    reactions: dict = {}
    created_at: datetime

class CreateGroupRequest(BaseModel):
    name: str
    participant_emails: List[EmailStr] = []

class AddParticipantsRequest(BaseModel):
    emails: List[EmailStr] = []

class SearchUserRequest(BaseModel):
    query: str  # email or username

class ReplyMessageRequest(BaseModel):
    content: str
    reply_to: str  # Message ID

class EditMessageRequest(BaseModel):
    content: str

class ReactToMessageRequest(BaseModel):
    emoji: str  # emoji like "👍", "❤️", etc.

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    group_image: Optional[str] = None

class RemoveParticipantRequest(BaseModel):
    user_id: str

class SearchMessagesRequest(BaseModel):
    query: str
    chat_id: Optional[str] = None

class ForwardMessageRequest(BaseModel):
    chat_ids: List[str]  # List of chat IDs to forward to

class TypingIndicatorRequest(BaseModel):
    is_typing: bool

