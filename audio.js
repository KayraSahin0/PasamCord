import { state } from './state.js';
import { addVideoCard } from './ui.js';

export async function initAudioVideo() {
    try {
        const rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setupAudioContext(rawStream);
        
        // Kamera kapalı başla
        state.localStream.getVideoTracks()[0].enabled = false;
        state.isCameraOff = true;

        addVideoCard('local', state.localStream, state.myUsername, true);
        await populateDeviceLists();
        return true;
    } catch (err) {
        console.error(err);
        alert("Kamera/Mikrofon izni gerekli!");
        return false;
    }
}

// Audio Context ve Gain Kurulumu
function setupAudioContext(stream) {
    if(state.audioContext) state.audioContext.close();
    
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.micSource = state.audioContext.createMediaStreamSource(stream);
    state.gainNode = state.audioContext.createGain();
    state.gainNode.gain.value = 1.0; // Varsayılan Gain
    state.audioDestination = state.audioContext.createMediaStreamDestination();

    state.micSource.connect(state.gainNode);
    state.gainNode.connect(state.audioDestination);

    // İşlenmiş ses + Ham video
    state.localStream = new MediaStream([
        stream.getVideoTracks()[0], 
        state.audioDestination.stream.getAudioTracks()[0]
    ]);
}

// Cihazları Listele
export async function populateDeviceLists() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const aInput = document.getElementById('audio-input-select');
    const vInput = document.getElementById('video-input-select');
    const aOutput = document.getElementById('audio-output-select');

    aInput.innerHTML = ""; vInput.innerHTML = ""; aOutput.innerHTML = "";

    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.innerText = d.label || d.kind;
        if (d.kind === 'audioinput') aInput.appendChild(opt);
        else if (d.kind === 'videoinput') vInput.appendChild(opt);
        else if (d.kind === 'audiooutput') aOutput.appendChild(opt);
    });
    if(aOutput.options.length === 0) {
        const o = document.createElement('option'); o.innerText = "Varsayılan"; aOutput.appendChild(o);
    }
}

// --- CİHAZ DEĞİŞTİRME FONKSİYONLARI ---

export async function switchAudioInput(deviceId) {
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } }, video: false });
        // AudioContext kaynağını güncelle
        const newAudioTrack = newStream.getAudioTracks()[0];
        
        // Eski tracki durdur
        const oldTrack = state.localStream.getAudioTracks()[0];
        if(oldTrack) oldTrack.stop();

        // Stream güncelleme (Context üzerinden)
        state.micSource.disconnect();
        state.micSource = state.audioContext.createMediaStreamSource(newStream);
        state.micSource.connect(state.gainNode);
        
        // Peer bağlantılarını güncelle (ReplaceTrack)
        const processedTrack = state.audioDestination.stream.getAudioTracks()[0];
        
        // Yerel stream'i güncelle
        state.localStream.removeTrack(state.localStream.getAudioTracks()[0]);
        state.localStream.addTrack(processedTrack);

        // Aktif aramalarda sesi değiştir
        updatePeersTrack(processedTrack, 'audio');

    } catch(e) { console.error("Mikrofon değişmedi:", e); }
}

export async function switchVideoInput(deviceId) {
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
        const newVideoTrack = newStream.getVideoTracks()[0];

        // Eski tracki durdur
        const oldTrack = state.localStream.getVideoTracks()[0];
        if(oldTrack) oldTrack.stop();

        // Yerel stream güncelle
        state.localStream.removeTrack(oldTrack);
        state.localStream.addTrack(newVideoTrack);

        // Durumu koru (Kamera kapalıysa kapalı kalsın)
        newVideoTrack.enabled = !state.isCameraOff;

        // UI Güncelle (Lokal video elementi)
        const localVideo = document.querySelector('#video-local video');
        if(localVideo) localVideo.srcObject = state.localStream;

        // Aktif aramalarda videoyu değiştir
        updatePeersTrack(newVideoTrack, 'video');

    } catch(e) { console.error("Kamera değişmedi:", e); }
}

function updatePeersTrack(newTrack, kind) {
    Object.values(state.peers).forEach(peer => {
        if(peer.call && peer.call.peerConnection) {
            const sender = peer.call.peerConnection.getSenders().find(s => s.track && s.track.kind === kind);
            if(sender) sender.replaceTrack(newTrack);
        }
    });
}

// Ses Seviyeleri
export function setMicGain(val) {
    // -1 ile 1 arası gelen değeri Gain'e çevir (0 sessiz değil, normal, -1 sessize yakın)
    // Slider 0 (Normal) -> Gain 1.0
    // Slider 1 (Yüksek) -> Gain 2.0
    // Slider -1 (Düşük) -> Gain 0.2
    const v = parseFloat(val);
    let g = 1.0;
    if (v > 0) g = 1.0 + v; // 1.0 - 2.0
    else g = 1.0 + (v * 0.8); // 1.0 - 0.2
    
    if (state.gainNode) state.gainNode.gain.value = g;
}

export function setOutputVolume(val) {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        // Kendi sesimiz hariç
        if (!v.muted && v.id !== 'video-local') v.volume = val;
    });
}