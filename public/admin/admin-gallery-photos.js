/**
 * Admin Gallery - Photos Management
 * 프로젝트 사진(대표/상세) 전용 관리 페이지
 */

console.log('📸 [Admin Photos] Script Loaded');

// ============================================
// 1. 상태 및 DOM (State & DOM)
// ============================================

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

let projectData = null;
let detailImages = []; // 상세 이미지 리스트 (id, url, checked 상태)

// DOM Elements
const projectTitleEl = document.getElementById('projectTitle');
const mainImageEl = document.getElementById('mainImage');
const detailGridEl = document.getElementById('detailGrid');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');


// ============================================
// 2. 초기화 (Initialization)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (!projectId) {
        alert('잘못된 접근입니다. 프로젝트 ID가 없습니다.');
        window.location.href = '/admin/admin-gallery';
        return;
    }

    initPhotosManager();
});

async function initPhotosManager() {
    await loadProjectData();
}

/**
 * 프로젝트 데이터 및 연관 이미지 정보 로딩
 */
async function loadProjectData() {
    try {
        // 1. 프로젝트 기본 정보 (+대표이미지)
        const res = await window.apiFetch(`/projects/${projectId}`);
        projectData = res.project;

        // 2. 상세 이미지 리스트 가져오기 (API 확인 필요)
        // uploadRouter.js를 보면 GET /projects/:projectId/images 가 있음.
        const imgRes = await window.apiFetch(`/projects/${projectId}/images`);
        // items가 배열임
        detailImages = (imgRes.items || []).map(img => ({
            ...img,
            checked: false
        }));

        renderBasicInfo();
        renderDetailImages();

    } catch (error) {
        console.error('❌ Error loading data:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}


// ============================================
// 3. 렌더링 (Rendering)
// ============================================

function renderBasicInfo() {
    if (!projectData) return;

    // 제목
    projectTitleEl.textContent = `[${projectId}] ${projectData.title} - 사진 관리`;

    // 대표 이미지
    const fallbackImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTFZTJlIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZlNzI3ZiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

    mainImageEl.src = projectData.mainImage || fallbackImg;
    mainImageEl.onerror = function () {
        this.src = fallbackImg;
        this.onerror = null;
    };
}

function renderDetailImages() {
    detailGridEl.innerHTML = '';

    if (detailImages.length === 0) {
        detailGridEl.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af; padding:20px;">상세 이미지가 없습니다.</p>';
        return;
    }

    detailImages.forEach((img, index) => {
        const card = document.createElement('div');
        card.className = 'detail-card';

        // Use thumb or original
        const src = img.thumbUrl || img.mediumUrl || img.originalUrl || '';

        card.innerHTML = `
            <div class="checkbox-wrapper">
                <input type="checkbox" data-id="${img.id}" ${img.checked ? 'checked' : ''} onchange="toggleImageCheck(${index}, this.checked)">
            </div>
            <img src="${src}" alt="Detail Image ${index + 1}">
        `;
        detailGridEl.appendChild(card);
    });
}


// ============================================
// 4. 대표 이미지 관리 (Main Image Logic)
// ============================================

// 파일 선택 시 미리보기
window.previewMainImage = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            mainImageEl.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// 대표 이미지 저장 (변경)
window.saveMainImage = async function () {
    const input = document.getElementById('newMainImageInput');
    if (!input.files || input.files.length === 0) {
        alert('변경할 이미지를 먼저 선택해주세요.');
        return;
    }

    const file = input.files[0];
    const formData = new FormData();
    formData.append('mainImageFile', file);

    try {
        // 1. 이미지 업로드 (Upload Router uses POST /projects/:id/images)
        // But wait, if we use that endpoint, it creates a ProjectImage record.
        // We want to update Project.mainImage string.
        // Strategy: Upload to generates a URL, then PATCH Project.
        // We can reuse the same endpoint `/projects/:id/images` and just take the URL.

        const uploadRes = await window.apiFetch(`/projects/${projectId}/images`, {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.items || uploadRes.items.length === 0) {
            throw new Error('이미지 업로드 실패');
        }

        const newUrl = uploadRes.items[0].urls.original || uploadRes.items[0].urls.thumb;

        // 2. 프로젝트 정보 업데이트 (mainImage 필드)
        await window.apiFetch(`/projects/${projectId}`, {
            method: 'PATCH',
            body: { mainImage: newUrl }
        });

        alert('대표 이미지가 변경되었습니다.');
        location.reload();

    } catch (error) {
        console.error(error);
        alert('대표 이미지 변경 실패: ' + error.message);
    }
}

// 대표 이미지 삭제
window.deleteMainImage = async function () {
    if (!confirm('대표 이미지를 삭제하시겠습니까? (기본 이미지로 대체됩니다)')) return;

    try {
        await window.apiFetch(`/projects/${projectId}`, {
            method: 'PATCH',
            body: { mainImage: null } // Send null to clear it (or empty string if backend prefers)
        });
        alert('대표 이미지가 삭제되었습니다.');
        location.reload();
    } catch (error) {
        console.error(error);
        alert('삭제 실패: ' + error.message);
    }
}


// ============================================
// 5. 상세 이미지 관리 (Detail Images Logic)
// ============================================

window.toggleSelectAll = function (checkbox) {
    const isChecked = checkbox.checked;
    detailImages.forEach((img, idx) => {
        img.checked = isChecked;
    });
    renderDetailImages(); // Re-render to update checkboxes
}

window.toggleImageCheck = function (index, isChecked) {
    if (detailImages[index]) {
        detailImages[index].checked = isChecked;
    }
}

// 상세 이미지 추가 업로드 (즉시 업로드)
window.uploadDetailImages = async function (input) {
    if (!input.files || input.files.length === 0) return;

    if (!confirm(`${input.files.length}장의 이미지를 추가하시겠습니까?`)) {
        input.value = ''; // Reset
        return;
    }

    const formData = new FormData();
    // append 'files' as per uploadRouter (name='files', maxCount=10)
    for (let i = 0; i < input.files.length; i++) {
        formData.append('files', input.files[i]);
    }

    try {
        await window.apiFetch(`/projects/${projectId}/images`, {
            method: 'POST',
            body: formData
        });

        alert('상세 이미지가 추가되었습니다.');
        loadProjectData(); // Reload grid
        input.value = ''; // Reset

    } catch (error) {
        console.error(error);
        alert('업로드 실패: ' + error.message);
    }
}

// 선택된 상세 이미지 삭제
window.deleteSelectedImages = async function () {
    const selectedIds = detailImages.filter(img => img.checked).map(img => img.id);

    if (selectedIds.length === 0) {
        alert('삭제할 이미지를 선택해주세요.');
        return;
    }

    if (!confirm(`선택한 ${selectedIds.length}장의 이미지를 삭제하시겠습니까?`)) return;

    try {
        // 백엔드에 다중 삭제 API가 없으므로 Promise.all로 병렬 요청
        // API: DELETE /projects/images/:id
        const deletePromises = selectedIds.map(id =>
            window.apiFetch(`/projects/images/${id}`, { method: 'DELETE' })
        );

        await Promise.all(deletePromises);

        alert('삭제되었습니다.');
        loadProjectData(); // Reload
        document.getElementById('selectAll').checked = false;

    } catch (error) {
        console.error(error);
        alert('일부 이미지 삭제 중 오류가 발생했습니다: ' + error.message);
        loadProjectData(); // Reload to see what's left
    }
}
