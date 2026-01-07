# OpenData VKO - Мониторинг качества воздуха

Веб-приложение для мониторинга качества воздуха в Усть-Каменогорске (Восточно-Казахстанская область) с AI-анализом данных.

## Возможности

- Отображение данных о качестве воздуха в реальном времени (WAQI API)
- Интерактивная карта с станциями мониторинга
- Графики изменения загрязнителей
- AI-анализ текущей ситуации (OpenRouter API)
- Рекомендации для жителей

## Требования

- Node.js >= 20.0.0
- npm

## Установка

### 1. Клонировать репозиторий

```bash
git clone <repository-url>
cd opendata
```

### 2. Установить зависимости

```bash
cd backend
npm install
```

### 3. Настроить переменные окружения

Создать файл `.env` в папке `backend`:

```bash
cp .env.example .env
```

Или создать вручную `backend/.env`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
PORT=3000
```

> Получить API ключ OpenRouter: https://openrouter.ai/keys

## Запуск

### Development (с автоперезагрузкой)

```bash
cd backend
npm run dev
```

### Production

```bash
cd backend
npm start
```

Приложение будет доступно по адресу: http://localhost:3000

## Структура проекта

```
opendata/
├── README.md
├── .gitignore
├── frontend/                # Клиентская часть
│   ├── index.html          # Главная страница
│   ├── css/
│   │   └── styles.css      # Стили
│   └── js/
│       └── main.js         # JavaScript логика
│
└── backend/                 # Серверная часть
    ├── .env                # Переменные окружения (не в git!)
    ├── .gitignore
    ├── package.json
    ├── server.js           # Express сервер
    ├── routes/
    │   └── api.js          # API маршруты
    └── services/
        ├── airQualityService.js  # Интеграция с WAQI
        └── aiService.js          # Интеграция с OpenRouter
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/health` | Проверка работоспособности |
| GET | `/api/air-quality` | Все данные о качестве воздуха |
| GET | `/api/stations` | Список станций мониторинга |
| GET | `/api/station/:id` | Данные конкретной станции |
| GET | `/api/station/:id/history` | История данных станции |
| POST | `/api/ai/analyze` | AI-анализ качества воздуха |
| POST | `/api/ai/ask` | Задать вопрос AI |

## Источники данных

- **WAQI** (World Air Quality Index) - данные о качестве воздуха
- **OpenRouter** - AI-анализ (модель: google/gemini-2.0-flash-001)

## Технологии

- **Frontend**: HTML, CSS, JavaScript, Chart.js
- **Backend**: Node.js, Express
- **APIs**: WAQI, OpenRouter

## Лицензия

MIT
