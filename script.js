// ===============================
// Spotify Web Player with PKCE Authorization Code Flow & Auto Token Refresh
// ===============================

// === PKCE Utility Functions ===

/**
 * Generates a cryptographically secure random string (code verifier) for PKCE.
 * @param {number} length Length of the code verifier string (default 128).
 * @returns {string} The generated code verifier.
 */
function generateCodeVerifier(length = 128) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return verifier;
}

/**
 * Base64-url encodes an ArrayBuffer.
 * @param {ArrayBuffer} buffer The input buffer.
 * @returns {string} The base64-url encoded string.
 */
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Creates a SHA-256 hash of the code verifier and encodes it in base64-url format.
 * @param {string} verifier The code verifier string.
 * @returns {Promise<string>} The code challenge.
 */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

// === Configuration Constants ===
const CLIENT_ID = 'cde3eaa90edd4d8893a89046e3056912';
const REDIRECT_URI = 'https://arlenea12.github.io/ITWaitingRoom/';
const SCOPES = [
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing'
].join(' ');

// === OAuth2 Token Exchange ===

/**
 * Exchanges authorization code for access and refresh tokens.
 * @param {string} code Authorization code received from Spotify.
 * @param {string} verifier The PKCE code verifier.
 * @returns {Promise<Object>} Token response containing access_token, refresh_token, expires_in, etc.
 */
async function exchangeCodeForTokens(code, verifier) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

// === Token Refresh ===

/**
 * Refreshes the Spotify access token using the refresh token.
 * Automatically updates stored tokens and re-initializes the player.
 */
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) {
    console.error('No refresh token found. Redirecting to login.');
    startAuthFlow();
    return;
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Failed to refresh token:', errorData);
    startAuthFlow();
    return;
  }

  const data = await response.json();

  // Store the new tokens and expiration time
  localStorage.setItem('spotify_access_token', data.access_token);
  if (data.refresh_token) {
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  const expiresAt = Date.now() + data.expires_in * 1000;
  localStorage.setItem('spotify_token_expires_at', expiresAt.toString());

  console.log('✅ Access token refreshed successfully.');

  // Re-initialize player with new access token
  initPlayer(data.access_token);

  // Schedule next refresh ~1 minute before expiration
  setTimeout(refreshAccessToken, (data.expires_in - 60) * 1000);
}

// === Authentication Flow ===

/**
 * Initiates the Spotify authorization flow by redirecting the user to Spotify's login page.
 * Generates and stores a code verifier and challenge for PKCE.
 */
async function startAuthFlow() {
  const verifier = generateCodeVerifier();
  localStorage.setItem('spotify_code_verifier', verifier);

  const challenge = await generateCodeChallenge(verifier);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', challenge);

  window.location.href = authUrl.toString();
}

/**
 * Main execution flow: handles token validation, authorization, and player initialization.
 */
(async function main() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) {
    // No authorization code in URL — check for stored token validity
    const accessToken = localStorage.getItem('spotify_access_token');
    const expiresAt = Number(localStorage.getItem('spotify_token_expires_at'));

    if (accessToken && expiresAt && Date.now() < expiresAt) {
      console.log('✅ Valid access token found in storage.');
      initPlayer(accessToken);

      // Schedule token refresh before expiry
      setTimeout(refreshAccessToken, expiresAt - Date.now() - 60000);
    } else {
      // No valid token — start authorization flow
      await startAuthFlow();
    }
  } else {
    // Authorization code present — exchange for tokens
    const verifier = localStorage.getItem('spotify_code_verifier');
    if (!verifier) {
      console.error('PKCE code verifier missing. Restarting auth flow.');
      await startAuthFlow();
      return;
    }

    try {
      const tokenResponse = await exchangeCodeForTokens(code, verifier);

      // Store tokens and expiration time
      localStorage.setItem('spotify_access_token', tokenResponse.access_token);
      localStorage.setItem('spotify_refresh_token', tokenResponse.refresh_token);
      const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
      localStorage.setItem('spotify_token_expires_at', expiresAt.toString());

      // Remove authorization code from URL for cleanliness
      window.history.replaceState({}, document.title, REDIRECT_URI);

      initPlayer(tokenResponse.access_token);

      // Schedule token refresh before expiry
      setTimeout(refreshAccessToken, (tokenResponse.expires_in - 60) * 1000);
    } catch (error) {
      console.error('Failed to exchange authorization code for tokens:', error);
      await startAuthFlow();
    }
  }
})();

// === Player Initialization ===

/**
 * Initializes the Spotify Web Playback SDK player with the given access token.
 * @param {string} token The Spotify access token.
 */
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

      // Transfer playback to the Web Playback SDK device
      fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_ids: [device_id], play: true })
      })
      .then(() => {
        const playlistId = '0sXmN2Mjk4xmgeaABkSGAk'; // Your playlist ID
        return fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
          headers: { Authorization: 'Bearer ' + token }
        });
      })
      .then(res => res.json())
      .then(data => {
        const totalTracks = data.tracks.total;
        const randomIndex = Math.floor(Math.random() * totalTracks);
        console.log(`🎲 Random track index: ${randomIndex} / ${totalTracks}`);

        return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${currentDeviceId}`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
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
        console.log('🎶 Playback started');
        return fetch(`https://api.spotify.com/v1/me/player/repeat?state=context&device_id=${currentDeviceId}`, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + token }
        });
      })
      .catch(err => {
        console.error('❌ Playback setup failed:', err);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
      });
    });

    player.connect();

    // === Setup Controls ===

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
        headers: { Authorization: 'Bearer ' + token }
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
      player.setVolume(volume).then(() => {
        console.log('🔊 Volume set to', volume);
      });
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
        headers: { Authorization: 'Bearer ' + token }
      }).then(() => {
        repeatBtn.textContent = 'Repeat ' + (repeatState === 'off' ? 'Off' : repeatState.charAt(0).toUpperCase() + repeatState.slice(1));
      });
    });

    // === Track Info Update ===

    function updateTrackInfo(data) {
      if (!data || !data.item) {
        console.log('No track currently playing.');
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
        updateTrackInfo({ item: currentTrack });
      }
    });

    fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: 'Bearer ' + token }
    })
    .then(res => res.json())
    .then(data => {
      updateTrackInfo(data);
    })
    .catch(err => {
      console.error('Error fetching current track info:', err);
    });
  };
}
