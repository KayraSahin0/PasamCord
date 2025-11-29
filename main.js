import { state } from './state.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as Network from './network.js';

window.loginUser = async function() {
    const input = document.getElementById('username-input');
    if (!input.value.trim()) { alert("Lütfen isim girin"); return; }
    state.myUsername = input.value.trim();
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
        btn.classList.add('btn-danger'); // Kırmızı
        icon.classList.replace('fa-microphone', 'fa-microphone-slash');
    } else {
        btn.classList.remove('btn-danger');
        icon.classList.replace('fa-microphone-slash', 'fa-microphone');
    }
};

// --- YENİ: SAĞIRLAŞTIR (DEAFEN) BUTONU ---
window.toggleDeafen = function() {
    state.isDeafened = !state.isDeafened;
    
    // Tüm videoları bul
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        // Sadece ID'si 'video-local' OLMAYANLARI sustur (Kendi videomuz zaten mute)
        // Ama video-card içindeki videonun ID'si yok, parent'a bakabiliriz veya basitçe:
        // Local video muted=true. Deafen basılınca diğerleri de muted=true olur.
        if (!v.muted || v.id !== 'local-video-element') { 
            // Local video hariç diğerlerini etkile
            // Not: Local video elementine 'local-video-element' gibi bir ID veya data-attr vermek iyi olur.
            // UI.js tarafında local video muted=true yaratılır, diğerleri false.
            // Buradaki mantık: Eğer deafened ise hepsi mute. Değilse, local hariç hepsi unmute.
            
            // Eğer video kendimiz değilse (kendimiz ui.js içinde muted=true başlatılır)
            // Bu kontrolü audio.js veya ui.js içinde element oluştururken yapıyoruz.
            // En güvenli yöntem: State içindeki peers listesine bakmak yerine DOM manipülasyonu:
            
            // Kendi videomuz 'muted' özelliği zaten true. Ona dokunmuyoruz.
            // Diğer videoların 'muted' özelliğini değiştiriyoruz.
            if(v.closest('#video-local')) return; // Kendi videomuzu atla
            
            v.muted = state.isDeafened;
        }
    });

    // Buton Görseli
    const btn = document.getElementById('deafen-btn');
    const icon = document.getElementById('deafen-icon');

    if (state.isDeafened) {
        btn.classList.add('btn-danger');
        icon.classList.replace('fa-headphones', 'fa-ear-deaf'); // İkon değişimi
    } else {
        btn.classList.remove('btn-danger');
        icon.classList.replace('fa-ear-deaf', 'fa-headphones');
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

// UI Toggles & Settings
window.changeOutputVolume = (val) => Audio.setOutputVolume(val);
window.changeMicGain = (val) => Audio.setMicGain(val);
window.changeAudioInput = () => {}; 
window.changeVideoInput = () => {};
window.changeAudioOutput = async () => {
    const deviceId = document.getElementById('audio-output-select').value;
    const videos = document.querySelectorAll('video');
    for(const v of videos) {
        if('setSinkId' in v) await v.setSinkId(deviceId);
    }
};

window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');
window.toggleParticipants = () => document.getElementById('participants-panel').classList.toggle('open');
window.copyId = () => {
    navigator.clipboard.writeText(document.getElementById('my-id').innerText);
    const fb = document.getElementById('copy-feedback');
    fb.style.opacity = '1';
    fb.classList.remove('fade-out');
    setTimeout(() => { fb.style.opacity = '0'; fb.classList.add('fade-out'); }, 1000);
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