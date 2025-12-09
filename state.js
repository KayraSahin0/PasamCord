export const state = {
    // --- KULLANICI ---
    myUsername: "Misafir",
    userProfile: null, // Google profil bilgileri

    // --- MEDYA AKIŞLARI ---
    localStream: null,
    localScreenStream: null,
    
    // --- AĞ VE BAĞLANTI ---
    peer: null,
    peers: {}, 
    participantList: [],
    lastHeartbeat: {}, 
    connectionStartTime: null, // Oda süresi sayacı için

    // --- SES MOTORU (AUDIO CONTEXT) ---
    audioContext: null,
    gainNode: null,
    micSource: null,
    audioDestination: null,

    // --- DURUM BAYRAKLARI (FLAGS) ---
    isMuted: false,
    isCameraOff: true,   // Başlangıçta kapalı
    isDeafened: false,   // Sağırlaştır (Hoparlör kapat)
    isScreenSharing: false,
    isMirrored: true,    // Ayna modu

    // --- AYARLAR ---
    videoResolution: 1280, // Varsayılan HD Ready
    videoFPS: 30,

    // --- YOUTUBE ---
    youtubePlayer: null,
    isYoutubeOpen: false,

    // --- SPOTIFY ---
    spotifyToken: null,
    spotifyPlayer: null,
    spotifyDeviceId: null,
    isSpotifyReady: false,
    currentTrackUri: null,
    spotifyQueue: [],

    // Uygulama, Websitesi EKLEME
    isAdmin: false,
    apps: [] // Uygulama listesi
};