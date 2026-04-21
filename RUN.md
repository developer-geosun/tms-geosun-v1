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

Из папки `backend`:

```bash
mvn spring-boot:run
```

Перед запуском убедитесь, что:
- MySQL 8 запущен;
- переменные окружения из `backend/.env.example` настроены.

### 2) Frontend

Из папки `frontend`:

```bash
npm install
npm start
```

Frontend будет доступен по адресу: `http://localhost:4200`.

## Вариант 2: запуск всего стека через Docker Compose

Из корня проекта:

1. Создайте `.env` на основе шаблона `.env.example`.
2. Запустите контейнеры:

```bash
docker compose up --build
```

3. Остановите и удалите контейнеры после работы:

```bash
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
