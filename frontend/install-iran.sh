#!/bin/bash

# اسکریپت نصب با استفاده از registry ایرانی

echo "🔧 تنظیم npm برای استفاده از registry ایرانی..."

# تنظیم registry ایرانی
npm config set registry https://registry.npm.ir/
npm config set strict-ssl false
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

echo "📦 در حال نصب dependencies..."
npm install --verbose

if [ $? -eq 0 ]; then
    echo "✅ نصب با موفقیت انجام شد!"
else
    echo "❌ نصب ناموفق بود. لطفاً اتصال اینترنت خود را بررسی کنید."
    exit 1
fi

