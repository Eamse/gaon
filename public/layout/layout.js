const layoutAssetBase = (() => {
  const current = document.currentScript;
  if (current?.src) {
    return new URL('./', current.src);
  }
  const scripts = document.querySelectorAll('script[src]');
  for (let i = scripts.length - 1; i >= 0; i -= 1) {
    const src = scripts[i].src;
    if (src?.includes('/layout/layout.js')) {
      return new URL('./', src);
    }
  }
  return new URL('./layout/', window.location.href);
})();
const siteAssetBase = new URL('../', layoutAssetBase);

// -------------------------------------
// 레이아웃 로드 (헤더/네비)
// -------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  function loadHeaderLayout() {
    const headerUrl = new URL('layout-header.html', layoutAssetBase);
    fetch(headerUrl)
      .then((res) => res.text())
      .then((data) => {
        const header = document.getElementById('layout-header');
        if (header) {
          header.innerHTML = data;
          resolveHeaderLinks(header);
          initializeHeaderInteractions(header);
        }
      })
      .catch((err) => console.error('Header load error:', err));
  }

  function loadNavLayout() {
    const footerUrl = new URL('layout-footer.html', layoutAssetBase);
    fetch(footerUrl)
      .then((res) => res.text())
      .then((data) => {
        const nav = document.getElementById('layout-footer');
        if (nav) {
          nav.innerHTML = data;
        }
      })
      .catch((err) => console.error('Nav load error:', err));
  }

  loadHeaderLayout();
  loadNavLayout();
});

function resolveHeaderLinks(container) {
  if (!container) return;

  const linkMap = {
    home: '../',
    project: 'project/',
    progress: 'progress/',
    consulting: 'consulting/',
    about: 'about/',
  };

  container.querySelectorAll('[data-layout-link]').forEach((anchor) => {
    const key = anchor.dataset.layoutLink;
    const target = linkMap[key];
    if (!target) return;

    const url = new URL(target, siteAssetBase);
    anchor.setAttribute('href', url.pathname + url.search + url.hash);
  });
}

function initializeHeaderInteractions(container) {
  if (!container || container.dataset.headerBound === 'true') return;

  const menuList = container.querySelector('.mobile-menu-list');
  const toggleBtn = container.querySelector('.mobile-toggle-btn');

  if (!menuList || !toggleBtn) return;

  container.dataset.headerBound = 'true';

  if (!menuList.id) {
    menuList.id = 'mobile-menu';
  }
  toggleBtn.setAttribute('aria-controls', menuList.id);
  toggleBtn.setAttribute('aria-expanded', 'false');

  const closeMenu = () => {
    if (!menuList.classList.contains('active')) return;
    menuList.classList.remove('active');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.classList.remove('is-active');
  };

  const openMenu = () => {
    if (menuList.classList.contains('active')) return;
    menuList.classList.add('active');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.classList.add('is-active');
  };

  const toggleMenu = () => {
    if (menuList.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  toggleBtn.addEventListener('click', toggleMenu);

  menuList.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1050) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}
