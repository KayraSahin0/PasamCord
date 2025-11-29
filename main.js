import { state } from './state.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as Network from './network.js';

// --- GİRİŞ VE BAŞLATMA ---
window.loginUser = async function() {
    const input = document.getElementById('username-input');
    if (!input.value.trim()) { alert("Lütfen isim girin"); return; }
    
    state.myUsername = input.value.trim();
    
    // Ses ve Videoyu Başlat
    const success = await Audio.initAudioVideo();
    if(success) {
        UI.showAppScreen();
        Network.initPeer();
        startTimer();
    }
};

// --- ARAMA İŞLEMLERİ ---
window.startCall = function() {
    const idInput = document.getElementById('remote-id');
    const remoteId = idInput.value.trim().toUpperCase().replace('#', '');
    Network.connectToPeer(remoteId);
};

window.endCall = function() {
    Network.closeAllConnections();
    UI.resetScreens();
};

// --- MEDYA KONTROLLERİ ---
window.toggleMute = function() {
    if (!state.localStream) return;
    const track = state.localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    state.isMuted = !track.enabled;

    const btn = document.getElementById('mute-btn');
    const icon = document.getElementById('mute-icon');
    
    if (state.isMuted) {
        btn.classList.add('btn-danger');
        icon.classList.replace('fa-microphone', 'fa-microphone-slash');
    } else {
        btn.classList.remove('btn-danger');
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
    
    // Tüm videoları gez ve biz olmayanları sustur
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        // Kendi kameramız (#video-local) ve kendi ekranımız (#screen-local) hariç
        if (!v.closest('#video-local') && !v.closest('#screen-local')) {
            v.muted = state.isDeafened;
        }
    });

    const btn = document.getElementById('deafen-btn');
    const icon = document.getElementById('deafen-icon');

    if (state.isDeafened) {
        btn.classList.add('btn-danger');
        icon.classList.replace('fa-headphones', 'fa-ear-deaf');
    } else {
        btn.classList.remove('btn-danger');
        icon.classList.replace('fa-ear-deaf', 'fa-headphones');
    }
};

// --- EKRAN PAYLAŞIMI (YEŞİL EKRAN DÜZELTİLMİŞ) ---
window.toggleScreenShare = async function() {
    const btn = document.getElementById('screen-btn');

    if (!state.isScreenSharing) {
        // --- BAŞLAT ---
        try {
            // Yeşil ekran sorununu çözen özel ayarlar
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: {
                    cursor: "always",
                    displaySurface: "monitor",
                    frameRate: 30,             // FPS'i sabitle
                    width: { ideal: 1920 },    // Çözünürlüğü standartlaştır
                    height: { ideal: 1080 }
                }, 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            state.localScreenStream = stream;
            state.isScreenSharing = true;

            // UI'da göster
            UI.addVideoCard('local', stream, state.myUsername, true, true);

            // Herkese gönder
            Network.shareScreenToAll();

            // Buton stili
            btn.classList.add('btn-success');
            btn.style.backgroundColor = '#3ba55c';
            btn.style.color = 'white';

            // Tarayıcının "Paylaşımı Durdur" butonuna basılırsa
            stream.getVideoTracks()[0].onended = () => {
                if(state.isScreenSharing) window.toggleScreenShare();
            };

        } catch (err) {
            console.error("Ekran paylaşımı hatası:", err);
        }
    } else {
        // --- DURDUR ---
        if (state.localScreenStream) {
            state.localScreenStream.getTracks().forEach(track => track.stop());
            state.localScreenStream = null;
        }
        state.isScreenSharing = false;

        // UI'dan sil
        UI.removeVideoCard('local', true);

        // Buton eski haline
        btn.classList.remove('btn-success');
        btn.style.backgroundColor = '';
        btn.style.color = '';
    }
};

// --- AYARLAR VE CİHAZ YÖNETİMİ ---
window.changeOutputVolume = (val) => Audio.setOutputVolume(val);
window.changeMicGain = (val) => Audio.setMicGain(val);

window.changeAudioInput = () => { /* İleride eklenebilir: Stream yenileme */ };
window.changeVideoInput = () => { /* İleride eklenebilir: Stream yenileme */ };

window.changeAudioOutput = async () => {
    const deviceId = document.getElementById('audio-output-select').value;
    const videos = document.querySelectorAll('video');
    for(const v of videos) {
        if('setSinkId' in v) {
            try {
                await v.setSinkId(deviceId);
            } catch(e) { console.error(e); }
        }
    }
};

// --- UI TOGGLES ---
window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');
window.toggleParticipants = () => document.getElementById('participants-panel').classList.toggle('open');

window.copyId = () => {
    navigator.clipboard.writeText(document.getElementById('my-id').innerText);
    const fb = document.getElementById('copy-feedback');
    fb.style.opacity = '1'; 
    fb.classList.remove('fade-out');
    setTimeout(() => { 
        fb.style.opacity = '0'; 
        fb.classList.add('fade-out'); 
    }, 1000);
};

// --- ZAMANLAYICI ---
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