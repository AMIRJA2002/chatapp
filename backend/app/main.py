from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime
import os
import shutil
import asyncio
import json
from pathlib import Path

from bson import ObjectId

from app.database import get_database
from app.models import (
    RegisterRequest, LoginRequest, User, UserResponse,
    UpdateProfileRequest, Chat, Message, MessageResponse,
    CreateGroupRequest, AddParticipantsRequest,
    ReplyMessageRequest, EditMessageRequest, ReactToMessageRequest,
    UpdateGroupRequest, RemoveParticipantRequest,
    SearchMessagesRequest, ForwardMessageRequest, TypingIndicatorRequest
)
from app.auth import get_password_hash, create_access_token, decode_access_token
from app.login_strategy import login_factory

app = FastAPI(
    title="Chat App API",
    description="Real-time chat application API with FastAPI and MongoDB",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:80",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

security = HTTPBearer()
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "images").mkdir(exist_ok=True)
(UPLOAD_DIR / "files").mkdir(exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["id"] = str(user["_id"])
    return User(**user)

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}
        self.user_connections: dict[str, WebSocket] = {}  # user_id -> websocket
        self.global_connections: dict[str, WebSocket] = {}  # user_id -> websocket for global updates
        self.typing_users: dict[str, dict[str, datetime]] = {}  # chat_id -> {user_id: timestamp}
        self.online_users: set[str] = set()

    async def connect(self, websocket: WebSocket, chat_id: str, user_id: str = None):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
            self.online_users.add(user_id)
            # Notify others in chat that user is online
            await self.broadcast_online_status(chat_id, user_id, True)

    def disconnect(self, websocket: WebSocket, chat_id: str, user_id: str = None):
        if chat_id in self.active_connections:
            self.active_connections[chat_id].remove(websocket)
        
        if user_id:
            if user_id in self.user_connections:
                del self.user_connections[user_id]
            if user_id in self.online_users:
                self.online_users.remove(user_id)
            # Notify others in chat that user is offline
            asyncio.create_task(self.broadcast_online_status(chat_id, user_id, False))

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: dict, chat_id: str):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass
        
        # Also broadcast to global connections for chat list updates
        await self.broadcast_to_global({
            "type": "new_message",
            "chat_id": chat_id,
            "message": message
        }, chat_id)

    async def broadcast_to_global(self, message: dict, chat_id: str):
        """Broadcast message to all users who have this chat in their list"""
        db = get_database()
        try:
            chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
            if chat:
                # Send to all participants who have global connection
                for participant_id in chat.get("participants", []):
                    if participant_id in self.global_connections:
                        try:
                            await self.global_connections[participant_id].send_json(message)
                        except:
                            pass
        except:
            pass

    async def broadcast_typing(self, chat_id: str, user_id: str, is_typing: bool):
        typing_data = {
            "type": "typing",
            "chat_id": chat_id,
            "user_id": user_id,
            "is_typing": is_typing
        }
        await self.broadcast(typing_data, chat_id)

    async def broadcast_online_status(self, chat_id: str, user_id: str, is_online: bool):
        status_data = {
            "type": "user_status",
            "chat_id": chat_id,
            "user_id": user_id,
            "is_online": is_online
        }
        await self.broadcast(status_data, chat_id)

    async def broadcast_message_status(self, chat_id: str, message_id: str, status: str, user_id: str):
        status_data = {
            "type": "message_status",
            "chat_id": chat_id,
            "message_id": message_id,
            "status": status,
            "user_id": user_id
        }
        await self.broadcast(status_data, chat_id)

manager = ConnectionManager()

# Helper function to update message status
async def update_message_status(message_id: str, user_id: str, status: str):
    db = get_database()
    try:
        message = await db.messages.find_one({"_id": ObjectId(message_id)})
        if message:
            # Update read_by list for read status
            if status == "read":
                await db.messages.update_one(
                    {"_id": ObjectId(message_id)},
                    {"$addToSet": {"read_by": user_id}}  # Add user_id to read_by list if not exists
                )
            # Broadcast the status update
            await manager.broadcast_message_status(
                message["chat_id"],
                message_id,
                status,
                user_id
            )
    except:
        pass

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Backend is running"}

# Auth endpoints
@app.post("/api/auth/register", response_model=dict)
async def register(user_data: RegisterRequest):
    db = get_database()
    
    # Check if email exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    hashed_password = get_password_hash(user_data.password)
    user_dict = {
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "full_name": None,
        "profile_image": None,
        "is_online": False,
        "last_seen": None,
        "created_at": datetime.now()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            id=str(result.inserted_id),
            username=user_dict["username"],
            email=user_dict["email"],
            full_name=user_dict["full_name"],
            profile_image=user_dict["profile_image"]
        ).model_dump()
    }

@app.post("/api/auth/login", response_model=dict)
async def login(login_data: LoginRequest):
    strategy = login_factory.get_strategy("email_password")
    try:
        user = await strategy.authenticate(login_data)
        access_token = create_access_token(data={"sub": str(user.id)})
        
        # Update online status on login
        db = get_database()
        await db.users.update_one(
            {"_id": ObjectId(str(user.id))},
            {"$set": {"is_online": True, "last_seen": datetime.now()}}
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse(
                id=str(user.id),
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                profile_image=user.profile_image,
                is_online=True,
                last_seen=datetime.now()
            ).model_dump()
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

# User endpoints
@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    db = get_database()
    user_doc = await db.users.find_one({"_id": ObjectId(str(current_user.id))})
    
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        profile_image=current_user.profile_image,
        is_online=user_doc.get("is_online", False) if user_doc else False,
        last_seen=user_doc.get("last_seen") if user_doc else None
    )

@app.put("/api/users/me", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    update_dict = {}
    
    user_id = ObjectId(str(current_user.id))
    
    if profile_data.username:
        existing = await db.users.find_one({"username": profile_data.username, "_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_dict["username"] = profile_data.username
    
    if profile_data.email:
        existing = await db.users.find_one({"email": profile_data.email, "_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        update_dict["email"] = profile_data.email
    
    if profile_data.password:
        update_dict["password"] = get_password_hash(profile_data.password)
    
    if profile_data.full_name is not None:
        update_dict["full_name"] = profile_data.full_name
    
    if update_dict:
        await db.users.update_one({"_id": user_id}, {"$set": update_dict})
    
    updated_user = await db.users.find_one({"_id": user_id})
    return UserResponse(
        id=str(updated_user["_id"]),
        username=updated_user["username"],
        email=updated_user["email"],
        full_name=updated_user.get("full_name"),
        profile_image=updated_user.get("profile_image")
    )

@app.post("/api/users/me/profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    file_ext = Path(file.filename).suffix
    filename = f"{current_user.id}{file_ext}"
    file_path = UPLOAD_DIR / "images" / filename
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    file_url = f"/uploads/images/{filename}"
    
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(str(current_user.id))},
        {"$set": {"profile_image": file_url}}
    )
    
    return {"profile_image": file_url}

@app.get("/api/users/search")
async def search_users(query: str, current_user: User = Depends(get_current_user)):
    db = get_database()
    users = await db.users.find({
        "$or": [
            {"email": {"$regex": query, "$options": "i"}},
            {"username": {"$regex": query, "$options": "i"}}
        ],
        "_id": {"$ne": ObjectId(str(current_user.id))}
    }).limit(20).to_list(length=20)
    
    return [
        UserResponse(
            id=str(u["_id"]),
            username=u["username"],
            email=u["email"],
            full_name=u.get("full_name"),
            profile_image=u.get("profile_image")
        ).dict()
        for u in users
    ]

# Chat endpoints
@app.post("/api/chats/single")
async def create_single_chat(
    identifier: str,  # Can be email or username
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    
    # Find user by email or username
    other_user = await db.users.find_one({
        "$or": [
            {"email": identifier},
            {"username": identifier}
        ]
    })
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    other_user_id = str(other_user["_id"])
    current_user_id = str(current_user.id)
    
    if other_user_id == current_user_id:
        raise HTTPException(status_code=400, detail="Cannot create chat with yourself")
    
    # Check if chat already exists
    existing_chat = await db.chats.find_one({
        "chat_type": "single",
        "participants": {"$all": [current_user_id, other_user_id], "$size": 2}
    })
    
    if existing_chat:
        return {"chat_id": str(existing_chat["_id"])}
    
    # Create new chat
    chat_dict = {
        "chat_type": "single",
        "participants": [current_user_id, other_user_id],
        "created_by": current_user_id,
        "admins": [],
        "is_archived": False,
        "created_at": datetime.now()
    }
    
    result = await db.chats.insert_one(chat_dict)
    return {"chat_id": str(result.inserted_id)}

@app.post("/api/chats/group")
async def create_group(
    name: str = Form(...),
    participant_emails: str = Form(""),  # Comma-separated emails
    group_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    
    # Parse participant identifiers (can be email or username)
    identifiers_list = [e.strip() for e in participant_emails.split(",") if e.strip()]
    
    # Find participants by email or username
    participant_ids = [str(current_user.id)]
    for identifier in identifiers_list:
        user = await db.users.find_one({
            "$or": [
                {"email": identifier},
                {"username": identifier}
            ]
        })
        if user:
            participant_ids.append(str(user["_id"]))
    
    # Handle group image upload
    group_image_url = None
    if group_image and group_image.content_type and group_image.content_type.startswith("image/"):
        file_content = await group_image.read()
        if len(file_content) <= MAX_FILE_SIZE:
            file_ext = Path(group_image.filename).suffix
            filename = f"group_{ObjectId()}{file_ext}"
            file_path = UPLOAD_DIR / "images" / filename
            
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            group_image_url = f"/uploads/images/{filename}"
    
    chat_dict = {
        "chat_type": "group",
        "participants": participant_ids,
        "group_name": name,
        "group_image": group_image_url,
        "created_by": str(current_user.id),
        "admins": [str(current_user.id)],  # Creator is admin
        "is_archived": False,
        "created_at": datetime.now()
    }
    
    result = await db.chats.insert_one(chat_dict)
    return {"chat_id": str(result.inserted_id)}

@app.get("/api/chats")
async def get_user_chats(current_user: User = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user.id)
    
    chats = await db.chats.find({
        "participants": user_id,
        "is_archived": {"$ne": True}  # Exclude archived chats
    }).to_list(length=100)
    
    chat_list = []
    for chat in chats:
        # Get other participants info
        participants_info = []
        for pid in chat["participants"]:
            if pid != user_id:
                try:
                    user = await db.users.find_one({"_id": ObjectId(pid)})
                except:
                    user = None
                if user:
                    participants_info.append({
                        "id": pid,
                        "username": user["username"],
                        "email": user["email"],
                        "full_name": user.get("full_name"),
                        "profile_image": user.get("profile_image"),
                        "is_online": user.get("is_online", False),
                        "last_seen": user.get("last_seen")
                    })
        
        # Get last message
        last_message = None
        last_msg = await db.messages.find_one(
            {"chat_id": str(chat["_id"])},
            sort=[("created_at", -1)]
        )
        if last_msg:
            sender = await db.users.find_one({"_id": ObjectId(last_msg["sender_id"])})
            sender_name = sender.get("full_name") if sender and sender.get("full_name") else (sender["username"] if sender else "Unknown")
            last_message = {
                "id": str(last_msg["_id"]),
                "content": last_msg.get("content", ""),
                "message_type": last_msg.get("message_type", "text"),
                "sender_id": last_msg["sender_id"],
                "sender_name": sender_name,
                "created_at": last_msg["created_at"]
            }
        
        # Count unread messages (messages not sent by user and not read by user)
        # Use $nin to check if user_id is not in read_by array
        unread_count = await db.messages.count_documents({
            "chat_id": str(chat["_id"]),
            "sender_id": {"$ne": user_id},
            "$or": [
                {"read_by": {"$exists": False}},  # Old messages without read_by field
                {"read_by": {"$nin": [user_id]}}  # User is not in read_by array
            ]
        })
        
        chat_list.append({
            "id": str(chat["_id"]),
            "chat_type": chat["chat_type"],
            "group_name": chat.get("group_name"),
            "group_image": chat.get("group_image"),
            "participants": participants_info,
            "last_message": last_message,
            "unread_count": unread_count,
            "created_at": chat["created_at"]
        })
    
    # Sort by last message time (most recent first)
    chat_list.sort(key=lambda x: (
        x["last_message"]["created_at"] if x.get("last_message") and x["last_message"].get("created_at") 
        else x.get("created_at", datetime.min)
    ), reverse=True)
    
    return chat_list

@app.post("/api/chats/{chat_id}/participants")
async def add_participants(
    chat_id: str,
    participants_data: AddParticipantsRequest,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if str(current_user.id) not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    new_participants = []
    for identifier in participants_data.emails:  # Can be email or username
        user = await db.users.find_one({
            "$or": [
                {"email": identifier},
                {"username": identifier}
            ]
        })
        if user and str(user["_id"]) not in chat["participants"]:
            new_participants.append(str(user["_id"]))
    
    if new_participants:
        await db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$push": {"participants": {"$each": new_participants}}}
        )
    
    return {"added": len(new_participants)}

# Message endpoints
@app.get("/api/chats/{chat_id}/messages")
async def get_messages(
    chat_id: str,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if str(current_user.id) not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # Get total count for pagination
    total_count = await db.messages.count_documents({"chat_id": chat_id})
    
    # Fetch messages (newest first, then reverse for display)
    messages = await db.messages.find(
        {"chat_id": chat_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Check if there are more messages
    has_more = (skip + limit) < total_count
    
    message_list = []
    for msg in reversed(messages):
        if msg.get("is_deleted", False):
            # Return deleted message with minimal info
            message_list.append(MessageResponse(
                id=str(msg["_id"]),
                chat_id=msg["chat_id"],
                sender_id=msg["sender_id"],
                sender_name="",
                message_type=msg["message_type"],
                content="This message was deleted",
                file_url=None,
                reply_to=msg.get("reply_to"),
                reply_to_message=None,
                edited_at=msg.get("edited_at"),
                is_deleted=True,
                status=msg.get("status", "sent"),
                reactions=msg.get("reactions", {}),
                created_at=msg["created_at"]
            ).dict())
            continue
            
        try:
            sender = await db.users.find_one({"_id": ObjectId(msg["sender_id"])})
        except:
            sender = None
        sender_name = sender.get("full_name") if sender and sender.get("full_name") else (sender["username"] if sender else "Unknown")
        
        # Get reply_to message if exists
        reply_to_message = None
        if msg.get("reply_to"):
            try:
                reply_msg = await db.messages.find_one({"_id": ObjectId(msg["reply_to"])})
                if reply_msg:
                    reply_sender = await db.users.find_one({"_id": ObjectId(reply_msg["sender_id"])})
                    reply_to_message = {
                        "id": str(reply_msg["_id"]),
                        "sender_id": reply_msg["sender_id"],
                        "sender_name": reply_sender.get("full_name") if reply_sender and reply_sender.get("full_name") else (reply_sender["username"] if reply_sender else "Unknown"),
                        "content": reply_msg["content"] if not reply_msg.get("is_deleted") else "This message was deleted",
                        "message_type": reply_msg["message_type"]
                    }
            except:
                pass
        
        message_list.append(MessageResponse(
            id=str(msg["_id"]),
            chat_id=msg["chat_id"],
            sender_id=msg["sender_id"],
            sender_name=sender_name,
            message_type=msg["message_type"],
            content=msg["content"],
            file_url=msg.get("file_url"),
            reply_to=msg.get("reply_to"),
            reply_to_message=reply_to_message,
            edited_at=msg.get("edited_at"),
            is_deleted=False,
            status=msg.get("status", "sent"),
            reactions=msg.get("reactions", {}),
            created_at=msg["created_at"]
        ).dict())
    
    return {
        "messages": message_list,
        "total": total_count,
        "has_more": has_more,
        "skip": skip,
        "limit": limit
    }

@app.post("/api/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    content: str,
    message_type: str = "text",
    reply_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if str(current_user.id) not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # Get reply_to message if exists
    reply_to_message = None
    if reply_to:
        try:
            reply_msg = await db.messages.find_one({"_id": ObjectId(reply_to)})
            if reply_msg and reply_msg["chat_id"] == chat_id:
                sender = await db.users.find_one({"_id": ObjectId(reply_msg["sender_id"])})
                reply_to_message = {
                    "id": str(reply_msg["_id"]),
                    "sender_id": reply_msg["sender_id"],
                    "sender_name": sender.get("full_name") if sender and sender.get("full_name") else (sender["username"] if sender else "Unknown"),
                    "content": reply_msg["content"],
                    "message_type": reply_msg["message_type"]
                }
        except:
            reply_to = None
    
    message_dict = {
        "chat_id": chat_id,
        "sender_id": str(current_user.id),
        "message_type": message_type,
        "content": content,
        "file_url": None,
        "reply_to": reply_to,
        "edited_at": None,
        "is_deleted": False,
        "status": "sent",
        "reactions": {},
        "read_by": [],  # List of user IDs who have read this message
        "created_at": datetime.now()
    }
    
    result = await db.messages.insert_one(message_dict)
    message_dict["_id"] = result.inserted_id
    
    # Get sender name
    sender_name = current_user.full_name if current_user.full_name else current_user.username
    
    message_response = {
        "id": str(result.inserted_id),
        "chat_id": chat_id,
        "sender_id": str(current_user.id),
        "sender_name": sender_name,
        "message_type": message_type,
        "content": content,
        "file_url": None,
        "reply_to": reply_to,
        "reply_to_message": reply_to_message,
        "edited_at": None,
        "is_deleted": False,
        "status": "sent",
        "reactions": {},
        "created_at": message_dict["created_at"].isoformat()
    }
    
    # Broadcast via WebSocket
    await manager.broadcast(message_response, chat_id)
    
    # Update message status to delivered for other participants
    for participant_id in chat["participants"]:
        if participant_id != str(current_user.id):
            asyncio.create_task(update_message_status(str(result.inserted_id), participant_id, "delivered"))
    
    return message_response

@app.post("/api/chats/{chat_id}/messages/file")
async def send_file(
    chat_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if str(current_user.id) not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    is_image = file.content_type and file.content_type.startswith("image/")
    message_type = "image" if is_image else "file"
    
    file_ext = Path(file.filename).suffix
    filename = f"{chat_id}_{datetime.now().timestamp()}{file_ext}"
    subdir = "images" if is_image else "files"
    file_path = UPLOAD_DIR / subdir / filename
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    file_url = f"/uploads/{subdir}/{filename}"
    
    message_dict = {
        "chat_id": chat_id,
        "sender_id": str(current_user.id),
        "message_type": message_type,
        "content": file.filename,
        "file_url": file_url,
        "reply_to": None,
        "edited_at": None,
        "is_deleted": False,
        "status": "sent",
        "reactions": {},
        "read_by": [],  # List of user IDs who have read this message
        "created_at": datetime.now()
    }
    
    result = await db.messages.insert_one(message_dict)
    
    sender_name = current_user.full_name if current_user.full_name else current_user.username
    
    message_response = {
        "id": str(result.inserted_id),
        "chat_id": chat_id,
        "sender_id": str(current_user.id),
        "sender_name": sender_name,
        "message_type": message_type,
        "content": file.filename,
        "file_url": file_url,
        "reply_to": None,
        "reply_to_message": None,
        "edited_at": None,
        "is_deleted": False,
        "status": "sent",
        "reactions": {},
        "created_at": message_dict["created_at"].isoformat()
    }
    
    await manager.broadcast(message_response, chat_id)
    
    # Update message status to delivered for other participants
    for participant_id in chat["participants"]:
        if participant_id != str(current_user.id):
            asyncio.create_task(update_message_status(str(result.inserted_id), participant_id, "delivered"))
    
    return message_response

# Global WebSocket endpoint for chat list updates
@app.websocket("/ws/global")
async def global_websocket_endpoint(websocket: WebSocket, token: str = None):
    """WebSocket endpoint for receiving global updates (chat list, notifications, etc.)"""
    user_id = None
    if token:
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
    
    if not user_id:
        await websocket.close(code=1008, reason="Authentication required")
        return
    
    await websocket.accept()
    manager.global_connections[user_id] = websocket
    
    try:
        while True:
            # Keep connection alive with ping/pong
            await websocket.receive_text()
    except WebSocketDisconnect:
        if user_id in manager.global_connections:
            del manager.global_connections[user_id]

# WebSocket endpoint
@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: str, token: str = None):
    # Try to get user from token if provided
    user_id = None
    if token:
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
    
    await manager.connect(websocket, chat_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                msg_type = message_data.get("type")
                
                if msg_type == "typing" and user_id:
                    is_typing = message_data.get("is_typing", False)
                    await manager.broadcast_typing(chat_id, user_id, is_typing)
                elif msg_type == "read" and user_id:
                    message_id = message_data.get("message_id")
                    if message_id:
                        await update_message_status(message_id, user_id, "read")
            except:
                # Echo back or handle incoming messages
                await manager.broadcast({"type": "ping", "data": data}, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user_id)

# ========== NEW FEATURES ENDPOINTS ==========

# Message Status - Mark as read
@app.post("/api/chats/{chat_id}/messages/{message_id}/read")
async def mark_message_read(
    chat_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
        if not chat or str(current_user.id) not in chat["participants"]:
            raise HTTPException(status_code=403, detail="Not a participant")
        
        await update_message_status(message_id, str(current_user.id), "read")
        return {"status": "read"}
    except:
        raise HTTPException(status_code=404, detail="Message not found")

# Mark all messages in a chat as read
@app.post("/api/chats/{chat_id}/messages/read-all")
async def mark_all_messages_read(
    chat_id: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
        if not chat or str(current_user.id) not in chat["participants"]:
            raise HTTPException(status_code=403, detail="Not a participant")
        
        user_id = str(current_user.id)
        # Update all messages in this chat that are not sent by the user
        # Add user_id to read_by array for all unread messages
        result = await db.messages.update_many(
            {
                "chat_id": chat_id,
                "sender_id": {"$ne": user_id},
                "$or": [
                    {"read_by": {"$exists": False}},
                    {"read_by": {"$nin": [user_id]}}
                ]
            },
            {
                "$addToSet": {"read_by": user_id}
            }
        )
        
        return {"status": "success", "updated_count": result.modified_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Edit Message
@app.put("/api/chats/{chat_id}/messages/{message_id}")
async def edit_message(
    chat_id: str,
    message_id: str,
    edit_data: EditMessageRequest,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        message = await db.messages.find_one({"_id": ObjectId(message_id)})
    except:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["chat_id"] != chat_id:
        raise HTTPException(status_code=400, detail="Message does not belong to this chat")
    
    if message["sender_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    
    if message.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Cannot edit deleted message")
    
    await db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {
            "content": edit_data.content,
            "edited_at": datetime.now()
        }}
    )
    
    updated_message = await db.messages.find_one({"_id": ObjectId(message_id)})
    sender = await db.users.find_one({"_id": ObjectId(updated_message["sender_id"])})
    sender_name = sender.get("full_name") if sender and sender.get("full_name") else (sender["username"] if sender else "Unknown")
    
    message_response = {
        "id": str(updated_message["_id"]),
        "chat_id": updated_message["chat_id"],
        "sender_id": updated_message["sender_id"],
        "sender_name": sender_name,
        "message_type": updated_message["message_type"],
        "content": updated_message["content"],
        "file_url": updated_message.get("file_url"),
        "reply_to": updated_message.get("reply_to"),
        "edited_at": updated_message.get("edited_at").isoformat() if updated_message.get("edited_at") else None,
        "is_deleted": False,
        "status": updated_message.get("status", "sent"),
        "reactions": updated_message.get("reactions", {}),
        "created_at": updated_message["created_at"].isoformat()
    }
    
    await manager.broadcast({"type": "message_edited", "message": message_response}, chat_id)
    return message_response

# Delete Message
@app.delete("/api/chats/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        message = await db.messages.find_one({"_id": ObjectId(message_id)})
    except:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["chat_id"] != chat_id:
        raise HTTPException(status_code=400, detail="Message does not belong to this chat")
    
    if message["sender_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    await db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"is_deleted": True, "content": "This message was deleted"}}
    )
    
    await manager.broadcast({
        "type": "message_deleted",
        "message_id": message_id,
        "chat_id": chat_id
    }, chat_id)
    
    return {"deleted": True}

# React to Message
@app.post("/api/chats/{chat_id}/messages/{message_id}/react")
async def react_to_message(
    chat_id: str,
    message_id: str,
    reaction_data: ReactToMessageRequest,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        message = await db.messages.find_one({"_id": ObjectId(message_id)})
    except:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not message or message["chat_id"] != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = message.get("reactions", {})
    user_id = str(current_user.id)
    emoji = reaction_data.emoji
    
    # Reactions structure: {emoji: [user_ids]}
    if emoji not in reactions:
        reactions[emoji] = []
    
    # Toggle reaction - if user already reacted with this emoji, remove it
    if user_id in reactions[emoji]:
        reactions[emoji] = [uid for uid in reactions[emoji] if uid != user_id]
        # Remove emoji key if no users left
        if len(reactions[emoji]) == 0:
            del reactions[emoji]
    else:
        reactions[emoji].append(user_id)
    
    await db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"reactions": reactions}}
    )
    
    await manager.broadcast({
        "type": "message_reaction",
        "message_id": message_id,
        "chat_id": chat_id,
        "reactions": reactions
    }, chat_id)
    
    return {"reactions": reactions}

# Forward Message
@app.post("/api/chats/{chat_id}/messages/{message_id}/forward")
async def forward_message(
    chat_id: str,
    message_id: str,
    forward_data: ForwardMessageRequest,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        original_message = await db.messages.find_one({"_id": ObjectId(message_id)})
    except:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not original_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    forwarded_messages = []
    sender_name = current_user.full_name if current_user.full_name else current_user.username
    
    for target_chat_id in forward_data.chat_ids:
        try:
            target_chat = await db.chats.find_one({"_id": ObjectId(target_chat_id)})
            if not target_chat or str(current_user.id) not in target_chat["participants"]:
                continue
            
            forwarded_message = {
                "chat_id": target_chat_id,
                "sender_id": str(current_user.id),
                "message_type": original_message["message_type"],
                "content": f"Forwarded: {original_message['content']}",
                "file_url": original_message.get("file_url"),
                "reply_to": None,
                "edited_at": None,
                "is_deleted": False,
                "status": "sent",
                "reactions": {},
                "created_at": datetime.now()
            }
            
            result = await db.messages.insert_one(forwarded_message)
            forwarded_message["_id"] = result.inserted_id
            
            message_response = {
                "id": str(result.inserted_id),
                "chat_id": target_chat_id,
                "sender_id": str(current_user.id),
                "sender_name": sender_name,
                "message_type": forwarded_message["message_type"],
                "content": forwarded_message["content"],
                "file_url": forwarded_message.get("file_url"),
                "reply_to": None,
                "edited_at": None,
                "is_deleted": False,
                "status": "sent",
                "reactions": {},
                "created_at": forwarded_message["created_at"].isoformat()
            }
            
            await manager.broadcast(message_response, target_chat_id)
            forwarded_messages.append(message_response)
        except:
            continue
    
    return {"forwarded_to": len(forwarded_messages), "messages": forwarded_messages}

# Search Messages
@app.get("/api/chats/{chat_id}/messages/search")
async def search_messages(
    chat_id: str,
    query: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat or str(current_user.id) not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    messages = await db.messages.find({
        "chat_id": chat_id,
        "content": {"$regex": query, "$options": "i"},
        "is_deleted": False
    }).sort("created_at", -1).limit(50).to_list(length=50)
    
    message_list = []
    for msg in messages:
        try:
            sender = await db.users.find_one({"_id": ObjectId(msg["sender_id"])})
        except:
            sender = None
        sender_name = sender.get("full_name") if sender and sender.get("full_name") else (sender["username"] if sender else "Unknown")
        
        message_list.append({
            "id": str(msg["_id"]),
            "chat_id": msg["chat_id"],
            "sender_id": msg["sender_id"],
            "sender_name": sender_name,
            "message_type": msg["message_type"],
            "content": msg["content"],
            "file_url": msg.get("file_url"),
            "created_at": msg["created_at"].isoformat()
        })
    
    return message_list

# Archive/Unarchive Chat
@app.post("/api/chats/{chat_id}/archive")
async def archive_chat(
    chat_id: str,
    archive: bool = True,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat or str(current_user.id) not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    await db.chats.update_one(
        {"_id": ObjectId(chat_id)},
        {"$set": {"is_archived": archive}}
    )
    
    return {"archived": archive}

# Unarchive all chats (temporary endpoint to fix database)
@app.post("/api/chats/unarchive-all")
async def unarchive_all_chats(current_user: User = Depends(get_current_user)):
    """Unarchive all chats for the current user"""
    db = get_database()
    result = await db.chats.update_many(
        {
            "participants": str(current_user.id),
            "is_archived": True
        },
        {
            "$set": {"is_archived": False}
        }
    )
    return {
        "message": f"Unarchived {result.modified_count} chats",
        "modified_count": result.modified_count
    }

# Unarchive ALL chats in database (admin endpoint - no auth required for quick fix)
@app.post("/api/admin/unarchive-all-chats")
async def unarchive_all_chats_admin():
    """Unarchive ALL chats in the database (temporary admin endpoint)"""
    db = get_database()
    result = await db.chats.update_many(
        {"is_archived": True},
        {"$set": {"is_archived": False}}
    )
    return {
        "message": f"Unarchived {result.modified_count} chats",
        "modified_count": result.modified_count
    }

# Update Group Info
@app.put("/api/chats/{chat_id}/group")
async def update_group(
    chat_id: str,
    name: Optional[str] = Form(None),
    group_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat["chat_type"] != "group":
        raise HTTPException(status_code=400, detail="This is not a group chat")
    
    # Check if user is admin
    admins = chat.get("admins", [])
    if str(current_user.id) not in admins and str(chat.get("created_by")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only admins can update group info")
    
    update_dict = {}
    if name:
        update_dict["group_name"] = name
    
    # Handle group image upload
    if group_image and group_image.content_type and group_image.content_type.startswith("image/"):
        file_content = await group_image.read()
        if len(file_content) <= MAX_FILE_SIZE:
            file_ext = Path(group_image.filename).suffix
            filename = f"group_{ObjectId()}{file_ext}"
            file_path = UPLOAD_DIR / "images" / filename
            
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            update_dict["group_image"] = f"/uploads/images/{filename}"
    
    if update_dict:
        await db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": update_dict}
        )
    
    updated_chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    return {
        "id": str(updated_chat["_id"]),
        "group_name": updated_chat.get("group_name"),
        "group_image": updated_chat.get("group_image")
    }

# Remove Participant from Group
@app.delete("/api/chats/{chat_id}/participants/{user_id}")
async def remove_participant(
    chat_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat["chat_type"] != "group":
        raise HTTPException(status_code=400, detail="This is not a group chat")
    
    # Check if user is admin
    admins = chat.get("admins", [])
    if str(current_user.id) not in admins and str(chat.get("created_by")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only admins can remove participants")
    
    if user_id not in chat["participants"]:
        raise HTTPException(status_code=400, detail="User is not a participant")
    
    if user_id == str(chat.get("created_by")):
        raise HTTPException(status_code=400, detail="Cannot remove group creator")
    
    await db.chats.update_one(
        {"_id": ObjectId(chat_id)},
        {"$pull": {"participants": user_id, "admins": user_id}}
    )
    
    await manager.broadcast({
        "type": "participant_removed",
        "chat_id": chat_id,
        "user_id": user_id
    }, chat_id)
    
    return {"removed": True}

# Add Admin to Group
@app.post("/api/chats/{chat_id}/admins/{user_id}")
async def add_admin(
    chat_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not chat or chat["chat_type"] != "group":
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check if current user is admin
    admins = chat.get("admins", [])
    if str(current_user.id) not in admins and str(chat.get("created_by")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only admins can add admins")
    
    if user_id not in chat["participants"]:
        raise HTTPException(status_code=400, detail="User is not a participant")
    
    if user_id not in admins:
        await db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$addToSet": {"admins": user_id}}
        )
    
    return {"added": True}

# Get Online Status
@app.get("/api/users/{user_id}/status")
async def get_user_status(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_online = user_id in manager.online_users
    
    return {
        "user_id": user_id,
        "is_online": is_online,
        "last_seen": user.get("last_seen").isoformat() if user.get("last_seen") else None
    }

# Update Last Seen
@app.post("/api/users/me/last-seen")
async def update_last_seen(current_user: User = Depends(get_current_user)):
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(str(current_user.id))},
        {"$set": {"last_seen": datetime.now()}}
    )
    return {"last_seen": datetime.now().isoformat()}

# Get Archived Chats
@app.get("/api/chats/archived")
async def get_archived_chats(current_user: User = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user.id)
    
    chats = await db.chats.find({
        "participants": user_id,
        "is_archived": True
    }).to_list(length=100)
    
    chat_list = []
    for chat in chats:
        participants_info = []
        for pid in chat["participants"]:
            if pid != user_id:
                try:
                    user = await db.users.find_one({"_id": ObjectId(pid)})
                except:
                    user = None
                if user:
                    participants_info.append({
                        "id": pid,
                        "username": user["username"],
                        "email": user["email"],
                        "full_name": user.get("full_name"),
                        "profile_image": user.get("profile_image")
                    })
        
        chat_list.append({
            "id": str(chat["_id"]),
            "chat_type": chat["chat_type"],
            "group_name": chat.get("group_name"),
            "group_image": chat.get("group_image"),
            "participants": participants_info,
            "created_at": chat["created_at"]
        })
    
    return chat_list

# Serve uploaded files
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

