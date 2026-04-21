# Technical Specification / Техническое задание: User Authentication & Authorization / Аутентификация и авторизация пользователей

## Language Rules / Правила языка
- **Primary language / Основной язык:** RU
- **Secondary language / Дополнительный язык:** EN
- **Terms to keep in English / Термины, которые оставляем на английском:** `auth`, `access token`, `refresh token`, `scope`, `Definition of Done`, `RBAC`

## 1) Goal / Цель
- **Problem / Проблема:** В приложении отсутствует централизованный механизм входа пользователей и контроля прав доступа.
- **Value / Ценность:** Безопасный доступ к данным, управление ролями, снижение риска несанкционированных действий.
- **Expected outcome / Ожидаемый результат:** Пользователь может войти в систему, получать доступ только к разрешенным функциям и безопасно завершать сессию.

## 2) Context / Контекст
- **Project/module / Проект/модуль:** `frontend` (Angular 21) + `backend` (Google Apps Script API layer).
- **Current behavior / Текущее поведение:** На backend реализован только базовый `doGet` health-check, auth-поток с ролями и refresh-сессиями отсутствует.
- **Related docs / Связанные документы:** `docs/system.md`, `docs/templates/specs/_template.md`.
- **Environment constraints / Ограничения окружения:** Должно быть совместимо с текущей архитектурой (`frontend/`, `backend/src/Code.gs`, `backend/appsscript.json`), без обязательного добавления новых библиотек на этапе MVP.

## 3) Scope (In) / Scope (входит в задачу)
- Реализация входа пользователя по email/password.
- Реализация проверки access token для защищенных API.
- Реализация обновления токена (refresh flow).
- Реализация logout (инвалидация refresh-сессии).
- Реализация ролевой модели доступа (`admin`, `manager`, `user`).
- Защита приватных маршрутов и UI-элементов на frontend.

## 4) Out of Scope / Out of Scope (не входит)
- OAuth/SSO (Google, Microsoft, GitHub).
- 2FA/MFA.
- Самостоятельная регистрация пользователя (если не будет отдельного решения).
- Полный audit trail уровня enterprise (может быть этапом v2).

## 5) User Stories / Пользовательские сценарии
1. **As a / Как** user, **I want / я хочу** войти по email/password, **so that / чтобы** получить доступ к личным функциям.
2. **As a / Как** manager, **I want / я хочу** видеть только разрешенные разделы, **so that / чтобы** не иметь доступа к админ-функциям.
3. **As a / Как** admin, **I want / я хочу** иметь полный доступ к управлению, **so that / чтобы** выполнять административные задачи.

## 6) Functional Requirements / Функциональные требования
1. Система принимает credentials и возвращает `access token` + `refresh token` + профиль пользователя.
2. Каждый защищенный endpoint требует валидный `access token`.
3. При истечении `access token` frontend выполняет `refresh` и повторяет исходный запрос.
4. При logout refresh-сессия инвалидируется.
5. Проверка ролей выполняется на backend (RBAC), а frontend скрывает недоступные элементы UI.
6. При невалидных credentials API возвращает `401`.
7. При недостатке прав API возвращает `403`.

## 7) Non-functional Requirements / Нефункциональные требования
- **Security / Безопасность:**
  - Пароли хранятся только в виде хеша (минимум salted hash; предпочтительно `bcrypt`/`argon2` если позволяет платформа).
  - Токены не логируются в чистом виде.
  - Ограничение попыток входа (rate limit/throttling).
- **Performance / Производительность:** `POST /auth/login` p95 <= 500 ms при целевой нагрузке MVP.
- **Reliability / Надежность:** При ошибке refresh пользователь переводится на login без падения приложения.
- **Logging/Monitoring / Логирование и мониторинг:** События `login_success`, `login_failed`, `refresh_failed`, `logout`.
- **Accessibility/UX / Доступность и UX:** Понятные тексты ошибок, корректная работа состояния загрузки.

## 8) Data Contracts and API / Контракты данных и API
### 8.1 Input Data / Входные данные
- **Format / Формат:** JSON.
- **Validation / Валидация:**
  - `email`: обязательное поле, валидный email-формат.
  - `password`: обязательное поле, минимум 8 символов.

### 8.2 Output Data / Выходные данные
- **Format / Формат:** JSON.
- **Errors / Ошибки:** `400`, `401`, `403`, `429`, `500`.

### 8.3 Endpoints (if any) / Эндпоинты (если есть)
> Примечание: в текущем состоянии системы существует только `GET /` через GAS `doGet`. Эндпоинты ниже являются целевыми для реализации этой фичи.

- `POST /auth/login` - аутентификация пользователя.
  - Request:
    ```json
    {
      "email": "user@example.com",
      "password": "string"
    }
    ```
  - Response 200:
    ```json
    {
      "accessToken": "jwt-or-signed-token",
      "refreshToken": "opaque-or-jwt",
      "expiresIn": 900,
      "user": {
        "id": "u_123",
        "email": "user@example.com",
        "roles": ["user"]
      }
    }
    ```

- `POST /auth/refresh` - обновление access token.
  - Request:
    ```json
    {
      "refreshToken": "token-value"
    }
    ```
  - Response 200:
    ```json
    {
      "accessToken": "new-token",
      "expiresIn": 900
    }
    ```

- `POST /auth/logout` - завершение сессии.
  - Request:
    ```json
    {
      "refreshToken": "token-value"
    }
    ```
  - Response 204.

- `GET /auth/me` - профиль текущего пользователя.
  - Response 200:
    ```json
    {
      "id": "u_123",
      "email": "user@example.com",
      "roles": ["user"]
    }
    ```

## 9) UX/UI Requirements (frontend) / UX/UI требования (frontend)
- Страница login с полями email/password.
- Состояния: `loading` / `error` / `success`.
- Guard на приватных маршрутах.
- HTTP interceptor для `Authorization: Bearer <access token>`.
- Автоматический refresh при `401` (однократная попытка).
- При `refresh`-ошибке - очистка auth state и редирект на login.
- UI-ограничения по ролям:
  - `admin`: полный UI.
  - `manager`: без admin-панелей.
  - `user`: только пользовательские разделы.

## 10) Architecture Changes / Изменения в архитектуре
- **Components/services / Компоненты/сервисы:**
  - Frontend: `AuthService`, `AuthGuard`, `AuthInterceptor`.
  - Backend (GAS): роутинг в `doPost`, handlers проверки токенов и ролей.
- **Data storage / Хранилище данных:**
  - Таблица/лист пользователей: `id`, `email`, `passwordHash`, `roles`, `status`.
  - Таблица/лист refresh-сессий: `tokenHash`, `userId`, `expiresAt`, `revokedAt`.
- **Integrations / Интеграции:** Без внешних auth-провайдеров в MVP.
- **Compatibility / Совместимость:** Текущие публичные маршруты остаются доступными без auth.

## 11) Implementation Constraints / Ограничения реализации
- Следовать текущему стеку проекта.
- Не менять несвязанные модули.
- Не добавлять зависимость без описания причины в PR.
- Не хранить секреты в репозитории.
- Учитывать ограничения Google Apps Script (runtime/квоты/модель web app endpoint).

## 12) Implementation Plan / План реализации
1. Утвердить модель ролей и матрицу доступа.
2. Реализовать в `backend/src/Code.gs` роутинг `doPost` и endpoints `login/refresh/logout`; `me` реализовать через `doGet` с параметром маршрута или через общий роутер.
3. Реализовать проверку access token и ролей на backend.
4. Реализовать frontend auth слой (service, interceptor, guard).
5. Добавить UI login и обработку состояний.
6. Добавить тесты (unit + integration/e2e критичных сценариев).
7. Обновить документацию и инструкции запуска, включая разделы `docs/system.md`.

## 13) Acceptance Criteria (Definition of Done) / Критерии приемки
- [ ] Пользователь может войти и получить корректные токены.
- [ ] Защищенные API возвращают `401` без access token.
- [ ] Пользователь с недостаточными правами получает `403`.
- [ ] Refresh flow работает при истечении access token.
- [ ] Logout инвалидирует refresh-сессию.
- [ ] Frontend корректно обрабатывает `401/403`.
- [ ] Тесты на критичные auth-сценарии добавлены и проходят.
- [ ] Документация по auth-потоку обновлена.

## 14) Test Plan / Тест-план
- **Unit:**
  - Валидация payload login.
  - Проверка RBAC-правил.
  - Обработка refresh-логики.
- **Integration:**
  - `login -> me` успешный сценарий.
  - `expired access -> refresh -> retry` сценарий.
  - `logout -> refresh` должен завершаться ошибкой.
- **E2E/Manual:**
  - Успешный вход и доступ к разрешенным страницам.
  - Попытка открыть admin-страницу под `user` -> отказ.
- **Edge cases / Граничные случаи:**
  - Неверный пароль.
  - Заблокированный пользователь.
  - Истекший/отозванный refresh token.

## 15) Risks and Assumptions / Риски и допущения
- **Risks / Риски:**
  - Неверный выбор схемы хранения refresh-токена может ослабить безопасность.
  - Слабая защита login endpoint от brute-force.
  - Расхождение роли в UI и backend.
- **Assumptions / Допущения:**
  - Есть хранилище пользователей и сессий.
  - Есть возможность централизованно хранить секрет подписи токенов.
- **Rollback plan / План отката:**
  - Feature-flag на auth middleware (если применимо).
  - Откат до baseline tag и отключение новых auth-endpoints.

## 16) Release Artifacts / Артефакты релиза
- PR: `<add-link>`
- Version/tag / Версия/тег: `<add-version>`
- Release date / Дата релиза: `<add-date>`
- Owner / Ответственный: `<add-owner>`

---

## Instructions for LLM / Инструкции для LLM
1. Если есть неоднозначность, сначала задавай уточняющие вопросы.
2. Реализация должна строго соответствовать Scope/Out of Scope.
3. Не изменяй несвязанные модули.
4. Перед кодом покажи короткий план.
5. После реализации укажи измененные файлы, команды проверки и риски.
6. Не добавляй зависимости без явного обоснования.
7. Для сложной логики оставляй короткие и точные комментарии.
