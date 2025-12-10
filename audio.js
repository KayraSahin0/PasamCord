import { state } from './state.js';
import { addVideoCard } from './ui.js';

export async function initAudioVideo() {
    try {
        // 1. İdeal Ayarları Belirle
        const idealConstraints = {
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

        let rawStream;

        try {
            // 2. İdeal ayarlarla kamerayı açmayı dene
            rawStream = await navigator.mediaDevices.getUserMedia(idealConstraints);
        } catch (firstErr) {
            console.warn("İdeal ayarlarla kamera açılamadı, donanımın toparlanması bekleniyor...", firstErr);
            
            // --- DÜZELTME: Timeout hatası alındığında donanımın resetlenmesi için yarım saniye bekle ---
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 3. FALLBACK: Hata verirse en temel ayarlarla dene (640x480 zorla)
            try {
                console.log("Varsayılan ayarlara (Düşük Çözünürlük) geçiliyor...");
                rawStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true,
                    video: { width: 640, height: 480 } // Kesin çalışması için düşük ayar
                });
            } catch (secondErr) {
                // Eğer bu da çalışmazsa hatayı fırlat ki aşağıdaki catch bloğu yakalasın
                throw secondErr; 
            }
        }

        // --- SES MOTORU (Web Audio API) ---
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }
        state.micSource = state.audioContext.createMediaStreamSource(rawStream);
        state.gainNode = state.audioContext.createGain();
        state.gainNode.gain.value = 1.0;
        state.audioDestination = state.audioContext.createMediaStreamDestination();

        state.micSource.connect(state.gainNode);
        state.gainNode.connect(state.audioDestination);

        // --- YAYIN AKIŞINI OLUŞTURMA ---
        state.localStream = new MediaStream([
            rawStream.getVideoTracks()[0],
            state.audioDestination.stream.getAudioTracks()[0]
        ]);

        // --- BAŞLANGIÇTA KAMERAYI KAPAT ---
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            // Sadece enabled = false yapmak bazen ışığı söndürmez, stop ediyoruz.
            // Açarken toggleLocalVideo fonksiyonu yeniden getUserMedia yapacak.
            videoTrack.enabled = false; 
            videoTrack.stop(); 
        }
        state.isCameraOff = true;

        // UI'ya ekle
        addVideoCard('local', state.localStream, state.myUsername, true);

        await populateDeviceLists();
        return true;

    } catch (err) { 
        console.error("Medya Başlatma Hatası:", err);
        
        // Hata türüne göre kullanıcıya net mesaj ver
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError' || err.name === 'AbortError') {
            alert("Kamera başlatılamadı! (Zaman Aşımı)\n\nLütfen şunları kontrol edin:\n1. Başka bir uygulama (Zoom, Discord vb.) kamerayı kullanıyor olabilir.\n2. Tarayıcıyı tamamen kapatıp yeniden açın.");
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            alert("Kamera/Mikrofon izni reddedildi. Lütfen tarayıcı adres çubuğundaki kilit simgesinden izin verin.");
        } else if (err.name === 'OverconstrainedError') {
            alert("Kameranız istenen çözünürlüğü desteklemiyor.");
        } else {
            alert("Medya aygıtlarına erişilemedi: " + err.message);
        }
        
        return false;
    }
}

// --- KAMERA AÇ/KAPA ---
export async function toggleLocalVideo(shouldEnable) {
    if (!state.localStream) return false;

    const track = state.localStream.getVideoTracks()[0];
    
    // 1. KAMERA AÇMA
    if (shouldEnable) {
        try {
            // Kamerayı yeniden iste
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: state.videoResolution },
                    frameRate: { ideal: state.videoFPS }
                }
            });
            const newTrack = newStream.getVideoTracks()[0];

            // Eski track varsa temizle
            if (track) {
                state.localStream.removeTrack(track);
                track.stop();
            }
            // Yeni track ekle
            state.localStream.addTrack(newTrack);

            // Kendi görüntünü güncelle (UI)
            const localVideo = document.querySelector('#video-local video');
            if (localVideo) localVideo.srcObject = state.localStream;
            
            const localCard = document.getElementById('video-local');
            if(localCard) localCard.classList.add('video-active');

            // Karşı tarafa yeni görüntüyü gönder (PeerJS)
            Object.values(state.peers).forEach(p => {
                if (p.call && p.call.peerConnection) {
                    const sender = p.call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(newTrack);
                }
            });
            return true;

        } catch (e) {
            console.error("Kamera açma hatası:", e);
            alert("Kamera açılamadı. Başka bir uygulama kullanıyor olabilir veya kablo bağlantısını kontrol edin.");
            return false;
        }
    } 
    // 2. KAMERA KAPATMA
    else {
        if (track) {
            track.enabled = false;
            track.stop(); // Işığı söndür
        }
        const localCard = document.getElementById('video-local');
        if (localCard) localCard.classList.remove('video-active');
        return true;
    }
}

// --- CİHAZ LİSTELERİ ---
export async function populateDeviceLists() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const aInput = document.getElementById('audio-input-select');
        const vInput = document.getElementById('video-input-select');
        const aOutput = document.getElementById('audio-output-select');

        if(aInput) aInput.innerHTML = ""; 
        if(vInput) vInput.innerHTML = ""; 
        if(aOutput) aOutput.innerHTML = "";

        devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.innerText = d.label || (d.kind + " " + (d.deviceId.slice(0,5) + "..."));
            
            if (d.kind === 'audioinput' && aInput) aInput.appendChild(opt);
            else if (d.kind === 'videoinput' && vInput) vInput.appendChild(opt);
            else if (d.kind === 'audiooutput' && aOutput) aOutput.appendChild(opt);
        });
    } catch (e) {
        console.warn("Cihaz listesi alınamadı:", e);
    }
}

// --- SES GİRİŞİ DEĞİŞTİRME ---
export async function switchAudioInput(deviceId) {
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        const newTrack = newStream.getAudioTracks()[0];
        
        const oldTrack = state.localStream.getAudioTracks()[0];
        if(oldTrack) oldTrack.stop();
        
        state.localStream.removeTrack(oldTrack);
        state.localStream.addTrack(newTrack);
        
        // Ses İşleme (Gain vb.) zincirini yeniden kur
        if(state.micSource) {
            state.micSource.disconnect();
            state.micSource = state.audioContext.createMediaStreamSource(newStream);
            state.micSource.connect(state.gainNode);
        }
        
        // Karşı tarafa gönder
        const processedTrack = state.audioDestination.stream.getAudioTracks()[0];
        Object.values(state.peers).forEach(p => {
             if(p.call && p.call.peerConnection) {
                 const sender = p.call.peerConnection.getSenders().find(s => s.track.kind === 'audio');
                 if(sender) sender.replaceTrack(processedTrack);
             }
        });
    } catch(e) { console.error("Mikrofon değiştirme hatası:", e); }
}

// --- VİDEO GİRİŞİ DEĞİŞTİRME ---
export async function switchVideoInput(deviceId) {
    if(state.isCameraOff) return; 
    
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                deviceId: { exact: deviceId }, 
                width: { ideal: state.videoResolution },
                frameRate: { ideal: state.videoFPS }
            } 
        });
        const newTrack = newStream.getVideoTracks()[0];
        const oldTrack = state.localStream.getVideoTracks()[0];
        
        if(oldTrack) {
             state.localStream.removeTrack(oldTrack);
             oldTrack.stop();
        }
        state.localStream.addTrack(newTrack);

        const localVideo = document.querySelector('#video-local video');
        if(localVideo) localVideo.srcObject = state.localStream;

        Object.values(state.peers).forEach(p => {
             if(p.call && p.call.peerConnection) {
                 const sender = p.call.peerConnection.getSenders().find(s => s.track.kind === 'video');
                 if(sender) sender.replaceTrack(newTrack);
             }
        });
    } catch(e) { console.error("Kamera değiştirme hatası:", e); }
}

export function setMicGain(val) {
    const v = parseFloat(val);
    let g = v > 0 ? (1.0 + v) : (1.0 + v);
    if(g < 0) g = 0;
    if (state.gainNode) state.gainNode.gain.value = g;
}

export function setOutputVolume(val) {
    document.querySelectorAll('video').forEach(v => {
        if (!v.muted && v.id !== 'video-local') v.volume = val;
    });
}

export async function applyVideoQuality() {
    console.log("Kalite ayarı kaydedildi. Bir sonraki kamera açılışında geçerli olacak.");
}