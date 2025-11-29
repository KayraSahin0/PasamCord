import { state } from './state.js';
import { updateMyId, addVideoCard, removeVideoCard, updateParticipantsUI, updateNameTag, showCallScreen } from './ui.js';

export function initPeer() {
    // ID oluştur ve Peer'i başlat
    const myId = Math.random().toString(36).substr(2, 5).toUpperCase();
    state.peer = new Peer(myId);

    state.peer.on('open', (id) => {
        updateMyId(id);
        // Listeye kendimizi ekleyelim
        state.participantList = [{ id: id, name: state.myUsername, isMe: true }];
        updateParticipantsUI();
    });

    // GELEN ARAMA (Video/Ses)
    state.peer.on('call', (call) => {
        // Gelen aramayı cevapla ve kendi yayınımızı gönder
        call.answer(state.localStream);
        handleCall(call);
    });

    // GELEN VERİ BAĞLANTISI (İsim, Liste vb.)
    state.peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });
}

// Birine bağlanma fonksiyonu (Hem Host'a hem diğerlerine bağlanmak için kullanılır)
export function connectToPeer(remoteId) {
    if (!remoteId) { alert("ID Giriniz!"); return; }
    if (state.peers[remoteId]) return; // Zaten bağlıysak tekrar bağlanma

    // 1. Video Araması Yap
    const call = state.peer.call(remoteId, state.localStream);
    
    // 2. Veri Bağlantısı Kur
    const conn = state.peer.connect(remoteId);
    
    // Bağlantı kurulunca yapılacaklar
    setupDataConnection(conn);
    handleCall(call, conn);
}

// Veri bağlantısı ayarları
function setupDataConnection(conn) {
    conn.on('open', () => {
        // Bağlanır bağlanmaz ismimizi gönderelim
        conn.send({ type: 'name', name: state.myUsername });

        // --- MESH LOGIC (HOST TARAFI) ---
        // Eğer biz Host isek (veya odada eskiden beri varsak), 
        // yeni gelene odadaki diğer kişilerin ID listesini gönderelim.
        if (Object.keys(state.peers).length > 0) {
            const connectedPeers = Object.keys(state.peers);
            conn.send({ type: 'mesh-peers', peers: connectedPeers });
        }
    });

    conn.on('data', (data) => {
        // A. İsim Güncellemesi
        if (data.type === 'name') {
            if (state.peers[conn.peer]) {
                state.peers[conn.peer].name = data.name;
                updateNameTag(conn.peer, data.name);
                broadcastParticipants(); // Listeyi güncelle ve yay
            }
        }

        // B. Katılımcı Listesi Güncellemesi (UI İçin)
        if (data.type === 'update-participants') {
            state.participantList = data.list;
            updateParticipantsUI();
        }

        // --- C. MESH LOGIC (CLIENT TARAFI) ---
        // Yeni bir odaya girdiğimizde, Host bize "Burada bunlar var" diye liste atar.
        // Biz de o listeyi dönüp herkese tek tek bağlanırız.
        if (data.type === 'mesh-peers') {
            data.peers.forEach(peerId => {
                // Kendimize veya zaten bağlı olduğumuz kişiye tekrar bağlanmayalım
                if (peerId !== state.peer.id && !state.peers[peerId]) {
                    console.log("Mesh Ağı: Otomatik bağlanılıyor ->", peerId);
                    connectToPeer(peerId);
                }
            });
        }
    });
}

// Çağrı Yönetimi (Ortak)
function handleCall(call, conn = null) {
    const peerId = call.peer;
    showCallScreen();

    // Eğer conn parametresi boş geldiyse (biri bizi aradıysa),
    // biz de ona geri veri bağlantısı açalım ki karşılıklı konuşabilelim.
    if (!conn) {
        const backConn = state.peer.connect(peerId);
        backConn.on('open', () => {
            backConn.send({ type: 'name', name: state.myUsername });
        });
        // Onu dinlemeye başla
        setupDataConnection(backConn); 
    }

    // Listeye ekle
    state.peers[peerId] = { call: call, name: "Bağlanıyor...", id: peerId, conn: conn };
    
    // UI Güncelle
    broadcastParticipants();

    // Video akışı geldiğinde
    call.on('stream', (remoteStream) => {
        addVideoCard(peerId, remoteStream, state.peers[peerId].name, false);
    });

    // Bağlantı koparsa
    call.on('close', () => removePeer(peerId));
    call.on('error', () => removePeer(peerId));
}

function removePeer(peerId) {
    if (state.peers[peerId]) delete state.peers[peerId];
    removeVideoCard(peerId);
    broadcastParticipants();
}

// Listeyi herkese yayma fonksiyonu
function broadcastParticipants() {
    // Liste oluştur
    const list = [];
    list.push({ id: state.peer.id, name: state.myUsername, isMe: false }); // Kendimiz
    
    Object.values(state.peers).forEach(p => {
        list.push({ id: p.id, name: p.name });
    });

    // Kendi UI'mızı güncelle
    state.participantList = list.map(u => ({...u, isMe: u.id === state.peer.id}));
    updateParticipantsUI();

    // Diğerlerine gönder
    Object.values(state.peers).forEach(p => {
        if (p.conn && p.conn.open) {
            p.conn.send({ type: 'update-participants', list: list });
        }
    });
}

export function closeAllConnections() {
    Object.keys(state.peers).forEach(k => state.peers[k].call.close());
}