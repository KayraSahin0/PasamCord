export const state = {
    myUsername: "Misafir",
    localStream: null,
    localScreenStream: null,
    peer: null,
    peers: {}, 
    
    // Katılımcı Senkronizasyonu
    participantList: [],

    // Audio Context
    audioContext: null,
    gainNode: null,
    micSource: null,
    audioDestination: null,

    // Durumlar
    isMuted: false,
    isCameraOff: true,  // Varsayılan KAPALI
    isDeafened: false,
    isScreenSharing: false
};