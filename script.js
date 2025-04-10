
// =======================
// Spotify Web Player Script
// =======================
// Handles authentication, Web Playback SDK setup, and dynamic controls
(function () {
  const client_id = 'cde3eaa90edd4d8893a89046e3056912';
  const redirect_uri = 'https://arlenea12.github.io/ITWaitingRoom/';
  const scopes = 'streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';

  // Extract access token from URL if redirected from Spotify auth
function getAccessTokenFromUrl() {
    const hash = window.location.hash;
    if (hash) {
      const urlParams = new URLSearchParams(hash.substring(1));
      const token = urlParams.get('access_token');
      if (token) {
        localStorage.setItem('spotify_access_token', token);
      }
      window.location.hash = '';
      return token;
    }
    return null;
  }

  // Get token from localStorage or extract it from URL
let token = localStorage.getItem('spotify_access_token');
  if (!token) token = getAccessTokenFromUrl();

  if (!token) {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.replace(authUrl);
  } else {
    console.log('Spotify access token found:', token);
    initPlayer(token);
  }

  
// =======================
// Main Player Setup
// =======================
function initPlayer(token) {
    let currentDeviceId = null;
    let isShuffling = false;
    let isPaused = false;
    let repeatState = 'off';
    let player;

    // Spotify Web Playback SDK is ready
window.onSpotifyWebPlaybackSDKReady = () => {
      player = new Spotify.Player({
        name: 'IT Waiting Room Player',
        getOAuthToken: cb => cb(token),
        volume: 0.5
      });

      // Player is ready; transfer playback and start playlist
player.addListener('ready', ({ device_id }) => {
        currentDeviceId = device_id;
        console.log('Ready with Device ID', device_id);

        // Transfer and start playback
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [device_id], play: false })
        })
        .then(() => {
          return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              context_uri: 'spotify:playlist:0sXmN2Mjk4xmgeaABkSGAk',
              offset: { position: 0 },
              position_ms: 0
            })
          });
        })
        .then(() => console.log('Playback started!'))
        .catch(err => {
          console.error('Playback setup failed:', err);
          localStorage.removeItem('spotify_access_token');
        });
      });

      // Update UI when track or playback state changes
player.addListener('player_state_changed', state => {
        if (!state) return;
        const currentTrack = state.track_window.current_track;

        document.getElementById('trackName').textContent = currentTrack.name;
        document.getElementById('artistName').textContent = currentTrack.artists.map(a => a.name).join(', ');
        document.getElementById('albumArt').src = currentTrack.album.images[0].url;

        isPaused = state.paused;
        document.getElementById('playPauseButton').textContent = isPaused ? 'Play' : 'Pause';

        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
          progressBar.value = (state.position / state.duration) * 100;
        }
      });

      // Moved DOM manipulation inside SDK ready callback

        const shuffleBtn = document.getElementById('shuffleButton');
        const playPauseBtn = document.getElementById('playPauseButton');
        const volumeSlider = document.getElementById('volumeControl');

        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextButton';
        nextBtn.textContent = 'Next';
        playPauseBtn.insertAdjacentElement('afterend', nextBtn);

        const prevBtn = document.createElement('button');
        prevBtn.id = 'prevButton';
        prevBtn.textContent = 'Previous';
        shuffleBtn.insertAdjacentElement('beforebegin', prevBtn);

        const repeatBtn = document.createElement('button');
        repeatBtn.id = 'repeatButton';
        repeatBtn.textContent = 'Repeat Off';
        volumeSlider.parentElement.appendChild(repeatBtn);

        // Hook up core button listeners after player is ready
        shuffleBtn.addEventListener('click', () => {
          isShuffling = !isShuffling;
          fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${isShuffling}&device_id=${currentDeviceId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(() => {
            shuffleBtn.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';
            console.log("Shuffle toggled:", isShuffling);
          });
        });

        playPauseBtn.addEventListener('click', () => {
          if (isPaused) {
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${currentDeviceId}`, {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
              }
            }).then(() => console.log("Playback resumed"));
          } else {
            fetch('https://api.spotify.com/v1/me/player/pause', {
              method: 'PUT',
              headers: { 'Authorization': 'Bearer ' + token }
            }).then(() => console.log("Playback paused"));
          }
        });

        volumeSlider.addEventListener('input', (e) => {
          const volume = parseInt(e.target.value) / 100;
          player.setVolume(volume).then(() => console.log('Volume set to', volume));
        });
    

        const progressContainer = document.createElement('div');
        progressContainer.style.marginTop = '10px';
        const progress = document.createElement('input');
        progress.type = 'range';
        progress.min = 0;
        progress.max = 100;
        progress.value = 0;
        progress.id = 'progressBar';
        progress.style.width = '100%';
        progressContainer.appendChild(progress);
        document.querySelector('.player-ui').appendChild(progressContainer);

        const connectButton = document.createElement('button');
        connectButton.textContent = 'Connect Player';
        connectButton.style.marginTop = '20px';
        connectButton.onclick = () => {
          player.connect().then(success => {
            if (success) {
              console.log('Player connected!');
            } else {
              console.error('Player failed to connect');
            }
          });
        };
        document.querySelector('.player-ui').appendChild(connectButton);

        shuffleBtn.addEventListener('click', () => {
          isShuffling = !isShuffling;
          fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${isShuffling}&device_id=${currentDeviceId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(() => {
            shuffleBtn.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';
          });
        });

        playPauseBtn.addEventListener('click', () => {
          if (isPaused) {
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${currentDeviceId}`, {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
              }
            });
          } else {
            fetch('https://api.spotify.com/v1/me/player/pause', {
              method: 'PUT',
              headers: { 'Authorization': 'Bearer ' + token }
            });
          }
        });

        nextBtn.addEventListener('click', () => {
          player.nextTrack().then(() => console.log('Skipped to next track'));
        });

        prevBtn.addEventListener('click', () => {
          player.previousTrack().then(() => console.log('Went to previous track'));
        });

        repeatBtn.addEventListener('click', () => {
          if (repeatState === 'off') repeatState = 'context';
          else if (repeatState === 'context') repeatState = 'track';
          else repeatState = 'off';

          fetch('https://api.spotify.com/v1/me/player/repeat?state=' + repeatState + '&device_id=' + currentDeviceId, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(() => {
            repeatBtn.textContent = 'Repeat ' + (repeatState === 'off' ? 'Off' : repeatState.charAt(0).toUpperCase() + repeatState.slice(1));
          });
        });

        volumeSlider.addEventListener('input', (e) => {
          const volume = parseInt(e.target.value) / 100;
          player.setVolume(volume).then(() => console.log('Volume set to', volume));
        });

        progress.addEventListener('input', (e) => {
          const newPosition = (e.target.value / 100) * player._options.duration;
          player.seek(newPosition).then(() => {
            console.log('Seeked to position', newPosition);
          });
        });
      });

      
      document.addEventListener('DOMContentLoaded', () => {
        const shuffleBtn = document.getElementById('shuffleButton');
        const playPauseBtn = document.getElementById('playPauseButton');
        const volumeSlider = document.getElementById('volumeControl');

        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextButton';
        nextBtn.textContent = 'Next';
        playPauseBtn.insertAdjacentElement('afterend', nextBtn);

        const prevBtn = document.createElement('button');
        prevBtn.id = 'prevButton';
        prevBtn.textContent = 'Previous';
        shuffleBtn.insertAdjacentElement('beforebegin', prevBtn);

        const repeatBtn = document.createElement('button');
        repeatBtn.id = 'repeatButton';
        repeatBtn.textContent = 'Repeat Off';
        volumeSlider.parentElement.appendChild(repeatBtn);

        // Hook up core button listeners after player is ready
        shuffleBtn.addEventListener('click', () => {
          isShuffling = !isShuffling;
          fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${isShuffling}&device_id=${currentDeviceId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(() => {
            shuffleBtn.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';
            console.log("Shuffle toggled:", isShuffling);
          });
        });

        playPauseBtn.addEventListener('click', () => {
          if (isPaused) {
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${currentDeviceId}`, {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
              }
            }).then(() => console.log("Playback resumed"));
          } else {
            fetch('https://api.spotify.com/v1/me/player/pause', {
              method: 'PUT',
              headers: { 'Authorization': 'Bearer ' + token }
            }).then(() => console.log("Playback paused"));
          }
        });

        volumeSlider.addEventListener('input', (e) => {
          const volume = parseInt(e.target.value) / 100;
          player.setVolume(volume).then(() => console.log('Volume set to', volume));
        });
    

        const progressContainer = document.createElement('div');
        progressContainer.style.marginTop = '10px';
        const progress = document.createElement('input');
        progress.type = 'range';
        progress.min = 0;
        progress.max = 100;
        progress.value = 0;
        progress.id = 'progressBar';
        progress.style.width = '100%';
        progressContainer.appendChild(progress);
        document.querySelector('.player-ui').appendChild(progressContainer);

        const connectButton = document.createElement('button');
        connectButton.textContent = 'Connect Player';
        connectButton.style.marginTop = '20px';
        connectButton.onclick = () => {
          player.connect().then(success => {
            if (success) {
              console.log('Player connected!');
            } else {
              console.error('Player failed to connect');
            }
          });
        };
        document.querySelector('.player-ui').appendChild(connectButton);

      });

      // Connect the player to Spotify
player.connect();
    };
  }
})();
