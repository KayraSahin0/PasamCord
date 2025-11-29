// ui.js
import { state } from './state.js';

// DOM Elementlerini Seç
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

// VİDEO KARTI EKLEME
export function addVideoCard(peerId, stream, name, isLocal) {
    // Aynı ID varsa tekrar ekleme
    if (document.getElementById(`video-${peerId}`)) return;

    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = `video-${peerId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) video.muted = true; // Kendimizi duymayalım

    // Büyütme Butonu
    const expandBtn = document.createElement('button');
    expandBtn.className = 'btn-expand';
    expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    expandBtn.onclick = () => toggleFullscreenCard(card, expandBtn);

    // İsim Etiketi
    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerHTML = `<i class="fa-solid fa-user"></i> <span id="name-${peerId}">${name}</span>`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'avatar-overlay';
    avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`;

    card.append(video, expandBtn, nameTag, avatar);
    videoGrid.appendChild(card);

    // Video aktif mi diye sürekli kontrol et (Avatar/Video değişimi için)
    monitorVideoState(stream, card);
}

export function removeVideoCard(peerId) {
    const card = document.getElementById(`video-${peerId}`);
    if (card) card.remove();
}

export function updateParticipantsUI() {
    participantList.innerHTML = "";
    
    // Ben
    addParticipantRow(state.myUsername + " (Sen)", true);
    
    // Diğerleri
    let count = 1;
    Object.values(state.peers).forEach(p => {
        addParticipantRow(p.name, false);
        count++;
    });
    participantBadge.innerText = count;
}

function addParticipantRow(name, isOnline) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div style="width:30px; height:30px; background:var(--primary); border-radius:50%; display:flex; justify-content:center; align-items:center; color:white; font-weight:bold;">
            ${name.charAt(0).toUpperCase()}
        </div>
        <span>${name}</span>
        <i class="fa-solid fa-circle" style="color:${isOnline ? '#3ba55c' : '#faa61a'}; font-size:0.5rem; margin-left:auto;"></i>
    `;
    participantList.appendChild(li);
}

// Video akışı var mı kontrol et (Siyah ekran yerine Avatar göstermek için)
function monitorVideoState(stream, card) {
    setInterval(() => {
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
        card.requestFullscreen().catch(err => alert(err.message));
        btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
        document.exitFullscreen();
        btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
}

// Yardımcılar
export function updateMyId(id) {
    document.getElementById('my-id').innerText = "#" + id;
}

export function updateNameTag(peerId, name) {
    const el = document.getElementById(`name-${peerId}`);
    if (el) el.innerText = name;
    
    const card = document.getElementById(`video-${peerId}`);
    if(card) card.querySelector('.avatar-circle').innerText = name.charAt(0).toUpperCase();
}