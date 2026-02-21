console.log('📝 [Admin Projects] Script Loaded');

const form = document.getElementById('createForm');
const submitBtn = document.getElementById('submitBtn');
const costListContainer = document.getElementById('costListContainer');
const btnAddCost = document.getElementById('btnAddCost');
const totalPriceDisplay = document.getElementById('totalPriceDisplay');

document.addEventListener('DOMContentLoaded', () => {
  initForm();
});

/** 폼 제출 및 비용 항목 추가 이벤트 리스너를 초기화합니다. */
function initForm() {
  form.addEventListener('submit', handleFormSubmit);

  if (btnAddCost) {
    btnAddCost.addEventListener('click', () => addCostItem());
  }

  console.log('✅ Form initialized');
}

/** 견적 비용 항목 입력 필드를 동적으로 추가합니다. */
function addCostItem(label = '', amount = '') {
  const div = document.createElement('div');
  div.className = 'cost-item';
  div.style.display = 'flex';
  div.style.gap = '10px';
  div.style.marginBottom = '8px';

  div.innerHTML = `
        <input 
            type="text" 
            class="cost-label" 
            placeholder="항목 (예: 철거공사)" 
            value="${label}" 
            style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input 
            type="number" 
            class="cost-amount" 
            placeholder="금액 (만원)" 
            value="${amount}" 
            style="width: 120px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <button 
            type="button" 
            class="btn-remove-cost" 
            style="background: #fff; border: 1px solid #fca5a5; color: #ef4444; border-radius: 4px; cursor: pointer; padding: 8px 12px;">
            삭제
        </button>
    `;

  div.querySelector('.btn-remove-cost').addEventListener('click', () => {
    div.remove();
    calculateTotal();
  });

  div.querySelector('.cost-amount').addEventListener('input', calculateTotal);
  costListContainer.appendChild(div);
  calculateTotal();
}

/** 모든 비용 항목의 합계를 계산하여 총 견적 금액을 업데이트합니다. */
function calculateTotal() {
  let total = 0;
  document.querySelectorAll('.cost-amount').forEach((input) => {
    const value = parseInt(input.value) || 0;
    total += value;
  });
  totalPriceDisplay.value = total.toLocaleString();
}

/** 폼 제출 시, 프로젝트 정보와 이미지를 서버에 전송하여 새 프로젝트를 생성합니다. */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 등록 중...';
  }

  try {
    const formData = new FormData(form);

    const costs = [];
    document.querySelectorAll('.cost-item').forEach((item) => {
      const label = item.querySelector('.cost-label').value;
      const amount = item.querySelector('.cost-amount').value;
      if (label && amount) {
        costs.push({ label, amount: parseInt(amount, 10) });
      }
    });

    const payload = {
      title: formData.get('title'),
      location: formData.get('location'),
      description: formData.get('description'),
      category: formData.get('category'),
      year: formData.get('year') ? parseInt(formData.get('year'), 10) : null,
      period: formData.get('period'),
      area: formData.get('area') ? parseInt(formData.get('area'), 10) : null,
      costs: costs,
    };

    const projectRes = await window.apiFetch('/projects', {
      method: 'POST',
      body: payload,
    });

    const projectId = projectRes.data?.id;

    if (!projectId) {
      console.error('응답:', projectRes);
      throw new Error('프로젝트 ID를 받지 못했습니다.');
    }

    const mainFile = formData.get('mainImageFile');
    const detailFilesInput = form.querySelector(
      'input[name="detailImageFiles"]',
    );
    const detailFiles = detailFilesInput ? detailFilesInput.files : [];

    const hasMain = mainFile && mainFile.size > 0;
    const hasDetail = detailFiles && detailFiles.length > 0;

    if (hasMain || hasDetail) {
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> 이미지 업로드 중...';

      const imageFormData = new FormData();
      if (hasMain) {
        imageFormData.append('mainImageFile', mainFile);
      }
      if (hasDetail) {
        for (let i = 0; i < detailFiles.length; i++) {
          imageFormData.append('detailImageFiles', detailFiles[i]);
        }
      }

      console.log('🔍 이미지 업로드 시도:', {
        projectId,
        hasMain,
        hasDetail,
        mainFileName: mainFile?.name,
        detailCount: detailFiles.length,
      });

      console.log('📦 FormData entries:');
      for (let [key, value] of imageFormData.entries()) {
        if (value instanceof File) {
          console.log(
            `  - ${key}: ${value.name} (${value.size} bytes, ${value.type})`,
          );
        } else {
          console.log(`  - ${key}: ${value}`);
        }
      }

      const uploadResponse = await window.apiFetch(
        `/projects/${projectId}/images`,
        {
          method: 'POST',
          body: imageFormData,
        },
      );

      console.log('✅ 이미지 업로드 성공!', uploadResponse);
    }

    alert('프로젝트가 성공적으로 등록되었습니다!');
    window.location.href = '/admin-gallery';
  } catch (error) {
    console.error('❌ Error:', error);
    alert('등록 중 오류가 발생했습니다: ' + error.message);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> 등록하기';
    }
  }
}
