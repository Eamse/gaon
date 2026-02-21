if (!localStorage.getItem('token')) {
  alert('로그인이 만료되었거나 필요합니다.\n로그인 페이지로 이동합니다.');
  window.location.replace('/admin-login');
}

let allInquiries = [];
const selectedIds = new Set();

let currentFilterStatus = 'all';

document.addEventListener('DOMContentLoaded', () => {
  fetchInquiries();
});

/** 서버에서 모든 문의 목록을 가져와 렌더링합니다. */
async function fetchInquiries() {
  try {
    const response = await window.apiFetch('/inquiries');
    allInquiries = response.data || [];
    selectedIds.clear();

    updateStats(); // 통계 갱신
    renderTable(allInquiries); // 테이블 렌더링
  } catch (err) {
    console.error('문의 목록 로드 실패:', err);

    if (
      err.status === 401 ||
      (err.message && err.message.includes('expired'))
    ) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/admin-login');
      return;
    }

    document.getElementById('inquiryTableBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center; color:red;">데이터 로드 실패</td></tr>';
  }
}

/** 문의 상태별 통계를 계산하고 화면에 업데이트합니다. */
function updateStats() {
  const newCount = allInquiries.filter((i) => i.status === 'new').length;
  const ingCount = allInquiries.filter((i) => i.status === 'ing').length;

  document.getElementById('countNew').textContent = newCount;
  document.getElementById('countIng').textContent = ingCount;
  document.getElementById('countTotal').textContent = allInquiries.length;
}

/** XSS 공격을 방지하기 위해 HTML 문자열을 이스케이프 처리합니다. */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 주어진 문의 목록을 사용하여 테이블을 렌더링합니다. */
function renderTable(list) {
  const tbody = document.getElementById('inquiryTableBody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center; padding:30px; color:#6b7280;">문의 내역이 없습니다.</td></tr>';
    return;
  }

  const typeMap = {
    apartment: '아파트',
    villa: '빌라/주택',
    commercial: '상업공간',
    etc: '기타',
  };

  const sortedList = [...list].sort((a, b) => b.id - a.id);

  sortedList.forEach((item) => {
    let badgeHtml = '';
    switch (item.status) {
      case 'new':
        badgeHtml = '<span class="badge badge-new">신규</span>';
        break;
      case 'processing':
        badgeHtml = '<span class="badge badge-processing">상담중</span>';
        break;
      case 'completed':
        badgeHtml = '<span class="badge badge-completed">완료</span>';
        break;
      default:
        badgeHtml = '<span class="badge badge-cancelled">취소/보류</span>';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input
          type="checkbox"
          class="row-checkbox"
          ${selectedIds.has(item.id) ? 'checked' : ''}
          onclick="toggleRowSelect(${item.id}, this.checked)"
        />
      </td>
      <td>${item.id}</td>
      <td>${badgeHtml}</td>
      <td>${item.createdAt}</td>
      <td style="font-weight:600;">${escapeHtml(item.userName)}</td>
      <td>${escapeHtml(item.userPhone)}</td>
      <td>${typeMap[item.spaceType] || escapeHtml(item.spaceType)} / ${
        item.areaSize
      }평</td>
      <td>${Number(item.budget).toLocaleString()}만원</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-view" onclick="openDetail(${
            item.id
          })">상세보기</button>
          <button class="btn-action btn-del" onclick="deleteInquiry(${
            item.id
          })">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateSelectAllCheckbox(sortedList);
}

/** 상태 값에 따라 문의 목록을 필터링하고 다시 렌더링합니다. */
window.filterInquiries = (status) => {
  currentFilterStatus = status;

  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach((btn) => {
    if (
      btn.textContent ===
      {
        all: '전체',
        new: '신규',
        processing: '상담중',
        completed: '완료',
      }[status]
    ) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (status === 'all') {
    renderTable(allInquiries);
  } else {
    const filtered = allInquiries.filter((item) => item.status === status);
    renderTable(filtered);
  }
};

let currentId = null;

/** 특정 문의의 상세 정보를 모달에 표시합니다. */
window.openDetail = (id) => {
  const item = allInquiries.find((d) => d.id === id);
  if (!item) return;

  currentId = id;

  const typeMap = {
    apartment: '아파트',
    villa: '빌라/주택',
    commercial: '상업공간',
    etc: '기타',
  };
  const scopeMap = {
    full: '전체 리모델링',
    partial: '부분 시공',
    window: '창호 교체',
  };

  document.getElementById('m_userName').textContent = item.userName;
  document.getElementById('m_userPhone').textContent = item.userPhone;
  document.getElementById('m_spaceInfo').textContent = typeMap[item.spaceType];
  document.getElementById('m_location').textContent =
    `${item.location} (${item.areaSize}평)`;
  document.getElementById('m_scope').textContent = scopeMap[item.scope];
  document.getElementById('m_budget').textContent =
    `${item.budget.toLocaleString()}만원`;
  document.getElementById('m_schedule').textContent = item.schedule;
  document.getElementById('m_requests').textContent = item.requests;

  document.getElementById('m_statusSelect').value = item.status;
  document.getElementById('m_adminMemo').value = item.adminMemo || '';

  document.getElementById('detailModal').classList.add('active');
};

/** 상세 정보 모달을 닫습니다. */
window.closeModal = () => {
  document.getElementById('detailModal').classList.remove('active');
};

/** 모달에서 수정한 문의 상태와 메모를 서버에 저장합니다. */
window.saveInquiryData = async () => {
  if (!currentId) return;

  const newStatus = document.getElementById('m_statusSelect').value;
  const newMemo = document.getElementById('m_adminMemo').value;

  try {
    await window.apiFetch(`/inquiries/${currentId}`, {
      method: 'PATCH',
      body: { status: newStatus, adminMemo: newMemo },
    });
    alert('저장되었습니다.');
    closeModal();
    await fetchInquiries();
    window.filterInquiries(currentFilterStatus);
  } catch (err) {
    if (
      err.status === 401 ||
      (err.message && err.message.includes('expired'))
    ) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/admin-login');
      return;
    }
    alert('저장 실패: ' + err.message);
  }
};

/** ID를 기준으로 특정 문의를 삭제합니다. */
window.deleteInquiry = async (id) => {
  const confirmed = confirm(
    '정말 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.',
  );
  if (!confirmed) return;

  try {
    await window.apiFetch(`/inquiries/${id}`, { method: 'DELETE' });
    alert('삭제되었습니다.');
    await fetchInquiries();
    window.filterInquiries(currentFilterStatus);
  } catch (err) {
    if (
      err.status === 401 ||
      (err.message && err.message.includes('expired'))
    ) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/admin-login');
      return;
    }
    alert('삭제 실패: ' + err.message);
  }
};

/** 테이블 행의 개별 체크박스 선택 상태를 토글합니다. */
window.toggleRowSelect = (id, checked) => {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
};

/** 테이블의 모든 행을 선택하거나 선택 해제합니다. */
window.toggleSelectAll = (checked) => {
  const tbody = document.getElementById('inquiryTableBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');

  rows.forEach((tr) => {
    const checkbox = tr.querySelector('.row-checkbox');
    const idCell = tr.querySelector('td:nth-child(2)');
    if (!checkbox || !idCell) return;
    const id = Number(idCell.textContent);
    checkbox.checked = checked;
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
};

/** 렌더링된 목록을 기준으로 '전체 선택' 체크박스의 상태를 업데이트합니다. */
function updateSelectAllCheckbox(renderedList) {
  const selectAll = document.getElementById('selectAll');
  if (!selectAll) return;
  if (!renderedList.length) {
    selectAll.checked = false;
    return;
  }
  const allSelected = renderedList.every((item) => selectedIds.has(item.id));
  selectAll.checked = allSelected;
}

/** 선택된 모든 문의를 일괄적으로 삭제합니다. */
window.deleteSelected = async () => {
  if (selectedIds.size === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }
  if (
    !confirm(
      `선택한 ${selectedIds.size}건을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.`,
    )
  )
    return;

  try {
    for (const id of Array.from(selectedIds)) {
      await window.apiFetch(`/inquiries/${id}`, { method: 'DELETE' });
      selectedIds.delete(id);
    }
    alert('선택한 항목이 삭제되었습니다.');
    await fetchInquiries();
    window.filterInquiries(currentFilterStatus);
  } catch (err) {
    if (
      err.status === 401 ||
      (err.message && err.message.includes('expired'))
    ) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/admin-login');
      return;
    }
    alert('삭제 실패: ' + err.message);
  }
};
