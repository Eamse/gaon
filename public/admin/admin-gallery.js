console.log('🎨 [Admin Gallery] Script Loaded');

let allProjects = [];
let currentFilter = 'all';
let currentEditId = null;
let originalProjectData = null;

const projectsGrid = document.getElementById('projectsGrid');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const saveEditBtn = document.getElementById('saveEditBtn');

document.addEventListener('DOMContentLoaded', () => {
  initGallery();
});

/** 갤러리 페이지를 초기화하고, 필터 설정 및 프로젝트를 로드합니다. */
async function initGallery() {
  console.log('🎨 Initializing gallery...');

  setupFilterButtons();

  if (editForm) {
    editForm.addEventListener('submit', handleEditSubmit);
  }

  await loadAllProjects();
}

/** 카테고리 필터 버튼에 대한 클릭 이벤트를 설정합니다. */
function setupFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.filter-btn')
        .forEach((b) => b.classList.remove('active'));

      btn.classList.add('active');

      currentFilter = btn.dataset.category;
      renderProjects();
    });
  });
}

/** 서버에서 모든 프로젝트 목록을 가져와 상태에 저장하고 렌더링합니다. */
async function loadAllProjects() {
  try {
    const data = await window.apiFetch('/projects');
    allProjects = data.data || [];

    console.log(`✅ Loaded ${allProjects.length} projects`);
    renderProjects();
  } catch (error) {
    console.error('❌ Error loading projects:', error);
    renderErrorState(error.message);
  }
}

/** 프로젝트 로딩 중 에러 발생 시 그리드에 에러 메시지를 표시합니다. */
function renderErrorState(message) {
  projectsGrid.innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ef4444; margin-bottom: 16px;"></i>
        <p>프로젝트를 불러올 수 없습니다</p>
        <p style="font-size:12px; margin-top:4px;">${message}</p>
    </div>
  `;
}

/** 현재 필터에 따라 프로젝트 목록을 화면에 렌더링합니다. */
function renderProjects() {
  let filtered = allProjects;

  if (currentFilter !== 'all') {
    filtered = allProjects.filter(
      (p) => (p.category && p.category.trim()) === currentFilter,
    );
  }

  if (filtered.length === 0) {
    projectsGrid.innerHTML = `
      <div class="empty-state">
          <i class="fas fa-folder-open" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
          <p>${currentFilter === 'all' ? '등록된 프로젝트가 없습니다' : '해당 카테고리의 프로젝트가 없습니다'}</p>
      </div>
    `;
    return;
  }

  projectsGrid.innerHTML = filtered
    .map((project) => createProjectCard(project))
    .join('');
}

const selectedProjectIds = new Set();

/** 개별 프로젝트 카드 HTML 문자열을 생성합니다. */
function createProjectCard(project) {
  const isChecked = selectedProjectIds.has(project.id) ? 'checked' : '';
  let imgUrl = '';
  if (project.mainImage) {
    imgUrl = project.mainImage;
  } else if (project.images && project.images.length > 0) {
    const firstImg = project.images[0];
    imgUrl = firstImg.mediumUrl || firstImg.thumbUrl || firstImg.originalUrl;
  }

  const fallbackImg =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTFZTJlIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZlNzI3ZiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

  return `
    <div class="project-card" data-id="${project.id}">
      <div class="card-image-wrapper" style="position: relative;">
        <div class="project-checkbox">
          <input type="checkbox" class="check-box"
            ${isChecked} onchange="projectSelected(${project.id})" />
        </div>
        <img 
            src="${imgUrl || fallbackImg}" 
            alt="${escapeHtml(project.title)}" 
            class="card-image"
            onerror="this.onerror=null; this.src='${fallbackImg}';"
        />
      </div>
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

/** 전체 선택 체크박스 상태에 따라 모든 프로젝트를 선택하거나 해제합니다. */
window.selectedProjectAll = function (mainCheckbox) {
  const allCheckboxes = document.querySelectorAll('.check-box');
  const isChecked = mainCheckbox.checked;

  allCheckboxes.forEach((cb) => {
    if (cb.checked !== isChecked) {
      cb.checked = isChecked;
      const card = cb.closest('.project-card');
      if (card && card.dataset.id) {
        const id = parseInt(card.dataset.id);
        isChecked ? selectedProjectIds.add(id) : selectedProjectIds.delete(id);
      }
    }
  });
  updateSelectionUI();
};

/** 새 탭에서 프로젝트 상세 페이지를 엽니다. */
window.previewProject = function (id) {
  window.open(`https://gaoninterior.kr/project/project-detail.html?id=${id}`, '_blank');
};

/** 수정 모달을 열고 특정 프로젝트의 데이터를 불러와 폼에 채웁니다. */
window.openEditModal = async function (id) {
  currentEditId = id;

  try {
    const data = await window.apiFetch(`/projects/${id}`);
    const project = data.data;

    originalProjectData = project;

    fillEditForm(project);

    editModal.classList.add('show');
  } catch (error) {
    console.error('❌ Error loading project:', error);
    alert('프로젝트 정보를 불러올 수 없습니다: ' + error.message);
  }
};

/** 수정 폼의 각 필드에 프로젝트 데이터를 채웁니다. */
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

/** 수정 모달을 닫고 관련 상태를 초기화합니다. */
window.closeEditModal = function () {
  editModal.classList.remove('show');
  editForm.reset();
  currentEditId = null;
  originalProjectData = null;
};

if (editModal) {
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

/** 수정 폼 제출을 처리하고, 이미지 업로드 및 메타데이터 업데이트를 수행합니다. */
async function handleEditSubmit(e) {
  e.preventDefault();

  if (!currentEditId) {
    alert('수정할 프로젝트가 선택되지 않았습니다');
    return;
  }

  const { formData, files } = getFormDataAndFiles(editForm);

  if (!hasChanges(formData, files.hasNewMainImage, files.hasNewDetailImages)) {
    alert('수정된 내용이 없습니다.');
    return;
  }

  setSavingState(true);

  try {
    let newMainImageUrl = null;

    if (files.hasNewMainImage || files.hasNewDetailImages) {
      newMainImageUrl = await uploadProjectImages(currentEditId, files);
    }
    await updateProjectMetadata(currentEditId, formData, newMainImageUrl);

    alert('프로젝트가 성공적으로 수정되었습니다!');
    closeEditModal();
    await loadAllProjects();
  } catch (error) {
    handleUpdateError(error);
  } finally {
    setSavingState(false);
  }
}

/** 폼에서 텍스트 데이터와 파일 데이터를 추출하여 객체로 반환합니다. */
function getFormDataAndFiles(form) {
  const fData = new FormData(form);

  const formData = {
    title: fData.get('title'),
    location: fData.get('location'),
    description: fData.get('description'),
    category: fData.get('category'),
    year: fData.get('year'),
    period: fData.get('period'),
    area: fData.get('area'),
  };

  const mainImageFile = fData.get('mainImageFile');
  const detailFilesInput = form.querySelector('input[name="detailImageFiles"]');
  const detailFiles = detailFilesInput ? detailFilesInput.files : [];

  const files = {
    mainImageFile: mainImageFile,
    detailFiles: detailFiles,
    hasNewMainImage: mainImageFile && mainImageFile.size > 0,
    hasNewDetailImages: detailFiles && detailFiles.length > 0,
  };

  return { formData, files };
}

/** 원본 데이터와 비교하여 폼 데이터에 변경 사항이 있는지 확인합니다. */
function hasChanges(newData, hasNewMain, hasNewDetail) {
  if (hasNewMain || hasNewDetail) return true;

  const isSame =
    newData.title === (originalProjectData.title || '') &&
    newData.location === (originalProjectData.location || '') &&
    newData.description === (originalProjectData.description || '') &&
    newData.category === (originalProjectData.category || '') &&
    newData.year ===
    (originalProjectData.year ? String(originalProjectData.year) : '') &&
    newData.period === (originalProjectData.period || '') &&
    newData.area ===
    (originalProjectData.area ? String(originalProjectData.area) : '');

  return !isSame;
}

/** 새로운 프로젝트 이미지를 서버에 업로드하고 대표 이미지 URL을 반환합니다. */
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

  const uploadRes = await window.apiFetch(`/projects/${id}/images`, {
    method: 'POST',
    body: imageFormData,
  });

  if (files.hasNewMainImage && uploadRes.items && uploadRes.items.length > 0) {
    return uploadRes.items[0].urls.original || uploadRes.items[0].urls.thumb;
  }

  return null;
}

/** 프로젝트의 텍스트 정보(메타데이터)를 서버에 PATCH 요청으로 업데이트합니다. */
async function updateProjectMetadata(id, data, newMainImageUrl) {
  const payload = {
    title: data.title,
    location: data.location,
    description: data.description,
    category: data.category,
    year: data.year,
    period: data.period,
    area: data.area,
  };

  if (newMainImageUrl) {
    payload.mainImage = newMainImageUrl;
  }

  await window.apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

/** 저장 버튼의 UI 상태를 로딩 중 또는 기본 상태로 변경합니다. */
function setSavingState(isSaving) {
  if (isSaving) {
    saveEditBtn.disabled = true;
    saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
  } else {
    saveEditBtn.disabled = false;
    saveEditBtn.innerHTML = '<i class="fas fa-save"></i> 저장하기';
  }
}

/** 프로젝트 업데이트 중 발생한 에러를 처리하고 사용자에게 알립니다. */
function handleUpdateError(error) {
  if (error.message && error.message.includes('수정할 내용이 없습니다')) {
    alert('수정된 내용이 없습니다.');
    closeEditModal();
    return;
  }

  console.error('❌ Error updating project:', error);
  alert('수정 중 오류가 발생했습니다: ' + error.message);
}

/** 특정 프로젝트의 사진 관리 페이지로 이동합니다. */
window.editPhotoProject = function (id) {
  window.location.href = `/admin-gallery-photos.html?id=${id}`;
};

/** 확인 후 단일 프로젝트를 삭제합니다. */
window.deleteProject = async function (id) {
  if (
    !confirm(
      '정말로 이 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
    )
  ) {
    return;
  }

  try {
    await window.apiFetch(`/projects/${id}`, {
      method: 'DELETE',
    });

    alert('프로젝트가 삭제되었습니다');
    await loadAllProjects();
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    alert('삭제 중 오류가 발생했습니다: ' + error.message);
  }
};

/** 프로젝트 카드의 선택 상태를 토글합니다. */
window.projectSelected = function (id) {
  if (selectedProjectIds.has(id)) {
    selectedProjectIds.delete(id);
  } else {
    selectedProjectIds.add(id);
  }
  updateSelectionUI();
};

/** 선택된 프로젝트 수와 일괄 삭제 버튼의 활성화 상태를 업데이트합니다. */
function updateSelectionUI() {
  const deleteBtn = document.getElementById('batchDeleteBtn');
  const countDisplay = document.getElementById('selectedCount');

  if (deleteBtn) {
    deleteBtn.disabled = selectedProjectIds.size === 0;
  }
  if (countDisplay) {
    countDisplay.textContent = selectedProjectIds.size;
  }
}

/** 선택된 모든 프로젝트를 일괄적으로 삭제합니다. */
window.batchDeleteProjects = async function () {
  const count = selectedProjectIds.size;
  if (count === 0) return;

  if (
    !confirm(
      `선택한 ${count}개의 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
    )
  ) {
    return;
  }

  try {
    const ids = Array.from(selectedProjectIds);

    const deletePromises = ids.map((id) =>
      window.apiFetch(`/projects/${id}`, { method: 'DELETE' }),
    );

    await Promise.all(deletePromises);

    alert('선택한 프로젝트가 삭제되었습니다.');

    selectedProjectIds.clear();
    updateSelectionUI();
    await loadAllProjects();
  } catch (error) {
    console.error('❌ Error batch deleting projects:', error);
    alert('일부 프로젝트 삭제 중 오류가 발생했습니다: ' + error.message);

    await loadAllProjects();
  }
};

/** XSS 방지를 위해 HTML 특수문자를 이스케이프 처리합니다. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  if (text === null || text === undefined) return '';
  return div.innerHTML;
}
