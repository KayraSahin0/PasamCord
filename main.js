import { state } from './state.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as Network from './network.js';
import * as Auth from './auth.js';

// --- 1. SAYFA YÜKLENİNCE ---
window.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if(chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.sendChat();
        });
    }
    
    const ytInput = document.getElementById('yt-url-input');
    if(ytInput) {
        ytInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.handleYouTubeSearch();
        });
    }

    Auth.checkAuthState((isLoggedIn, user) => {
        if (isLoggedIn) {
            state.myUsername = user.displayName;
            document.getElementById('guest-section').classList.add('hidden');
            const googleBtn = document.querySelector('.btn-google'); 
            if(googleBtn) googleBtn.classList.add('hidden');
            const divider = document.querySelector('.divider'); 
            if(divider) divider.classList.add('hidden');
            
            const welcomeSec = document.getElementById('welcome-back-section');
            if(welcomeSec) {
                welcomeSec.classList.remove('hidden');
                document.getElementById('welcome-user-name').innerText = user.displayName;
                if(user.photoURL) document.getElementById('user-avatar-preview').src = user.photoURL;
            }
        }
    });
});

// --- 2. GİRİŞ ---
window.handleGoogleLogin = async function() {
    const user = await Auth.loginWithGoogle();
    if (user) {
        state.myUsername = user.displayName;
        window.startSession();
    }
};

window.handleGuestLogin = function() {
    const input = document.getElementById('username-input');
    if (!input.value.trim()) return alert("Lütfen bir isim girin.");
    state.myUsername = input.value.trim();
    window.startSession();
};

window.loginUser = function() {
    if (state.myUsername) window.startSession();
    else window.handleGuestLogin();
};

window.handleLogout = function() { Auth.logoutUser(); };

window.startSession = async function() {
    const success = await Audio.initAudioVideo();
    if(success) {
        UI.showAppScreen();
        Network.initPeer(); // Başlangıç (Rastgele ID)
        startTimer();
    }
};

// --- 3. BAĞLANTI ---
window.startCall = function() {
    const idInput = document.getElementById('remote-id');
    const roomId = idInput.value.trim().toUpperCase().replace('#', '');
    // Akıllı Oda: Varsa gir, yoksa kur
    Network.joinOrCreateRoom(roomId);
};

window.endCall = function() {
    Network.closeAllConnections();
    UI.resetScreens();
};

// --- 4. MEDYA ---
window.toggleMute = function() {
    if (!state.localStream) return;
    const track = state.localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    state.isMuted = !track.enabled;
    const btn = document.getElementById('mute-btn');
    const icon = document.getElementById('mute-icon');
    if (state.isMuted) {
        btn.classList.add('btn-off');
        icon.classList.replace('fa-microphone', 'fa-microphone-slash');
    } else {
        btn.classList.remove('btn-off');
        icon.classList.replace('fa-microphone-slash', 'fa-microphone');
    }
};

window.toggleCamera = function() {
    if (!state.localStream) return;
    const track = state.localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    state.isCameraOff = !track.enabled;
    const btn = document.getElementById('camera-btn');
    const icon = document.getElementById('camera-icon');
    if (state.isCameraOff) {
        btn.classList.add('btn-off');
        icon.classList.replace('fa-video', 'fa-video-slash');
    } else {
        btn.classList.remove('btn-off');
        icon.classList.replace('fa-video-slash', 'fa-video');
    }
};

window.toggleDeafen = function() {
    state.isDeafened = !state.isDeafened;
    document.querySelectorAll('video').forEach(v => {
        if (v.closest('.video-card').id !== 'video-local' && v.closest('.video-card').id !== 'screen-local') {
            v.muted = state.isDeafened;
        }
    });
    const btn = document.getElementById('deafen-btn');
    const icon = document.getElementById('deafen-icon');
    if (state.isDeafened) {
        btn.classList.add('btn-off');
        icon.classList.replace('fa-headphones', 'fa-ear-deaf');
    } else {
        btn.classList.remove('btn-off');
        icon.classList.replace('fa-ear-deaf', 'fa-headphones');
    }
};

// --- 5. EKRAN PAYLAŞIMI ---
window.toggleScreenShare = async function() {
    const btn = document.getElementById('screen-btn');
    if (!state.isScreenSharing) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { cursor: "always", displaySurface: "monitor", frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            state.localScreenStream = stream;
            state.isScreenSharing = true;
            UI.addVideoCard('local', stream, state.myUsername, true, true);
            Network.shareScreenToAll();
            btn.classList.add('btn-success');
            stream.getVideoTracks()[0].onended = () => { 
                if(state.isScreenSharing) window.toggleScreenShare(); 
            };
        } catch (err) { console.error(err); }
    } else {
        if (state.localScreenStream) {
            state.localScreenStream.getTracks().forEach(t => t.stop());
            state.localScreenStream = null;
        }
        state.isScreenSharing = false;
        UI.removeVideoCard('local', true);
        btn.classList.remove('btn-success');
    }
};

// --- 6. CHAT ---
window.toggleChat = function() { UI.toggleChatPanel(); };

window.sendChat = function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
        UI.addMessageToUI("Ben", text, true);
        Network.sendChatMessage(text);
        input.value = "";
    }
};

// --- 7. SPOTIFY & YOUTUBE ---
window.startSpotifyShare = function() { document.getElementById('spotify-guide-modal').classList.remove('hidden'); };
window.confirmSpotifyShare = async function() {
    document.getElementById('spotify-guide-modal').classList.add('hidden');
    if (!state.isScreenSharing) window.toggleScreenShare();
};

window.toggleYouTube = function() { UI.toggleYouTubePanel(); };

window.handleYouTubeSearch = function() {
    const inputVal = document.getElementById('yt-url-input').value.trim();
    if (!inputVal) return;
    UI.searchAndLoadYouTube(inputVal, true);
    document.getElementById('yt-url-input').value = "";
};
// "Aç" butonu için de:
window.loadYouTubeVideo = window.handleYouTubeSearch;

// --- 8. AYARLAR ---
window.changeOutputVolume = (val) => Audio.setOutputVolume(val);
window.changeMicGain = (val) => Audio.setMicGain(val);
window.changeAudioInput = () => { Audio.switchAudioInput(document.getElementById('audio-input-select').value); };
window.changeVideoInput = () => { Audio.switchVideoInput(document.getElementById('video-input-select').value); };
window.changeAudioOutput = async () => {
    const deviceId = document.getElementById('audio-output-select').value;
    const videos = document.querySelectorAll('video');
    for(const v of videos) { if('setSinkId' in v) await v.setSinkId(deviceId); }
};
window.changeVideoQuality = function() {
    const res = parseInt(document.getElementById('video-resolution').value);
    const fps = parseInt(document.getElementById('video-fps').value);
    state.videoResolution = res;
    state.videoFPS = fps;
    Audio.applyVideoQuality();
};

window.openTab = (name) => UI.openSettingsTab(name);
window.toggleMirrorSetting = (checked) => UI.setLocalMirror(checked);
window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');

window.toggleParticipants = () => {
    const chat = document.getElementById('chat-panel');
    if(chat.classList.contains('open')) chat.classList.remove('open');
    const yt = document.getElementById('youtube-panel');
    if(yt.classList.contains('open')) yt.classList.remove('open');
    document.getElementById('participants-panel').classList.toggle('open');
};

window.copyId = () => {
    const idText = document.getElementById('my-id').innerText;
    if(idText && idText !== "ID Yükleniyor...") {
        navigator.clipboard.writeText(idText);
        const fb = document.getElementById('copy-feedback');
        fb.style.opacity = '1'; fb.classList.remove('fade-out');
        setTimeout(() => { fb.style.opacity = '0'; fb.classList.add('fade-out'); }, 1000);
    }
};

function startTimer() {
    let sec = 0;
    setInterval(() => {
        sec++;
        const m = Math.floor(sec/60).toString().padStart(2,'0');
        const s = (sec%60).toString().padStart(2,'0');
        const el = document.getElementById('call-timer');
        if(el) el.innerText = `${m}:${s}`;
    }, 1000);
}