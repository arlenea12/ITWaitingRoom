// =====================
// 1. OAuth and Token Setup
// =====================
(function() {
  const client_id = 'cde3eaa90edd4d8893a89046e3056912';
  const redirect_uri = 'https://arlenea12.github.io/ITWaitingRoom/';
  const scopes = 'user-modify-playback-state user-read-playback-state';

  // Check the URL hash for an access token and store it in localStorage
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
  if (!token) {
    token = getAccessTokenFromUrl();
  }
  if (!token) {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.replace(authUrl);
  } else {
    console.log('Spotify access token found:', token);
  }
})();

// =====================
// 2. Spotify Web Playback SDK Integration
// =====================

window.onSpotifyWebPlaybackSDKReady = () => {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    console.error('Spotify access token not found');
    return;
  }

  const player = new Spotify.Player({
    name: 'IT Waiting Room Player',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5
  });

  // Error Handling
  player.addListener('initialization_error', ({ message }) => { console.error(message); });
  player.addListener('authentication_error', ({ message }) => { console.error(message); });
  player.addListener('account_error', ({ message }) => { console.error(message); });
  player.addListener('playback_error', ({ message }) => { console.error(message); });

  // Playback Status Updates
  player.addListener('player_state_changed', state => { 
    console.log('Player state changed:', state); 
  });

  // When the player is ready, transfer playback to it
  player.addListener('ready', ({ device_id }) => {
  console.log('Ready with Device ID', device_id);

  // 1. Enable Shuffle
  fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true`, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  }).then(() => {
    console.log('Shuffle request sent');

    // 2. Start playback of the playlist after shuffle is enabled
    return fetch('https://api.spotify.com/v1/me/player/play', {
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
  }).then(res => {
    if (res.ok) {
      console.log('Playback started with shuffle!');
    } else {
      res.text().then(text => console.error('Playback error:', text));
    }
  }).catch(err => console.error('Setup error:', err));
});

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.size = Math.random() * 3 + 1;
    this.speedX = (Math.random() - 0.5) * 1.5;
    this.speedY = (Math.random() - 0.5) * 1.5;
    this.opacity = Math.random() * 0.5 + 0.5;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x > width) this.x = 0;
    if (this.x < 0) this.x = width;
    if (this.y > height) this.y = 0;
    if (this.y < 0) this.y = height;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.fill();
  }
}

let particles = [];
const particleCount = 150;

function initParticles() {
  particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
}

function animate() {
  let gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1e3c72');
  gradient.addColorStop(1, '#2a5298');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  particles.forEach(particle => {
    particle.update();
    particle.draw();
  });
  requestAnimationFrame(animate);
}

initParticles();
animate();
