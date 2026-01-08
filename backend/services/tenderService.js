/**
 * Tender Service - Анализ тендеров и оценка рисков
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка данных тендеров
function loadTendersData() {
  const dataPath = join(__dirname, '..', 'data', 'tenders.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  return data;
}

/**
 * Получить все тендеры
 */
export function getAllTenders() {
  const data = loadTendersData();
  return {
    success: true,
    tenders: data.tenders,
    categories: data.categories,
    statistics: data.statistics,
  };
}

/**
 * Получить тендер по ID
 */
export function getTenderById(id) {
  const data = loadTendersData();
  const tender = data.tenders.find(t => t.id === id);

  if (!tender) {
    return { success: false, error: 'Тендер не найден' };
  }

  return { success: true, tender };
}

/**
 * Анализ рисков тендера (локальный, без AI)
 */
export function analyzeTenderRisks(tender) {
  const risks = [];
  const warnings = [];
  const recommendations = [];
  let riskScore = 0;

  const now = new Date();
  const executionStart = new Date(tender.executionStart);
  const executionEnd = new Date(tender.executionEnd);
  const deadline = new Date(tender.deadline);

  // Определяем месяцы выполнения
  const startMonth = executionStart.getMonth(); // 0-11
  const endMonth = executionEnd.getMonth();

  // Зимние месяцы (ноябрь - март)
  const winterMonths = [10, 11, 0, 1, 2]; // Nov, Dec, Jan, Feb, Mar
  const isWinterExecution = winterMonths.includes(startMonth) || winterMonths.includes(endMonth);

  // Категории с высоким риском в зимний период
  const winterRiskCategories = ['construction'];

  // === АНАЛИЗ СЕЗОННЫХ РИСКОВ ===
  if (isWinterExecution && winterRiskCategories.includes(tender.category)) {
    riskScore += 35;
    risks.push({
      type: 'seasonal',
      severity: 'high',
      title: 'Сезонный риск',
      description: `Выполнение строительных работ запланировано на зимний период (${formatMonth(startMonth)} - ${formatMonth(endMonth)}). Низкие температуры могут привести к срыву сроков и снижению качества работ.`,
    });

    recommendations.push({
      type: 'timing',
      title: 'Перенос сроков',
      description: 'Рекомендуется перенести начало работ на весенний период (апрель-май) для снижения рисков.',
    });
  }

  // === АНАЛИЗ ФИНАНСОВЫХ РИСКОВ ===
  const amountInBillions = tender.amount / 1000000000;

  if (amountInBillions >= 2) {
    riskScore += 25;
    risks.push({
      type: 'financial',
      severity: 'high',
      title: 'Высокая стоимость контракта',
      description: `Сумма контракта ${formatAmount(tender.amount)} превышает 2 млрд тенге. Контракты такого масштаба требуют усиленного контроля и поэтапной приемки работ.`,
    });

    recommendations.push({
      type: 'control',
      title: 'Поэтапный контроль',
      description: 'Рекомендуется разбить контракт на этапы с промежуточной приемкой и оплатой по факту выполнения.',
    });
  } else if (amountInBillions >= 1) {
    riskScore += 15;
    warnings.push({
      type: 'financial',
      severity: 'medium',
      title: 'Значительная сумма контракта',
      description: `Сумма контракта ${formatAmount(tender.amount)} требует тщательной проверки поставщика.`,
    });
  }

  // === АНАЛИЗ СРОКОВ ===
  const daysToDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const executionDays = Math.ceil((executionEnd - executionStart) / (1000 * 60 * 60 * 24));

  if (daysToDeadline < 10 && daysToDeadline > 0) {
    riskScore += 15;
    warnings.push({
      type: 'deadline',
      severity: 'medium',
      title: 'Сжатые сроки подачи заявок',
      description: `До окончания приема заявок осталось ${daysToDeadline} дней. Короткие сроки могут ограничить конкуренцию.`,
    });
  }

  // Проверка реалистичности сроков выполнения для строительства
  if (tender.category === 'construction' && amountInBillions >= 0.5) {
    const monthsForExecution = executionDays / 30;
    const expectedMonths = amountInBillions * 3; // примерно 3 месяца на миллиард

    if (monthsForExecution < expectedMonths * 0.7) {
      riskScore += 20;
      risks.push({
        type: 'timeline',
        severity: 'high',
        title: 'Нереалистичные сроки выполнения',
        description: `Срок выполнения (${Math.round(monthsForExecution)} мес.) может быть недостаточным для контракта на ${formatAmount(tender.amount)}. Есть риск срыва сроков или снижения качества.`,
      });
    }
  }

  // === КОМБИНИРОВАННЫЕ РИСКИ ===
  if (isWinterExecution && winterRiskCategories.includes(tender.category) && amountInBillions >= 1) {
    riskScore += 20;
    risks.push({
      type: 'combined',
      severity: 'critical',
      title: 'Комбинированный риск',
      description: `Крупный строительный контракт (${formatAmount(tender.amount)}) с выполнением в зимний период. Сочетание факторов значительно повышает вероятность проблем с исполнением.`,
    });

    recommendations.push({
      type: 'guarantee',
      title: 'Усиление гарантий',
      description: 'Рекомендуется увеличить размер обеспечения контракта и включить штрафные санкции за срыв сроков.',
    });
  }

  // === СПЕЦИФИЧЕСКИЕ РИСКИ ПО КАТЕГОРИЯМ ===
  if (tender.category === 'medical' && amountInBillions >= 0.5) {
    warnings.push({
      type: 'category',
      severity: 'medium',
      title: 'Импортное оборудование',
      description: 'Медицинское оборудование часто импортируется. Учитывайте риски колебания курса валют и логистические задержки.',
    });

    recommendations.push({
      type: 'currency',
      title: 'Валютные риски',
      description: 'Рекомендуется фиксировать цену в тенге или предусмотреть механизм корректировки при изменении курса более 10%.',
    });
  }

  if (tender.category === 'it') {
    recommendations.push({
      type: 'support',
      title: 'Техническая поддержка',
      description: 'Убедитесь, что контракт включает гарантийное обслуживание и техническую поддержку минимум на 2 года.',
    });
  }

  // Ограничиваем максимальный балл
  riskScore = Math.min(riskScore, 100);

  // Определяем уровень риска
  let riskLevel;
  if (riskScore >= 60) {
    riskLevel = 'high';
  } else if (riskScore >= 30) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    riskScore,
    riskLevel,
    risks,
    warnings,
    recommendations,
    summary: generateSummary(tender, riskScore, riskLevel, risks, warnings),
  };
}

/**
 * Генерация текстового резюме анализа
 */
function generateSummary(tender, riskScore, riskLevel, risks, warnings) {
  const levelText = {
    low: 'низкий',
    medium: 'средний',
    high: 'высокий',
  };

  let summary = `**Общая оценка риска: ${riskScore}% (${levelText[riskLevel]})**\n\n`;

  if (risks.length === 0 && warnings.length === 0) {
    summary += `Тендер "${tender.title}" не имеет существенных рисков. Рекомендуется стандартная процедура проверки поставщика.`;
  } else {
    summary += `Тендер "${tender.title}" требует внимания.\n\n`;

    if (risks.length > 0) {
      summary += `**Выявлено критических рисков: ${risks.length}**\n`;
      risks.forEach(r => {
        summary += `- ${r.title}\n`;
      });
      summary += '\n';
    }

    if (warnings.length > 0) {
      summary += `**Предупреждений: ${warnings.length}**\n`;
      warnings.forEach(w => {
        summary += `- ${w.title}\n`;
      });
    }
  }

  return summary;
}

/**
 * Форматирование суммы
 */
function formatAmount(amount) {
  if (amount >= 1000000000) {
    return (amount / 1000000000).toFixed(1) + ' млрд ₸';
  } else if (amount >= 1000000) {
    return (amount / 1000000).toFixed(0) + ' млн ₸';
  }
  return amount.toLocaleString('ru-RU') + ' ₸';
}

/**
 * Форматирование месяца
 */
function formatMonth(monthIndex) {
  const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
                  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  return months[monthIndex];
}

/**
 * AI анализ тендера через OpenRouter
 */
export async function aiAnalyzeTender(tender) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // Если нет API ключа, используем локальный анализ
  if (!apiKey) {
    const localAnalysis = analyzeTenderRisks(tender);
    return {
      success: true,
      analysis: localAnalysis.summary,
      details: localAnalysis,
      source: 'local',
    };
  }

  const systemPrompt = `Ты - эксперт по анализу государственных закупок Казахстана. Твоя задача - оценить риски тендера и дать рекомендации.

КОНТЕКСТ:
- Текущая дата: ${new Date().toLocaleDateString('ru-RU')}
- Регион: Восточно-Казахстанская область
- Климат: резко континентальный, зимы холодные (до -40°C)

ФАКТОРЫ РИСКА ДЛЯ АНАЛИЗА:
1. Сезонность: строительные работы в зимний период (ноябрь-март) имеют высокий риск срыва
2. Сумма контракта: чем больше сумма, тем выше риски
3. Сроки: нереалистичные сроки выполнения
4. Категория работ: строительство и ремонт дорог зимой особенно рискованны

ФОРМАТ ОТВЕТА:
- Кратко (3-5 предложений)
- Конкретные риски
- Практичные рекомендации
- Без лишних вступлений`;

  const userMessage = `Проанализируй этот тендер:

Название: ${tender.title}
Категория: ${tender.categoryName}
Сумма: ${formatAmount(tender.amount)}
Организация: ${tender.organization}
Срок подачи заявок: до ${new Date(tender.deadline).toLocaleDateString('ru-RU')}
Период выполнения: ${new Date(tender.executionStart).toLocaleDateString('ru-RU')} - ${new Date(tender.executionEnd).toLocaleDateString('ru-RU')}
Описание: ${tender.description}

Оцени риски и дай рекомендации.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vko.gov.kz',
        'X-Title': 'AI-Procure VKO',
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
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'Не удалось получить анализ';

    // Также получаем локальный анализ для деталей
    const localAnalysis = analyzeTenderRisks(tender);

    return {
      success: true,
      analysis: aiResponse,
      details: localAnalysis,
      source: 'ai',
    };
  } catch (error) {
    console.error('AI Tender analysis error:', error);

    // Fallback на локальный анализ
    const localAnalysis = analyzeTenderRisks(tender);
    return {
      success: true,
      analysis: localAnalysis.summary,
      details: localAnalysis,
      source: 'local',
      error: error.message,
    };
  }
}
