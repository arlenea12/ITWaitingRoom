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

    // Transfer playback and auto-start
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

      // Now auto-start the playlist
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
    .then(() => {
      console.log('Playlist started!');
    })
    .catch(err => console.error('Error setting up playback:', err));
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


  let repeatState = 'off';

  nextBtn.addEventListener('click', () => {
    player.nextTrack().then(() => console.log('Skipped to next track'));
  });

  prevBtn.addEventListener('click', () => {
    player.previousTrack().then(() => console.log('Went to previous track'));
  });

  repeatBtn.addEventListener('click', () => {
    if (!token) return;
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

  player.addListener('player_state_changed', state => {
    if (!state) return;
    const position = state.position;
    const duration = state.duration;
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.value = (position / duration) * 100;
    }
  });

  document.getElementById('progressBar').addEventListener('input', (e) => {
    const newPosition = (e.target.value / 100) * player._options.duration;
    player.seek(newPosition).then(() => {
      console.log('Seeked to position', newPosition);
    });
  });


  volumeSlider.addEventListener('input', (e) => {
    const volume = parseInt(e.target.value) / 100;
    if (player) {
      player.setVolume(volume).then(() => console.log('Volume set to', volume));
    }
  });
});
