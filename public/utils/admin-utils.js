/** 로컬 스토리지에서 JWT 토큰을 가져옵니다. */
export function getToken() {
  return localStorage.getItem('token');
}

/** 로컬 스토리지에 JWT 토큰을 저장합니다. */
export function saveToken(token) {
  localStorage.setItem('token', token);
}

/** 로컬 스토리지에서 JWT 토큰을 삭제합니다. */
export function removeToken() {
  localStorage.removeItem('token');
}

/** 인증 상태를 확인하고, 미인증 시 로그인 페이지로 리다이렉트합니다. */
export function checkAuth(redirect = true) {
  const token = getToken();
  if (!token && redirect) {
    window.location.href = '/admin-login.html';
    return false;
  }
  return !!token;
}

/** 토큰을 삭제하고 로그인 페이지로 이동하여 로그아웃을 처리합니다. */
export function logout() {
  removeToken();
  window.location.href = '/admin-login.html';
}

/** 날짜를 'YYYY-MM-DD HH:mm' 형식의 문자열로 변환합니다. */
export function formatDate(date, includeTime = false) {
  if (!date) return '-';

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (!includeTime) return `${year}-${month}-${day}`;

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/** 숫자에 천 단위 콤마를 추가하여 포맷합니다. */
export function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('ko-KR');
}

/** 카테고리 문자열에 따라 색상이 다른 HTML 배지를 생성합니다. */
export function renderCategoryBadge(category) {
  if (!category) return '<span class="badge badge-secondary">미분류</span>';

  const colors = {
    주택: 'primary',
    상업: 'success',
    사무실: 'info',
    공공: 'warning',
  };

  const color = colors[category] || 'secondary';
  return `<span class="badge badge-${color}">${category}</span>`;
}

/** 상태 문자열에 따라 색상이 다른 HTML 배지를 생성합니다. */
export function renderStatusBadge(status) {
  const statusMap = {
    new: { text: '신규', color: 'primary' },
    processing: { text: '처리중', color: 'warning' },
    completed: { text: '완료', color: 'success' },
    cancelled: { text: '취소', color: 'secondary' },
  };

  const { text, color } = statusMap[status] || {
    text: status,
    color: 'secondary',
  };
  return `<span class="badge badge-${color}">${text}</span>`;
}

/** 지정된 컨테이너에 자동으로 사라지는 에러 메시지를 표시합니다. */
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

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

/** 지정된 컨테이너에 자동으로 사라지는 성공 메시지를 표시합니다. */
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

  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

/** API 에러를 처리하며, 401 발생 시 자동으로 로그아웃시킵니다. */
export function handleApiError(error, container) {
  let message = '오류가 발생했습니다.';

  if (error.message && error.message.includes('401')) {
    message = '인증이 만료되었습니다. 다시 로그인해주세요.';
    showError(message, container);
    setTimeout(logout, 2000);
    return message;
  }

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

/** 폼 요소의 데이터를 키-값 쌍의 객체로 변환합니다. */
export function getFormData(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
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

/** 브라우저의 기본 confirm 대화상자를 표시합니다. */
export function confirmDialog(message) {
  return confirm(message);
}

/** 버튼 등의 요소에 로딩 상태를 토글합니다. */
export function toggleLoading(element, show) {
  if (show) {
    element.innerHTML =
      '<div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div>';
    element.disabled = true;
  } else {
    element.innerHTML = element.dataset.originalText || '제출';
    element.disabled = false;
  }
}

/** 페이지네이션 UI를 생성하고 페이지 변경 이벤트를 처리합니다. */
export function renderPagination(
  currentPage,
  totalPages,
  onPageChange,
  container,
) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<nav><ul class="pagination justify-content-center">';

  html += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">이전</a>
    </li>
  `;

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

  html += `
    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage + 1}">다음</a>
    </li>
  `;

  html += '</ul></nav>';
  container.innerHTML = html;

  container.querySelectorAll('.page-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = parseInt(e.target.dataset.page, 10);
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        onPageChange(page);
      }
    });
  });
}
