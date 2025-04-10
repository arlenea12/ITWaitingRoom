// =======================
// Spotify Web Player Script
// =======================
(function () {
  const client_id = 'cde3eaa90edd4d8893a89046e3056912';
  const redirect_uri = 'https://arlenea12.github.io/ITWaitingRoom/';
  const scopes = 'streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';

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
    console.log('✅ Spotify access token found');
    initPlayer(token);
  }

  function initPlayer(token) {
    let currentDeviceId = null;
    let isShuffling = false;
    let isPaused = false;
    let repeatState = 'off';
    let player;

    window.onSpotifyWebPlaybackSDKReady = () => {
      player = new Spotify.Player({
        name: 'IT Waiting Room Player',
        getOAuthToken: cb => cb(token),
        volume: 0.5
      });

      player.addListener('ready', ({ device_id }) => {
        currentDeviceId = device_id;
        console.log('✅ Ready with Device ID', device_id);

        // Transfer playback to this device
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [device_id], play: true })
        })
        .then(() => {
          const playlistId = '0sXmN2Mjk4xmgeaABkSGAk'; // 🎯 Your actual playlist
          const playlistApiUrl = `https://api.spotify.com/v1/playlists/${playlistId}`;

          return fetch(playlistApiUrl, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
        })
        .then(res => res.json())
        .then(data => {
          const totalTracks = data.tracks.total;
          const randomIndex = Math.floor(Math.random() * totalTracks);
          console.log(`🎲 Randomly selected track: ${randomIndex} of ${totalTracks}`);

          return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${currentDeviceId}`, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              context_uri: 'spotify:playlist:0sXmN2Mjk4xmgeaABkSGAk',
              offset: { position: randomIndex },
              position_ms: 0
            })
          });
        })
        .then(() => {
          console.log('🎶 Playlist playback started');
          // Enable repeat to stay inside playlist
          return fetch(`https://api.spotify.com/v1/me/player/repeat?state=context&device_id=${currentDeviceId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
          });
        })
        .catch(err => {
          console.error('❌ Playback setup failed:', err);
          localStorage.removeItem('spotify_access_token');
        });
      });

      player.connect();

      // Controls
      const shuffleButton = document.getElementById('shuffleButton');
      const playPauseButton = document.getElementById('playPauseButton');
      const volumeSlider = document.getElementById('volumeControl');
      const nextBtn = document.getElementById('nextBtn');
      const prevBtn = document.getElementById('prevBtn');
      const repeatBtn = document.getElementById('repeatBtn');

      shuffleButton?.addEventListener('click', () => {
        isShuffling = !isShuffling;
        shuffleButton.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';

        fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${isShuffling}`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token }
        }).then(() => {
          console.log('🔀 Shuffle ' + (isShuffling ? 'enabled' : 'disabled'));
        });
      });

      playPauseButton?.addEventListener('click', () => {
        if (isPaused) {
          player.resume().then(() => {
            playPauseButton.textContent = 'Pause';
            isPaused = false;
            console.log('▶️ Resumed');
          });
        } else {
          player.pause().then(() => {
            playPauseButton.textContent = 'Play';
            isPaused = true;
            console.log('⏸️ Paused');
          });
        }
      });

      volumeSlider?.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value) / 100;
        player.setVolume(volume).then(() => console.log('🔊 Volume set to', volume));
      });

      nextBtn?.addEventListener('click', () => {
        player.nextTrack().then(() => console.log('⏭️ Next track'));
      });

      prevBtn?.addEventListener('click', () => {
        player.previousTrack().then(() => console.log('⏮️ Previous track'));
      });

      repeatBtn?.addEventListener('click', () => {
        if (repeatState === 'off') repeatState = 'context';
        else if (repeatState === 'context') repeatState = 'track';
        else repeatState = 'off';

        fetch(`https://api.spotify.com/v1/me/player/repeat?state=${repeatState}&device_id=${currentDeviceId}`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token }
        }).then(() => {
          repeatBtn.textContent = 'Repeat ' + (repeatState === 'off' ? 'Off' : repeatState.charAt(0).toUpperCase() + repeatState.slice(1));
        });
      });

      // Track Info
      function updateTrackInfo(data) {
        if (!data || !data.item) {
          console.log('No track is currently playing.');
          return;
        }

        const trackName = data.item.name;
        const artistName = data.item.artists.map(artist => artist.name).join(', ');
        const albumArtUrl = data.item.album.images[0]?.url || 'https://via.placeholder.com/280x200';

        document.getElementById('trackName').textContent = trackName;
        document.getElementById('artistName').textContent = artistName;
        document.getElementById('albumArt').src = albumArtUrl;
      }

      player.addListener('player_state_changed', (state) => {
        console.log('🎵 Player state changed:', state);
        if (state?.track_window?.current_track) {
          const currentTrack = state.track_window.current_track;
          const formatted = {
            item: {
              name: currentTrack.name,
              artists: currentTrack.artists,
              album: currentTrack.album
            }
          };
          updateTrackInfo(formatted);
        }
      });

      fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(res => res.json())
      .then(data => {
        if (data?.item) {
          updateTrackInfo(data);
        } else {
          console.log('No track is currently playing.');
        }
      })
      .catch(err => {
        console.error('Error fetching track info:', err);
      });
    };
  }
})();
