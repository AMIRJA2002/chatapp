from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime
import os
import shutil
from pathlib import Path

from bson import ObjectId

from app.database import get_database
from app.models import (
    RegisterRequest, LoginRequest, User, UserResponse,
    UpdateProfileRequest, Chat, Message, MessageResponse,
    CreateGroupRequest, AddParticipantsRequest
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

    async def connect(self, websocket: WebSocket, chat_id: str):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)

    def disconnect(self, websocket: WebSocket, chat_id: str):
        if chat_id in self.active_connections:
            self.active_connections[chat_id].remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: dict, chat_id: str):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                await connection.send_json(message)

manager = ConnectionManager()

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
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse(
                id=str(user.id),
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                profile_image=user.profile_image
            ).model_dump()
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

# User endpoints
@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        profile_image=current_user.profile_image
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
    email: str,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    
    # Find user by email
    other_user = await db.users.find_one({"email": email})
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
        "created_at": datetime.now()
    }
    
    result = await db.chats.insert_one(chat_dict)
    return {"chat_id": str(result.inserted_id)}

@app.post("/api/chats/group")
async def create_group(
    group_data: CreateGroupRequest,
    current_user: User = Depends(get_current_user)
):
    db = get_database()
    
    # Find participants by email
    participant_ids = [str(current_user.id)]
    for email in group_data.participant_emails:
        user = await db.users.find_one({"email": email})
        if user:
            participant_ids.append(str(user["_id"]))
    
    chat_dict = {
        "chat_type": "group",
        "participants": participant_ids,
        "group_name": group_data.name,
        "group_image": None,
        "created_by": str(current_user.id),
        "created_at": datetime.now()
    }
    
    result = await db.chats.insert_one(chat_dict)
    return {"chat_id": str(result.inserted_id)}

@app.get("/api/chats")
async def get_user_chats(current_user: User = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user.id)
    
    chats = await db.chats.find({
        "participants": user_id
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
    for email in participants_data.emails:
        user = await db.users.find_one({"email": email})
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
    
    messages = await db.messages.find(
        {"chat_id": chat_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    message_list = []
    for msg in reversed(messages):
        try:
            sender = await db.users.find_one({"_id": ObjectId(msg["sender_id"])})
        except:
            sender = None
        sender_name = sender.get("full_name") if sender and sender.get("full_name") else (sender["username"] if sender else "Unknown")
        
        message_list.append(MessageResponse(
            id=str(msg["_id"]),
            chat_id=msg["chat_id"],
            sender_id=msg["sender_id"],
            sender_name=sender_name,
            message_type=msg["message_type"],
            content=msg["content"],
            file_url=msg.get("file_url"),
            created_at=msg["created_at"]
        ).dict())
    
    return message_list

@app.post("/api/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    content: str,
    message_type: str = "text",
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
    
    message_dict = {
        "chat_id": chat_id,
        "sender_id": str(current_user.id),
        "message_type": message_type,
        "content": content,
        "file_url": None,
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
        "created_at": message_dict["created_at"].isoformat()
    }
    
    # Broadcast via WebSocket
    await manager.broadcast(message_response, chat_id)
    
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
        "created_at": message_dict["created_at"].isoformat()
    }
    
    await manager.broadcast(message_response, chat_id)
    
    return message_response

# WebSocket endpoint
@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: str):
    await manager.connect(websocket, chat_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back or handle incoming messages
            await manager.broadcast({"type": "ping", "data": data}, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id)

# Serve uploaded files
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

