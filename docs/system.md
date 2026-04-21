# TMS GeoSun

## Цель

`tms-geosun` — веб-приложение для системы Transport Management System компании GeoSun (TMS GeoSun).  
Текущая цель: предоставить стабильный frontend и базовый backend API-слой для дальнейшей разработки модулей (включая авторизацию/аутентификацию и бизнес-фичи).

## Что уже умеет система

- Frontend на Angular 21 с маршрутизацией, i18n и MVP auth-слоем (`AuthService`, `AuthGuard`, `AuthInterceptor`, login-page).
- Поддержка i18n через `@ngx-translate/core` (язык по умолчанию: `uk`).
- Backend на Java 21 + Spring Boot 3 с JWT auth, refresh token rotation и RBAC.
- Деплой frontend на GitHub Pages через GitHub Actions (`main`/`master`).

## Как работает (высокоуровнево)

Пользователь -> Angular frontend -> Backend API (Spring Boot, `/api/v1`) -> Данные -> Ответ пользователю.

## Основные сущности

- **User**: пользователь системы (будущая сущность для auth и прав доступа).
- **Role**: роль пользователя (`admin`, `manager`, `user`) для RBAC.
- **Session/Token**: access/refresh контекст для авторизации запросов.
- **Feature Module**: изолированный модуль бизнес-логики, развиваемый отдельно.

## Основные API (текущее состояние)

- `GET /actuator/health` — health-check.
- `POST /api/v1/auth/login` — вход пользователя (`access token` + `refresh token` + профиль).
- `POST /api/v1/auth/refresh` — обновление пары токенов (rotation).
- `POST /api/v1/auth/logout` — завершение текущей refresh-сессии.
- `GET /api/v1/auth/me` — профиль текущего пользователя (требует `Authorization: Bearer <access token>`).

### Поведение auth в MVP
- Пароли валидируются по email/password, backend хранит password hash и роли пользователя.
- Защищенные endpoint-ы проверяют `access token` и роли (RBAC: `admin`, `manager`, `user`).
- Frontend автоматически выполняет одноразовый refresh при `401` через HTTP interceptor.
- При неуспешном refresh frontend очищает auth state и редиректит на `/login`.

## Структура проекта

- `frontend/` — Angular приложение.
- `backend/` — Spring Boot backend (Maven, `src/main/java`, `src/main/resources`).
- `docs/specs/` — ТЗ по фичам.
- `docs/templates/` — шаблоны ТЗ и промптов для LLM.

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
- Использовать шаблоны из `docs/templates/` для стабильного процесса с LLM.
- Не добавлять зависимости без обоснования.
- Не хранить секреты и токены в репозитории.

## Что менять осторожно

- `frontend/src/app/app.config.ts` — глобальные провайдеры, роутинг, i18n-конфигурация.
- `.github/workflows/deploy.yml` — логика деплоя на GitHub Pages.
- `backend/src/main/resources/application*.yml` — профильные настройки окружений и безопасности.
- `backend/src/main/java/com/geosun/tms/auth/security/` — JWT/security-конфигурация.
- `backend/src/main/java/com/geosun/tms/auth/api/` — публичные auth/admin endpoint-ы.

