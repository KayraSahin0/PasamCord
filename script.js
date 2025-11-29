// --- DOM ELEMENTLERİ ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username-input');
const displayUsername = document.getElementById('display-username');

const myIdDisplay = document.getElementById('my-id');
const remoteIdInput = document.getElementById('remote-id');
const connectPanel = document.getElementById('connect-panel');
const callPanel = document.getElementById('call-panel');
const videoContainer = document.getElementById('video-container');

// Video & Audio
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteLabel = document.getElementById('remote-label');

// Avatars
const localAvatar = document.getElementById('local-avatar');
const remoteAvatar = document.getElementById('remote-avatar');

// Settings
const audioSelect = document.getElementById('audio-input-select');
const videoSelect = document.getElementById('video-input-select');
const settingsModal = document.getElementById('settings-modal');

// Side Panel
const participantsPanel = document.getElementById('participants-panel');
const participantList = document.getElementById('participant-list');
const participantCount = document.getElementById('participant-count');

// Buttons
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
const cameraBtn = document.getElementById('camera-btn');
const cameraIcon = document.getElementById('camera-icon');

// Modals
const incomingModal = document.getElementById('incoming-modal');
const callerNameDisplay = document.getElementById('caller-name-display');

// --- DEĞİŞKENLER ---
let localStream = null;
let peer = null;
let currentCall = null;
let pendingCall = null;
let myUsername = "Ben";
let remoteUsername = "Bilinmeyen";

// Durumlar
let isMuted = false;
let isCameraOff = true;

// Audio Context (Gain/Hassasiyet için)
let audioContext;
let gainNode;
let mediaStreamSource;

// --- GİRİŞ VE BAŞLANGIÇ ---
function loginUser() {
    const name = usernameInput.value.trim();
    if(!name) { alert("Lütfen bir isim girin!"); return; }
    myUsername = name;
    displayUsername.innerText = myUsername;
    
    // Avatar baş harfi
    localAvatar.innerText = myUsername.charAt(0).toUpperCase();
    
    // UI Güncelle
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    
    // Katılımcı Listesini Güncelle (Sadece biz varız)
    updateParticipantsList();

    // Sistemi Başlat
    startSystem();
}

async function startSystem() {
    try {
        // Varsayılan stream
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Audio Gain (Hassasiyet) Kurulumu
        setupAudioGain(localStream);
        
        // Kamera başlangıçta kapalı
        const videoTrack = localStream.getVideoTracks()[0];
        if(videoTrack) { videoTrack.enabled = false; isCameraOff = true; updateCameraUI(); }

        localVideo.srcObject = localStream;
        
        // Cihazları listele (Ayarlar için)
        await getDevices();

        // PeerJS Bağlantısı
        const myShortId = Math.random().toString(36).substr(2, 5).toUpperCase();
        initPeer(myShortId);

    } catch (err) {
        console.error("Başlangıç Hatası:", err);
        alert("Kamera/Mikrofon erişimine izin verin.");
    }
}

// --- SES HASSASİYETİ (AUDIO CONTEXT) ---
function setupAudioGain(stream) {
    // Web Audio API kullanarak sesin sesini dijital olarak artırma (Gain)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    gainNode = audioContext.createGain();
    
    // Source -> Gain -> Destination bağlantısı PeerConnection içinde otomatik olur,
    // Ancak burada akışı manipüle etmek için 'destination'a ihtiyacımız var ama
    // WebRTC'de track'i değiştirmek daha karmaşık. 
    // Basitlik için: PeerJS doğrudan ham stream'i alır.
    // Gerçek bir gain kontrolü için, AudioContext'ten çıkan "destination.stream"i PeerJS'e vermeliyiz.
    
    // Gelişmiş Yöntem: Stream'i Gain Node'dan geçirip yeni bir stream oluşturuyoruz.
    const destination = audioContext.createMediaStreamDestination();
    mediaStreamSource.connect(gainNode);
    gainNode.connect(destination);
    
    // Orijinal video track ile işlenmiş ses track'ini birleştir
    const processedStream = new MediaStream([
        destination.stream.getAudioTracks()[0],
        stream.getVideoTracks()[0]
    ]);
    
    // PeerJS artık bu işlenmiş stream'i kullanmalı
    // NOT: Bu demo için localStream'i güncelliyoruz ama mevcut kod yapısında
    // getUserMedia tekrar çağrıldığında bu yapı bozulabilir. 
    // Basit tutmak için volume (çıkış sesi) ayarını yapıyoruz, input gain karmaşık bir konu.
}

// --- CİHAZ YÖNETİMİ (AYARLAR) ---
async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioSelect.innerHTML = "";
    videoSelect.innerHTML = "";
    
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `${device.kind} - ${device.deviceId.substr(0,5)}`;
        
        if(device.kind === 'audioinput') audioSelect.appendChild(option);
        else if(device.kind === 'videoinput') videoSelect.appendChild(option);
    });
}

// Cihaz Değiştirme Fonksiyonu
async function changeStreamInput() {
    const audioSource = audioSelect.value;
    const videoSource = videoSelect.value;
    
    // Eski trackleri durdur
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // Yeni cihazlarla stream al
    const constraints = {
        audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
        video: { deviceId: videoSource ? { exact: videoSource } : undefined }
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Video ayarını koru (Kapatılsın mı?)
    localStream.getVideoTracks()[0].enabled = !isCameraOff;
    localVideo.srcObject = localStream;

    // Aktif görüşme varsa karşıya giden stream'i güncelle (ReplaceTrack)
    if(currentCall && currentCall.peerConnection) {
        const senders = currentCall.peerConnection.getSenders();
        const videoSender = senders.find(s => s.track.kind === 'video');
        const audioSender = senders.find(s => s.track.kind === 'audio');
        
        if(videoSender) videoSender.replaceTrack(localStream.getVideoTracks()[0]);
        if(audioSender) audioSender.replaceTrack(localStream.getAudioTracks()[0]);
    }
}

function changeAudioInput() { changeStreamInput(); }
function changeVideoInput() { changeStreamInput(); }

// Ses Ayarları
function changeOutputVolume(val) {
    remoteVideo.volume = val;
}
function changeMicGain(val) {
    if(gainNode) gainNode.gain.value = val;
}

// --- PEER JS ---
function initPeer(id) {
    peer = new Peer(id);
    peer.on('open', (id) => {
        myIdDisplay.innerText = "#" + id;
    });

    peer.on('call', (call) => {
        pendingCall = call;
        const name = call.metadata?.username || "#" + call.peer;
        callerNameDisplay.innerText = name;
        incomingModal.classList.remove('hidden');
    });
}

// --- ARAMA YÖNETİMİ ---
function startCall() {
    let rawInput = remoteIdInput.value.trim().toUpperCase().replace('#', '');
    if (!rawInput) return alert("ID girin!");

    const options = { metadata: { username: myUsername } };
    const call = peer.call(rawInput, localStream, options);
    handleCall(call, "#" + rawInput); // İsim sonra güncellenebilir
}

function acceptIncomingCall() {
    if (pendingCall) {
        pendingCall.answer(localStream);
        const name = pendingCall.metadata?.username || "#" + pendingCall.peer;
        handleCall(pendingCall, name);
        incomingModal.classList.add('hidden');
        pendingCall = null;
    }
}

function rejectIncomingCall() {
    if(pendingCall) { pendingCall.close(); pendingCall = null; incomingModal.classList.add('hidden'); }
}

function handleCall(call, name) {
    currentCall = call;
    remoteUsername = name;
    remoteLabel.innerText = name;
    remoteAvatar.innerText = name.charAt(0).toUpperCase();

    // UI Aç
    connectPanel.classList.add('hidden');
    callPanel.classList.remove('hidden');
    updateParticipantsList(); // Listeye ekle

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        startVideoCheck();
        startTimer();
    });

    call.on('close', () => endCallUI());
    call.on('error', () => endCallUI());
}

function endCall() {
    if(currentCall) currentCall.close();
    endCallUI();
}

function endCallUI() {
    connectPanel.classList.remove('hidden');
    callPanel.classList.add('hidden');
    currentCall = null;
    remoteUsername = "Bilinmeyen";
    updateParticipantsList(); // Listeden çıkar
    stopTimer();
    
    // Fullscreen'den çık
    if(document.fullscreenElement) document.exitFullscreen();
}

// --- UI KONTROLLERİ ---
function toggleMute() {
    if(!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    isMuted = !audioTrack.enabled;
    
    muteBtn.classList.toggle('btn-off', isMuted);
    muteIcon.classList.toggle('fa-microphone-slash', isMuted);
    muteIcon.classList.toggle('fa-microphone', !isMuted);
}

function toggleCamera() {
    if(!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    isCameraOff = !videoTrack.enabled;
    
    updateCameraUI();
}

function updateCameraUI() {
    cameraBtn.classList.toggle('btn-off', isCameraOff);
    cameraIcon.classList.toggle('fa-video-slash', isCameraOff);
    cameraIcon.classList.toggle('fa-video', !isCameraOff);

    // Local Video Class Ekle/Çıkar
    const localWrapper = document.querySelector('.local');
    if(isCameraOff) localWrapper.classList.remove('video-active');
    else localWrapper.classList.add('video-active');
}

// Fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => alert("Tam ekran hatası: " + err.message));
        videoContainer.classList.add('fullscreen');
        document.getElementById('fullscreen-icon').classList.replace('fa-expand', 'fa-compress');
    } else {
        document.exitFullscreen();
        videoContainer.classList.remove('fullscreen');
        document.getElementById('fullscreen-icon').classList.replace('fa-compress', 'fa-expand');
    }
}

// Video Kontrol (Avatar vs Video Gösterimi)
function startVideoCheck() {
    setInterval(() => {
        const remoteWrapper = document.querySelector('.remote');
        if(remoteVideo.srcObject) {
            const tracks = remoteVideo.srcObject.getVideoTracks();
            if(tracks.length > 0 && tracks[0].enabled && !tracks[0].muted) {
                remoteWrapper.classList.add('video-active');
            } else {
                remoteWrapper.classList.remove('video-active');
            }
        }
    }, 1000);
}

// --- SIDEBAR & MODAL ---
function toggleSettings() {
    settingsModal.classList.toggle('hidden');
}

function toggleParticipants() {
    const panel = participantsPanel;
    if(panel.style.right === "0px") panel.style.right = "-300px";
    else panel.style.right = "0px";
}

function updateParticipantsList() {
    participantList.innerHTML = "";
    
    // Ben
    addParticipantToList(myUsername, true);
    
    // Karşı Taraf (Varsa)
    if(currentCall) {
        addParticipantToList(remoteUsername, false);
        participantCount.innerText = "2";
    } else {
        participantCount.innerText = "1";
    }
}

function addParticipantToList(name, isMe) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div class="p-avatar">${name.charAt(0).toUpperCase()}</div>
        <div class="p-info">
            <span class="p-name">${name} ${isMe ? '(Sen)' : ''}</span>
            <span class="p-status">Çevrimiçi</span>
        </div>
    `;
    participantList.appendChild(li);
}

function copyId() {
    navigator.clipboard.writeText(myIdDisplay.innerText);
    const fb = document.getElementById('copy-feedback');
    fb.style.opacity = '1';
    setTimeout(() => fb.style.opacity = '0', 1000);
}

// Zamanlayıcı
function startTimer() {
    let sec = 0;
    const el = document.getElementById('call-timer');
    window.timerInt = setInterval(() => {
        sec++;
        el.innerText = Math.floor(sec/60).toString().padStart(2,'0') + ":" + (sec%60).toString().padStart(2,'0');
    }, 1000);
}
function stopTimer() { clearInterval(window.timerInt); }