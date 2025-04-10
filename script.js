(function () {
  // Spotify API client ID (used to identify your app)
  const client_id = 'cde3eaa90edd4d8893a89046e3056912';
  // The URL to which Spotify will redirect after the user authorizes the app
  const redirect_uri = 'https://arlenea12.github.io/ITWaitingRoom/';
  // The permissions (scopes) the app needs from the user to control playback and access track info
  const scopes = 'streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';

  // Function to extract the access token from the URL after user authorization
  function getAccessTokenFromUrl() {
    const hash = window.location.hash; // Get the URL hash (contains the access token)
    if (hash) {
      const urlParams = new URLSearchParams(hash.substring(1)); // Parse the URL hash
      const token = urlParams.get('access_token'); // Extract the access token from the URL
      if (token) {
        localStorage.setItem('spotify_access_token', token); // Store the token in localStorage for future use
      }
      window.location.hash = ''; // Clear the URL hash after extracting the token
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
    console.log('Spotify access token found:', token); // Log token if found
    initPlayer(token); // Call the function to initialize the player
  }

  // Function to initialize the Spotify player
  function initPlayer(token) {
    let currentDeviceId = null; // Variable to store the device ID of the player
    let isShuffling = false; // Boolean to track whether shuffle is enabled
    let isPaused = false; // Boolean to track whether the player is paused
    let repeatState = 'off'; // Initial repeat state (can be 'off', 'context', or 'track')
    let player; // The Spotify Player object

    window.onSpotifyWebPlaybackSDKReady = () => {
      player = new Spotify.Player({
        name: 'IT Waiting Room Player', // Name for the player
        getOAuthToken: cb => cb(token), // Provide OAuth token to authenticate the player
        volume: 0.5 // Set initial volume to 50%
      });

      // Listen for when the player is ready (i.e., connected to Spotify)
      player.addListener('ready', ({ device_id }) => {
        currentDeviceId = device_id; // Save the device ID when the player is ready
        console.log('Ready with Device ID', device_id);

        // Transfer and start playback on this device
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }) // Initialize the player (don't start playing yet)
        })
        .then(() => {
          // Dynamically get playlist length and start playback at a random track
          fetch('https://api.spotify.com/v1/playlists/0sXmN2Mjk4xmgeaABkSGAk', {
            headers: { 'Authorization': 'Bearer ' + token }
          })
          .then(res => res.json()) // Parse the response to get playlist details
          .then(data => {
            const totalTracks = data.tracks.total; // Get the total number of tracks in the playlist
            const randomTrack = Math.floor(Math.random() * totalTracks); // Pick a random track
            console.log(`🎲 Starting at random track: ${randomTrack} of ${totalTracks}`);

            // Start playing the playlist from the selected random track
            return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                context_uri: 'spotify:playlist:0sXmN2Mjk4xmgeaABkSGAk', // The playlist URI
                offset: { position: randomTrack }, // Start at the randomly selected track
                position_ms: 0 // Start from the beginning of the track
              })
            });
          })
          .then(() => console.log('Playback started!')) // Log that playback started
          .catch(err => {
            console.error('Playback setup failed:', err); // Handle errors
            localStorage.removeItem('spotify_access_token'); // Remove token if there's an issue
          });
        });
      });

      // Connect the player to Spotify
      player.connect();

      // Control Buttons
      const shuffleButton = document.getElementById('shuffleButton');
      const playPauseButton = document.getElementById('playPauseButton');
      const volumeSlider = document.getElementById('volumeControl');
      const nextBtn = document.getElementById('nextBtn');
      const prevBtn = document.getElementById('prevBtn');
      const repeatBtn = document.getElementById('repeatBtn');

      // Shuffle functionality
      shuffleButton.addEventListener('click', () => {
        isShuffling = !isShuffling; // Toggle shuffle state
        shuffleButton.textContent = isShuffling ? 'Disable Shuffle' : 'Enable Shuffle';

        // Toggle shuffle state on Spotify
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
            playPauseButton.textContent = 'Pause'; // Change button text to 'Pause'
            console.log('Playback resumed');
            isPaused = false; // Update paused state
          });
        } else {
          player.pause().then(() => {
            playPauseButton.textContent = 'Play'; // Change button text to 'Play'
            console.log('Playback paused');
            isPaused = true; // Update paused state
          });
        }
      });

      // Volume control functionality
      volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value) / 100; // Convert slider value to a percentage (0 to 1)
        player.setVolume(volume).then(() => console.log('Volume set to', volume)); // Set player volume
      });

      // Next Track functionality
      nextBtn.addEventListener('click', () => {
        player.nextTrack().then(() => console.log('Next track')); // Skip to next track
      });

      // Previous Track functionality
      prevBtn.addEventListener('click', () => {
        player.previousTrack().then(() => console.log('Previous track')); // Skip to previous track
      });

      // Repeat functionality
      repeatBtn.addEventListener('click', () => {
        if (repeatState === 'off') repeatState = 'context';
        else if (repeatState === 'context') repeatState = 'track';
        else repeatState = 'off';

        // Set repeat mode on Spotify
        fetch('https://api.spotify.com/v1/me/player/repeat?state=' + repeatState + '&device_id=' + currentDeviceId, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token }
        }).then(() => {
          repeatBtn.textContent = 'Repeat ' + (repeatState === 'off' ? 'Off' : repeatState.charAt(0).toUpperCase() + repeatState.slice(1));
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
            const trackName = data.item.name; // Get track name
            const artistName = data.item.artists.map(artist => artist.name).join(', '); // Get artist(s) name(s)
            const albumArtUrl = data.item.album.images[0].url; // Get album artwork URL

            // Update the UI with track info
            document.getElementById('trackName').textContent = trackName;
            document.getElementById('artistName').textContent = artistName;
            document.getElementById('albumArt').src = albumArtUrl;
          } else {
            console.log('No track is currently playing.'); // If no track is playing, log this message
          }
        })
        .catch(err => {
          console.error('Error fetching track info:', err); // Catch any errors
        });
      }

      // Update track info when the player is ready
      updateTrackInfo();

      // Optionally, update track info every few seconds (to handle changes in track)
      setInterval(updateTrackInfo, 5000); // Update every 5 seconds
    };
  }
})();
