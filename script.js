// script.js

(function () {
  const client_id = 'cde3eaa90edd4d8893a89046e3056912';
  const redirect_uri = 'https://arlenea12.github.io/ITWaitingRoom/';
  const scopes = 'user-modify-playback-state user-read-playback-state';

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

  let token = localStorage.getItem('spotify_access_token');
  if (!token) token = getAccessTokenFromUrl();
  if (!token) {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.replace(authUrl);
  } else {
    console.log('Spotify access token found:', token);
  }
})();

let currentDeviceId = null;
let isShuffling = false;
let isPaused = false;
let player;

window.onSpotifyWebPlaybackSDKReady = () => {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) return console.error('Spotify access token not found');

  player = new Spotify.Player({
    name: 'IT Waiting Room Player',
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    currentDeviceId = device_id;
    console.log('Ready with Device ID', device_id);

    // Playback transfer only (no autoplay)
    fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_ids: [device_id], play: false })
    })
      .then(() => {
        console.log('Playback transferred to Web SDK');
      })
      .catch(err => console.error('Playback transfer error:', err));
  });

  player.addListener('player_state_changed', state => {
    if (!state) return;
    const currentTrack = state.track_window.current_track;

    const trackName = document.getElementById('trackName');
    const artistName = document.getElementById('artistName');
    const albumArt = document.getElementById('albumArt');

    // Add fade animation
    trackName.classList.add('fade-out');
    artistName.classList.add('fade-out');
    albumArt.classList.add('fade-out');

    setTimeout(() => {
      trackName.textContent = currentTrack.name;
      artistName.textContent = currentTrack.artists.map(artist => artist.name).join(', ');
      albumArt.src = currentTrack.album.images[0].url;

      trackName.classList.remove('fade-out');
      artistName.classList.remove('fade-out');
      albumArt.classList.remove('fade-out');
    }, 300);

    isPaused = state.paused;
    document.getElementById('playPauseButton').textContent = isPaused ? 'Play' : 'Pause';
  });

  player.connect();
};

// Button & Volume Handlers
document.addEventListener('DOMContentLoaded', () => {
  const shuffleBtn = document.getElementById('shuffleButton');
  const playPauseBtn = document.getElementById('playPauseButton');
  const volumeSlider = document.getElementById('volumeControl');

  shuffleBtn.addEventListener('click', () => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token || !currentDeviceId) return;
    isShuffling = !isShuffling;
    fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${isShuffling}&device_id=${currentDeviceId}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(() => {
      shuffleBtn.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';
    });
  });

  playPauseBtn.addEventListener('click', () => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token || !currentDeviceId) return;

    if (isPaused) {
      fetch(`https://api.spotify.com/v1/me/player/play?device_id=${currentDeviceId}`, {
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
    } else {
      fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    }
  });

  volumeSlider.addEventListener('input', (e) => {
    const volume = parseInt(e.target.value) / 100;
    if (player) {
      player.setVolume(volume).then(() => console.log('Volume set to', volume));
    }
  });
});
