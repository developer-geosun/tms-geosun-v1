# Инструкция: ключи Gemini API для TMS GeoSun

> **Устарело.** Backend переведён на **Vertex AI** (service account + Cloud Billing).  
> Актуальная инструкция: **[`vertex-ai-setup.md`](./vertex-ai-setup.md)**.

## Важно: PRO в чате ≠ API-ключ автоматически

| Продукт | Где | Для чего |
|---------|-----|----------|
| **Gemini PRO** (подписка) | [gemini.google.com](https://gemini.google.com) | Веб-чат (1.5 Flash / 1.5 Pro в браузере) |
| **Gemini API** | [Google AI Studio](https://aistudio.google.com) | Программный доступ (**backend** TMS GeoSun) |

Подписка **Gemini PRO** **не выдаёт** API-ключ. Для расчёта фрахта нужен ключ из **Google AI Studio** (можно тот же Google-аккаунт).

Официальная документация: [Gemini API — API keys](https://ai.google.dev/gemini-api/docs/api-key)

**Где хранятся настройки в проекте:** корневой файл **`.env`** (шаблон — [`.env.example`](../.env.example)). Ключ **не** попадает во frontend.

---

## Шаг 1. Открыть Google AI Studio

1. Перейдите: **https://aistudio.google.com**
2. Войдите Google-аккаунтом (тем же, что для Gemini PRO, если удобно).

---

## Шаг 2. Создать API-ключ

1. Раздел **«API keys»** / **«Ключи API»**: **https://aistudio.google.com/app/apikey**
2. **«Create API key»** / **«Создать ключ API»**.
3. **Create API key in new project** (или существующий проект Google Cloud).
4. **Скопируйте ключ сразу** (`AIzaSy...`) — полный текст показывают один раз.

Не публикуйте ключ в git, чатах и скриншотах.

---

## Шаг 3. Выбрать модель (`GEMINI_MODEL`)

Backend читает имя модели из переменной **`GEMINI_MODEL`** → `app.gemini.model` в [`backend/src/main/resources/application.yml`](../backend/src/main/resources/application.yml).

| Модель в чате | Типичный ID для API |
|---------------|---------------------|
| Gemini 2.5 Flash (рекомендуется) | `gemini-2.5-flash` |
| Gemini 2.5 Pro | `gemini-2.5-pro` |
| Gemini 2.0 Flash (устаревает) | `gemini-2.0-flash` |

Актуальный список: [Gemini models](https://ai.google.dev/gemini-api/docs/models). В AI Studio: **Playground** → имя модели для API.

В [`.env.example`](../.env.example) по умолчанию указано `GEMINI_MODEL=gemini-2.5-flash`.

---

## Шаг 4. Прописать ключи в `.env`

### 4.1 Создать `.env` из шаблона

Из **корня репозитория** `tms-geosun-v1`:

**Linux / macOS / Git Bash:**
```bash
cp .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

### 4.2 Блок Gemini в `.env`

Минимум для работы ИИ-расчёта (остальное — с дефолтами из шаблона):

```env
GEMINI_API_KEY=AIzaSyВАШ_КЛЮЧ
GEMINI_MODEL=gemini-1.5-flash
```

Полный блок в [`.env.example`](../.env.example):

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GEMINI_TIMEOUT_MILLIS=60000
GEMINI_MAX_OUTPUT_TOKENS=8192
GEMINI_RATE_LIMIT_PER_HOUR=10
```

| Переменная | В `.env.example` | В `application.yml` (fallback) | Назначение |
|------------|-------------------|--------------------------------|------------|
| `GEMINI_API_KEY` | пусто | пусто | **Обязательна** для расчёта |
| `GEMINI_MODEL` | `gemini-1.5-flash` | пусто | **Обязательна** для расчёта |
| `GEMINI_TIMEOUT_MILLIS` | `60000` | `60000` | Таймаут вызова API, мс |
| `GEMINI_MAX_OUTPUT_TOKENS` | `8192` | `8192` | Лимит длины ответа |
| `GEMINI_RATE_LIMIT_PER_HOUR` | `10` | `10` | Лимит запусков на пользователя в час |

Файл **`.env`** уже в [`.gitignore`](../.gitignore) — не коммитьте его.

### 4.3 Запуск с Docker Compose (рекомендуется)

Docker Compose **читает `.env` в корне проекта** и передаёт переменные в сервис **`backend`** ([`docker-compose.yml`](../docker-compose.yml), [`backend/docker-compose.yml`](../backend/docker-compose.yml)).

```bash
# из корня репозитория
docker compose up -d --build backend
```

После изменения `.env` пересоздайте backend:

```bash
docker compose up -d --force-recreate backend
```

Подробнее о стеке: [`RUN.md`](../RUN.md).

### 4.4 Локальный Spring Boot без Docker

Spring Boot **не загружает** `.env` сам. Варианты:

**A.** Экспорт в сессию (PowerShell), затем `mvn spring-boot:run` в `backend/`:

```powershell
$env:GEMINI_API_KEY = "AIzaSyВАШ_КЛЮЧ"
$env:GEMINI_MODEL = "gemini-1.5-flash"
```

**B.** Те же переменные в конфигурации запуска IDE (Environment variables).

**C.** Плагин/утилита, которая подгружает `.env` в окружение перед стартом JVM.

---

## Шаг 5. Проверка в приложении

1. Backend запущен с актуальным `.env` (или экспортом переменных).
2. Вход как **ADMIN** или **MANAGER**.
3. Сценарий: **/admin/freight-calculation-scenarios** (создать или импорт `.txt`/`.md`/`.json`).
4. Заявка: **/admin/route-requests** → выбрать заявку и сценарий → **«Рассчитать»**.

При пустом ключе или модели — ответ API с кодом **`GEMINI_UNAVAILABLE`**.

---

## Шаг 6. Лимиты и оплата API

- **Бесплатный уровень** AI Studio: квоты на запросы и токены; для тестов обычно хватает.
- **Gemini PRO** не увеличивает квоты API автоматически — смотрите Usage в [AI Studio](https://aistudio.google.com/) или биллинг проекта в Google Cloud.
- Для продакшена с большим объёмом: биллинг в Cloud или [Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs).

---

## Безопасность

1. Ключ только на **backend**; frontend к Gemini не обращается.
2. Храните секреты в **`.env`** (корень репозитория), не в git.
3. При утечке: удалите ключ в AI Studio → создайте новый → обновите `GEMINI_API_KEY` в `.env` → перезапустите backend.

---

## Частые проблемы

| Симптом | Что проверить |
|---------|----------------|
| `GEMINI_UNAVAILABLE` — key not configured | `GEMINI_API_KEY` в корневом `.env`; для Docker — `docker compose` из корня репозитория |
| `GEMINI_UNAVAILABLE` — model not configured | `GEMINI_MODEL` не пустой в `.env` |
| После правки `.env` без эффекта (Docker) | `docker compose up -d --force-recreate backend` |
| Локальный `mvn` не видит `.env` | Экспорт переменных или IDE (см. §4.4) |
| 403 / `GEMINI_PERMISSION_DENIED` / *Your project has been denied access* | Google **заблокировал проект** ключа. Создайте **новый** ключ в AI Studio (**Create API key in new project**), обновите `GEMINI_API_KEY`, перезапустите backend. Ограничения ключа (HTTP referrer/IP) для сервера снимите |
| 403 / invalid API key | Ключ целиком, без пробелов; ключ не удалён в AI Studio |
| 404 model not found | `GEMINI_MODEL` из [списка моделей API](https://ai.google.dev/gemini-api/docs/models), например `gemini-2.5-flash` |
| 429 rate limit | Квота AI Studio / `GEMINI_RATE_LIMIT_PER_HOUR` в проекте |
| PRO в чате есть, API нет | Нужен отдельный ключ AI Studio (шаг 2) |

---

## Краткий чеклист

- [ ] Ключ создан: https://aistudio.google.com/app/apikey  
- [ ] В корне репозитория: `.env` скопирован из `.env.example`  
- [ ] Заполнены `GEMINI_API_KEY` и `GEMINI_MODEL`  
- [ ] Backend перезапущен (Docker: `--force-recreate backend`)  
- [ ] Проверен расчёт на `/admin/route-requests`  

---

*Связанные документы: [`docs/specs/freight-calculation-gemini-scenarios.md`](specs/freight-calculation-gemini-scenarios.md), [`docs/system.md`](system.md), [`RUN.md`](../RUN.md)*
