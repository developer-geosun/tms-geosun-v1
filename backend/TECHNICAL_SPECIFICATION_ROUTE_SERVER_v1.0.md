# ТЗ v1.0: MVP сервера расчёта, хранения и обработки маршрутов

Версия документа: `v1.0`

## 1. Цель проекта
Разработать REST API-сервер для:
- расчёта маршрутов грузоперевозок через HERE Routing API;
- хранения заявок и маршрутов в MySQL;
- агрегации длины маршрута по странам;
- предоставления данных маршрутов для frontend и внутренних сервисов.

## 2. Технологический стек
- Язык: `Java 21`
- Framework: `Spring Boot 3.x`
- Сборка: `Maven`
- БД: `MySQL 8.0+`
- Миграции: `Flyway`
- HTTP-клиент к HERE: `Spring WebClient` или `RestClient`
- Документация API: `OpenAPI/Swagger`
- Контейнеризация: `Docker`, `docker-compose`
- Тестирование: `JUnit 5`, `Spring Boot Test`, `Testcontainers` (опционально)

## 3. Функциональные требования

### 3.1 Основные сущности

#### 3.1.1 `RouteRequest` (заявка на расчёт)
- `id` (BIGINT, PK)
- `clientRequestId` (string, обязательное, уникальное)
- `timestamp` (datetime, обязательное)
- `source` (string, обязательное; например `freight-calculation-web`)
- `lang` (enum: `uk`, `ru`, `en`)
- `email` (string, обязательное)
- `phone` (string, обязательное)
- `preferredStartDate` (date, nullable)
- `routeComment` (text, nullable)
- `totalDistanceKm` (decimal(10,3), обязательное)
- `routeText` (text, обязательное; человекочитаемая строка)
- `provider` (string, default `here`)
- `providerRouteId` (string, nullable)
- `durationSec` (int, nullable)
- `trafficDurationSec` (int, nullable)
- `routePolyline` (longtext, nullable; HERE flexible polyline)
- `payloadJson` (json, обязательное; сырой входящий payload)
- `providerResponseJson` (json, nullable; сырой ответ HERE)
- `createdAt` (datetime)
- `updatedAt` (datetime)

#### 3.1.2 `RoutePoint` (точка маршрута)
- `id` (BIGINT, PK)
- `requestId` (FK -> `route_requests.id`)
- `pointOrder` (int, обязательное; порядок точки)
- `pointType` (enum: `start`, `stop`, `finish`, `border`)
- `address` (string, обязательное)
- `countryIso2` (char(2), nullable; формат frontend)
- `countryIso3` (char(3), nullable; формат HERE при наличии)
- `isBorder` (boolean, обязательное)
- `segmentDistanceKmToNext` (decimal(10,3), nullable)
- `lat` (decimal(9,6), обязательное)
- `lng` (decimal(9,6), обязательное)
- `createdAt` (datetime)

#### 3.1.3 `RouteCountryDistance` (агрегация по странам)
- `id` (BIGINT, PK)
- `requestId` (FK -> `route_requests.id`)
- `countryCodeIso3` (char(3), обязательное; из HERE spans.countryCode)
- `distanceM` (bigint unsigned, обязательное)
- `distanceKm` (decimal(10,3), обязательное)
- `createdAt` (datetime)

### 3.2 API-эндпоинты (v1)
Базовый префикс: `/api/v1`

- `POST /routes/calculate` — расчёт маршрута + сохранение результата
- `GET /routes/{clientRequestId}` — получение заявки с точками и агрегатами по странам
- `GET /routes/{clientRequestId}/countries` — длина маршрута по странам
- `GET /routes` — список заявок с фильтрами (`dateFrom`, `dateTo`, `email`, `phone`, `limit`, `offset`)
- `POST /routes/recalculate/{clientRequestId}` — повторный расчёт по сохранённым точкам
- `GET /health` или `/actuator/health` — состояние сервиса

### 3.3 Бизнес-правила расчёта
- Источник расчёта: HERE Routing API v8.
- Обязательные параметры запроса к HERE:
  - `return=summary,polyline`
  - `spans=countryCode,length`
- Для маршрутов с промежуточными точками использовать `via`.
- `totalDistanceKm` на сервере пересчитывается из ответа HERE (не доверять клиентскому значению как источнику истины).
- Длина маршрута по странам считается суммированием:
  - `sections[].spans[].length` группировкой по `countryCode`.
- Значения дистанции:
  - базово хранить в метрах (`distanceM`);
  - для отображения — `distanceKm` с округлением до 3 знаков.
- При повторном перерасчёте сохранять новый снимок `providerResponseJson`, обновлять агрегаты и поля summary.

## 4. Нефункциональные требования

### 4.1 Производительность
- Среднее время ответа `POST /routes/calculate`: до 1000 мс без учёта сетевой задержки внешнего API.
- Поддержка минимум 50 RPS на чтение и 10 RPS на расчёт при локальной нагрузке.
- Пагинация обязательна для списка маршрутов.

### 4.2 Надёжность
- Валидация входных данных на сервере.
- Единый формат ошибок.
- Идемпотентность по `clientRequestId`:
  - повтор с тем же `clientRequestId` не создаёт дубликат.

### 4.3 Безопасность
- API защищён JWT (кроме health и, при необходимости, публичного create endpoint по отдельному решению).
- Ограничение размера входного payload.
- Rate limiting для `POST /routes/calculate`.
- Запрещено логировать персональные и чувствительные данные полностью (email/phone маскировать по политике проекта).

### 4.4 Логирование и мониторинг
- Логи в формате `JSON`.
- `requestId` обязателен.
- Метрики:
  - время вызова HERE API,
  - количество успешных/ошибочных расчётов,
  - распределение кодов ответов.
- Health endpoint обязателен.

## 5. Контракты API

### 5.1 Пример запроса `POST /routes/calculate`
```json
{
  "clientRequestId": "MBY8CW4Q7F3A1K2L",
  "timestamp": "2026-04-25T09:15:33.123Z",
  "source": "freight-calculation-web",
  "lang": "ru",
  "email": "user@example.com",
  "phone": "+380XXXXXXXXX",
  "preferredStartDate": "2026-04-28",
  "routeComment": "Срочная перевозка",
  "points": [
    {
      "order": 1,
      "type": "start",
      "address": "Kyiv, Ukraine",
      "lat": 50.4501,
      "lng": 30.5234,
      "country": "ua",
      "isBorder": false,
      "segmentDistanceKmToNext": null
    },
    {
      "order": 2,
      "type": "border",
      "address": "Krakivets border checkpoint",
      "lat": 49.9367,
      "lng": 23.1222,
      "country": "ua",
      "isBorder": true,
      "segmentDistanceKmToNext": null
    },
    {
      "order": 3,
      "type": "finish",
      "address": "Warsaw, Poland",
      "lat": 52.2297,
      "lng": 21.0122,
      "country": "pl",
      "isBorder": false,
      "segmentDistanceKmToNext": null
    }
  ]
}
```

### 5.2 Пример успешного ответа `POST /routes/calculate`
```json
{
  "clientRequestId": "MBY8CW4Q7F3A1K2L",
  "provider": "here",
  "totalDistanceKm": 812.457,
  "durationSec": 38921,
  "trafficDurationSec": 42107,
  "countries": [
    { "countryCodeIso3": "UKR", "distanceKm": 512.104 },
    { "countryCodeIso3": "POL", "distanceKm": 300.353 }
  ],
  "routePolyline": "BFoz5xJ67i1B1B7PzIhaxL7Y...",
  "createdAt": "2026-04-25T09:15:34.010Z"
}
```

### 5.3 Единый формат ошибки
```json
{
  "timestamp": "2026-04-25T09:20:00Z",
  "status": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Points must contain at least start and finish",
  "path": "/api/v1/routes/calculate"
}
```

### 5.4 Справочник `code` (минимальный)
- `VALIDATION_ERROR` — невалидный вход
- `DUPLICATE_CLIENT_REQUEST_ID` — заявка с таким `clientRequestId` уже есть
- `ROUTE_PROVIDER_UNAVAILABLE` — HERE недоступен/таймаут
- `ROUTE_PROVIDER_BAD_RESPONSE` — некорректный ответ HERE
- `ROUTE_NOT_FOUND` — маршрут не найден
- `UNAUTHORIZED` — нет/невалидный JWT
- `FORBIDDEN` — недостаточно прав
- `RATE_LIMIT_EXCEEDED` — превышен лимит запросов

## 6. Валидация данных
- `clientRequestId`: обязательно, длина 8..64, уникально.
- `email`: обязательно, формат email.
- `phone`: обязательно, формат по regex проекта.
- `points`: минимум 2 точки.
- `points.order`: строго возрастающая последовательность без пропусков.
- `lat`: диапазон `[-90; 90]`.
- `lng`: диапазон `[-180; 180]`.
- `type`:
  - первая точка — `start`,
  - последняя — `finish`,
  - промежуточные — `stop` или `border`.
- При ошибках валидации возвращать `400 Bad Request`.

## 7. Архитектура и структура кода
Слои:
- `controller` — HTTP слой
- `service` — бизнес-логика маршрутов
- `integration/here` — клиент HERE API
- `repository` — доступ к БД
- `dto` — контракты API
- `mapper` — преобразование DTO <-> entity
- `exception` — глобальная обработка ошибок
- `security` — конфигурация доступа

Принципы:
- Не возвращать entity напрямую.
- DTO + mapper обязательно.
- Транзакционность при сохранении `route_requests` + `route_points` + `route_country_distances`.
- Внешние вызовы HERE с таймаутами, retry (ограниченно) и circuit breaker (желательно).

## 8. База данных (MySQL)

### 8.1 Таблица `route_requests`
- Индексы:
  - `UNIQUE(client_request_id)`
  - `INDEX(created_at)`
  - `INDEX(email)`
  - `INDEX(phone)`

### 8.2 Таблица `route_points`
- Индексы:
  - `UNIQUE(request_id, point_order)`
  - `INDEX(point_type)`
- FK:
  - `request_id -> route_requests.id` (`ON DELETE CASCADE`)

### 8.3 Таблица `route_country_distances`
- Индексы:
  - `UNIQUE(request_id, country_code_iso3)`
  - `INDEX(country_code_iso3)`
- FK:
  - `request_id -> route_requests.id` (`ON DELETE CASCADE`)

### 8.4 Правила миграций
- Все изменения схемы — только через `Flyway`.
- Обязательные миграции:
  - создание 3 таблиц;
  - индексы и FK;
  - baseline и rollback-стратегия по регламенту проекта.

## 9. Тестирование

### 9.1 Обязательные тесты
- Unit:
  - агрегация длины по странам из HERE `spans`;
  - валидация входного payload;
  - маппинг DTO -> entity.
- Интеграционные:
  - `POST /routes/calculate` (200/400/409/429/503);
  - `GET /routes/{clientRequestId}` (200/404);
  - `GET /routes/{clientRequestId}/countries` (200/404);
  - `POST /routes/recalculate/{clientRequestId}` (200/404/503).
- Контрактные:
  - проверка формата ошибок и `code`.
- Интеграция с HERE:
  - mock/stub внешнего API;
  - обработка таймаута/5xx/пустого маршрута.

### 9.2 Критерии покрытия
- Минимум 70% по пакетам `service`, `controller`, `integration/here`.

## 10. DevOps и запуск

### 10.1 Локальный запуск
`docker-compose` поднимает:
- `app`
- `mysql`

Переменные окружения:
- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `SERVER_PORT`
- `HERE_API_KEY`
- `HERE_BASE_URL` (по умолчанию `https://router.hereapi.com`)
- `HERE_TIMEOUT_MS` (например `5000`)
- `RATE_LIMIT_ROUTE_CALCULATE_MAX_REQUESTS`
- `RATE_LIMIT_ROUTE_CALCULATE_WINDOW_SECONDS`

### 10.2 CI
Этапы:
- `build`
- `test`
- `package`

Желательно:
- проверка линтинга/форматирования
- публикация OpenAPI-артефакта

## 11. Открытые решения (утвердить до старта)
- Нужен ли async-режим расчёта (очередь + polling) для тяжёлых маршрутов?
- Нужна ли версионизация маршрута (хранить историю перерасчётов)?
- Политика хранения `providerResponseJson` (срок, архивирование, обезличивание).

## 12. Критерии приёмки
- Реализованы endpoints из раздела 3.2.
- Корректно считается и возвращается длина маршрута по странам.
- Маршрут и точки сохраняются в MySQL, дубликаты по `clientRequestId` не создаются.
- Flyway-миграции применяются автоматически.
- Swagger содержит все контракты и ошибки.
- Тесты проходят (`mvn test`).
- Сервис поднимается через `docker-compose up`.
- Healthcheck возвращает `UP`.

## 13. Оценка сроков (MVP)
- Каркас проекта + БД + миграции: 1 день
- HERE интеграция + расчёт + агрегация по странам: 1.5-2 дня
- API + валидация + обработка ошибок: 1 день
- Тесты + Swagger + docker-compose: 1 день
- Итого: **4.5-5 дней**
