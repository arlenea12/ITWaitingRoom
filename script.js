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
    console.log('Spotify access token found:', token);
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
          // Dynamically get playlist length and start on a random track
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

      // Connect the player
      player.connect();

      // Control Buttons
      const shuffleButton = document.getElementById('shuffleButton');
      const playPauseButton = document.getElementById('playPauseButton');
      const volumeSlider = document.getElementById('volumeControl');
      const nextBtn = document.getElementById('nextBtn');
      const prevBtn = document.getElementById('prevBtn');
      const repeatBtn = document.getElementById('repeatBtn');
      const progress = document.getElementById('progress');

      // Shuffle functionality
      shuffleButton.addEventListener('click', () => {
        isShuffling = !isShuffling;
        shuffleButton.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';

        fetch('https://api.spotify.com/v1/me/player/shuffle?state=' + isShuffling, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        })
        .then(() => console.log('Shuffle ' + (isShuffling ? 'enabled' : 'disabled')));
      });

      // Play/Pause functionality
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

      // Volume control functionality
      volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value) / 100;
        player.setVolume(volume).then(() => console.log('Volume set to', volume));
      });

      // Next Track functionality
      nextBtn.addEventListener('click', () => {
        player.nextTrack().then(() => console.log('Next track'));
      });

      // Previous Track functionality
      prevBtn.addEventListener('click', () => {
        player.previousTrack().then(() => console.log('Previous track'));
      });

      // Repeat functionality
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

      // Progress Bar functionality
      progress.addEventListener('input', (e) => {
        const newPosition = (e.target.value / 100) * player._options.duration;
        player.seek(newPosition).then(() => {
          console.log('Seeked to position', newPosition);
        });
      });
      
      // Fetch track info and update UI
      function updateTrackInfo() {
        fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data && data.item) {
            const trackName = data.item.name;
            const artistName = data.item.artists.map(artist => artist.name).join(', ');
            const albumArtUrl = data.item.album.images[0].url;

            // Update the UI with track info
            document.getElementById('trackName').textContent = trackName;
            document.getElementById('artistName').textContent = artistName;
            document.getElementById('albumArt').src = albumArtUrl;
          } else {
            console.log('No track is currently playing.');
          }
        })
        .catch(err => {
          console.error('Error fetching track info:', err);
        });
      }

      // Update track info when the player is ready
      updateTrackInfo();

      // Optionally, update track info every few seconds
      setInterval(updateTrackInfo, 5000); // Updates track info every 5 seconds
    };
  }
})();
