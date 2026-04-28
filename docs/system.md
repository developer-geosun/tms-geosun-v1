# TMS GeoSun

## Цель

`tms-geosun` — веб-приложение для системы Transport Management System компании GeoSun (TMS GeoSun).  
Текущая цель: предоставить стабильный frontend и backend API-слой для полного workflow маршрутов, заявок на фрахт и офферов.

## Что уже умеет система

- Frontend на Angular 21 с маршрутизацией, i18n и auth-слоем (`AuthService`, `AuthGuard`, `AuthInterceptor`, login-page).
- Активная страница `freight-calculation` сохраняет маршрут и создает заявку через backend.
- Есть user-страница истории маршрутов и admin-страница очереди заявок.
- Backend на Java 21 + Spring Boot 3 с JWT auth, refresh token rotation и RBAC.
- Backend модуль `routes`: сохранение, чтение списка/деталей, soft delete с ownership-check.
- Backend модуль `route-requests`: создание заявок, список заявок пользователя, admin очередь.
- Backend модуль `quotes`: создание draft, отправка оффера, история офферов и idempotency.
- Деплой frontend на GitHub Pages через GitHub Actions (`main`/`master`).

## Как работает (высокоуровнево)

Пользователь -> Angular frontend -> Backend API (Spring Boot, `/api/v1`) -> MySQL -> Ответ пользователю.

## Основные сущности

- **User**: пользователь системы.
- **Role**: роль пользователя (`admin`, `manager`, `user`) для RBAC.
- **Session/Token**: access/refresh контекст для авторизации запросов.
- **Route**: сохраненный snapshot маршрута (polyline, точки, метаданные).
- **RouteRequest**: заявка на перевозку, связанная с сохраненным маршрутом.
- **FreightQuote**: коммерческое предложение по заявке с версионностью и статусом.

## Основные API (текущее состояние)

- `GET /actuator/health` — health-check.
- `POST /api/v1/auth/login` — вход пользователя (`access token` + `refresh token` + профиль).
- `POST /api/v1/auth/refresh` — обновление пары токенов (rotation).
- `POST /api/v1/auth/logout` — завершение текущей refresh-сессии.
- `GET /api/v1/auth/me` — профиль текущего пользователя.
- `POST /api/v1/routes` — сохранить маршрут.
- `GET /api/v1/routes/my` — получить список своих маршрутов.
- `GET /api/v1/routes/my/{id}` — получить свой маршрут по ID.
- `DELETE /api/v1/routes/my/{id}` — удалить свой маршрут (soft delete).
- `POST /api/v1/route-requests` — создать заявку по `routeId`.
- `GET /api/v1/route-requests/my` — получить список своих заявок.
- `GET /api/v1/route-requests/my/{id}` — получить свою заявку, включая `currentQuote`.
- `GET /api/v1/admin/route-requests` — получить очередь заявок (`ADMIN`/`MANAGER`).
- `GET /api/v1/admin/route-requests/{id}` — получить карточку заявки (`ADMIN`/`MANAGER`).
- `POST /api/v1/admin/route-requests/{id}/quotes` — создать draft quote (`ADMIN`).
- `POST /api/v1/admin/quotes/{id}/send` — отправить quote (`ADMIN`).
- `GET /api/v1/admin/route-requests/{id}/quotes` — получить историю quote (`ADMIN`/`MANAGER`).

### Поведение auth и RBAC

- Пароли валидируются по email/password, backend хранит password hash и роли.
- Защищенные endpoint-ы проверяют `access token` и роли (`admin`, `manager`, `user`).
- Frontend автоматически выполняет одноразовый refresh при `401` через HTTP interceptor.
- При неуспешном refresh frontend очищает auth state и редиректит на `/login`.

## Структура проекта

- `frontend/` — Angular приложение.
- `backend/` — Spring Boot backend (Maven, `src/main/java`, `src/main/resources`).
- `docs/specs/` — ТЗ по фичам.
- `docs/templates/` — шаблоны ТЗ и промптов для LLM.

## Тесты и качество

- Backend integration tests (MockMvc): CRUD маршрутов, ownership, RBAC для admin endpoints, quote idempotency.
- Frontend unit tests: auth/guards/interceptors + API services для `routes` и `route-requests`.
- Миграции только incremental Flyway (`V3`, `V4`, `V5`) без правок предыдущих версий.

## Совместимость rollout

- До конца Phase 1 поддерживался flow без сохранения маршрута.
- Начиная с Phase 2 удален старый прямой submit через Google Apps Script из активного flow.
- HERE API вызывается только на backend, frontend остается на Leaflet + OSM/Nominatim.

## Как запустить

- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm start`
  - app URL: `http://localhost:4200/`
- Backend (Spring Boot):
  - `cd backend`
  - `mvn spring-boot:run`
  - Swagger UI: `http://localhost:8080/swagger-ui.html`
  - Health: `http://localhost:8080/actuator/health`

## Важные правила разработки

- Разрабатывать фичи в отдельных ветках (`feature/`*, `fix/`*), не напрямую в `main/master`.
- Перед реализацией формировать/обновлять ТЗ в `docs/specs/`.
- Не добавлять зависимости без обоснования.
- Не хранить секреты и токены в репозитории.

## Что менять осторожно

- `frontend/src/app/app.config.ts` — глобальные провайдеры, роутинг, i18n-конфигурация.
- `.github/workflows/deploy.yml` — логика деплоя на GitHub Pages.
- `backend/src/main/resources/application*.yml` — профильные настройки окружений и безопасности.
- `backend/src/main/java/com/geosun/tms/auth/security/` — JWT/security-конфигурация.
- `backend/src/main/java/com/geosun/tms/auth/api/` — публичные auth/admin endpoint-ы.

