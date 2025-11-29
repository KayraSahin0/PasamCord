// --- DOM Elementleri ---
const videoGrid = document.getElementById('video-grid');
const participantList = document.getElementById('participant-list');
const participantBadge = document.getElementById('participant-badge');

let myUsername = "Ben";
let localStream = null;
let peer = null;
const peers = {}; 

// Audio Context
let audioContext;
let gainNode;
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
        const rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Audio Engine
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micSource = audioContext.createMediaStreamSource(rawStream);
        gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0; 
        audioDestination = audioContext.createMediaStreamDestination();
        micSource.connect(gainNode);
        gainNode.connect(audioDestination);
        
        localStream = new MediaStream([
            rawStream.getVideoTracks()[0],          
            audioDestination.stream.getAudioTracks()[0] 
        ]);

        addVideoStream('local-video', localStream, myUsername, true);
        initPeer();
        getDevices(); // Cihazları getir

    } catch (err) {
        console.error("Hata:", err);
        alert("Kamera/Mikrofon izni gerekli!");
    }
}

// --- 2. PEERJS ---
function initPeer() {
    const myId = Math.random().toString(36).substr(2, 5).toUpperCase();
    peer = new Peer(myId);

    peer.on('open', id => {
        document.getElementById('my-id').innerText = "#" + id;
        updateParticipants();
    });

    peer.on('call', call => {
        call.answer(localStream);
        handleCall(call);
    });

    peer.on('connection', conn => {
        conn.on('data', data => {
            if(data.type === 'name' && peers[conn.peer]) {
                peers[conn.peer].name = data.name;
                updateNameTag(conn.peer, data.name);
                updateParticipants();
            }
        });
    });
}

function startCall() {
    let remoteId = document.getElementById('remote-id').value.trim().toUpperCase().replace('#', '');
    if(!remoteId) return alert("ID Giriniz");

    const call = peer.call(remoteId, localStream);
    const conn = peer.connect(remoteId);
    conn.on('open', () => conn.send({ type: 'name', name: myUsername }));

    handleCall(call, conn);
}

function handleCall(call, conn = null) {
    const peerId = call.peer;
    if(!conn) {
        const backConn = peer.connect(peerId);
        backConn.on('open', () => backConn.send({ type: 'name', name: myUsername }));
    }

    peers[peerId] = { call: call, name: "Bağlanıyor...", id: peerId };

    call.on('stream', remoteStream => {
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
}

// --- 3. UI: GRID & VİDEO YÖNETİMİ ---
function addVideoStream(id, stream, name, isLocal) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = `video-${id}`;

    // Video
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if(isLocal) video.muted = true;

    // YENİ: BÜYÜTME (FULLSCREEN) BUTONU
    const expandBtn = document.createElement('button');
    expandBtn.className = 'btn-expand';
    expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    expandBtn.onclick = () => toggleFullscreenCard(card, expandBtn);

    // İsim Etiketi
    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerHTML = `<i class="fa-solid fa-user"></i> <span id="name-${id}">${name}</span>`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'avatar-overlay';
    avatar.innerHTML = `<div class="avatar-circle">${name.charAt(0).toUpperCase()}</div>`;

    card.appendChild(video);
    card.appendChild(expandBtn); // Butonu ekle
    card.appendChild(nameTag);
    card.appendChild(avatar);
    videoGrid.appendChild(card);

    document.getElementById('connect-panel').classList.add('hidden');
    document.getElementById('call-panel').classList.remove('hidden');

    monitorVideoState(stream, card);
}

// Kartı Tam Ekran Yapma Mantığı
function toggleFullscreenCard(card, btn) {
    if (!document.fullscreenElement) {
        card.requestFullscreen().catch(err => {
            alert(`Hata: ${err.message}`);
        });
        btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
        document.exitFullscreen();
        btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
}

function updateNameTag(id, newName) {
    const el = document.getElementById(`name-${id}`);
    if(el) {
        el.innerText = newName;
        const card = document.getElementById(`video-${id}`);
        card.querySelector('.avatar-circle').innerText = newName.charAt(0).toUpperCase();
    }
}

// --- 4. AYARLAR VE CİHAZ YÖNETİMİ ---

async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const aInput = document.getElementById('audio-input-select');
    const vInput = document.getElementById('video-input-select');
    const aOutput = document.getElementById('audio-output-select'); // Çıkış Cihazı
    
    aInput.innerHTML = ""; vInput.innerHTML = ""; aOutput.innerHTML = "";

    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.innerText = d.label || `${d.kind} (${d.deviceId.slice(0,5)}...)`;
        
        if(d.kind === 'audioinput') aInput.appendChild(opt);
        else if(d.kind === 'videoinput') vInput.appendChild(opt);
        // YENİ: Audio Output ekleme
        else if(d.kind === 'audiooutput') aOutput.appendChild(opt);
    });

    // Eğer Audio Output bulunamadıysa (Firefox/Safari) uyarı veya gizleme yapılabilir
    if(aOutput.options.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = "Tarayıcı tarafından desteklenmiyor veya cihaz yok";
        aOutput.appendChild(opt);
        aOutput.disabled = true;
    }
}

// YENİ: Hoparlör Değiştirme (Çıkış Cihazı)
async function changeAudioOutput() {
    const deviceId = document.getElementById('audio-output-select').value;
    const videos = document.querySelectorAll('video');
    
    for (const video of videos) {
        if ('setSinkId' in video) {
            try {
                await video.setSinkId(deviceId);
                console.log(`Ses çıkışı ${deviceId} olarak ayarlandı.`);
            } catch (error) {
                console.error('Ses çıkışı değiştirilemedi:', error);
            }
        }
    }
}

function changeOutputVolume(val) {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if(!v.muted) v.volume = val; 
    });
}

function changeMicGain(val) {
    const sliderVal = parseFloat(val);
    let finalGain = 1.0;
    if (sliderVal > 0) finalGain = 1.0 + sliderVal; 
    else finalGain = 1.0 + sliderVal;
    if (gainNode) gainNode.gain.value = finalGain;
}

// --- 5. YARDIMCI UI FONKSİYONLARI ---
function updateParticipants() {
    participantList.innerHTML = "";
    addParticipantRow(myUsername + " (Sen)", true);
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

function monitorVideoState(stream, card) {
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
    const track = localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    const btn = document.getElementById('camera-btn');
    const icon = document.getElementById('camera-icon');
    if(track.enabled) {
        btn.classList.remove('btn-secondary'); 
        btn.classList.remove('btn-off');
        icon.classList.replace('fa-video-slash', 'fa-video');
    } else {
        btn.classList.add('btn-secondary');
        btn.classList.add('btn-off');
        icon.classList.replace('fa-video', 'fa-video-slash');
    }
}

function endCall() {
    Object.keys(peers).forEach(key => peers[key].call.close());
    window.location.reload();
}

function toggleParticipants() { document.getElementById('participants-panel').classList.toggle('open'); }
function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); }
function copyId() {
    navigator.clipboard.writeText(document.getElementById('my-id').innerText);
    const fb = document.getElementById('copy-feedback');
    fb.style.opacity = '1';
    setTimeout(() => fb.style.opacity = '0', 1000);
}

let seconds = 0;
setInterval(() => {
    seconds++;
    const m = Math.floor(seconds/60).toString().padStart(2,'0');
    const s = (seconds%60).toString().padStart(2,'0');
    document.getElementById('call-timer').innerText = `${m}:${s}`;
}, 1000);