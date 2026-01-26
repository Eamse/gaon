// [TODO]
// 1. project-data.js 통합 또는 분리 결정 (지금은 임시로 통합)
// 2. API 응답 형식 확정 후 데이터 매핑 강화
// 3. 상담신청, 공유하기 기능 구현

/**
 * 프로젝트 상세 페이지 스크립트
 * @version 2.0.0
 * @author Your Name
 */
(() => {
  'use strict';

  /**
   * API 기본 주소를 결정합니다.
   * @returns {string} API base URL
  */
  const resolveApiBase = () => {
    if (window.WOOJIN_API_BASE) {
      return window.WOOJIN_API_BASE.replace(/\/$/, '');
    }
    if (window.location.origin && window.location.origin !== 'null') {
      return `${window.location.origin.replace(/\/$/, '')}/api`;
    }
    return 'https://gaoninterior.kr/api';
  };

  const API_BASE = resolveApiBase();

  /**
   * 페이지에서 사용할 DOM 요소를 객체로 관리합니다.
   */
  const dom = {
    container: document.querySelector('.project-detail-container'),
    title: document.querySelector('[data-project-title]'),
    areaBadge: document.querySelector('[data-project-area-badge]'),
    description: document.querySelector('[data-project-description]'),
    mainImage: document.querySelector('[data-main-image]'),
    thumbnailList: document.querySelector('[data-thumbnail-list]'),
    category: document.querySelector('[data-project-category]'),
    year: document.querySelector('[data-project-year]'),
    period: document.querySelector('[data-project-period]'),
    area: document.querySelector('[data-project-area]'),
    price: document.querySelector('[data-project-price]'),
    priceBreakdown: document.querySelector('[data-price-breakdown]'),
    consultButton: document.getElementById('btn-consult'),
    shareButton: document.getElementById('btn-share'),
  };

  /**
   * 로딩 상태를 UI에 반영합니다.
   * @param {boolean} isLoading - 로딩 중 여부
   */
  const setLoading = (isLoading) => {
    document.body.classList.toggle('loading', isLoading);
    if (dom.container) {
      dom.container.style.visibility = isLoading ? 'hidden' : 'visible';
    }
  };

  /**
   * 숫자를 통화 형식(원)으로 포맷팅합니다.
   * @param {number} num - 포맷팅할 숫자
   * @returns {string} 포맷팅된 문자열 (예: "81,000,000원")
   */
  const formatCurrency = (num) => {
    if (typeof num !== 'number' || isNaN(num)) {
      return '가격 정보 없음';
    }
    return `${num.toLocaleString('ko-KR')}원`;
  };

  /**
   * 평수를 제곱미터(m²)로 변환하여 함께 표시합니다.
   * @param {number} m2 - 면적 (m²)
   * @returns {string} 변환된 문자열 (예: "211.57m² (64평)")
   */
  const formatArea = (m2) => {
    if (typeof m2 !== 'number' || isNaN(m2)) {
      return '면적 정보 없음';
    }
    const pyeong = m2 / 3.305785;
    return `${m2.toFixed(2)}m² (${pyeong.toFixed(1)}평)`;
  };

  /**
   * 갤러리 이미지들을 렌더링합니다.
   * @param {Array<object>} images - 이미지 정보 배열
   */
  const renderGallery = (galleryItems) => {
    if (!galleryItems || galleryItems.length === 0) {
      dom.mainImage.src =
        'https://placehold.co/1200x800/eeeeee/ffffff?text=No+Image';
      dom.mainImage.alt = '이미지가 없습니다.';
      dom.thumbnailList.innerHTML = '';
      return;
    }

    // 첫 이미지를 메인으로 설정 (개선된 로딩 전략)
    const firstImage = galleryItems[0];
    const lowResSrc =
      firstImage.thumbUrl ||
      'https://placehold.co/1200x800/eeeeee/ffffff?text=Loading...';
    const highResSrc = firstImage.originalUrl;

    // 1. 먼저 저화질 썸네일 이미지를 빠르게 표시
    dom.mainImage.src = lowResSrc;
    dom.mainImage.alt = firstImage.alt || '메인 시공 이미지';

    // 2. 고화질 이미지를 백그라운드에서 로드
    const highResImage = new Image();
    highResImage.onload = () => {
      // 3. 로드가 완료되면 메인 이미지 소스를 고화질로 교체
      dom.mainImage.src = highResSrc;
    };
    highResImage.src = highResSrc;

    // 썸네일 리스트 생성
    dom.thumbnailList.innerHTML = galleryItems
      .map((img, index) => {
        const isActive = index === 0 ? 'active' : '';
        const thumbSrc = img.thumbUrl || 'https://placehold.co/90x60?text=...';
        return `
        <li>
          <button class="thumbnail-button ${isActive}" data-index="${index}">
            <img src="${thumbSrc}" alt="${img.alt || `썸네일 ${index + 1}`}" />
          </button>
        </li>
      `;
      })
      .join('');
  };

  /**
   * 프로젝트 상세 정보를 페이지에 렌더링합니다.
   * @param {object} project - 프로젝트 데이터
   */
  const renderProjectDetails = (project) => {
    const pyeong = project.area ? (project.area / 3.305785).toFixed(1) : 0;

    dom.title.textContent = project.title || '제목 없음';
    dom.description.textContent =
      project.description || '이 프로젝트에 대한 상세 설명이 준비중입니다.';
    dom.areaBadge.textContent = `${pyeong}평`;

    dom.category.textContent = project.category || '-';
    dom.year.textContent = project.year ? `${project.year}년` : '-';
    dom.period.textContent = project.period || '-';
    dom.area.textContent = formatArea(project.area);
    dom.price.textContent = project.price
      ? `${project.price.toLocaleString('ko-KR')}만원`
      : '견적 문의';

    // 상세 견적 내역 렌더링 (동적 데이터)
    if (project.costs && project.costs.length > 0) {
      const breakdownHtml = project.costs
        .map((cost) => {
          // DB에는 '만원' 단위로 저장되어 있다고 가정 (admin-projects.js 로직상)
          // 화면 표시를 위해 원 단위로 변환하거나 만원 단위 그대로 표시
          // 여기서는 '만원' 단위 값을 받아서 '원'으로 변환하여 표시하는 예시
          const amountInWon = (cost.amount || 0) * 10000;
          return `
          <li>
            <span style="color: #4b5563;">${cost.label}</span> 
            <span style="font-weight: 600;">${formatCurrency(
            amountInWon
          )}</span>
          </li>
        `;
        })
        .join('');

      dom.priceBreakdown.innerHTML = breakdownHtml;
    } else {
      dom.priceBreakdown.innerHTML =
        '<li style="justify-content: center; color: #9ca3af;">등록된 상세 견적이 없습니다.</li>';
    }

    // 갤러리에 표시할 이미지 목록 구성
    // mainImage가 있으면 맨 앞에, 그 뒤로 나머지 images 배열 추가
    const galleryItems = [];
    if (project.mainImage) {
      // mainImage는 URL 문자열이므로, 다른 이미지 객체와 형식을 맞춰줘야 함.
      const mainImageOriginalUrl = project.mainImage;
      const mainImageThumbUrl = mainImageOriginalUrl.includes('/original/')
        ? mainImageOriginalUrl.replace('/original/', '/thumb/')
        : mainImageOriginalUrl;

      galleryItems.push({
        originalUrl: mainImageOriginalUrl,
        thumbUrl: mainImageThumbUrl,
        alt: `${project.title} 대표 이미지`,
      });
    }

    if (project.images && project.images.length > 0) {
      const existingUrls = new Set(galleryItems.map((img) => img.originalUrl));
      project.images.forEach((img) => {
        if (!existingUrls.has(img.originalUrl)) {
          galleryItems.push(img);
        }
      });
    }

    renderGallery(galleryItems);
    // 이벤트 리스너에 최종 갤러리 아이템 목록을 전달
    dom.thumbnailList.addEventListener('click', (e) =>
      handleThumbnailClick(e, galleryItems)
    );

    // 메인 이미지 클릭 시 확대 모달
    dom.mainImage.addEventListener('click', () => {
      showImageZoomModal(dom.mainImage.src, dom.mainImage.alt);
    });
    dom.mainImage.style.cursor = 'pointer';
  };

  /**
   * 이미지 확대 모달 표시
   */
  const showImageZoomModal = (imageUrl, imageAlt) => {
    const modal = document.createElement('div');
    modal.className = 'image-zoom-modal';
    modal.innerHTML = `
      <div class="zoom-backdrop">
        <button class="close-zoom" aria-label="닫기">&times;</button>
        <img src="${imageUrl}" alt="${imageAlt}" class="zoom-image" />
      </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
      modal.remove();
      document.body.style.overflow = '';
    };

    modal.querySelector('.close-zoom').addEventListener('click', closeModal);
    modal.querySelector('.zoom-backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('zoom-backdrop')) closeModal();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });
  };

  /**
   * 오류 상황을 UI에 표시합니다.
   * @param {string} message - 표시할 오류 메시지
   */
  const renderError = (message) => {
    dom.title.textContent = '오류';
    dom.description.textContent = message;
    renderGallery([]); // 이미지 없음 처리
    // 사이드바 정보도 비워주는 것이 좋음
    Object.entries(dom).forEach(([key, el]) => {
      if (
        ['category', 'year', 'period', 'area', 'price', 'areaBadge'].includes(
          key
        )
      ) {
        el.textContent = '-';
      }
    });
  };

  /**
   * 썸네일 클릭 이벤트를 처리합니다.
   * @param {Event} event - 클릭 이벤트 객체
   */
  const handleThumbnailClick = (event, images) => {
    const button = event.target.closest('.thumbnail-button');
    if (!button) return;

    const index = parseInt(button.dataset.index, 10);
    if (isNaN(index) || !images[index]) return;

    const clickedImage = images[index];
    const lowResSrc =
      clickedImage.thumbUrl ||
      'https://placehold.co/1200x800/eeeeee/ffffff?text=Loading...';
    const highResSrc = clickedImage.originalUrl;

    // 메인 이미지 변경
    dom.mainImage.style.opacity = '0';
    setTimeout(() => {
      // 1. 먼저 저화질 이미지로 빠르게 교체
      dom.mainImage.src = lowResSrc;
      dom.mainImage.alt = clickedImage.alt || '메인 시공 이미지';
      dom.mainImage.style.opacity = '1';

      // 2. 고화질 이미지를 백그라운드에서 로드하여 교체
      const highResImage = new Image();
      highResImage.onload = () => {
        if (dom.mainImage.src === lowResSrc) dom.mainImage.src = highResSrc;
      };
      highResImage.src = highResSrc;
    }, 200);

    // 활성 썸네일 표시 변경
    dom.thumbnailList.querySelector('.active')?.classList.remove('active');
    button.classList.add('active');
  };

  /**
   * API를 통해 프로젝트 데이터를 가져옵니다.
   * @param {string} projectId - 프로젝트 ID
   * @returns {Promise<object>} 프로젝트 데이터
   */
  const fetchProject = async (projectId) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`);

    if (res.status === 404) {
      throw new Error('해당 ID의 프로젝트를 찾을 수 없습니다.');
    }
    if (!res.ok) {
      throw new Error(`서버 요청에 실패했습니다. (상태: ${res.status})`);
    }

    const data = await res.json();
    return data.project;
  };

  /**
   * 페이지 초기화 함수
   */
  const init = async () => {
    setLoading(true);

    const projectId = new URLSearchParams(window.location.search).get('id');
    if (!projectId) {
      renderError('프로젝트 ID가 URL에 지정되지 않았습니다.');
      setLoading(false);
      return;
    }

    try {
      const project = await fetchProject(projectId);
      if (!project) {
        throw new Error('프로젝트 데이터가 비어있습니다.');
      }
      renderProjectDetails(project);

      dom.consultButton.addEventListener('click', () => {
        // 상담 페이지로 이동 (프로젝트 제목을 쿼리 파라미터로 전달하면 더 좋습니다)
        // layout.js 구조상 consulting 폴더가 별도로 있으므로 상위 경로로 이동
        const consultUrl = `../consulting/consulting.html?ref_project=${encodeURIComponent(
          project.title
        )}`;
        window.location.href = consultUrl;
      });

      dom.shareButton.addEventListener('click', async () => {
        const url = window.location.href;

        // 1) Web Share API 우선 시도
        if (navigator.share) {
          try {
            await navigator.share({
              title: document.title || '',
              url,
            });
            return;
          } catch (err) {
            console.error('navigator.share 실패:', err);
          }
        }

        // 2) HTTPS 컨텍스트에서 클립보드 API 사용
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(url);
            alert('링크가 클립보드에 복사되었습니다.');
            return;
          } catch (err) {
            console.error('navigator.clipboard.writeText 실패:', err);
          }
        }

        // 3) 폴백: 프롬프트로 수동 복사 안내
        const fallbackMessage =
          '이 링크를 복사해서 사용해주세요.\n(단축키: Cmd+C 또는 Ctrl+C)';
        window.prompt(fallbackMessage, url);
      });
    } catch (error) {
      console.error('페이지 초기화 중 오류 발생:', error);
      renderError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 페이지 로드 시 초기화 함수 실행
  document.addEventListener('DOMContentLoaded', init);
})();
