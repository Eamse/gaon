// src/common.js

// 1. API Base URL 설정
const resolveApiBase = () => {
  const meta = document.querySelector('meta[name="gaon-api-base"]');
  const { hostname, port, protocol, origin } = window.location;

  // 로컬/개발 환경
  const isLocalHost =
    protocol === 'file:' ||
    port === '5500' ||
    port === '5502' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

  // 1) 메타 태그가 있으면 최우선 사용
  if (meta?.content) {
    return meta.content.replace(/\/$/, '');
  }

  // 2) 로컬이면 기본 로컬 API 주소
  if (isLocalHost) {
    return 'http://localhost:4000/api';
  }

  // 3) 배포 환경이면 동일 도메인의 /api 사용
  return `${origin}/api`.replace(/\/$/, '');
};

window.GAON_API_BASE = resolveApiBase();

// 2. 공통 API 호출 함수 (window.apiFetch)
window.apiFetch = async (url, options = {}) => {
  const headers = {
    ...(options.headers || {}),
  };

  // 1. 로컬 스토리지에서 토큰 가져오기
  let token;
  try {
    token = localStorage.getItem('token');
  } catch (e) {
    console.warn('로컬 스토리지 접근 차단됨 (file:// 또는 보안 설정):', e);
  }

  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // FormData가 아닐 때만 Content-Type: application/json 자동 추가
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    // body가 객체라면 JSON 문자열로 변환
    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const finalOptions = {
    ...options,
    headers,
  };

  // URL이 '/'로 시작하면 API Base URL을 앞에 붙여줌
  let requestUrl = url;
  if (url.startsWith('/') && window.GAON_API_BASE) {
    requestUrl = `${window.GAON_API_BASE}${url}`;
  }

  try {
    const response = await fetch(requestUrl, finalOptions);

    // 응답이 JSON이 아닐 수도 있으므로 text로 먼저 읽음
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      // JSON 파싱 실패 시, 텍스트를 오류 메시지로 사용
      data = { ok: response.ok, error: text || response.statusText };
    }

    if (!response.ok) {
      // 상태 코드와 서버 메시지를 포함시켜 호출부에서 분기 가능하도록 처리
      const error = new Error(data.error || `HTTP error ${response.status}`);
      error.status = response.status;
      error.body = data;
      throw error;
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error; // 오류를 다시 던져서 호출한 쪽에서 catch 할 수 있도록 함
  }
};

// 3. 알림 표시 함수 (window.showNotice)
window.showNotice = (message, type = 'info') => {
  let container = document.getElementById('noticeContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'noticeContainer';
    container.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px;
    `;
    document.body.appendChild(container);

    // 스타일 주입
    const style = document.createElement('style');
    style.textContent = `
      .notice-toast {
        padding: 12px 20px; border-radius: 8px; background: #333; color: #fff;
        font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out; transition: opacity 0.3s;
      }
      .notice-toast.success { background: #10b981; }
      .notice-toast.error { background: #ef4444; }
      .notice-toast.warn { background: #f59e0b; }
      .notice-toast.fade-out { opacity: 0; }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  const notice = document.createElement('div');
  notice.className = `notice-toast ${type}`;
  notice.textContent = message;

  container.appendChild(notice);

  // 3초 후 사라짐
  setTimeout(() => {
    notice.classList.add('fade-out');
    notice.addEventListener('transitionend', () => notice.remove());
  }, 3000);
};

// 4. 로그아웃 함수
window.logout = () => {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.removeItem('token');
    alert('로그아웃되었습니다.');
    window.location.href = '/admin/admin-login';
  }
};

// 5. 전역 로딩 표시 함수
window.showLoader = (show = true) => {
  let loader = document.getElementById('globalLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.innerHTML = `
      <div class="loader-backdrop">
        <div class="spinner"></div>
        <p class="loader-text">잠시만 기다려주세요...</p>
      </div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = show ? 'flex' : 'none';
};
