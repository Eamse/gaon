console.log('📊 [Analytics] Script Loaded');

let dailyChart, deviceChart, hourlyChart;

// Analytics 초기화
async function initAnalytics() {
    console.log('📊 [Analytics] Initializing...');

    try {
        await loadVisitStats();
        await loadDailyVisitsChart();
        await loadTopPages();
        await loadDeviceChart();
        await loadHourlyChart();

        console.log('✅ [Analytics] All charts loaded');
    } catch (error) {
        console.error('❌ [Analytics] Error:', error);
    }
}

// 방문 통계 요약 - REAL DATA
async function loadVisitStats() {
    try {
        const data = await window.apiFetch('/metrics/daily');
        const stats = data.stats || [];

        // 날짜별로 먼저 그룹화 (페이지별 UV를 날짜별로 합산)
        const dateMap = {};
        stats.forEach(stat => {
            const dateKey = new Date(stat.date).toISOString().split('T')[0];
            if (!dateMap[dateKey]) {
                dateMap[dateKey] = 0;
            }
            dateMap[dateKey] += (stat.uv || 0);
        });

        // 날짜별 집계
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let todayCount = 0, weekCount = 0, monthCount = 0, totalCount = 0;

        // 날짜별로 합산된 데이터로 계산
        Object.entries(dateMap).forEach(([dateStr, uv]) => {
            const statDate = new Date(dateStr);
            if (statDate >= today) todayCount += uv;
            if (statDate >= weekStart) weekCount += uv;
            if (statDate >= monthStart) monthCount += uv;
            totalCount += uv;
        });

        document.getElementById('todayVisits').textContent = todayCount.toLocaleString();
        document.getElementById('weekVisits').textContent = weekCount.toLocaleString();
        document.getElementById('monthVisits').textContent = monthCount.toLocaleString();
        document.getElementById('totalVisits').textContent = totalCount.toLocaleString();

    } catch (error) {
        console.warn('⚠️ [Visit Stats] Using mock data:', error);
        document.getElementById('todayVisits').textContent = '42';
        document.getElementById('weekVisits').textContent = '287';
        document.getElementById('monthVisits').textContent = '1,234';
        document.getElementById('totalVisits').textContent = '5,678';
    }
}

// 일별 방문자 그래프 - REAL DATA
async function loadDailyVisitsChart() {
    const ctx = document.getElementById('dailyVisitsChart');

    try {
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 13);

        const data = await window.apiFetch(`/metrics/daily?from=${from.toISOString()}&to=${today.toISOString()}`);
        const stats = data.stats || [];

        // 날짜별 집계
        const dateMap = {};
        stats.forEach(stat => {
            const date = new Date(stat.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
            dateMap[date] = (dateMap[date] || 0) + (stat.uv || 0);
        });

        // 최근 14일 라벨
        const labels = [], dataPoints = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const label = `${date.getMonth() + 1}/${date.getDate()}`;
            labels.push(label);
            dataPoints.push(dateMap[label] || 0);
        }

        dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '일별 방문자 (UV)',
                    data: dataPoints,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ [Daily Chart] Using mock data:', error);
        // Mock fallback
        const labels = [], data = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
            data.push(Math.floor(Math.random() * 100) + 50);
        }
        dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{ label: '일별 방문자 (Mock)', data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: true }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', padding: 12 } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }
}

// 인기 페이지 Top 10 - REAL DATA
async function loadTopPages() {
    const container = document.getElementById('topPagesContainer');

    try {
        const data = await window.apiFetch('/metrics/daily');
        const stats = data.stats || [];

        // 경로 그룹화 및 한글 라벨
        const pathGroups = {
            '메인 페이지': ['/', '/index', '/index.html'],
            '프로젝트': ['/project', '/project/', '/project/index', '/project/index.html', '/project/project-detail', '/project/project-detail.html'],
            '창호 소개': ['/information', '/information/', '/information/index', '/information/index.html'],
            '문의하기': ['/inquiries', '/inquiries/', '/inquiries/index', '/inquiries/index.html'],
            '회사 정보': ['/about', '/about/', '/about/index', '/about/index.html'],
            '브랜드': ['/brand', '/brand/', '/brand/index', '/brand/index.html', '/brand/lx', '/brand/lx.html'],
            '관리자': ['/admin/dashboard', '/admin/dashboard.html', '/admin/admin-projects', '/admin/admin-projects.html', '/admin/admin-gallery', '/admin/admin-gallery.html', '/admin/admin-inquiries', '/admin/admin-inquiries.html', '/admin/admin-analytics', '/admin/admin-analytics.html', '/admin/admin-login', '/admin/admin-login.html']
        };

        // 그룹별 집계
        const pageCount = {};
        stats.forEach(stat => {
            const path = stat.path || '/';

            // 어느 그룹에 속하는지 찾기
            let found = false;
            for (const [groupName, paths] of Object.entries(pathGroups)) {
                if (paths.includes(path)) {
                    pageCount[groupName] = (pageCount[groupName] || 0) + (stat.uv || 0);
                    found = true;
                    break;
                }
            }
            // 그룹에 없으면 기타
            if (!found) {
                // 관리자 페이지 등은 제외하고 싶으면 여기서 필터링
                if (path.startsWith('/admin')) {
                    // admin은 그룹에 포함되어 있으므로 여기 안 올 것임
                } else {
                    pageCount['기타'] = (pageCount['기타'] || 0) + (stat.uv || 0);
                }
            }
        });

        // Top 10 정렬
        const topPages = Object.entries(pageCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (topPages.length === 0) throw new Error('No data');

        const maxCount = topPages[0][1];

        container.innerHTML = `
      <table class="top-pages-table">
        <thead>
          <tr>
            <th>페이지</th>
            <th style="text-align: right;">방문자 수 (UV)</th>
          </tr>
        </thead>
        <tbody>
          ${topPages.map(([page, count]) => `
            <tr>
              <td>
                <div class="page-url">${escapeHtml(page)}</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${(count / maxCount) * 100}%"></div>
                </div>
              </td>
              <td style="text-align: right;">
                <span class="visit-count">${count.toLocaleString()}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    } catch (error) {
        console.warn('⚠️ [Top Pages] Using mock data:', error);

        const mockPages = [
            ['메인 페이지 (/)', 450], ['프로젝트 (/project)', 320], ['창호 소개 (/information)', 180], ['문의하기 (/inquiries)', 150],
            ['회사 정보 (/about)', 120], ['브랜드 (/brand)', 90], ['프로젝트 상세', 85],
            ['관리자 대시보드', 45], ['관리자 프로젝트', 42], ['관리자 문의', 38]
        ];

        const maxCount = mockPages[0][1];

        container.innerHTML = `
      <table class="top-pages-table">
        <thead>
          <tr>
            <th>페이지</th>
            <th style="text-align: right;">방문 수</th>
          </tr>
        </thead>
        <tbody>
          ${mockPages.map(([page, count]) => `
            <tr>
              <td>
                <div class="page-url">${escapeHtml(page)}</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${(count / maxCount) * 100}%"></div>
                </div>
              </td>
              <td style="text-align: right;">
                <span class="visit-count">${count.toLocaleString()}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    }
}

// 디바이스 비율 차트 (Mock - 별도 API 필요)
async function loadDeviceChart() {
    const ctx = document.getElementById('deviceChart');

    try {
        deviceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['모바일', '데스크톱', '태블릿'],
                datasets: [{
                    data: [55, 40, 5],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, font: { size: 13 } }
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ [Device Chart] Error:', error);
    }
}

// 시간대별 방문 패턴 (Mock - 별도 API 필요)
async function loadHourlyChart() {
    const ctx = document.getElementById('hourlyChart');

    try {
        const hours = Array.from({ length: 24 }, (_, i) => `${i}시`);
        const data = Array.from({ length: 24 }, () => Math.floor(Math.random() * 50) + 10);

        hourlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: '방문자 수',
                    data,
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: '#111827', padding: 12 }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
                }
            }
        });

    } catch (error) {
        console.error('❌ [Hourly Chart] Error:', error);
    }
}

// 유틸리티 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
    initAnalytics();
}
