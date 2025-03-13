// This is a standalone WebTorrent client without WebRTC/WebSocket dependencies

console.log("App.js loaded.");

// Global variables that will be used across functions
let magnetInputEl, loadTorrentBtnEl, torrentStatusEl, downloadSpeedEl, uploadSpeedEl;
let peerCountEl, downloadProgressEl, videoContainer, videoPlayerEl, messageListEl;
let torrentInfoEl, messagesEl, mediaInfoEl, videoStatusEl;
let client, currentTorrent;
let isDarkMode = localStorage.getItem('darkMode') === 'true'; // Track dark mode state
let defaultTrackers = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.fastcast.nz'
  // Removed problematic trackers that cause connection errors
];

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to check if a file is a video
function isVideo(filename) {
  return /\.(mp4|mkv|webm|avi|mov|flv|wmv)$/i.test(filename);
}

// Helper function to check if a file is a subtitle
function isSubtitle(filename) {
  return /\.(srt|vtt|sub|sbv|ass|ssa)$/i.test(filename);
}

// Helper function to format duration in HH:MM:SS
function formatDuration(seconds) {
  if (!seconds) return "Unknown";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

// Add a message to the UI (globally defined so it's available immediately)
function addMessageToUI(sender, text) {
  // Always log to console
  console.log(`[${sender}] ${text}`);
  
  // If messageListEl is not available, just log to console
  if (!messageListEl) {
    console.warn('Message list element not found, logging to console only');
    return;
  }
  
  const messageEl = document.createElement('div');
  messageEl.className = 'message';
  
  const timeString = new Date().toLocaleTimeString();
  
  // Truncate extremely long text (like magnet links) in the display only
  const displayText = text.length > 100 ? 
    text.substring(0, 97) + '...' : text;
  
  messageEl.innerHTML = `
    <span class="message-time">[${timeString}]</span>
    <span class="message-sender ${sender.toLowerCase()}">${sender}:</span>
    <span class="message-text">${displayText}</span>
  `;
  
  // For magnet links, add a clickable button to use them
  if (text.startsWith('magnet:?')) {
    const useButton = document.createElement('button');
    useButton.className = 'use-magnet-btn';
    useButton.textContent = 'Use This Magnet';
    useButton.onclick = function() {
      if (magnetInputEl) {
        magnetInputEl.value = text;
      }
    };
    messageEl.appendChild(useButton);
  }
  
  // Add the message to the UI
  messageListEl.appendChild(messageEl);
  messageListEl.scrollTop = messageListEl.scrollHeight;
}

// Wait for DOM to be fully loaded before initializing
document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM fully loaded");
  
  // Initialize the application
  init();
});

// Initialize UI elements
function setupUIElements() {
  console.log("Setting up UI elements");
  
  // Get references to UI elements
  magnetInputEl = document.getElementById('magnet-input');
  loadTorrentBtnEl = document.getElementById('load-torrent-btn');
  torrentStatusEl = document.getElementById('torrent-status');
  downloadSpeedEl = document.getElementById('download-speed');
  uploadSpeedEl = document.getElementById('upload-speed');
  peerCountEl = document.getElementById('peer-count');
  downloadProgressEl = document.getElementById('download-progress');
  videoContainer = document.getElementById('video-container');
  videoPlayerEl = document.getElementById('video-player');
  messageListEl = document.getElementById('message-list');
  
  // These elements might not exist in the current HTML
  torrentInfoEl = document.getElementById('torrent-info');
  messagesEl = messageListEl; // messagesEl is probably meant to be messageListEl
  mediaInfoEl = document.getElementById('media-info');
  videoStatusEl = document.getElementById('video-status');
  sampleTorrentsEl = document.getElementById('sample-torrents');
  
  // Create the torrent info element if it doesn't exist
  if (!torrentInfoEl) {
    console.log("Creating missing torrent-info element");
    torrentInfoEl = document.createElement('div');
    torrentInfoEl.id = 'torrent-info';
    torrentInfoEl.className = 'torrent-info';
    
    // Try to insert it in a reasonable place
    const torrentStats = document.querySelector('.torrent-stats');
    if (torrentStats && torrentStats.parentNode) {
      torrentStats.parentNode.insertBefore(torrentInfoEl, torrentStats.nextSibling);
    } else if (videoContainer && videoContainer.parentNode) {
      videoContainer.parentNode.insertBefore(torrentInfoEl, videoContainer);
    } else {
      // Fallback - add to body
      document.body.appendChild(torrentInfoEl);
    }
  }
  
  // Create the video player element if it doesn't exist
  if (!videoPlayerEl && videoContainer) {
    console.log("Creating missing video-player element");
    videoPlayerEl = document.createElement('div');
    videoPlayerEl.id = 'video-player';
    videoPlayerEl.className = 'video-player';
    videoContainer.appendChild(videoPlayerEl);
  }
  
  // Create the media info element if it doesn't exist
  if (!mediaInfoEl) {
    console.log("Creating missing media-info element");
    mediaInfoEl = document.createElement('div');
    mediaInfoEl.id = 'media-info';
    mediaInfoEl.className = 'media-info';
    
    // Try to insert it in the same container as the video player
    if (videoContainer && videoContainer.parentNode) {
      videoContainer.parentNode.insertBefore(mediaInfoEl, videoContainer.nextSibling);
    } else if (torrentInfoEl && torrentInfoEl.parentNode) {
      torrentInfoEl.parentNode.insertBefore(mediaInfoEl, torrentInfoEl);
    } else {
      // Fallback - add to body
      document.body.appendChild(mediaInfoEl);
    }
  }
  
  // Create the sample torrents element if it doesn't exist
  if (!sampleTorrentsEl) {
    console.log("Creating missing sample-torrents element");
    sampleTorrentsEl = document.createElement('div');
    sampleTorrentsEl.id = 'sample-torrents';
    sampleTorrentsEl.className = 'sample-torrents';
    
    // Try to insert it in a reasonable place
    if (magnetInputEl && magnetInputEl.parentNode) {
      // Place it after the input container
      const inputContainer = magnetInputEl.closest('.input-container') || magnetInputEl.parentNode;
      if (inputContainer.parentNode) {
        inputContainer.parentNode.insertBefore(sampleTorrentsEl, inputContainer.nextSibling);
      }
    } else if (document.querySelector('.app-container')) {
      // Add it to the app container
      document.querySelector('.app-container').appendChild(sampleTorrentsEl);
    } else {
      // Fallback - add to body
      document.body.appendChild(sampleTorrentsEl);
    }
  }
  
  // Add dark mode toggle
  const themeToggle = document.createElement('button');
  themeToggle.className = 'theme-toggle';
  themeToggle.innerHTML = isDarkMode ? '☀️' : '🌙';
  themeToggle.title = isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  themeToggle.addEventListener('click', function() {
    toggleDarkMode();
    this.innerHTML = isDarkMode ? '☀️' : '🌙';
    this.title = isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });
  document.body.appendChild(themeToggle);
  
  // Log missing critical elements
  const criticalElements = [
    { el: magnetInputEl, name: 'magnet-input' },
    { el: loadTorrentBtnEl, name: 'load-torrent-btn' },
    { el: videoContainer, name: 'video-container' },
    { el: messageListEl, name: 'message-list' }
  ];
  
  const missingElements = criticalElements
    .filter(item => !item.el)
    .map(item => item.name);
  
  if (missingElements.length > 0) {
    console.error("Missing critical UI elements:", missingElements);
    // Try to show a message in the UI if possible, otherwise just log to console
    if (messageListEl) {
      addMessageToUI('Error', 'Some UI elements are missing. The app may not function correctly.');
    }
  }
}

// Set up event listeners
function setupEventListeners() {
  console.log("Setting up event listeners");
  
  // Load torrent button click event
  if (loadTorrentBtnEl) {
    loadTorrentBtnEl.addEventListener('click', () => {
      const magnetUri = magnetInputEl ? magnetInputEl.value.trim() : '';
      if (magnetUri) {
        console.log('Load torrent button clicked with URI:', magnetUri);
        addMessageToUI('User', `Loading torrent: ${magnetUri.substring(0, 50)}...`);
        loadTorrent(magnetUri);
      } else {
        console.log('Load torrent button clicked but no magnet URI provided');
        addMessageToUI('Error', 'Please enter a magnet URI');
      }
    });
  } else {
    console.error('Load torrent button not found');
  }
  
  // Magnet input keypress event (press Enter to load)
  if (magnetInputEl) {
    magnetInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const magnetUri = magnetInputEl.value.trim();
        if (magnetUri) {
          console.log('Enter key pressed with URI:', magnetUri);
          addMessageToUI('User', `Loading torrent: ${magnetUri.substring(0, 50)}...`);
          loadTorrent(magnetUri);
        } else {
          console.log('Enter key pressed but no magnet URI provided');
          addMessageToUI('Error', 'Please enter a magnet URI');
        }
      }
    });
  } else {
    console.error('Magnet input field not found');
  }
  
  // Add drag and drop support for torrent files
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.add('drag-over');
  });
  
  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove('drag-over');
  });
  
  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Check if it's a .torrent file
      if (file.name.endsWith('.torrent')) {
        console.log('Torrent file dropped:', file.name);
        addMessageToUI('User', `Loading torrent file: ${file.name}`);
        
        // Read the torrent file
        const reader = new FileReader();
        reader.onload = (e) => {
          const contents = e.target.result;
          if (client) {
            try {
              loadTorrent(contents);
            } catch (err) {
              console.error('Error loading dropped torrent file:', err);
              addMessageToUI('Error', `Error loading torrent file: ${err.message}`);
            }
          } else {
            console.error('WebTorrent client not initialized');
            addMessageToUI('Error', 'WebTorrent client not initialized');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        console.log('Non-torrent file dropped:', file.name);
        addMessageToUI('Error', 'Please drop a .torrent file');
      }
    }
  });
  
  // Check for magnet links in URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const magnetParam = urlParams.get('magnet');
  if (magnetParam) {
    console.log('Found magnet link in URL parameters:', magnetParam);
    addMessageToUI('System', 'Loading magnet link from URL parameters');
    
    // Set the magnet input field value
    if (magnetInputEl) {
      magnetInputEl.value = magnetParam;
    }
    
    // Delay loading slightly to ensure everything is initialized
    setTimeout(() => {
      loadTorrent(magnetParam);
    }, 1000);
  }
  
  // Add sample torrent buttons
  if (sampleTorrentsEl) {
    const samples = [
      { name: 'Big Buck Bunny', magnet: 'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fbig-buck-bunny.torrent' },
      { name: 'Sintel', magnet: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent' },
      { name: 'Cosmos Laundromat', magnet: 'magnet:?xt=urn:btih:c9e15763f722f23e98a29decdfae341b98d53056&dn=Cosmos+Laundromat&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fcosmos-laundromat.torrent' }
    ];
    
    // Clear existing content
    sampleTorrentsEl.innerHTML = '<h4>Sample Torrents</h4>';
    
    // Create sample buttons
    samples.forEach(sample => {
      const btn = document.createElement('button');
      btn.className = 'sample-btn';
      btn.textContent = sample.name;
      btn.addEventListener('click', () => {
        console.log('Sample torrent selected:', sample.name);
        addMessageToUI('User', `Loading sample torrent: ${sample.name}`);
        
        // Set the magnet input field value
        if (magnetInputEl) {
          magnetInputEl.value = sample.magnet;
        }
        
        // Load the torrent
        loadTorrent(sample.magnet);
      });
      
      sampleTorrentsEl.appendChild(btn);
    });
  } else {
    console.warn("Sample torrents element not found or couldn't be created");
  }
  
  // Add styles for the sample torrent buttons
  const style = document.createElement('style');
  style.textContent = `
    .sample-btn {
      margin: 5px;
      padding: 8px 12px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
    }
    .sample-btn:hover {
      background: #e0e0e0;
    }
    .drag-over {
      background-color: rgba(33, 150, 243, 0.1);
    }
    .drag-over::after {
      content: 'Drop torrent file here';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-size: 20px;
      z-index: 1000;
    }
  `;
  document.head.appendChild(style);
  
  console.log("Event listeners setup complete");
  return true;
}

// Initialize WebTorrent client
function initWebTorrent() {
  console.log("Initializing WebTorrent client");
  
  if (typeof WebTorrent === 'undefined') {
    console.error('WebTorrent library not found');
    addMessageToUI('Error', 'WebTorrent library not found. Check your internet connection or script tags.');
    return false;
  }
  
  try {
    // Better STUN server configuration for peer connectivity
    // Removing the problematic TURN server
    const rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ],
      sdpSemantics: 'unified-plan',
      iceCandidatePoolSize: 5
    };
    
    // Configure WebTorrent client with only WebSocket trackers (browsers cannot use UDP trackers)
    client = new WebTorrent({
      tracker: {
        rtcConfig,
        announceList: [defaultTrackers],
        wrtc: null // Let WebTorrent automatically detect WebRTC implementation
      },
      dht: false,  // DHT doesn't work well in browsers, rely on trackers instead
      webSeeds: true // Enable HTTP seeds
    });
    
    // Aggressively filter WebRTC and tracker errors to reduce console spam
    const originalError = console.error;
    console.error = function(...args) {
      // Skip showing various WebRTC/tracker connection errors
      if (args[0] && typeof args[0] === 'string') {
        // Suppress all tracker and WebRTC connection errors
        if (args[0].includes('tracker') || 
            args[0].includes('WebSocket') || 
            args[0].includes('WebRTC') || 
            args[0].includes('ICE') || 
            args[0].includes('Ice connection') ||
            args[0].includes('TURN server')) {
          // Log quietly to console as info instead of error
          console.info('Connection info (suppressed error):', args[0]);
          return;
        }
      }
      originalError.apply(console, args);
    };
    
    // Override console.warn to filter common WebRTC warnings
    const originalWarn = console.warn;
    console.warn = function(...args) {
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('WebRTC') || 
           args[0].includes('ICE') || 
           args[0].includes('tracker') || 
           args[0].toString().includes('Ice connection failed'))) {
        return; // Suppress WebRTC warnings
      }
      originalWarn.apply(console, args);
    };
    
    // Handle client errors - but filter out common connection errors
    client.on('error', function(err) {
      console.error('WebTorrent client error:', err);
      
      // Check if it's a connection error we should hide from users
      const errorMsg = err.message.toLowerCase();
      if (errorMsg.includes('ice connection') || 
          errorMsg.includes('ice transport') || 
          errorMsg.includes('webrtc') ||
          errorMsg.includes('turn server') ||
          errorMsg.includes('tracker')) {
        // Just log quietly, don't show to user
        console.info('WebTorrent connection info:', err.message);
        return;
      }
      
      // Different user messages based on error types for other errors
      let userMessage = `WebTorrent error: ${err.message}`;
      
      if (err.message.includes('XMLHttpRequest') || err.message.includes('CORS') || err.message.includes('Failed to fetch')) {
        userMessage = 'Network error: Unable to connect to tracker (CORS issue). This is a browser security limitation.';
      } else if (err.message.includes('timeout') || err.message.includes('timed out')) {
        userMessage = 'Connection timeout: The tracker or peer is not responding.';
      } else if (err.message.includes('peer') && (err.message.includes('disconnect') || err.message.includes('lost'))) {
        userMessage = 'Lost connection to peers. The download may be slow or stalled.';
      }
      
      addMessageToUI('Error', userMessage);
    });
    
    // Handle client warnings - filter out tracker warnings from UI
    client.on('warning', function(warning) {
      // Only log non-connection warnings to console
      const warningStr = warning.toString().toLowerCase();
      if (!warningStr.includes('tracker') && 
          !warningStr.includes('ice connection') && 
          !warningStr.includes('webrtc') &&
          !warningStr.includes('announce') && 
          !warningStr.includes('websocket')) {
        console.warn('WebTorrent warning:', warning);
        addMessageToUI('Warning', `WebTorrent warning: ${warning}`);
      }
    });
    
    console.log("WebTorrent client initialized successfully");
    addMessageToUI('System', 'WebTorrent client initialized and ready');
    
    return true;
  } catch (err) {
    console.error("Failed to initialize WebTorrent client:", err);
    addMessageToUI('Error', `Failed to initialize WebTorrent: ${err.message}`);
    
    // Show a special message for broken WebTorrent
    if (torrentStatusEl) {
      torrentStatusEl.innerHTML = `
        <div class="error-banner">
          <p><strong>WebTorrent initialization failed.</strong></p>
          <p>Your browser may not support WebTorrent or WebRTC.</p>
          <p>Try using Chrome, Firefox, or Edge instead.</p>
        </div>
      `;
    }
    
    return false;
  }
}

// Initialize everything
function init() {
  console.log("Initializing TorrentMonkey app...");
  
  // Set up UI elements first
  setupUIElements();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize WebTorrent client
  initWebTorrent();
  
  // Add custom CSS styles
  addCustomStyles();
  
  // Apply dark mode if enabled
  applyTheme();
  
  console.log("Initialization complete");
}

// Apply current theme (dark or light mode)
function applyTheme() {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// Toggle dark mode
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  localStorage.setItem('darkMode', isDarkMode);
  applyTheme();
  addMessageToUI('System', isDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
}

// Add custom CSS styles for UI components
function addCustomStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* Progress bar styles */
    .progress-bar {
      width: 100%;
      height: 10px;
      background-color: #e0e0e0;
      border-radius: 5px;
      margin-top: 5px;
      overflow: hidden;
    }
    
    .progress-bar-inner {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      width: 0%;
      transition: width 0.5s ease-in-out;
    }
    
    /* File list styles */
    .file-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 10px;
    }
    
    .file-item {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .file-item:hover {
      background-color: #f5f5f5;
    }
    
    .file-item.active {
      background-color: #e3f2fd;
    }
    
    .file-item.video-file {
      font-weight: bold;
      color: #2196F3;
    }
    
    .file-item.subtitle-file {
      font-style: italic;
      color: #9C27B0;
    }
    
    /* Download button styling */
    .download-btn-container {
      margin-top: 10px;
      text-align: center;
    }
    
    .download-button {
      padding: 8px 15px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 3px rgba(0,0,0,0.1);
    }
    
    .large-download-btn {
      padding: 10px 18px;
      font-size: 15px;
      margin: 15px auto;
      display: block;
      max-width: 280px;
    }
    
    .download-icon {
      margin-right: 7px;
      font-size: 16px;
    }
    
    .download-button:hover {
      background-color: #1976D2;
      box-shadow: 0 3px 5px rgba(0,0,0,0.2);
      transform: translateY(-1px);
    }
    
    .download-button:active {
      transform: translateY(1px);
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    
    /* Video with controls container */
    .video-with-controls {
      margin-bottom: 15px;
    }
    
    /* Video thumbnail and info */
    .video-info {
      display: flex;
      background-color: rgba(0,0,0,0.05);
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
    }
    
    .video-thumbnail {
      max-width: 160px;
      height: auto;
      border-radius: 4px;
      border: 1px solid #ddd;
    }
    
    .video-metadata {
      margin-left: 15px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .video-metadata div {
      margin-bottom: 5px;
      font-size: 14px;
    }
    
    /* Download button for non-video files */
    .non-video-file {
      padding: 20px;
      text-align: center;
      background-color: #f9f9f9;
      border-radius: 4px;
    }
    
    /* Dark mode styles */
    .dark-mode {
      background-color: #121212;
      color: #e0e0e0;
    }
    
    .dark-mode .non-video-file {
      background-color: #1e1e1e;
      color: #e0e0e0;
    }
    
    .dark-mode .video-info {
      background-color: rgba(255,255,255,0.05);
    }
    
    .dark-mode .file-item {
      border-bottom: 1px solid #333;
    }
    
    .dark-mode .file-item:hover {
      background-color: #2a2a2a;
    }
    
    .dark-mode .file-item.active {
      background-color: #0d47a1;
      color: white;
    }
    
    .dark-mode input[type="text"] {
      background-color: #333;
      color: #fff;
      border: 1px solid #555;
    }
    
    .dark-mode button:not(.download-button) {
      background-color: #333;
      color: #fff;
      border: 1px solid #555;
    }
    
    .dark-mode button:not(.download-button):hover {
      background-color: #444;
    }
    
    .dark-mode .message {
      background-color: #1e1e1e;
      border: 1px solid #333;
    }
    
    .dark-mode .torrent-info,
    .dark-mode .torrent-stats,
    .dark-mode .file-list,
    .dark-mode .enhanced-video-controls {
      background-color: #1e1e1e;
      border-color: #333;
    }
    
    .dark-mode .progress-bar {
      background-color: #333;
    }
    
    .dark-mode .control-btn {
      background: rgba(60, 60, 60, 0.8);
      border: 1px solid #555;
      color: #e0e0e0;
    }
    
    .dark-mode .control-btn:hover {
      background: rgba(80, 80, 80, 1);
    }
    
    .dark-mode .speed-menu {
      background: #333;
      border: 1px solid #555;
    }
    
    .dark-mode .speed-option:hover {
      background: #444;
    }
    
    /* Dark mode toggle */
    .theme-toggle {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background-color: rgba(33, 150, 243, 0.8);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
    }
    
    .theme-toggle:hover {
      transform: scale(1.1);
      background-color: rgba(33, 150, 243, 1);
    }
    
    .dark-mode .theme-toggle {
      background-color: rgba(255, 193, 7, 0.8);
      color: #121212;
    }
    
    .dark-mode .theme-toggle:hover {
      background-color: rgba(255, 193, 7, 1);
    }
    
    /* Caption menu */
    .caption-menu {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      position: absolute;
      bottom: 100%;
      right: 0;
      z-index: 10;
      margin-bottom: 5px;
      display: none;
    }
    
    .dark-mode .caption-menu {
      background: #333;
      border: 1px solid #555;
    }
    
    .caption-option {
      padding: 5px 10px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .caption-option:hover {
      background: #f0f0f0;
    }
    
    .dark-mode .caption-option:hover {
      background: #444;
    }
    
    .caption-option.active {
      background: #e3f2fd;
      font-weight: bold;
    }
    
    .dark-mode .caption-option.active {
      background: #0d47a1;
    }
  `;
  
  document.head.appendChild(styleElement);
}

// Load torrent from magnet URI
function loadTorrent(magnetURI) {
  if (!client) {
    addMessageToUI('Error', 'WebTorrent client not initialized');
    return;
  }
  
  if (!magnetURI) {
    addMessageToUI('Error', 'No magnet URI provided');
    return;
  }
  
  console.log(`Loading torrent from magnet URI: ${magnetURI}`);
  
  // Update UI to show loading state
  if (torrentStatusEl) {
    torrentStatusEl.textContent = 'Connecting to peers...';
  }
  
  if (torrentInfoEl) {
    torrentInfoEl.innerHTML = '';
  }
  
  if (videoPlayerEl) {
    videoPlayerEl.innerHTML = '';
  }
  
  if (mediaInfoEl) {
    mediaInfoEl.innerHTML = '';
  }
  
  try {
    // Instead of destroying all torrents which causes stream errors,
    // we'll just remove the current one if it exists
    if (currentTorrent) {
      console.log("Removing existing torrent");
      client.remove(currentTorrent.infoHash);
      currentTorrent = null;
    }
    
    // Add the new torrent
    client.add(magnetURI, { announce: defaultTrackers }, function(torrent) {
      // Store current torrent for global access
      currentTorrent = torrent;
      console.log("Torrent added:", torrent.name || torrent.infoHash);
      
      // Update UI
      if (torrentStatusEl) {
        torrentStatusEl.textContent = `Loaded: ${torrent.name || 'Unnamed torrent'}`;
      }
      
      addMessageToUI('System', `Torrent loaded: ${torrent.name || 'Unnamed torrent'}`);
      
      // Set a timeout to handle stalled torrents
      const torrentTimeout = setTimeout(() => {
        if (torrent.progress < 0.01 && torrent.numPeers === 0) {
          addMessageToUI('Warning', 'No peers found. The torrent may be unavailable or very rare.');
        }
      }, 30000); // 30 seconds timeout
      
      // Handle the torrent
      torrent.on('ready', function() {
        console.log('Torrent metadata received');
        addMessageToUI('System', `Metadata received. Contains ${torrent.files.length} files.`);
        
        // Display file list
        displayTorrentFiles(torrent);
        
        // Auto-select the largest video file
        let largestFile = findLargestVideoFile(torrent);
        if (largestFile) {
          addMessageToUI('System', `Auto-selecting video: ${largestFile.name}`);
          selectFile(largestFile);
        } else {
          addMessageToUI('Warning', 'No video files found in this torrent');
        }
      });
      
      // Set up download progress updating
      torrent.on('download', throttle(function() {
        updateTorrentStats(torrent);
      }, 500));
      
      // Handle download completion
      torrent.on('done', function() {
        console.log('Download completed');
        addMessageToUI('System', 'Download complete!');
        clearTimeout(torrentTimeout);
        
        if (torrentStatusEl) {
          torrentStatusEl.textContent = 'Download complete!';
        }
        
        // Ensure the file is rendered/played after completion
        let largestFile = findLargestVideoFile(torrent);
        if (largestFile) {
          console.log("Reselecting file after completion:", largestFile.name);
          selectFile(largestFile);
        }
      });
      
      // Initial stats update
      updateTorrentStats(torrent);
      
      // Handle errors
      torrent.on('error', function(err) {
        console.error('Torrent error:', err);
        addMessageToUI('Error', `Torrent error: ${err.message}`);
        clearTimeout(torrentTimeout);
      });
      
      // Handle warnings (non-fatal issues)
      torrent.on('warning', function(warn) {
        console.warn('Torrent warning:', warn);
        // Don't show tracker errors to user by default as they are too common
        if (!warn.toString().includes('tracker') && !warn.toString().includes('Ice connection failed')) {
          addMessageToUI('Warning', `Torrent warning: ${warn}`);
        }
      });
    });
  } catch (err) {
    console.error("Error loading torrent:", err);
    addMessageToUI('Error', `Failed to load torrent: ${err.message}`);
  }
}

// Find the largest video file in the torrent
function findLargestVideoFile(torrent) {
  let largestFile = null;
  let largestSize = 0;
  
  torrent.files.forEach(function(file) {
    if (isVideo(file.name) && file.length > largestSize) {
      largestSize = file.length;
      largestFile = file;
    }
  });
  
  return largestFile;
}

// Select and display a file
function selectFile(file) {
  if (!file) {
    console.error("No file provided to selectFile");
    return;
  }
  
  console.log("Selected file:", file.name);
  
  // Handle video files
  if (isVideo(file.name)) {
    console.log("Selected video file:", file.name);
    
    // Find subtitle files for this video
    const subtitles = currentTorrent ? findSubtitlesForVideo(file, currentTorrent) : [];
    if (subtitles.length > 0) {
      console.log(`Found ${subtitles.length} subtitle files for ${file.name}`);
    }
    
    // Create a video element
    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.style.width = '100%';
    videoEl.id = 'video-player-element';
    videoEl.crossOrigin = 'anonymous'; // Help with CORS issues for thumbnail generation
    
    // Add loading indicator
    videoEl.poster = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="%23222"/><text x="320" y="180" font-family="sans-serif" font-size="24" text-anchor="middle" fill="%23fff">Loading video...</text></svg>';
    
    // Create a container for the video and download button
    const videoContainerDiv = document.createElement('div');
    videoContainerDiv.className = 'video-with-controls';
    
    // Replace the video container contents
    if (videoPlayerEl) {
      videoPlayerEl.innerHTML = '';
      videoContainerDiv.appendChild(videoEl);
      
      // Add a download button for the video file
      const downloadBtnContainer = document.createElement('div');
      downloadBtnContainer.className = 'download-btn-container';
      
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-button';
      downloadBtn.innerHTML = '<span class="download-icon">⬇️</span> Download Video';
      downloadBtn.addEventListener('click', function() {
        downloadFile(file);
      });
      
      downloadBtnContainer.appendChild(downloadBtn);
      videoContainerDiv.appendChild(downloadBtnContainer);
      
      videoPlayerEl.appendChild(videoContainerDiv);
    } else {
      console.error("Video player element not found");
      addMessageToUI('Error', 'Video player element not found');
      return;
    }
    
    // Create a video stream from the file
    console.log("Getting blob URL for video file");
    file.getBlobURL(function(err, url) {
      if (err) {
        console.error("Error getting blob URL for video", err);
        addMessageToUI('Error', `Error loading video: ${err.message}`);
        return;
      }
      
      console.log("Got blob URL for video:", url.substring(0, 50) + "...");
      videoEl.src = url;
      
      // Add error handler for video element
      videoEl.onerror = function(e) {
        console.error("Video element error:", e, videoEl.error);
        addMessageToUI('Error', `Video playback error: ${videoEl.error ? videoEl.error.message : 'Unknown error'}`);
      };
      
      // Add load handler
      videoEl.onloadeddata = function() {
        console.log("Video data loaded successfully");
        addMessageToUI('System', 'Video loaded successfully');
      };
      
      // Try to play the video
      videoEl.play().then(() => {
        console.log("Video playback started");
      }).catch(function(e) {
        console.warn("Autoplay prevented:", e);
        addMessageToUI('Warning', 'Autoplay prevented. Click the video to play.');
      });
      
      // Process and add subtitles
      if (subtitles.length > 0) {
        processSubtitles(videoEl, subtitles);
      }
      
      // Setup enhanced video controls
      setupEnhancedControls(videoEl, subtitles);
      
      // Generate thumbnail once the video is loaded
      videoEl.addEventListener('loadedmetadata', function() {
        console.log("Video metadata loaded, generating thumbnail");
        generateThumbnail(videoEl);
      });
    });
  } else if (isSubtitle(file.name)) {
    // Handle subtitle files - offer to download them
    console.log("Subtitle file selected, creating download link");
    
    if (videoPlayerEl) {
      videoPlayerEl.innerHTML = `
        <div class="non-video-file">
          <h3>Subtitle File: ${file.name}</h3>
          <p>Size: ${formatBytes(file.length)}</p>
          <p>This is a subtitle file that can be used with compatible video players.</p>
          <button class="download-button">
            <span class="download-icon">⬇️</span> Download Subtitle
          </button>
        </div>
      `;
      
      // Add download handler
      const downloadBtn = videoPlayerEl.querySelector('.download-button');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
          downloadFile(file);
        });
      }
    }
  } else {
    // Handle non-video files
    console.log("Non-video file selected, creating download link");
    
    if (videoPlayerEl) {
      videoPlayerEl.innerHTML = `
        <div class="non-video-file">
          <h3>File: ${file.name}</h3>
          <p>Size: ${formatBytes(file.length)}</p>
          <button class="download-button">
            <span class="download-icon">⬇️</span> Download File
          </button>
        </div>
      `;
      
      // Add download handler
      const downloadBtn = videoPlayerEl.querySelector('.download-button');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
          downloadFile(file);
        });
      }
    }
  }
}

// Process subtitle files and add them to video
function processSubtitles(videoEl, subtitleFiles) {
  if (!videoEl || !subtitleFiles || subtitleFiles.length === 0) return;
  
  // Process each subtitle file
  subtitleFiles.forEach((file, index) => {
    file.getBuffer((err, buffer) => {
      if (err) {
        console.error(`Error loading subtitle file ${file.name}:`, err);
        return;
      }
      
      // Convert buffer to text
      const textDecoder = new TextDecoder('utf-8');
      let subtitleText = textDecoder.decode(buffer);
      
      // Determine subtitle format and convert if needed
      const ext = file.name.split('.').pop().toLowerCase();
      
      // Convert to VTT format if it's SRT
      if (ext === 'srt') {
        subtitleText = convertSrtToVtt(subtitleText);
      }
      
      // Only WebVTT format works reliably with HTML5 video
      if (ext === 'vtt' || ext === 'srt') {
        // Create blob URL for the subtitle
        const blob = new Blob([subtitleText], { type: 'text/vtt' });
        const subtitleUrl = URL.createObjectURL(blob);
        
        // Create track element for the subtitle
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = file.name.split('.').slice(0, -1).join('.');
        track.src = subtitleUrl;
        track.srclang = detectLanguage(file.name) || 'en';
        
        // Make first subtitle default
        if (index === 0) {
          track.default = true;
        }
        
        // Add track to video
        videoEl.appendChild(track);
        console.log(`Added subtitle track: ${file.name}`);
        
        // Clean up URL when video is unloaded
        videoEl.addEventListener('emptied', () => URL.revokeObjectURL(subtitleUrl), { once: true });
      }
    });
  });
}

// Try to detect language from filename
function detectLanguage(filename) {
  // Common language codes in subtitle filenames
  const languagePatterns = {
    'en': /\b(en|eng|english)\b/i,
    'es': /\b(es|esp|spanish)\b/i,
    'fr': /\b(fr|fre|french)\b/i,
    'de': /\b(de|ger|german)\b/i,
    'it': /\b(it|ita|italian)\b/i,
    'ru': /\b(ru|rus|russian)\b/i,
    'ja': /\b(ja|jpn|japanese)\b/i,
    'zh': /\b(zh|chi|chinese)\b/i,
    'ko': /\b(ko|kor|korean)\b/i,
    'pt': /\b(pt|por|portuguese)\b/i,
    'ar': /\b(ar|ara|arabic)\b/i,
    'hi': /\b(hi|hin|hindi)\b/i
  };
  
  for (const [code, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(filename)) {
      return code;
    }
  }
  
  return null; // No language detected
}

// Add enhanced controls to video player
function setupEnhancedControls(video, subtitles = []) {
  if (!video) return;
  
  try {
    // Add wrapper div for custom controls
    const videoContainer = video.parentNode;
    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'enhanced-video-controls';
    
    // Create playback speed control
    const speedControl = document.createElement('div');
    speedControl.className = 'speed-control';
    
    const speedBtn = document.createElement('button');
    speedBtn.className = 'control-btn speed-btn';
    speedBtn.innerHTML = '1x';
    speedBtn.title = 'Playback Speed';
    
    const speedMenu = document.createElement('div');
    speedMenu.className = 'speed-menu';
    speedMenu.style.display = 'none';
    
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    speeds.forEach(speed => {
      const speedOption = document.createElement('div');
      speedOption.className = 'speed-option';
      speedOption.textContent = speed + 'x';
      speedOption.addEventListener('click', () => {
        video.playbackRate = speed;
        speedBtn.innerHTML = speed + 'x';
        speedMenu.style.display = 'none';
      });
      speedMenu.appendChild(speedOption);
    });
    
    speedBtn.addEventListener('click', () => {
      speedMenu.style.display = speedMenu.style.display === 'none' ? 'block' : 'none';
      // Hide captions menu if open
      if (captionMenu) captionMenu.style.display = 'none';
    });
    
    speedControl.appendChild(speedBtn);
    speedControl.appendChild(speedMenu);
    
    // Captions/Subtitles control
    let captionControl, captionBtn, captionMenu;
    
    if (subtitles && subtitles.length > 0) {
      captionControl = document.createElement('div');
      captionControl.className = 'caption-control';
      
      captionBtn = document.createElement('button');
      captionBtn.className = 'control-btn caption-btn';
      captionBtn.innerHTML = 'CC';
      captionBtn.title = 'Captions/Subtitles';
      
      captionMenu = document.createElement('div');
      captionMenu.className = 'caption-menu';
      
      // Add "Off" option
      const offOption = document.createElement('div');
      offOption.className = 'caption-option';
      offOption.textContent = 'Off';
      offOption.addEventListener('click', () => {
        // Disable all tracks
        for (const track of video.textTracks) {
          track.mode = 'disabled';
        }
        
        // Update active state
        captionMenu.querySelectorAll('.caption-option').forEach(option => {
          option.classList.remove('active');
        });
        offOption.classList.add('active');
        
        captionMenu.style.display = 'none';
      });
      captionMenu.appendChild(offOption);
      
      // Add each subtitle option
      subtitles.forEach((file, index) => {
        const captionOption = document.createElement('div');
        captionOption.className = 'caption-option';
        captionOption.textContent = file.name.split('.').slice(0, -1).join('.');
        captionOption.addEventListener('click', () => {
          // Enable this track and disable others
          for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = (i === index) ? 'showing' : 'disabled';
          }
          
          // Update active state
          captionMenu.querySelectorAll('.caption-option').forEach(option => {
            option.classList.remove('active');
          });
          captionOption.classList.add('active');
          
          captionMenu.style.display = 'none';
        });
        
        // Make first subtitle active
        if (index === 0) {
          captionOption.classList.add('active');
        }
        
        captionMenu.appendChild(captionOption);
      });
      
      captionBtn.addEventListener('click', () => {
        captionMenu.style.display = captionMenu.style.display === 'none' ? 'block' : 'none';
        // Hide speed menu if open
        speedMenu.style.display = 'none';
      });
      
      captionControl.appendChild(captionBtn);
      captionControl.appendChild(captionMenu);
    }
    
    // Create PIP button if supported
    if ('pictureInPictureEnabled' in document) {
      const pipBtn = document.createElement('button');
      pipBtn.className = 'control-btn pip-btn';
      pipBtn.innerHTML = '⎔';
      pipBtn.title = 'Picture in Picture';
      
      pipBtn.addEventListener('click', () => {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          video.requestPictureInPicture();
        }
      });
      
      controlsWrapper.appendChild(pipBtn);
    }
    
    // Add fullscreen button if fullscreen API is available
    if (document.fullscreenEnabled || 
        document.webkitFullscreenEnabled || 
        document.msFullscreenEnabled) {
      
      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'control-btn fullscreen-btn';
      fullscreenBtn.innerHTML = '⛶';
      fullscreenBtn.title = 'Fullscreen';
      
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement) {
          if (video.requestFullscreen) {
            video.requestFullscreen();
          } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
          } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
      });
      
      controlsWrapper.appendChild(fullscreenBtn);
    }
    
    // Add controls in the correct order
    if (captionControl) {
      controlsWrapper.appendChild(captionControl);
    }
    
    // Add speed control
    controlsWrapper.appendChild(speedControl);
    
    // Append controls to video container
    videoContainer.appendChild(controlsWrapper);
    
    // Add styles for enhanced controls if not already present
    if (!document.getElementById('enhanced-controls-style')) {
      const style = document.createElement('style');
      style.id = 'enhanced-controls-style';
      style.textContent = `
        .enhanced-video-controls {
          display: flex;
          justify-content: flex-end;
          padding: 8px;
          background: rgba(0,0,0,0.05);
          border-radius: 0 0 4px 4px;
        }
        
        .control-btn {
          background: rgba(255,255,255,0.8);
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 5px 10px;
          margin-left: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        
        .control-btn:hover {
          background: rgba(255,255,255,1);
        }
        
        .speed-control, .caption-control {
          position: relative;
        }
        
        .speed-menu {
          position: absolute;
          bottom: 100%;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 10;
          margin-bottom: 5px;
        }
        
        .speed-option {
          padding: 5px 10px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .speed-option:hover {
          background: #f0f0f0;
        }
        
        .caption-btn {
          font-weight: bold;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (err) {
    console.warn('Could not setup enhanced controls:', err);
  }
}

// Display torrent files in a list
function displayTorrentFiles(torrent) {
  if (!torrentInfoEl) return;
  
  // Create a header for the file list
  const header = document.createElement('h3');
  header.textContent = `${torrent.name || 'Unnamed torrent'} - ${formatBytes(torrent.length)}`;
  
  // Create the file list container
  const fileListContainer = document.createElement('div');
  fileListContainer.className = 'file-list';
  
  // Sort files by size (largest first)
  const sortedFiles = torrent.files.slice().sort((a, b) => b.length - a.length);
  
  // Add each file to the list
  sortedFiles.forEach(function(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    // Highlight video files
    if (isVideo(file.name)) {
      fileItem.classList.add('video-file');
    } else if (isSubtitle(file.name)) {
      fileItem.classList.add('subtitle-file');
    }
    
    // Create file info
    fileItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatBytes(file.length)}</span>
    `;
    
    // Add click handler to select the file
    fileItem.addEventListener('click', function() {
      // Remove active class from all items
      const items = fileListContainer.querySelectorAll('.file-item');
      items.forEach(item => item.classList.remove('active'));
      
      // Add active class to clicked item
      fileItem.classList.add('active');
      
      // Select the file
      selectFile(file);
      addMessageToUI('User', `Selected file: ${file.name}`);
    });
    
    fileListContainer.appendChild(fileItem);
  });
  
  // Clear and update the torrent info element
  torrentInfoEl.innerHTML = '';
  torrentInfoEl.appendChild(header);
  torrentInfoEl.appendChild(fileListContainer);
}

// Update torrent statistics
function updateTorrentStats(torrent) {
  // Update download speed display
  if (downloadSpeedEl) {
    downloadSpeedEl.textContent = formatBytes(torrent.downloadSpeed) + '/s';
  }
  
  // Update upload speed display
  if (uploadSpeedEl) {
    uploadSpeedEl.textContent = formatBytes(torrent.uploadSpeed) + '/s';
  }
  
  // Update peer count display
  if (peerCountEl) {
    peerCountEl.textContent = torrent.numPeers.toString();
  }
  
  // Update progress display
  if (downloadProgressEl) {
    const progress = Math.round(torrent.progress * 100);
    downloadProgressEl.textContent = progress + '%';
    
    // Add progress bar if it doesn't exist
    if (!document.querySelector('.progress-bar-inner')) {
      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      progressBar.innerHTML = '<div class="progress-bar-inner"></div>';
      downloadProgressEl.appendChild(progressBar);
    }
    
    // Update progress bar width
    const progressBarInner = document.querySelector('.progress-bar-inner');
    if (progressBarInner) {
      progressBarInner.style.width = progress + '%';
    }
  }
}

// Helper to select largest video file
function selectLargestVideoFile(torrent) {
  if (!torrent || !torrent.files || torrent.files.length === 0) return;
  
  // Find largest video file
  let largestFile = null;
  let largestSize = 0;
  
  torrent.files.forEach(file => {
    if (isVideo(file.name) && file.length > largestSize) {
      largestFile = file;
      largestSize = file.length;
    }
  });
  
  // If we found a video file, select it
  if (largestFile) {
    console.log(`Auto-selecting largest video file: ${largestFile.name} (${formatBytes(largestFile.length)})`);
    addMessageToUI('System', `Auto-selecting video: ${largestFile.name}`);
    displayFile(largestFile);
  } else {
    addMessageToUI('System', 'No video files found in this torrent');
    if (torrentInfoEl) {
      torrentInfoEl.innerHTML += '<div class="info-banner">No video files found in this torrent.</div>';
    }
  }
}

// Helper to display torrent file list and info
function displayTorrentInfo(torrent) {
  if (!torrentInfoEl) return;
  
  // Clear existing content
  torrentInfoEl.innerHTML = '';
  
  // Create torrent info section
  const infoDiv = document.createElement('div');
  infoDiv.className = 'torrent-info';
  infoDiv.innerHTML = `
    <h3>${escapeHTML(torrent.name)}</h3>
    <div class="info-row">
      <span>Size: ${formatBytes(torrent.length)}</span>
      <span>Files: ${torrent.files.length}</span>
    </div>
  `;
  
  // Create file list
  const fileList = document.createElement('div');
  fileList.className = 'file-list';
  
  // Sort files by size (largest first)
  const sortedFiles = torrent.files.sort((a, b) => b.length - a.length);
  
  sortedFiles.forEach(file => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item';
    if (isVideo(file.name)) fileDiv.classList.add('video-file');
    
    fileDiv.innerHTML = `
      <div class="file-name">${escapeHTML(file.name)}</div>
      <div class="file-size">${formatBytes(file.length)}</div>
    `;
    
    // Add click handler
    fileDiv.addEventListener('click', () => {
      console.log(`Selected file: ${file.name}`);
      addMessageToUI('User', `Selected file: ${file.name}`);
      displayFile(file);
      
      // Remove 'active' class from all file items
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
      // Add 'active' class to this file item
      fileDiv.classList.add('active');
    });
    
    fileList.appendChild(fileDiv);
  });
  
  // Append to torrent info element
  torrentInfoEl.appendChild(infoDiv);
  torrentInfoEl.appendChild(fileList);
  
  // Update status
  if (torrentStatusEl) {
    torrentStatusEl.innerHTML = `<div class="success">Torrent loaded: ${escapeHTML(torrent.name)}</div>`;
  }
}

// Function to load torrent from a file
function loadTorrentFromFile(buffer) {
  console.log("Loading torrent from file buffer");
  addMessageToUI('System', 'Loading torrent from file...');
  
  // Clear any existing torrent
  if (currentTorrent) {
    console.log("Removing existing torrent");
    currentTorrent.destroy();
    currentTorrent = null;
  }
  
  // Reset UI for a new torrent
  resetTorrentUI();
  
  if (!client) {
    console.error("WebTorrent client not initialized");
    addMessageToUI('Error', 'WebTorrent client not initialized');
    return;
  }
  
  try {
    // Add the torrent to the client
    client.add(buffer, function(torrent) {
      currentTorrent = torrent;
      console.log("Torrent added from file:", torrent.name || torrent.infoHash);
      
      // Update UI
      if (torrentStatusEl) {
        torrentStatusEl.textContent = `Loaded: ${torrent.name || 'Unnamed torrent'}`;
      }
      
      addMessageToUI('System', `Torrent loaded: ${torrent.name || 'Unnamed torrent'}`);
      
      // Handle torrent events
      setupTorrentEvents(torrent);
    });
  } catch (error) {
    console.error("Error loading torrent from file:", error);
    addMessageToUI('Error', `Failed to load torrent from file: ${error.message}`);
  }
}

// Function to reset the UI for a new torrent
function resetTorrentUI() {
  console.log("Resetting UI for new torrent");
  
  // Clear video container
  if (videoContainer) {
    videoContainer.innerHTML = '';
  }
  
  // Clear torrent info
  if (torrentInfoEl) {
    torrentInfoEl.innerHTML = '';
  }
  
  // Clear media info
  if (mediaInfoEl) {
    mediaInfoEl.innerHTML = '';
  }
  
  // Reset status
  if (videoStatusEl) {
    videoStatusEl.textContent = 'Loading...';
  }
  
  // Reset statistics
  if (downloadSpeedEl) downloadSpeedEl.textContent = '0 B/s';
  if (uploadSpeedEl) uploadSpeedEl.textContent = '0 B/s';
  if (peerCountEl) peerCountEl.textContent = '0';
  if (downloadProgressEl) downloadProgressEl.textContent = '0%';
}

// Function to handle torrent events
function setupTorrentEvents(torrent) {
  console.log("Setting up torrent events");
  
  // Add to history once we get metadata
  torrent.on('ready', function() {
    console.log("Torrent metadata received");
    addMessageToUI('System', `Torrent metadata received. Contains ${torrent.files.length} files.`);
    
    // Display file list
    displayTorrentFiles(torrent);
    
    // Start downloading the largest video file
    handleTorrentFiles(torrent);
  });
  
  // Progress updates
  torrent.on('download', function(bytes) {
    updateTorrentStats(torrent);
  });
  
  torrent.on('upload', function(bytes) {
    updateTorrentStats(torrent);
  });
  
  // Download complete
  torrent.on('done', function() {
    console.log("Torrent download complete!");
    addMessageToUI('System', 'Torrent download complete!');
    
    if (torrentStatusEl) {
      torrentStatusEl.textContent = 'Download complete!';
    }
  });
  
  // Handle errors
  torrent.on('error', function(err) {
    console.error("Torrent error:", err);
    addMessageToUI('Error', `Torrent error: ${err.message}`);
  });
  
  // Handle warnings
  torrent.on('warning', function(warning) {
    console.warn("Torrent warning:", warning);
  });
  
  // Initial stats update
  updateTorrentStats(torrent);
}

// Handle torrent files (prioritize the largest video file)
function handleTorrentFiles(torrent) {
  console.log("Handling torrent files");
  
  // Find the largest video file
  let largestVideoFile = null;
  let largestSize = 0;
  
  for (let i = 0; i < torrent.files.length; i++) {
    const file = torrent.files[i];
    if (isVideo(file.name) && file.length > largestSize) {
      largestVideoFile = file;
      largestSize = file.length;
    }
  }
  
  if (!largestVideoFile) {
    // If no video file, just use the largest file
    largestVideoFile = torrent.files.reduce((largest, file) => {
      return (!largest || file.length > largest.length) ? file : largest;
    }, null);
  }
  
  if (largestVideoFile) {
    console.log("Selected file for streaming:", largestVideoFile.name);
    addMessageToUI('System', `Selected file: ${largestVideoFile.name} (${formatBytes(largestVideoFile.length)})`);
    
    // Deselect all files except the one we want
    torrent.files.forEach(file => {
      if (file !== largestVideoFile) {
        file.deselect();
      }
    });
    
    // Select the file with high priority
    largestVideoFile.select();
  }
}

// Display a file from the torrent
function displayFile(file) {
  console.log('Displaying file:', file.name, 'Size:', formatBytes(file.length));
  
  // Clear existing content
  if (videoPlayerEl) {
    videoPlayerEl.innerHTML = '';
  }
  
  if (!videoPlayerEl) {
    console.error('Video element not found');
    addMessageToUI('Error', 'Video player element not found in DOM');
    return;
  }
  
  // Check if it's a video file
  if (isVideo(file.name)) {
    console.log('Displaying video file');
    
    // Create video element
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = false;
    video.id = 'torrent-video';
    video.className = 'video-player';
    
    // Add poster image while video loads
    video.poster = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="%23212121"/><text x="320" y="180" font-family="Arial" font-size="32" fill="%23fafafa" text-anchor="middle" dominant-baseline="middle">Loading video...</text></svg>';
    
    // Create source element
    const source = document.createElement('source');
    
    // Set file as source
    file.getBlobURL((err, url) => {
      if (err) {
        console.error('Error getting blob URL', err);
        addMessageToUI('Error', `Failed to load video: ${err.message}`);
        return;
      }
      
      source.src = url;
      source.type = getMediaTypeFromFileName(file.name);
      video.appendChild(source);
      
      // Add video to DOM
      videoPlayerEl.appendChild(video);
      
      // Handle video errors
      video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        addMessageToUI('Error', `Video playback error: ${video.error?.message || 'Unknown error'}`);
      });
      
      // Handle successful load
      video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        addMessageToUI('System', `Video loaded: ${file.name} (${video.videoWidth}x${video.videoHeight})`);
        
        // Setup enhanced video controls
        setupEnhancedControls(video);
      });
    });
  } else if (isImage(file.name)) {
    // Display image files
    console.log('Displaying image file');
    
    file.getBlobURL((err, url) => {
      if (err) {
        console.error('Error getting blob URL', err);
        addMessageToUI('Error', `Failed to load image: ${err.message}`);
        return;
      }
      
      const img = document.createElement('img');
      img.src = url;
      img.className = 'image-preview';
      img.alt = file.name;
      
      videoPlayerEl.appendChild(img);
    });
  } else if (isAudio(file.name)) {
    // Display audio files
    console.log('Displaying audio file');
    
    file.getBlobURL((err, url) => {
      if (err) {
        console.error('Error getting blob URL', err);
        addMessageToUI('Error', `Failed to load audio: ${err.message}`);
        return;
      }
      
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = false;
      
      const source = document.createElement('source');
      source.src = url;
      source.type = getMediaTypeFromFileName(file.name);
      
      audio.appendChild(source);
      
      // Create an audio player wrapper
      const audioWrapper = document.createElement('div');
      audioWrapper.className = 'audio-player-wrapper';
      audioWrapper.innerHTML = `<div class="audio-title">${escapeHTML(file.name)}</div>`;
      audioWrapper.appendChild(audio);
      
      videoPlayerEl.appendChild(audioWrapper);
    });
  } else {
    // For other file types, show download button
    console.log('Displaying download link for non-media file');
    
    const downloadWrapper = document.createElement('div');
    downloadWrapper.className = 'download-wrapper';
    downloadWrapper.innerHTML = `
      <div class="file-preview">
        <div class="file-icon">${getFileIconByExt(file.name)}</div>
        <div class="file-name">${escapeHTML(file.name)}</div>
        <div class="file-size">${formatBytes(file.length)}</div>
      </div>
    `;
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = 'Download File';
    downloadBtn.addEventListener('click', () => {
      console.log('Downloading file:', file.name);
      file.getBlobURL((err, url) => {
        if (err) {
          console.error('Error getting blob URL', err);
          addMessageToUI('Error', `Failed to download file: ${err.message}`);
          return;
        }
        
        // Create temporary link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        
        addMessageToUI('System', `Downloading: ${file.name}`);
      });
    });
    
    downloadWrapper.appendChild(downloadBtn);
    videoPlayerEl.appendChild(downloadWrapper);
  }
  
  // Display file info
  if (torrentInfoEl) {
    const detail = document.createElement('div');
    detail.className = 'file-details';
    detail.innerHTML = `
      <h4>${escapeHTML(file.name)}</h4>
      <p>Size: ${formatBytes(file.length)}</p>
      <p>Type: ${getMediaTypeFromFileName(file.name) || 'Unknown'}</p>
    `;
    
    torrentInfoEl.innerHTML = '';
    torrentInfoEl.appendChild(detail);
  }
}

// Get file icon based on extension
function getFileIconByExt(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const icons = {
    // Document formats
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📄',
    'rtf': '📄',
    
    // Spreadsheets
    'xls': '📊',
    'xlsx': '📊',
    'csv': '📊',
    
    // Presentations
    'ppt': '📊',
    'pptx': '📊',
    
    // Archives
    'zip': '📦',
    'rar': '📦',
    '7z': '📦',
    'tar': '📦',
    'gz': '📦',
    
    // Programming
    'js': '💻',
    'html': '💻',
    'css': '💻',
    'py': '💻',
    'java': '💻',
    'php': '💻',
    'json': '💻',
    
    // Other
    'exe': '⚙️',
    'iso': '💿',
    'torrent': '🔄'
  };
  
  return icons[ext] || '📄'; // Default icon
}

// Utility function to throttle function calls
function throttle(callback, limit) {
  let waiting = false;
  return function() {
    if (!waiting) {
      callback.apply(this, arguments);
      waiting = true;
      setTimeout(function() {
        waiting = false;
      }, limit);
    }
  };
}

// Get media MIME type from filename
function getMediaTypeFromFileName(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  
  // Video formats
  const videoTypes = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogv': 'video/ogg',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp'
  };
  
  // Audio formats
  const audioTypes = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'flac': 'audio/flac',
    'opus': 'audio/opus',
  };
  
  // Image formats
  const imageTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
  };
  
  // Document formats
  const documentTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
  };
  
  // Other formats
  const otherTypes = {
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'gz': 'application/gzip',
    'tar': 'application/x-tar',
    'iso': 'application/x-iso9660-image',
    'torrent': 'application/x-bittorrent',
  };
  
  // Combine all type maps
  const allTypes = {
    ...videoTypes,
    ...audioTypes,
    ...imageTypes,
    ...documentTypes,
    ...otherTypes
  };
  
  return allTypes[ext] || null;
}

// HTML escaping helper to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Find subtitle files that match a video file
function findSubtitlesForVideo(videoFile, torrent) {
  if (!videoFile || !torrent || !torrent.files) return [];
  
  const subtitles = [];
  const videoName = videoFile.name.toLowerCase().replace(/\.[^/.]+$/, ''); // Remove extension
  
  // Look for subtitle files in the torrent
  torrent.files.forEach(file => {
    if (isSubtitle(file.name)) {
      const subtitleName = file.name.toLowerCase().replace(/\.[^/.]+$/, '');
      
      // Check if names match or if subtitle filename contains the video filename
      if (subtitleName === videoName || 
          subtitleName.includes(videoName) || 
          videoName.includes(subtitleName) ||
          // Also check for common subtitle naming patterns
          subtitleName.startsWith(videoName) ||
          (videoName + '.').includes(subtitleName + '.')) {
        subtitles.push(file);
      }
    }
  });
  
  return subtitles;
}
