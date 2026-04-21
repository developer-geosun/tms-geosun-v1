FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG FRONTEND_BUILD_CONFIGURATION=production
RUN npm run build -- --configuration=${FRONTEND_BUILD_CONFIGURATION}

FROM nginx:1.27-alpine
COPY --from=build /app/dist/tms-geosun /usr/share/nginx/html
EXPOSE 80
