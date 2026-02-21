/** API 기본 주소를 결정합니다. */
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

/** 프로젝트 목록 페이지의 전체 기능을 즉시 실행 함수로 관리합니다. */
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

  if (searchBtn && searchInput) {
    let searchTimeout;
    /** 검색어를 적용하고 API를 호출합니다. */
    const applySearch = () => {
      state.q = (searchInput.value || '').trim();
      fetchProjectsFromApi();
    };

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applySearch, 300);
    });

    searchBtn.addEventListener('click', applySearch);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        applySearch();
      }
    });
  }

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

  const state = {
    category: '', // '' = 전체보기
    sort: 'recent',
    q: '',
    items: [],
  };

  /** 총 개수를 업데이트합니다. */
  const updateTotal = (value) => {
    if (!totalEl) return;
    totalEl.textContent = value.toLocaleString();
  };

  /** "결과 없음" 메시지를 토글합니다. */
  const toggleEmpty = (isEmpty) => {
    if (!emptyEl) return;
    emptyEl.hidden = !isEmpty;
  };

  /** 프로젝트 데이터로 카드 DOM 요소를 생성합니다. */
  const createCard = (project) => {
    const li = document.createElement('li');
    li.className = 'project-item';

    const link = document.createElement('a');

    link.href = `./project-detail?id=${project.id}`;

    const imgWrap = document.createElement('div');
    imgWrap.className = 'img';

    const img = document.createElement('img');
    img.src = project.mainImage || 'https://placehold.co/270x170?text=No+Image';
    img.alt = project.title || project.name;
    img.loading = 'lazy';

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

  /** 현재 상태에 따라 보여줄 아이템 목록을 필터링하고 정렬합니다. */
  const getVisibleItems = () => {
    let items = [...state.items];
    if (state.q) {
      const keyword = state.q.toLowerCase();
      items = items.filter((p) => {
        return p.title.toLocaleLowerCase().includes(keyword);
      });
    }

    if (state.category) {
      items = items.filter((p) => p.rawCategory === state.category);
    }

    if (state.sort === 'recent') {
      items.sort(
        (a, b) =>
          (b.createdAt ?? 0) - (a.createdAt ?? 0) || (b.id || 0) - (a.id || 0),
      );
    } else if (state.sort === 'oldest') {
      items.sort(
        (a, b) =>
          (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id || 0) - (b.id || 0),
      );
    }

    return items;
  };

  /** 필터링된 프로젝트 목록을 화면에 렌더링합니다. */
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

  /** API 서버에서 프로젝트 목록을 가져와 상태를 업데이트하고 렌더링합니다. */
  const fetchProjectsFromApi = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error('목록 조회 실패');

      const data = await res.json();
      const projects = data.data || [];

      state.items = projects.map((p) => {
        let thumb = 'https://placehold.co/270x170?text=No+Image';
        if (p.mainImage) {
          thumb = p.mainImage;
        } else if (p.images && p.images.length > 0) {
          thumb = p.images[0].thumbUrl || p.images[0].originalUrl;
        }

        return {
          id: p.id,
          name: String(p.id),
          title: p.title || '제목 없음',
          rawCategory: p.category,
          category: p.category || '미분류',
          createdAt: p.createdAt ? new Date(p.createdAt).getTime() : null,
          mainImage: thumb,
        };
      });

      render();
      updateTotal(state.items.length);
    } catch (error) {
      console.error('🔥 API 요청 에러 발생!');
      state.items = [];
      render();
      updateTotal(0);
    }
  };

  /** 카테고리 필터 클릭 이벤트를 처리합니다. */
  const handleFilterClick = (event) => {
    const target = event.target.closest('.filter-item');
    if (!target) return;

    const category = target.dataset.category || '';

    if (category === state.category) return;

    filterList
      .querySelectorAll('.filter-item')
      .forEach((item) => item.classList.toggle('active', item === target));

    state.category = category;
    render();
  };

  if (filterList) {
    filterList.addEventListener('click', handleFilterClick);
  }

  fetchProjectsFromApi();
})();
