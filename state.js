export const state = {
    myUsername: "Misafir",
    localStream: null,
    peer: null,
    peers: {}, 
    
    // YENİ: Tüm odadaki kişilerin senkronize listesi
    participantList: [],

    // Audio Context
    audioContext: null,
    gainNode: null,
    micSource: null,
    audioDestination: null,

    // Durumlar
    isMuted: false,
    isCameraOff: true,
    isDeafened: false
};