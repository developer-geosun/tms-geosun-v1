# ТЗ: сценарий себестоимости, дороги Европы, маржа и курсы НБУ

## Правила языка документа
- Основной язык: **RU** (термины API/кода: английский по принятому в проекте стилю).
- **Правила расчёта (формулы, статьи затрат, v1):** [`freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md`](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md) — **источник истины** для детерминированного калькулятора; при расхождении с этим ТЗ приоритет у файла правил.
- Связанные документы: `currencies-reference.md`, `routes-server-workflow-and-freight-quoting.md`, `route-immutability-list-filters-deferred-country-breakdown.md`, `route-point-operations-rules.md`, `auth-authentication-authorization.md`, `system.md`.
- **Другой вариант расчёта (уже в проекте):** `freight-calculation-gemini-scenarios.md` — текстовые сценарии и Gemini; **не отменяется**, работает параллельно.

## 1. Цель
**Дополнительный** вариант расчёта: дать **ADMIN** и **MANAGER** воспроизводимый **серверный** (без ИИ) расчёт себестоимости и формирование **quote** по заявке:
- параметры — в **сценарии** в БД (ADMIN/MANAGER задают при CRUD; при расчёте — выбор `scenarioId` + снимок на дату);
- конвертация — **курсы НБУ из БД** на `calculationDate` (§6);
- формулы — по [файлу правил](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md).

Геометрия — **snapshot маршрута заявки**, без dispatch point.

## 2. Контекст
- Есть: `Route`, `RouteRequest`, `FreightQuote`, admin API заявок, роли `ADMIN` / `MANAGER` / `USER`.
- **Уже реализовано:** расчёт через Gemini и справочник **текстовых** сценариев (`FreightCalculationScenario` с `rulesText`) — см. `freight-calculation-gemini-scenarios.md`.
- **Этот ТЗ:** второй контур — **числовые** сценарии в БД, формульный калькулятор, те же заявки/quote; отдельные API/экраны или расширение карточки заявки (уточнить при реализации).
- Курсы НБУ: `currency_nbu_rates`, sync/чтение — `currencies-reference.md`; **не дублировать** API НБУ в расчёте фрахта.
- **MANAGER = ADMIN** для CRUD сценариев, расчёта и отправки quote по этому варианту (§8).

## 3. Область работ (In scope)
1. CRUD **сценариев** (поля §5) и выбор сценария по заявке (снимок в расчёте/quote).
2. **Расчёт себестоимости** по [правилам](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md), JSON **breakdown**, аудит входов.
3. **Country breakdown** и дороги EU — только после `scenarioId` (§3.1).
4. **Курсы НБУ** на `calculationDate` (§6).

### 3.1 Порядок операций
- `POST /api/v1/route-requests` **не** запускает breakdown (`route-immutability-list-filters-deferred-country-breakdown.md` §3.3).
- Breakdown и расчёт — **только с `scenarioId`**; смена сценария **инвалидирует** старый breakdown.
- Без breakdown дорог — расчёт **не выполняется** (см. файл правил).

## 4. Вне области (Out of scope)
- Точка 0 / dispatch point; бухучёт, НДС; автовыбор маршрута; прогноз курса; вызов API НБУ из потока расчёта.

## 5. Модель сценария (`FreightCalculationScenario`)

Серверная сущность: `id`, `name`, `isActive`, аудит. Числовые поля **задаёт ADMIN/MANAGER**; эталон v1 — в [правилах](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md).

| Параметр | Единица | Назначение |
|----------|---------|------------|
| `fuelConsumptionEmptyLPer100km` | л/100 км | Расход порожний |
| `fuelConsumptionLoadedNonWinterLPer100km` | л/100 км | Расход гружёный, не зима |
| `fuelConsumptionLoadedWinterLPer100km` | л/100 км | Расход гружёный, зима |
| `seasonMode` | enum | `WINTER` / `NON_WINTER` / `AUTO` |
| `fuelPricePerLiter` | UAH/л | Цена топлива |
| `driverSalaryPercentOfFreight` | % | ЗП от итогового фрахта (`PERCENT_OF_FINAL_FREIGHT`) |
| `perDiemUsdPerDay` | валюта/день | Суточные (в v1 — EUR/день, см. правила) |
| `perDiemRouteDivisorKm` | км | Делитель для дней (дефолт 600) |
| `perDiemFixedExtraDays` | дни | Добавка (дефолт +2) |
| `marginType` | enum | `PERCENT_OF_COST_BEFORE_MARGIN` / `FIXED_PER_TRIP` |
| `marginPercent` | % | Маржа от себестоимости до маржи (с ЗП) |
| `marginFixedAmount` | сумма | При `FIXED_PER_TRIP` |
| `proposalCurrency` | ISO 4217 | Валюта quote (часто EUR) |

Справочник дорог: **`CountryTollRule`** (CRUD отдельно; ставки v1 — в файле правил).

## 6. Курсы НБУ
- Источник: `currency_nbu_rates`; sync — `POST /api/v1/admin/currencies/nbu-rates/sync` (`currencies-reference.md`).
- Перед расчётом ADMIN/MANAGER обновляет курсы на **`/admin/currencies`**; расчёт **не** вызывает API НБУ.
- На `calculationDate`: нет снимка → **`422`** `NBU_RATES_NOT_AVAILABLE_FOR_DATE`.
- Кросс: `A/B = ratePerUnit_A / ratePerUnit_B`; в breakdown — снимок курсов.

## 7. Данные и аудит
- **`FreightCostCalculation`** / **`FreightQuote`**: `route_request_id`, `scenario_id`, `calculation_date`, снимок сценария, JSON breakdown, длины, `driver_salary_basis` — перечень полей breakdown см. [правила](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md) § «Аудит».

## 8. API (черновик)

### 8.1 RBAC
| Операция | ADMIN | MANAGER | USER |
|----------|-------|---------|------|
| CRUD `/api/v1/admin/freight-scenarios` | ✓ | ✓ | — |
| `country-breakdown`, `cost-preview`, quote | ✓ | ✓ | — |
| Sync/просмотр курсов НБУ | ✓ | ✓ | — |

### 8.2 Endpoints
- `GET|POST|PUT|PATCH|DELETE /api/v1/admin/freight-scenarios` (+ `{id}`).
- `GET|POST|PUT|PATCH|DELETE /api/v1/admin/country-toll-rules`.
- `POST .../route-requests/{id}/country-breakdown` — тело: **`scenarioId`**.
- `POST .../route-requests/{id}/cost-preview` — `scenarioId`, `calculationDate`, `seasonOverride?`.
- `POST .../route-requests/{id}/quotes` — формирование quote.
- Курсы: `GET /api/v1/admin/currencies/nbu-rates`, `POST .../nbu-rates/sync`.

## 9. Frontend (Angular Material)
- Заявка: сценарий → breakdown → `calculationDate`, курсы → таблица стран → preview/quote в `proposalCurrency`.
- Нет курсов на дату — переход на **`/admin/currencies`**.
- Экраны: **сценарии расчёта**, **тарифы дорог**.

## 10. Критерии приёмки
- [ ] MANAGER = ADMIN для сценариев, расчёта, quote.
- [ ] Breakdown и расчёт только с `scenarioId`; смена сценария инвалидирует breakdown.
- [ ] Реализация формул и эталонных сумм — по [файлу правил](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md) (интеграционные тесты с фиксированными курсами и длинами).
- [ ] Курсы из БД на `calculationDate`; без снимка — `422`.
- [ ] Геометрия и запрет расчёта без breakdown — как в файле правил.

## 11. Принятые решения (архитектура)

| # | Тема | Решение |
|---|------|---------|
| 11.1 | Формулы и дефолты v1 | [`freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md`](./freight-trip-cost-calculation-rules-margin30-ua8150-driverpct.md) |
| 11.2 | MANAGER и quote | MANAGER = ADMIN: создание, редактирование, **отправка** quote |
| 11.3 | Курсы НБУ | На `calculationDate` из БД; обновление только через `/admin/currencies` |
| 11.4 | Параметры сценария | Задаёт ADMIN/MANAGER в CRUD; в расчёте — значения выбранного сценария + снимок |

---
*Версия документа: 1.0. Дополнительный вариант расчёта; Gemini-вариант остаётся по `freight-calculation-gemini-scenarios.md`.*
