FROM node:18-alpine

WORKDIR /app

# تنظیم npm registry برای حل مشکل اینترنت
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set strict-ssl false && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

COPY package*.json ./
RUN npm install --verbose || npm install --verbose || npm install --verbose

COPY . .

RUN npm run build

FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

