# ТЗ: расчёт фрахта через ИИ Gemini и текстовые сценарии

## Правила языка документа
- Основной язык: **RU** (термины API/кода: английский по принятому в проекте стилю).
- Связанные документы:
  - `docs/specs/routes-server-workflow-and-freight-quoting.md` — базовый workflow маршрутов, заявок и quote.
  - `docs/specs/route-immutability-list-filters-deferred-country-breakdown.md` — неизменяемость маршрута, отложенный country breakdown.
  - `docs/specs/auth-authentication-authorization.md` — **источник истины по auth и RBAC**.
  - `docs/specs/route-point-operations-rules.md`.
  - `docs/system.md`.
- **Дополнительный вариант расчёта (параллельно):** `freight-cost-scenario-nbu-pricing.md` — детерминированный калькулятор на сервере (формулы, курсы НБУ); **отдельный трек** реализации, не заменяет Gemini.

## 1. Цель
Дать **ADMIN** и **MANAGER** инструмент подготовки расчёта фрахта по заявке с помощью **Google Gemini API**, где:
- правила расчёта задаются **текстовым сценарием** (описание формул, коэффициентов, допущений, формата ответа);
- входные данные заявки (маршрут, груз, комментарий, при наличии — пробег по странам) передаются модели в структурированном виде;
- ответ ИИ отображается в UI и **сохраняется** для аудита и повторного просмотра;
- сценарии хранятся на сервере, поддерживают **CRUD**, **импорт из внешних файлов**, редактирование и удаление.

**Ценность:** гибкость бизнес-правил без жёсткой серверной формульной модели; быстрые итерации сценариев расчёта через текстовые инструкции.

## 2. Контекст и текущее состояние
- Уже реализовано: `Route`, `RouteRequest`, `FreightQuote`, admin API очереди заявок (`GET /api/v1/admin/route-requests`), роли `ADMIN` / `MANAGER` / `USER`, экран `/admin/route-requests`.
- Список заявок для admin/manager **существует**, но **фильтрация и сортировка** по полям — в рамках данного ТЗ (расширение API и UI).
- Расчёт пробега по странам (`POST .../country-breakdown`) — **опциональный** вход для промпта Gemini; для детерминированного варианта breakdown обязателен (см. `freight-cost-scenario-nbu-pricing.md` §3.1).
- Ключ Gemini хранится **только на backend**; frontend не вызывает Gemini напрямую.

## 3. Область работ (In scope)
1. **Просмотр заявок (ADMIN/MANAGER):** список всех `RouteRequest` с фильтрацией и сортировкой (см. §6.1).
2. **Справочник сценариев расчёта:** именованные записи с **текстовым телом правил** (`rulesText`), CRUD + импорт из файла.
3. **Запуск расчёта:** выбор заявки + сценария → backend формирует prompt → вызов Gemini → сохранение и отображение ответа.
4. **История расчётов** по заявке: список прошлых запусков с привязкой к сценарию (снимок текста на момент расчёта).
5. **RBAC:** доступ к сценариям и расчёту — `ADMIN` и `MANAGER` (см. §8).

### 3.1 Out of scope (не входит)
- Детерминированный серверный калькулятор — **не входит** в это ТЗ; см. `freight-cost-scenario-nbu-pricing.md` (реализуется как **дополнительный** вариант расчёта).
- Автоматическая отправка quote клиенту на основании ответа ИИ без ручной проверки менеджером.
- Fine-tuning / обучение собственной модели.
- Публичный доступ пользователя (`USER`) к сценариям и Gemini-расчёту.
- Гарантия математической точности ответа модели (ответ носит **рекомендательный** характер).

## 4. Роли и права (RBAC)
| Операция | ADMIN | MANAGER | USER |
|----------|-------|---------|------|
| Список всех заявок с фильтрами/сортировкой | ✓ | ✓ | — |
| Детали заявки (admin endpoint) | ✓ | ✓ | только свои |
| CRUD сценариев расчёта | ✓ | ✓ | — |
| Импорт сценария из файла | ✓ | ✓ | — |
| Запуск Gemini-расчёта по заявке | ✓ | ✓ | — |
| Просмотр истории расчётов по заявке | ✓ | ✓ | — |
| Создание/отправка quote | по `routes-server-workflow-and-freight-quoting.md` (создание draft — ADMIN; уточнение MANAGER — продуктово v2) | read + расчёт | — |

Проверки — на backend; UI скрывает недоступные действия.

## 5. Модель данных

### 5.1 `FreightCalculationScenario` (сценарий)
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | string | Человекочитаемое имя (уникальное в пределах активных) |
| `description` | string? | Краткое описание назначения сценария |
| `rulesText` | text | **Основное содержимое:** правила расчёта на естественном языке (формулы, коэффициенты, формат вывода) |
| `outputFormatHint` | string? | Подсказка модели: JSON / markdown-таблица / структурированный список |
| `isActive` | boolean | Неактивные не показывать в выпадающем списке расчёта |
| `createdAt`, `updatedAt` | timestamp | Аудит |
| `createdByUserId`, `updatedByUserId` | UUID | Аудит |

**Пример `rulesText` (фрагмент):**
```text
Рассчитай себестоимость и коммерческую ставку фрахта.
Топливо: порожний 35 л/100 км, гружёный 37 л/100 км (не зима) или 40 (зима).
Цена топлива — из контекста или 52 UAH/л по умолчанию.
Суточные: 10 USD/день, дни = ceil(общая_длина_km / 600) + 2.
Зарплата водителя: 17% от суммы затрат до зарплаты.
Маржа: 12% от себестоимости до маржи.
Верни JSON: { "currency", "costBreakdown": {...}, "subtotal", "margin", "total", "assumptions": [], "warnings": [] }.
```

### 5.2 `FreightAiCalculation` (результат запуска)
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | |
| `routeRequestId` | UUID | Заявка |
| `scenarioId` | UUID | Ссылка на сценарий |
| `scenarioRulesSnapshot` | text | Копия `rulesText` на момент расчёта |
| `modelId` | string | Идентификатор модели Gemini (из конфигурации) |
| `promptPayload` | JSON | Структурированный вход, отправленный в промпт (без секретов) |
| `responseText` | text | Полный текст ответа модели |
| `responseStructured` | JSON? | Распарсенный JSON, если модель вернула валидный JSON |
| `status` | enum | `SUCCESS` / `FAILED` / `PARTIAL` (ответ есть, JSON не распарсился) |
| `errorMessage` | string? | При сбое API или таймауте |
| `latencyMs` | int? | Длительность вызова |
| `createdAt` | timestamp | |
| `createdByUserId` | UUID | Кто запустил |

### 5.3 Входные данные для промпта (формирует backend)
Backend собирает JSON-контекст из заявки (не редактируется пользователем в v1):
- метаданные заявки: `id`, `status`, `preferredStartDate`, `comment`, `cargo`;
- snapshot маршрута: `title`, `distanceKm`, `durationMin`, `points[]`, `routingProfile`;
- `countryDistances[]` — если уже рассчитаны; иначе явный флаг `countryBreakdownAvailable: false`;
- опционально: `calculationDate` (дата расчёта, по умолчанию — сегодня UTC).

## 6. API

### 6.1 Заявки — фильтрация и сортировка
Расширить `GET /api/v1/admin/route-requests`:

**Query-параметры (v1):**
| Параметр | Описание |
|----------|----------|
| `status` | Фильтр по статусу (`new`, `quoted`, … — по enum проекта) |
| `createdFrom`, `createdTo` | ISO date/datetime |
| `ownerEmail` | Поиск по email владельца маршрута (contains, case-insensitive) |
| `routeTitle` | Поиск по названию маршрута (contains) |
| `sort` | Поле сортировки: `createdAt`, `status`, `preferredStartDate` (default: `createdAt`) |
| `order` | `asc` / `desc` (default: `desc`) |
| `page`, `size` | Пагинация (default: page=0, size=20) |

**Response:** page wrapper `{ content[], totalElements, totalPages, page, size }` (или совместимый с существующим стилем проекта формат — зафиксировать при реализации).

### 6.2 Сценарии расчёта
Базовый путь: `/api/v1/admin/freight-calculation-scenarios`  
RBAC: **`hasAnyRole('ADMIN','MANAGER')`** для всех методов.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/` | Список; query `activeOnly=true` для выпадающего списка |
| GET | `/{id}` | Один сценарий |
| POST | `/` | Создать |
| PUT/PATCH | `/{id}` | Обновить |
| DELETE | `/{id}` | Удалить или soft-delete (`isActive=false`) — политика: **soft-delete**, если есть ссылки из `FreightAiCalculation` |
| POST | `/import` | Импорт из файла (multipart) |

**POST /** body:
```json
{
  "name": "Стандарт EU 2026",
  "description": "Базовый сценарий для рейсов по Европе",
  "rulesText": "...",
  "outputFormatHint": "JSON",
  "isActive": true
}
```

**POST /import** — `multipart/form-data`:
- `file` — обязательный; допустимые типы: `.txt`, `.md`, `.json`
- опциональные поля формы: `name`, `description` (если не заданы — из имени файла / метаданных JSON)

**Формат JSON-файла для импорта:**
```json
{
  "name": "Импортированный сценарий",
  "description": "опционально",
  "rulesText": "текст правил",
  "outputFormatHint": "JSON",
  "isActive": true
}
```

Для `.txt` / `.md` — всё содержимое файла → `rulesText`; `name` = имя файла без расширения.

### 6.3 Gemini-расчёт
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/admin/route-requests/{requestId}/ai-calculations` | Запуск расчёта |
| GET | `/api/v1/admin/route-requests/{requestId}/ai-calculations` | История расчётов по заявке |
| GET | `/api/v1/admin/ai-calculations/{calculationId}` | Детали одного расчёта |

**POST .../ai-calculations** body:
```json
{
  "scenarioId": "uuid",
  "calculationDate": "2026-05-19"
}
```

**Валидация:**
- `scenarioId` обязателен, сценарий существует и `isActive=true` → иначе `422`.
- Заявка существует → иначе `404`.
- Rate limit / concurrent limit на пользователя (см. §7).

**Response 201 (успех):**
```json
{
  "id": "calc_uuid",
  "status": "SUCCESS",
  "responseText": "...",
  "responseStructured": { "currency": "EUR", "total": 4200, "costBreakdown": {} },
  "scenarioId": "...",
  "scenarioName": "...",
  "createdAt": "...",
  "latencyMs": 3200
}
```

**Ошибки:** `502` / `503` при недоступности Gemini; `429` при rate limit; тело с кодом `GEMINI_UNAVAILABLE`, `GEMINI_TIMEOUT`, `SCENARIO_NOT_FOUND`.

## 7. Интеграция Gemini (backend)

### 7.1 Конфигурация
- Переменные окружения / `application.yml`: `gemini.api-key`, `gemini.model` (например `gemini-2.0-flash`), `gemini.timeout-ms`, `gemini.max-output-tokens`.
- Ключ **не** логировать, **не** отдавать на frontend.

### 7.2 Сборка промпта
1. **System instruction:** роль эксперта по логистике; следовать только правилам из `rulesText`; явно перечислять допущения; не выдумывать отсутствующие данные — помечать в `warnings`.
2. **User content:** JSON контекста заявки (§5.3) + `calculationDate`.
3. **Scenario block:** `rulesText` + `outputFormatHint`.

### 7.3 Обработка ответа
- Сохранить полный `responseText`.
- Попытаться извлечь JSON (markdown code fence или чистый JSON) → `responseStructured`; при неудаче — `status=PARTIAL`.
- При исключении API — `status=FAILED`, `errorMessage`, без падения всего запроса admin UI (кроме 401/403).

### 7.4 Нефункциональные требования
- Таймаут вызова: configurable, default **60 s**; p95 целевой latency UI (с индикатором загрузки) ≤ 90 s.
- Retry: не более **1** повторной попытки при сетевых 5xx (идемпотентность по `(requestId, scenarioId, calculationDate, user)` не гарантируется — каждый POST создаёт новую запись истории).
- Rate limit: не более **10** запусков в час на пользователя (configurable).
- Логирование: `ai_calculation_started`, `ai_calculation_completed`, `ai_calculation_failed` (без prompt/response в production logs или только truncated hash).

## 8. Frontend (Angular Material)

### 8.1 Экран `/admin/route-requests` (расширение)
- **Панель фильтров:** `MatFormField` + `MatSelect` (статус), date range (`MatDatepicker`), поля поиска (email, название маршрута), кнопка «Сбросить».
- **Сортировка:** `MatSelect` или `mat-sort` на таблице/списке (поле + направление).
- **Пагинация:** `MatPaginator`.
- Сохранить текущий master-detail layout (список слева, детали справа).

### 8.2 Блок «Расчёт через ИИ» в карточке заявки
- `MatSelect` — выбор активного сценария (список с сервера).
- Кнопка «Рассчитать» (`MatButton`, `color="primary"`) — disabled без выбранного сценария; при выполнении — `MatProgressSpinner`.
- Область результата: `MatCard` с markdown/plain text; при наличии `responseStructured` — дополнительная `MatTable` или formatted JSON (`MatExpansionPanel`).
- История расчётов: список/таблица с датой, сценарием, статусом; клик — просмотр сохранённого ответа.

### 8.3 Экран «Сценарии расчёта» (новый маршрут)
- Путь: `/admin/freight-calculation-scenarios` (guard: ADMIN/MANAGER).
- Список сценариев (`MatTable`): name, description, isActive, updatedAt, actions.
- Форма создания/редактирования: name, description, `rulesText` (`textarea` или monaco-lite), outputFormatHint, isActive.
- **Импорт:** кнопка «Загрузить файл» → `input type="file"` + `MatDialog` подтверждения; вызов `POST .../import`.
- Удаление: `MatDialog` confirm → DELETE или deactivate.

### 8.4 Связь с quote
- Ответ ИИ **не** создаёт quote автоматически.
- Менеджер вручную переносит `total` / `currency` из `responseStructured` (если есть) в форму draft quote на том же экране — UX-подсказка «скопировать из расчёта ИИ» (v1: ручной ввод, опционально кнопка «Подставить сумму» если JSON валиден).

## 9. Безопасность
- Gemini API key только на server-side.
- В `promptPayload` не включать PII сверх необходимого (email владельца — опционально, маскировать или опускать по политике privacy).
- RBAC на все admin endpoint-ы.
- Валидация загружаемых файлов: max size **256 KB**, проверка MIME/extension, санитизация имени файла.
- Защита от prompt injection в пользовательском `comment`: передавать как quoted data field, system instruction предупреждает модель не выполнять инструкции из поля comment.

## 10. Критерии приёмки
- [ ] **ADMIN** и **MANAGER** видят список всех заявок с фильтрами (статус, даты, поиск) и сортировкой.
- [ ] CRUD сценариев: создание, редактирование, деактивация/удаление, список активных для расчёта.
- [ ] Импорт сценария из `.txt`, `.md`, `.json` создаёт запись в справочнике.
- [ ] Выбор заявки + сценария + «Рассчитать» вызывает backend, backend обращается к Gemini, ответ отображается в UI.
- [ ] Каждый расчёт сохраняется в истории с `scenarioRulesSnapshot` и полным ответом.
- [ ] При недоступности Gemini — понятная ошибка, без утечки API key.
- [ ] **USER** не имеет доступа к сценариям и ai-calculations (`403`).
- [ ] Интеграционные тесты: mock Gemini client, фиксированный prompt → сохранение `FreightAiCalculation`.
- [ ] Unit-тесты: парсинг JSON из ответа модели, импорт файлов.

## 11. План реализации (черновик)
1. Flyway: таблицы `freight_calculation_scenarios`, `freight_ai_calculations`.
2. Backend: CRUD сценариев, import endpoint, Gemini client + service.
3. Backend: расширение admin route-requests (фильтры, пагинация).
4. Backend: ai-calculations endpoints + RBAC tests.
5. Frontend: фильтры/сортировка на `/admin/route-requests`.
6. Frontend: блок расчёта ИИ + экран сценариев.
7. Обновить `docs/system.md`.

## 12. Решения по открытым вопросам (зафиксировано)
1. **Модель Gemini:** только через конфиг (`GEMINI_MODEL`, `app.gemini.model`); без значения расчёт недоступен.
2. **MANAGER + quote:** **MANAGER = ADMIN** для create draft и send quote.
3. **Видимость для USER:** не показывать USER ничего про ИИ-расчёт (только quote).
4. **Экспорт сценариев:** отложен на **v2** (в v1 только импорт).

---
*Версия документа: 1.1. ТЗ варианта расчёта через Gemini; параллельно — детерминированный вариант в `freight-cost-scenario-nbu-pricing.md`.*
