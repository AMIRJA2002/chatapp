#!/bin/bash

# اسکریپت نصب با چندین راه‌حل

echo "🔧 در حال نصب dependencies..."

# تنظیم npm registry
npm config set registry https://registry.npmjs.org/
npm config set strict-ssl false
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

# اگر در ایران هستید، می‌توانید از registry ایرانی استفاده کنید:
# npm config set registry https://registry.npm.ir/

# تلاش برای نصب با npm
echo "📦 تلاش 1: نصب با npm..."
if npm install --verbose; then
    echo "✅ نصب با موفقیت انجام شد!"
    exit 0
fi

echo "⚠️  npm install ناموفق بود. تلاش با yarn..."

# بررسی وجود yarn
if ! command -v yarn &> /dev/null; then
    echo "📦 نصب yarn..."
    npm install -g yarn
fi

# تلاش با yarn
echo "📦 تلاش 2: نصب با yarn..."
if yarn install; then
    echo "✅ نصب با yarn موفق بود!"
    exit 0
fi

echo "❌ هر دو روش ناموفق بودند."
echo "💡 راه‌حل‌های پیشنهادی:"
echo "   1. اتصال اینترنت خود را بررسی کنید"
echo "   2. از VPN استفاده کنید"
echo "   3. از registry ایرانی استفاده کنید: npm config set registry https://registry.npm.ir/"
echo "   4. با Docker استفاده کنید: docker-compose up --build"
exit 1

