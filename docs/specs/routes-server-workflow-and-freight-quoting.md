# Technical Specification / Техническое задание: Route Management & Freight Quoting Backend / Серверная часть маршрутов и предложений по фрахту

## Language Rules / Правила языка
- **Primary language / Основной язык:** RU
- **Secondary language / Дополнительный язык:** EN
- **Terms to keep in English / Термины, которые оставляем на английском:** `auth`, `access token`, `refresh token`, `RBAC`, `route snapshot`, `quote`, `Definition of Done`

## 1) Goal / Цель
- **Problem / Проблема:** В системе нет серверного контура для хранения маршрутов пользователя, просмотра истории и подготовки коммерческих предложений (`quote`) администратором по отправленным заявкам.
- **Value / Ценность:** Единый, воспроизводимый и контролируемый workflow: пользователь сохраняет и переоткрывает маршруты, admin рассчитывает фрахт на основе сохраненного маршрута без расхождения данных.
- **Expected outcome / Ожидаемый результат:** Backend предоставляет API и модель данных для `route requests`, истории маршрутов, расчета протяженности по странам и формирования `quote` с ролевым доступом.

## 2) Context / Контекст
- **Project/module / Проект/модуль:** `backend` (Java 21, Spring Boot 3), интеграция с `frontend` (Angular 21).
- **Current behavior / Текущее поведение:** Целевой серверный workflow маршрутов и `quote` в основном домене отсутствует; legacy-страница `freight-calculation-here` не используется в актуальном продукте.
- **Frontend integration baseline / Базовая интеграция frontend:** При проектировании и реализации учитывать уже используемую страницу `freight-calculation` как основной клиентский экран маршрутного сценария.
- **Related docs / Связанные документы:**
  - `docs/specs/auth-authentication-authorization.md` (**основной источник истины по auth и ролям**).
  - `docs/specs/route-point-operations-rules.md` (**canonical source для правил операций точек маршрута**).
  - `docs/system.md`.
  - `backend/TECHNICAL_SPECIFICATION_API_SERVER_v1.0.md`.
- **Environment constraints / Ограничения окружения:**
  - REST base path: `/api/v1`.
  - Аутентификация и авторизация строго по правилам из `docs/specs/auth-authentication-authorization.md`.
  - Хранилище: MySQL 8 + Flyway migrations.
  - Внешняя маршрутизация: HERE API (с ограничениями квот).

## 3) Scope (In) / Scope (входит в задачу)
- Серверное сохранение маршрутов пользователя (`route snapshot`) и точек маршрута.
- Просмотр пользователем списка своих маршрутов и открытие любого сохраненного маршрута.
- Отправка пользователем запроса на расчет фрахта по сохраненному маршруту.
- Админский просмотр входящих запросов и маршрутов.
- Формирование и отправка админом предложения по фрахту (`quote`) с версионностью.
- Расчет протяженности маршрута по странам на backend.
- Ролевой доступ к API (user/admin/manager) в соответствии с auth-спецификацией.
- Проектирование API-контрактов и переходного интеграционного слоя с учетом текущей логики страницы `freight-calculation`.

## 4) Out of Scope / Out of Scope (не входит)
- Публичная регистрация и изменения auth-механизма (все правила берутся из auth-спецификации).
- Онлайн-оплата фрахта и бухгалтерские документы.
- Полноценный workflow тендеров/аукционов между несколькими перевозчиками.
- Оптимизация маршрутов между альтернативными вариантами в UI (v2+).
- Любые доработки legacy-экрана `freight-calculation-here` (экран исключен из MVP и не является источником требований для backend).

## 5) User Stories / Пользовательские сценарии
1. **As a / Как** user, **I want / я хочу** сохранить построенный маршрут, **so that / чтобы** позже открыть его без повторного построения.
2. **As a / Как** user, **I want / я хочу** отправить запрос на фрахт по выбранному маршруту, **so that / чтобы** получить коммерческое предложение.
3. **As a / Как** admin, **I want / я хочу** видеть все отправленные запросы и их маршруты, **so that / чтобы** подготовить корректный расчет стоимости.
4. **As a / Как** admin, **I want / я хочу** сформировать и отправить `quote`, **so that / чтобы** пользователь видел официальное предложение по своей заявке.

## 6) Functional Requirements / Функциональные требования
1. Система должна сохранять `route snapshot` (геометрия + точки + метаданные построения).
2. Пользователь может получать список только своих маршрутов (`owner-based access`).
3. Пользователь может открывать конкретный маршрут по `id`, если он владелец.
4. Пользователь может создать `route request` на фрахт по сохраненному маршруту.
5. Admin может просматривать все `route requests`, фильтровать по статусам и открывать детали.
6. Admin может создавать и отправлять `quote`; система хранит историю версий предложений.
7. Backend рассчитывает и сохраняет breakdown расстояния по странам для маршрута, используемого в заявке.
8. Повторные пересчеты маршрута для уже отправленного запроса не допускаются без явного действия admin (чтобы избежать расхождения с пользовательским маршрутом).
9. Все защищенные endpoint-ы используют bearer `access token` и проверки ролей по RBAC из auth-спецификации.

## 7) Non-functional Requirements / Нефункциональные требования
- **Security / Безопасность:**
  - Следовать требованиям `docs/specs/auth-authentication-authorization.md` для `401/403`, bearer, RBAC.
  - Проверка владения ресурсом (`user_id`) для всех user endpoint-ов.
  - Запрет логирования персональных данных и токенов в открытом виде.
- **Performance / Производительность:**
  - `GET /api/v1/routes/my` p95 <= 300 ms при типичном объеме истории.
  - `GET /api/v1/admin/route-requests` p95 <= 400 ms при фильтрации по статусу.
  - Расчет country-breakdown после фиксации маршрута <= 2 s p95 (при доступном HERE API).
- **Reliability / Надежность:**
  - При недоступности HERE API запрос переводится в `pending_recalculation`, без потери сохраненного snapshot.
  - `quote` операции должны быть идемпотентны по `idempotency key` (для create/send).
- **Logging/Monitoring / Логирование и мониторинг:**
  - События: `route_saved`, `route_opened`, `route_request_created`, `route_breakdown_calculated`, `quote_created`, `quote_sent`.
  - Метрики: частота вызовов HERE API, cache hit ratio, latency по endpoint-ам.
- **Accessibility/UX / Доступность и UX:**
  - API отдает понятные бизнес-ошибки (`ROUTE_NOT_FOUND`, `ACCESS_DENIED`, `QUOTE_ALREADY_SENT`).

## 8) Data Contracts and API / Контракты данных и API
### 8.1 Input Data / Входные данные
- **Format / Формат:** JSON.
- **Validation / Валидация:**
  - `route.points` минимум 2 точки.
  - `lat` в диапазоне `[-90, 90]`, `lng` в диапазоне `[-180, 180]`.
  - `routeId` и `requestId` — UUID/CHAR(36) по принятому стандарту проекта.
  - `quote.totalAmount` > 0.
  - `currency` по ISO 4217 (`EUR`, `USD`, `UAH`, ...).

### 8.2 Output Data / Выходные данные
- **Format / Формат:** JSON.
- **Errors / Ошибки:** `400`, `401`, `403`, `404`, `409`, `422`, `429`, `503`.

### 8.3 Endpoints (if any) / Эндпоинты (если есть)
> Все endpoint-ы ниже защищены `Bearer access token` по правилам `docs/specs/auth-authentication-authorization.md`.

- `POST /api/v1/routes` - сохранить маршрут (`user`, `admin`, `manager`).
  - Request:
    ```json
    {
      "title": "Kyiv -> Warsaw",
      "routingProfile": "truck",
      "routingMode": "fast",
      "routePolyline": "<encoded-polyline>",
      "distanceKm": 812.34,
      "durationMin": 742,
      "points": [
        {
          "order": 1,
          "type": "start",
          "address": "Kyiv",
          "lat": 50.4501,
          "lng": 30.5234,
          "country": "UA",
          "isBorder": false
        },
        {
          "order": 2,
          "type": "finish",
          "address": "Warsaw",
          "lat": 52.2297,
          "lng": 21.0122,
          "country": "PL",
          "isBorder": false
        }
      ],
      "hereRouteMeta": {
        "provider": "HERE",
        "routeHandle": "optional-string",
        "apiVersion": "v8"
      }
    }
    ```
  - Response 201:
    ```json
    {
      "id": "rt_123",
      "status": "saved",
      "createdAt": "2026-04-28T16:00:00Z"
    }
    ```

- `GET /api/v1/routes/my` - список маршрутов текущего пользователя.
- `GET /api/v1/routes/my/{routeId}` - открыть сохраненный маршрут текущего пользователя.

- `POST /api/v1/route-requests` - отправить запрос на фрахт по сохраненному маршруту (`user`).
  - Request:
    ```json
    {
      "routeId": "rt_123",
      "preferredStartDate": "2026-05-12",
      "comment": "Need refrigerated truck",
      "cargo": {
        "type": "food",
        "weightKg": 18000,
        "volumeM3": 78
      }
    }
    ```
  - Response 201:
    ```json
    {
      "id": "rq_456",
      "status": "new",
      "createdAt": "2026-04-28T16:05:00Z"
    }
    ```

- `GET /api/v1/route-requests/my` - список запросов текущего пользователя.
- `GET /api/v1/route-requests/my/{requestId}` - детали запроса пользователя + актуальный `quote` (если есть).

- `GET /api/v1/admin/route-requests` - список запросов для admin/manager.
- `GET /api/v1/admin/route-requests/{requestId}` - детали запроса + маршрут + breakdown по странам.

- `POST /api/v1/admin/route-requests/{requestId}/quotes` - создать draft `quote` (`admin`).
- `POST /api/v1/admin/quotes/{quoteId}/send` - отправить `quote` пользователю (`admin`).
- `GET /api/v1/admin/route-requests/{requestId}/quotes` - история предложений (`admin`, `manager`).

## 9) UX/UI Requirements (frontend) / UX/UI требования (frontend)
- Пользовательский раздел:
  - История маршрутов (`loading/empty/error/success`).
  - Экран открытия сохраненного маршрута без пересчета через внешний API.
  - Форма отправки запроса на фрахт по выбранному маршруту.
- Админский раздел:
  - Очередь `route requests` с фильтрами статусов.
  - Карточка запроса: маршрут, breakdown по странам, блок предложений.
  - Создание/редактирование draft и отправка `quote`.
- RBAC-ограничения UI строго синхронизированы с backend (см. auth-спецификацию).

## 10) Architecture Changes / Изменения в архитектуре
- **Components/services / Компоненты/сервисы:**
  - `RouteController`, `RouteRequestController`, `AdminRouteRequestController`, `QuoteController`.
  - `RouteService`, `RouteRequestService`, `FreightQuoteService`, `CountryBreakdownService`.
  - `HereRoutingClient` с кэшированием и лимитированием.
- **Data storage / Хранилище данных:**
  - Таблицы: `routes`, `route_points`, `route_requests`, `route_country_distances`, `freight_quotes`, `freight_quote_items` (опционально), `request_status_history`.
  - Индексы: `(user_id, updated_at)`, `(request_id, created_at)`, `(route_id, point_order)`, `(status, created_at)`.
- **Integrations / Интеграции:**
  - HERE API только на backend для перерасчета/постобработки по строго фиксированному snapshot.
  - Запрет повторного маршрутизирования в критичных шагах расчета `quote`, если snapshot уже зафиксирован.
- **Compatibility / Совместимость:**
  - Новые endpoint-ы не ломают существующий auth-контур.
  - Версионирование API сохраняется в `/api/v1`.

## 11) Implementation Constraints / Ограничения реализации
- Обязательно переиспользовать текущий auth middleware и RBAC политику из `docs/specs/auth-authentication-authorization.md`.
- Не дублировать логику аутентификации внутри route-модулей.
- Не выполнять тяжелые HERE-запросы из frontend для финального расчета цены.
- Не вводить новые внешние зависимости без обоснования в PR.
- Не менять несвязанные модули и endpoint-ы `auth`.
- Не закладывать backend-контракты под legacy-страницу `freight-calculation-here`; контракты проектируются под новый маршрутный flow (`routes`/`route_requests`/`quotes`).
- При добавлении/изменении контрактов учитывать обратную совместимость для активного frontend-экрана `freight-calculation` (или предоставить явный migration plan для фронтенда).
- Любые изменения правил операций точек маршрута выполнять с обязательной синхронизацией с `docs/specs/route-point-operations-rules.md`.

## Legacy Note / Примечание по legacy
- Страница `freight-calculation-here` считается неиспользуемой в текущем продукте.
- Данная спецификация не использует ее как источник бизнес-правил, API-контрактов или критериев приемки.
- При расхождении между legacy-реализацией и этим ТЗ приоритет имеет данная спецификация и auth-спецификация `docs/specs/auth-authentication-authorization.md`.

## Active Frontend Note / Примечание по активному frontend
- Страница `freight-calculation` считается активной и должна учитываться при детализации endpoint-ов, DTO и сценариев перехода.
- Если для MVP требуется изменение frontend-контракта, это изменение должно быть явно зафиксировано в разделе API с указанием стратегии совместимости.

## 12) Implementation Plan / План реализации
1. Подготовить миграции Flyway для сущностей маршрутов, запросов и `quote`.
2. Реализовать CRUD API для `routes/my` и проверку владения ресурсом.
3. Реализовать API `route-requests` для user и админский read-модуль.
4. Реализовать backend постобработку: расчет country-breakdown и сохранение результата.
5. Реализовать `quote`-workflow (draft/send/history) и статусную модель запроса.
6. Добавить интеграционные тесты RBAC и ownership-проверок.
7. Обновить `docs/system.md` и release notes.

## 13) Acceptance Criteria (Definition of Done) / Критерии приемки
- [ ] Пользователь может сохранить маршрут и увидеть его в своей истории.
- [ ] Пользователь может открыть любой свой сохраненный маршрут.
- [ ] Пользователь не может открыть/изменить маршрут другого пользователя (`403/404` по политике безопасности).
- [ ] Пользователь может отправить запрос на фрахт по сохраненному маршруту.
- [ ] Admin видит список отправленных запросов и может открыть детали маршрута.
- [ ] Admin может создать и отправить `quote`; история предложений доступна.
- [ ] Для запроса сохранен breakdown расстояния по странам.
- [ ] Все проверки доступа соответствуют auth-спецификации.
- [ ] Добавлены и проходят unit/integration тесты для критичных сценариев.
- [ ] Документация обновлена (включая ссылку на auth-спецификацию).

## 14) Test Plan / Тест-план
- **Unit:**
  - Валидация payload маршрута и `quote`.
  - Расчет breakdown по странам на основе route snapshot.
  - Статусные переходы `route_requests` и `quotes`.
- **Integration:**
  - `save route -> open route -> create request`.
  - `admin open request -> create quote -> send quote`.
  - Проверка RBAC (`user` не может использовать admin endpoint-ы).
  - Проверка ownership (`user A` не читает `user B` ресурсы).
- **E2E/Manual:**
  - Полный путь: user сохраняет маршрут и отправляет заявку, admin отправляет предложение.
  - Повторное открытие сохраненного маршрута отображает исходную геометрию.
- **Edge cases / Граничные случаи:**
  - HERE API недоступен во время post-processing.
  - Дублирующая отправка `quote` (идемпотентность).
  - Пустая история маршрутов/запросов.
  - Попытка создать request для несуществующего route.

## 15) Risks and Assumptions / Риски и допущения
- **Risks / Риски:**
  - Рост расходов HERE API при отсутствии кэша и антидребезга.
  - Несогласованность маршрута в UI и backend при повторном пересчете.
  - Ошибки RBAC/ownership приводят к утечке данных между пользователями.
- **Assumptions / Допущения:**
  - Auth-контур из `docs/specs/auth-authentication-authorization.md` внедрен и стабилен.
  - В проекте доступна миграция схемы через Flyway.
  - HERE API доступен и ключ хранится в защищенных настройках.
- **Rollback plan / План отката:**
  - Отключение новых route endpoint-ов через feature flag (если применимо).
  - Откат миграций и релиза до последнего стабильного тега.

## 16) Release Artifacts / Артефакты релиза
- PR: `<add-link>`
- Version/tag / Версия/тег: `<add-version>`
- Release date / Дата релиза: `<add-date>`
- Owner / Ответственный: `<add-owner>`

---

## Instructions for LLM / Инструкции для LLM
1. Если есть неоднозначность, сначала задавай уточняющие вопросы.
2. Реализация должна строго соответствовать Scope/Out of Scope.
3. Проверки `auth`/`RBAC` реализовывать только в соответствии с `docs/specs/auth-authentication-authorization.md`.
4. Перед кодом показывать короткий план.
5. После реализации указать измененные файлы, команды проверки и риски.
6. Не добавлять зависимости без явного обоснования.
7. Для неочевидной логики оставлять короткие и точные комментарии.
