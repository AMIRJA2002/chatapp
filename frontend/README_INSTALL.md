# راهنمای نصب Frontend

## مشکل npm install؟

اگر در نصب dependencies به مشکل برخوردید، این راه‌حل‌ها را امتحان کنید:

## راه‌حل 1: استفاده از اسکریپت نصب (پیشنهادی)

```bash
cd frontend
chmod +x install.sh
./install.sh
```

این اسکریپت به صورت خودکار:
- تنظیمات npm را بهینه می‌کند
- چندین بار تلاش می‌کند
- در صورت نیاز از yarn استفاده می‌کند

## راه‌حل 2: استفاده از Registry ایرانی

اگر در ایران هستید:

```bash
cd frontend
chmod +x install-iran.sh
./install-iran.sh
```

یا به صورت دستی:

```bash
npm config set registry https://registry.npm.ir/
npm config set strict-ssl false
npm install
```

## راه‌حل 3: تنظیم دستی npm

```bash
cd frontend

# تنظیمات npm
npm config set registry https://registry.npmjs.org/
npm config set strict-ssl false
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

# نصب
npm install --verbose
```

## راه‌حل 4: استفاده از Yarn

```bash
cd frontend

# نصب yarn (اگر نصب نیست)
npm install -g yarn

# نصب با yarn
yarn install
```

## راه‌حل 5: استفاده از Docker (بدون نیاز به npm install)

```bash
# از root پروژه
docker-compose up --build
```

Docker به صورت خودکار dependencies را نصب می‌کند.

## راه‌حل 6: استفاده از Cache

```bash
cd frontend

# پاک کردن cache
npm cache clean --force

# نصب مجدد
npm install --verbose
```

## راه‌حل 7: استفاده از Proxy (اگر پشت proxy هستید)

```bash
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port
npm install
```

## راه‌حل 8: نصب تکی packages

اگر همه packages نصب نمی‌شوند:

```bash
cd frontend

# نصب تکی
npm install react@^18.2.0 --save
npm install react-dom@^18.2.0 --save
npm install react-router-dom@^6.20.0 --save
npm install axios@^1.6.2 --save
npm install socket.io-client@^4.5.4 --save
npm install react-scripts@5.0.1 --save-dev
```

## بررسی تنظیمات فعلی

```bash
# مشاهده registry فعلی
npm config get registry

# مشاهده تمام تنظیمات
npm config list
```

## بازگشت به تنظیمات پیش‌فرض

```bash
npm config delete registry
npm config delete strict-ssl
npm config delete proxy
npm config delete https-proxy
```

## نکات مهم

1. **Registry ایرانی**: اگر در ایران هستید، استفاده از `https://registry.npm.ir/` می‌تواند سرعت را افزایش دهد.

2. **VPN**: اگر مشکل اتصال دارید، استفاده از VPN می‌تواند کمک کند.

3. **Timeout**: اگر timeout می‌گیرید، timeout را افزایش دهید:
   ```bash
   npm config set fetch-retry-maxtimeout 300000
   ```

4. **Docker**: بهترین راه‌حل برای جلوگیری از مشکلات npm، استفاده از Docker است.

## اگر هیچکدام کار نکرد

1. اتصال اینترنت خود را بررسی کنید
2. فایروال را بررسی کنید
3. از Docker استفاده کنید (بهترین راه‌حل)
4. با توسعه‌دهنده تماس بگیرید

