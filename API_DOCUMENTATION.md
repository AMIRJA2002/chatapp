# مستندات کامل API - Chat App

این مستندات برای توسعه‌دهندگان Frontend تهیه شده است.

## Base URL

```
http://localhost:8009
```

## Authentication

تمام endpointهای به جز `/api/auth/register` و `/api/auth/login` نیاز به Bearer Token دارند.

### نحوه استفاده از Token

```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN_HERE'
}
```

---

## 1. Authentication Endpoints

### 1.1 ثبت نام (Register)

**Endpoint:** `POST /api/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123",
  "full_name": "نام کامل" // optional
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "user123",
    "email": "user@example.com",
    "full_name": "نام کامل",
    "profile_image": null,
    "is_online": false,
    "last_seen": null
  }
}
```

**Error Responses:**
- `400`: Email یا Username قبلاً ثبت شده است
```json
{
  "detail": "Email already registered"
}
```

---

### 1.2 ورود (Login)

**Endpoint:** `POST /api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "user123",
    "email": "user@example.com",
    "full_name": "نام کامل",
    "profile_image": "/uploads/images/...",
    "is_online": true,
    "last_seen": "2024-01-01T12:00:00"
  }
}
```

**Error Responses:**
- `401`: ایمیل یا رمز عبور اشتباه
```json
{
  "detail": "Invalid email or password"
}
```

---

## 2. User Endpoints

### 2.1 دریافت اطلاعات کاربر فعلی

**Endpoint:** `GET /api/users/me`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "username": "user123",
  "email": "user@example.com",
  "full_name": "نام کامل",
  "profile_image": "/uploads/images/profile.jpg",
  "is_online": true,
  "last_seen": "2024-01-01T12:00:00"
}
```

**Error Responses:**
- `401`: Token نامعتبر یا منقضی شده

---

### 2.2 به‌روزرسانی پروفایل

**Endpoint:** `PUT /api/users/me`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Request Body:** (همه فیلدها اختیاری هستند)
```json
{
  "username": "newusername",
  "email": "newemail@example.com",
  "password": "newpassword",
  "full_name": "نام کامل جدید"
}
```

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "username": "newusername",
  "email": "newemail@example.com",
  "full_name": "نام کامل جدید",
  "profile_image": "/uploads/images/profile.jpg",
  "is_online": true,
  "last_seen": "2024-01-01T12:00:00"
}
```

**Error Responses:**
- `400`: Username یا Email قبلاً استفاده شده
- `401`: Token نامعتبر

---

### 2.3 آپلود تصویر پروفایل

**Endpoint:** `POST /api/users/me/profile-image`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data
```

**Request Body:**
```
file: [image file]
```

**محدودیت‌ها:**
- فقط فایل‌های تصویری (image/*)
- حداکثر حجم: 10 مگابایت

**Response (200 OK):**
```json
{
  "profile_image": "/uploads/images/507f1f77bcf86cd799439011.jpg"
}
```

**Error Responses:**
- `400`: فایل تصویر نیست یا حجم آن بیشتر از 10MB است
- `401`: Token نامعتبر

---

### 2.4 جستجوی کاربر

**Endpoint:** `GET /api/users/search`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Query Parameters:**
- `query` (required): ایمیل یا نام کاربری برای جستجو

**Example:**
```
GET /api/users/search?query=user
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "username": "user123",
    "email": "user@example.com",
    "full_name": "نام کامل",
    "profile_image": "/uploads/images/...",
    "is_online": true,
    "last_seen": "2024-01-01T12:00:00"
  }
]
```

**نکته:** حداکثر 20 نتیجه برگردانده می‌شود.

---

### 2.5 دریافت وضعیت کاربر (Online/Offline)

**Endpoint:** `GET /api/users/{user_id}/status`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `user_id`: شناسه کاربر

**Response (200 OK):**
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "is_online": true,
  "last_seen": "2024-01-01T12:00:00"
}
```

**Error Responses:**
- `404`: کاربر یافت نشد

---

### 2.6 به‌روزرسانی Last Seen

**Endpoint:** `POST /api/users/me/last-seen`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
{
  "status": "updated"
}
```

---

## 3. Chat Endpoints

### 3.1 ایجاد چت خصوصی

**Endpoint:** `POST /api/chats/single`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Query Parameters:**
- `identifier` (required): ایمیل یا نام کاربری کاربری که می‌خواهید با او چت کنید

**Example:**
```
POST /api/chats/single?identifier=user@example.com
POST /api/chats/single?identifier=username123
```

**Response (200 OK):**
```json
{
  "chat_id": "507f1f77bcf86cd799439020"
}
```

**Error Responses:**
- `400`: نمی‌توانید با خودتان چت ایجاد کنید
- `404`: کاربر با این ایمیل یا نام کاربری یافت نشد

**نکته:** اگر چت از قبل وجود داشته باشد، همان chat_id برگردانده می‌شود.

---

### 3.2 ایجاد گروه

**Endpoint:** `POST /api/chats/group`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data
```

**Form Data:**
- `name` (required): نام گروه
- `participant_emails` (optional): لیست ایمیل‌ها یا نام‌های کاربری (جدا شده با کاما)
- `group_image` (optional): تصویر گروه

**Example:**
```javascript
const formData = new FormData();
formData.append('name', 'گروه دوستان');
formData.append('participant_emails', 'user1@example.com,user2@example.com,username3');
formData.append('group_image', imageFile); // optional
```

**Response (200 OK):**
```json
{
  "chat_id": "507f1f77bcf86cd799439020"
}
```

**نکته:** 
- کاربر فعلی به صورت خودکار به گروه اضافه می‌شود
- می‌توانید با ایمیل یا نام کاربری اعضا را اضافه کنید

---

### 3.3 دریافت لیست چت‌ها

**Endpoint:** `GET /api/chats`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439020",
    "chat_type": "single",
    "group_name": null,
    "group_image": null,
    "participants": [
      {
        "id": "507f1f77bcf86cd799439011",
        "username": "user123",
        "email": "user@example.com",
        "full_name": "نام کامل",
        "profile_image": "/uploads/images/...",
        "is_online": true,
        "last_seen": "2024-01-01T12:00:00"
      }
    ],
    "last_message": {
      "id": "507f1f77bcf86cd799439030",
      "content": "آخرین پیام",
      "message_type": "text",
      "sender_id": "507f1f77bcf86cd799439011",
      "sender_name": "نام کامل",
      "created_at": "2024-01-01T12:00:00"
    },
    "unread_count": 5,
    "created_at": "2024-01-01T12:00:00"
  },
  {
    "id": "507f1f77bcf86cd799439021",
    "chat_type": "group",
    "group_name": "گروه دوستان",
    "group_image": "/uploads/images/group_123.jpg",
    "participants": [
      {
        "id": "507f1f77bcf86cd799439011",
        "username": "user123",
        "email": "user@example.com",
        "full_name": "نام کامل",
        "profile_image": "/uploads/images/...",
        "is_online": true,
        "last_seen": "2024-01-01T12:00:00"
      }
    ],
    "last_message": {
      "id": "507f1f77bcf86cd799439031",
      "content": "آخرین پیام گروه",
      "message_type": "text",
      "sender_id": "507f1f77bcf86cd799439012",
      "sender_name": "user456",
      "created_at": "2024-01-01T12:05:00"
    },
    "unread_count": 0,
    "created_at": "2024-01-01T12:00:00"
  }
]
```

**نکته:** 
- فقط چت‌هایی که کاربر در آن‌ها عضو است برگردانده می‌شوند
- چت‌های آرشیو شده نمایش داده نمی‌شوند
- چت‌ها بر اساس زمان آخرین پیام مرتب می‌شوند (جدیدترین اول)

---

### 3.4 افزودن عضو به گروه

**Endpoint:** `POST /api/chats/{chat_id}/participants`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Path Parameters:**
- `chat_id`: شناسه چت (گروه)

**Request Body:**
```json
{
  "emails": [
    "user3@example.com",
    "username4"
  ]
}
```

**نکته:** می‌توانید با ایمیل یا نام کاربری اعضا را اضافه کنید.

**Response (200 OK):**
```json
{
  "added": 2
}
```

**Error Responses:**
- `403`: شما عضو این چت نیستید
- `404`: چت یافت نشد

---

### 3.5 حذف عضو از گروه

**Endpoint:** `DELETE /api/chats/{chat_id}/participants/{user_id}`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت (گروه)
- `user_id`: شناسه کاربری که باید حذف شود

**Response (200 OK):**
```json
{
  "status": "removed"
}
```

**Error Responses:**
- `403`: شما ادمین نیستید یا عضو این چت نیستید
- `404`: چت یا کاربر یافت نشد

---

### 3.6 به‌روزرسانی اطلاعات گروه

**Endpoint:** `PUT /api/chats/{chat_id}/group`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data
```

**Path Parameters:**
- `chat_id`: شناسه چت (گروه)

**Form Data:**
- `name` (optional): نام جدید گروه
- `group_image` (optional): تصویر جدید گروه

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439020",
  "group_name": "نام جدید گروه",
  "group_image": "/uploads/images/group_new.jpg"
}
```

**Error Responses:**
- `400`: این چت گروه نیست
- `403`: فقط ادمین‌ها می‌توانند اطلاعات گروه را به‌روزرسانی کنند
- `404`: چت یافت نشد

---

### 3.7 افزودن ادمین به گروه

**Endpoint:** `POST /api/chats/{chat_id}/admins/{user_id}`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت (گروه)
- `user_id`: شناسه کاربری که باید ادمین شود

**Response (200 OK):**
```json
{
  "status": "added"
}
```

**Error Responses:**
- `403`: شما ادمین نیستید
- `404`: چت یا کاربر یافت نشد

---

### 3.8 آرشیو کردن چت

**Endpoint:** `POST /api/chats/{chat_id}/archive`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت

**Response (200 OK):**
```json
{
  "status": "archived"
}
```

---

### 3.9 دریافت چت‌های آرشیو شده

**Endpoint:** `GET /api/chats/archived`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439020",
    "chat_type": "single",
    "group_name": null,
    "participants": [...],
    "last_message": {...},
    "created_at": "2024-01-01T12:00:00"
  }
]
```

---

## 4. Message Endpoints

### 4.1 دریافت پیام‌ها (با Pagination)

**Endpoint:** `GET /api/chats/{chat_id}/messages`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت

**Query Parameters:**
- `limit` (optional, default: 50): تعداد پیام‌ها
- `skip` (optional, default: 0): تعداد پیام‌های رد شده (برای pagination)

**Example:**
```
GET /api/chats/507f1f77bcf86cd799439020/messages?limit=50&skip=0
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "507f1f77bcf86cd799439030",
      "chat_id": "507f1f77bcf86cd799439020",
      "sender_id": "507f1f77bcf86cd799439011",
      "sender_name": "نام کامل",
      "message_type": "text",
      "content": "سلام، چطوری؟",
      "file_url": null,
      "reply_to": null,
      "reply_to_message": null,
      "edited_at": null,
      "is_deleted": false,
      "status": "read",
      "reactions": {
        "👍": ["user1_id", "user2_id"],
        "❤️": ["user3_id"]
      },
      "created_at": "2024-01-01T12:00:00"
    },
    {
      "id": "507f1f77bcf86cd799439031",
      "chat_id": "507f1f77bcf86cd799439020",
      "sender_id": "507f1f77bcf86cd799439012",
      "sender_name": "user456",
      "message_type": "image",
      "content": "image.jpg",
      "file_url": "/uploads/images/507f1f77bcf86cd799439020_1234567890.jpg",
      "reply_to": "507f1f77bcf86cd799439030",
      "reply_to_message": {
        "id": "507f1f77bcf86cd799439030",
        "sender_id": "507f1f77bcf86cd799439011",
        "sender_name": "نام کامل",
        "content": "سلام، چطوری؟",
        "message_type": "text"
      },
      "edited_at": null,
      "is_deleted": false,
      "status": "delivered",
      "reactions": {},
      "created_at": "2024-01-01T12:05:00"
    }
  ],
  "total": 150,
  "has_more": true,
  "skip": 0,
  "limit": 50
}
```

**نکته:** 
- پیام‌ها به ترتیب زمانی (قدیمی‌ترین به جدیدترین) برگردانده می‌شوند
- `sender_name`: اگر `full_name` وجود داشته باشد نمایش داده می‌شود، در غیر این صورت `username`
- `status`: می‌تواند "sent", "delivered", یا "read" باشد
- `reactions`: یک object که emoji را به لیست user_idها map می‌کند

**Error Responses:**
- `403`: شما عضو این چت نیستید
- `404`: چت یافت نشد

---

### 4.2 ارسال پیام متنی

**Endpoint:** `POST /api/chats/{chat_id}/messages`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت

**Query Parameters:**
- `content` (required): متن پیام
- `message_type` (optional, default: "text"): نوع پیام
- `reply_to` (optional): شناسه پیامی که به آن پاسخ می‌دهید

**Example:**
```
POST /api/chats/507f1f77bcf86cd799439020/messages?content=سلام&message_type=text&reply_to=507f1f77bcf86cd799439030
```

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439030",
  "chat_id": "507f1f77bcf86cd799439020",
  "sender_id": "507f1f77bcf86cd799439011",
  "sender_name": "نام کامل",
  "message_type": "text",
  "content": "سلام",
  "file_url": null,
  "reply_to": "507f1f77bcf86cd799439030",
  "reply_to_message": {
    "id": "507f1f77bcf86cd799439030",
    "sender_id": "507f1f77bcf86cd799439011",
    "sender_name": "نام کامل",
    "content": "پیام قبلی",
    "message_type": "text"
  },
  "edited_at": null,
  "is_deleted": false,
  "status": "sent",
  "reactions": {},
  "created_at": "2024-01-01T12:00:00"
}
```

**نکته:** پیام به صورت Real-time از طریق WebSocket به سایر اعضای چت ارسال می‌شود.

---

### 4.3 ارسال فایل یا تصویر

**Endpoint:** `POST /api/chats/{chat_id}/messages/file`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data
```

**Path Parameters:**
- `chat_id`: شناسه چت

**Request Body:**
```
file: [file or image]
```

**محدودیت‌ها:**
- حداکثر حجم: 10 مگابایت
- برای تصاویر: `message_type` به صورت خودکار `"image"` تنظیم می‌شود
- برای سایر فایل‌ها: `message_type` به صورت خودکار `"file"` تنظیم می‌شود

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439030",
  "chat_id": "507f1f77bcf86cd799439020",
  "sender_id": "507f1f77bcf86cd799439011",
  "sender_name": "نام کامل",
  "message_type": "image",
  "content": "photo.jpg",
  "file_url": "/uploads/images/507f1f77bcf86cd799439020_1234567890.jpg",
  "reply_to": null,
  "reply_to_message": null,
  "edited_at": null,
  "is_deleted": false,
  "status": "sent",
  "reactions": {},
  "created_at": "2024-01-01T12:00:00"
}
```

**Error Responses:**
- `400`: حجم فایل بیشتر از 10MB است
- `403`: شما عضو این چت نیستید
- `404`: چت یافت نشد

---

### 4.4 ویرایش پیام

**Endpoint:** `PUT /api/chats/{chat_id}/messages/{message_id}`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Path Parameters:**
- `chat_id`: شناسه چت
- `message_id`: شناسه پیام

**Request Body:**
```json
{
  "content": "متن جدید پیام"
}
```

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439030",
  "chat_id": "507f1f77bcf86cd799439020",
  "sender_id": "507f1f77bcf86cd799439011",
  "sender_name": "نام کامل",
  "message_type": "text",
  "content": "متن جدید پیام",
  "file_url": null,
  "reply_to": "507f1f77bcf86cd799439029",
  "reply_to_message": {...},
  "edited_at": "2024-01-01T12:10:00",
  "is_deleted": false,
  "status": "read",
  "reactions": {},
  "created_at": "2024-01-01T12:00:00"
}
```

**Error Responses:**
- `403`: شما فرستنده این پیام نیستید یا عضو این چت نیستید
- `404`: پیام یافت نشد

---

### 4.5 حذف پیام

**Endpoint:** `DELETE /api/chats/{chat_id}/messages/{message_id}`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت
- `message_id`: شناسه پیام

**Response (200 OK):**
```json
{
  "status": "deleted"
}
```

**Error Responses:**
- `403`: شما فرستنده این پیام نیستید یا عضو این چت نیستید
- `404`: پیام یافت نشد

---

### 4.6 علامت‌گذاری پیام به عنوان خوانده شده

**Endpoint:** `POST /api/chats/{chat_id}/messages/{message_id}/read`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت
- `message_id`: شناسه پیام

**Response (200 OK):**
```json
{
  "status": "read"
}
```

---

### 4.7 علامت‌گذاری همه پیام‌های چت به عنوان خوانده شده

**Endpoint:** `POST /api/chats/{chat_id}/messages/read-all`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت

**Response (200 OK):**
```json
{
  "status": "success",
  "updated_count": 15
}
```

---

### 4.8 واکنش به پیام (React)

**Endpoint:** `POST /api/chats/{chat_id}/messages/{message_id}/react`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Path Parameters:**
- `chat_id`: شناسه چت
- `message_id`: شناسه پیام

**Request Body:**
```json
{
  "emoji": "👍"
}
```

**Response (200 OK):**
```json
{
  "status": "reacted",
  "reactions": {
    "👍": ["user1_id", "user2_id"],
    "❤️": ["user3_id"]
  }
}
```

**نکته:** اگر کاربر قبلاً به این پیام با همین emoji واکنش داده باشد، واکنش حذف می‌شود.

---

### 4.9 فوروارد پیام

**Endpoint:** `POST /api/chats/{chat_id}/messages/{message_id}/forward`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Path Parameters:**
- `chat_id`: شناسه چت فعلی
- `message_id`: شناسه پیامی که می‌خواهید فوروارد کنید

**Request Body:**
```json
{
  "target_chat_ids": [
    "507f1f77bcf86cd799439021",
    "507f1f77bcf86cd799439022"
  ]
}
```

**Response (200 OK):**
```json
{
  "status": "forwarded",
  "forwarded_to": 2
}
```

---

### 4.10 جستجوی پیام‌ها

**Endpoint:** `GET /api/chats/{chat_id}/messages/search`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Path Parameters:**
- `chat_id`: شناسه چت

**Query Parameters:**
- `query` (required): متن برای جستجو

**Example:**
```
GET /api/chats/507f1f77bcf86cd799439020/messages/search?query=سلام
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439030",
    "chat_id": "507f1f77bcf86cd799439020",
    "sender_id": "507f1f77bcf86cd799439011",
    "sender_name": "نام کامل",
    "message_type": "text",
    "content": "سلام، چطوری؟",
    "file_url": null,
    "created_at": "2024-01-01T12:00:00"
  }
]
```

---

## 5. WebSocket

### 5.1 اتصال WebSocket برای چت

**Endpoint:** `ws://localhost:8009/ws/{chat_id}`

**Path Parameters:**
- `chat_id`: شناسه چت

**Query Parameters:**
- `token` (optional): JWT Token برای احراز هویت

**نحوه اتصال:**
```javascript
const token = localStorage.getItem('token');
const ws = new WebSocket(`ws://localhost:8009/ws/507f1f77bcf86cd799439020?token=${token}`);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // Handle different message types
  if (data.type === 'new_message') {
    // New message received
    console.log('New message:', data.message);
  } else if (data.type === 'message_edited') {
    // Message was edited
    console.log('Message edited:', data.message);
  } else if (data.type === 'message_deleted') {
    // Message was deleted
    console.log('Message deleted:', data.message_id);
  } else if (data.type === 'message_reaction') {
    // Reaction added/removed
    console.log('Reaction:', data);
  } else if (data.type === 'message_status') {
    // Message status updated (delivered/read)
    console.log('Status:', data);
  } else if (data.type === 'typing') {
    // User is typing
    console.log('Typing:', data.user_id, data.is_typing);
  } else if (data.id) {
    // Direct message object
    console.log('Message:', data);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};
```

**ارسال پیام تایپینگ:**
```javascript
ws.send(JSON.stringify({
  type: 'typing',
  is_typing: true
}));
```

**ارسال علامت خوانده شده:**
```javascript
ws.send(JSON.stringify({
  type: 'read',
  message_id: '507f1f77bcf86cd799439030'
}));
```

---

### 5.2 اتصال WebSocket برای به‌روزرسانی‌های Global

**Endpoint:** `ws://localhost:8009/ws/global`

**Query Parameters:**
- `token` (required): JWT Token

**نحوه اتصال:**
```javascript
const token = localStorage.getItem('token');
const ws = new WebSocket(`ws://localhost:8009/ws/global?token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'new_message') {
    // Update chat list when new message arrives
    console.log('New message in chat:', data.chat_id);
  } else if (data.type === 'message_edited') {
    // Message was edited in a chat
    console.log('Message edited in chat:', data.chat_id);
  } else if (data.type === 'message_deleted') {
    // Message was deleted in a chat
    console.log('Message deleted in chat:', data.chat_id);
  }
};
```

**نکته:** این WebSocket برای به‌روزرسانی لیست چت‌ها استفاده می‌شود و نیازی به ارسال پیام ندارد.

---

## 6. مثال‌های کد JavaScript/React

### 6.1 ثبت نام و ورود

```javascript
// Register
const register = async (username, email, password, fullName) => {
  const response = await fetch('http://localhost:8009/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password, full_name: fullName }),
  });
  
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data;
};

// Login
const login = async (email, password) => {
  const response = await fetch('http://localhost:8009/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data;
};
```

### 6.2 ارسال Request با Token

```javascript
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:8009/api/users/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const user = await response.json();
```

### 6.3 ایجاد چت با ایمیل یا نام کاربری

```javascript
const createChat = async (identifier) => {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `http://localhost:8009/api/chats/single?identifier=${encodeURIComponent(identifier)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  return await response.json();
};
```

### 6.4 ایجاد گروه با تصویر

```javascript
const createGroup = async (name, participantEmails, groupImage) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('name', name);
  formData.append('participant_emails', participantEmails.join(','));
  if (groupImage) {
    formData.append('group_image', groupImage);
  }
  
  const response = await fetch('http://localhost:8009/api/chats/group', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return await response.json();
};
```

### 6.5 ارسال پیام با Reply

```javascript
const sendMessage = async (chatId, content, replyTo = null) => {
  const token = localStorage.getItem('token');
  let url = `http://localhost:8009/api/chats/${chatId}/messages?content=${encodeURIComponent(content)}`;
  if (replyTo) {
    url += `&reply_to=${replyTo}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
};
```

### 6.6 دریافت پیام‌ها با Pagination

```javascript
const getMessages = async (chatId, skip = 0, limit = 50) => {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `http://localhost:8009/api/chats/${chatId}/messages?skip=${skip}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  const data = await response.json();
  return data; // { messages: [], total: 150, has_more: true, skip: 0, limit: 50 }
};
```

### 6.7 ویرایش پیام

```javascript
const editMessage = async (chatId, messageId, newContent) => {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `http://localhost:8009/api/chats/${chatId}/messages/${messageId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: newContent }),
    }
  );
  
  return await response.json();
};
```

### 6.8 واکنش به پیام

```javascript
const reactToMessage = async (chatId, messageId, emoji) => {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `http://localhost:8009/api/chats/${chatId}/messages/${messageId}/react`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji }),
    }
  );
  
  return await response.json();
};
```

### 6.9 استفاده از WebSocket

```javascript
const connectWebSocket = (chatId, onMessage, onTyping, onStatusUpdate) => {
  const token = localStorage.getItem('token');
  const ws = new WebSocket(`ws://localhost:8009/ws/${chatId}?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'new_message' && data.message) {
      onMessage(data.message);
    } else if (data.type === 'typing') {
      onTyping(data.user_id, data.is_typing);
    } else if (data.type === 'message_status') {
      onStatusUpdate(data.message_id, data.status);
    } else if (data.id) {
      // Direct message
      onMessage(data);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Reconnect after 3 seconds
    setTimeout(() => connectWebSocket(chatId, onMessage, onTyping, onStatusUpdate), 3000);
  };
  
  return ws;
};

// Send typing indicator
const sendTyping = (ws, isTyping) => {
  ws.send(JSON.stringify({
    type: 'typing',
    is_typing: isTyping
  }));
};
```

### 6.10 اتصال به WebSocket Global

```javascript
const connectGlobalWebSocket = (onChatUpdate) => {
  const token = localStorage.getItem('token');
  const ws = new WebSocket(`ws://localhost:8009/ws/global?token=${token}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'new_message' || data.type === 'message_edited' || data.type === 'message_deleted') {
      onChatUpdate(data);
    }
  };
  
  return ws;
};
```

---

## 7. کدهای خطا

| کد | معنی |
|---|---|
| 200 | موفق |
| 400 | درخواست نامعتبر |
| 401 | احراز هویت نامعتبر |
| 403 | دسترسی غیرمجاز |
| 404 | یافت نشد |
| 500 | خطای سرور |

---

## 8. نکات مهم

1. **Token Expiration**: Tokenها به صورت پیش‌فرض 1440 دقیقه (24 ساعت) معتبر هستند.

2. **File URLs**: URL فایل‌های آپلود شده به صورت نسبی هستند و باید با Base URL ترکیب شوند:
   ```javascript
   const fullUrl = `http://localhost:8009${fileUrl}`;
   ```

3. **Sender Name**: در پیام‌ها، اگر `full_name` وجود داشته باشد نمایش داده می‌شود، در غیر این صورت `username` نمایش داده می‌شود.

4. **Real-time Updates**: برای دریافت پیام‌های جدید به صورت Real-time، باید از WebSocket استفاده کنید.

5. **Pagination**: برای دریافت پیام‌های بیشتر از query parameters `limit` و `skip` استفاده کنید.

6. **Username یا Email**: در ایجاد چت و افزودن اعضا به گروه، می‌توانید از ایمیل یا نام کاربری استفاده کنید.

7. **Message Status**: وضعیت پیام‌ها می‌تواند "sent", "delivered", یا "read" باشد. پیام‌های ارسالی شما به صورت خودکار "sent" هستند و برای سایر کاربران "delivered" می‌شوند.

8. **Reactions**: واکنش‌ها به صورت object ذخیره می‌شوند که emoji را به لیست user_idها map می‌کند:
   ```json
   {
     "👍": ["user1_id", "user2_id"],
     "❤️": ["user3_id"]
   }
   ```

9. **Read Status**: هر پیام یک فیلد `read_by` دارد که لیست user_idهای کاربرانی که پیام را خوانده‌اند را نگه می‌دارد.

10. **Timezone**: تمام زمان‌ها در UTC ذخیره می‌شوند. برای نمایش باید به timezone تهران (Asia/Tehran) تبدیل شوند.

---

## 9. Swagger Documentation

برای مشاهده مستندات تعاملی API، به آدرس زیر بروید:

```
http://localhost:8009/docs
```

یا برای مستندات ReDoc:

```
http://localhost:8009/redoc
```

---

## 10. تغییرات اخیر

### نسخه 1.0.0

- ✅ پشتیبانی از Username در ایجاد چت و افزودن اعضا
- ✅ Pagination برای پیام‌ها
- ✅ Reply to Message
- ✅ Edit/Delete Messages
- ✅ Message Reactions
- ✅ Message Status (sent/delivered/read)
- ✅ Typing Indicators
- ✅ Online/Offline Status
- ✅ Group Management (edit name/image, add/remove members, admins)
- ✅ Message Search
- ✅ Archive Chats
- ✅ Forward Messages
- ✅ Global WebSocket برای به‌روزرسانی لیست چت‌ها
- ✅ Read Status per User (read_by field)
- ✅ Last Seen Status
