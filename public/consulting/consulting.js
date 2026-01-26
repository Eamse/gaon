document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('consultingForm');

  if (!form) {
    console.warn(
      "⚠️ 'consultingForm' ID를 가진 폼을 찾을 수 없습니다. HTML을 확인해주세요."
    );
    return;
  }

  // 전화번호 자동 포맷팅
  const userPhone = document.getElementById('userPhone');
  if (userPhone) {
    userPhone.addEventListener('input', (e) => {
      let value = e.target.value.replace(/[^0-9]/g, '');
      if (value.length > 3 && value.length <= 7) {
        value = value.replace(/(\d{3})(\d+)/, '$1-$2');
      } else if (value.length > 7) {
        value = value.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
      }
      e.target.value = value.slice(0, 13); // 최대 13자
    });
  }

  // 예산 필드 - 숫자만 입력
  const budget = document.getElementById('budget');
  if (budget) {
    budget.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }

  // 평수 필드 - 숫자만 입력
  const areaSize = document.getElementById('areaSize');
  if (areaSize) {
    areaSize.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }


  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    console.log('📤 전송할 데이터:', data);

    if (!data.userName || !data.userPhone) {
      alert('이름과 연락처는 필수 입력 항목입니다.');
      return;
    }

    try {
      if (typeof window.apiFetch !== 'function') {
        throw new Error('common.js가 로드되지 않았습니다.');
      }

      // API 호출
      const res = await window.apiFetch('/inquiries', {
        method: 'POST',
        body: data,
      });

      if (res.ok) {
        alert(
          '견적 신청이 완료되었습니다.\n담당자가 확인 후 연락드리겠습니다.'
        );
        form.reset(); // 폼 초기화
        // 필요 시 메인 페이지로 이동: window.location.href = '/';
      } else {
        alert('신청 실패: ' + (res.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
    }
  });
});
