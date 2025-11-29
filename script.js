// --- DOM Elementleri ---
const videoGrid = document.getElementById('video-grid');
const participantList = document.getElementById('participant-list');
const participantBadge = document.getElementById('participant-badge');

// Global Değişkenler
let myUsername = "Ben";
let localStream = null;
let peer = null;

// Multi-Peer Yönetimi (Çoklu Bağlantı için)
const peers = {}; // Bağlı olan herkesin çağrılarını ve bilgilerini tutar
const activeStreams = {}; // Aktif streamler

// Audio Context (Ses Motoru)
let audioContext;
let gainNode; // Ses yükseltici
let micSource;
let audioDestination;

// --- 1. SİSTEM BAŞLANGIÇ ---
async function loginUser() {
    const nameInput = document.getElementById('username-input');
    if (!nameInput.value.trim()) return alert("İsim giriniz!");
    
    myUsername = nameInput.value.trim();
    document.getElementById('display-username').innerText = myUsername;
    
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    await startLocalStream();
}

async function startLocalStream() {
    try {
        // Ham mikrofon ve kamera verisini al
        const rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // --- SES MOTORU (GAIN) KURULUMU ---
        // Web Audio API bağlamı oluştur
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Mikrofonu kaynak olarak al
        micSource = audioContext.createMediaStreamSource(rawStream);
        
        // Gain (Ses Seviyesi) Düğümü oluştur
        gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0; // Varsayılan (Normal, Slider 0)
        
        // İşlenmiş ses için hedef oluştur
        audioDestination = audioContext.createMediaStreamDestination();
        
        // Bağlantıyı Kur: Mikrofon -> Gain -> Hedef
        micSource.connect(gainNode);
        gainNode.connect(audioDestination);
        
        // PeerJS'e göndereceğimiz Yeni Stream:
        // Görüntü (Ham) + Ses (İşlenmiş)
        localStream = new MediaStream([
            rawStream.getVideoTracks()[0],          // Orijinal Video
            audioDestination.stream.getAudioTracks()[0] // İşlenmiş Ses
        ]);

        // Kendi görüntümüzü ekrana ekle
        addVideoStream('local-video', localStream, myUsername, true);
        
        // Peer'i başlat (Rastgele ID ile)
        initPeer();

        // Cihazları listele
        getDevices();

    } catch (err) {
        console.error("Medya hatası:", err);
        alert("Kamera/Mikrofon izni verilmedi!");
    }
}

// --- 2. PEERJS BAĞLANTILARI ---
function initPeer() {
    const myId = Math.random().toString(36).substr(2, 5).toUpperCase();
    peer = new Peer(myId);

    peer.on('open', id => {
        document.getElementById('my-id').innerText = "#" + id;
        updateParticipants();
    });

    // GELEN ARAMA (Biri odaya katıldığında)
    peer.on('call', call => {
        // Aramayı cevapla (Kendi streamimizi gönder)
        call.answer(localStream);
        
        // Karşıdan gelen stream'i işle
        handleCall(call);
    });

    // GELEN VERİ (İsim bilgisini almak için)
    peer.on('connection', conn => {
        conn.on('data', data => {
            if(data.type === 'name') {
                // İsmi kaydet ve UI güncelle
                if(peers[conn.peer]) {
                    peers[conn.peer].name = data.name;
                    updateNameTag(conn.peer, data.name);
                    updateParticipants();
                }
            }
        });
    });
}

// ARAMA YAPMA (Biz odaya bağlanırken)
function startCall() {
    let remoteId = document.getElementById('remote-id').value.trim().toUpperCase().replace('#', '');
    if(!remoteId) return alert("ID Giriniz");

    // Medya Bağlantısı (Ses/Video)
    const call = peer.call(remoteId, localStream);
    
    // Veri Bağlantısı (İsim Gönderme)
    const conn = peer.connect(remoteId);
    conn.on('open', () => {
        conn.send({ type: 'name', name: myUsername });
    });

    handleCall(call, conn);
}

// ÇAĞRI YÖNETİMİ (Ortak)
function handleCall(call, conn = null) {
    const peerId = call.peer;
    
    // Eğer conn (veri bağlantısı) henüz yoksa, karşı taraf bize bağlanacaktır, bekle.
    // Ancak biz arandıysak (cevaplayan biziz), karşıya ismimizi göndermeliyiz.
    if(!conn) {
        const backConn = peer.connect(peerId);
        backConn.on('open', () => {
            backConn.send({ type: 'name', name: myUsername });
        });
    }

    // Peer listesine ekle
    peers[peerId] = {
        call: call,
        name: "Bağlanıyor...", // İsim verisi gelene kadar
        id: peerId
    };

    call.on('stream', remoteStream => {
        // Grid'e video ekle
        if(!document.getElementById(`video-${peerId}`)) {
            addVideoStream(peerId, remoteStream, peers[peerId].name, false);
            updateParticipants();
        }
    });

    call.on('close', () => removePeer(peerId));
    call.on('error', () => removePeer(peerId));
}

function removePeer(peerId) {
    if(peers[peerId]) delete peers[peerId];
    const videoEl = document.getElementById(`video-${peerId}`);
    if(videoEl) videoEl.remove();
    updateParticipants();
    
    // Grid düzenini CSS otomatik yapacak ama gerekirse force redraw
}

// --- 3. UI: VİDEO GRID & KATILIMCI ---
function addVideoStream(id, stream, name, isLocal) {
    // Wrapper Div (Kart)
    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = `video-${id}`; // Benzersiz ID

    // Video Elementi
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if(isLocal) video.muted = true; // Kendi sesimizi duymayalım

    // İsim Etiketi
    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerHTML = `<i class="fa-solid fa-user"></i> <span id="name-${id}">${name}</span>`;

    // Avatar (Kamera Kapalıyken)
    const avatar = document.createElement('div');
    avatar.className = 'avatar-overlay';
    avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`;

    card.appendChild(video);
    card.appendChild(nameTag);
    card.appendChild(avatar);
    
    // Grid'e ekle
    videoGrid.appendChild(card);

    // Bağlantı paneli gizle, gridi göster
    document.getElementById('connect-panel').classList.add('hidden');
    document.getElementById('call-panel').classList.remove('hidden');

    // Video açık/kapalı kontrolü
    monitorVideoState(stream, card, id);
}

function updateNameTag(id, newName) {
    const el = document.getElementById(`name-${id}`);
    if(el) {
        el.innerText = newName;
        // Avatar harfini de güncelle
        const card = document.getElementById(`video-${id}`);
        const avatarCircle = card.querySelector('.avatar-circle');
        if(avatarCircle) avatarCircle.innerText = newName.charAt(0).toUpperCase();
    }
}

function updateParticipants() {
    participantList.innerHTML = "";
    
    // Ben
    addParticipantRow(myUsername + " (Sen)", true);
    
    // Diğerleri
    let count = 1;
    Object.values(peers).forEach(p => {
        addParticipantRow(p.name, false);
        count++;
    });
    
    participantBadge.innerText = count;
}

function addParticipantRow(name, isOnline) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div style="width:30px; height:30px; background:var(--primary); border-radius:50%; display:flex; justify-content:center; align-items:center; color:white; font-weight:bold;">
            ${name.charAt(0).toUpperCase()}
        </div>
        <span>${name}</span>
        <i class="fa-solid fa-circle" style="color:${isOnline ? '#3ba55c' : '#faa61a'}; font-size:0.5rem; margin-left:auto;"></i>
    `;
    participantList.appendChild(li);
}

// --- 4. GELİŞMİŞ AYARLAR (GAIN & VOLUME) ---

// Hoparlör Sesi (Video elementlerinin volume'unu değiştirir)
function changeOutputVolume(val) {
    // Local hariç tüm videoları bul
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if(!v.muted) v.volume = val; // Sadece remote videolar
    });
}

// Mikrofon Hassasiyeti (Web Audio API Gain)
function changeMicGain(val) {
    // Slider -1 ile 1 arasında geliyor.
    // 0 -> Gain 1.0 (Normal)
    // 1 -> Gain 2.0 (Yüksek)
    // -1 -> Gain 0.0 (Sessiz)
    
    const sliderVal = parseFloat(val);
    let finalGain = 1.0;

    if (sliderVal === 0) finalGain = 1.0;
    else if (sliderVal > 0) finalGain = 1.0 + sliderVal; // 1.0 ile 2.0 arası
    else finalGain = 1.0 + sliderVal; // 1.0 ile 0.0 arası (örn: -0.5 -> 0.5)

    if (gainNode) {
        gainNode.gain.value = finalGain;
        console.log("Mikrofon Hassasiyeti:", finalGain);
    }
}

// --- YARDIMCI FONKSİYONLAR ---
function monitorVideoState(stream, card, id) {
    setInterval(() => {
        const videoTrack = stream.getVideoTracks()[0];
        if(videoTrack && videoTrack.enabled && videoTrack.readyState === 'live') {
            card.classList.add('video-active');
        } else {
            card.classList.remove('video-active');
        }
    }, 1000);
}

function toggleMute() {
    if(localStream) {
        // AudioDestination'dan çıkan ses track'ini kontrol et
        const track = localStream.getAudioTracks()[0];
        track.enabled = !track.enabled;
        
        const btn = document.getElementById('mute-btn');
        const icon = document.getElementById('mute-icon');
        if(track.enabled) {
            btn.classList.remove('btn-off');
            icon.classList.replace('fa-microphone-slash', 'fa-microphone');
        } else {
            btn.classList.add('btn-off');
            icon.classList.replace('fa-microphone', 'fa-microphone-slash');
        }
    }
}

function toggleCamera() {
    // Orijinal ham stream'e erişmemiz lazım (localStream işlenmiş streamdir)
    // localStream içindeki video track'ini bul
    const track = localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;

    const btn = document.getElementById('camera-btn');
    const icon = document.getElementById('camera-icon');
    
    if(track.enabled) {
        btn.classList.remove('btn-secondary'); // Gri
        icon.classList.replace('fa-video-slash', 'fa-video');
    } else {
        btn.classList.add('btn-secondary'); // Kapalıyken gri kalsın veya kırmızı olsun
        btn.classList.add('btn-off'); // Kırmızı
        icon.classList.replace('fa-video', 'fa-video-slash');
    }
}

function endCall() {
    // Herkesi kapat
    Object.keys(peers).forEach(key => {
        peers[key].call.close();
    });
    window.location.reload(); // En temiz çıkış
}

// UI Panel Aç/Kapa
function toggleParticipants() { 
    const p = document.getElementById('participants-panel');
    p.classList.toggle('open');
}
function toggleSettings() {
    document.getElementById('settings-modal').classList.toggle('hidden');
}
function copyId() {
    navigator.clipboard.writeText(document.getElementById('my-id').innerText);
    const fb = document.getElementById('copy-feedback');
    fb.style.opacity = '1';
    setTimeout(() => fb.style.opacity = '0', 1000);
}

// Cihaz Listeleme (Dummy Select doldurma)
async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const aSelect = document.getElementById('audio-input-select');
    const vSelect = document.getElementById('video-input-select');
    aSelect.innerHTML = ""; vSelect.innerHTML = "";
    
    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.innerText = d.label || d.kind;
        if(d.kind === 'audioinput') aSelect.appendChild(opt);
        else if(d.kind === 'videoinput') vSelect.appendChild(opt);
    });
}

// Timer
let seconds = 0;
setInterval(() => {
    seconds++;
    const m = Math.floor(seconds/60).toString().padStart(2,'0');
    const s = (seconds%60).toString().padStart(2,'0');
    document.getElementById('call-timer').innerText = `${m}:${s}`;
}, 1000);