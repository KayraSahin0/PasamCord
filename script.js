// HTML Elementleri
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username-input');
const displayUsername = document.getElementById('display-username');

const myIdDisplay = document.getElementById('my-id');
const remoteIdInput = document.getElementById('remote-id');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const connectPanel = document.getElementById('connect-panel');
const callPanel = document.getElementById('call-panel');
const callTimer = document.getElementById('call-timer');

// Video Elementleri
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteLabel = document.getElementById('remote-label');

// Butonlar
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
const cameraBtn = document.getElementById('camera-btn');
const cameraIcon = document.getElementById('camera-icon');

// Modal
const incomingModal = document.getElementById('incoming-modal');
const callerNameDisplay = document.getElementById('caller-name-display');

// Değişkenler
let localStream = null;
let peer = null;
let currentCall = null;
let pendingCall = null;
let timerInterval = null;
let myUsername = "Misafir";
let isMuted = false;
let isCameraOff = true; // Varsayılan olarak kamera kapalı başlar

// 1. GİRİŞ
function loginUser() {
    const name = usernameInput.value.trim();
    if(!name) { alert("Lütfen bir isim giriniz!"); return; }
    myUsername = name;
    displayUsername.innerText = myUsername;
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    startSystem();
}

function startSystem() {
    // Hem SES hem VİDEO izni istiyoruz
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            
            // Başlangıçta Kamerayı KAPAT (Track seviyesinde)
            // Bu sayede izin alınır ama görüntü gitmez.
            const videoTrack = localStream.getVideoTracks()[0];
            if(videoTrack) {
                videoTrack.enabled = false; 
                isCameraOff = true;
                updateCameraUI(); // Butonun kırmızı olmasını sağla
            }

            // Kendi görüntümüzü video elementine bağla (Karanlık görünecek başta)
            localVideo.srcObject = stream;

            updateStatus("Sunucuya bağlanılıyor...", "yellow");
            const myShortId = Math.random().toString(36).substr(2, 5).toUpperCase();
            initPeer(myShortId);
        })
        .catch(err => {
            console.error(err);
            alert("Kamera ve Mikrofon izni vermeniz gerekiyor!");
            updateStatus("İzin hatası!", "red");
        });
}

// 2. PEER BAŞLATMA
function initPeer(id) {
    peer = new Peer(id);
    peer.on('open', (id) => {
        myIdDisplay.innerText = "#" + id;
        updateStatus("Kullanıma Hazır", "green");
    });

    peer.on('call', (call) => {
        pendingCall = call;
        const callerName = call.metadata && call.metadata.username ? call.metadata.username : ("#" + call.peer);
        callerNameDisplay.innerText = callerName;
        incomingModal.classList.remove('hidden');
    });
}

// 3. ARAMA İŞLEMLERİ
function acceptIncomingCall() {
    if (pendingCall) {
        pendingCall.answer(localStream); // Cevapla
        const name = pendingCall.metadata && pendingCall.metadata.username ? pendingCall.metadata.username : ("#" + pendingCall.peer);
        handleCall(pendingCall, name);
        incomingModal.classList.add('hidden');
        pendingCall = null;
    }
}

function rejectIncomingCall() {
    if (pendingCall) { pendingCall.close(); incomingModal.classList.add('hidden'); pendingCall = null; }
}

function startCall() {
    let rawInput = remoteIdInput.value.trim().toUpperCase();
    let remoteId = rawInput.replace('#', ''); 
    if (!remoteId) { alert("Lütfen bir ID girin."); return; }

    updateStatus("#" + remoteId + " aranıyor...", "yellow");
    const options = { metadata: { "username": myUsername } };
    const call = peer.call(remoteId, localStream, options);
    handleCall(call, "#" + remoteId);
}

// 4. GÖRÜŞME YÖNETİMİ
function handleCall(call, remoteName) {
    currentCall = call;
    remoteLabel.innerText = remoteName;

    call.on('stream', (remoteStream) => {
        // Karşıdan gelen stream'i video elementine ver
        remoteVideo.srcObject = remoteStream;
        toggleCallUI(true);
        updateStatus("Bağlı", "green");
        startTimer();
        
        // Ses veya video gelince kontrol et
        checkVideoState(remoteStream, 'remote');
    });

    call.on('close', () => endCallUI());
    call.on('error', () => { endCallUI(); alert("Bağlantı koptu."); });
}

function endCall() {
    if (currentCall) currentCall.close();
    endCallUI();
}

// 5. MEDYA KONTROLLERİ (MUTE & CAMERA)

function toggleMute() {
    if(!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if(audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isMuted = !audioTrack.enabled;
        
        // UI Güncelleme
        if(isMuted) {
            muteBtn.classList.add('btn-off');
            muteIcon.classList.replace('fa-microphone', 'fa-microphone-slash');
        } else {
            muteBtn.classList.remove('btn-off');
            muteIcon.classList.replace('fa-microphone-slash', 'fa-microphone');
        }
    }
}

function toggleCamera() {
    if(!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if(videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isCameraOff = !videoTrack.enabled;
        updateCameraUI();
    }
}

function updateCameraUI() {
    // Buton Rengi ve İkonu
    if(isCameraOff) {
        cameraBtn.classList.add('btn-off'); // Kırmızı yap
        cameraIcon.classList.replace('fa-video', 'fa-video-slash');
        
        // Bizim tarafın videosunu gizle, placeholder göster
        document.querySelector('.local').classList.remove('video-active');
    } else {
        cameraBtn.classList.remove('btn-off'); // Gri (Normal)
        cameraIcon.classList.replace('fa-video-slash', 'fa-video');
        
        // Videoyu göster
        document.querySelector('.local').classList.add('video-active');
    }
}

// Sürekli karşı tarafın kamerasını kontrol etmek gerekebilir 
// (Video track enable/disable olduğunda PeerJS her zaman event tetiklemeyebilir,
// ama HTML video elementi siyah ekran verecektir. CSS placeholder mantığı için basit bir check yapıyoruz)
setInterval(() => {
    if(remoteVideo.srcObject) {
        const tracks = remoteVideo.srcObject.getVideoTracks();
        if(tracks.length > 0 && tracks[0].enabled && !tracks[0].muted) {
            document.querySelector('.remote').classList.add('video-active');
        } else {
            document.querySelector('.remote').classList.remove('video-active');
        }
    }
}, 1000);


// UI YARDIMCILARI
function toggleCallUI(isInCall) {
    if (isInCall) {
        connectPanel.classList.add('hidden');
        callPanel.classList.remove('hidden');
        // Yeni aramada butonları sıfırla (Kamera kapalı başla)
        isCameraOff = true; 
        if(localStream) localStream.getVideoTracks()[0].enabled = false;
        isMuted = false;
        if(localStream) localStream.getAudioTracks()[0].enabled = true;
        
        updateCameraUI();
        muteBtn.classList.remove('btn-off');
        muteIcon.classList.replace('fa-microphone-slash', 'fa-microphone');
    } else {
        connectPanel.classList.remove('hidden');
        callPanel.classList.add('hidden');
    }
}

function endCallUI() {
    toggleCallUI(false);
    remoteVideo.srcObject = null;
    currentCall = null;
    updateStatus("Kullanıma Hazır", "green");
    stopTimer();
}

function updateStatus(msg, color) {
    statusText.innerText = msg;
    statusDot.className = "dot " + color;
}

function copyId() {
    navigator.clipboard.writeText(myIdDisplay.innerText);
    const feedback = document.getElementById('copy-feedback');
    feedback.style.opacity = '1';
    setTimeout(() => feedback.style.opacity = '0', 1500);
}

function startTimer() {
    let seconds = 0;
    clearInterval(timerInterval);
    callTimer.innerText = "00:00";
    timerInterval = setInterval(() => {
        seconds++;
        callTimer.innerText = 
            Math.floor(seconds / 60).toString().padStart(2, '0') + ":" + 
            (seconds % 60).toString().padStart(2, '0');
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }