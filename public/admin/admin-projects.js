// src/admin-projects.js

// [추가] 토큰이 없으면 로그인 페이지로 강제 이동
if (!localStorage.getItem('token')) {
  alert('로그인이 만료되었거나 필요합니다.\n로그인 페이지로 이동합니다.');
  window.location.replace('/src/admin-login.html');
}

// 전역 변수로 프로젝트 데이터 저장
let allProjects = [];

// 프로젝트 목록 불러오기
async function fetchProjects() {
  try {
    const data = await window.apiFetch('/projects');
    allProjects = data.projects || [];

    // 카테고리 필터 생성
    renderCategoryFilters();

    // 전체 목록 렌더링
    renderProjects(allProjects);
  } catch (err) {
    const listEl = document.getElementById('projectList');
    listEl.innerHTML = `<div style="color:red; text-align:center;">목록 로드 실패: ${err.message}</div>`;
  }
}

// 카테고리 필터 버튼 생성 및 이벤트 처리
function renderCategoryFilters() {
  const filterContainer = document.getElementById('categoryFilter');
  if (!filterContainer) return;

  // 중복 제거된 카테고리 목록 추출 (빈 값은 '미분류'로 처리)
  const categories = [
    '전체',
    ...new Set(
      allProjects.map((p) => (p.category ? p.category.trim() : '미분류'))
    ),
  ];

  filterContainer.innerHTML = categories
    .map(
      (cat) =>
        `<button type="button" class="filter-btn" style="padding: 6px 12px; border: 1px solid #d1d5db; background: #fff; border-radius: 20px; cursor: pointer; font-size: 14px;" onclick="filterProjects('${cat}')">${cat}</button>`
    )
    .join('');
}

// 전역 스코프에 필터 함수 노출 (HTML onclick에서 접근 가능하도록)
window.filterProjects = (category) => {
  if (category === '전체') {
    renderProjects(allProjects);
  } else {
    const filtered = allProjects.filter(
      (p) => (p.category ? p.category.trim() : '미분류') === category
    );
    renderProjects(filtered);
  }

  // 버튼 스타일 업데이트 (선택된 버튼 강조)
  const btns = document.querySelectorAll('#categoryFilter .filter-btn');
  btns.forEach((btn) => {
    if (btn.textContent === category) {
      btn.style.background = '#2563eb';
      btn.style.color = '#fff';
      btn.style.borderColor = '#2563eb';
    } else {
      btn.style.background = '#fff';
      btn.style.color = '#374151';
      btn.style.borderColor = '#d1d5db';
    }
  });
};

// 프로젝트 목록 렌더링 함수 (분리됨)
function renderProjects(projects) {
  const listEl = document.getElementById('projectList');
  listEl.innerHTML = '';

  if (projects.length === 0) {
    listEl.innerHTML =
      '<div style="text-align: center; color: #6b7280; padding: 20px;">등록된 프로젝트가 없습니다.</div>';
    return;
  }

  projects.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'project-item';

    const dateStr = new Date(p.createdAt).toLocaleDateString();
    let thumbHtml = `<div class="p-thumb-placeholder">이미지 없음</div>`;

    if (p.mainImage) {
      thumbHtml = `<img src="${p.mainImage}" alt="${p.title}" loading="lazy" />`;
    } else if (p.images && p.images.length > 0) {
      const img = p.images[0];
      const src = img.thumbUrl || img.originalUrl;
      if (src) {
        thumbHtml = `<img src="${src}" alt="${p.title}" loading="lazy" />`;
      }
    }

    item.innerHTML = `
        <div class="p-thumb">${thumbHtml}</div>
        <div class="p-content">
          <div class="p-header">
            <span class="p-id">#${p.id}</span>
            <span style="font-size:12px; color:#9ca3af;">${dateStr}</span>
          </div>
          <div class="p-title">${p.title}</div>
          <div class="p-meta-row">
            ${p.location ? `<span>📍 ${p.location}</span>` : ''}
            ${p.category ? `<span><strong>${p.category}</strong></span>` : ''}
            ${p.area ? `<span>${p.area} m²</span>` : ''}
          </div>
          <div class="p-desc">${p.description || '설명 없음'}</div>
          <div class="p-actions">
            <a href="/src/admin-gallery.html?projectId=${
              p.id
            }" class="btn-action btn-view">이미지 관리</a>
            <button class="btn-action btn-view" style="background:#f3f4f6; color:#4b5563;" data-action="edit" data-id="${
              p.id
            }">수정</button>
            <button class="btn-action btn-del" data-id="${p.id}">삭제</button>
          </div>
        </div>
      `;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', handleDelete);
  });
  listEl.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const project = projects.find((p) => p.id === id);
      if (project) handleEdit(project); // allProjects 대신 현재 렌더링된 projects에서 찾음
    });
  });
}

function handleEdit(project) {
  const form = document.getElementById('createForm');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const titleEl = document.querySelector('.form-title');

  form.id.value = project.id;
  form.title.value = project.title;
  form.location.value = project.location || '';
  form.description.value = project.description || '';
  form.category.value = project.category || '';
  form.year.value = project.year || '';
  form.period.value = project.period || '';
  form.area.value = project.area || '';

  // 견적 내역 렌더링
  renderCostInputs(project.costs || []);

  // 파일 입력 초기화 (보안상 파일 값은 설정 불가하므로 리셋)
  const mainInput = form.querySelector('input[name="mainImageFile"]');
  if (mainInput) mainInput.value = '';
  const detailInput = form.querySelector('input[name="detailImageFiles"]');
  if (detailInput) detailInput.value = '';

  titleEl.textContent = `프로젝트 #${project.id} 수정`;
  submitBtn.textContent = '수정 저장';
  cancelBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  const form = document.getElementById('createForm');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const titleEl = document.querySelector('.form-title');

  form.reset();
  form.id.value = '';
  renderCostInputs([]); // 견적 입력 초기화
  titleEl.textContent = '새 프로젝트 추가';
  submitBtn.textContent = '프로젝트 생성';
  cancelBtn.style.display = 'none';
}

async function handleFormSubmit(e) {
  e.preventDefault();
  console.log('🚀 폼 제출 시작');

  const form = e.target;
  const formData = new FormData(form);
  const id = formData.get('id');

  const forceLogout = () => {
    if (typeof window.logout === 'function') {
      window.logout();
    } else {
      localStorage.removeItem('token');
      window.location.href = '/src/admin-login.html';
    }
  };

  // 1. 이미지 업로드 처리
  let mainImageUrl = null;
  const mainImageFile = formData.get('mainImageFile');

  console.log('📸 대표 이미지 파일:', mainImageFile);

  if (mainImageFile && mainImageFile.size > 0) {
    try {
      console.log('⏳ 대표 이미지 업로드 요청...');
      const uploadData = new FormData();
      uploadData.append('file', mainImageFile);
      // window.apiFetch를 사용하여 에러 핸들링 강화
      // [수정] 주소: /upload -> /uploads, 응답 처리: data.url -> data.item.originalUrl
      const data = await window.apiFetch('/uploads', {
        method: 'POST',
        body: uploadData,
      });
      console.log('✅ 대표 이미지 업로드 성공:', data);
      if (data.item && data.item.originalUrl)
        mainImageUrl = data.item.originalUrl;
    } catch (err) {
      console.error('대표 이미지 업로드 실패:', err);
      const msg = err?.message || String(err);
      if (/token|authorized/i.test(msg)) {
        const shouldLogout = confirm(
          '로그인 세션이 만료되었습니다.\n확인을 누르시면 다시 로그인 페이지로 이동합니다.'
        );
        if (shouldLogout) {
          forceLogout();
        }
      } else {
        alert(
          `[대표 이미지 업로드 실패]\n\n에러 내용: ${msg}\n\n(서버가 켜져 있다면, uploads 폴더 생성 문제거나 파일 용량 초과일 수 있습니다.)`
        );
      }
      return;
    }
  }

  let detailImages = [];
  const detailInput = form.querySelector('input[name="detailImageFiles"]');
  const detailFiles = detailInput ? detailInput.files : [];

  console.log('📸 상세 이미지 파일 수:', detailFiles.length);

  if (detailFiles && detailFiles.length > 0) {
    try {
      console.log('⏳ 상세 이미지 업로드 요청...');
      const uploadData = new FormData();
      for (const file of detailFiles) {
        uploadData.append('files', file);
      }
      // window.apiFetch를 사용하여 에러 핸들링 강화
      // [수정] 주소: /uploads-multi, 응답 처리: data.items (전체 객체 저장)
      const data = await window.apiFetch('/uploads-multi', {
        method: 'POST',
        body: uploadData,
      });
      console.log('✅ 상세 이미지 업로드 성공:', data);
      if (data.items) detailImages = data.items;
    } catch (err) {
      console.error('상세 이미지 업로드 실패:', err);
      const msg = err?.message || String(err);
      if (/token|authorized/i.test(msg)) {
        const shouldLogout = confirm(
          '로그인 세션이 만료되었습니다.\n확인을 누르시면 다시 로그인 페이지로 이동합니다.'
        );
        if (shouldLogout) {
          forceLogout();
        }
      } else {
        alert(
          `[상세 이미지 업로드 실패]\n\n에러 내용: ${msg}\n\n(서버가 켜져 있다면, uploads 폴더 생성 문제거나 파일 용량 초과일 수 있습니다.)`
        );
      }
      return;
    }
  }

  // 견적 데이터 수집
  const costItems = [];
  const costRows = document.querySelectorAll('.cost-row');
  costRows.forEach((row) => {
    const label = row.querySelector('.cost-label').value;
    const amount = row.querySelector('.cost-amount').value;
    if (label && amount) {
      costItems.push({ label, amount: Number(amount) });
    }
  });

  const payload = {
    title: formData.get('title'),
    location: formData.get('location') || null,
    description: formData.get('description') || null,
    category: formData.get('category') || null,
    year: formData.get('year') ? Number(formData.get('year')) : null,
    period: formData.get('period') || null,
    area: formData.get('area') ? Number(formData.get('area')) : null,
    costs: costItems, // 견적 배열 전송
  };

  // 대표 이미지가 새로 업로드되었다면 payload에 추가
  if (mainImageUrl) {
    payload.mainImage = mainImageUrl;
  }

  // 상세 이미지가 있다면 payload에 추가 (Prisma nested create 활용 가정)
  // 백엔드가 이를 바로 처리하지 못한다면 별도 API 호출이 필요할 수 있음
  if (detailImages.length > 0) {
    payload.images = {
      create: detailImages.map((item) => ({
        filename: item.filename,
        originalUrl: item.originalUrl,
        largeUrl: item.largeUrl,
        mediumUrl: item.mediumUrl,
        thumbUrl: item.thumbUrl,
        width: item.width,
        height: item.height,
        sizeBytes: item.sizeBytes,
      })),
    };
  }

  try {
    console.log('⏳ 프로젝트 데이터 저장 요청:', payload);
    const url = id ? `/projects/${id}` : '/projects';
    const method = id ? 'PATCH' : 'POST';

    await window.apiFetch(url, {
      method,
      body: payload,
    });

    console.log('✅ 프로젝트 저장 완료');
    alert(id ? '프로젝트가 수정되었습니다.' : '프로젝트가 생성되었습니다.');
    resetForm();
    fetchProjects();
  } catch (err) {
    console.error('❌ 프로젝트 저장 실패:', err);
    alert(`저장 실패: ${err.message}`);
  }
}

async function handleDelete(e) {
  const id = e.target.dataset.id;
  if (!confirm(`프로젝트 #${id}를 정말 삭제하시겠습니까?`)) return;

  try {
    await window.apiFetch(`/projects/${id}`, {
      method: 'DELETE',
    });
    window.showNotice('프로젝트가 삭제되었습니다.', 'success');
    fetchProjects();
  } catch (err) {
    window.showNotice(`삭제 실패: ${err.message}`, 'error');
  }
}

// --- 견적 관리 UI 로직 ---
function renderCostInputs(costs = []) {
  const container = document.getElementById('costListContainer');
  container.innerHTML = '';

  if (costs.length === 0) {
    // 기본으로 빈 행 하나 추가 (선택사항)
    // addCostRow();
  } else {
    costs.forEach((c) => addCostRow(c.label, c.amount));
  }
  updateTotal();
}

function addCostRow(label = '', amount = '') {
  const container = document.getElementById('costListContainer');
  const div = document.createElement('div');
  div.className = 'cost-row';
  div.style.cssText =
    'display: flex; gap: 10px; margin-bottom: 8px; align-items: center;';

  div.innerHTML = `
    <input type="text" class="cost-label" placeholder="시공 타입 (예: 목공)" value="${label}" style="flex: 2;" required />
    <input type="number" class="cost-amount" placeholder="금액 (만원)" value="${amount}" style="flex: 1;" required />
    <button type="button" class="btn-remove-cost" style="background: #fee2e2; color: #ef4444; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;">삭제</button>
  `;

  // 삭제 버튼 이벤트
  div.querySelector('.btn-remove-cost').addEventListener('click', () => {
    div.remove();
    updateTotal();
  });

  // 금액 변경 시 총액 업데이트
  div.querySelector('.cost-amount').addEventListener('input', updateTotal);

  container.appendChild(div);
  updateTotal();
}

function updateTotal() {
  const amounts = document.querySelectorAll('.cost-amount');
  let total = 0;
  amounts.forEach((input) => {
    const val = Number(input.value) || 0;
    total += val;
  });

  const display = document.getElementById('totalPriceDisplay');
  if (display) {
    display.value = total.toLocaleString();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchProjects();
  document
    .getElementById('createForm')
    .addEventListener('submit', handleFormSubmit);
  document.getElementById('cancelBtn').addEventListener('click', resetForm);

  // 견적 추가 버튼
  const btnAddCost = document.getElementById('btnAddCost');
  if (btnAddCost) {
    btnAddCost.addEventListener('click', () => addCostRow());
  }
});
