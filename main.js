// main.js
import { state } from './state.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as Network from './network.js';

// --- HTML'den Erişilebilir Global Fonksiyonlar ---
// Modüller kendi scope'una sahip olduğu için window objesine atamamız gerekir.

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

window.startCall = function() {
    const idInput = document.getElementById('remote-id');
    const remoteId = idInput.value.trim().toUpperCase().replace('#', '');
    Network.connectToPeer(remoteId);
};

window.endCall = function() {
    Network.closeAllConnections();
    UI.resetScreens();
};

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

    // UI Güncelleme
    if (state.isCameraOff) {
        btn.classList.add('btn-off');
        btn.classList.add('btn-secondary');
        icon.classList.replace('fa-video', 'fa-video-slash');
    } else {
        btn.classList.remove('btn-off');
        btn.classList.remove('btn-secondary');
        icon.classList.replace('fa-video-slash', 'fa-video');
    }
};

// Ayarlar
window.changeOutputVolume = (val) => Audio.setOutputVolume(val);
window.changeMicGain = (val) => Audio.setMicGain(val);
window.changeAudioInput = () => { /* Cihaz değiştirme mantığı eklenebilir */ };
window.changeVideoInput = () => { /* Cihaz değiştirme mantığı eklenebilir */ };
window.changeAudioOutput = async () => {
    const deviceId = document.getElementById('audio-output-select').value;
    const videos = document.querySelectorAll('video');
    for(const v of videos) {
        if('setSinkId' in v) await v.setSinkId(deviceId);
    }
};

// UI Toggles
window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');
window.toggleParticipants = () => document.getElementById('participants-panel').classList.toggle('open');
window.copyId = () => {
    navigator.clipboard.writeText(document.getElementById('my-id').innerText);
    const fb = document.getElementById('copy-feedback');
    fb.style.opacity = '1';
    setTimeout(() => fb.style.opacity = '0', 1000);
};

// Timer
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