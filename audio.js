// audio.js
import { state } from './state.js';
import { addVideoCard } from './ui.js';

export async function initAudioVideo() {
    try {
        const rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // --- WEB AUDIO API (Ses Motoru) ---
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.micSource = state.audioContext.createMediaStreamSource(rawStream);
        state.gainNode = state.audioContext.createGain();
        state.gainNode.gain.value = 1.0; // Varsayılan ses
        state.audioDestination = state.audioContext.createMediaStreamDestination();

        // Bağlantı: Mikrofon -> Gain (Ses Ayarı) -> Hedef
        state.micSource.connect(state.gainNode);
        state.gainNode.connect(state.audioDestination);

        // PeerJS'e gidecek birleştirilmiş stream
        state.localStream = new MediaStream([
            rawStream.getVideoTracks()[0],
            state.audioDestination.stream.getAudioTracks()[0]
        ]);

        // KAMERA KAPALI BAŞLASIN
        const videoTrack = state.localStream.getVideoTracks()[0];
        videoTrack.enabled = false;
        state.isCameraOff = true;

        // UI'a kendi videomuzu ekleyelim
        addVideoCard('local', state.localStream, state.myUsername, true);

        // Cihazları Listele
        await populateDeviceLists();

        return true;
    } catch (err) {
        console.error("Medya Hatası:", err);
        alert("Kamera ve Mikrofon izni vermelisiniz!");
        return false;
    }
}

export async function populateDeviceLists() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const aInput = document.getElementById('audio-input-select');
    const vInput = document.getElementById('video-input-select');
    const aOutput = document.getElementById('audio-output-select');

    aInput.innerHTML = ""; vInput.innerHTML = ""; aOutput.innerHTML = "";

    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.innerText = d.label || `${d.kind} (${d.deviceId.slice(0,5)}...)`;
        
        if (d.kind === 'audioinput') aInput.appendChild(opt);
        else if (d.kind === 'videoinput') vInput.appendChild(opt);
        else if (d.kind === 'audiooutput') aOutput.appendChild(opt);
    });

    if(aOutput.options.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = "Desteklenmiyor / Cihaz Yok";
        aOutput.appendChild(opt);
    }
}

export function setMicGain(val) {
    const sliderVal = parseFloat(val);
    // -1 (Sessiz) ile 1 (x2 Ses) arası
    let finalGain = sliderVal > 0 ? (1.0 + sliderVal) : (1.0 + sliderVal);
    if(finalGain < 0) finalGain = 0;
    
    if (state.gainNode) state.gainNode.gain.value = finalGain;
}

export function setOutputVolume(val) {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if (!v.muted) v.volume = val;
    });
}