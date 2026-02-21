(() => {
  'use strict';

  /** API 기본 주소를 결정합니다. */
  const resolveApiBase = () => {
    if (window.GAON_API_BASE) {
      return window.GAON_API_BASE.replace(/\/$/, '');
    }
    if (window.location.origin && window.location.origin !== 'null') {
      return `${window.location.origin.replace(/\/$/, '')}/api`;
    }
    return 'https://gaoninterior.kr/api';
  };

  const API_BASE = resolveApiBase();

  /** 페이지에서 사용할 DOM 요소를 객체로 관리합니다. */
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

  /** 로딩 상태를 UI에 반영합니다. */
  const setLoading = (isLoading) => {
    document.body.classList.toggle('loading', isLoading);
    if (dom.container) {
      dom.container.style.visibility = isLoading ? 'hidden' : 'visible';
    }
  };

  /** 숫자를 통화 형식(원)으로 포맷팅합니다. */
  const formatCurrency = (num) => {
    if (typeof num !== 'number' || isNaN(num)) {
      return '가격 정보 없음';
    }
    return `${num.toLocaleString('ko-KR')}원`;
  };

  /** 평수를 제곱미터(m²)로 변환하여 함께 표시합니다. */
  const formatArea = (m2) => {
    if (typeof m2 !== 'number' || isNaN(m2)) {
      return '면적 정보 없음';
    }
    const pyeong = m2 / 3.305785;
    return `${m2.toFixed(2)}m² (${pyeong.toFixed(1)}평)`;
  };

  /** 갤러리 이미지들을 렌더링합니다. */
  const renderGallery = (galleryItems) => {
    if (!galleryItems || galleryItems.length === 0) {
      dom.mainImage.src =
        'https://placehold.co/1200x800/eeeeee/ffffff?text=No+Image';
      dom.mainImage.alt = '이미지가 없습니다.';
      dom.thumbnailList.innerHTML = '';
      return;
    }

    const firstImage = galleryItems[0];
    const lowResSrc =
      firstImage.thumbUrl ||
      'https://placehold.co/1200x800/eeeeee/ffffff?text=Loading...';
    const highResSrc = firstImage.originalUrl;

    dom.mainImage.src = lowResSrc;
    dom.mainImage.alt = firstImage.alt || '메인 시공 이미지';

    const highResImage = new Image();
    highResImage.onload = () => {
      dom.mainImage.src = highResSrc;
    };
    highResImage.src = highResSrc;

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

  /** 프로젝트 상세 정보를 페이지에 렌더링합니다. */
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

    if (project.costs && project.costs.length > 0) {
      const breakdownHtml = project.costs
        .map((cost) => {
          const amountInWon = (cost.amount || 0) * 10000;
          return `
          <li>
            <span style="color: #4b5563;">${cost.label}</span> 
            <span style="font-weight: 600;">${formatCurrency(
              amountInWon,
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

    const galleryItems = [];
    if (project.mainImage) {
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
      project.images.forEach((img, index) => {
        if (!existingUrls.has(img.originalUrl)) {
          const altText =
            img.alt ||
            `${project.title} - ${project.category || '인테리어'} 상세 이미지 ${index + 1}`;

          galleryItems.push({
            ...img,
            alt: altText,
          });
        }
      });
    }

    renderGallery(galleryItems);
    dom.thumbnailList.addEventListener('click', (e) =>
      handleThumbnailClick(e, galleryItems),
    );

    dom.mainImage.addEventListener('click', () => {
      showImageZoomModal(dom.mainImage.src, dom.mainImage.alt);
    });
    dom.mainImage.style.cursor = 'pointer';
  };

  /** 이미지 확대 모달을 표시합니다. */
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

  /** 오류 상황을 UI에 표시합니다. */
  const renderError = (message) => {
    dom.title.textContent = '오류';
    dom.description.textContent = message;
    renderGallery([]); // 이미지 없음 처리
    Object.entries(dom).forEach(([key, el]) => {
      if (
        ['category', 'year', 'period', 'area', 'price', 'areaBadge'].includes(
          key,
        )
      ) {
        el.textContent = '-';
      }
    });
  };

  /** 썸네일 클릭 이벤트를 처리합니다. */
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

    dom.mainImage.style.opacity = '0';
    setTimeout(() => {
      dom.mainImage.src = lowResSrc;
      dom.mainImage.alt = clickedImage.alt || '메인 시공 이미지';
      dom.mainImage.style.opacity = '1';

      const highResImage = new Image();
      highResImage.onload = () => {
        if (dom.mainImage.src === lowResSrc) dom.mainImage.src = highResSrc;
      };
      highResImage.src = highResSrc;
    }, 200);

    dom.thumbnailList.querySelector('.active')?.classList.remove('active');
    button.classList.add('active');
  };

  /** API를 통해 프로젝트 데이터를 가져옵니다. */
  const fetchProject = async (projectId) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`);

    if (res.status === 404) {
      throw new Error('해당 ID의 프로젝트를 찾을 수 없습니다.');
    }
    if (!res.ok) {
      throw new Error(`서버 요청에 실패했습니다. (상태: ${res.status})`);
    }

    const data = await res.json();
    return data.data;
  };

  /** 페이지 초기화 함수 */
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
        const consultUrl = `../consulting?ref_project=${encodeURIComponent(
          project.title,
        )}`;
        window.location.href = consultUrl;
      });

      dom.shareButton.addEventListener('click', async () => {
        const url = window.location.href;

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

        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(url);
            alert('링크가 클립보드에 복사되었습니다.');
            return;
          } catch (err) {
            console.error('navigator.clipboard.writeText 실패:', err);
          }
        }

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

  document.addEventListener('DOMContentLoaded', init);
})();
