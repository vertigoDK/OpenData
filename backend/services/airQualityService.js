import fetch from 'node-fetch';

// Bounds для Усть-Каменогорска
const UST_KAMENOGORSK_BOUNDS = '82.26768493652345,49.80964127242487,83.00788879394533,50.144400733540806';

// API endpoints
const WAQI_BOUNDS_API = 'https://mapq.waqi.info/mapq2/bounds';
const WAQI_STATION_API = 'https://airnet.waqi.info/airnet/feed/hourly';

/**
 * Получить список станций мониторинга в заданном районе
 */
export async function getStationsInBounds(bounds = UST_KAMENOGORSK_BOUNDS) {
  try {
    const formData = new URLSearchParams();
    formData.append('bounds', bounds);

    const response = await fetch(WAQI_BOUNDS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`WAQI API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error('WAQI API returned error status');
    }

    // Обрабатываем станции
    const stations = data.data.map(station => ({
      id: station.idx.replace('A', ''), // A517510 -> 517510
      idx: station.idx,
      name: station.name,
      aqi: station.aqi === '-' ? null : parseInt(station.aqi, 10),
      hasData: station.aqi !== '-',
      lastUpdate: station.utime,
      coordinates: {
        lat: station.geo[0],
        lng: station.geo[1],
      },
    }));

    return {
      success: true,
      stations,
      totalCount: stations.length,
      withData: stations.filter(s => s.hasData).length,
    };
  } catch (error) {
    console.error('Error fetching stations:', error);
    return {
      success: false,
      error: error.message,
      stations: [],
    };
  }
}

/**
 * Получить детальные данные по конкретной станции
 */
export async function getStationDetails(stationId) {
  try {
    // Убираем префикс A если есть
    const id = stationId.toString().replace('A', '');

    const response = await fetch(`${WAQI_STATION_API}/${id}`);

    if (!response.ok) {
      throw new Error(`Station API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error('Station API returned error status');
    }

    // Извлекаем последние значения загрязнителей
    const pollutants = extractLatestPollutants(data.data);

    return {
      success: true,
      station: {
        id: data.meta?.id || id,
        name: data.meta?.name || 'Unknown',
        coordinates: {
          lat: data.meta?.geo?.[0],
          lng: data.meta?.geo?.[1],
        },
        lastUpdate: data.meta?.utime ? new Date(data.meta.utime * 1000).toISOString() : null,
        attribution: {
          name: data.atrb?.name,
          url: data.atrb?.url,
        },
        pollutants,
        rawFeed: data.feed,
      },
    };
  } catch (error) {
    console.error(`Error fetching station ${stationId}:`, error);
    return {
      success: false,
      error: error.message,
      station: null,
    };
  }
}

/**
 * Извлечь последние значения загрязнителей из данных станции
 */
function extractLatestPollutants(data) {
  const pollutants = {};

  // PM2.5
  if (data.pm25 && data.pm25.length > 0) {
    const latest = data.pm25[data.pm25.length - 1];
    pollutants.pm25 = {
      value: latest.mean,
      unit: 'µg/m³',
      time: latest.time,
      status: getPollutantStatus('pm25', latest.mean),
    };
  }

  // PM10
  if (data.pm10 && data.pm10.length > 0) {
    const latest = data.pm10[data.pm10.length - 1];
    pollutants.pm10 = {
      value: latest.mean,
      unit: 'µg/m³',
      time: latest.time,
      status: getPollutantStatus('pm10', latest.mean),
    };
  }

  // NO2
  if (data.no2 && data.no2.length > 0) {
    const latest = data.no2[data.no2.length - 1];
    pollutants.no2 = {
      value: latest.mean,
      unit: 'µg/m³',
      time: latest.time,
      status: getPollutantStatus('no2', latest.mean),
    };
  }

  // SO2
  if (data.so2 && data.so2.length > 0) {
    const latest = data.so2[data.so2.length - 1];
    pollutants.so2 = {
      value: latest.mean,
      unit: 'µg/m³',
      time: latest.time,
      status: getPollutantStatus('so2', latest.mean),
    };
  }

  // CO
  if (data.co && data.co.length > 0) {
    const latest = data.co[data.co.length - 1];
    pollutants.co = {
      value: latest.mean,
      unit: 'mg/m³',
      time: latest.time,
      status: getPollutantStatus('co', latest.mean),
    };
  }

  return pollutants;
}

/**
 * Определить статус загрязнителя (good/moderate/poor)
 * Основано на стандартах ВОЗ и EPA
 */
function getPollutantStatus(type, value) {
  const thresholds = {
    pm25: { good: 15, moderate: 35 },      // µg/m³
    pm10: { good: 45, moderate: 75 },      // µg/m³
    no2: { good: 40, moderate: 100 },      // µg/m³
    so2: { good: 20, moderate: 80 },       // µg/m³
    co: { good: 4, moderate: 10 },         // mg/m³
  };

  const t = thresholds[type];
  if (!t) return 'unknown';

  if (value <= t.good) return 'good';
  if (value <= t.moderate) return 'moderate';
  return 'poor';
}

/**
 * Определить качество воздуха по AQI
 */
export function getAqiStatus(aqi) {
  if (aqi === null || aqi === undefined) return { status: 'unknown', label: 'Нет данных' };
  if (aqi <= 50) return { status: 'good', label: 'Хорошее' };
  if (aqi <= 100) return { status: 'moderate', label: 'Умеренное' };
  if (aqi <= 150) return { status: 'unhealthy-sensitive', label: 'Вредно для чувствительных' };
  if (aqi <= 200) return { status: 'unhealthy', label: 'Вредно' };
  if (aqi <= 300) return { status: 'very-unhealthy', label: 'Очень вредно' };
  return { status: 'hazardous', label: 'Опасно' };
}

/**
 * Получить все данные - станции + детали для станций с данными
 */
export async function getAllAirQualityData(bounds = UST_KAMENOGORSK_BOUNDS) {
  // Получаем список станций
  const stationsResult = await getStationsInBounds(bounds);

  if (!stationsResult.success) {
    return stationsResult;
  }

  // Получаем детальные данные только для станций с AQI
  const stationsWithData = stationsResult.stations.filter(s => s.hasData);

  const detailedStations = await Promise.all(
    stationsWithData.map(async (station) => {
      const details = await getStationDetails(station.id);
      return {
        ...station,
        aqiStatus: getAqiStatus(station.aqi),
        details: details.success ? details.station : null,
      };
    })
  );

  // Добавляем станции без данных
  const allStations = [
    ...detailedStations,
    ...stationsResult.stations
      .filter(s => !s.hasData)
      .map(s => ({
        ...s,
        aqiStatus: getAqiStatus(null),
        details: null,
      })),
  ];

  // Вычисляем средний AQI
  const validAqi = detailedStations.filter(s => s.aqi !== null).map(s => s.aqi);
  const averageAqi = validAqi.length > 0
    ? Math.round(validAqi.reduce((a, b) => a + b, 0) / validAqi.length)
    : null;

  return {
    success: true,
    city: 'Усть-Каменогорск',
    averageAqi,
    averageAqiStatus: getAqiStatus(averageAqi),
    stations: allStations,
    summary: {
      total: allStations.length,
      withData: detailedStations.length,
      withoutData: allStations.length - detailedStations.length,
    },
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * Получить исторические данные для графиков
 */
export async function getStationHistory(stationId, hours = 24) {
  try {
    const id = stationId.toString().replace('A', '');
    const response = await fetch(`${WAQI_STATION_API}/${id}`);

    if (!response.ok) {
      throw new Error(`Station API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error('Station API returned error status');
    }

    // Извлекаем историю за последние N часов
    const now = new Date();
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const history = {
      pm25: filterByTime(data.data.pm25, cutoff),
      pm10: filterByTime(data.data.pm10, cutoff),
      no2: filterByTime(data.data.no2, cutoff),
      so2: filterByTime(data.data.so2, cutoff),
      co: filterByTime(data.data.co, cutoff),
    };

    return {
      success: true,
      stationId: id,
      history,
      period: `${hours} hours`,
    };
  } catch (error) {
    console.error(`Error fetching history for ${stationId}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function filterByTime(data, cutoff) {
  if (!data || !Array.isArray(data)) return [];

  return data
    .filter(item => new Date(item.time) >= cutoff)
    .map(item => ({
      time: item.time,
      value: item.mean,
    }));
}
