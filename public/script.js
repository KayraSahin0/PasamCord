// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const roomId = urlParams.get('roomId');

// Initialize Socket.io
const socket = io();
window.socket = socket; // Make available globally for music.js

// PeerJS setup
let peer;
let localStream;
let peers = {}; // peerId -> peer connection
let isMuted = false;
let isVideoOff = false;
let isScreenSharing = false;

// DOM elements
const videoGrid = document.getElementById('videoGrid');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const musicRequestBtn = document.getElementById('musicRequestBtn');
const musicModal = document.getElementById('musicModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!username || !roomId) {
        window.location.href = '/';
        return;
    }

    roomIdDisplay.textContent = roomId;
    roomIdDisplay.addEventListener('click', copyRoomId);

    // Initialize PeerJS
    peer = new Peer(undefined, {
        host: '/',
        path: '/peerjs',
        port: window.location.port || 3000
    });

    peer.on('open', (peerId) => {
        console.log('Peer ID:', peerId);
        // Store peer ID globally
        window.myPeerId = peerId;
        
        // Send peer ID to server after joining room
        socket.once('room-joined', () => {
            setTimeout(() => {
                socket.emit('peer-id', { peerId });
            }, 500); // Small delay to ensure room is fully set up
        });
        
        // Join room
        socket.emit('join-room', { username, roomId, isNewRoom: false });
    });

    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            addVideoStream(stream, username, true);
            setupMediaControls();

            // Listen for new users
            socket.on('user-joined', ({ socketId, username: newUsername, peerId }) => {
                console.log('User joined:', newUsername, 'Peer ID:', peerId);
                // Wait for peer ID if not available yet
                if (peerId) {
                    connectToNewUser(peerId, newUsername, socketId);
                }
            });

            socket.on('user-left', ({ socketId }) => {
                console.log('User left:', socketId);
                if (peers[socketId]) {
                    peers[socketId].close();
                    delete peers[socketId];
                }
                removeVideoElement(socketId);
            });
        })
        .catch(err => {
            console.error('Error accessing media devices:', err);
            alert('Error accessing camera/microphone. Please check permissions.');
        });

    // PeerJS connection handling
    peer.on('call', (call) => {
        console.log('Incoming call from:', call.peer);
        call.answer(localStream);

        call.on('stream', (userVideoStream) => {
            const socketId = call.metadata?.socketId;
            const remoteUsername = call.metadata?.username || 'Unknown';
            console.log('Received stream from:', remoteUsername, socketId);
            addVideoStream(userVideoStream, remoteUsername, false, socketId);
        });

        call.on('error', (err) => {
            console.error('Call error:', err);
        });
    });

    // Socket events
    socket.on('room-joined', (data) => {
        console.log('Room joined:', data);
        // Connect to existing users (wait for their peer IDs)
        data.users.forEach(user => {
            if (user.socketId !== socket.id && user.peerId) {
                connectToNewUser(user.peerId, user.username, user.socketId);
            }
        });

        // Load chat history
        if (data.messages) {
            data.messages.forEach(msg => {
                addChatMessage(msg.username, msg.message);
            });
        }

        // Load music queue
        if (data.currentSong) {
            window.playContent(data.currentSong);
        }
        if (data.queue && data.queue.length > 0) {
            window.updateQueueUI(data.queue);
        }
    });

    // Handle peer ID received from other users
    socket.on('peer-id-received', ({ socketId, peerId, username }) => {
        console.log('Peer ID received:', socketId, peerId, username);
        // Connect to this user if we haven't already
        if (peerId && !peers[socketId] && socketId !== socket.id) {
            connectToNewUser(peerId, username || 'User', socketId);
        }
    });

    socket.on('chat-message', ({ username: msgUsername, message }) => {
        addChatMessage(msgUsername, message);
    });

    socket.on('play-song', (song) => {
        if (song) {
            window.playContent(song);
        } else {
            window.stopPlayback();
        }
    });

    socket.on('update-queue', ({ queue }) => {
        window.updateQueueUI(queue);
    });

    socket.on('queue-empty', () => {
        window.stopPlayback();
        window.updateQueueUI([]);
    });

    socket.on('error', ({ message }) => {
        alert(message);
        window.location.href = '/';
    });

    // Chat handlers
    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Music modal handlers
    musicRequestBtn.addEventListener('click', () => {
        musicModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => {
        musicModal.classList.remove('active');
    });

    musicModal.addEventListener('click', (e) => {
        if (e.target === musicModal) {
            musicModal.classList.remove('active');
        }
    });

    // Leave room
    leaveRoomBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the room?')) {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            Object.values(peers).forEach(peer => peer.close());
            socket.disconnect();
            peer.destroy();
            window.location.href = '/';
        }
    });
});

// Track video containers to avoid duplicates
const videoContainersMap = new Map();

// Add video stream to grid
function addVideoStream(stream, label, isLocal, socketId = null) {
    const containerId = socketId || (isLocal ? 'local' : 'unknown');
    
    // Remove existing container if present
    const existingContainer = document.getElementById(`video-${containerId}`);
    if (existingContainer) {
        existingContainer.remove();
    }

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${containerId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) {
        video.muted = true;
    }

    const labelDiv = document.createElement('div');
    labelDiv.className = 'video-label';
    labelDiv.textContent = label + (isLocal ? ' (Sen)' : '');

    videoContainer.appendChild(video);
    videoContainer.appendChild(labelDiv);
    videoGrid.appendChild(videoContainer);

    // Store in map
    videoContainersMap.set(containerId, videoContainer);

    // Update grid layout based on number of videos
    updateVideoGrid();
}

// Update video grid layout
function updateVideoGrid() {
    const containers = videoGrid.querySelectorAll('.video-container');
    const count = containers.length;
    
    // Remove grid class modifications, let CSS handle it
    videoGrid.className = 'video-grid';
    
    // Ensure we don't exceed 4 videos
    if (count > 4) {
        for (let i = 4; i < count; i++) {
            containers[i].remove();
        }
    }
}

// Remove video element
function removeVideoElement(socketId) {
    const containerId = socketId || 'unknown';
    const videoElement = document.getElementById(`video-${containerId}`);
    if (videoElement) {
        videoElement.remove();
        videoContainersMap.delete(containerId);
    }
    updateVideoGrid();
}

// Connect to new user
function connectToNewUser(peerId, remoteUsername, socketId) {
    console.log('Connecting to:', peerId, remoteUsername, socketId);
    
    if (!localStream) {
        console.error('Local stream not available');
        return;
    }

    // Check if already connected
    if (peers[socketId]) {
        console.log('Already connected to', socketId);
        return;
    }

    const call = peer.call(peerId, localStream, {
        metadata: { socketId: socket.id, username }
    });

    if (!call) {
        console.error('Failed to create call');
        return;
    }

    call.on('stream', (userVideoStream) => {
        console.log('Received stream from peer:', peerId);
        addVideoStream(userVideoStream, remoteUsername, false, socketId);
    });

    call.on('error', (err) => {
        console.error('Call error:', err);
        delete peers[socketId];
    });

    call.on('close', () => {
        console.log('Call closed:', socketId);
        removeVideoElement(socketId);
        delete peers[socketId];
    });

    peers[socketId] = call;
}

// Media controls
function setupMediaControls() {
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteBtn.classList.toggle('active', isMuted);
        muteBtn.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
    });

    videoBtn.addEventListener('click', () => {
        isVideoOff = !isVideoOff;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !isVideoOff;
        });
        videoBtn.classList.toggle('active', isVideoOff);
        videoBtn.querySelector('.icon').textContent = isVideoOff ? '📹' : '📷';
    });

    screenShareBtn.addEventListener('click', toggleScreenShare);
}

// Screen sharing
async function toggleScreenShare() {
    try {
        if (!isScreenSharing) {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            
            // Replace video track in all peer connections
            const videoTrack = screenStream.getVideoTracks()[0];
            const localVideoTrack = localStream.getVideoTracks()[0];
            
            Object.values(peers).forEach(peerConnection => {
                const sender = peerConnection.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });

            // Replace local video
            const localVideo = document.querySelector('#video-local video');
            if (localVideo) {
                localVideo.srcObject = new MediaStream([videoTrack, ...localStream.getAudioTracks()]);
            }

            // Update local stream
            localStream.removeTrack(localVideoTrack);
            localStream.addTrack(videoTrack);

            // Handle screen share end
            videoTrack.onended = () => {
                toggleScreenShare();
            };

            isScreenSharing = true;
            screenShareBtn.classList.add('active');
        } else {
            // Stop screen sharing and revert to camera
            const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            const cameraTrack = cameraStream.getVideoTracks()[0];
            const screenTrack = localStream.getVideoTracks().find(track => track.kind === 'video');
            
            Object.values(peers).forEach(peerConnection => {
                const sender = peerConnection.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    sender.replaceTrack(cameraTrack);
                }
            });

            // Replace local video
            const localVideo = document.querySelector('#video-local video');
            if (localVideo) {
                localVideo.srcObject = new MediaStream([cameraTrack, ...localStream.getAudioTracks()]);
            }

            // Update local stream
            if (screenTrack) {
                localStream.removeTrack(screenTrack);
            }
            localStream.addTrack(cameraTrack);
            screenTrack?.stop();

            isScreenSharing = false;
            screenShareBtn.classList.remove('active');
        }
    } catch (err) {
        console.error('Error toggling screen share:', err);
        alert('Error sharing screen. Please try again.');
    }
}

// Chat functions
function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chat-message', { message });
        chatInput.value = '';
    }
}

function addChatMessage(username, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'chat-message-username';
    usernameDiv.textContent = username;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'chat-message-text';
    textDiv.textContent = message;
    
    messageDiv.appendChild(usernameDiv);
    messageDiv.appendChild(textDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Copy room ID
function copyRoomId() {
    navigator.clipboard.writeText(roomId).then(() => {
        const originalText = roomIdDisplay.textContent;
        roomIdDisplay.textContent = 'Copied!';
        setTimeout(() => {
            roomIdDisplay.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Music request handlers (defined in music.js but called from here)
document.getElementById('submitMusicBtn').addEventListener('click', () => {
    const songInput = document.getElementById('songInput');
    const selectedSource = document.querySelector('.btn-source.selected');
    
    if (!songInput.value.trim()) {
        alert('Please enter a song name or URL');
        return;
    }
    
    if (!selectedSource) {
        alert('Please select a source (YouTube or Spotify)');
        return;
    }
    
    const source = selectedSource.dataset.source;
    const songValue = songInput.value.trim();
    
    // Extract ID from URL or use as-is
    let songId = songValue;
    let songTitle = songValue;
    
    if (source === 'youtube') {
        // Extract YouTube video ID from URL
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = songValue.match(youtubeRegex);
        if (match) {
            songId = match[1];
            songTitle = songValue; // Could fetch title via API, but keeping simple for now
        }
    } else if (source === 'spotify') {
        // Extract Spotify track ID from URL
        const spotifyRegex = /spotify\.com\/track\/([a-zA-Z0-9]+)/;
        const match = songValue.match(spotifyRegex);
        if (match) {
            songId = match[1];
            songTitle = songValue;
        }
    }
    
    socket.emit('add-song', { source, id: songId, title: songTitle });
    musicModal.classList.remove('active');
    songInput.value = '';
    document.querySelectorAll('.btn-source').forEach(btn => btn.classList.remove('selected'));
});

// Source button selection
document.querySelectorAll('.btn-source').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-source').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

// Skip button
document.getElementById('skipBtn').addEventListener('click', () => {
    socket.emit('skip-song');
});

