# راهنمای شروع سریع

## نصب و راه‌اندازی با Docker

### 1. کلون کردن پروژه (اگر از Git استفاده می‌کنید)
```bash
git clone <repository-url>
cd chatapp
```

### 2. راه‌اندازی با Docker Compose
```bash
docker-compose up --build
```

این دستور:
- MongoDB را راه‌اندازی می‌کند (پورت 27017)
- Backend را راه‌اندازی می‌کند (پورت 8009)
- Frontend را راه‌اندازی می‌کند (پورت 3000)

### 3. دسترسی به اپلیکیشن
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8009
- **API Documentation**: http://localhost:8009/docs
- **MongoDB**: localhost:27017

---

## نصب و راه‌اندازی بدون Docker

### Backend

```bash
cd backend

# نصب dependencies
pip install -r requirements.txt

# کپی فایل .env
cp .env.example .env

# ویرایش .env (اختیاری - مقادیر پیش‌فرض کار می‌کنند)
# MONGODB_URL=mongodb://localhost:27017
# DATABASE_NAME=chatapp
# SECRET_KEY=your-secret-key-here-change-in-production

# راه‌اندازی MongoDB (اگر نصب نیست)
# Ubuntu/Debian:
# sudo apt-get install mongodb

# macOS:
# brew install mongodb-community

# راه‌اندازی سرور
python run.py
```

### Frontend

```bash
cd frontend

# نصب dependencies
npm install

# راه‌اندازی
npm start
```

---

## تست اپلیکیشن

### 1. ثبت نام
1. به http://localhost:3000 بروید
2. روی "ثبت نام" کلیک کنید
3. اطلاعات خود را وارد کنید

### 2. ایجاد چت
1. بعد از ورود، روی "چت جدید" کلیک کنید
2. ایمیل کاربر دیگری را وارد کنید
3. چت ایجاد می‌شود

### 3. ارسال پیام
1. روی یک چت کلیک کنید
2. پیام خود را بنویسید و ارسال کنید
3. برای ارسال فایل، روی آیکون 📎 کلیک کنید

---

## ساختار فایل‌ها

```
chatapp/
├── backend/
│   ├── app/
│   │   ├── main.py           # API endpoints
│   │   ├── models.py          # Data models
│   │   ├── auth.py            # Authentication
│   │   ├── database.py        # MongoDB connection
│   │   └── login_strategy.py  # Login factory pattern
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── context/           # React context
│   │   └── services/          # API services
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── README.md
└── API_DOCUMENTATION.md
```

---

## مشکلات رایج

### مشکل: MongoDB اتصال برقرار نمی‌کند
**راه حل:**
- مطمئن شوید MongoDB در حال اجرا است
- در Docker: `docker-compose ps` را بررسی کنید
- بدون Docker: `sudo systemctl status mongod` را بررسی کنید

### مشکل: Frontend به Backend متصل نمی‌شود
**راه حل:**
- مطمئن شوید Backend روی پورت 8009 در حال اجرا است
- در `frontend/src/services/api.js` آدرس Backend را بررسی کنید

### مشکل: فایل‌ها آپلود نمی‌شوند
**راه حل:**
- مطمئن شوید پوشه `backend/uploads` وجود دارد
- دسترسی نوشتن در پوشه را بررسی کنید

---

## نکات توسعه

### افزودن ویژگی جدید

1. **Backend**: endpoint جدید در `backend/app/main.py` اضافه کنید
2. **Frontend**: component جدید در `frontend/src/components/` ایجاد کنید
3. **API Documentation**: مستندات را در `API_DOCUMENTATION.md` به‌روزرسانی کنید

### افزودن روش ورود جدید (مثل OTP)

1. در `backend/app/login_strategy.py` کلاس جدید ایجاد کنید:
```python
class OTPLoginStrategy(LoginStrategy):
    async def authenticate(self, login_data: OTPLoginRequest) -> User:
        # Implement OTP logic
        pass
```

2. در factory ثبت کنید:
```python
login_factory.register_strategy("otp", OTPLoginStrategy())
```

3. در endpoint استفاده کنید:
```python
strategy = login_factory.get_strategy("otp")
user = await strategy.authenticate(otp_data)
```

---

## پشتیبانی

برای سوالات و مشکلات:
- مستندات API را در `API_DOCUMENTATION.md` مطالعه کنید
- Swagger UI را در http://localhost:8009/docs بررسی کنید

