# Chat App - اپلیکیشن چت

یک اپلیکیشن چت Real-time با FastAPI و MongoDB

## ویژگی‌ها

- ✅ ثبت نام و ورود با ایمیل و رمز عبور
- ✅ چت خصوصی با کاربران
- ✅ چت گروهی
- ✅ ارسال پیام متنی
- ✅ ارسال فایل و تصویر
- ✅ ویرایش پروفایل (نام کاربری، ایمیل، رمز عبور، نام کامل، تصویر پروفایل)
- ✅ جستجوی کاربر با ایمیل یا نام کاربری
- ✅ Real-time messaging با WebSocket

## ساختار پروژه

```
chatapp/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py      # API endpoints
│   │   ├── models.py    # Pydantic models
│   │   ├── auth.py      # Authentication utilities
│   │   ├── database.py  # MongoDB connection
│   │   └── login_strategy.py  # Login factory pattern
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   └── services/
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## نصب و راه‌اندازی

### با Docker (پیشنهادی)

```bash
docker-compose up --build
```

سپس:
- Backend: http://localhost:8009
- Frontend: http://localhost:3000
- API Docs: http://localhost:8009/docs

### بدون Docker

#### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# ویرایش .env و تنظیم MONGODB_URL
python run.py
```

#### Frontend

**⚠️ اگر مشکل npm install دارید (به خصوص در ایران)، به `frontend/README_INSTALL.md` یا `frontend/NPM_IRAN_GUIDE.md` مراجعه کنید.**

```bash
cd frontend

# روش 1: استفاده از اسکریپت ایرانی (پیشنهادی برای ایران 🇮🇷)
chmod +x install-iran.sh
./install-iran.sh

# یا روش 2: استفاده از اسکریپت عمومی
chmod +x install.sh
./install.sh

# یا روش 3: نصب دستی با registry ایرانی
npm config set registry https://npm.iranrepo.ir/
npm config set strict-ssl false
npm install
npm start
```

## API Documentation

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "username": "user123",
    "email": "user@example.com",
    "full_name": null,
    "profile_image": null
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** مشابه Register

### User Endpoints

#### Get Current User
```http
GET /api/users/me
Authorization: Bearer {token}
```

#### Update Profile
```http
PUT /api/users/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com",
  "full_name": "نام کامل",
  "password": "newpassword"
}
```

#### Upload Profile Image
```http
POST /api/users/me/profile-image
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [image file, max 10MB]
```

#### Search Users
```http
GET /api/users/search?query=searchterm
Authorization: Bearer {token}
```

### Chat Endpoints

#### Create Single Chat
```http
POST /api/chats/single?email=user@example.com
Authorization: Bearer {token}
```

**Response:**
```json
{
  "chat_id": "..."
}
```

#### Create Group
```http
POST /api/chats/group
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "گروه دوستان",
  "participant_emails": ["user1@example.com", "user2@example.com"]
}
```

#### Get User Chats
```http
GET /api/chats
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "...",
    "chat_type": "single",
    "group_name": null,
    "participants": [
      {
        "id": "...",
        "username": "user123",
        "email": "user@example.com",
        "full_name": "نام کامل",
        "profile_image": "/uploads/images/..."
      }
    ],
    "created_at": "2024-01-01T00:00:00"
  }
]
```

#### Add Participants to Group
```http
POST /api/chats/{chat_id}/participants
Authorization: Bearer {token}
Content-Type: application/json

{
  "emails": ["user@example.com"]
}
```

### Message Endpoints

#### Get Messages
```http
GET /api/chats/{chat_id}/messages?limit=50&skip=0
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "...",
    "chat_id": "...",
    "sender_id": "...",
    "sender_name": "نام کامل یا username",
    "message_type": "text",
    "content": "متن پیام",
    "file_url": null,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

#### Send Text Message
```http
POST /api/chats/{chat_id}/messages?content=متن پیام&message_type=text
Authorization: Bearer {token}
```

#### Send File/Image
```http
POST /api/chats/{chat_id}/messages/file
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [file or image, max 10MB]
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8009/ws/{chat_id}');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle new message
};
```

## نکات مهم

1. **Authentication**: تمام endpointهای به جز register و login نیاز به Bearer token دارند
2. **File Size Limit**: حداکثر حجم فایل 10 مگابایت
3. **Profile Image**: فقط تصویر قابل آپلود است
4. **Sender Name**: در پیام‌ها، اگر full_name وجود داشته باشد نمایش داده می‌شود، در غیر این صورت username
5. **Login Factory Pattern**: برای افزودن روش‌های ورود جدید (مثل OTP) از factory pattern استفاده شده است

## توسعه

### افزودن روش ورود جدید (مثل OTP)

در `backend/app/login_strategy.py`:

```python
class OTPLoginStrategy(LoginStrategy):
    async def authenticate(self, login_data: OTPLoginRequest) -> User:
        # Implement OTP logic
        pass

# Register in factory
login_factory.register_strategy("otp", OTPLoginStrategy())
```

## License

MIT

