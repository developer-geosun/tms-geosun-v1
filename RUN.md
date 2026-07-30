# Запуск проекта

Этот файл описывает основные варианты запуска `tms-geosun-v1`.

## Требования

- Node.js `>=20`
- npm `>=10`
- Java `21`
- Maven `3.9+`
- MySQL `8` (для локального запуска backend без Docker)
- Docker Desktop + Docker Compose (для запуска всего стека в контейнерах)

## Публикация: frontend на GitHub Pages, API через ngrok

Архитектура для публичного доступа:

- **Frontend** — статика на GitHub Pages (`https://developer-geosun.github.io/tms-geosun-v1/`).
- **Backend** — локально (Docker), наружу только через **ngrok** (без проксирования UI).

### 1) GitHub secrets (Settings → Secrets and variables → Actions)

| Secret | Назначение |
| --- | --- |
| `API_URL` | Публичный URL backend, например `https://<NGROK_DOMAIN>` |
| `HERE_API_KEY` | (опционально) ключ HERE для карт на Pages |

### 2) GitHub Pages

Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: **`gh-pages`** / `/ (root)`.

Workflow `.github/workflows/deploy.yml` собирает frontend и пушит в `gh-pages` при push в `master`/`main` (изменения в `frontend/**`) или вручную (`workflow_dispatch`).

### 3) Backend + ngrok (локально)

В `.env`:

```bash
NGROK_AUTHTOKEN=<ваш_ngrok_authtoken>
NGROK_DOMAIN=<ваш_домен_из_ngrok>
CORS_ALLOWED_ORIGIN_PATTERNS=https://developer-geosun.github.io
EMAIL_VERIFICATION_LINK_BASE=https://developer-geosun.github.io/tms-geosun-v1/verify-email
PASSWORD_RESET_LINK_BASE=https://developer-geosun.github.io/tms-geosun-v1/reset-password
```

Запуск API с публичным туннелем:

```bash
docker compose up --build mysql mailhog backend ngrok
```

После старта туннеля значение `API_URL` в GitHub Secrets должно совпадать с `https://<NGROK_DOMAIN>` (и при смене домена — перезапустить Deploy workflow).

## Вариант 1: локальный запуск (frontend + backend по отдельности)

### 1) Backend

Из корня проекта:

```bash
cd backend
mvn spring-boot:run
```

Перед запуском убедитесь, что:
- MySQL 8 запущен;
- переменные окружения из `backend/.env.example` настроены.

### 2) Frontend

Из корня проекта:

```bash
cd frontend
npm install
npm start
```

Перед `npm start` в корневом `.env` задайте `HERE_API_KEY=<ваш_ключ_here>` — ключ будет автоматически подставлен в локальный `frontend/src/assets/app-config.local.js` (файл игнорируется git).

Frontend будет доступен по адресу: `http://localhost:4200`.

## Вариант 2: запуск всего стека через Docker Compose

1. Создайте `.env` на основе шаблона `.env.example`.

```bash
cp .env.example .env
```

- Для production-сборки frontend оставьте `FRONTEND_BUILD_CONFIGURATION=production`.
- Для dev-сборки frontend в Docker укажите `FRONTEND_BUILD_CONFIGURATION=development` (в этом режиме будут видны dev-значения из `environment.ts`, включая автозаполнение тестового логина).
- Для страницы расчета через HERE укажите `HERE_API_KEY=<ваш_ключ_here>`.
- Для выбора источника расчёта пробега по странам укажите `COUNTRY_BREAKDOWN_PROVIDER=here|geojson` (для режима без HERE — `geojson`).
- Для публичного API через ngrok (только backend) укажите:
  - `NGROK_AUTHTOKEN=<ваш_ngrok_authtoken>`
  - `NGROK_DOMAIN=<ваш_домен_из_ngrok>`
  - `CORS_ALLOWED_ORIGIN_PATTERNS=https://developer-geosun.github.io`
  - `EMAIL_VERIFICATION_LINK_BASE=https://developer-geosun.github.io/tms-geosun-v1/verify-email`
  - `PASSWORD_RESET_LINK_BASE=https://developer-geosun.github.io/tms-geosun-v1/reset-password`

2. Запуск контейнеров (из корня проекта):

```bash
docker compose up --build
```

3. Остановка и удаление контейнеров:

```bash
docker compose down
```

### Быстрый dev-цикл frontend (hot reload в Docker)

Когда вы активно меняете UI, удобнее запускать `frontend-dev` (Angular dev server), а не production-`frontend` через nginx.

1. Остановите production frontend (если уже запущен):

```bash
docker compose stop frontend
```

2. Запустите dev frontend с hot reload:

```bash
docker compose --profile dev up -d frontend-dev
```

3. Откройте приложение:

`http://localhost:4200`

Изменения в `frontend/src/*` будут применяться автоматически без пересборки Docker-образа.

4. Остановить только dev frontend:

```bash
docker compose --profile dev stop frontend-dev
```

5. Полностью остановить dev-профиль (рекомендуется в конце сессии):

```bash
docker compose --profile dev down --remove-orphans
```

Примечания:
- `frontend` — это production preview (build + nginx), подходит для проверки итоговой сборки.
- `frontend-dev` — это режим разработки (ng serve), подходит для быстрых правок и тестирования.
- В Docker dev-режиме API проксируется через `frontend/proxy.docker.conf.json` на `http://backend:8080`.
- Для публичного API используйте `ngrok` / `ngrok-dev` (тунель только на backend).
- Для ссылок из писем укажите `EMAIL_VERIFICATION_LINK_BASE` на URL frontend (локальный или GitHub Pages).
- На первом запуске `frontend-dev` установит зависимости (`npm ci`), далее старт обычно заметно быстрее.
- Если выполнить обычный `docker compose down` без `--profile dev`, может появиться `Network ... Resource is still in use`, потому что dev-контейнеры останутся запущенными.

### Dev-профиль (frontend-dev + backend + ngrok только на API)

```bash
docker compose --profile dev up -d --build mysql mailhog backend frontend-dev ngrok-dev

# остановка dev-профиля
docker compose --profile dev down --remove-orphans
```

Локальный вход через gateway (опционально, без ngrok UI): `http://localhost:8082` (или `GATEWAY_DEV_PORT`).

### Быстрые команды

Запуск:

```bash
docker compose up --build
```

Остановка:

```bash
docker compose down
```

Быстрый dev frontend (hot reload):

```bash
docker compose stop frontend
docker compose --profile dev up -d frontend-dev
```

Публичный API (backend + ngrok):

```bash
docker compose up --build mysql mailhog backend ngrok
```

Полная остановка dev-профиля (без "Network ... Resource is still in use"):

```bash
docker compose --profile dev down --remove-orphans
```

### Локальный стек с gateway (без публичного UI через ngrok)

```bash
docker compose up --build mysql mailhog backend frontend gateway
```

## Полезные URL после запуска

- Frontend (локально): `http://localhost:4200`
- Frontend (GitHub Pages): `https://developer-geosun.github.io/tms-geosun-v1/`
- Backend health: `http://localhost:8080/actuator/health`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Gateway (единый локальный вход): `http://localhost:8081`
- ngrok Inspector: `http://localhost:4040`
- Public API health (пример): `https://<NGROK_DOMAIN>/actuator/health`

## Быстрая проверка backend auth API

Префикс auth API: `/api/v1/auth`

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
