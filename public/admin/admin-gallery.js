/**
 * Admin Gallery - Project Management
 * 프로젝트 조회, 수정, 삭제 관리 페이지
 * 
 * 주요 기능:
 * - 프로젝트 목록 조회 및 필터링
 * - 프로젝트 미리보기, 수정, 삭제
 * - 이미지 업로드 및 프로젝트 정보 업데이트
 */

console.log('🎨 [Admin Gallery] Script Loaded');

// ============================================
// 1. 상태 및 DOM 요소 (State & Elements)
// ============================================

// 상태 관리
let allProjects = [];      // 불러온 전체 프로젝트 목록 리스트
let currentFilter = 'all'; // 현재 선택된 필터 (예: residential, commercial 등)
let currentEditId = null;  // 현재 수정 중인 프로젝트 ID
let originalProjectData = null; // 수정 전 원본 데이터 (변경 감지용)

// DOM 요소
const projectsGrid = document.getElementById('projectsGrid');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const saveEditBtn = document.getElementById('saveEditBtn');


// ============================================
// 2. 초기화 (Initialization)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initGallery();
});

async function initGallery() {
  console.log('🎨 Initializing gallery...');

  // 필터 버튼 이벤트 설정
  setupFilterButtons();

  // 수정 폼 제출 이벤트 설정
  if (editForm) {
    editForm.addEventListener('submit', handleEditSubmit);
  }

  // 프로젝트 목록 불러오기
  await loadAllProjects();
}

function setupFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // 모든 버튼 활성화 상태 제거
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

      // 클릭된 버튼 활성화
      btn.classList.add('active');

      // 필터 적용 및 렌더링
      currentFilter = btn.dataset.category;
      renderProjects();
    });
  });
}


// ============================================
// 3. 프로젝트 불러오기 & 렌더링 (Load & Render)
// ============================================

/**
 * 서버에서 모든 프로젝트 목록을 가져옵니다.
 */
async function loadAllProjects() {
  try {
    const data = await window.apiFetch('/projects');
    // 백엔드가 { ok: true, data: [...], pagination: {...} } 형태로 반환
    allProjects = data.data || [];

    console.log(`✅ Loaded ${allProjects.length} projects`);
    renderProjects();

  } catch (error) {
    console.error('❌ Error loading projects:', error);
    renderErrorState(error.message);
  }
}

/**
 * 에러 발생 시 화면에 에러 메시지를 표시합니다.
 */
function renderErrorState(message) {
  projectsGrid.innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ef4444; margin-bottom: 16px;"></i>
        <p>프로젝트를 불러올 수 없습니다</p>
        <p style="font-size:12px; margin-top:4px;">${message}</p>
    </div>
  `;
}

/**
 * 현재 필터 상태에 따라 프로젝트 목록을 화면에 그립니다.
 */
function renderProjects() {
  let filtered = allProjects;

  // 필터링 적용
  if (currentFilter !== 'all') {
    filtered = allProjects.filter(p => (p.category && p.category.trim()) === currentFilter);
  }

  // 결과가 없을 경우
  if (filtered.length === 0) {
    projectsGrid.innerHTML = `
      <div class="empty-state">
          <i class="fas fa-folder-open" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
          <p>${currentFilter === 'all' ? '등록된 프로젝트가 없습니다' : '해당 카테고리의 프로젝트가 없습니다'}</p>
      </div>
    `;
    return;
  }

  // 카드 생성 및 렌더링
  projectsGrid.innerHTML = filtered.map(project => createProjectCard(project)).join('');
}

/**
 * 개별 프로젝트 카드 HTML을 생성합니다.
 */
function createProjectCard(project) {
  // 이미지 URL 결정 (대표 이미지 > 첫 번째 이미지 > 폴백 이미지)
  let imgUrl = '';
  if (project.mainImage) {
    imgUrl = project.mainImage;
  } else if (project.images && project.images.length > 0) {
    const firstImg = project.images[0];
    imgUrl = firstImg.mediumUrl || firstImg.thumbUrl || firstImg.originalUrl;
  }

  // 폴백 이미지 (데이터 URI 사용으로 네트워크 오류 방지)
  const fallbackImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTFZTJlIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZlNzI3ZiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

  return `
    <div class="project-card">
        <img 
            src="${imgUrl || fallbackImg}" 
            alt="${escapeHtml(project.title)}" 
            class="card-image"
            onerror="this.onerror=null; this.src='${fallbackImg}';"
        />
        <div class="card-content">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <h3 class="card-title">${escapeHtml(project.title)}</h3>
                <span class="category-badge">${escapeHtml(project.category || '미분류')}</span>
            </div>
            <div class="card-meta">
                <i class="fas fa-map-marker-alt"></i> ${escapeHtml(project.location || '-')} 
                · 
                <i class="fas fa-calendar"></i> ${project.year || '-'}
            </div>
            <div class="card-actions">
                <button class="card-btn preview" onclick="previewProject(${project.id})">
                    <i class="fas fa-eye"></i> 미리보기
                </button>
                <button class="card-btn edit" onclick="openEditModal(${project.id})">
                    <i class="fas fa-edit"></i> 정보수정
                </button>
                <button class="card-btn delete" onclick="deleteProject(${project.id})">
                    <i class="fas fa-trash"></i> 삭제
                </button>
                <button class="card-btn photo" onclick="editPhotoProject(${project.id})">
                    <i class="fas fa-camera"></i> 사진수정
                </button>
            </div>
        </div>
    </div>
  `;
}


// ============================================
// 4. 미리보기 (Preview)
// ============================================

window.previewProject = function (id) {
  window.open(`/project/project-detail.html?id=${id}`, '_blank');
};


// ============================================
// 5. 수정 모달 (Edit Modal)
// ============================================

/**
 * 수정 모달을 열고 프로젝트 데이터를 채웁니다.
 */
window.openEditModal = async function (id) {
  currentEditId = id;

  try {
    // 최신 데이터 가져오기
    const data = await window.apiFetch(`/projects/${id}`);
    // 백엔드가 { ok: true, data: {...} } 형태로 반환
    const project = data.data;

    // 변경 감지를 위해 원본 데이터 저장
    originalProjectData = project;

    // 폼 필드 채우기
    fillEditForm(project);

    // 모달 표시
    editModal.classList.add('show');

  } catch (error) {
    console.error('❌ Error loading project:', error);
    alert('프로젝트 정보를 불러올 수 없습니다: ' + error.message);
  }
};

/**
 * 폼 필드에 데이터를 채웁니다.
 */
function fillEditForm(project) {
  document.getElementById('editProjectId').value = project.id;
  document.getElementById('editTitle').value = project.title || '';
  document.getElementById('editLocation').value = project.location || '';
  document.getElementById('editCategory').value = project.category || '';
  document.getElementById('editYear').value = project.year || '';
  document.getElementById('editPeriod').value = project.period || '';
  document.getElementById('editArea').value = project.area || '';
  document.getElementById('editDescription').value = project.description || '';
}

/**
 * 수정 모달을 닫고 폼을 초기화합니다.
 */
window.closeEditModal = function () {
  editModal.classList.remove('show');
  editForm.reset();
  currentEditId = null;
  originalProjectData = null;
};

// 모달 배경 클릭 시 닫기
if (editModal) {
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
}


// ============================================
// 6. 수정 제출 핸들러 (Refactored Logic)
// ============================================

/**
 * 수정 폼 제출을 처리하는 메인 함수입니다.
 * 2단계 (이미지 업로드 -> 메타데이터 업데이트)로 진행됩니다.
 */
async function handleEditSubmit(e) {
  e.preventDefault();

  if (!currentEditId) {
    alert('수정할 프로젝트가 선택되지 않았습니다');
    return;
  }

  // 1. 폼 데이터 추출
  const { formData, files } = getFormDataAndFiles(editForm);

  // 2. 변경 사항 확인 (클라이언트 측 최적화)
  if (!hasChanges(formData, files.hasNewMainImage, files.hasNewDetailImages)) {
    alert('수정된 내용이 없습니다.');
    return;
  }

  // 3. UI 로딩 상태 전환
  setSavingState(true);

  try {
    let newMainImageUrl = null;

    // 4. 이미지 업로드 (만약 새 이미지가 있다면)
    if (files.hasNewMainImage || files.hasNewDetailImages) {
      newMainImageUrl = await uploadProjectImages(currentEditId, files);
    }

    // 5. 텍스트 정보 업데이트 (JSON Patch)
    await updateProjectMetadata(currentEditId, formData, newMainImageUrl);

    // 6. 성공 처리
    alert('프로젝트가 성공적으로 수정되었습니다!');
    closeEditModal();
    await loadAllProjects();

  } catch (error) {
    handleUpdateError(error);
  } finally {
    setSavingState(false);
  }
}

/**
 * 폼에서 텍스트 데이터와 파일 데이터를 추출합니다.
 */
function getFormDataAndFiles(form) {
  const fData = new FormData(form);

  // 텍스트 데이터 객체
  const formData = {
    title: fData.get('title'),
    location: fData.get('location'),
    description: fData.get('description'),
    category: fData.get('category'),
    year: fData.get('year'),
    period: fData.get('period'),
    area: fData.get('area')
  };

  // 파일 데이터 확인
  const mainImageFile = fData.get('mainImageFile');
  const detailFilesInput = form.querySelector('input[name="detailImageFiles"]');
  const detailFiles = detailFilesInput ? detailFilesInput.files : [];

  const files = {
    mainImageFile: mainImageFile,
    detailFiles: detailFiles,
    hasNewMainImage: mainImageFile && mainImageFile.size > 0,
    hasNewDetailImages: detailFiles && detailFiles.length > 0
  };

  return { formData, files };
}

/**
 * 원본 데이터와 비교하여 변경 사항이 있는지 확인
 */
function hasChanges(newData, hasNewMain, hasNewDetail) {
  // 이미지가 변경되었으면 무조건 변경으로 간주
  if (hasNewMain || hasNewDetail) return true;

  // 텍스트 필드 비교 (null/undefined 안전 처리)
  const isSame = (
    newData.title === (originalProjectData.title || '') &&
    newData.location === (originalProjectData.location || '') &&
    newData.description === (originalProjectData.description || '') &&
    newData.category === (originalProjectData.category || '') &&
    newData.year === (originalProjectData.year ? String(originalProjectData.year) : '') &&
    newData.period === (originalProjectData.period || '') &&
    newData.area === (originalProjectData.area ? String(originalProjectData.area) : '')
  );

  return !isSame;
}

/**
 * 이미지를 서버에 업로드합니다.
 * @returns {string|null} 새로 업로드된 대표 이미지 URL (있다면)
 */
async function uploadProjectImages(id, files) {
  const imageFormData = new FormData();

  if (files.hasNewMainImage) {
    imageFormData.append('mainImageFile', files.mainImageFile);
  }

  if (files.hasNewDetailImages) {
    for (let i = 0; i < files.detailFiles.length; i++) {
      imageFormData.append('detailImageFiles', files.detailFiles[i]);
    }
  }

  // 서버에 업로드 요청
  const uploadRes = await window.apiFetch(`/projects/${id}/images`, {
    method: 'POST',
    body: imageFormData
  });

  // 대표 이미지를 업로드했다면, 새 URL 반환 (프로젝트 정보 업데이트용)
  if (files.hasNewMainImage && uploadRes.items && uploadRes.items.length > 0) {
    // 첫 번째 업로드된 파일의 URL을 사용 (로직 단순화)
    return uploadRes.items[0].urls.original || uploadRes.items[0].urls.thumb;
  }

  return null;
}

/**
 * 프로젝트의 텍스트 정보(메타데이터)를 업데이트합니다.
 */
async function updateProjectMetadata(id, data, newMainImageUrl) {
  const payload = {
    title: data.title,
    location: data.location,
    description: data.description,
    category: data.category,
    year: data.year,
    period: data.period,
    area: data.area
  };

  // 대표 이미지가 변경되었으면 payload에 추가
  if (newMainImageUrl) {
    payload.mainImage = newMainImageUrl;
  }

  // 주의: costs 필드는 보내지 않음 (기존 내역 보존)
  await window.apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: payload // common.js가 자동으로 JSON.stringify 처리
  });
}

function setSavingState(isSaving) {
  if (isSaving) {
    saveEditBtn.disabled = true;
    saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
  } else {
    saveEditBtn.disabled = false;
    saveEditBtn.innerHTML = '<i class="fas fa-save"></i> 저장하기';
  }
}

function handleUpdateError(error) {
  if (error.message && error.message.includes('수정할 내용이 없습니다')) {
    alert('수정된 내용이 없습니다.');
    closeEditModal();
    return;
  }

  console.error('❌ Error updating project:', error);
  alert('수정 중 오류가 발생했습니다: ' + error.message);
}


// ============================================
// 6-1. 사진 관리 (Photo Management)
// ============================================

window.editPhotoProject = function (id) {
  window.location.href = `/admin/admin-gallery-photos.html?id=${id}`;
};


// ============================================
// 7. 삭제 및 유틸리티 (Delete & Utils)
// ============================================

window.deleteProject = async function (id) {
  if (!confirm('정말로 이 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }

  try {
    await window.apiFetch(`/projects/${id}`, {
      method: 'DELETE'
    });

    alert('프로젝트가 삭제되었습니다');
    await loadAllProjects();

  } catch (error) {
    console.error('❌ Error deleting project:', error);
    alert('삭제 중 오류가 발생했습니다: ' + error.message);
  }
};

/**
 * HTML 특수문자를 이스케이프 처리하여 XSS 방지
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  if (text === null || text === undefined) return '';
  return div.innerHTML;
}
