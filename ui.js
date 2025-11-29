import { state } from './state.js';

// ... (Video kartı fonksiyonları aynı kalacak) ...
// addVideoCard, removeVideoCard vs. önceki cevaptaki gibi kalabilir.
// Sadece updateParticipantsUI değişti:

// DOM Elementleri
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

export function addVideoCard(peerId, stream, name, isLocal) {
    const cardId = isLocal ? 'video-local' : `video-${peerId}`;
    if (document.getElementById(cardId)) return;

    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = cardId;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    if (isLocal) {
        video.muted = true;
    } else {
        if (state.isDeafened) video.muted = true;
        else video.muted = false;
    }

    const expandBtn = document.createElement('button');
    expandBtn.className = 'btn-expand'; // CSS'i style.css'te olmalı
    expandBtn.style.cssText = "position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; z-index: 20;";
    expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    expandBtn.onclick = () => toggleFullscreenCard(card, expandBtn);

    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerHTML = `<i class="fa-solid fa-user"></i> <span id="name-${peerId}">${name}</span>`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar-overlay';
    avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`;

    card.append(video, expandBtn, nameTag, avatar);
    videoGrid.appendChild(card);
    monitorVideoState(stream, card);
}

export function removeVideoCard(peerId) {
    const card = document.getElementById(`video-${peerId}`);
    if (card) card.remove();
}

// --- GÜNCELLENEN KATILIMCI LİSTESİ ---
export function updateParticipantsUI() {
    if (!participantList) return;
    participantList.innerHTML = "";
    
    // state.participantList ağdan gelen senkronize veridir
    // Eğer boşsa (henüz bağlanmadıysak), kendimizi ekleyelim
    const listToRender = (state.participantList.length > 0) 
        ? state.participantList 
        : [{ name: state.myUsername, id: state.peer?.id, isMe: true }];

    listToRender.forEach(user => {
        // isMe kontrolünü ID üzerinden yapıyoruz
        const isMe = (user.id === state.peer?.id);
        addParticipantRow(user.name + (isMe ? " (Sen)" : ""), isMe);
    });

    if (participantBadge) participantBadge.innerText = listToRender.length;
}

function addParticipantRow(name, isMe) {
    const li = document.createElement('li');
    const statusColor = '#3ba55c'; 

    li.innerHTML = `
        <div class="user-avatar" style="background-color: ${isMe ? 'var(--primary)' : '#faa61a'}; width:32px; height:32px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold; color:white;">
            ${name.charAt(0).toUpperCase()}
        </div>
        <span style="font-weight: 500; color: var(--text-main); font-size: 0.9rem;">${name}</span>
        <i class="fa-solid fa-circle" style="color:${statusColor}; font-size: 0.6rem; margin-left: auto;"></i>
    `;
    participantList.appendChild(li);
}

export function updateMyId(id) {
    const el = document.getElementById('my-id');
    if(el) el.innerText = "#" + id;
}

export function updateNameTag(peerId, name) {
    const nameEl = document.getElementById(`name-${peerId}`);
    if (nameEl) nameEl.innerText = name;
    
    const card = document.getElementById(`video-${peerId}`);
    if (card) {
        const avatarEl = card.querySelector('.avatar-circle');
        if (avatarEl) avatarEl.innerText = name.charAt(0).toUpperCase();
    }
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