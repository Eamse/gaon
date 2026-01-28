/**
 * 관리자 페이지 공통 유틸리티 함수
 * 모든 admin 페이지에서 공통으로 사용되는 기능들
 */

/**
 * 로컬 스토리지에서 JWT 토큰 가져오기
 * @returns {string|null} JWT 토큰
 */
export function getToken() {
    return localStorage.getItem('token');
}

/**
 * 로컬 스토리지에 JWT 토큰 저장
 * @param {string} token - JWT 토큰
 */
export function saveToken(token) {
    localStorage.setItem('token', token);
}

/**
 * 로컬 스토리지에서 JWT 토큰 삭제
 */
export function removeToken() {
    localStorage.removeItem('token');
}

/**
 * 인증 확인 및 자동 리다이렉트
 * 토큰이 없으면 로그인 페이지로 이동
 * @param {boolean} [redirect=true] - 토큰이 없을 때 리다이렉트 여부
 * @returns {boolean} 토큰 존재 여부
 */
export function checkAuth(redirect = true) {
    const token = getToken();
    if (!token && redirect) {
        window.location.href = '/admin/admin-login.html';
        return false;
    }
    return !!token;
}

/**
 * 로그아웃
 * 토큰을 삭제하고 로그인 페이지로 이동
 */
export function logout() {
    removeToken();
    window.location.href = '/admin/admin-login.html';
}

/**
 * 날짜를 한국 형식으로 포맷
 * @param {string|Date} date - 날짜
 * @param {boolean} [includeTime=false] - 시간 포함 여부
 * @returns {string} 포맷된 날짜
 * 
 * @example
 * formatDate('2024-01-28T10:30:00Z');
 * // => '2024-01-28'
 * 
 * formatDate('2024-01-28T10:30:00Z', true);
 * // => '2024-01-28 10:30'
 */
export function formatDate(date, includeTime = false) {
    if (!date) return '-';

    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    if (!includeTime) {
        return `${year}-${month}-${day}`;
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 숫자를 천 단위 콤마 형식으로 포맷
 * @param {number} num - 숫자
 * @returns {string} 포맷된 숫자
 * 
 * @example
 * formatNumber(1000000);
 * // => '1,000,000'
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('ko-KR');
}

/**
 * 카테고리 배지 생성
 * @param {string} category - 카테고리
 * @returns {string} HTML 문자열
 */
export function renderCategoryBadge(category) {
    if (!category) return '<span class="badge badge-secondary">미분류</span>';

    const colors = {
        '주택': 'primary',
        '상업': 'success',
        '사무실': 'info',
        '공공': 'warning',
    };

    const color = colors[category] || 'secondary';
    return `<span class="badge badge-${color}">${category}</span>`;
}

/**
 * 상태 배지 생성
 * @param {string} status - 상태
 * @returns {string} HTML 문자열
 */
export function renderStatusBadge(status) {
    const statusMap = {
        'new': { text: '신규', color: 'primary' },
        'processing': { text: '처리중', color: 'warning' },
        'completed': { text: '완료', color: 'success' },
        'cancelled': { text: '취소', color: 'secondary' },
    };

    const { text, color } = statusMap[status] || { text: status, color: 'secondary' };
    return `<span class="badge badge-${color}">${text}</span>`;
}

/**
 * 에러 메시지 표시
 * @param {string} message - 에러 메시지
 * @param {HTMLElement} container - 표시할 컨테이너 element
 */
export function showError(message, container) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
    ${message}
    <button type="button" class="close" data-dismiss="alert">&times;</button>
  `;

    if (container) {
        container.insertBefore(errorDiv, container.firstChild);
    } else {
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }

    // 5초 후 자동 제거
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

/**
 * 성공 메시지 표시
 * @param {string} message - 성공 메시지
 * @param {HTMLElement} container - 표시할 컨테이너 element
 */
export function showSuccess(message, container) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show';
    successDiv.innerHTML = `
    ${message}
    <button type="button" class="close" data-dismiss="alert">&times;</button>
  `;

    if (container) {
        container.insertBefore(successDiv, container.firstChild);
    } else {
        document.body.insertBefore(successDiv, document.body.firstChild);
    }

    // 3초 후 자동 제거
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

/**
 * API 에러 핸들러
 * 401 에러 시 자동으로 로그인 페이지로 리다이렉트
 * @param {Error} error - 에러 객체
 * @param {HTMLElement} [container] - 에러 메시지를 표시할 컨테이너
 * @returns {string} 에러 메시지
 */
export function handleApiError(error, container) {
    let message = '오류가 발생했습니다.';

    // 401 Unauthorized - 자동 로그아웃
    if (error.message && error.message.includes('401')) {
        message = '인증이 만료되었습니다. 다시 로그인해주세요.';
        showError(message, container);
        setTimeout(logout, 2000);
        return message;
    }

    // API 에러 메시지 파싱
    if (error.message) {
        try {
            const parsed = JSON.parse(error.message);
            message = parsed.error || message;
        } catch {
            message = error.message;
        }
    }

    showError(message, container);
    return message;
}

/**
 * 폼 데이터를 객체로 변환
 * @param {HTMLFormElement} form - 폼 element
 * @returns {Object} 폼 데이터 객체
 */
export function getFormData(form) {
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        // checkbox는 배열로 처리
        if (data[key]) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }

    return data;
}

/**
 * 확인 다이얼로그 표시
 * @param {string} message - 확인 메시지
 * @returns {boolean} 사용자 확인 여부
 */
export function confirmDialog(message) {
    return confirm(message);
}

/**
 * 로딩 스피너 표시
 * @param {HTMLElement} element - 스피너를 표시할 element
 * @param {boolean} show - 표시 여부
 */
export function toggleLoading(element, show) {
    if (show) {
        element.innerHTML = '<div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div>';
        element.disabled = true;
    } else {
        element.innerHTML = element.dataset.originalText || '제출';
        element.disabled = false;
    }
}

/**
 * 페이지네이션 렌더링
 * @param {number} currentPage - 현재 페이지
 * @param {number} totalPages - 전체 페이지 수
 * @param {Function} onPageChange - 페이지 변경 시 호출할 함수
 * @param {HTMLElement} container - 페이지네이션을 표시할 컨테이너
 */
export function renderPagination(currentPage, totalPages, onPageChange, container) {
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<nav><ul class="pagination justify-content-center">';

    // 이전 버튼
    html += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">이전</a>
    </li>
  `;

    // 페이지 번호
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
    }

    // 다음 버튼
    html += `
    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage + 1}">다음</a>
    </li>
  `;

    html += '</ul></nav>';
    container.innerHTML = html;

    // 이벤트 리스너 추가
    container.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page, 10);
            if (page >= 1 && page <= totalPages && page !== currentPage) {
                onPageChange(page);
            }
        });
    });
}
