/* index.js - 최종 수정본 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 히어로 메인 슬라이더 (Fade 효과)
  initHeroSwiper();

  // 2. 프로젝트 리스트 (API 호출 + 무한 롤링)
  initProjectSwiper();

  // 3. 숫자 카운트 애니메이션
  initCountUp();

  // 4. 모바일 메뉴 아코디언
  initAccordion();

  // 5. 스크롤 등장 효과 (Reveal)
  initScrollReveal();
});

/**
 * [1] 히어로 슬라이더 (Swiper Fade)
 */
function initHeroSwiper() {
  // .hero-swiper 요소가 없으면 실행하지 않음 (에러 방지)
  if (!document.querySelector('.hero-swiper')) return;

  new Swiper('.hero-swiper', {
    // 1. 페이드 효과 설정
    effect: 'fade',
    fadeEffect: {
      crossFade: true, // 이미지가 겹치면서 부드럽게 전환됨
    },

    // 2. 시간 설정
    speed: 2000, // 2초 동안 천천히 바뀜
    loop: true, // 무한 반복

    autoplay: {
      delay: 5000, // 5초마다 자동 넘어감
      disableOnInteraction: false, // 클릭해도 멈추지 않음
    },

    // 3. 기타 설정
    allowTouchMove: false, // 마우스로 드래그 안 되게 (배경처럼 고정)
    pagination: {
      el: '.hero-pagination',
      clickable: true, // 점을 클릭하면 이동은 가능
    },
  });
}

/**
 * [2] 프로젝트 스와이퍼 통합 함수
 */
async function initProjectSwiper() {
  const listContainer = document.getElementById('project-swiper-list');
  if (!listContainer) return;

  const fetchProjects = async () => {
    if (typeof window.apiFetch === 'function') {
      return window.apiFetch('/projects');
    }

    // 기본 fetch fallback
    const res = await fetch('/api/projects');
    if (!res.ok) {
      throw new Error(`프로젝트 목록 요청 실패 (${res.status})`);
    }
    return res.json();
  };

  try {
    const data = await fetchProjects();
    const projects = data.projects || [];

    const validProjects = projects
      .filter((p) => p.mainImage || (p.images && p.images.length > 0))
      .slice(0, 10);

    if (validProjects.length === 0) {
      listContainer.innerHTML =
        '<li style="padding:20px; text-align:center; width:100%;">등록된 프로젝트가 없습니다.</li>';
      return;
    }

    // B. DOM 렌더링
    const html = validProjects
      .map((p) => {
        let thumbSrc = p.mainImage;
        if (!thumbSrc && p.images && p.images.length > 0) {
          thumbSrc = p.images[0].thumbUrl || p.images[0].originalUrl;
        }
        if (!thumbSrc) thumbSrc = 'https://placehold.co/300x200?text=No+Image';

        return `
    <li class="img-card">
       <a href="/project/project-detail.html?id=${p.id}">
        <img 
          src="${thumbSrc}" 
          alt="${p.title}" 
          class="project-thumb"
        />
        <div class="project-overlay">
          ${p.title}
        </div>
      </a>
    </li>
  `;
      })
      .join('');

    listContainer.innerHTML = html;

    // C. 이미지 로드 대기 후 애니메이션 시작
    const images = listContainer.querySelectorAll('img');
    let loadedCount = 0;

    const checkStart = () => {
      loadedCount++;
      if (loadedCount >= images.length) startInfiniteSwiper(listContainer);
    };

    if (images.length === 0) {
      startInfiniteSwiper(listContainer);
    } else {
      images.forEach((img) => {
        if (img.complete) checkStart();
        else {
          img.onload = checkStart;
          img.onerror = checkStart;
        }
      });
    }
  } catch (err) {
    console.error('Swiper 데이터 로드 실패:', err);
    listContainer.innerHTML =
      '<li style="padding:20px; text-align:center; width:100%; color:#999;">프로젝트를 불러오지 못했습니다.</li>';
  }
}

/**
 * [2-1] 무한 롤링 애니메이션 로직
 */
function startInfiniteSwiper(track) {
  if (track.dataset.swiperInit === 'true') return;

  const slides = Array.from(track.children);
  if (slides.length < 2) return;

  track.dataset.swiperInit = 'true';

  track.style.display = 'flex';
  track.style.flexWrap = 'nowrap';
  track.style.alignItems = 'center';
  track.style.willChange = 'transform';
  track.style.width = 'max-content';

  const clones = slides.map((slide) => {
    const clone = slide.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  });

  clones.forEach((clone) => track.appendChild(clone));

  let x = 0;
  let animationId = null;
  const speed = 0.5;

  function animate() {
    x -= speed;
    if (Math.abs(x) >= track.scrollWidth / 2) {
      x = 0;
    }
    track.style.transform = `translateX(${x}px)`;
    animationId = requestAnimationFrame(animate);
  }

  const handleVisibility = () => {
    if (document.hidden) cancelAnimationFrame(animationId);
    else animate();
  };

  document.addEventListener('visibilitychange', handleVisibility);
  animate();
}

/**
 * [3] 숫자 카운트 업
 */
function initCountUp() {
  const $targets = document.querySelectorAll('[data-stat]');
  if (!$targets.length) return;

  const formatNumber = (n, el) => {
    return el.dataset.format === 'comma' ? n.toLocaleString() : String(n);
  };

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const animateCount = (el) => {
    if (el.dataset.counted === 'true') return;

    const target = Number(el.dataset.stat) || 0;
    const duration = 1200;
    const startValue = 0;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const current = startValue + (target - startValue) * easeOut(t);
      el.textContent = formatNumber(Math.round(current), el);

      if (t < 1) requestAnimationFrame(step);
      else {
        el.textContent = formatNumber(target, el);
        el.dataset.counted = 'true';
      }
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  $targets.forEach((el) => observer.observe(el));
}

/**
 * [4] 아코디언 (모바일 메뉴)
 */
function initAccordion() {
  const toggleBtn = document.querySelector('.mobile-toggle-btn');
  const mobileMenu = document.querySelector('.mobile-menu');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (mobileMenu) mobileMenu.classList.toggle('active');
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        const isOpen = mobileMenu?.classList.contains('active');
        icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
      }
    });
  }

  const titles = document.querySelectorAll('.mobile-menu-title');
  titles.forEach((title) => {
    title.addEventListener('click', (e) => {
      e.preventDefault();
      titles.forEach((t) => t !== title && t.classList.remove('active'));
      title.classList.toggle('active');
    });
  });
}

/**
 * [5] 스크롤 등장 효과 (Reveal)
 */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    },
    { threshold: 0.15 }
  );

  reveals.forEach((el) => revealObserver.observe(el));
}

/**
 * [6] 페이지 상단 이동 버튼 (Scroll-to-Top)
 */function initScrollToTop() {
  const scrollBtn = document.createElement('button');
  scrollBtn.className = 'scroll-to-top';
  scrollBtn.innerHTML = '↑';
  scrollBtn.setAttribute('aria-label', '페이지 상단으로 이동');
  scrollBtn.style.display = 'none';
  document.body.appendChild(scrollBtn);

  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      scrollBtn.style.display = 'flex';
    } else {
      scrollBtn.style.display = 'none';
    }
  });
}

// 스크롤 투 탑 초기화
initScrollToTop();
