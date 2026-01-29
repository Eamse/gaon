// project.js
const resolveApiBase = () => {
  const meta = document.querySelector('meta[name="gaon-api-base"]');
  if (meta?.content) {
    return meta.content.replace(/\/$/, '');
  }
  if (window.location.origin && window.location.origin !== 'null') {
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }
  return 'https://gaoninterior.kr/api';
};
const API_BASE = resolveApiBase();

(() => {
  const gridEl = document.querySelector('[data-project-grid]');
  const emptyEl = document.querySelector('[data-project-empty]');
  const totalEl = document.querySelector('[data-total-count]');
  const filterList = document.querySelector('[data-filter-list]');
  const searchInput = document.querySelector('[data-search-input]');
  const searchBtn = document.querySelector('[data-search-button]');
  const sortBox = document.querySelector('[data-sort]');
  const sortList = document.querySelector('[data-sort-list]');
  const sortLabel = document.querySelector('[data-sort-label]');

  // 검색 (디바운싱 적용)
  if (searchBtn && searchInput) {
    let searchTimeout;
    const applySearch = () => {
      state.q = (searchInput.value || '').trim();
      fetchProjectsFromApi();
    };

    // 타이핑 중 디바운싱
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applySearch, 300);
    });

    // 버튼 클릭 시 즉시 검색
    searchBtn.addEventListener('click', applySearch);

    // Enter 키도 즉시 검색
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        applySearch();
      }
    });
  }

  // 정렬 선택
  if (sortList && sortLabel) {
    sortList.querySelectorAll('button[data-sort-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.sortValue || 'recent';
        state.sort = value;
        sortLabel.textContent = value === 'recent' ? '최신순' : '오래된 순';
        fetchProjectsFromApi();
        sortBox?.classList.remove('open');
      });
    });
  }

  // 정렬 드롭다운 열기/닫기
  if (sortBox && sortList) {
    const toggleBtn = sortBox.querySelector('.sort-btn');
    const closeAll = () => sortBox.classList.remove('open');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortBox.classList.toggle('open');
      });
    }
    document.addEventListener('click', (e) => {
      if (!sortBox.contains(e.target)) closeAll();
    });
  }

  if (!gridEl) return;
  // 1) 상태 값
  const state = {
    category: '', // '' = 전체보기
    sort: 'recent',
    q: '',
    items: [],
  };

  const updateTotal = (value) => {
    if (!totalEl) return;
    totalEl.textContent = value.toLocaleString();
  };

  const toggleEmpty = (isEmpty) => {
    if (!emptyEl) return;
    emptyEl.hidden = !isEmpty;
  };

  // 2) 카드 하나 생성
  const createCard = (project) => {
    const li = document.createElement('li');
    li.className = 'project-item';

    const link = document.createElement('a');

    // ✅ 이제 name이 아니라 id로 라우팅
    link.href = `./project-detail?id=${project.id}`;

    const imgWrap = document.createElement('div');
    imgWrap.className = 'img';

    const img = document.createElement('img');
    img.src = project.mainImage || 'https://placehold.co/270x170?text=No+Image';
    img.alt = project.title || project.name;
    img.loading = 'lazy'; // 레이지 로딩 추가


    imgWrap.appendChild(img);
    link.appendChild(imgWrap);

    if (project.title) {
      const caption = document.createElement('p');
      caption.className = 'project-title';
      caption.textContent = project.title;
      link.appendChild(caption);
    }

    li.appendChild(link);
    return li;
  };

  // 3) 상태(state)에 맞는 리스트 필터링
  const getVisibleItems = () => {
    let items = [...state.items];
    //검색 필터링 로직
    if (state.q) {
      const keyword = state.q.toLowerCase();
      items = items.filter((p) => {
        return p.title.toLocaleLowerCase().includes(keyword);
      });
    }

    // 카테고리 필터
    if (state.category) {
      items = items.filter((p) => p.rawCategory === state.category);
    }

    // 정렬 (지금은 createdAt 없으니까 id 기준으로만)
    if (state.sort === 'recent') {
      items.sort(
        (a, b) =>
          (b.createdAt ?? 0) - (a.createdAt ?? 0) || (b.id || 0) - (a.id || 0)
      );
    } else if (state.sort === 'oldest') {
      items.sort(
        (a, b) =>
          (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id || 0) - (b.id || 0)
      );
    }

    return items;
  };

  // 4) 실제 렌더링
  const render = () => {
    const visible = getVisibleItems();
    gridEl.innerHTML = '';

    if (!visible.length) {
      toggleEmpty(true);
      updateTotal(0);
      return;
    }

    toggleEmpty(false);
    visible.forEach((project) => {
      gridEl.appendChild(createCard(project));
    });

    updateTotal(visible.length);
  };

  const fetchProjectsFromApi = async () => {
    try {
      // 1) 쿼리스트링 만들기
      // 현재 API 구조상 전체 목록을 불러온 뒤 클라이언트에서 필터링하거나,
      // API가 지원한다면 파라미터를 보냅니다. 여기서는 전체를 불러옵니다.
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error('목록 조회 실패');

      const data = await res.json();
      // 백엔드가 { ok: true, data: [...] } 형태로 반환
      const projects = data.data || [];

      // 3) 응답 -> state.items로 변환
      state.items = projects.map((p) => {
        // 썸네일 찾기
        let thumb = 'https://placehold.co/270x170?text=No+Image';
        if (p.mainImage) {
          thumb = p.mainImage;
        } else if (p.images && p.images.length > 0) {
          thumb = p.images[0].thumbUrl || p.images[0].originalUrl;
        }

        return {
          id: p.id,
          name: String(p.id), // name 대신 id 사용
          title: p.title || '제목 없음',
          rawCategory: p.category, // 필터링을 위한 원본 카테고리
          category: p.category || '미분류', // 화면 표기용
          createdAt: p.createdAt ? new Date(p.createdAt).getTime() : null,
          mainImage: thumb,
        };
      });

      // 4) 화면 다시 그리기
      render();
      updateTotal(state.items.length);
    } catch (error) {
      console.error('🔥 API 요청 에러 발생!');
      state.items = [];
      render();
      updateTotal(0);
    }
  };

  // 5) 왼쪽 카테고리 클릭 핸들러
  const handleFilterClick = (event) => {
    const target = event.target.closest('.filter-item');
    if (!target) return;

    const category = target.dataset.category || '';

    // 이미 선택된 카테고리면 무시
    if (category === state.category) return;

    // active 클래스 토글
    filterList
      .querySelectorAll('.filter-item')
      .forEach((item) => item.classList.toggle('active', item === target));

    state.category = category;
    render();
  };

  if (filterList) {
    filterList.addEventListener('click', handleFilterClick);
  }

  // 초기 렌더
  fetchProjectsFromApi();
})();
