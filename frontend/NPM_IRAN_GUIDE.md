# راهنمای حل مشکل npm در ایران 🇮🇷

این راهنما برای حل مشکلات نصب npm در ایران تهیه شده است.

## 🚀 راه‌حل سریع (پیشنهادی)

### روش 1: استفاده از اسکریپت خودکار

```bash
cd frontend
chmod +x install-iran.sh
./install-iran.sh
```

این اسکریپت به صورت خودکار از چندین registry ایرانی استفاده می‌کند و اگر یکی کار نکرد، به دیگری سوییچ می‌کند.

### روش 2: استفاده از Docker (بهترین راه)

```bash
# از root پروژه
docker-compose up --build
```

Dockerfile به صورت خودکار از registry ایرانی استفاده می‌کند.

## 📋 Registry های ایرانی

### 1. npm.iranrepo.ir (پیشنهادی)
```bash
npm config set registry https://npm.iranrepo.ir/
```

### 2. registry.npm.ir
```bash
npm config set registry https://registry.npm.ir/
```

## ⚙️ تنظیمات دستی

### تنظیم npm

```bash
# تنظیم registry ایرانی
npm config set registry https://npm.iranrepo.ir/

# تنظیمات برای حل مشکل اتصال
npm config set strict-ssl false
npm config set fetch-retries 10
npm config set fetch-retry-mintimeout 30000
npm config set fetch-retry-maxtimeout 300000

# نصب
npm install
```

### استفاده از فایل .npmrc

فایل `.npmrc` در پوشه frontend از قبل تنظیم شده است. فقط کافی است:

```bash
cd frontend
npm install
```

## 🔄 استفاده از Yarn (جایگزین npm)

اگر npm کار نکرد، می‌توانید از yarn استفاده کنید:

```bash
# نصب yarn (اگر نصب نیست)
npm install -g yarn --registry https://npm.iranrepo.ir/

# یا
npm install -g yarn

# نصب با yarn
yarn install
```

فایل `.yarnrc` برای yarn هم تنظیم شده است.

## 🐳 استفاده از Docker

Dockerfile به صورت خودکار از registry ایرانی استفاده می‌کند:

```bash
docker-compose up --build
```

اگر می‌خواهید registry را تغییر دهید، می‌توانید در Dockerfile این خط را ویرایش کنید:

```dockerfile
RUN npm config set registry https://npm.iranrepo.ir/
```

## 🔍 عیب‌یابی

### مشکل: npm install timeout می‌گیرد

**راه حل:**
```bash
npm config set fetch-retry-maxtimeout 300000
npm config set fetch-retries 10
```

### مشکل: SSL Error

**راه حل:**
```bash
npm config set strict-ssl false
```

### مشکل: Connection reset

**راه حل:**
1. از registry ایرانی استفاده کنید
2. fetch-retry-maxtimeout را افزایش دهید
3. از yarn استفاده کنید

### مشکل: Package not found

**راه حل:**
```bash
# پاک کردن cache
npm cache clean --force

# نصب مجدد
npm install
```

## 📝 نکات مهم

1. **فایل .npmrc**: این فایل در پوشه frontend تنظیمات registry را ذخیره می‌کند
2. **Dockerfile**: در Docker به صورت خودکار از registry ایرانی استفاده می‌کند
3. **اسکریپت‌ها**: `install-iran.sh` و `install.sh` برای نصب خودکار هستند

## 🌐 تغییر Registry

برای تغییر registry به صورت موقت:

```bash
npm install --registry=https://npm.iranrepo.ir/
```

برای تغییر دائمی:

```bash
npm config set registry https://npm.iranrepo.ir/
```

برای بازگشت به registry اصلی:

```bash
npm config delete registry
```

## ✅ بررسی تنظیمات فعلی

```bash
# مشاهده registry فعلی
npm config get registry

# مشاهده تمام تنظیمات
npm config list
```

## 🆘 اگر هیچکدام کار نکرد

1. اتصال اینترنت خود را بررسی کنید
2. از VPN استفاده کنید
3. با Docker استفاده کنید (بهترین راه)
4. از yarn استفاده کنید
5. با توسعه‌دهنده تماس بگیرید

## 📚 منابع بیشتر

- [IranRepo](https://iranrepo.ir/)
- [npm.iranrepo.ir](https://npm.iranrepo.ir/)
- [registry.npm.ir](https://registry.npm.ir/)

