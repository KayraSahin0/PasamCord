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
const remoteAudio = document.getElementById('remote-audio');
const callTimer = document.getElementById('call-timer');
const connectedPeerName = document.getElementById('connected-peer-name');

// Mute Butonu Elementleri
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');

// Modal Elementleri
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

// 1. GİRİŞ İŞLEMİ (Kullanıcı ismini alıp mikrofonu başlatıyoruz)
function loginUser() {
    const name = usernameInput.value.trim();
    if(!name) {
        alert("Lütfen bir isim giriniz!");
        return;
    }
    myUsername = name;
    displayUsername.innerText = myUsername;

    // Ekran değiştir
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');

    // Mikrofon İzni ve Peer Başlatma
    startSystem();
}

function startSystem() {
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then(stream => {
            localStream = stream;
            updateStatus("PasamCord sunucusuna bağlanılıyor...", "yellow");
            
            const myShortId = Math.random().toString(36).substr(2, 5).toUpperCase();
            initPeer(myShortId);
        })
        .catch(err => {
            console.error(err);
            updateStatus("Mikrofon hatası! İzin verin.", "red");
            alert("Mikrofon izni vermezseniz konuşamazsınız!");
        });
}

// 2. PEERJS BAŞLATMA
function initPeer(id) {
    peer = new Peer(id);

    peer.on('open', (id) => {
        myIdDisplay.innerText = "#" + id;
        updateStatus("Kullanıma Hazır", "green");
    });

    // BİRİ BİZİ ARADIĞINDA (Gelen Çağrı)
    peer.on('call', (call) => {
        pendingCall = call;
        
        // Arayanın ismini metadata'dan al, yoksa ID göster
        const callerName = call.metadata && call.metadata.username ? call.metadata.username : ("#" + call.peer);
        
        callerNameDisplay.innerText = callerName;
        incomingModal.classList.remove('hidden');
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') location.reload();
        else updateStatus("Hata: " + err.type, "red");
    });
}

// 3. ARAMA KABUL ETME
function acceptIncomingCall() {
    if (pendingCall) {
        // Cevap verirken biz de kendi ismimizi göndermeliyiz ama PeerJS answer'da metadata desteği kısıtlıdır.
        // Genellikle arayan taraf ismimizi zaten biliyordur veya ses başlayınca konuşuruz.
        pendingCall.answer(localStream);
        
        // Arayanın ismini ekrana yazmak için metadata'dan tekrar çekelim
        const name = pendingCall.metadata && pendingCall.metadata.username ? pendingCall.metadata.username : ("#" + pendingCall.peer);
        
        handleCall(pendingCall, name);
        incomingModal.classList.add('hidden');
        pendingCall = null;
    }
}

function rejectIncomingCall() {
    if (pendingCall) {
        pendingCall.close();
        incomingModal.classList.add('hidden');
        pendingCall = null;
    }
}

// 4. BİZ ARAMA YAPTIĞIMIZDA
function startCall() {
    let rawInput = remoteIdInput.value.trim().toUpperCase();
    let remoteId = rawInput.replace('#', ''); 

    if (!remoteId) {
        alert("Lütfen bir ID girin.");
        return;
    }

    updateStatus("#" + remoteId + " aranıyor...", "yellow");
    
    // *** ÖNEMLİ: İSMİMİZİ BURADA GÖNDERİYORUZ ***
    const options = {
        metadata: { "username": myUsername }
    };

    const call = peer.call(remoteId, localStream, options);
    handleCall(call, "#" + remoteId);
}

// 5. GÖRÜŞME YÖNETİMİ
function handleCall(call, remoteName) {
    currentCall = call;
    connectedPeerName.innerText = remoteName; // Ekrana karşıdakinin adını yaz

    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        toggleCallUI(true);
        updateStatus("Sesli Sohbet Aktif", "green");
        startTimer();
    });

    call.on('close', () => endCallUI());
    call.on('error', () => { endCallUI(); alert("Bağlantı koptu."); });
}

function endCall() {
    if (currentCall) currentCall.close();
    endCallUI();
}

// 6. MİKROFON SUSTURMA (MUTE) ÖZELLİĞİ
function toggleMute() {
    if(!localStream) return;

    // Ses izini (track) bul
    const audioTrack = localStream.getAudioTracks()[0];
    
    if(audioTrack) {
        // Durumu tersine çevir (True -> False / False -> True)
        audioTrack.enabled = !audioTrack.enabled;
        isMuted = !audioTrack.enabled;

        // UI Güncellemesi
        if(isMuted) {
            muteBtn.classList.add('muted'); // Kırmızı yap
            muteIcon.classList.remove('fa-microphone');
            muteIcon.classList.add('fa-microphone-slash'); // Üzeri çizili ikon
        } else {
            muteBtn.classList.remove('muted'); // Gri yap
            muteIcon.classList.remove('fa-microphone-slash');
            muteIcon.classList.add('fa-microphone'); // Normal ikon
        }
    }
}

// UI Yardımcıları
function toggleCallUI(isInCall) {
    if (isInCall) {
        connectPanel.classList.add('hidden');
        callPanel.classList.remove('hidden');
        // Mute butonunu her yeni aramada sıfırla
        resetMuteUI(); 
    } else {
        connectPanel.classList.remove('hidden');
        callPanel.classList.add('hidden');
    }
}

function resetMuteUI() {
    // Aramaya başlarken mikrofonu hep açık başlat (UI olarak)
    if(localStream && localStream.getAudioTracks()[0]) {
        localStream.getAudioTracks()[0].enabled = true;
    }
    isMuted = false;
    muteBtn.classList.remove('muted');
    muteIcon.classList.remove('fa-microphone-slash');
    muteIcon.classList.add('fa-microphone');
}

function endCallUI() {
    toggleCallUI(false);
    remoteAudio.srcObject = null;
    currentCall = null;
    updateStatus("Kullanıma Hazır", "green");
    stopTimer();
}

function updateStatus(msg, color) {
    statusText.innerText = msg;
    statusDot.className = "dot " + color;
}

function copyId() {
    const id = myIdDisplay.innerText;
    navigator.clipboard.writeText(id);
    const feedback = document.getElementById('copy-feedback');
    feedback.style.opacity = '1';
    setTimeout(() => feedback.style.opacity = '0', 1500);
}

// Zamanlayıcı
function startTimer() {
    let seconds = 0;
    clearInterval(timerInterval);
    callTimer.innerText = "00:00";
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        callTimer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}