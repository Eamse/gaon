const API_BASE =
  (window.WOOJIN_API_BASE && window.WOOJIN_API_BASE.replace(/\/$/, '')) ||
  'https://gaoninterior.kr/api';

// 상태 관리
const STATE = {
  allItems: [],
  page: 1,
  limit: 24,
  total: 0,
  totalPages: 1,
  isLoading: false,
  // 검색/필터링 상태
  query: '',
  category: '',
  sort: 'recent',
};
let currentModalItem = null; // 현재 모달에 표시된 아이템

// ---- 유틸 ----
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getThumbUrl(item) {
  if (item.thumbUrl) return item.thumbUrl;
  if (item.originalUrl) return item.originalUrl;
  return '';
}

// ---- 모달 제어 ----
function openModal(item) {
  const modal = document.getElementById('imageModal');
  if (!modal) return;

  const imgEl = document.getElementById('modalImage');
  const titleEl = document.getElementById('modalTitle');
  const subTitleEl = document.getElementById('modalSubTitle');
  const metaEl = document.getElementById('modalMeta');
  const linksEl = document.getElementById('modalLinks');
  const galleryEl = document.getElementById('modalGallery');

  const thumbUrl = getThumbUrl(item);
  currentModalItem = item; // 현재 아이템을 전역적으로 저장

  imgEl.src = thumbUrl || '';
  imgEl.alt = item.title || item.filename;

  titleEl.textContent = item.title || '제목 없음';
  subTitleEl.textContent = item.category || '카테고리 없음';

  const resolution =
    item.width && item.height
      ? `${item.width} × ${item.height}`
      : '해상도 정보 없음';

  metaEl.innerHTML = `
    <div>📄 파일명: <strong>${item.filename}</strong></div>
    <div>📏 해상도: <strong>${resolution}</strong></div>
    <div> 파일 크기: <strong>${formatBytes(item.sizeBytes)}</strong></div>
    <div>🕒 업로드 시각: <strong>${formatDate(item.createdAt)}</strong></div>
  `;

  const urlList = [];
  if (item.originalUrl) urlList.push({ label: '원본', url: item.originalUrl });
  if (item.largeUrl) urlList.push({ label: 'Large', url: item.largeUrl });
  if (item.mediumUrl) urlList.push({ label: 'Medium', url: item.mediumUrl });
  if (item.thumbUrl) urlList.push({ label: 'Thumb', url: item.thumbUrl });

  linksEl.innerHTML = '';
  if (urlList.length) {
    urlList.forEach((u) => {
      const a = document.createElement('a');
      a.href = u.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `${u.label} 링크 열기`;
      linksEl.appendChild(a);
    });
  } else {
    linksEl.textContent = '등록된 URL 정보가 없습니다.';
  }

  renderModalGallery(); // 상세 갤러리 렌더링 함수 호출

  modal.classList.add('show');
}

function renderModalGallery() {
  const galleryEl = document.getElementById('modalGallery');
  // 상세 갤러리 이미지 렌더링
  galleryEl.innerHTML = '';
  if (
    currentModalItem.galleryImages &&
    currentModalItem.galleryImages.length > 0
  ) {
    const galleryTitle = document.createElement('h4');
    galleryTitle.textContent = '상세 이미지';
    galleryEl.appendChild(galleryTitle);

    const galleryGrid = document.createElement('div');
    galleryGrid.className = 'modal-gallery-grid';
    currentModalItem.galleryImages.forEach((galleryImg) => {
      const galleryCard = document.createElement('div');
      galleryCard.className = 'gallery-item-card';
      galleryCard.innerHTML = `
        <img src="${galleryImg.thumbUrl}" alt="${galleryImg.alt
        }" loading="lazy">
        <div class="gallery-item-info">
          <span>${galleryImg.alt || '설명 없음'}</span>
          <button class="btn-icon" data-delete-gallery-id="${galleryImg.id
        }">🗑️</button>
        </div>
      `;
      galleryGrid.appendChild(galleryCard);
    });
    galleryEl.appendChild(galleryGrid);
  } else {
    const noGallery = document.createElement('p');
    noGallery.textContent = '상세 이미지가 없습니다.';
    galleryEl.appendChild(noGallery);
  }

  // 상세 이미지 업로드 폼 추가
  const uploadForm = document.createElement('div');
  uploadForm.className = 'modal-upload-form';
  uploadForm.innerHTML = `
    <h4>상세 이미지 추가</h4>
    <input type="file" id="galleryUploadInput" multiple accept="image/*" />
    <button type="button" id="galleryUploadBtn" class="btn-main">업로드</button>
    <div id="galleryUploadProgress" class="progress-bar" style="display: none;">
      <div class="progress"></div>
    </div>
  `;
  galleryEl.appendChild(uploadForm);

  // 업로드 버튼에 이벤트 리스너 추가 (이 함수가 호출될 때마다 새로 설정)
  const uploadBtn = document.getElementById('galleryUploadBtn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', handleGalleryImageUpload);
  }
}

function closeModal() {
  const modal = document.getElementById('imageModal');
  if (!modal) return;
  currentModalItem = null; // 모달이 닫힐 때 현재 아이템 초기화
  modal.classList.remove('show');
}

// ---- 카드 DOM ----
function createCard(item) {
  const card = document.createElement('article');
  card.className = 'card';

  const thumbUrl = getThumbUrl(item);
  // item이 ProjectImage인지 AdminImage인지 구분
  const isProjectImage = item.projectId !== undefined;

  const title =
    item.title || (isProjectImage ? `프로젝트 이미지` : '제목 없음');
  const filename = item.filename || (isProjectImage ? `${item.id}` : '-');
  const category = item.category || '';
  const galleryCount = item.galleryImages?.length || 0;

  card.innerHTML = `
    <div class="thumb-wrapper">
      ${thumbUrl
      ? `<img src="${thumbUrl}" alt="${title}" loading="lazy" />`
      : ''
    }
      <div class="thumb-badge">${galleryCount}컷</div>
    </div>
    <div class="card-body">
      <div class="card-title">
        <span>${title}</span>
        ${category ? `<span class="tag-pill">${category}</span>` : ''}
      </div>
      <div class="card-meta">
        <span>📄 ${filename}</span>
        <span>💾 ${formatBytes(item.sizeBytes)}</span>
        <span>🕒 ${formatDate(item.createdAt)}</span>
      </div>
      <div class="card-actions">
        ${!isProjectImage
      ? `
        <button type="button" class="btn-main" data-action="open-modal">
          관리
        </button>
        <button type="button" class="btn-sub" data-action="delete-item" data-id="${isProjectImage ? item.id : filename
      }" data-type="${isProjectImage ? 'project' : 'admin'}">
          삭제
        </button>
        `
      : `
        <button type="button" class="btn-main" data-action="open-modal">
          관리
        </button>
        <button type="button" class="btn-sub" data-action="delete-item" data-id="${item.id}" data-type="project">
          삭제
        </button>
        `
    }
      </div>
    </div>
  `;

  const openBtn = card.querySelector('[data-action="open-modal"]');
  const deleteBtn = card.querySelector('[data-action="delete-item"]');

  if (openBtn) {
    openBtn.addEventListener('click', () => openModal(item));
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idOrName = deleteBtn.dataset.id;
      const type = deleteBtn.dataset.type;

      if (!confirm('이미지를 정말 삭제하시겠습니까?')) return;

      try {
        if (type === 'project') {
          await window.apiFetch(`${API_BASE}/projects/images/${idOrName}`, {
            method: 'DELETE',
          });
        } else {
          await window.apiFetch(`${API_BASE}/uploads/${idOrName}`, {
            method: 'DELETE',
          });
        }
        window.showNotice('이미지가 삭제되었습니다.', 'success');
        // 목록에서 즉시 제거
        STATE.allItems = STATE.allItems.filter((it) =>
          type === 'project'
            ? it.id !== Number(idOrName)
            : it.filename !== idOrName
        );
        STATE.total -= 1;
        renderItems();
      } catch (err) {
        window.showNotice(`삭제 실패: ${err.message}`, 'error');
      }
    });
  }

  return card;
}

// ---- 렌더링 & 무한 스크롤 ----
function renderItems() {
  const grid = document.getElementById('galleryGrid');
  const loader = document.getElementById('scrollLoader');
  if (!grid || !loader) return;

  grid.innerHTML = '';
  if (STATE.allItems.length > 0) {
    STATE.allItems.forEach((item) => {
      const card = createCard(item);
      grid.appendChild(card);
    });
  }

  if (STATE.isLoading) {
    loader.textContent = '불러오는 중...';
    loader.classList.remove('hidden');
  } else if (STATE.page < STATE.totalPages) {
    loader.textContent = '스크롤하여 더 보기';
    loader.classList.remove('hidden');
  } else if (STATE.total > 0) {
    loader.textContent = '모든 이미지를 불러왔습니다.';
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

function handleScrollForInfinite() {
  if (STATE.isLoading) return;
  if (STATE.page > STATE.totalPages) return;

  const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight - 160) {
    fetchAdminImages(false); // append = true
  }
}

// ---- API 호출 ----
async function fetchAdminImages(isNewSearch = true) {
  const statusLine = document.getElementById('statusLine');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');
  const grid = document.getElementById('galleryGrid');

  if (STATE.isLoading) return;
  STATE.isLoading = true;

  if (isNewSearch) {
    STATE.page = 1;
    STATE.allItems = [];
    if (grid) grid.innerHTML = '';
    if (statusLine) statusLine.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (loadingState) loadingState.classList.remove('hidden');
  }

  renderItems(); // 로딩 상태 표시

  try {
    const params = new URLSearchParams({
      page: STATE.page,
      limit: STATE.limit,
      q: STATE.query,
      category: STATE.category,
      sort: STATE.sort,
    });

    const data = await window.apiFetch(`${API_BASE}/uploads?${params}`);

    const items = Array.isArray(data.items) ? data.items : [];

    if (isNewSearch) {
      STATE.allItems = items;
    } else {
      STATE.allItems.push(...items);
    }

    STATE.total = data.total;
    STATE.totalPages = data.totalPages;
    STATE.page += 1;
    STATE.isLoading = false;

    if (loadingState) loadingState.classList.add('hidden');

    if (STATE.total === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.textContent = '조건에 맞는 이미지가 없습니다.';
      }
      if (statusLine) {
        statusLine.classList.remove('hidden');
        statusLine.innerHTML = `<strong>0</strong>개의 이미지를 찾았습니다.`;
      }
    } else {
      if (statusLine) {
        statusLine.classList.remove('hidden');
        statusLine.innerHTML = `총 <strong>${STATE.total}</strong>개의 이미지를 찾았습니다.`;
      }
    }

    // [NEW] 프로젝트 업로드 버튼 표시
    const projectUploadArea = document.getElementById('projectUploadArea');
    if (projectUploadArea) projectUploadArea.classList.remove('hidden');

    renderItems();
  } catch (err) {
    console.error(err);
    STATE.allItems = [];
    STATE.isLoading = false;

    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) {
      errorState.classList.remove('hidden');
      errorState.textContent = `목록을 불러오지 못했습니다: ${err.message}`;
    }
    renderItems();
  }
}

// ---- [NEW] 프로젝트 이미지 API 호출 ----
async function fetchProjectImages(projectId) {
  const statusLine = document.getElementById('statusLine');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');
  const grid = document.getElementById('galleryGrid');

  if (STATE.isLoading) return;
  STATE.isLoading = true;

  // 이전 상태 초기화
  STATE.allItems = [];
  if (grid) grid.innerHTML = '';
  if (statusLine) statusLine.classList.add('hidden');
  if (errorState) errorState.classList.add('hidden');
  if (emptyState) emptyState.classList.add('hidden');
  if (loadingState) loadingState.classList.remove('hidden');

  renderItems(); // 로딩 상태 표시

  try {
    const data = await window.apiFetch(
      `${API_BASE}/projects/${projectId}/images`
    );

    STATE.allItems = Array.isArray(data.items) ? data.items : [];
    STATE.total = data.count || 0;
    STATE.isLoading = false;

    if (loadingState) loadingState.classList.add('hidden');

    if (STATE.total === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.textContent = '이 프로젝트에 등록된 이미지가 없습니다.';
      }
      if (statusLine) {
        statusLine.classList.remove('hidden');
        statusLine.innerHTML = `<strong>0</strong>개의 이미지를 찾았습니다.`;
      }
    } else {
      if (statusLine) {
        statusLine.classList.remove('hidden');
        statusLine.innerHTML = `총 <strong>${STATE.total}</strong>개의 이미지를 찾았습니다.`;
      }
    }

    // [UI 업데이트] 프로젝트 모드일 때 헤더와 컨트롤 바 정리
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) {
      pageTitle.innerHTML = `프로젝트 #${projectId} 이미지 관리`;
    }
    // [수정] 전체 바를 숨기지 않고, 프로젝트 ID 입력 부분만 숨김
    const controlGroup = document.querySelector('.control-bar .control-group');
    if (controlGroup) controlGroup.style.display = 'none';
    const projectUploadArea = document.getElementById('projectUploadArea');
    if (projectUploadArea) projectUploadArea.classList.remove('hidden');

    renderItems();
  } catch (err) {
    console.error(err);
    STATE.isLoading = false;
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) {
      errorState.classList.remove('hidden');
      errorState.textContent = `목록을 불러오지 못했습니다: ${err.message}`;
    }
    renderItems();
  }
}

// ---- 검색/필터/정렬 제어 ----
function setupControls() {
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const sortFilter = document.getElementById('sortFilter');

  const search = () => fetchAdminImages(true);

  // 1. URL에 projectId가 있으면 프로젝트 모드로 동작 (어드민 프로젝트 관리에서 넘어온 경우)
  const urlParams = new URLSearchParams(window.location.search);
  const projectIdParam = urlParams.get('projectId');
  if (projectIdParam) {
    // [NEW] 프로젝트 이미지 업로드 이벤트 연결
    const projectFileInput = document.getElementById('projectFileInput');
    if (projectFileInput) {
      projectFileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (const file of files) {
          formData.append('files', file);
        }

        // 로딩 표시 (간단히)
        window.showNotice('이미지 업로드 중...', 'info');

        try {
          const res = await window.apiFetch(
            `${API_BASE}/projects/${projectIdParam}/images`,
            {
              method: 'POST',
              body: formData,
            }
          );

          window.showNotice(
            `${res.count}개의 이미지가 업로드되었습니다.`,
            'success'
          );

          // 목록 새로고침
          fetchProjectImages(Number(projectIdParam));
        } catch (err) {
          console.error(err);
          window.showNotice(`업로드 실패: ${err.message}`, 'error');
        } finally {
          projectFileInput.value = ''; // 초기화
        }
      });
    }
    return fetchProjectImages(Number(projectIdParam));
  }

  // 2. (옵션) 퍼블릭 페이지 등에서 파일명으로 구분해야 할 경우
  if (window.location.pathname.includes('project-gallery.html')) {
    // 예시: URL에서 프로젝트 ID를 가져오거나 기본값(1)을 사용
    const projectId = Number(urlParams.get('projectId')) || 1;
    return fetchProjectImages(projectId);
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        STATE.query = searchInput.value;
        search();
      }
    });
    const searchBtn = document.querySelector('[data-action="search"]');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        STATE.query = searchInput.value;
        search();
      });
    }
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      STATE.category = categoryFilter.value;
      search();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      STATE.sort = sortFilter.value;
      search();
    });
  }

  // 첫 로딩
  search();
}

// ---- 상세 이미지 업로드/삭제 핸들러 ----
async function handleGalleryImageUpload() {
  if (!currentModalItem) return;

  const input = document.getElementById('galleryUploadInput');
  const progressContainer = document.getElementById('galleryUploadProgress');
  const progressBar = progressContainer.querySelector('.progress');
  const uploadBtn = document.getElementById('galleryUploadBtn');

  if (!input.files || input.files.length === 0) {
    window.showNotice('업로드할 파일을 선택하세요.', 'warn');
    return;
  }

  const formData = new FormData();
  for (const file of input.files) {
    formData.append('files', file);
  }

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = '업로드 중...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '50%'; // 간단한 진행 표시

    const result = await window.apiFetch(
      `${API_BASE}/uploads/${currentModalItem.filename}/gallery`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const count = result?.count || 0;
    window.showNotice(
      count > 0
        ? `${count}개의 상세 이미지가 추가되었습니다.`
        : '상세 이미지가 추가되었습니다.',
      'success'
    );

    // 상태 업데이트 및 UI 갱신
    if (!currentModalItem.galleryImages) {
      currentModalItem.galleryImages = [];
    }
    if (result?.items) {
      currentModalItem.galleryImages.push(...result.items);
    }
    currentModalItem.galleryImages.sort((a, b) => a.order - b.order);

    renderModalGallery(); // 모달 갤러리 다시 렌더링
    fetchAdminImages(true); // 메인 그리드 새로고침 (뱃지 카운트 업데이트)
  } catch (err) {
    window.showNotice(`상세 이미지 업로드 실패: ${err.message}`, 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = '업로드';
    progressBar.style.width = '0%';
    progressContainer.style.display = 'none';
    input.value = ''; // 파일 입력 초기화
  }
}

// ---- 초기화 ----
function setupModalEvents() {
  const modal = document.getElementById('imageModal');
  if (!modal) return;
  const closeBtn = modal.querySelector('[data-close-modal]');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal());
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // 상세 이미지 삭제를 위한 이벤트 위임
  const galleryEl = document.getElementById('modalGallery');
  if (galleryEl) {
    galleryEl.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('[data-delete-gallery-id]');
      if (!deleteBtn) return;

      const galleryImageId = Number(deleteBtn.dataset.deleteGalleryId);
      if (isNaN(galleryImageId)) return;

      if (!confirm('이 상세 이미지를 정말 삭제하시겠습니까?')) return;

      try {
        await window.apiFetch(`${API_BASE}/uploads/gallery/${galleryImageId}`, {
          method: 'DELETE',
        });
        window.showNotice('상세 이미지가 삭제되었습니다.', 'success');

        // 상태 및 UI 업데이트
        currentModalItem.galleryImages = currentModalItem.galleryImages.filter(
          (img) => img.id !== galleryImageId
        );
        renderModalGallery(); // 모달 갤러리 다시 렌더링
        fetchAdminImages(true); // 메인 그리드 새로고침 (뱃지 카운트 업데이트)
      } catch (err) {
        window.showNotice(`상세 이미지 삭제 실패: ${err.message}`, 'error');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupControls();
  setupModalEvents();
  window.addEventListener('scroll', handleScrollForInfinite);
});
