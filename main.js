import { state } from './state.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as Network from './network.js';
import * as Auth from './auth.js';

// --- 1. OTURUM VE GİRİŞ İŞLEMLERİ ---

window.addEventListener('DOMContentLoaded', () => {
    // Chat input enter tuşu dinleyicisi
    const chatInput = document.getElementById('chat-input');
    if(chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.sendChat();
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

window.handleLogout = function() {
    Auth.logoutUser();
};

window.startSession = async function() {
    const success = await Audio.initAudioVideo();
    if(success) {
        UI.showAppScreen();
        Network.initPeer();
        startTimer();
    }
};

// --- 2. ARAMA YÖNETİMİ ---

window.startCall = function() {
    const idInput = document.getElementById('remote-id');
    const remoteId = idInput.value.trim().toUpperCase().replace('#', '');
    Network.connectToPeer(remoteId);
};

window.endCall = function() {
    Network.closeAllConnections();
    UI.resetScreens();
};

// --- 3. MEDYA KONTROLLERİ ---

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

// --- 4. EKRAN PAYLAŞIMI ---

window.toggleScreenShare = async function() {
    const btn = document.getElementById('screen-btn');

    if (!state.isScreenSharing) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { 
                    cursor: "always", 
                    displaySurface: "monitor", 
                    frameRate: 30, 
                    width: { ideal: 1920 }, 
                    height: { ideal: 1080 } 
                }, 
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

        } catch (err) {
            console.error("Ekran paylaşımı hatası:", err);
        }
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

// --- 5. CHAT İŞLEMLERİ (DÜZELTİLDİ) ---

window.toggleChat = function() {
    const pPanel = document.getElementById('participants-panel');
    if(pPanel.classList.contains('open')) pPanel.classList.remove('open');
    UI.toggleChatPanel();
};

window.sendChat = function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
        // Kendi mesajımızı UI'ya ekleyelim (Ben olarak)
        UI.addMessageToUI("Ben", text, true);
        // Ağa gönderelim
        Network.sendChatMessage(text);
        input.value = "";
    }
};

// --- 6. AYARLAR VE CİHAZ YÖNETİMİ ---

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

// --- 7. UI YARDIMCILARI ---

window.openTab = (name) => UI.openSettingsTab(name);
window.toggleMirrorSetting = (checked) => UI.setLocalMirror(checked);
window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');

window.toggleParticipants = () => {
    const chat = document.getElementById('chat-panel');
    if(chat.classList.contains('open')) chat.classList.remove('open');
    document.getElementById('participants-panel').classList.toggle('open');
};

window.copyId = () => {
    const idText = document.getElementById('my-id').innerText;
    if(idText && idText !== "ID Yükleniyor...") {
        navigator.clipboard.writeText(idText);
        const fb = document.getElementById('copy-feedback');
        fb.style.opacity = '1'; 
        fb.classList.remove('fade-out');
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