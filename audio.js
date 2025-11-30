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

        const videoTrack = state.localStream.getVideoTracks()[0];
        videoTrack.enabled = false;
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

// --- KALİTE DEĞİŞTİRME ---
export async function applyVideoQuality() {
    if (!state.localStream) return;
    
    const track = state.localStream.getVideoTracks()[0];
    if (track) {
        try {
            await track.applyConstraints({
                width: { ideal: state.videoResolution },
                height: { ideal: state.videoResolution * (9/16) },
                frameRate: { ideal: state.videoFPS }
            });
            console.log(`Kalite Güncellendi: ${state.videoResolution}p ${state.videoFPS}fps`);
        } catch (e) {
            console.error("Kalite değiştirilemedi:", e);
        }
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
        const opt = document.createElement('option'); opt.innerText = "Desteklenmiyor"; aOutput.appendChild(opt);
    }
}

export async function switchAudioInput(deviceId) {
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        const newAudioTrack = newStream.getAudioTracks()[0];
        const oldTrack = state.localStream.getAudioTracks()[0];
        if(oldTrack) oldTrack.stop();

        state.micSource.disconnect();
        state.micSource = state.audioContext.createMediaStreamSource(newStream);
        state.micSource.connect(state.gainNode);
        
        const processedTrack = state.audioDestination.stream.getAudioTracks()[0];
        state.localStream.removeTrack(state.localStream.getAudioTracks()[0]);
        state.localStream.addTrack(processedTrack);

        updatePeersTrack(processedTrack, 'audio');
    } catch(e) { console.error(e); }
}

export async function switchVideoInput(deviceId) {
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
        if(oldTrack) oldTrack.stop();

        state.localStream.removeTrack(oldTrack);
        state.localStream.addTrack(newVideoTrack);
        newVideoTrack.enabled = !state.isCameraOff;

        const localVideo = document.querySelector('#video-local video');
        if(localVideo) localVideo.srcObject = state.localStream;

        updatePeersTrack(newVideoTrack, 'video');
    } catch(e) { console.error(e); }
}

function updatePeersTrack(newTrack, kind) {
    Object.values(state.peers).forEach(peer => {
        if(peer.call && peer.call.peerConnection) {
            const sender = peer.call.peerConnection.getSenders().find(s => s.track && s.track.kind === kind);
            if(sender) sender.replaceTrack(newTrack);
        }
    });
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