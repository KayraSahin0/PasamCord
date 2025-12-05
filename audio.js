import { state } from './state.js';
import { addVideoCard } from './ui.js';

export async function initAudioVideo() {
    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: {
                width: { ideal: state.videoResolution },
                height: { ideal: state.videoResolution * (9/16) },
                frameRate: { ideal: state.videoFPS }
            }
        };

        const rawStream = await navigator.mediaDevices.getUserMedia(constraints);

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

        // KAMERA BAŞLANGIÇTA SADECE DEVRE DIŞI (STOP YOK)
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = false; // Sadece görüntüyü kes
        }
        state.isCameraOff = true;

        addVideoCard('local', state.localStream, state.myUsername, true);

        await populateDeviceLists();
        return true;

    } catch (err) {
        console.error("Medya Hatası:", err);
        alert("Kamera/Mikrofon izni gerekli! Lütfen izin verin.");
        return false;
    }
}

// --- KAMERA AÇ/KAPA (GARANTİ ÇALIŞAN YÖNTEM) ---
export function toggleLocalVideo(shouldEnable) {
    if (!state.localStream) return false;
    
    const track = state.localStream.getVideoTracks()[0];
    if (track) {
        // Track'i durdurmuyoruz, sadece aktif/pasif yapıyoruz
        track.enabled = shouldEnable;
        
        // UI Güncelleme (Avatarı göster/gizle)
        const localCard = document.getElementById('video-local');
        if (localCard) {
            if (shouldEnable) localCard.classList.add('video-active');
            else localCard.classList.remove('video-active');
        }
        return true;
    }
    return false;
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
        const opt = document.createElement('option'); opt.innerText = "Varsayılan / Desteklenmiyor"; aOutput.appendChild(opt);
    }
}

export async function switchAudioInput(deviceId) {
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        const newAudioTrack = newStream.getAudioTracks()[0];
        
        state.micSource.disconnect();
        state.micSource = state.audioContext.createMediaStreamSource(newStream);
        state.micSource.connect(state.gainNode);
        
        const processedTrack = state.audioDestination.stream.getAudioTracks()[0];
        const oldTrack = state.localStream.getAudioTracks()[0];
        if(oldTrack) state.localStream.removeTrack(oldTrack);
        state.localStream.addTrack(processedTrack);

        Object.values(state.peers).forEach(p => {
            if(p.call && p.call.peerConnection) {
                const sender = p.call.peerConnection.getSenders().find(s => s.track.kind === 'audio');
                if(sender) sender.replaceTrack(processedTrack);
            }
        });
    } catch(e) { console.error(e); }
}

export async function switchVideoInput(deviceId) {
    if (state.isCameraOff) return;
    try {
        const constraints = {
            video: { 
                deviceId: { exact: deviceId },
                width: { ideal: state.videoResolution }, 
                frameRate: { ideal: state.videoFPS }
            }
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldTrack = state.localStream.getVideoTracks()[0];
        
        state.localStream.removeTrack(oldTrack);
        oldTrack.stop(); // Eskisini durdur
        state.localStream.addTrack(newVideoTrack);

        const localVideo = document.querySelector('#video-local video');
        if(localVideo) localVideo.srcObject = state.localStream;

        Object.values(state.peers).forEach(p => {
            if(p.call && p.call.peerConnection) {
                const sender = p.call.peerConnection.getSenders().find(s => s.track.kind === 'video');
                if(sender) sender.replaceTrack(newVideoTrack);
            }
        });
    } catch(e) { console.error(e); }
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
        if (!v.muted && v.id !== 'video-local') v.volume = val;
    });
}

export async function applyVideoQuality() {
    console.log("Kalite ayarı değişti. Etkili olması için kamerayı kapatıp açın.");
}