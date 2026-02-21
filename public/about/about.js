/** 네이버 지도를 초기화하고 지정된 위치에 마커를 표시합니다. */
function initMap() {
  const location = new naver.maps.LatLng(37.36231749140221, 126.9210837224447); // 군포시 금정 좌표
  const map = new naver.maps.Map('map', {
    center: location,
    zoom: 15,
  });

  const marker = new naver.maps.Marker({
    position: location,
    map,
    title: '가온 인테리어',
  });

  const infoWindow = new naver.maps.InfoWindow({
    content: `<div style="padding:10px;">가온 인테리어<br />경기도 군포시 산본동 1148 (묘향롯데아파트상가 206호)</div>`,
  });

  naver.maps.Event.addListener(marker, 'click', () => {
    infoWindow.open(map, marker);
  });
}
initMap();

document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.querySelector('.copy-btn');
  const addressText = '경기도 군포시 산본동 1148'; // 복사될 실제 텍스트

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard
        .writeText(addressText)
        .then(() => {
          showToast('주소가 복사되었습니다!');
        })
        .catch((err) => {
          console.error('복사 실패:', err);
          alert('주소 복사에 실패했습니다.');
        });
    });
  }
});

/** 화면 하단에 잠시 나타나는 토스트 메시지를 표시합니다. */
function showToast(message) {
  const toast = document.getElementById('copyToast');
  if (toast) {
    toast.textContent = message;
    toast.className = 'show';
    setTimeout(() => {
      toast.className = toast.className.replace('show', '');
    }, 3000);
  }
}
