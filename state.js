// state.js
export const state = {
    myUsername: "Misafir",
    localStream: null,
    peer: null,
    peers: {}, // Bağlı olan diğer kullanıcılar
    
    // Audio Context Elemanları
    audioContext: null,
    gainNode: null,
    micSource: null,
    audioDestination: null,

    // Durumlar
    isMuted: false,
    isCameraOff: true // Varsayılan olarak kamera kapalı
};