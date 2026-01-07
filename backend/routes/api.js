import { Router } from 'express';
import {
  getStationsInBounds,
  getStationDetails,
  getAllAirQualityData,
  getStationHistory,
} from '../services/airQualityService.js';
import { askAI, analyzeAirQuality } from '../services/aiService.js';

const router = Router();

// Bounds по умолчанию для Усть-Каменогорска
const DEFAULT_BOUNDS = '82.26768493652345,49.80964127242487,83.00788879394533,50.144400733540806';

/**
 * GET /api/air-quality
 * Получить все данные о качестве воздуха (станции + детали)
 */
router.get('/air-quality', async (req, res) => {
  try {
    const bounds = req.query.bounds || DEFAULT_BOUNDS;
    const data = await getAllAirQualityData(bounds);

    res.json(data);
  } catch (error) {
    console.error('Error in /air-quality:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/stations
 * Получить список станций мониторинга
 */
router.get('/stations', async (req, res) => {
  try {
    const bounds = req.query.bounds || DEFAULT_BOUNDS;
    const data = await getStationsInBounds(bounds);

    res.json(data);
  } catch (error) {
    console.error('Error in /stations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/station/:id
 * Получить детальные данные по конкретной станции
 */
router.get('/station/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getStationDetails(id);

    if (!data.success) {
      return res.status(404).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error(`Error in /station/${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/station/:id/history
 * Получить историю данных станции для графиков
 */
router.get('/station/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const hours = parseInt(req.query.hours, 10) || 24;
    const data = await getStationHistory(id, hours);

    res.json(data);
  } catch (error) {
    console.error(`Error in /station/${req.params.id}/history:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Air Quality API',
  });
});

/**
 * POST /api/ai/ask
 * Задать вопрос AI о качестве воздуха
 */
router.post('/ai/ask', async (req, res) => {
  try {
    const { question, airQualityData } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
      });
    }

    const answer = await askAI(question, airQualityData);

    res.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error('Error in /ai/ask:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI service error',
    });
  }
});

/**
 * POST /api/ai/analyze
 * Автоматический AI анализ качества воздуха
 */
router.post('/ai/analyze', async (req, res) => {
  try {
    const { airQualityData } = req.body;

    const analysis = await analyzeAirQuality(airQualityData);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error in /ai/analyze:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI analysis error',
    });
  }
});

export default router;
