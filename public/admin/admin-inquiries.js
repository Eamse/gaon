// src/admin-inquiries.js

// 1. 로그인 체크
if (!localStorage.getItem('token')) {
  alert('로그인이 만료되었거나 필요합니다.\n로그인 페이지로 이동합니다.');
  window.location.replace('/admin/admin-login');
}

// 2. 더미 데이터 (Mock Data) - 나중에 API로 대체될 부분
// consulting.html 폼의 필드와 매칭됩니다.
let allInquiries = [];
const selectedIds = new Set();

// 현재 필터 상태 저장 (기본값: 'all')
let currentFilterStatus = 'all';

// 3. 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  fetchInquiries();
});

// 4. 데이터 로드 함수
async function fetchInquiries() {
  try {
    const data = await window.apiFetch('/inquiries');
    allInquiries = data.inquiries || [];
    selectedIds.clear();

    updateStats(); // 통계 갱신
    renderTable(allInquiries); // 테이블 렌더링
  } catch (err) {
    console.error('문의 목록 로드 실패:', err);

    // 토큰 만료 시 로그인 페이지로 이동
    if (
      err.status === 401 ||
      (err.message && err.message.includes('expired'))
    ) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/admin/admin-login');
      return;
    }

    document.getElementById('inquiryTableBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center; color:red;">데이터 로드 실패</td></tr>';
  }
}

// 5. 통계 갱신
function updateStats() {
  const newCount = allInquiries.filter((i) => i.status === 'new').length;
  const ingCount = allInquiries.filter((i) => i.status === 'ing').length;

  document.getElementById('countNew').textContent = newCount;
  document.getElementById('countIng').textContent = ingCount;
  document.getElementById('countTotal').textContent = allInquiries.length;
}

// XSS 방지를 위한 HTML 이스케이프 함수
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 6. 테이블 렌더링
function renderTable(list) {
  const tbody = document.getElementById('inquiryTableBody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center; padding:30px; color:#6b7280;">문의 내역이 없습니다.</td></tr>';
    return;
  }

  // 매핑용 객체 (영어 -> 한글)
  const typeMap = {
    apartment: '아파트',
    villa: '빌라/주택',
    commercial: '상업공간',
    etc: '기타',
  };

  // 최신순 정렬 (ID 내림차순)
  const sortedList = [...list].sort((a, b) => b.id - a.id);

  sortedList.forEach((item) => {
    // 상태 뱃지 HTML 생성
    let badgeHtml = '';
    switch (item.status) {
      case 'new':
        badgeHtml = '<span class="badge badge-new">신규</span>';
        break;
      case 'ing':
        badgeHtml = '<span class="badge badge-ing">상담중</span>';
        break;
      case 'done':
        badgeHtml = '<span class="badge badge-done">완료</span>';
        break;
      default:
        badgeHtml = '<span class="badge badge-cancel">취소/보류</span>';
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
      <td>${typeMap[item.spaceType] || escapeHtml(item.spaceType)} / ${item.areaSize
      }평</td>
      <td>${Number(item.budget).toLocaleString()}만원</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-view" onclick="openDetail(${item.id
      })">상세보기</button>
          <button class="btn-action btn-del" onclick="deleteInquiry(${item.id
      })">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateSelectAllCheckbox(sortedList);
}

// 7. 필터링 로직
window.filterInquiries = (status) => {
  currentFilterStatus = status; // 현재 필터 상태 업데이트

  // 버튼 스타일 활성화
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach((btn) => {
    if (
      btn.textContent ===
      {
        all: '전체',
        new: '신규',
        ing: '상담중',
        done: '완료',
      }[status]
    ) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 데이터 필터링
  if (status === 'all') {
    renderTable(allInquiries);
  } else {
    const filtered = allInquiries.filter((item) => item.status === status);
    renderTable(filtered);
  }
};

// 8. 모달 제어 로직
let currentId = null;

window.openDetail = (id) => {
  const item = allInquiries.find((d) => d.id === id);
  if (!item) return;

  currentId = id;

  // 매핑 객체
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

  // 모달 데이터 채우기
  document.getElementById('m_userName').textContent = item.userName;
  document.getElementById('m_userPhone').textContent = item.userPhone;
  document.getElementById('m_spaceInfo').textContent = typeMap[item.spaceType];
  document.getElementById(
    'm_location'
  ).textContent = `${item.location} (${item.areaSize}평)`;
  document.getElementById('m_scope').textContent = scopeMap[item.scope];
  document.getElementById(
    'm_budget'
  ).textContent = `${item.budget.toLocaleString()}만원`;
  document.getElementById('m_schedule').textContent = item.schedule;
  document.getElementById('m_requests').textContent = item.requests;

  // 관리자 입력 필드 세팅
  document.getElementById('m_statusSelect').value = item.status;
  document.getElementById('m_adminMemo').value = item.adminMemo || '';

  // 모달 표시
  document.getElementById('detailModal').classList.add('active');
};

window.closeModal = () => {
  document.getElementById('detailModal').classList.remove('active');
};

// 9. 관리자 메모/상태 저장
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
    await fetchInquiries(); // DB에서 최신 데이터 다시 로드
    window.filterInquiries(currentFilterStatus); // 필터 상태 유지
  } catch (err) {
    // 토큰 만료 시 로그인 페이지로 이동
    if (
      err.status === 401 ||
      (err.message && err.message.includes('expired'))
    ) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      window.location.replace('/admin/admin-login');
      return;
    }
    alert('저장 실패: ' + err.message);
  }
};

// 10. 문의 삭제
window.deleteInquiry = async (id) => {
  const confirmed = confirm(
    '정말 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.'
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
      window.location.replace('/admin/admin-login');
      return;
    }
    alert('삭제 실패: ' + err.message);
  }
};

// 11. 체크박스 제어
window.toggleRowSelect = (id, checked) => {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
};

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

// 12. 선택 삭제
window.deleteSelected = async () => {
  if (selectedIds.size === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }
  if (
    !confirm(
      `선택한 ${selectedIds.size}건을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.`
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
      window.location.replace('/admin/admin-login');
      return;
    }
    alert('삭제 실패: ' + err.message);
  }
};
