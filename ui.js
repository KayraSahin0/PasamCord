import { state } from './state.js';
import * as Network from './network.js';

const videoGrid = document.getElementById('video-grid');
const participantList = document.getElementById('participant-list');
const participantBadge = document.getElementById('participant-badge');
const chatPanel = document.getElementById('chat-panel');
const chatContent = document.getElementById('chat-content');
const chatBadge = document.getElementById('chat-badge');
const youtubePanel = document.getElementById('youtube-panel');
const adOverlay = document.getElementById('ad-wait-overlay');

let isFocusMode = false;
let isRemoteUpdate = false;

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

export function updateRoomId(id) {
    document.getElementById('footer-room-id').innerText = "#" + id;
}

export function resetScreens() { window.location.reload(); }

// --- AYARLAR SEKME ---
export function openSettingsTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    const btns = Array.from(document.querySelectorAll('.nav-btn'));
    const target = btns.find(b => {
        if(tabName === 'devices') return b.innerText.includes('Ses');
        if(tabName === 'quality') return b.innerText.includes('Kalite');
        if(tabName === 'audio') return b.innerText.includes('Düzeyleri');
        if(tabName === 'video') return b.innerText.includes('Görünüm');
    });
    if(target) target.classList.add('active');
}

// --- CHAT PANELİ ---
export function toggleChatPanel() {
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) {
        chatBadge.classList.add('hidden');
    }
    updateLayout(); // Panellerin konumunu güncelle
}

export function addMessageToUI(sender, text, isMe) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMe ? 'mine' : 'theirs'}`;
    msgDiv.innerHTML = `<div class="message-header"><span class="msg-sender">${isMe ? 'Sen' : sender}</span><span class="msg-time">${time}</span></div><div class="msg-text">${escapeHtml(text)}</div>`;
    chatContent.appendChild(msgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;
    if (!isMe && !chatPanel.classList.contains('open') && chatBadge) chatBadge.classList.remove('hidden');
}

function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

// --- YOUTUBE PANELİ ---
export function toggleYouTubePanel() {
    const pPanel = document.getElementById('participants-panel');
    if(pPanel.classList.contains('open')) pPanel.classList.remove('open');
    
    youtubePanel.classList.toggle('open');
    updateLayout(); // Konum güncelle

    if (!state.youtubePlayer && window.YT) initYouTubePlayer();
}

// Panel Konumlarını Ayarla (Yan Yana)
function updateLayout() {
    const isChatOpen = chatPanel.classList.contains('open');
    const isYTOpen = youtubePanel.classList.contains('open');

    if (isChatOpen && isYTOpen) {
        youtubePanel.classList.add('shifted'); // Sola kaydır
    } else {
        youtubePanel.classList.remove('shifted');
    }
}

function initYouTubePlayer() {
    state.youtubePlayer = new YT.Player('player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: { 'autoplay': 1, 'controls': 1 },
        events: { 'onStateChange': onPlayerStateChange }
    });
    // Reklam kontrolünü başlat
    setInterval(checkYouTubeAds, 1000);
}

// --- YOUTUBE REKLAM KONTROLÜ (GÜNCEL) ---
function checkYouTubeAds() {
    if (!state.youtubePlayer || !state.youtubePlayer.getDuration) return;

    const duration = state.youtubePlayer.getDuration();
    // Eğer video süresi aniden çok kısa olursa (örn 15sn) ve ana video değilse, bu reklamdır.
    // Ancak en güvenilir yöntem: Eğer biz oynatıyorsak ve PlayerState PLAYING ise ama current time ilerlemiyorsa veya Duration değiştiyse.
    // Basit çözüm: Eğer biri "Ad" sinyali yollarsa overlay göster.
}

export function showAdOverlay(username) {
    document.getElementById('ad-user-name').innerText = username;
    adOverlay.classList.remove('hidden');
}

export function hideAdOverlay() {
    adOverlay.classList.add('hidden');
}

function onPlayerStateChange(event) {
    if (isRemoteUpdate) return;
    const time = state.youtubePlayer.getCurrentTime();
    
    // REKLAM ALGILAMA (Basit)
    // Eğer state UNSTARTED (-1) ise ve biz video başlatmışsak, araya reklam girmiş olabilir.
    // Veya video süresi aniden değişirse.
    // Şimdilik sadece Play/Pause senkronizasyonu:
    
    if (event.data == YT.PlayerState.PLAYING) Network.sendYouTubeAction('play', time);
    else if (event.data == YT.PlayerState.PAUSED) Network.sendYouTubeAction('pause', time);
}

export function loadYouTubeVideo(url, isLocal = true) {
    let videoId = "";
    if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1];
    
    if (!videoId) return;
    if (!youtubePanel.classList.contains('open')) toggleYouTubePanel();

    if (!state.youtubePlayer) {
        if(!window.YT) { setTimeout(() => loadYouTubeVideo(url, isLocal), 1000); return; }
        state.youtubePlayer = new YT.Player('player', {
            height: '100%', width: '100%', videoId: videoId,
            playerVars: { 'autoplay': 1 }, events: { 'onStateChange': onPlayerStateChange }
        });
    } else {
        state.youtubePlayer.loadVideoById(videoId);
    }
    if (isLocal) Network.sendYouTubeLoad(url);
}

export function syncYouTubeAction(action, time) {
    if (!state.youtubePlayer) return;
    isRemoteUpdate = true;
    const diff = Math.abs(state.youtubePlayer.getCurrentTime() - time);
    if (diff > 2) state.youtubePlayer.seekTo(time);
    if (action === 'play') state.youtubePlayer.playVideo();
    else if (action === 'pause') state.youtubePlayer.pauseVideo();
    else if (action === 'ad-start') showAdOverlay("Birisi");
    else if (action === 'ad-end') hideAdOverlay();
    
    setTimeout(() => { isRemoteUpdate = false; }, 500);
}

// --- VİDEO KARTI YÖNETİMİ ---
export function addVideoCard(peerId, stream, name, isLocal, isScreen = false) {
    let cardId = isLocal ? (isScreen ? 'screen-local' : 'video-local') : (isScreen ? `screen-${peerId}` : `video-${peerId}`);
    if (document.getElementById(cardId)) return;

    const card = document.createElement('div'); card.className = 'video-card'; card.id = cardId;
    const video = document.createElement('video'); video.srcObject = stream; video.autoplay = true; video.playsInline = true;

    if (isLocal && !isScreen && state.isMirrored) video.classList.add('mirrored');
    if (isLocal) video.muted = true;
    else { if (state.isDeafened) video.muted = true; else video.muted = false; }

    const expandBtn = document.createElement('button'); expandBtn.className = 'btn-expand'; 
    expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    expandBtn.onclick = (e) => { e.stopPropagation(); toggleFocusMode(card); };

    const nameTag = document.createElement('div'); nameTag.className = 'name-tag'; nameTag.id = `name-${cardId}`;
    nameTag.innerHTML = name + (isScreen ? " (Ekran)" : "");

    if (!isScreen) {
        const avatar = document.createElement('div'); avatar.className = 'avatar-overlay';
        if(isLocal && state.userProfile && state.userProfile.photo) { avatar.innerHTML = `<img src="${state.userProfile.photo}" style="width:100px; height:100px; border-radius:50%; object-fit:cover;">`; }
        else { avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`; }
        card.appendChild(avatar);
    }

    card.append(video, expandBtn, nameTag);

    const strip = document.getElementById('filmstrip-overlay');
    if (isFocusMode && strip) { strip.appendChild(card); card.onclick = () => swapFeatured(card); }
    else { videoGrid.appendChild(card); }

    if (isScreen) card.classList.add('video-active'); else monitorVideoState(stream, card);
}

export function removeVideoCard(peerId, isScreen = false) {
    let cardId = (peerId === 'local') ? (isScreen ? 'screen-local' : 'video-local') : (isScreen ? `screen-${peerId}` : `video-${peerId}`);
    const card = document.getElementById(cardId);
    if (card) { if (card.classList.contains('featured')) exitFocusMode(); card.remove(); }
}

// --- FİLM ŞERİDİ (FOCUS MODE) ---
function toggleFocusMode(selectedCard) {
    if (!isFocusMode) {
        isFocusMode = true; videoGrid.classList.add('focus-mode'); selectedCard.classList.add('featured');
        let strip = document.createElement('div'); strip.id = 'filmstrip-overlay'; strip.className = 'filmstrip-overlay';
        document.getElementById('video-stage').appendChild(strip);
        Array.from(videoGrid.children).forEach(child => {
            if (child.classList.contains('video-card') && !child.classList.contains('featured')) { strip.appendChild(child); child.onclick = () => swapFeatured(child); }
        });
        const btn = selectedCard.querySelector('.btn-expand'); if(btn) { btn.innerHTML = '<i class="fa-solid fa-compress"></i>'; btn.onclick = (e) => { e.stopPropagation(); exitFocusMode(); }; }
    } else { if(selectedCard.classList.contains('featured')) exitFocusMode(); else swapFeatured(selectedCard); }
}

function exitFocusMode() {
    isFocusMode = false; videoGrid.classList.remove('focus-mode');
    const featuredCard = videoGrid.querySelector('.featured');
    if(featuredCard) { featuredCard.classList.remove('featured'); featuredCard.onclick = null; const btn = featuredCard.querySelector('.btn-expand'); if(btn) { btn.innerHTML = '<i class="fa-solid fa-expand"></i>'; btn.onclick = (e) => { e.stopPropagation(); toggleFocusMode(featuredCard); }; } }
    const strip = document.getElementById('filmstrip-overlay'); if (strip) { while(strip.firstChild) { const c = strip.firstChild; videoGrid.appendChild(c); c.onclick = null; } strip.remove(); }
}

function swapFeatured(newCard) {
    const strip = document.getElementById('filmstrip-overlay'); const currentFeatured = videoGrid.querySelector('.featured');
    if (currentFeatured && strip) {
        currentFeatured.classList.remove('featured'); const btn1 = currentFeatured.querySelector('.btn-expand'); if(btn1) { btn1.innerHTML = '<i class="fa-solid fa-expand"></i>'; btn1.onclick = (e) => { e.stopPropagation(); toggleFocusMode(currentFeatured); }; }
        currentFeatured.onclick = () => swapFeatured(currentFeatured); strip.appendChild(currentFeatured);
        videoGrid.appendChild(newCard); newCard.classList.add('featured'); newCard.onclick = null; const btn2 = newCard.querySelector('.btn-expand'); if(btn2) { btn2.innerHTML = '<i class="fa-solid fa-compress"></i>'; btn2.onclick = (e) => { e.stopPropagation(); exitFocusMode(); }; }
    }
}

export function setLocalMirror(isMirrored) {
    state.isMirrored = isMirrored;
    const v = document.querySelector('#video-local video');
    if(v) isMirrored ? v.classList.add('mirrored') : v.classList.remove('mirrored');
}

export function updateParticipantsUI() {
    if (!participantList) return; participantList.innerHTML = "";
    const list = (state.participantList.length > 0) ? state.participantList : [{ name: state.myUsername, id: state.peer?.id, isMe: true }];
    list.forEach(u => addParticipantRow(u.name + (u.id === state.peer?.id ? " (Sen)" : ""), u.id === state.peer?.id));
    if(participantBadge) participantBadge.innerText = list.length;
}

function addParticipantRow(name, isMe) {
    const li = document.createElement('li'); li.innerHTML = `<div class="user-avatar" style="background-color: ${isMe ? '#5865F2' : '#faa61a'}; width:32px; height:32px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold;">${name.charAt(0).toUpperCase()}</div><span style="font-weight: 500; font-size: 0.9rem;">${name}</span>`;
    participantList.appendChild(li);
}

export function updateMyId(id) { const el = document.getElementById('my-id'); if(el) el.innerText = id; }
export function updateNameTag(peerId, name) {
    let el = document.getElementById(`name-video-${peerId}`); if(el) el.innerText = name;
    el = document.getElementById(`name-screen-${peerId}`); if(el) el.innerText = name + " (Ekran)";
    const card = document.getElementById(`video-${peerId}`); if(card) { const av = card.querySelector('.avatar-circle'); if(av) av.innerText = name.charAt(0).toUpperCase(); }
}

function monitorVideoState(stream, card) {
    const interval = setInterval(() => {
        if (!card.isConnected) { clearInterval(interval); return; }
        const track = stream.getVideoTracks()[0];
        if (track && track.enabled && track.readyState === 'live') { card.classList.add('video-active'); } else { card.classList.remove('video-active'); }
    }, 1000);
}

function startClock() {
    setInterval(() => {
        const now = new Date(); const t = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); const el = document.getElementById('clock-display'); if(el) el.innerText = t;
    }, 1000);
}