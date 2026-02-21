console.log('📸 [Admin Photos] Script Loaded');

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

let projectData = null;
let detailImages = [];

const projectTitleEl = document.getElementById('projectTitle');
const mainImageEl = document.getElementById('mainImage');
const detailGridEl = document.getElementById('detailGrid');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');

document.addEventListener('DOMContentLoaded', () => {
  if (!projectId) {
    alert('잘못된 접근입니다. 프로젝트 ID가 없습니다.');
    window.location.href = '/admin-gallery';
    return;
  }

  initPhotosManager();
});

/** 사진 관리 페이지를 초기화하고 프로젝트 데이터를 로드합니다. */
async function initPhotosManager() {
  await loadProjectData();
}

/** 프로젝트의 기본 정보와 이미지 목록을 서버에서 불러옵니다. */
async function loadProjectData() {
  try {
    const res = await window.apiFetch(`/projects/${projectId}`);
    projectData = res.data;

    const imgRes = await window.apiFetch(`/projects/${projectId}/images`);
    detailImages = (imgRes.items || []).map((img) => ({
      ...img,
      checked: false,
    }));

    renderBasicInfo();
    renderDetailImages();
  } catch (error) {
    console.error('❌ Error loading data:', error);
    alert('데이터를 불러오는 중 오류가 발생했습니다.');
  }
}

/** 프로젝트 제목과 대표 이미지를 화면에 렌더링합니다. */
function renderBasicInfo() {
  if (!projectData) return;

  // 제목
  projectTitleEl.textContent = `[${projectId}] ${projectData.title} - 사진 관리`;

  // 대표 이미지
  const fallbackImg =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTFZTJlIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZlNzI3ZiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

  mainImageEl.src = projectData.mainImage || fallbackImg;
  mainImageEl.onerror = function () {
    this.src = fallbackImg;
    this.onerror = null;
  };
}

/** 상세 이미지 목록을 그리드 형태로 화면에 렌더링합니다. */
function renderDetailImages() {
  detailGridEl.innerHTML = '';

  if (detailImages.length === 0) {
    detailGridEl.innerHTML =
      '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af; padding:20px;">상세 이미지가 없습니다.</p>';
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

/** 파일 선택 시 대표 이미지 미리보기를 업데이트합니다. */
window.previewMainImage = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      mainImageEl.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

/** 새로 선택된 대표 이미지를 업로드하고 프로젝트 정보를 업데이트합니다. */
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
    const uploadRes = await window.apiFetch(`/projects/${projectId}/images`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.items || uploadRes.items.length === 0) {
      throw new Error('이미지 업로드 실패');
    }

    const newUrl =
      uploadRes.items[0].urls.original || uploadRes.items[0].urls.thumb;

    await window.apiFetch(`/projects/${projectId}`, {
      method: 'PATCH',
      body: { mainImage: newUrl },
    });

    alert('대표 이미지가 변경되었습니다.');
    location.reload();
  } catch (error) {
    console.error(error);
    alert('대표 이미지 변경 실패: ' + error.message);
  }
};

/** 현재 설정된 대표 이미지를 삭제하고 기본 이미지로 대체합니다. */
window.deleteMainImage = async function () {
  if (!confirm('대표 이미지를 삭제하시겠습니까? (기본 이미지로 대체됩니다)'))
    return;

  try {
    await window.apiFetch(`/projects/${projectId}`, {
      method: 'PATCH',
      body: { mainImage: null }, // Send null to clear it (or empty string if backend prefers)
    });
    alert('대표 이미지가 삭제되었습니다.');
    location.reload();
  } catch (error) {
    console.error(error);
    alert('삭제 실패: ' + error.message);
  }
};

/** 모든 상세 이미지의 선택 상태를 토글합니다. */
window.toggleSelectAll = function (checkbox) {
  const isChecked = checkbox.checked;
  detailImages.forEach((img, idx) => {
    img.checked = isChecked;
  });
  renderDetailImages();
};

/** 특정 인덱스의 상세 이미지 선택 상태를 토글합니다. */
window.toggleImageCheck = function (index, isChecked) {
  if (detailImages[index]) {
    detailImages[index].checked = isChecked;
  }
};

/** 새로 선택된 상세 이미지들을 서버에 업로드합니다. */
window.uploadDetailImages = async function (input) {
  if (!input.files || input.files.length === 0) return;

  if (!confirm(`${input.files.length}장의 이미지를 추가하시겠습니까?`)) {
    input.value = ''; // Reset
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < input.files.length; i++) {
    formData.append('files', input.files[i]);
  }

  try {
    await window.apiFetch(`/projects/${projectId}/images`, {
      method: 'POST',
      body: formData,
    });

    alert('상세 이미지가 추가되었습니다.');
    loadProjectData();
    input.value = '';
  } catch (error) {
    console.error(error);
    alert('업로드 실패: ' + error.message);
  }
};

/** 선택된 모든 상세 이미지를 일괄적으로 삭제합니다. */
window.deleteSelectedImages = async function () {
  const selectedIds = detailImages
    .filter((img) => img.checked)
    .map((img) => img.id);

  if (selectedIds.length === 0) {
    alert('삭제할 이미지를 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${selectedIds.length}장의 이미지를 삭제하시겠습니까?`))
    return;

  try {
    const deletePromises = selectedIds.map((id) =>
      window.apiFetch(`/projects/images/${id}`, { method: 'DELETE' }),
    );

    await Promise.all(deletePromises);

    alert('삭제되었습니다.');
    loadProjectData();
    document.getElementById('selectAll').checked = false;
  } catch (error) {
    console.error(error);
    alert('일부 이미지 삭제 중 오류가 발생했습니다: ' + error.message);
    loadProjectData();
  }
};
