// Music Player Management
let youtubePlayer = null;
let spotifyPlayer = null;
let spotifyDeviceId = null;
let currentSong = null;
let isPlaying = false;

// Spotify Token (placeholder - replace with actual token)
const spotifyToken = "PUT_TOKEN_HERE";

// YouTube IFrame API
let youtubeAPIReady = false;

// Wait for YouTube API to load
window.onYouTubeIframeAPIReady = function() {
    youtubeAPIReady = true;
    console.log('YouTube API ready');
};

// Initialize Spotify SDK
function initSpotify() {
    if (typeof Spotify === 'undefined') {
        console.warn('Spotify Web Playback SDK not loaded');
        return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
        spotifyPlayer = new Spotify.Player({
            name: 'PasamCord Music Bot',
            getOAuthToken: cb => { cb(spotifyToken); },
            volume: 0.5
        });

        // Error handling
        spotifyPlayer.addListener('initialization_error', ({ message }) => {
            console.error('Spotify initialization error:', message);
            if (message.includes('Premium')) {
                console.warn('Spotify Premium required. This is expected if no valid token is provided.');
            }
        });

        spotifyPlayer.addListener('authentication_error', ({ message }) => {
            console.error('Spotify authentication error:', message);
        });

        spotifyPlayer.addListener('account_error', ({ message }) => {
            console.error('Spotify account error:', message);
        });

        // Ready
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            console.log('Spotify player ready with device ID:', device_id);
            spotifyDeviceId = device_id;
        });

        // Playback state changes
        spotifyPlayer.addListener('player_state_changed', (state) => {
            if (!state) return;
            
            // Check if song ended
            if (state.paused && !state.position && state.track_window.current_track) {
                // Song might have ended, but we'll rely on the ended event
            }
        });

        // Not ready
        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
            console.log('Spotify device has gone offline:', device_id);
        });

        spotifyPlayer.connect();
    };
}

// Initialize Spotify when SDK loads
if (typeof Spotify !== 'undefined') {
    initSpotify();
} else {
    // Load Spotify SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onload = initSpotify;
    document.head.appendChild(script);
}

// Play content based on source
window.playContent = function(content) {
    if (!content || !content.source) {
        stopPlayback();
        return;
    }

    currentSong = content;
    isPlaying = true;

    // Hide both players first
    const youtubeContainer = document.getElementById('youtube-player');
    const spotifyContainer = document.getElementById('spotify-player');
    youtubeContainer.style.display = 'none';
    spotifyContainer.style.display = 'none';

    if (content.source === 'youtube') {
        playYouTube(content.id, content.title);
    } else if (content.source === 'spotify') {
        playSpotify(content.id, content.title);
    }

    // Update UI
    updateCurrentSongUI(content);
}

// Play YouTube video
function playYouTube(videoId, title) {
    const container = document.getElementById('youtube-player');
    container.style.display = 'block';
    container.innerHTML = '';

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'youtube-iframe';
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&controls=1&modestbranding=1&rel=0`;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    container.appendChild(iframe);

    // Use YouTube IFrame API if available
    if (typeof YT !== 'undefined' && YT.Player) {
        if (youtubePlayer) {
            try {
                youtubePlayer.destroy();
            } catch (e) {
                console.error('Error destroying YouTube player:', e);
            }
        }
        
        // Wait a bit for iframe to be ready
        setTimeout(() => {
            try {
                youtubePlayer = new YT.Player('youtube-iframe', {
                    events: {
                        'onStateChange': onYouTubeStateChange
                    }
                });
            } catch (e) {
                console.error('Error creating YouTube player:', e);
            }
        }, 500);
    } else {
        // Fallback: Listen for iframe messages
        window.addEventListener('message', handleYouTubeMessage);
        // Set up end detection (fallback method)
        setTimeout(() => {
            checkYouTubeEnd();
        }, 1000);
    }
}

// Handle YouTube state changes
function onYouTubeStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        handleSongEnd();
    }
}

// Handle YouTube iframe messages
function handleYouTubeMessage(event) {
    if (event.origin !== 'https://www.youtube.com') return;
    // YouTube iframe API messages
}

// Check if YouTube video ended (fallback)
let youtubeCheckInterval = null;
function checkYouTubeEnd() {
    if (youtubeCheckInterval) {
        clearInterval(youtubeCheckInterval);
    }

    youtubeCheckInterval = setInterval(() => {
        const iframe = document.getElementById('youtube-iframe');
        if (!iframe) {
            clearInterval(youtubeCheckInterval);
            return;
        }

        // Try to get player state via postMessage (limited functionality)
        // For a more robust solution, we'd need the full YouTube API
        // This is a simplified version
    }, 5000);
}

// Play Spotify track
async function playSpotify(trackId, title) {
    const container = document.getElementById('spotify-player');
    container.style.display = 'block';
    container.innerHTML = '';

    if (!spotifyPlayer || !spotifyDeviceId) {
        console.error('Spotify player not ready');
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Spotify player not ready. Please ensure you have a valid Spotify Premium token.</p>';
        return;
    }

    try {
        // Play track using Spotify Web API
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${spotifyToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [`spotify:track:${trackId}`]
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('Spotify authentication failed. Please check your token.');
                container.innerHTML = '<p style="color: var(--danger); padding: 1rem;">Spotify authentication failed. Please check your token.</p>';
            } else if (response.status === 403) {
                console.warn('Spotify Premium required');
                container.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Spotify Premium required. This is expected if no valid token is provided.</p>';
            } else {
                console.error('Spotify playback error:', response.statusText);
                container.innerHTML = `<p style="color: var(--danger); padding: 1rem;">Error playing Spotify track: ${response.statusText}</p>`;
            }
            return;
        }

        // Listen for playback end
        spotifyPlayer.addListener('player_state_changed', handleSpotifyStateChange);

    } catch (error) {
        console.error('Error playing Spotify track:', error);
        container.innerHTML = `<p style="color: var(--danger); padding: 1rem;">Error: ${error.message}</p>`;
    }
}

// Handle Spotify state changes
function handleSpotifyStateChange(state) {
    if (!state) return;
    
    // Check if track ended
    if (state.paused && state.position === 0 && !state.track_window.next_tracks.length) {
        // Track might have ended
        // We'll use a timeout to check
        setTimeout(() => {
            spotifyPlayer.getCurrentState().then(state => {
                if (!state || (state.paused && state.position === 0)) {
                    handleSongEnd();
                }
            });
        }, 1000);
    }
}

// Handle song end
function handleSongEnd() {
    if (!isPlaying) return;
    
    isPlaying = false;
    // Get socket from global scope (defined in script.js)
    if (window.socket) {
        window.socket.emit('song-ended');
    } else {
        console.error('Socket not available');
    }
}

// Stop playback
window.stopPlayback = function() {
    isPlaying = false;
    currentSong = null;

    // Stop YouTube
    if (youtubePlayer) {
        try {
            youtubePlayer.stopVideo();
            youtubePlayer.destroy();
            youtubePlayer = null;
        } catch (e) {
            console.error('Error stopping YouTube player:', e);
        }
    }
    
    const youtubeContainer = document.getElementById('youtube-player');
    youtubeContainer.style.display = 'none';
    youtubeContainer.innerHTML = '';

    // Stop Spotify
    if (spotifyPlayer) {
        spotifyPlayer.pause().catch(err => {
            console.error('Error pausing Spotify:', err);
        });
    }
    
    const spotifyContainer = document.getElementById('spotify-player');
    spotifyContainer.style.display = 'none';
    spotifyContainer.innerHTML = '';

    // Clear intervals
    if (youtubeCheckInterval) {
        clearInterval(youtubeCheckInterval);
        youtubeCheckInterval = null;
    }

    // Update UI
    document.getElementById('currentSong').style.display = 'none';
}

// Update current song UI
function updateCurrentSongUI(song) {
    const currentSongDiv = document.getElementById('currentSong');
    const currentSongTitle = document.getElementById('currentSongTitle');
    const currentSongAddedBy = document.getElementById('currentSongAddedBy');

    currentSongTitle.textContent = song.title || 'Unknown';
    currentSongAddedBy.textContent = `Added by ${song.addedBy || 'Unknown'}`;
    currentSongDiv.style.display = 'block';
}

// Update queue UI
window.updateQueueUI = function(queue) {
    const queueList = document.getElementById('queueList');
    queueList.innerHTML = '';

    if (!queue || queue.length === 0) {
        queueList.innerHTML = '<p class="empty-queue">Queue is empty</p>';
        return;
    }

    queue.forEach((song, index) => {
        const queueItem = document.createElement('div');
        queueItem.className = 'queue-item';
        
        const itemInfo = document.createElement('div');
        itemInfo.className = 'queue-item-info';
        
        const itemTitle = document.createElement('div');
        itemTitle.className = 'queue-item-title';
        itemTitle.textContent = song.title || 'Unknown';
        
        const itemMeta = document.createElement('div');
        itemMeta.className = 'queue-item-meta';
        itemMeta.textContent = `${song.source.toUpperCase()} • Added by ${song.addedBy || 'Unknown'}`;
        
        itemInfo.appendChild(itemTitle);
        itemInfo.appendChild(itemMeta);
        queueItem.appendChild(itemInfo);
        
        queueList.appendChild(queueItem);
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPlayback();
    if (spotifyPlayer) {
        spotifyPlayer.disconnect();
    }
});

