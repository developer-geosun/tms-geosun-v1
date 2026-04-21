# TMS GeoSun

## Цель

`tms-geosun` — веб-приложение для системы Transport Management System компании GeoSun (TMS GeoSun).  
Текущая цель: предоставить стабильный frontend и базовый backend API-слой для дальнейшей разработки модулей (включая авторизацию/аутентификацию и бизнес-фичи).

## Что уже умеет система

- Frontend на Angular 21 с маршрутизацией, i18n и MVP auth-слоем (`AuthService`, `AuthGuard`, `AuthInterceptor`, login-page).
- Поддержка i18n через `@ngx-translate/core` (язык по умолчанию: `uk`).
- Backend на Google Apps Script с auth-router (`doGet` + `doPost`) и базовыми auth endpoint-ами.
- Деплой frontend на GitHub Pages через GitHub Actions (`main`/`master`).

## Как работает (высокоуровнево)

Пользователь -> Angular frontend -> Backend API (Google Apps Script / future API layer) -> Данные -> Ответ пользователю.

## Основные сущности

- **User**: пользователь системы (будущая сущность для auth и прав доступа).
- **Role**: роль пользователя (`admin`, `manager`, `user`) для RBAC.
- **Session/Token**: access/refresh контекст для авторизации запросов.
- **Feature Module**: изолированный модуль бизнес-логики, развиваемый отдельно.

## Основные API (текущее состояние)

- `GET /` — health-check/базовый ответ сервиса.
- `POST /auth/login` — вход пользователя (`access token` + `refresh token` + профиль).
- `POST /auth/refresh` — обновление `access token`.
- `POST /auth/logout` — завершение refresh-сессии.
- `GET /auth/me` — профиль текущего пользователя (требует `Authorization: Bearer <access token>`).

### Поведение auth в MVP
- Пароли валидируются по email/password, backend хранит password hash и роли пользователя.
- Защищенные endpoint-ы проверяют `access token` и роли (RBAC: `admin`, `manager`, `user`).
- Frontend автоматически выполняет одноразовый refresh при `401` через HTTP interceptor.
- При неуспешном refresh frontend очищает auth state и редиректит на `/login`.

## Структура проекта

- `frontend/` — Angular приложение.
- `backend/` — Google Apps Script код и манифест (`appsscript.json`).
- `docs/specs/` — ТЗ по фичам.
- `docs/templates/` — шаблоны ТЗ и промптов для LLM.

## Как запустить

- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm start`
  - app URL: `http://localhost:4200/`
- Backend (GAS):
  - работа через `clasp` и `backend/src/Code.gs`
  - деплой как Web App в Google Apps Script (при необходимости)
  - для MVP auth нужно:
    - задать Script Property `AUTH_SECRET`
    - подготовить таблицы `users` и `refresh_sessions` (или дать скрипту создать их автоматически)
    - заполнить `users` тестовыми пользователями (`id`, `email`, `passwordHash`, `roles`, `status`)

## Важные правила разработки

- Разрабатывать фичи в отдельных ветках (`feature/`*, `fix/`*), не напрямую в `main/master`.
- Перед реализацией формировать/обновлять ТЗ в `docs/specs/`.
- Использовать шаблоны из `docs/templates/` для стабильного процесса с LLM.
- Не добавлять зависимости без обоснования.
- Не хранить секреты и токены в репозитории.

## Что менять осторожно

- `frontend/src/app/app.config.ts` — глобальные провайдеры, роутинг, i18n-конфигурация.
- `.github/workflows/deploy.yml` — логика деплоя на GitHub Pages.
- `backend/appsscript.json` — настройки runtime/логирования для GAS.
- `backend/src/Code.gs` — публичные web endpoint-функции (`doGet` и будущие `doPost`-роуты).
 - `backend/src/Code.gs` — публичные endpoint-функции и auth/security-логика (token, refresh-сессии, RBAC, throttling).

