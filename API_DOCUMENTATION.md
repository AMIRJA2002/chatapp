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
    "full_name": null,
    "profile_image": null
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
    "profile_image": "/uploads/images/..."
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
  "profile_image": "/uploads/images/profile.jpg"
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
  "profile_image": "/uploads/images/profile.jpg"
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
    "profile_image": "/uploads/images/..."
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "username": "user456",
    "email": "user2@example.com",
    "full_name": null,
    "profile_image": null
  }
]
```

**نکته:** حداکثر 20 نتیجه برگردانده می‌شود.

---

## 3. Chat Endpoints

### 3.1 ایجاد چت خصوصی

**Endpoint:** `POST /api/chats/single`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Query Parameters:**
- `email` (required): ایمیل کاربری که می‌خواهید با او چت کنید

**Example:**
```
POST /api/chats/single?email=user@example.com
```

**Response (200 OK):**
```json
{
  "chat_id": "507f1f77bcf86cd799439020"
}
```

**Error Responses:**
- `400`: نمی‌توانید با خودتان چت ایجاد کنید
- `404`: کاربر با این ایمیل یافت نشد

**نکته:** اگر چت از قبل وجود داشته باشد، همان chat_id برگردانده می‌شود.

---

### 3.2 ایجاد گروه

**Endpoint:** `POST /api/chats/group`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "گروه دوستان",
  "participant_emails": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

**Response (200 OK):**
```json
{
  "chat_id": "507f1f77bcf86cd799439020"
}
```

**نکته:** کاربر فعلی به صورت خودکار به گروه اضافه می‌شود.

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
        "profile_image": "/uploads/images/..."
      }
    ],
    "created_at": "2024-01-01T12:00:00"
  },
  {
    "id": "507f1f77bcf86cd799439021",
    "chat_type": "group",
    "group_name": "گروه دوستان",
    "group_image": null,
    "participants": [
      {
        "id": "507f1f77bcf86cd799439011",
        "username": "user123",
        "email": "user@example.com",
        "full_name": "نام کامل",
        "profile_image": "/uploads/images/..."
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "username": "user456",
        "email": "user2@example.com",
        "full_name": null,
        "profile_image": null
      }
    ],
    "created_at": "2024-01-01T12:00:00"
  }
]
```

**نکته:** فقط چت‌هایی که کاربر در آن‌ها عضو است برگردانده می‌شوند.

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
    "user4@example.com"
  ]
}
```

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

## 4. Message Endpoints

### 4.1 دریافت پیام‌ها

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
  },
  {
    "id": "507f1f77bcf86cd799439031",
    "chat_id": "507f1f77bcf86cd799439020",
    "sender_id": "507f1f77bcf86cd799439012",
    "sender_name": "user456",
    "message_type": "image",
    "content": "image.jpg",
    "file_url": "/uploads/images/507f1f77bcf86cd799439020_1234567890.jpg",
    "created_at": "2024-01-01T12:05:00"
  }
]
```

**نکته:** 
- پیام‌ها به ترتیب زمانی (قدیمی‌ترین به جدیدترین) برگردانده می‌شوند
- `sender_name`: اگر `full_name` وجود داشته باشد نمایش داده می‌شود، در غیر این صورت `username`

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

**Example:**
```
POST /api/chats/507f1f77bcf86cd799439020/messages?content=سلام&message_type=text
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
  "created_at": "2024-01-01T12:00:00"
}
```

**Error Responses:**
- `400`: حجم فایل بیشتر از 10MB است
- `403`: شما عضو این چت نیستید
- `404`: چت یافت نشد

---

## 5. WebSocket

### 5.1 اتصال WebSocket

**Endpoint:** `ws://localhost:8009/ws/{chat_id}`

**Path Parameters:**
- `chat_id`: شناسه چت

**نحوه اتصال:**
```javascript
const ws = new WebSocket('ws://localhost:8009/ws/507f1f77bcf86cd799439020');

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle new message
  console.log('New message:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};
```

**فرمت پیام دریافتی:**
```json
{
  "id": "507f1f77bcf86cd799439030",
  "chat_id": "507f1f77bcf86cd799439020",
  "sender_id": "507f1f77bcf86cd799439011",
  "sender_name": "نام کامل",
  "message_type": "text",
  "content": "سلام",
  "file_url": null,
  "created_at": "2024-01-01T12:00:00"
}
```

**نکته:** پیام‌های جدید به صورت Real-time از طریق WebSocket به تمام اعضای چت ارسال می‌شوند.

---

## 6. مثال‌های کد JavaScript/React

### 6.1 ثبت نام و ورود

```javascript
// Register
const register = async (username, email, password) => {
  const response = await fetch('http://localhost:8009/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password }),
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

### 6.3 ارسال فایل

```javascript
const sendFile = async (chatId, file) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(
    `http://localhost:8009/api/chats/${chatId}/messages/file`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }
  );
  
  return await response.json();
};
```

### 6.4 استفاده از WebSocket

```javascript
const connectWebSocket = (chatId, onMessage) => {
  const ws = new WebSocket(`ws://localhost:8009/ws/${chatId}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { // New message
      onMessage(message);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Reconnect after 3 seconds
    setTimeout(() => connectWebSocket(chatId, onMessage), 3000);
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

