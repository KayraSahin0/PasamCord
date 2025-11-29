import { state } from './state.js';
import { addVideoCard } from './ui.js';

export async function initAudioVideo() {
    try {
        const rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.micSource = state.audioContext.createMediaStreamSource(rawStream);
        state.gainNode = state.audioContext.createGain();
        state.gainNode.gain.value = 1.0;
        state.audioDestination = state.audioContext.createMediaStreamDestination();

        state.micSource.connect(state.gainNode);
        state.gainNode.connect(state.audioDestination);

        state.localStream = new MediaStream([
            rawStream.getVideoTracks()[0],
            state.audioDestination.stream.getAudioTracks()[0]
        ]);

        // Kamera kapalı başla
        const videoTrack = state.localStream.getVideoTracks()[0];
        videoTrack.enabled = false;
        state.isCameraOff = true;

        addVideoCard('local', state.localStream, state.myUsername, true);

        await populateDeviceLists();
        return true;

    } catch (err) {
        console.error("Medya Hatası:", err);
        alert("Kamera/Mikrofon izni gerekli!");
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
        opt.innerText = d.label || d.kind;
        if (d.kind === 'audioinput') aInput.appendChild(opt);
        else if (d.kind === 'videoinput') vInput.appendChild(opt);
        else if (d.kind === 'audiooutput') aOutput.appendChild(opt);
    });
    if(aOutput.options.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = "Cihaz Yok/Desteklenmiyor";
        aOutput.appendChild(opt);
    }
}

export function setMicGain(val) {
    const v = parseFloat(val);
    let g = v > 0 ? (1.0 + v) : (1.0 + v);
    if(g < 0) g = 0;
    if (state.gainNode) state.gainNode.gain.value = g;
}

export function setOutputVolume(val) {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if (!v.muted) v.volume = val;
    });
}