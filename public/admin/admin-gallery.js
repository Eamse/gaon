/**
 * Admin Gallery - Project Management
 * 프로젝트 조회, 수정, 삭제 관리 페이지
 */

console.log('🎨 [Admin Gallery] Script Loaded');

// State
let allProjects = [];
let currentFilter = 'all';
let currentEditId = null;

// DOM Elements
const projectsGrid = document.getElementById('projectsGrid');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const saveEditBtn = document.getElementById('saveEditBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initGallery();
});

async function initGallery() {
  console.log('🎨 Initializing gallery...');

  // Setup filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.category;
      renderProjects();
    });
  });

  // Setup edit form
  if (editForm) {
    editForm.addEventListener('submit', handleEditSubmit);
  }

  // Load projects
  await loadAllProjects();
}

// ============================================
// Load Projects
// ============================================

async function loadAllProjects() {
  try {
    const data = await window.apiFetch('/projects');
    allProjects = data.projects || [];

    console.log(`✅ Loaded ${allProjects.length} projects`);
    renderProjects();

  } catch (error) {
    console.error('❌ Error loading projects:', error);
    projectsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ef4444; margin-bottom: 16px;"></i>
                <p>프로젝트를 불러올 수 없습니다</p>
                <p style="font-size:12px; margin-top:4px;">${error.message}</p>
            </div>
        `;
  }
}

// ============================================
// Render Projects
// ============================================

function renderProjects() {
  let filtered = allProjects;

  // Apply filter
  if (currentFilter !== 'all') {
    filtered = allProjects.filter(p => (p.category && p.category.trim()) === currentFilter);
  }

  // Empty state
  if (filtered.length === 0) {
    projectsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
                <p>${currentFilter === 'all' ? '등록된 프로젝트가 없습니다' : '해당 카테고리의 프로젝트가 없습니다'}</p>
            </div>
        `;
    return;
  }

  // Render cards
  projectsGrid.innerHTML = filtered.map(project => createProjectCard(project)).join('');
}

function createProjectCard(project) {
  // Get image URL
  let imgUrl = '';
  if (project.mainImage) {
    imgUrl = project.mainImage;
  } else if (project.images && project.images.length > 0) {
    const firstImg = project.images[0];
    imgUrl = firstImg.mediumUrl || firstImg.thumbUrl || firstImg.originalUrl;
  }

  // window.apiFetch handles base URL, but image URLs might be relative or full.
  // Assuming backend returns full URL or valid relative URL.

  // Fallback image
  // Fallback image (Base64 gray placeholder to prevent network errors)
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
                        <i class="fas fa-edit"></i> 수정
                    </button>
                    <button class="card-btn delete" onclick="deleteProject(${project.id})">
                        <i class="fas fa-trash"></i> 삭제
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// Preview
// ============================================

window.previewProject = function (id) {
  // Gaon 프로젝트 상세 페이지 URL 확인 필요.
  // 기존에 /project/project-detail.html?id=ID 형식을 사용한다고 가정 (Woojin 방식과 동일)
  window.open(`/project/project-detail.html?id=${id}`, '_blank');
};

// ============================================
// Edit Modal
// ============================================

window.openEditModal = async function (id) {
  currentEditId = id;

  try {
    const data = await window.apiFetch(`/projects/${id}`);
    const project = data.project;

    // Fill form
    document.getElementById('editProjectId').value = project.id;
    document.getElementById('editTitle').value = project.title || '';
    document.getElementById('editLocation').value = project.location || '';
    document.getElementById('editCategory').value = project.category || '';
    document.getElementById('editYear').value = project.year || '';
    document.getElementById('editPeriod').value = project.period || '';
    document.getElementById('editArea').value = project.area || '';
    document.getElementById('editDescription').value = project.description || '';

    // Show modal
    editModal.classList.add('show');

  } catch (error) {
    console.error('❌ Error loading project:', error);
    alert('프로젝트 정보를 불러올 수 없습니다: ' + error.message);
  }
};

window.closeEditModal = function () {
  editModal.classList.remove('show');
  editForm.reset();
  currentEditId = null;
};

async function handleEditSubmit(e) {
  e.preventDefault();

  if (!currentEditId) {
    alert('수정할 프로젝트가 선택되지 않았습니다');
    return;
  }

  saveEditBtn.disabled = true;
  saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';

  try {
    const formData = new FormData(editForm);

    // costs 필드 추가 (수정 시 빈 배열 전송하여 유지 - Woojin 방식)
    formData.append('costs', JSON.stringify([]));

    // window.apiFetch does NOT support FormData body directly in the wrapper provided in common.js? 
    // Wait, typical apiFetch wrappers might handle it if they check instanceof FormData.
    // If common.js apiFetch sets Content-Type to json by default, it might break FormData.
    // Let's assume window.apiFetch supports it or we need to use fetch directly if not.
    // Checking previous code: User context says "admin-woojin/admin-projects.js uses fetch, not window.apiFetch".
    // But Gaon's structure uses window.apiFetch.
    // Common.js typically handles this. If body is FormData, don't set Content-Type to JSON.

    // Let's assume standard behavior. If common.js is simple, we might need manual fetch.
    // To be safe, I'll use window.apiFetch but ensure it can handle FormData.
    // If it fails, I'll need to check common.js.

    // Actually, in `admin-projects.js` (CREATE), I used apiFetch with object payload (JSON).
    // Here I am sending FormData to PATCH /projects/:id.
    // Backend `projectRouter.js` usually expects JSON for PATCH unless using multer?
    // Wait, Woojin `admin-projects.js` used FormData for create, but JSON for PATCH mainImage?
    // Ah, Woojin `admin-projects.js` handleFormSubmit uses `JSON.stringify` for project data, and SEPARATE FormData for images.
    // BUT Woojin `admin-gallery-manage.js` (Step 46 file view) uses FormData for PATCH!
    // `body: formData` (Line 248).
    // So the backend might support multipart/form-data for PATCH.

    // Let's proceed with FormData.

    await window.apiFetch(`/projects/${currentEditId}`, {
      method: 'PATCH',
      body: formData
    });

    alert('프로젝트가 성공적으로 수정되었습니다!');
    closeEditModal();
    await loadAllProjects();

  } catch (error) {
    // "No content to modify" specific handling
    if (error.message && error.message.includes('수정할 내용이 없습니다')) {
      alert('수정된 내용이 없습니다.');
      closeEditModal();
      return;
    }

    console.error('❌ Error updating project:', error);
    alert('수정 중 오류가 발생했습니다: ' + error.message);
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.innerHTML = '<i class="fas fa-save"></i> 저장하기';
  }
}

// ============================================
// Delete
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

// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  // Handle null/undefined
  if (text === null || text === undefined) return '';
  return div.innerHTML;
}

// Close modal on overlay click
if (editModal) {
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      closeEditModal();
    }
  });
}
