// This is a standalone WebTorrent client without WebRTC/WebSocket dependencies

console.log("App.js loaded.");

// Global variables that will be used across functions
let magnetInputEl, loadTorrentBtnEl, torrentStatusEl, downloadSpeedEl, uploadSpeedEl;
let peerCountEl, downloadProgressEl, videoContainer, videoPlayerEl, messageListEl;
let torrentInfoEl, messagesEl, mediaInfoEl, videoStatusEl, historyContainerEl;
let client, currentTorrent;
let torrentHistory = [];
const MAX_HISTORY_ITEMS = 10;
let defaultTrackers = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.files.fm:7073/announce',
  'wss://spacetradersapi-chatbox.herokuapp.com:443/announce',
  'wss://tracker.sloppyta.co:443/announce'
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
  historyContainerEl = document.getElementById('history-container');
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
    // Better STUN server configuration for better peer connectivity
    const rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
      ],
      sdpSemantics: 'unified-plan'
    };
    
    // Initialize the client with improved configuration
    client = new WebTorrent({
      tracker: {
        rtcConfig,
        announce: defaultTrackers
      },
      maxConns: 100,       // Maximum number of connections per torrent (default=55)
      dht: true,           // Enable DHT by default (helps finding more peers)
      webSeeds: true       // Enable WebSeeds (HTTP sources for torrent data)
    });
    
    // Handle client errors
    client.on('error', function(err) {
      console.error('WebTorrent client error:', err);
      
      // Different user messages based on error types
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
    
    // Handle client warnings
    client.on('warning', function(warning) {
      console.warn('WebTorrent warning:', warning);
      
      // Only show important warnings to the user
      if (warning.message && warning.message.includes('tracker')) {
        addMessageToUI('Warning', `Tracker issue: ${warning.message}`);
      }
    });
    
    console.log("WebTorrent client initialized successfully");
    addMessageToUI('System', 'WebTorrent client initialized');
    
    // Load torrent history
    // loadTorrentHistory(); // Will implement later
    
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
  
  console.log("Initialization complete");
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
    torrentStatusEl.innerHTML = '<div class="loading">Loading torrent metadata... <div class="spinner"></div></div>';
  }
  
  if (torrentInfoEl) {
    torrentInfoEl.innerHTML = '';
  }
  
  if (videoPlayerEl) {
    videoPlayerEl.innerHTML = '';
  }
  
  try {
    // Remove old torrents first to free resources
    if (client.torrents.length > 0) {
      console.log(`Removing ${client.torrents.length} existing torrents before loading new one`);
      client.torrents.forEach(t => t.destroy());
    }
    
    // Add the new torrent
    let torrent = client.add(magnetURI, {
      announce: defaultTrackers
    });
    
    addMessageToUI('System', `Connecting to peers for: ${magnetURI.substring(0, 50)}...`);
    
    // Store current torrent for global access
    currentTorrent = torrent;
    
    // Set a timeout for stalled torrent loading
    const torrentTimeout = setTimeout(() => {
      if (!torrent.ready) {
        addMessageToUI('Warning', 'Torrent is taking a long time to load. No peers found or slow connection.');
        if (torrentStatusEl) {
          torrentStatusEl.innerHTML += '<div class="warning">No peers found or connection is slow. The torrent may not load.</div>';
        }
      }
    }, 20000); // 20 seconds timeout
    
    // Handle torrent events
    torrent.on('infoHash', function() {
      console.log('Torrent info hash:', torrent.infoHash);
      addMessageToUI('System', `Torrent added with hash: ${torrent.infoHash}`);
    });
    
    torrent.on('ready', function() {
      console.log('Torrent metadata received');
      clearTimeout(torrentTimeout);
      
      addMessageToUI('System', `Metadata received for: ${torrent.name}`);
      addMessageToUI('System', `Files: ${torrent.files.length}`);
      
      // Add to history (if implemented)
      // addTorrentToHistory(torrent);
      
      // Display torrent info
      displayTorrentInfo(torrent);
      
      // Select the largest video file by default
      selectLargestVideoFile(torrent);
    });
    
    torrent.on('warning', function(warning) {
      console.warn('Torrent warning:', warning);
      addMessageToUI('Warning', `Torrent warning: ${warning.message || warning}`);
    });
    
    torrent.on('error', function(err) {
      console.error('Torrent error:', err);
      addMessageToUI('Error', `Torrent error: ${err.message || err}`);
      
      if (torrentStatusEl) {
        torrentStatusEl.innerHTML = `<div class="error">Torrent error: ${err.message || err}</div>`;
      }
    });
    
    torrent.on('download', throttle(function() {
      updateStats(torrent);
    }, 1000));
    
    torrent.on('wire', function(wire, addr) {
      console.log(`Connected to peer: ${addr}`);
      updateStats(torrent);
    });
    
    torrent.on('noPeers', function(announceType) {
      console.warn(`No peers: ${announceType}`);
      addMessageToUI('Warning', `No peers found for ${announceType}`);
    });
    
  } catch (err) {
    console.error("Error loading torrent:", err);
    addMessageToUI('Error', `Failed to load torrent: ${err.message}`);
    
    if (torrentStatusEl) {
      torrentStatusEl.innerHTML = `<div class="error">Failed to load torrent: ${err.message}</div>`;
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
    
    // Add to history
    // addTorrentToHistory(torrent); // Will implement later
    
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

// Update torrent statistics
function updateTorrentStats(torrent) {
  if (!torrent) return;
  
  // Download speed
  if (downloadSpeedEl) {
    downloadSpeedEl.textContent = formatBytes(torrent.downloadSpeed) + '/s';
  }
  
  // Upload speed
  if (uploadSpeedEl) {
    uploadSpeedEl.textContent = formatBytes(torrent.uploadSpeed) + '/s';
  }
  
  // Peer count
  if (peerCountEl) {
    peerCountEl.textContent = torrent.numPeers.toString();
  }
  
  // Progress percentage
  if (downloadProgressEl) {
    const progress = Math.round(torrent.progress * 100);
    downloadProgressEl.textContent = progress + '%';
  }
}

// Display torrent files
function displayTorrentFiles(torrent) {
  if (!torrentInfoEl) return;
  
  const fileListHTML = `
    <h3>Files in Torrent</h3>
    <div class="file-list">
      ${torrent.files.map((file, index) => `
        <div class="file-item">
          <span class="file-name">${file.name}</span>
          <span class="file-size">${formatBytes(file.length)}</span>
        </div>
      `).join('')}
    </div>
  `;
  
  torrentInfoEl.innerHTML = fileListHTML;
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
        
        // Try to add enhanced controls if available
        try {
          setupEnhancedControls(video);
        } catch (err) {
          console.warn('Could not set up enhanced controls:', err);
        }
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

// Add enhanced controls to video player
function setupEnhancedControls(video) {
  if (!video) return;
  
  try {
    // Add fullscreen button if fullscreen API is available
    if (document.fullscreenEnabled || 
        document.webkitFullscreenEnabled || 
        document.msFullscreenEnabled) {
      
      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'fullscreen-btn';
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
      
      // Append to video container
      video.parentNode.appendChild(fullscreenBtn);
    }
  } catch (err) {
    console.warn('Could not setup enhanced controls:', err);
  }
}

// Update torrent statistics
function updateStats(torrent) {
  if (!torrent || !torrentStatusEl) return;
  
  const progress = Math.round(torrent.progress * 100 * 100) / 100; // Two decimal places
  const downloaded = formatBytes(torrent.downloaded);
  const speed = formatBytes(torrent.downloadSpeed) + '/s';
  const peers = torrent.numPeers;
  
  // Create HTML for stats
  const statsHTML = `
    <div class="torrent-stats">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
        <div class="progress-text">${progress}%</div>
      </div>
      <div class="stats-info">
        <span class="stat-item">⬇️ ${speed}</span>
        <span class="stat-item">✓ ${downloaded}</span>
        <span class="stat-item">👥 ${peers} peers</span>
      </div>
    </div>
  `;
  
  // Update UI
  torrentStatusEl.innerHTML = statsHTML;
  
  // Add some CSS for stats if not already present
  if (!document.getElementById('torrent-stats-style')) {
    const style = document.createElement('style');
    style.id = 'torrent-stats-style';
    style.textContent = `
      .torrent-stats {
        padding: 10px;
        border-radius: 4px;
        background: rgba(0,0,0,0.05);
        margin-top: 10px;
      }
      .progress-bar {
        height: 20px;
        background: #e0e0e0;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
        margin-bottom: 10px;
      }
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #2196F3, #00BCD4);
        transition: width 0.5s ease;
      }
      .progress-text {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        text-align: center;
        line-height: 20px;
        font-weight: bold;
        color: #444;
        text-shadow: 0 0 2px rgba(255,255,255,0.7);
      }
      .stats-info {
        display: flex;
        justify-content: space-between;
      }
      .stat-item {
        font-size: 0.9em;
        background: rgba(0,0,0,0.05);
        padding: 3px 8px;
        border-radius: 12px;
      }
    `;
    document.head.appendChild(style);
  }
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

// Helper to check if file is an image
function isImage(fileName) {
  return /\.(jpe?g|png|gif|bmp|webp|svg)$/i.test(fileName);
}

// Helper to check if file is an audio file
function isAudio(fileName) {
  return /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(fileName);
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
