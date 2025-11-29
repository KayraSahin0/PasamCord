import { state } from './state.js';

const videoGrid = document.getElementById('video-grid');
const participantList = document.getElementById('participant-list');
const participantBadge = document.getElementById('participant-badge');

export function showAppScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('display-username').innerText = state.myUsername;
}

export function showCallScreen() {
    document.getElementById('connect-panel').classList.add('hidden');
    document.getElementById('call-panel').classList.remove('hidden');
}

export function resetScreens() {
    window.location.reload();
}

// --- VİDEO KARTI EKLEME ---
export function addVideoCard(peerId, stream, name, isLocal, isScreen = false) {
    // ID Oluşturma: Kamera için 'video-ID', Ekran için 'screen-ID'
    let cardId;
    if (isLocal) {
        cardId = isScreen ? 'screen-local' : 'video-local';
    } else {
        cardId = isScreen ? `screen-${peerId}` : `video-${peerId}`;
    }

    if (document.getElementById(cardId)) return;

    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = cardId;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    // Ses Kontrolü
    if (isLocal) {
        video.muted = true; 
    } else {
        // Ekran paylaşımında ses varsa ve sağırlaştırma kapalıysa ses gelir
        if (state.isDeafened) video.muted = true;
        else video.muted = false;
    }

    // Büyütme Butonu
    const expandBtn = document.createElement('button');
    expandBtn.style.cssText = "position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.6); color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; z-index:20;";
    expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    expandBtn.onclick = () => toggleFullscreenCard(card, expandBtn);

    // İsim Etiketi
    const displayName = isScreen ? `${name} (Ekran)` : name;
    const iconClass = isScreen ? 'fa-desktop' : 'fa-user';

    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span id="name-${cardId}">${displayName}</span>`;

    // Avatar (Sadece kamera ise ve kapalıysa görünür)
    if (!isScreen) {
        const avatar = document.createElement('div');
        avatar.className = 'avatar-overlay';
        avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`;
        card.appendChild(avatar);
    }

    card.append(video, expandBtn, nameTag);
    videoGrid.appendChild(card);

    if (isScreen) {
        card.classList.add('video-active'); // Ekran hep aktiftir
    } else {
        monitorVideoState(stream, card);
    }
}

export function removeVideoCard(peerId, isScreen = false) {
    let cardId;
    // Eğer peerId 'local' ise özel işlem
    if(peerId === 'local') {
        cardId = isScreen ? 'screen-local' : 'video-local';
    } else {
        cardId = isScreen ? `screen-${peerId}` : `video-${peerId}`;
    }

    const card = document.getElementById(cardId);
    if (card) card.remove();
}

// --- KATILIMCI LİSTESİ ---
export function updateParticipantsUI() {
    if (!participantList) return;
    participantList.innerHTML = "";
    
    // Eğer liste boşsa (ilk giriş)
    const listToRender = (state.participantList.length > 0) 
        ? state.participantList 
        : [{ name: state.myUsername, id: state.peer?.id, isMe: true }];

    listToRender.forEach(user => {
        const isMe = (user.id === state.peer?.id);
        addParticipantRow(user.name + (isMe ? " (Sen)" : ""), isMe);
    });

    if (participantBadge) participantBadge.innerText = listToRender.length;
}

function addParticipantRow(name, isMe) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div class="user-avatar" style="background-color: ${isMe ? 'var(--primary)' : '#faa61a'}; width:32px; height:32px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold; color:white;">
            ${name.charAt(0).toUpperCase()}
        </div>
        <span style="font-weight: 500; color: var(--text-main); font-size: 0.9rem;">${name}</span>
        <i class="fa-solid fa-circle" style="color:#3ba55c; font-size: 0.6rem; margin-left: auto;"></i>
    `;
    participantList.appendChild(li);
}

// --- YARDIMCI ---
export function updateMyId(id) {
    const el = document.getElementById('my-id');
    if(el) el.innerText = "#" + id;
}

export function updateNameTag(peerId, name) {
    // Kamerayı güncelle
    const nameEl = document.getElementById(`name-video-${peerId}`);
    if (nameEl) nameEl.innerText = name;
    const card = document.getElementById(`video-${peerId}`);
    if(card) {
        const av = card.querySelector('.avatar-circle');
        if(av) av.innerText = name.charAt(0).toUpperCase();
    }
    // Varsa ekranı da güncelle
    const screenNameEl = document.getElementById(`name-screen-${peerId}`);
    if(screenNameEl) screenNameEl.innerText = `${name} (Ekran)`;
}

function monitorVideoState(stream, card) {
    const interval = setInterval(() => {
        if (!card.isConnected) { clearInterval(interval); return; }
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.enabled && videoTrack.readyState === 'live') {
            card.classList.add('video-active');
        } else {
            card.classList.remove('video-active');
        }
    }, 1000);
}

function toggleFullscreenCard(card, btn) {
    if (!document.fullscreenElement) {
        card.requestFullscreen().catch(console.error);
        btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
        document.exitFullscreen();
        btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
}