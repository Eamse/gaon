/** 현재 환경(로컬/배포)에 맞는 API 기본 URL을 결정합니다. */
const resolveApiBase = () => {
  const meta = document.querySelector('meta[name="gaon-api-base"]');
  const { hostname, port, protocol, origin } = window.location;

  const isLocalHost =
    protocol === 'file:' ||
    port === '5500' ||
    port === '5502' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

  if (meta?.content) {
    return meta.content.replace(/\/$/, '');
  }

  if (isLocalHost) {
    return 'http://localhost:4001/api';
  }

  return `${origin}/api`.replace(/\/$/, '');
};

window.GAON_API_BASE = resolveApiBase();

/** 인증 토큰을 포함하여 API 서버에 간편하게 요청을 보내는 공통 함수입니다. */
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

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const finalOptions = {
    ...options,
    headers,
  };

  let requestUrl = url;
  if (url.startsWith('/') && window.GAON_API_BASE) {
    requestUrl = `${window.GAON_API_BASE}${url}`;
  }

  try {
    const response = await fetch(requestUrl, finalOptions);

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { ok: response.ok, error: text || response.statusText };
    }

    if (!response.ok) {
      const error = new Error(data.error || `HTTP error ${response.status}`);
      error.status = response.status;
      error.body = data;
      throw error;
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

/** 화면 우측 상단에 알림 메시지(토스트)를 표시합니다. */
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

  setTimeout(() => {
    notice.classList.add('fade-out');
    notice.addEventListener('transitionend', () => notice.remove());
  }, 3000);
};

/** 사용자 로그아웃을 처리하고 로그인 페이지로 이동합니다. */
window.logout = () => {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.removeItem('token');
    alert('로그아웃되었습니다.');
    window.location.href = '/admin-login';
  }
};

/** 화면 전체를 덮는 로딩 스피너를 표시하거나 숨깁니다. */
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
