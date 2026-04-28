# Запуск проекта

Этот файл описывает основные варианты запуска `tms-geosun-v1`.

## Требования

- Node.js `>=20`
- npm `>=10`
- Java `21`
- Maven `3.9+`
- MySQL `8` (для локального запуска backend без Docker)
- Docker Desktop + Docker Compose (для запуска всего стека в контейнерах)

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

2. Запуск контейнеров (из корня проекта):

```bash
docker compose up --build
```

3. Остановка и удаление контейнеров:

```bash
docker compose down
```

### Быстрые команды (копировать одним блоком)

```bash
# запуск
docker compose up --build

# остановка
docker compose down
```

## Полезные URL после запуска

- Frontend: `http://localhost:4200`
- Backend health: `http://localhost:8080/actuator/health`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

## Быстрая проверка backend auth API

Префикс auth API: `/api/v1/auth`

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
