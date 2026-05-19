# Vertex AI для расчёта фрахта (TMS GeoSun)

Backend вызывает **Vertex AI Gemini** (`generateContent`) с аутентификацией **service account**. Списание идёт с **Google Cloud Billing** (в т.ч. trial **$300**), а не с prepay-кошелька AI Studio.

Старый режим (API key AI Studio) **удалён**. См. архив: [`gemini-api-key-setup.md`](./gemini-api-key-setup.md).

---

## 1. Google Cloud: проект и API

1. [Google Cloud Console](https://console.cloud.google.com/) → проект (например `gen-lang-client-0027553341`).
2. **APIs & Services → Library** → включите:
   - **Vertex AI API**
3. **Billing** → привяжите платёжный аккаунт (trial $300 подходит).

---

## 2. Service account

1. **IAM & Admin → Service Accounts → Create**.
2. Имя, например `tms-vertex-ai`.
3. Роль при создании (шаг *Grant access*):
   - В поиске введите **`aiplatform`** или **`Agent Platform User`**
   - Выберите **Agent Platform User** — ID роли: `roles/aiplatform.user`  
     (старое имя в документации: *Vertex AI User*; в консоли 2025–2026 чаще показывается как *Agent Platform User*)
   - Если роли нет в списке: **Manage roles** → фильтр `aiplatform.user` → добавить вручную  
     или через CLI (подставьте email service account):
     ```bash
     gcloud projects add-iam-policy-binding gen-lang-client-0027553341 \
       --member="serviceAccount:tms-vertex-ai@gen-lang-client-0027553341.iam.gserviceaccount.com" \
       --role="roles/aiplatform.user"
     ```
   - Для быстрого теста (широкие права, не для продакшена): **Editor** (`roles/editor`)
4. **Keys → Add key → JSON** → скачайте файл (см. §2.1, если ключ заблокирован политикой org).
5. Сохраните в репозитории (не в git):

```text
secrets/gcp-sa.json
```

### 2.1. Ошибка «Service account key creation is disabled»

Политика организации **`iam.disableServiceAccountKeyCreation`** (часто у корпоративных org вроде `geosun.net.ua`) **запрещает JSON-ключи**.

**Вариант A — без JSON (рекомендуется для локальной разработки): учётные данные пользователя (ADC)**

1. Установите [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. В PowerShell:

```powershell
gcloud auth login
gcloud config set project gen-lang-client-0027553341
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform
```

3. Вашему Google-аккаунту на проекте нужна роль **Agent Platform User** (`roles/aiplatform.user`):  
   **IAM → Grant access** → principal = ваш email → роль **Agent Platform User**.
4. В `.env` укажите путь к ADC (Windows):

```env
GCP_CREDENTIALS_FILE=C:/Users/ВАШ_ПОЛЬЗОВАТЕЛЬ/AppData/Roaming/gcloud/application_default_credentials.json
```

5. `docker compose up -d --build backend` — файл монтируется в контейнер как `GOOGLE_APPLICATION_CREDENTIALS`.

**Вариант B — новый проект вне организации (если нужен именно JSON-ключ)**

1. Войдите под **личным** Google-аккаунтом (не org `geosun.net.ua`).
2. [Cloud Console](https://console.cloud.google.com/) → **New Project** (без привязки к org).
3. Billing, включите `aiplatform.googleapis.com`, service account + JSON-ключ.
4. В `.env` укажите **новый** `VERTEX_AI_PROJECT_ID`.

**Вариант C — администратор организации**

Роль **Organization Policy Administrator** снимает ограничение `iam.disableServiceAccountKeyCreation` для проекта или org (обращение к IT админу `geosun.net.ua`).

---

## 3. Переменные в `.env`

Из корня репозитория скопируйте `.env.example` → `.env`:

```env
VERTEX_AI_PROJECT_ID=gen-lang-client-0027553341
VERTEX_AI_LOCATION=europe-west1
VERTEX_AI_MODEL=gemini-2.5-flash
GCP_CREDENTIALS_FILE=./secrets/gcp-sa.json
```

| Переменная | Описание |
|------------|----------|
| `VERTEX_AI_PROJECT_ID` | ID проекта GCP |
| `VERTEX_AI_LOCATION` | Регион Vertex (например `europe-west1`, `us-central1`) |
| `VERTEX_AI_MODEL` | Модель, например `gemini-2.5-flash` |
| `GCP_CREDENTIALS_FILE` | Путь к JSON ключу SA (для Docker volume) |
| `VERTEX_AI_TIMEOUT_MILLIS` | Таймаут, по умолчанию 60000 |
| `VERTEX_AI_MAX_OUTPUT_TOKENS` | Лимит ответа, по умолчанию 8192 |
| `VERTEX_AI_RATE_LIMIT_PER_HOUR` | Лимит запусков на пользователя в TMS, по умолчанию 10 |

---

## 4. Запуск (Docker)

```powershell
docker compose up -d --build backend
```

Backend монтирует `GCP_CREDENTIALS_FILE` в контейнер как `GOOGLE_APPLICATION_CREDENTIALS`.

---

## 5. Локальный запуск без Docker

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "E:\path\to\secrets\gcp-sa.json"
$env:VERTEX_AI_PROJECT_ID = "gen-lang-client-0027553341"
$env:VERTEX_AI_LOCATION = "europe-west1"
$env:VERTEX_AI_MODEL = "gemini-2.5-flash"
cd backend
mvn spring-boot:run
```

---

## 6. Проверка

1. Вход **ADMIN** / **MANAGER**.
2. `/admin/route-requests` → заявка → сценарий → **Рассчитать**.

Коды ошибок API (префикс в UI может остаться `GEMINI_*` для совместимости):

| Код | Причина |
|-----|---------|
| `VERTEX_AI_UNAVAILABLE` | Нет `VERTEX_AI_PROJECT_ID` или JSON ключа |
| `GEMINI_PERMISSION_DENIED` | Нет роли SA или API не включён |
| `GEMINI_MODEL_NOT_FOUND` | Неверный `VERTEX_AI_MODEL` / регион |
| `GEMINI_QUOTA_EXCEEDED` | Квота GCP |

---

## 7. Частые проблемы

| Симптом | Решение |
|---------|---------|
| `credentials file not found` | Положите JSON в `secrets/gcp-sa.json`, проверьте `GCP_CREDENTIALS_FILE` |
| 403 Permission denied | Роль **Agent Platform User** (`roles/aiplatform.user`), API `aiplatform.googleapis.com` включён |
| 404 Model not found | Другая модель или регион; см. [модели Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models) |
| Docker не стартует (volume) | Файл по пути `GCP_CREDENTIALS_FILE` должен существовать на хосте |
| Key creation is disabled | §2.1: ADC через `gcloud` или проект вне org |

---

*Связано: [`docs/specs/freight-calculation-gemini-scenarios.md`](specs/freight-calculation-gemini-scenarios.md), [`RUN.md`](../RUN.md)*
