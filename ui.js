import { state } from './state.js';

const videoGrid = document.getElementById('video-grid');
const participantList = document.getElementById('participant-list');
const participantBadge = document.getElementById('participant-badge');

let isFocusMode = false;

// --- EKRAN YÖNETİMİ ---
export function showAppScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('display-username').innerText = state.myUsername;
    startClock();
}

export function showCallScreen() {
    document.getElementById('connect-panel').classList.add('hidden');
    const remoteId = document.getElementById('remote-id').value || "Oda";
    document.getElementById('footer-room-id').innerText = "#" + remoteId;
}

export function resetScreens() { window.location.reload(); }

export function openSettingsTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    const btns = Array.from(document.querySelectorAll('.tab-btn'));
    const target = btns.find(b => b.innerText.toLowerCase().includes(tabName === 'devices' ? 'cihazlar' : (tabName === 'audio' ? 'ses' : 'video')));
    if(target) target.classList.add('active');
}

// --- VİDEO KARTI EKLEME ---
export function addVideoCard(peerId, stream, name, isLocal, isScreen = false) {
    let cardId = isLocal ? (isScreen ? 'screen-local' : 'video-local') : (isScreen ? `screen-${peerId}` : `video-${peerId}`);
    if (document.getElementById(cardId)) return;

    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = cardId;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    if (isLocal && !isScreen && state.isMirrored) video.classList.add('mirrored');

    if (isLocal) video.muted = true;
    else if (state.isDeafened) video.muted = true;
    else video.muted = false;

    const expandBtn = document.createElement('button');
    expandBtn.className = 'btn-expand';
    expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    expandBtn.onclick = (e) => { e.stopPropagation(); toggleFocusMode(card); };

    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerHTML = name + (isScreen ? " (Ekran)" : "");

    if (!isScreen) {
        const avatar = document.createElement('div');
        avatar.className = 'avatar-overlay';
        avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`;
        card.appendChild(avatar);
    }

    card.append(video, expandBtn, nameTag);

    // EĞER FOCUS MODE AÇIKSA YENİ GELENİ SAĞ ALTA EKLE
    const strip = document.getElementById('filmstrip-overlay');
    if (isFocusMode && strip) {
        strip.appendChild(card);
        card.onclick = () => swapFeatured(card); // Tıklanınca yer değiştirsin
    } else {
        videoGrid.appendChild(card);
    }

    if (isScreen) card.classList.add('video-active');
    else monitorVideoState(stream, card);
}

export function removeVideoCard(peerId, isScreen = false) {
    let cardId = (peerId === 'local') ? (isScreen ? 'screen-local' : 'video-local') : (isScreen ? `screen-${peerId}` : `video-${peerId}`);
    const card = document.getElementById(cardId);
    if (card) {
        // Eğer silinen kart "Featured" ise modu kapat
        if (card.classList.contains('featured')) {
            exitFocusMode();
        }
        card.remove();
    }
}

// --- FİLM ŞERİDİ (SAĞ ALT KÖŞE) ---
function toggleFocusMode(selectedCard) {
    if (!isFocusMode) {
        // MODU AÇ
        isFocusMode = true;
        videoGrid.classList.add('focus-mode');
        selectedCard.classList.add('featured');

        // Sağ Alt Konteyneri Oluştur
        let strip = document.createElement('div');
        strip.id = 'filmstrip-overlay';
        strip.className = 'filmstrip-overlay';
        document.getElementById('video-stage').appendChild(strip);

        // Seçilmeyenleri oraya taşı
        Array.from(videoGrid.children).forEach(child => {
            if (child.classList.contains('video-card') && !child.classList.contains('featured')) {
                strip.appendChild(child);
                child.onclick = () => swapFeatured(child);
            }
        });

        // Buton ikonunu değiştir
        const btn = selectedCard.querySelector('.btn-expand');
        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            btn.onclick = (e) => { e.stopPropagation(); exitFocusMode(); };
        }

    } else {
        // Zaten açıksa kapat
        if(selectedCard.classList.contains('featured')) {
            exitFocusMode();
        } else {
            swapFeatured(selectedCard);
        }
    }
}

function exitFocusMode() {
    isFocusMode = false;
    videoGrid.classList.remove('focus-mode');
    
    const featuredCard = videoGrid.querySelector('.featured');
    if(featuredCard) {
        featuredCard.classList.remove('featured');
        featuredCard.onclick = null;
        const btn = featuredCard.querySelector('.btn-expand');
        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            btn.onclick = (e) => { e.stopPropagation(); toggleFocusMode(featuredCard); };
        }
    }

    const strip = document.getElementById('filmstrip-overlay');
    if (strip) {
        // Hepsini geri grid'e taşı
        while(strip.firstChild) {
            const c = strip.firstChild;
            videoGrid.appendChild(c);
            c.onclick = null;
        }
        strip.remove();
    }
}

function swapFeatured(newCard) {
    const strip = document.getElementById('filmstrip-overlay');
    const currentFeatured = videoGrid.querySelector('.featured');

    if (currentFeatured && strip) {
        // Eskiyi küçült, şeride at
        currentFeatured.classList.remove('featured');
        const btn1 = currentFeatured.querySelector('.btn-expand');
        if(btn1) {
            btn1.innerHTML = '<i class="fa-solid fa-expand"></i>';
            btn1.onclick = (e) => { e.stopPropagation(); toggleFocusMode(currentFeatured); };
        }
        currentFeatured.onclick = () => swapFeatured(currentFeatured);
        strip.appendChild(currentFeatured);

        // Yeniyi büyüt, grid'e al
        videoGrid.appendChild(newCard); 
        newCard.classList.add('featured');
        newCard.onclick = null;
        const btn2 = newCard.querySelector('.btn-expand');
        if(btn2) {
            btn2.innerHTML = '<i class="fa-solid fa-compress"></i>';
            btn2.onclick = (e) => { e.stopPropagation(); exitFocusMode(); };
        }
    }
}

// ... Yardımcı Fonksiyonlar ...
export function setLocalMirror(isMirrored) {
    state.isMirrored = isMirrored;
    const v = document.querySelector('#video-local video');
    if(v) isMirrored ? v.classList.add('mirrored') : v.classList.remove('mirrored');
}

export function updateParticipantsUI() {
    if (!participantList) return;
    participantList.innerHTML = "";
    const list = (state.participantList.length > 0) ? state.participantList : [{ name: state.myUsername, id: state.peer?.id, isMe: true }];
    list.forEach(u => addParticipantRow(u.name + (u.id === state.peer?.id ? " (Sen)" : ""), u.id === state.peer?.id));
    if(participantBadge) participantBadge.innerText = list.length;
}

function addParticipantRow(name, isMe) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div style="width:32px; height:32px; border-radius:50%; background:${isMe ? '#fff' : '#5865F2'}; color:${isMe?'#000':'#fff'}; display:flex; justify-content:center; align-items:center; font-weight:bold;">${name.charAt(0).toUpperCase()}</div>
        <span style="font-weight: 500; font-size: 0.9rem;">${name}</span>
    `;
    participantList.appendChild(li);
}

export function updateMyId(id) {
    const el = document.getElementById('my-id');
    if(el) el.innerText = id;
}

export function updateNameTag(peerId, name) {
    const el = document.getElementById(`name-video-${peerId}`);
    if(el) el.innerHTML = name;
}

function monitorVideoState(stream, card) {
    const interval = setInterval(() => {
        if (!card.isConnected) { clearInterval(interval); return; }
        const track = stream.getVideoTracks()[0];
        if (track && track.enabled && track.readyState === 'live') {
            card.classList.add('video-active');
        } else {
            card.classList.remove('video-active');
        }
    }, 1000);
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        const t = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const el = document.getElementById('clock-display');
        if(el) el.innerText = t;
    }, 1000);
}