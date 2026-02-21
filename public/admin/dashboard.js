document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  initVisitorsChart();
  loadDashboardStats();
});

/** 대시보드 필터 버튼에 이벤트 리스너를 추가합니다. */
function initDashboard() {
  const filterBtns = document.querySelectorAll('.btn-filter');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const period = btn.dataset.period;
      updateChartData(period);
    });
  });
}

/**
 * 방문자 추이 차트 초기화
 */
let visitorsChart;

function initVisitorsChart() {
  const ctx = document.getElementById('visitorsChart');
  if (!ctx) return;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

  visitorsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['1/20', '1/21', '1/22', '1/23', '1/24', '1/25', '1/26'],
      datasets: [
        {
          label: '방문자 수',
          data: [120, 135, 142, 128, 156, 148, 165],
          borderColor: '#2563eb',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#1f2937',
          padding: 12,
          titleFont: {
            size: 13,
          },
          bodyFont: {
            size: 14,
            weight: 'bold',
          },
          displayColors: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#9ca3af',
            font: {
              size: 12,
            },
          },
          grid: {
            color: '#f3f4f6',
            drawBorder: false,
          },
        },
        x: {
          ticks: {
            color: '#9ca3af',
            font: {
              size: 12,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

/** 기간(7일/30일)에 따라 차트 데이터를 샘플 데이터로 업데이트합니다. */
function updateChartData(period) {
  if (!visitorsChart) return;

  let labels, data;

  if (period === '7') {
    labels = ['1/20', '1/21', '1/22', '1/23', '1/24', '1/25', '1/26'];
    data = [120, 135, 142, 128, 156, 148, 165];
  } else {
    // 30일 데이터 (샘플)
    labels = Array.from({ length: 30 }, (_, i) => `${i + 1}일`);
    data = Array.from({ length: 30 }, () =>
      Math.floor(Math.random() * 100 + 100),
    );
  }

  visitorsChart.data.labels = labels;
  visitorsChart.data.datasets[0].data = data;
  visitorsChart.update();
}

/** API를 통해 대시보드 통계 데이터를 로드하고 화면에 표시합니다. */
async function loadDashboardStats() {
  try {
    const stats = await fetchDashboardStats();

    updateStatCard('visitorsToday', stats.visitorsToday || 0);
    updateStatCard('inquiriesMonth', stats.inquiriesMonth || 0);
    updateStatCard('totalProjects', stats.totalProjects || 0);
    updateStatCard('pendingInquiries', stats.pendingInquiries || 0);

    if (stats.recentActivities && stats.recentActivities.length > 0) {
      renderRecentActivities(stats.recentActivities);
    }

    if (stats.visitorTrend) {
      updateChartWithRealData(stats.visitorTrend);
    }
  } catch (error) {
    console.error('통계 로드 실패:', error);
  }
}

/** API로부터 받은 실제 데이터로 방문자 추이 차트를 업데이트합니다. */
function updateChartWithRealData(trendData) {
  if (!visitorsChart || !trendData) return;

  const labels = trendData.labels || [];
  const data = trendData.data || [];

  visitorsChart.data.labels = labels;
  visitorsChart.data.datasets[0].data = data;
  visitorsChart.update();
}

/** 숫자 카운팅 애니메이션과 함께 통계 카드 값을 업데이트합니다. */
function updateStatCard(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  const start = 0;
  const end = value;
  const duration = 1000;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const current = Math.floor(start + (end - start) * easeOutQuad(progress));
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

/** 숫자 애니메이션을 위한 Easing 함수입니다. */
function easeOutQuad(t) {
  return t * (2 - t);
}

/** 최근 활동 목록을 HTML로 렌더링하여 화면에 표시합니다. */
function renderRecentActivities(activities) {
  const container = document.getElementById('recentActivities');
  if (!container || !activities || activities.length === 0) return;

  container.innerHTML = activities
    .map(
      (activity) => `
    <div class="activity-item">
      <div class="activity-icon activity-icon-${activity.type}">
        <i class="fas fa-${activity.icon}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-title">${activity.title}</div>
        <div class="activity-meta">${activity.meta}</div>
      </div>
    </div>
  `,
    )
    .join('');
}

/** API 호출 실패 시 사용할 Mock 통계 데이터를 반환합니다. */
async function getMockStats() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        visitorsToday: 165,
        inquiriesMonth: 42,
        totalProjects: 128,
        pendingInquiries: 7,
        recentActivities: [
          {
            type: 'new',
            icon: 'envelope',
            title: '새로운 견적 문의',
            meta: '홍길동 · 아파트 32평 · 5분 전',
          },
          {
            type: 'project',
            icon: 'hammer',
            title: '프로젝트 등록',
            meta: '강남 오피스텔 리모델링 · 1시간 전',
          },
          {
            type: 'image',
            icon: 'images',
            title: '갤러리 업로드',
            meta: '시공사례 8장 추가 · 2시간 전',
          },
        ],
      });
    }, 300);
  });
}

/** API 서버로부터 대시보드 개요 통계 데이터를 가져옵니다. */
async function fetchDashboardStats() {
  if (typeof window.apiFetch !== 'function') {
    console.warn('apiFetch가 없습니다. Mock 데이터를 사용합니다.');
    return getMockStats();
  }

  try {
    const response = await window.apiFetch('/metrics/overview');
    return response;
  } catch (error) {
    console.error('API 호출 실패:', error);
    return getMockStats();
  }
}
