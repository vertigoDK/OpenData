/**
 * AI Service - OpenRouter Integration
 * Анализ данных о качестве воздуха с помощью AI
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Отправить запрос к OpenRouter AI
 */
export async function askAI(question, airQualityContext) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const systemPrompt = `Ты - специалист по экологии, который информирует жителей Усть-Каменогорска о состоянии воздуха.

СТИЛЬ:
- Пиши информативно, но доступным языком
- Тон: деловой, но не сухой - как профессиональный консультант
- НЕ используй эмодзи
- НЕ используй обращения типа "Привет", "сосед", "друзья"
- Сразу переходи к сути

ТЕРМИНОЛОГИЯ:
- Вместо PM2.5 → "мелкодисперсная пыль"
- Вместо PM10 → "крупная пыль"
- Вместо NO2 → "диоксид азота (выхлопы транспорта)"
- Вместо SO2 → "диоксид серы (промышленные выбросы)"
- Вместо CO → "угарный газ"
- AQI можно использовать с пояснением "индекс качества воздуха"

СТРУКТУРА:
1. Общая оценка ситуации
2. Ситуация по районам (где безопасно, где нет)
3. Основные загрязнители сегодня
4. Рекомендации (прогулки, проветривание, маски, спорт)
5. Группы риска

Используй markdown: **жирный** для важного, ### для заголовков разделов.`;

  const userMessage = airQualityContext
    ? `Текущие данные о качестве воздуха:\n${JSON.stringify(airQualityContext, null, 2)}\n\nВопрос пользователя: ${question}`
    : question;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vko.gov.kz',
        'X-Title': 'Air Quality Monitor VKO',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Не удалось получить ответ от AI';
  } catch (error) {
    console.error('AI Service error:', error);
    throw error;
  }
}

/**
 * Анализ данных о качестве воздуха
 */
export async function analyzeAirQuality(airQualityData) {
  const question = `Расскажи простым языком как сейчас с воздухом в городе.
Можно ли гулять? Нужна ли маска? В каких районах лучше не находиться?
Дай короткий понятный ответ для обычного жителя.`;

  return askAI(question, airQualityData);
}
