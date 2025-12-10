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
    // document.getElementById('footer-room-id').innerText = "#" + remoteId;

    const footerIdEl = document.getElementById('footer-room-id');
    if (footerIdEl) {
        footerIdEl.innerText = "#" + remoteId;
    }
}

export function updateRoomId(id) {
    const el = document.getElementById('footer-room-id');
    if(el) el.innerText = "#" + id;
}

export function resetScreens() {
    // 1. Bağlantı Panelini Tekrar Göster
    document.getElementById('connect-panel').classList.remove('hidden');
    
    // 2. Video Izgarasını Temizle (Local hariç veya tamamen temizleyip tekrar ekleyebiliriz)
    // En temiz yöntem: Hepsini silip state'deki stream ile local'i tekrar oluşturmak
    const videoGrid = document.getElementById('video-grid');
    videoGrid.innerHTML = ''; 
    
    // 3. Panelleri Kapat
    document.getElementById('chat-panel').classList.remove('open');
    document.getElementById('participants-panel').classList.remove('open');
    const yt = document.getElementById('youtube-panel');
    if(yt) yt.classList.remove('open');
    
    // 4. Alt bilgileri sıfırla
    document.getElementById('footer-room-id').innerText = "#ODAMIZ";
    
    // 5. Film Şeridini Temizle (Varsa)
    const strip = document.getElementById('filmstrip-overlay');
    if(strip) strip.remove();
    
    // 6. Grid modunu sıfırla
    videoGrid.classList.remove('focus-mode');
    
    // NOT: Local videoyu tekrar eklememiz lazım çünkü grid'i sildik.
    // main.js içinde endCall'dan sonra restoreLocalVideo çağıracağız.
}

// --- ODA BİLGİLERİ (AYARLAR) ---

export function updateRoomSettingsUI() {
    const uptimeEl = document.getElementById('settings-room-uptime');
    const idEl = document.getElementById('settings-room-id');
    const footerId = document.getElementById('footer-room-id');
    
    // DÜZELTME: ID'yi "My-ID" elementinden DEĞİL, Footer'daki Oda ID'sinden al
    // Çünkü katılımcıysak kendi ID'miz rastgeledir, önemli olan Oda ID'sidir.
    if(idEl && footerId) {
        // Eğer footer'da "#ODAMIZ" yazıyorsa henüz bağlanmamıştır, gösterme
        if(footerId.innerText !== "#ODAMIZ") {
            idEl.innerText = footerId.innerText; // Örn: #RTXNK
        } else {
            idEl.innerText = "Bağlı Değil";
        }
    }

    // Süre Sayacı
    if(uptimeEl && state.connectionStartTime) {
        const diff = Math.floor((Date.now() - state.connectionStartTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        uptimeEl.innerText = `${h}:${m}:${s}`;
    }
}

// --- AYARLAR SEKME YÖNETİMİ ---
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
        if(tabName === 'room') return b.innerText.includes('Oda Bilgileri');
        // YENİ EKLENEN:
        if(tabName === 'admin') return b.innerText.includes('Yönetici');
    });
    if(target) target.classList.add('active');
}

// --- CHAT PANELİ ---
export function toggleChatPanel() {
    if (youtubePanel.classList.contains('open')) youtubePanel.classList.remove('open');
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open') && chatBadge) chatBadge.classList.add('hidden');
    updateLayout();
}

export function addMessageToUI(sender, text, isMe) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMe ? 'mine' : 'theirs'}`;
    
    msgDiv.innerHTML = `
        <div class="message-header">
            <span class="msg-sender">${isMe ? 'Sen' : sender}</span>
            <span class="msg-time">${time}</span>
        </div>
        <div class="msg-text">${escapeHtml(text)}</div>
    `;
    
    chatContent.appendChild(msgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    if (!isMe && !chatPanel.classList.contains('open')) {
        if (chatBadge) chatBadge.classList.remove('hidden');
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --- YOUTUBE & ARAMA ---
export function toggleYouTubePanel() {
    if (chatPanel.classList.contains('open')) chatPanel.classList.remove('open');
    const pPanel = document.getElementById('participants-panel');
    if(pPanel.classList.contains('open')) pPanel.classList.remove('open');
    
    youtubePanel.classList.toggle('open');
    updateLayout();

    if (!state.youtubePlayer && window.YT) {
        initYouTubePlayer();
    }
}

function updateLayout() {
    const isChatOpen = chatPanel.classList.contains('open');
    const isYTOpen = youtubePanel.classList.contains('open');
    if (isChatOpen && isYTOpen) youtubePanel.classList.add('shifted');
    else youtubePanel.classList.remove('shifted');
}

function initYouTubePlayer() {
    state.youtubePlayer = new YT.Player('player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: { 'autoplay': 1, 'controls': 1, 'origin': window.location.origin },
        events: { 'onStateChange': onPlayerStateChange, 'onError': onPlayerError }
    });
    setInterval(checkYouTubeAds, 1000);
}

function checkYouTubeAds() { if (!state.youtubePlayer || !state.youtubePlayer.getDuration) return; }

export function showAdOverlay(username) {
    const el = document.getElementById('ad-user-name');
    if(el) el.innerText = username;
    if(adOverlay) adOverlay.classList.remove('hidden');
}

export function hideAdOverlay() {
    if(adOverlay) adOverlay.classList.add('hidden');
}

function onPlayerStateChange(event) {
    if (isRemoteUpdate) return;
    const time = state.youtubePlayer.getCurrentTime();
    if (event.data == YT.PlayerState.PLAYING) Network.sendYouTubeAction('play', time);
    else if (event.data == YT.PlayerState.PAUSED) Network.sendYouTubeAction('pause', time);
}

function onPlayerError(event) {
    console.warn("YouTube Hata:", event.data);
    const statusText = document.getElementById('yt-status-text');
    if(statusText) {
        if(event.data === 150 || event.data === 101) statusText.innerText = "Video web'de oynatılamıyor (Telif).";
        else statusText.innerText = "Video yüklenemedi.";
    }
}

// ARAMA VE YÜKLEME
export async function searchAndLoadYouTube(query, isLocal = true) {
    const statusText = document.getElementById('yt-status-text');
    if(statusText) { statusText.innerText = "Aranıyor..."; statusText.style.color = "#aaa"; }

    let videoId = "";
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
        if (query.includes('v=')) videoId = query.split('v=')[1].split('&')[0];
        else if (query.includes('youtu.be/')) videoId = query.split('youtu.be/')[1];
    } else {
        try {
            // Piped API (Ücretsiz)
            const response = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                videoId = data.items[0].url.split('v=')[1];
            } else {
                if(statusText) statusText.innerText = "Bulunamadı. Link deneyin.";
                return;
            }
        } catch (e) {
            console.error(e);
            if(statusText) statusText.innerText = "Arama hatası.";
            return;
        }
    }

    if (!videoId) { if(statusText) statusText.innerText = "Geçersiz!"; return; }
    loadYouTubeVideoById(videoId, isLocal);
}

export function loadYouTubeVideoById(videoId, isLocal) {
    if (!youtubePanel.classList.contains('open')) toggleYouTubePanel();
    const statusText = document.getElementById('yt-status-text');
    if(statusText) statusText.innerText = "Video yüklendi.";

    if (!state.youtubePlayer) {
        if(!window.YT) { setTimeout(() => loadYouTubeVideoById(videoId, isLocal), 1000); return; }
        state.youtubePlayer = new YT.Player('player', {
            height: '100%', width: '100%', videoId: videoId,
            playerVars: { 'autoplay': 1, 'origin': window.location.origin },
            events: { 'onStateChange': onPlayerStateChange, 'onError': onPlayerError }
        });
    } else {
        state.youtubePlayer.loadVideoById(videoId);
    }

    if (isLocal) Network.sendYouTubeLoad(videoId);
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

// --- VİDEO KARTLARI ---
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

    video.onloadedmetadata = async () => {
        try {
            await video.play();
        } catch (e) {
            console.warn("Otomatik oynatma engellendi, kullanıcı etkileşimi bekleniyor:", e);
        }
    };

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
        isFocusMode = true;
        videoGrid.classList.add('focus-mode');
        selectedCard.classList.add('featured');

        let strip = document.createElement('div');
        strip.id = 'filmstrip-overlay';
        strip.className = 'filmstrip-overlay';
        document.getElementById('video-stage').appendChild(strip);

        Array.from(videoGrid.children).forEach(child => {
            if (child.classList.contains('video-card') && !child.classList.contains('featured')) {
                strip.appendChild(child);
                child.onclick = () => swapFeatured(child);
            }
        });

        const btn = selectedCard.querySelector('.btn-expand');
        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            btn.onclick = (e) => { e.stopPropagation(); exitFocusMode(); };
        }

    } else {
        if(selectedCard.classList.contains('featured')) exitFocusMode();
        else swapFeatured(selectedCard);
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
        currentFeatured.classList.remove('featured');
        const btn1 = currentFeatured.querySelector('.btn-expand');
        if(btn1) {
            btn1.innerHTML = '<i class="fa-solid fa-expand"></i>';
            btn1.onclick = (e) => { e.stopPropagation(); toggleFocusMode(currentFeatured); };
        }
        currentFeatured.onclick = () => swapFeatured(currentFeatured);
        strip.appendChild(currentFeatured);

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

// --- YARDIMCILAR ---

export function setLocalMirror(isMirrored) {
    state.isMirrored = isMirrored;
    const v = document.querySelector('#video-local video');
    if(v) isMirrored ? v.classList.add('mirrored') : v.classList.remove('mirrored');
}

export function updateParticipantsUI() {
    if (!participantList) return;
    participantList.innerHTML = "";
    
    const list = (state.participantList.length > 0) ? state.participantList : [{ name: state.myUsername, id: state.peer?.id, isMe: true }];
    
    list.forEach(u => {
        const isMe = (u.id === state.peer?.id);
        addParticipantRow(u.name + (isMe ? " (Sen)" : ""), isMe);
    });
    
    if(participantBadge) participantBadge.innerText = list.length;
    
    // Premium kullanıcı sayısını güncelle
    import('./spotify.js').then(module => {
        if (module.updatePremiumUsersUI) {
            module.updatePremiumUsersUI();
        }
    }).catch(() => {
        // Spotify modülü yüklenmemişse hata verme
    });
}

function addParticipantRow(name, isMe) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div class="user-avatar" style="background-color: ${isMe ? '#5865F2' : '#faa61a'}; width:32px; height:32px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold;">${name.charAt(0).toUpperCase()}</div>
        <span style="font-weight: 500; font-size: 0.9rem;">${name}</span>
    `;
    participantList.appendChild(li);
}

export function updateMyId(id) {
    const el = document.getElementById('my-id');
    if(el) { el.innerText = id; el.style.color = ""; }
}

export function updateNameTag(peerId, name) {
    let el = document.getElementById(`name-video-${peerId}`);
    if(el) el.innerText = name;
    
    el = document.getElementById(`name-screen-${peerId}`);
    if(el) el.innerText = name + " (Ekran)";
    
    const card = document.getElementById(`video-${peerId}`);
    if(card) {
        const av = card.querySelector('.avatar-circle');
        if(av) av.innerText = name.charAt(0).toUpperCase();
    }
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

export function restoreLocalVideoCard(stream, name, isMirrored) {
    // Grid temizlendiği için kendi kartımızı geri koyuyoruz
    import('./ui.js').then(module => {
        module.addVideoCard('local', stream, name, true);
    });
}