// API Configuration
const API_BASE_URL = '/api';

// Global state
let airQualityData = null;
let tendersData = [];
let updateInterval = null;
let pm25Chart = null;
let aqiChart = null;

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
  initTabs();
  initEventListeners();
});

// ===== TABS FUNCTIONALITY =====
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');

      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      this.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');

      if (tabId === 'air') {
        loadAirQualityData();
      }

      if (tabId === 'ai-procure') {
        loadProcureData();
      }
    });
  });
}

// ===== AIR QUALITY API FUNCTIONS =====

/**
 * Загрузить данные о качестве воздуха с API
 */
async function loadAirQualityData() {
  try {
    showLoadingOverlay();

    const response = await fetch(`${API_BASE_URL}/air-quality`);
    const data = await response.json();

    hideLoadingOverlay();

    if (data.success) {
      airQualityData = data;
      renderAirQualityData(data);
      startAutoUpdate();
    } else {
      showError('Ошибка загрузки данных: ' + data.error);
    }
  } catch (error) {
    hideLoadingOverlay();
    console.error('Error loading air quality data:', error);
    showError('Не удалось подключиться к серверу');
  }
}

/**
 * Показать оверлей загрузки
 */
function showLoadingOverlay() {
  // Удаляем старый если есть
  hideLoadingOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div style="margin-top: 20px; font-size: 16px; color: #374151; font-weight: 500;">
      Загрузка данных о качестве воздуха...
    </div>
    <div style="margin-top: 8px; font-size: 13px; color: #9ca3af;">
      Получаем информацию со станций мониторинга
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * Скрыть оверлей загрузки
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }
}

/**
 * Отрисовать данные о качестве воздуха
 */
function renderAirQualityData(data) {
  // Обновить основной AQI
  updateMainAQI(data.averageAqi, data.averageAqiStatus);

  // Обновить карту со станциями
  renderStationsMap(data.stations);

  // Обновить карточки станций
  renderStationCards(data.stations);

  // Обновить графики
  renderPM25Chart(data.stations);
  renderAQIComparisonChart(data.stations);

  // Обновить время обновления
  updateLastUpdateTime(data.lastUpdate);
}

/**
 * Обновить основной AQI
 */
function updateMainAQI(aqi, status) {
  const mainAqiElement = document.getElementById('main-aqi');
  const descElement = document.querySelector('.aqi-description');

  if (mainAqiElement) {
    mainAqiElement.textContent = aqi !== null ? aqi : '—';
    mainAqiElement.className = `aqi-value aqi-${status?.status || 'unknown'}`;
  }

  if (descElement) {
    descElement.textContent = status?.label || 'Нет данных';
  }

  // Обновить детали загрязнителей
  updatePollutantDetails();
}

/**
 * Обновить детали загрязнителей (средние по станциям)
 */
function updatePollutantDetails() {
  if (!airQualityData?.stations) return;

  const stationsWithDetails = airQualityData.stations.filter(s => s.details?.pollutants);

  const averages = {
    pm25: calculateAverage(stationsWithDetails, 'pm25'),
    pm10: calculateAverage(stationsWithDetails, 'pm10'),
    no2: calculateAverage(stationsWithDetails, 'no2'),
    so2: calculateAverage(stationsWithDetails, 'so2'),
    co: calculateAverage(stationsWithDetails, 'co'),
  };

  const detailElements = document.querySelectorAll('.quality-detail');
  detailElements.forEach(el => {
    const nameEl = el.querySelector('.detail-name');
    const valueEl = el.querySelector('.detail-value');

    if (nameEl && valueEl) {
      const pollutant = nameEl.textContent.toLowerCase().replace('₂', '2');
      const data = averages[pollutant];

      if (data && data.value !== null) {
        valueEl.textContent = `${data.value.toFixed(1)} ${data.unit}`;
        valueEl.className = `detail-value quality-${data.status}`;
      }
    }
  });
}

function calculateAverage(stations, pollutant) {
  const values = stations
    .map(s => s.details?.pollutants?.[pollutant]?.value)
    .filter(v => v !== undefined && v !== null);

  if (values.length === 0) return { value: null, unit: '', status: 'unknown' };

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const unit = pollutant === 'co' ? 'mg/m³' : 'µg/m³';

  return {
    value: avg,
    unit,
    status: getPollutantStatus(pollutant, avg),
  };
}

function getPollutantStatus(type, value) {
  const thresholds = {
    pm25: { good: 15, moderate: 35 },
    pm10: { good: 45, moderate: 75 },
    no2: { good: 40, moderate: 100 },
    so2: { good: 20, moderate: 80 },
    co: { good: 4, moderate: 10 },
  };

  const t = thresholds[type];
  if (!t) return 'unknown';

  if (value <= t.good) return 'good';
  if (value <= t.moderate) return 'moderate';
  return 'poor';
}

/**
 * Отрисовать карту со станциями
 */
function renderStationsMap(stations) {
  const cityMap = document.getElementById('city-map');
  if (!cityMap) return;

  cityMap.innerHTML = '';

  // Фильтруем только станции с данными для карты
  const stationsWithData = stations.filter(s => s.hasData);
  if (stationsWithData.length === 0) return;

  // Определяем границы для позиционирования
  const lats = stationsWithData.map(s => s.coordinates.lat);
  const lngs = stationsWithData.map(s => s.coordinates.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Добавляем отступы к границам
  const latPadding = (maxLat - minLat) * 0.1 || 0.01;
  const lngPadding = (maxLng - minLng) * 0.1 || 0.01;

  stationsWithData.forEach(station => {
    // Вычисляем позицию в процентах с отступами
    const left = ((station.coordinates.lng - minLng + lngPadding) / (maxLng - minLng + 2 * lngPadding)) * 100;
    const top = 100 - ((station.coordinates.lat - minLat + latPadding) / (maxLat - minLat + 2 * latPadding)) * 100;

    const marker = document.createElement('div');
    marker.className = 'station-marker';
    marker.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: ${top}%;
      transform: translate(-50%, -50%);
      cursor: pointer;
      z-index: 10;
    `;

    const aqiDisplay = station.aqi !== null ? station.aqi : '—';
    const aqiColor = getAqiColor(station.aqi);
    const shortName = station.name.split(',')[0].substring(0, 12);

    marker.innerHTML = `
      <div style="
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: ${aqiColor};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        border: 3px solid white;
        transition: transform 0.2s;
      ">
        <div style="font-size: 16px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${aqiDisplay}</div>
      </div>
      <div style="
        position: absolute;
        top: 55px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 9px;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        font-weight: 500;
      ">${shortName}</div>
    `;

    marker.addEventListener('mouseenter', () => {
      marker.querySelector('div').style.transform = 'scale(1.1)';
    });
    marker.addEventListener('mouseleave', () => {
      marker.querySelector('div').style.transform = 'scale(1)';
    });
    marker.addEventListener('click', () => showStationModal(station));
    cityMap.appendChild(marker);
  });

  // Добавить легенду
  addMapLegend(cityMap);
}

/**
 * Получить цвет по AQI
 */
function getAqiColor(aqi) {
  if (aqi === null || aqi === undefined) return '#9ca3af';
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#7f1d1d';
}

function addMapLegend(container) {
  // Легенда теперь будет добавлена под картой, не внутри
  const parentSection = container.closest('.city-map-section');
  if (!parentSection) return;

  // Удаляем старую легенду если есть
  const oldLegend = parentSection.querySelector('.map-legend-bottom');
  if (oldLegend) oldLegend.remove();

  const legend = document.createElement('div');
  legend.className = 'map-legend-bottom';
  legend.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    padding: 15px 20px;
    background: white;
    border-radius: 0 0 12px 12px;
    font-size: 12px;
    border-top: 1px solid #e5e7eb;
  `;
  legend.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #22c55e;"></div>
      <span>0-50 Хорошо</span>
    </div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #eab308;"></div>
      <span>51-100 Умеренно</span>
    </div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #f97316;"></div>
      <span>101-150 Вредно (чувств.)</span>
    </div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #ef4444;"></div>
      <span>151-200 Вредно</span>
    </div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #7f1d1d;"></div>
      <span>200+ Опасно</span>
    </div>
  `;
  parentSection.appendChild(legend);
}

/**
 * Отрисовать график PM2.5 за 24 часа
 */
function renderPM25Chart(stations) {
  const container = document.getElementById('pm25-chart');
  if (!container) return;

  // Собираем данные PM2.5 со всех станций
  const stationsWithPM25 = stations.filter(s => s.details?.pollutants?.pm25?.value !== undefined);

  if (stationsWithPM25.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;">Нет данных PM2.5</div>';
    return;
  }

  // Подготавливаем canvas
  container.innerHTML = '<canvas id="pm25-canvas"></canvas>';
  const canvas = document.getElementById('pm25-canvas');
  const ctx = canvas.getContext('2d');

  // Генерируем временные метки за последние 24 часа
  const now = new Date();
  const labels = [];
  const dataPoints = [];

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    labels.push(time.getHours() + ':00');

    // Симулируем данные на основе текущих значений (с небольшой вариацией)
    const baseValue = stationsWithPM25.reduce((sum, s) => sum + (s.details.pollutants.pm25.value || 0), 0) / stationsWithPM25.length;
    const variation = (Math.sin(i * 0.5) + Math.random() * 0.5) * 10;
    dataPoints.push(Math.max(0, baseValue + variation));
  }

  // Уничтожаем предыдущий график если есть
  if (pm25Chart) {
    pm25Chart.destroy();
  }

  pm25Chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'PM2.5 (µg/m³)',
        data: dataPoints,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0,0,0,0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

/**
 * Отрисовать сравнительную диаграмму AQI по станциям
 */
function renderAQIComparisonChart(stations) {
  const container = document.getElementById('aqi-comparison-chart');
  if (!container) return;

  // Фильтруем станции с AQI
  const stationsWithAQI = stations.filter(s => s.aqi !== null).slice(0, 8);

  if (stationsWithAQI.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;">Нет данных AQI</div>';
    return;
  }

  // Подготавливаем canvas
  container.innerHTML = '<canvas id="aqi-canvas"></canvas>';
  const canvas = document.getElementById('aqi-canvas');
  const ctx = canvas.getContext('2d');

  const labels = stationsWithAQI.map(s => s.name.split(',')[0].substring(0, 10));
  const dataValues = stationsWithAQI.map(s => s.aqi);
  const backgroundColors = stationsWithAQI.map(s => getAqiColor(s.aqi));

  // Уничтожаем предыдущий график если есть
  if (aqiChart) {
    aqiChart.destroy();
  }

  aqiChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'AQI',
        data: dataValues,
        backgroundColor: backgroundColors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: Math.max(...dataValues) + 50,
          grid: {
            color: 'rgba(0,0,0,0.05)'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: {
              size: 10
            }
          }
        }
      }
    }
  });
}

/**
 * Отрисовать карточки станций
 */
function renderStationCards(stations) {
  const container = document.getElementById('districts-grid');
  if (!container) return;

  container.innerHTML = '';

  // Сортируем: сначала с данными, потом без
  const sortedStations = [...stations].sort((a, b) => {
    if (a.hasData && !b.hasData) return -1;
    if (!a.hasData && b.hasData) return 1;
    return (b.aqi || 0) - (a.aqi || 0);
  });

  sortedStations.forEach(station => {
    const card = document.createElement('div');
    const statusClass = station.aqiStatus?.status || 'unknown';
    card.className = `district-card ${statusClass === 'good' ? 'good' : statusClass === 'moderate' ? 'moderate' : statusClass.includes('unhealthy') || statusClass === 'hazardous' ? 'poor' : ''}`;

    const aqiDisplay = station.aqi !== null ? station.aqi : '—';
    const pollutants = station.details?.pollutants || {};

    card.innerHTML = `
      <div class="district-card-header">
        <div class="district-card-name">${station.name}</div>
        <div class="district-card-aqi aqi-${statusClass}">${aqiDisplay}</div>
      </div>
      <div class="pollutants-grid">
        ${renderPollutantCard('PM2.5', pollutants.pm25)}
        ${renderPollutantCard('PM10', pollutants.pm10)}
        ${renderPollutantCard('NO₂', pollutants.no2)}
        ${renderPollutantCard('SO₂', pollutants.so2)}
      </div>
      <div style="margin-top: 15px; font-size: 12px; color: var(--gray);">
        <i class="fas fa-clock"></i>
        Обновлено: ${formatDate(station.lastUpdate)}
      </div>
    `;

    card.addEventListener('click', () => showStationModal(station));
    container.appendChild(card);
  });
}

function renderPollutantCard(name, data) {
  if (!data) {
    return `
      <div class="pollutant-card">
        <div class="pollutant-name"><i class="fas fa-wind"></i> ${name}</div>
        <div class="pollutant-value">—</div>
        <div class="pollutant-status status-unknown">Нет данных</div>
      </div>
    `;
  }

  const statusLabel = data.status === 'good' ? 'Хорошо' :
                      data.status === 'moderate' ? 'Умеренно' : 'Плохо';

  return `
    <div class="pollutant-card">
      <div class="pollutant-name"><i class="fas fa-wind"></i> ${name}</div>
      <div class="pollutant-value">${data.value?.toFixed(1) || '—'} ${data.unit || ''}</div>
      <div class="pollutant-status status-${data.status || 'unknown'}">${statusLabel}</div>
    </div>
  `;
}

/**
 * Показать модальное окно с деталями станции
 */
async function showStationModal(station) {
  const pollutants = station.details?.pollutants || {};
  const statusClass = station.aqiStatus?.status || 'unknown';
  const statusLabel = station.aqiStatus?.label || 'Нет данных';

  showModal(station.name, `
    <div style="margin-bottom: 25px;">
      <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
        <div style="font-size: 56px; font-weight: 700;" class="aqi-${statusClass}">
          ${station.aqi !== null ? station.aqi : '—'}
        </div>
        <div>
          <div style="font-size: 18px; font-weight: 600; color: var(--dark);">Индекс качества воздуха</div>
          <div style="color: var(--gray);">${statusLabel}</div>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--dark); margin-bottom: 15px;">
          <i class="fas fa-chart-bar"></i> Загрязняющие вещества
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
          ${renderModalPollutant('PM2.5', pollutants.pm25)}
          ${renderModalPollutant('PM10', pollutants.pm10)}
          ${renderModalPollutant('NO₂', pollutants.no2)}
          ${renderModalPollutant('SO₂', pollutants.so2)}
          ${renderModalPollutant('CO', pollutants.co)}
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--dark); margin-bottom: 15px;">
          <i class="fas fa-map-marker-alt"></i> Местоположение
        </h3>
        <p style="color: var(--gray);">
          Координаты: ${station.coordinates.lat.toFixed(4)}, ${station.coordinates.lng.toFixed(4)}
        </p>
      </div>

      <div>
        <h3 style="font-size: 16px; font-weight: 600; color: var(--dark); margin-bottom: 15px;">
          <i class="fas fa-clock"></i> Информация
        </h3>
        <p style="color: var(--gray);">
          ID станции: ${station.id}<br>
          Последнее обновление: ${formatDate(station.lastUpdate)}
        </p>
      </div>
    </div>
  `, [
    { text: 'Закрыть', type: 'secondary', action: 'close' }
  ]);
}

function renderModalPollutant(name, data) {
  const value = data?.value?.toFixed(2) || '—';
  const unit = data?.unit || '';
  const status = data?.status || 'unknown';
  const statusLabel = status === 'good' ? 'Норма' :
                      status === 'moderate' ? 'Умеренно' : 'Превышение';

  return `
    <div style="padding: 15px; background: var(--light); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600;">${name}</span>
        <span style="font-weight: 700; font-size: 16px;">${value} ${unit}</span>
      </div>
      <span class="pollutant-status status-${status}">${statusLabel}</span>
    </div>
  `;
}

/**
 * Автообновление данных
 */
function startAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  // Обновлять каждые 5 минут
  updateInterval = setInterval(async () => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab?.getAttribute('data-tab') === 'air') {
      await loadAirQualityData();
      showNotification('Данные обновлены', 'success');
    }
  }, 5 * 60 * 1000);
}

function updateLastUpdateTime(isoString) {
  const span = document.querySelector('#air-tab .data-sources span');
  if (span) {
    const date = new Date(isoString);
    span.textContent = `Данные обновлены: ${formatDate(isoString)} • Источник: WAQI (World Air Quality Index)`;
  }
}

// ===== AI-PROCURE =====

let procureData = null;

/**
 * Загрузить данные тендеров с API
 */
async function loadProcureData() {
  try {
    const response = await fetch(`${API_BASE_URL}/tenders`);
    const data = await response.json();

    if (data.success) {
      procureData = data;
      tendersData = data.tenders;
      renderProcureStats(data.statistics, data.tenders);
      renderTendersTable(data.tenders);
      initProcureEventListeners();
    } else {
      showError('Ошибка загрузки тендеров');
    }
  } catch (error) {
    console.error('Error loading tenders:', error);
    showError('Не удалось загрузить данные тендеров');
  }
}

/**
 * Отрисовать статистику
 */
function renderProcureStats(stats, tenders) {
  const totalTenders = document.getElementById('total-tenders');
  const totalSum = document.getElementById('total-sum');
  const activeOrgs = document.getElementById('active-organizations');
  const avgSavings = document.getElementById('avg-savings');

  if (totalTenders) totalTenders.textContent = tenders.length.toLocaleString('ru-RU');
  if (totalSum) totalSum.textContent = formatTenderAmount(stats.totalAmount);
  if (activeOrgs) {
    const uniqueOrgs = new Set(tenders.map(t => t.organization)).size;
    activeOrgs.textContent = uniqueOrgs;
  }
  if (avgSavings) avgSavings.textContent = stats.avgSavings + '%';
}

/**
 * Форматировать сумму тендера
 */
function formatTenderAmount(amount) {
  if (amount >= 1000000000) {
    return (amount / 1000000000).toFixed(1) + ' млрд ₸';
  } else if (amount >= 1000000) {
    return (amount / 1000000).toFixed(0) + ' млн ₸';
  }
  return amount.toLocaleString('ru-RU') + ' ₸';
}

/**
 * Отрисовать таблицу тендеров
 */
function renderTendersTable(tenders) {
  const tableBody = document.getElementById('tenders-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  tenders.forEach(tender => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.dataset.tenderId = tender.id;

    const deadlineDate = new Date(tender.deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));

    row.innerHTML = `
      <div class="table-cell" style="width: 35%;">
        <div class="tender-title">${tender.title}</div>
        <div class="tender-org">
          <i class="fas fa-building"></i> ${tender.organization}
        </div>
        <div class="tender-category">
          <span class="category-badge">${tender.categoryName}</span>
        </div>
      </div>
      <div class="table-cell" style="width: 15%;">
        <div class="tender-amount">${formatTenderAmount(tender.amount)}</div>
      </div>
      <div class="table-cell" style="width: 15%;">
        <div class="tender-deadline">
          <div class="deadline-date">${formatDateShort(tender.deadline)}</div>
          <div class="deadline-days ${daysLeft < 7 ? 'urgent' : ''}">${daysLeft > 0 ? daysLeft + ' дн.' : 'Завершен'}</div>
        </div>
      </div>
      <div class="table-cell" style="width: 15%;">
        <div class="tender-status status-${tender.status}">
          ${tender.status === 'active' ? 'Активен' : tender.status === 'completed' ? 'Завершен' : 'Отменен'}
        </div>
      </div>
      <div class="table-cell" style="width: 20%;">
        <div class="table-actions">
          <button class="action-btn view-btn" title="Подробнее" data-tender-id="${tender.id}">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn ai-analyze-btn" title="AI Анализ рисков" data-tender-id="${tender.id}">
            <i class="fas fa-robot"></i>
          </button>
        </div>
      </div>
    `;

    tableBody.appendChild(row);
  });

  // Добавляем обработчики на кнопки
  tableBody.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tenderId = btn.dataset.tenderId;
      showTenderDetails(tenderId);
    });
  });

  tableBody.querySelectorAll('.ai-analyze-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tenderId = btn.dataset.tenderId;
      analyzeTenderWithAI(tenderId, btn);
    });
  });

  // Обновляем счетчик
  const shownCount = document.getElementById('shown-count');
  const totalCount = document.getElementById('total-count');
  if (shownCount) shownCount.textContent = tenders.length;
  if (totalCount) totalCount.textContent = tenders.length;
}

/**
 * Форматировать дату коротко
 */
function formatDateShort(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Показать детали тендера
 */
function showTenderDetails(tenderId) {
  const tender = tendersData.find(t => t.id === tenderId);
  if (!tender) return;

  showModal(tender.title, `
    <div class="tender-details-modal">
      <div class="tender-info-grid">
        <div class="tender-info-item">
          <div class="info-label"><i class="fas fa-building"></i> Организация</div>
          <div class="info-value">${tender.organization}</div>
        </div>
        <div class="tender-info-item">
          <div class="info-label"><i class="fas fa-tags"></i> Категория</div>
          <div class="info-value">${tender.categoryName}</div>
        </div>
        <div class="tender-info-item">
          <div class="info-label"><i class="fas fa-tenge-sign"></i> Сумма</div>
          <div class="info-value tender-amount">${formatTenderAmount(tender.amount)}</div>
        </div>
        <div class="tender-info-item">
          <div class="info-label"><i class="fas fa-map-marker-alt"></i> Регион</div>
          <div class="info-value">${tender.region}</div>
        </div>
      </div>

      <div class="tender-description">
        <h4><i class="fas fa-file-alt"></i> Описание</h4>
        <p>${tender.description}</p>
      </div>

      <div class="tender-dates">
        <h4><i class="fas fa-calendar-alt"></i> Сроки</h4>
        <div class="dates-grid">
          <div class="date-item">
            <span class="date-label">Дата публикации:</span>
            <span class="date-value">${formatDateShort(tender.publishDate)}</span>
          </div>
          <div class="date-item">
            <span class="date-label">Прием заявок до:</span>
            <span class="date-value">${formatDateShort(tender.deadline)}</span>
          </div>
          <div class="date-item">
            <span class="date-label">Начало работ:</span>
            <span class="date-value">${formatDateShort(tender.executionStart)}</span>
          </div>
          <div class="date-item">
            <span class="date-label">Окончание работ:</span>
            <span class="date-value">${formatDateShort(tender.executionEnd)}</span>
          </div>
        </div>
      </div>

      <div class="tender-contact">
        <h4><i class="fas fa-phone"></i> Контакты</h4>
        <p>${tender.contact}</p>
      </div>
    </div>
  `, [
    { text: 'AI Анализ рисков', type: 'primary', action: 'ai-analyze', tenderId: tender.id },
    { text: 'Закрыть', type: 'secondary', action: 'close' }
  ]);

  // Добавляем обработчик для кнопки AI анализа в модальном окне
  setTimeout(() => {
    const aiBtn = document.querySelector('[data-action="ai-analyze"]');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => {
        closeModal();
        const tableBtn = document.querySelector(`.ai-analyze-btn[data-tender-id="${tender.id}"]`);
        analyzeTenderWithAI(tender.id, tableBtn);
      });
    }
  }, 100);
}

/**
 * AI Анализ тендера
 */
async function analyzeTenderWithAI(tenderId, buttonElement) {
  const tender = tendersData.find(t => t.id === tenderId);
  if (!tender) return;

  // Отключаем кнопку и показываем загрузку
  if (buttonElement) {
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<div class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></div>';
  }

  showNotification('AI анализирует тендер...', 'info');

  try {
    const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}/ai-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (data.success) {
      showAIAnalysisModal(tender, data);
    } else {
      showError('Ошибка анализа: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    showError('Не удалось выполнить AI анализ');
  } finally {
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.innerHTML = '<i class="fas fa-robot"></i>';
    }
  }
}

/**
 * Показать модальное окно с AI анализом
 */
function showAIAnalysisModal(tender, analysisData) {
  const { analysis, details } = analysisData;
  const riskLevel = details?.riskLevel || 'unknown';
  const riskScore = details?.riskScore || 0;

  const riskColors = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444',
    unknown: '#9ca3af'
  };

  const riskLabels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    unknown: 'Не определен'
  };

  let risksHtml = '';
  if (details?.risks?.length > 0) {
    risksHtml = `
      <div class="analysis-section risks-section">
        <h4><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> Выявленные риски</h4>
        ${details.risks.map(r => `
          <div class="risk-item ${r.severity}">
            <div class="risk-title">${r.title}</div>
            <div class="risk-description">${r.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  let warningsHtml = '';
  if (details?.warnings?.length > 0) {
    warningsHtml = `
      <div class="analysis-section warnings-section">
        <h4><i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i> Предупреждения</h4>
        ${details.warnings.map(w => `
          <div class="warning-item">
            <div class="warning-title">${w.title}</div>
            <div class="warning-description">${w.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  let recommendationsHtml = '';
  if (details?.recommendations?.length > 0) {
    recommendationsHtml = `
      <div class="analysis-section recommendations-section">
        <h4><i class="fas fa-lightbulb" style="color: #22c55e;"></i> Рекомендации</h4>
        ${details.recommendations.map(r => `
          <div class="recommendation-item">
            <div class="rec-title">${r.title}</div>
            <div class="rec-description">${r.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  showModal(`AI Анализ: ${tender.title}`, `
    <div class="ai-analysis-modal">
      <div class="risk-score-header" style="background: linear-gradient(135deg, ${riskColors[riskLevel]}22, ${riskColors[riskLevel]}11); border-left: 4px solid ${riskColors[riskLevel]}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 20px;">
          <div style="text-align: center;">
            <div style="font-size: 48px; font-weight: 700; color: ${riskColors[riskLevel]};">${riskScore}%</div>
            <div style="font-size: 14px; color: var(--gray);">Уровень риска</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 18px; font-weight: 600; color: ${riskColors[riskLevel]}; margin-bottom: 5px;">
              ${riskLabels[riskLevel]} риск
            </div>
            <div style="font-size: 14px; color: var(--gray);">
              ${tender.categoryName} | ${formatTenderAmount(tender.amount)}
            </div>
          </div>
        </div>
      </div>

      <div class="ai-response-section" style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h4 style="margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-robot" style="color: var(--primary);"></i>
          Заключение AI
        </h4>
        <div class="ai-response-text" style="line-height: 1.7;">
          ${parseMarkdown(analysis)}
        </div>
      </div>

      ${risksHtml}
      ${warningsHtml}
      ${recommendationsHtml}

      <div class="analysis-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--gray-light); font-size: 12px; color: var(--gray);">
        <i class="fas fa-info-circle"></i>
        Анализ выполнен ${analysisData.source === 'ai' ? 'с использованием AI' : 'на основе локальных правил'}
        | ${new Date().toLocaleString('ru-RU')}
      </div>
    </div>
  `, [
    { text: 'Закрыть', type: 'secondary', action: 'close' }
  ]);
}

/**
 * Инициализация обработчиков событий для AI-Procure
 */
function initProcureEventListeners() {
  // Фильтр по категории
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyTenderFilters);
  }

  // Поиск
  const searchInput = document.getElementById('tender-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyTenderFilters, 300));
  }

  // Кнопка применения фильтров
  document.getElementById('apply-filters')?.addEventListener('click', () => {
    applyTenderFilters();
    showNotification('Фильтры применены', 'success');
  });
}

/**
 * Применить фильтры к тендерам
 */
function applyTenderFilters() {
  if (!procureData) return;

  const categoryFilter = document.getElementById('category-filter')?.value || 'all';
  const searchQuery = document.getElementById('tender-search')?.value?.toLowerCase() || '';

  let filtered = [...procureData.tenders];

  // Фильтр по категории
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }

  // Фильтр по поиску
  if (searchQuery) {
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(searchQuery) ||
      t.organization.toLowerCase().includes(searchQuery) ||
      t.description.toLowerCase().includes(searchQuery)
    );
  }

  renderTendersTable(filtered);
}

/**
 * Debounce функция
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ===== AI FUNCTIONS =====

/**
 * Парсер Markdown в HTML
 */
function parseMarkdown(text) {
  if (!text) return '';

  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers ###
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin: 15px 0 8px; color: var(--dark);">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin: 15px 0 8px; color: var(--dark);">$1</h3>');

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Lists - item
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left: 20px;">$1</li>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left: 20px;">$1</li>');

  // Line breaks (double newline = paragraph)
  html = html.replace(/\n\n/g, '</p><p style="margin: 10px 0;">');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = '<p style="margin: 10px 0;">' + html + '</p>';

  return html;
}

/**
 * Инициализировать AI помощника
 */
function initAIAssistant() {
  const analyzeBtn = document.getElementById('ai-analyze-air');
  const closeBtn = document.getElementById('ai-close-btn');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', handleAIAnalyze);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('ai-response-container').style.display = 'none';
    });
  }
}

/**
 * Запустить AI анализ
 */
async function handleAIAnalyze() {
  const btn = document.getElementById('ai-analyze-air');
  const responseContainer = document.getElementById('ai-response-container');
  const responseText = document.getElementById('ai-response-text');

  if (!airQualityData) {
    showNotification('Сначала загрузите данные о качестве воздуха', 'warning');
    return;
  }

  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<div class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></div> Анализ...';

  responseContainer.style.display = 'block';
  responseText.innerHTML = '<div class="ai-loading"><div class="loading-spinner"></div> AI анализирует данные о качестве воздуха...</div>';

  try {
    const response = await fetch(`${API_BASE_URL}/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ airQualityData }),
    });

    const data = await response.json();

    if (data.success) {
      responseText.innerHTML = parseMarkdown(data.analysis);
    } else {
      responseText.textContent = 'Ошибка: ' + (data.error || 'Не удалось получить анализ');
    }
  } catch (error) {
    console.error('AI analyze error:', error);
    responseText.textContent = 'Ошибка подключения к AI сервису. Проверьте что сервер запущен.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-robot"></i> AI Анализ';
  }
}

// ===== UTILITY FUNCTIONS =====

function initEventListeners() {
  // Lang switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Important items
  document.querySelectorAll('.important-item').forEach(item => {
    item.addEventListener('click', function() {
      const text = this.querySelector('span')?.textContent;
      if (text) showNotification(`Вы выбрали: ${text}`, 'info');
    });
  });

  // Services
  document.querySelectorAll('.service').forEach(service => {
    service.addEventListener('click', function() {
      const title = this.querySelector('.service-title')?.textContent;
      if (title) showNotification(`Сервис "${title}"`, 'info');
    });
  });

  // Banners
  document.querySelectorAll('.banner').forEach(banner => {
    banner.addEventListener('click', function() {
      const title = this.querySelector('.banner-title')?.textContent;
      if (title) showNotification(`Открывается: ${title}`, 'info');
    });
  });

  // AI Assistant
  initAIAssistant();
}

function formatDate(isoString) {
  if (!isoString) return 'Неизвестно';
  const date = new Date(isoString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.opacity = '0.5';
  }
}

function showError(message) {
  showNotification(message, 'error');
}

// ===== MODAL FUNCTIONS =====

window.showModal = function(title, content, buttons = []) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) document.body.removeChild(existingModal);

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  modalContent.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${title}</h2>
      <button class="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">${content}</div>
    <div class="modal-header" style="border-top: 1px solid var(--gray-light); display: flex; justify-content: flex-end; gap: 10px;">
      ${buttons.map(b => `<button class="filter-btn ${b.type || 'primary'}" data-action="${b.action}">${b.text}</button>`).join('')}
    </div>
  `;

  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // Event listeners
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  modalContent.querySelector('.close-modal').addEventListener('click', closeModal);

  modalContent.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'close') closeModal();
    });
  });

  document.addEventListener('keydown', function closeOnEsc(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', closeOnEsc);
    }
  });
};

window.closeModal = function() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) document.body.removeChild(modal);
};

window.showNotification = function(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 400px;
    animation: fadeIn 0.3s ease;
    color: white;
  `;

  const colors = {
    success: 'rgba(46, 204, 113, 0.95)',
    warning: 'rgba(241, 196, 15, 0.95)',
    error: 'rgba(231, 76, 60, 0.95)',
    info: 'rgba(52, 152, 219, 0.95)',
  };

  const icons = {
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    error: 'fa-times-circle',
    info: 'fa-info-circle',
  };

  notification.style.backgroundColor = colors[type] || colors.info;
  notification.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => {
      if (notification.parentNode) document.body.removeChild(notification);
    }, 300);
  }, 3000);
};
