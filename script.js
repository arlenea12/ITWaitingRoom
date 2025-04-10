// =======================
// Spotify Web Player Script
// =======================

(function () {
  // Spotify API client ID (used to identify your app)
  const client_id = 'cde3eaa90edd4d8893a89046e3056912'; // Your Spotify Client ID
  const redirect_uri = 'https://arlenea12.github.io/ITWaitingRoom/'; // Your Redirect URI
  const scopes = 'streaming user-modify-playback-state user-read-playback-state user-read-currently-playing'; // The scopes your app requires

  // Function to extract the access token from the URL after user authorization
  function getAccessTokenFromUrl() {
    const hash = window.location.hash; // Get the URL hash (contains the access token)
    if (hash) {
      const urlParams = new URLSearchParams(hash.substring(1)); // Parse the URL hash
      const token = urlParams.get('access_token'); // Extract the access token from the URL
      if (token) {
        localStorage.setItem('spotify_access_token', token); // Store the token in localStorage for future use
      }
      window.location.hash = ''; // Clean up the URL by removing the hash
      return token;
    }
    return null; // Return null if no access token is found
  }

  // Try to retrieve the token from localStorage first, otherwise extract it from the URL
  let token = localStorage.getItem('spotify_access_token');
  if (!token) token = getAccessTokenFromUrl(); // Get token if not already in localStorage

  // If no token is found, redirect to Spotify authorization page to get a new one
  if (!token) {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.replace(authUrl); // Redirect user to the Spotify authorization URL
  } else {
    console.log('Spotify access token found:', token);
    initPlayer(token); // Call the function to initialize the player
  }

  // Function to initialize the Spotify player
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
        console.log('Ready with Device ID', device_id);

        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [device_id], play: false })
        })
        .then(() => {
          fetch('https://api.spotify.com/v1/playlists/0sXmN2Mjk4xmgeaABkSGAk', {
            headers: { 'Authorization': 'Bearer ' + token }
          })
          .then(res => res.json())
          .then(data => {
            const totalTracks = data.tracks.total;
            const randomTrack = Math.floor(Math.random() * totalTracks);
            console.log(`🎲 Starting at random track: ${randomTrack} of ${totalTracks}`);

            return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                context_uri: 'spotify:playlist:0sXmN2Mjk4xmgeaABkSGAk',
                offset: { position: randomTrack },
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
      });

      player.connect();

      // Control Buttons
      const shuffleButton = document.getElementById('shuffleButton');
      const playPauseButton = document.getElementById('playPauseButton');
      const volumeSlider = document.getElementById('volumeControl');
      const nextBtn = document.getElementById('nextBtn');
      const prevBtn = document.getElementById('prevBtn');
      const repeatBtn = document.getElementById('repeatBtn');

      shuffleButton.addEventListener('click', () => {
        isShuffling = !isShuffling;
        shuffleButton.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';

        fetch('https://api.spotify.com/v1/me/player/shuffle?state=' + isShuffling, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(() => console.log('Shuffle ' + (isShuffling ? 'enabled' : 'disabled')));
      });

      playPauseButton.addEventListener('click', () => {
        if (isPaused) {
          player.resume().then(() => {
            playPauseButton.textContent = 'Pause';
            console.log('Playback resumed');
            isPaused = false;
          });
        } else {
          player.pause().then(() => {
            playPauseButton.textContent = 'Play';
            console.log('Playback paused');
            isPaused = true;
          });
        }
      });

      volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value) / 100;
        player.setVolume(volume).then(() => console.log('Volume set to', volume));
      });

      nextBtn.addEventListener('click', () => {
        player.nextTrack().then(() => console.log('Next track'));
      });

      prevBtn.addEventListener('click', () => {
        player.previousTrack().then(() => console.log('Previous track'));
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

      // Fetch track info and update UI
      function updateTrackInfo(data) {
        if (!data || !data.item) {
          console.log('No track is currently playing.');
          return;
        }

        const trackName = data.item.name;
        const artistName = data.item.artists.map(artist => artist.name).join(', ');
        const albumArtUrl = data.item.album.images[0]?.url || 'https://via.placeholder.com/280x200'; // Default placeholder if no album art

        document.getElementById('trackName').textContent = trackName;
        document.getElementById('artistName').textContent = artistName;
        document.getElementById('albumArt').src = albumArtUrl;
      }

      player.addListener('player_state_changed', (state) => {
        console.log('Player state changed:', state);
        if (state.track_window) {
          updateTrackInfo(state.track_window.current_track);
        }
      });

      fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.item) {
          updateTrackInfo(data.item);
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


