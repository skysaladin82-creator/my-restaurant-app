const API_KEY = 'AIzaSyBmUiGjUvv5XqKQGTZHmCSZoTW1Odko32w';

let currentPlaces = [];
let myList = JSON.parse(localStorage.getItem('myList')) || [];
let currentLat = null;
let currentLng = null;
let currentRadius = 500;
let map = null;
let marker = null;
let mapOpen = false;

// 내 위치로 시작
navigator.geolocation.getCurrentPosition(
  position => {
    currentLat = position.coords.latitude;
    currentLng = position.coords.longitude;
    loadRestaurants(currentLat, currentLng, '');
  },
  error => {
    showLoading('위치 정보를 가져올 수 없어요 😢');
  }
);

function showLoading(msg) {
  const list = document.getElementById('restaurantList');
  list.innerHTML = `<p id="loadingMsg">${msg}</p>`;
}

async function loadRestaurants(lat, lng, type) {
  showLoading('🔍 주변 식당 검색 중...');

  const includedTypes = {
    '': ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery'],
    'korean': ['korean_restaurant'],
    'japanese': ['japanese_restaurant'],
    'chinese': ['chinese_restaurant'],
    'western': ['american_restaurant'],
    'cafe': ['cafe', 'bakery']
  }[type];

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.internationalPhoneNumber,places.currentOpeningHours,places.photos,places.priceLevel,places.types,places.location,places.reviews'
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: currentRadius
          }
        }
      })
    });

    const data = await res.json();
    currentPlaces = data.places || [];
    currentPlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    renderCards(currentPlaces);

  } catch (e) {
    showLoading('식당 정보를 불러오지 못했어요 😢');
  }
}

function renderCards(places) {
  const list = document.getElementById('restaurantList');

  if (places.length === 0) {
    list.innerHTML = '<p id="loadingMsg">주변 식당을 찾을 수 없어요 😢</p>';
    return;
  }

  list.innerHTML = places.map((place, idx) => {
    const name = place.displayName?.text || '이름 없음';
    const rating = place.rating ? `⭐ ${place.rating} (${place.userRatingCount || 0}개)` : '평점 없음';
    const isOpen = place.currentOpeningHours?.openNow;
    const openText = isOpen === true ? '<span class="cardOpen">영업 중</span>' :
                     isOpen === false ? '<span class="cardClosed">영업 종료</span>' : '';
    const photo = place.photos?.[0]
      ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=200&key=${API_KEY}`
      : 'https://placehold.co/80x80?text=🍽️';

    return `
      <div class="restaurantCard" onclick="openPopup(${idx})">
        <img class="cardPhoto" src="${photo}" alt="${name}">
        <div class="cardInfo">
          <div class="cardName">${name}</div>
          <div class="cardRating">${rating}</div>
          ${openText}
          <div class="cardCategory">${place.formattedAddress || ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getSearchQuery(name) {
  return encodeURIComponent(name);
}

function openPopup(idx, fromMyList = false) {
  const place = currentPlaces[idx];
  if (!place) return;

  const name = place.displayName?.text || place.name || '이름 없음';
  const rating = place.rating ? `⭐ ${place.rating} (${place.userRatingCount || 0}개 리뷰)` : '평점 없음';
  const address = place.formattedAddress || place.address || '주소 없음';
  const phone = place.internationalPhoneNumber || '전화번호 없음';
  const isOpen = place.currentOpeningHours?.openNow;
  const openText = isOpen === true ? '<span class="cardOpen">🟢 영업 중</span>' :
                   isOpen === false ? '<span class="cardClosed">🔴 영업 종료</span>' : '';
  const photo = place.photos?.[0]
    ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&maxHeightPx=300&key=${API_KEY}`
    : null;

  const isSaved = myList.some(item => item.name === name && item.address === address);
  const searchQuery = getSearchQuery(name);

  document.getElementById('popupBody').innerHTML = `
    <div id="popupHeader">
      ${photo ? `<img src="${photo}" alt="${name}">` : ''}
      <div id="popupHeaderInfo">
        <div class="popupName">${name}</div>
        <div class="popupRating">${rating}</div>
        <div class="popupInfo">${openText}</div>
      </div>
    </div>
    <div class="popupInfo">📍 ${address}</div>
    <div class="popupInfo">📞 ${phone}</div>
    <div class="popupInfo">
      <textarea class="memoInput" rows="2" placeholder="메모를 입력하세요" onchange="saveMemo(${idx}, this.value)">${getMemo(name, address)}</textarea>
    </div>
    ${buildReviews(place.reviews)}
    <div class="popupBtns">
      <button class="btnGoogle" onclick="window.open('https://www.google.com/maps/search/${searchQuery}', '_blank')">구글 지도에서 리뷰 더 보기</button>
      <button class="btnNaver" onclick="window.open('https://map.naver.com/v5/search/${searchQuery}', '_blank')">네이버 지도에서 리뷰 더 보기</button>
      <button class="btnKakao" onclick="window.open('https://map.kakao.com/?q=${searchQuery}', '_blank')">카카오맵에서 리뷰 더 보기</button>
      <button class="btnSave" id="saveBtn" onclick="toggleSave(${idx})">${isSaved ? '⭐ 내 맛집 해제' : '☆ 내 맛집 저장'}</button>
    </div>
  `;

  document.getElementById('myListPopup').classList.add('hidden');
  document.getElementById('popup').classList.remove('hidden');
}

document.getElementById('closePopup').onclick = () => {
  document.getElementById('popup').classList.add('hidden');
};

function getMemo(name, address) {
  const item = myList.find(i => i.name === name && i.address === address);
  return item?.memo || '';
}

function saveMemo(idx, value) {
  const place = currentPlaces[idx];
  if (!place) return;
  const name = place.displayName?.text || '';
  const address = place.formattedAddress || '';
  const listIdx = myList.findIndex(i => i.name === name && i.address === address);
  if (listIdx >= 0) {
    myList[listIdx].memo = value;
    localStorage.setItem('myList', JSON.stringify(myList));
  }
}

function saveMemoFromList(idx, value) {
  if (myList[idx]) {
    myList[idx].memo = value;
    localStorage.setItem('myList', JSON.stringify(myList));
  }
}

function toggleSave(idx) {
  const place = currentPlaces[idx];
  const name = place.displayName?.text || '이름 없음';
  const address = place.formattedAddress || '';
  const rating = place.rating || 0;
  const phone = place.internationalPhoneNumber || '';

  const exists = myList.findIndex(item => item.name === name && item.address === address);
  if (exists >= 0) {
    myList.splice(exists, 1);
    document.getElementById('saveBtn').textContent = '☆ 내 맛집 저장';
  } else {
    myList.push({ name, address, rating, phone, memo: '' });
    document.getElementById('saveBtn').textContent = '⭐ 내 맛집 해제';
  }

  localStorage.setItem('myList', JSON.stringify(myList));
}

document.getElementById('myListBtn').onclick = () => {
  renderMyList();
  document.getElementById('myListPopup').classList.remove('hidden');
};

function renderMyList() {
  const body = document.getElementById('myListBody');

  if (myList.length === 0) {
    body.innerHTML = '<p class="emptyMsg">저장된 맛집이 없어요 😢</p>';
    return;
  }

  body.innerHTML = myList.map((item, idx) => `
    <div class="myListItem" onclick="openMyListPopup(${idx})">
      <div style="flex:1; cursor:pointer;">
        <div style="font-size:15px; font-weight:600;">${item.name}</div>
        <div style="font-size:12px; color:#aaa; margin-top:2px;">${item.address}</div>
        <div style="font-size:13px; color:#FF6B35; margin-top:2px;">⭐ ${item.rating || '평점 없음'}</div>
        <div class="memoText" onclick="event.stopPropagation(); editMemoInList(${idx}, this)">${item.memo || ''}</div>
      </div>
      <button class="myListDelete" onclick="event.stopPropagation(); deleteMyList(${idx})">삭제</button>
    </div>
  `).join('');
}

function openMyListPopup(idx) {
  const item = myList[idx];
  const itemName = item.name;
  const itemAddress = item.address;

  const placeIdx = currentPlaces.findIndex(p =>
    (p.displayName?.text || '') === itemName &&
    (p.formattedAddress || '') === itemAddress
  );

  if (placeIdx >= 0) {
    openPopup(placeIdx, true);
  } else {
    const searchQuery = getSearchQuery(itemName);
    document.getElementById('popupBody').innerHTML = `
      <div class="popupName">${itemName}</div>
      <div class="popupRating">⭐ ${item.rating || '평점 없음'}</div>
      <div class="popupInfo">📍 ${itemAddress}</div>
      <div class="popupInfo">📞 ${item.phone || '전화번호 없음'}</div>
      <div class="popupInfo">
        <textarea class="memoInput" rows="2" placeholder="메모를 입력하세요" onchange="saveMemoFromList(${idx}, this.value)">${item.memo || ''}</textarea>
      </div>
      <div class="popupBtns">
        <button class="btnGoogle" onclick="window.open('https://www.google.com/maps/search/${searchQuery}', '_blank')">구글 지도에서 리뷰 더 보기</button>
        <button class="btnNaver" onclick="window.open('https://map.naver.com/v5/search/${searchQuery}', '_blank')">네이버 지도에서 리뷰 더 보기</button>
        <button class="btnKakao" onclick="window.open('https://map.kakao.com/?q=${searchQuery}', '_blank')">카카오맵에서 리뷰 더 보기</button>
      </div>
    `;
    document.getElementById('myListPopup').classList.add('hidden');
    document.getElementById('popup').classList.remove('hidden');
  }
}

function editMemoInList(idx, el) {
  const item = myList[idx];
  const textarea = document.createElement('textarea');
  textarea.className = 'memoInput';
  textarea.rows = 2;
  textarea.value = item.memo || '';
  textarea.placeholder = '메모를 입력하세요';
  el.replaceWith(textarea);
  textarea.focus();
  textarea.addEventListener('blur', () => {
    myList[idx].memo = textarea.value;
    localStorage.setItem('myList', JSON.stringify(myList));
    const newEl = document.createElement('div');
    newEl.className = 'memoText';
    newEl.textContent = textarea.value;
    newEl.onclick = (e) => { e.stopPropagation(); editMemoInList(idx, newEl); };
    textarea.replaceWith(newEl);
  });
}

function deleteMyList(idx) {
  myList.splice(idx, 1);
  localStorage.setItem('myList', JSON.stringify(myList));
  renderMyList();
}

document.getElementById('closeMyList').onclick = () => {
  document.getElementById('myListPopup').classList.add('hidden');
};

// 바탕 클릭 시 팝업 닫기
document.getElementById('popup').addEventListener('click', (e) => {
  if (e.target === document.getElementById('popup')) {
    document.getElementById('popup').classList.add('hidden');
  }
});

document.getElementById('myListPopup').addEventListener('click', (e) => {
  if (e.target === document.getElementById('myListPopup')) {
    document.getElementById('myListPopup').classList.add('hidden');
  }
});

// 필터 버튼
document.querySelectorAll('.filterBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filterBtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (currentLat && currentLng) {
      loadRestaurants(currentLat, currentLng, btn.dataset.type);
    }
  });
});

// 반경 버튼
document.querySelectorAll('.radiusBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.radiusBtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRadius = parseInt(btn.dataset.radius);
    if (currentLat && currentLng) {
      loadRestaurants(currentLat, currentLng, document.querySelector('.filterBtn.active').dataset.type);
    }
  });
});

// 내 위치 버튼
document.getElementById('myLocationBtn').onclick = () => {
  navigator.geolocation.getCurrentPosition(
    position => {
      currentLat = position.coords.latitude;
      currentLng = position.coords.longitude;
      if (map) map.setCenter({ lat: currentLat, lng: currentLng });
      loadRestaurants(currentLat, currentLng, document.querySelector('.filterBtn.active').dataset.type);
    },
    error => {
      alert('위치 정보를 가져올 수 없어요 😢');
    }
  );
};

// 주소 검색
document.getElementById('searchBtn').onclick = searchLocation;
document.getElementById('locationInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchLocation();
});

function searchLocation() {
  const query = document.getElementById('locationInput').value.trim();
  if (!query) return;

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: '대한민국 ' + query, region: 'KR' }, (results, status) => {
    if (status === 'OK' && results[0]) {
      currentLat = results[0].geometry.location.lat();
      currentLng = results[0].geometry.location.lng();

      // 지도 자동으로 열기
      const container = document.getElementById('mapContainer');
      if (!mapOpen) {
        mapOpen = true;
        container.classList.add('open');
        document.getElementById('mapToggleBtn').textContent = '🗺️ 지도 닫기';
      }

      // 지도 초기화 안됐으면 초기화
      if (!map) {
        map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: currentLat, lng: currentLng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        });

        map.addListener('click', (e) => {
          currentLat = e.latLng.lat();
          currentLng = e.latLng.lng();

          if (marker) marker.setMap(null);
          marker = new google.maps.Marker({
            position: { lat: currentLat, lng: currentLng },
            map: map,
            title: '선택한 위치'
          });

          loadRestaurants(currentLat, currentLng, document.querySelector('.filterBtn.active').dataset.type);
        });
      } else {
        map.setCenter({ lat: currentLat, lng: currentLng });
        map.setZoom(15);
      }

      // 핀 찍기
      if (marker) marker.setMap(null);
      marker = new google.maps.Marker({
        position: { lat: currentLat, lng: currentLng },
        map: map,
        title: query
      });

      loadRestaurants(currentLat, currentLng, document.querySelector('.filterBtn.active').dataset.type);
    } else {
      alert('주소를 찾을 수 없어요. 예) 강남구 역삼동, 순천시 조곡동');
    }
  });
}

// 지도 토글
document.getElementById('mapToggleBtn').onclick = () => {
  const container = document.getElementById('mapContainer');
  mapOpen = !mapOpen;

  if (mapOpen) {
    container.classList.add('open');
    document.getElementById('mapToggleBtn').textContent = '🗺️ 지도 닫기';

    if (!map) {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: currentLat || 37.5665, lng: currentLng || 126.9780 },
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
      });

      // 지도 클릭 시 핀 찍기
      map.addListener('click', (e) => {
        currentLat = e.latLng.lat();
        currentLng = e.latLng.lng();

        if (marker) marker.setMap(null);
        marker = new google.maps.Marker({
          position: { lat: currentLat, lng: currentLng },
          map: map,
          title: '선택한 위치'
        });

        loadRestaurants(currentLat, currentLng, document.querySelector('.filterBtn.active').dataset.type);
      });
    } else {
      if (currentLat && currentLng) {
        map.setCenter({ lat: currentLat, lng: currentLng });
      }
    }
  } else {
    container.classList.remove('open');
    document.getElementById('mapToggleBtn').textContent = '🗺️ 지도 핀 찍기';
  }
};

function buildReviews(reviews) {
  if (!reviews || reviews.length === 0) return '';

  const stars = (rating) => '⭐'.repeat(Math.round(rating));

  const renderItem = (review) => `
    <div class="reviewItem">
      <div class="reviewAuthor">${review.authorAttribution?.displayName || '익명'}</div>
      <div class="reviewRating">${stars(review.rating)} ${review.rating}점</div>
      <div class="reviewText">${review.text?.text || ''}</div>
    </div>
  `;

  const all = reviews.map(renderItem).join('');

  return `
    <div class="reviewSection">
      <div class="reviewTitle">리뷰 (${reviews.length}개)</div>
      <div id="reviewMore" style="display:none">${all}</div>
      <button class="reviewMore" onclick="toggleReviews(this)">리뷰 보기 ▼</button>
    </div>
  `;
}

function toggleReviews(btn) {
  const more = document.getElementById('reviewMore');
  if (more.style.display === 'none') {
    more.style.display = 'block';
    btn.textContent = '리뷰 접기 ▲';
  } else {
    more.style.display = 'none';
    btn.textContent = '리뷰 보기 ▼';
  }
}