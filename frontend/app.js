// This is a standalone WebTorrent client without WebRTC/WebSocket dependencies

console.log("App.js loaded.");

document.addEventListener("DOMContentLoaded", () => {
  // UI elements
  const magnetInputEl = document.getElementById('magnet-input');
  const loadTorrentBtnEl = document.getElementById('load-torrent-btn');
  const torrentStatusEl = document.getElementById('torrent-status');
  const downloadSpeedEl = document.getElementById('download-speed');
  const uploadSpeedEl = document.getElementById('upload-speed');
  const peerCountEl = document.getElementById('peer-count');
  const downloadProgressEl = document.getElementById('download-progress');
  let videoPlayerEl = document.getElementById('video-player');
  const messageListEl = document.getElementById('message-list');
  
  // WebTorrent client
  let torrentClient = null;
  let currentTorrent = null;

  // Initialize WebTorrent
  function initWebTorrent() {
    if (typeof WebTorrent === 'undefined') {
      console.error('WebTorrent library not found');
      addMessageToUI('Error', 'WebTorrent library not found. Check your internet connection.');
      return false;
    }
    
    try {
      console.log('Initializing WebTorrent client...');
      addMessageToUI('System', 'Initializing WebTorrent client...');
      
      // Create WebTorrent client with specific configuration to reduce WebRTC dependencies
      const config = {
        tracker: {
          wrtc: false, // Disable WebRTC if possible
          announce: [
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.btorrent.xyz'
          ]
        }
      };
      
      torrentClient = new WebTorrent(config);
      
      torrentClient.on('error', err => {
        console.error('WebTorrent error:', err);
        addMessageToUI('Error', `WebTorrent error: ${err.message}`);
        torrentStatusEl.textContent = 'Error: ' + err.message;
      });
      
      console.log('WebTorrent client initialized');
      addMessageToUI('System', 'WebTorrent client initialized');
      return true;
    } catch (err) {
      console.error('Failed to initialize WebTorrent:', err);
      addMessageToUI('Error', `Failed to initialize WebTorrent: ${err.message}`);
      return false;
    }
  }
  
  // Load a torrent from the magnet URI
  function loadTorrent(magnetURI) {
    addMessageToUI('System', `Loading torrent: ${magnetURI}`);
    
    try {
      // Initialize WebTorrent client if not already done
      if (!torrentClient) {
        console.log("Creating new WebTorrent client");
        initWebTorrent();
      }
      
      // Clean up any existing torrent
      if (currentTorrent) {
        console.log("Removing previous torrent");
        torrentClient.remove(currentTorrent, err => {
          if (err) console.error("Error removing torrent:", err);
        });
        currentTorrent = null;
      }
      
      // Reset video container
      const videoContainer = document.getElementById('video-container');
      if (videoContainer) {
        videoContainer.innerHTML = '';
      }
      
      // Reset video status
      const videoStatus = document.getElementById('video-status');
      if (videoStatus) {
        videoStatus.textContent = '';
        videoStatus.className = 'video-status';
        videoStatus.style.opacity = '0';
      }
      
      // Initialize video player
      const videoEl = document.createElement('video');
      videoEl.id = 'video-player';
      videoEl.controls = true;
      videoEl.autoplay = true;
      videoEl.style.width = '100%';
      videoEl.style.maxWidth = '100%';
      
      // Add video player to container
      if (videoContainer) {
        videoContainer.appendChild(videoEl);
        videoPlayerEl = videoEl;
      }
      
      // Load the new torrent
      torrentClient.add(magnetURI, torrent => {
        console.log("Torrent added, info:", torrent);
        currentTorrent = torrent;
        
        // Update UI with torrent information
        const infoHash = torrent.infoHash.substring(0, 10) + '...';
        addMessageToUI('System', `Torrent loaded! Info hash: ${infoHash}`);
        if (torrentStatusEl) {
          torrentStatusEl.textContent = `Loaded: ${torrent.name || 'Unnamed torrent'}`;
        }
        
        // Set up general event handlers for the torrent
        
        // Progress updates
        torrent.on('download', bytes => {
          updateTorrentStats(torrent);
        });
        
        torrent.on('upload', bytes => {
          updateTorrentStats(torrent);
        });
        
        // Wire up error handling
        torrent.on('error', err => {
          console.error("Torrent error:", err);
          addMessageToUI('Error', `Torrent error: ${err.message}`);
        });
        
        // Initial stats update
        updateTorrentStats(torrent);
        
        // Check if torrent is already complete
        if (torrent.progress === 1) {
          console.log("Torrent is already complete");
          handleCompletedTorrent(torrent);
          return;
        }
        
        // Metadata received - we now know file names and sizes
        torrent.on('ready', () => {
          console.log("Torrent metadata received");
          addMessageToUI('System', `Torrent contains ${torrent.files.length} files`);
          
          // Setup video streaming
          setupTorrentStreaming(torrent);
        });
        
        // Download complete
        torrent.on('done', () => {
          console.log("Torrent download complete!");
          addMessageToUI('System', 'Torrent download complete! Starting final processing...');
          
          // Handle the completed torrent
          handleCompletedTorrent(torrent);
        });
      });
    } catch (err) {
      console.error("Error loading torrent:", err);
      addMessageToUI('Error', `Failed to load torrent: ${err.message}`);
    }
  }
  
  // Setup video streaming from torrent
  function setupTorrentStreaming(torrent) {
    console.log("Setting up torrent streaming, files:", torrent.files.length);
    
    // Exit early if torrent is already done
    if (torrent.done || torrent.progress === 1) {
      console.log("Torrent is already complete, skipping streaming setup");
      return;
    }
    
    // Find the largest video file
    let largestFile = torrent.files.reduce((largest, file) => {
      console.log("Checking file:", file.name, file.length);
      const isVideo = /\.(mp4|mkv|webm|avi)$/i.test(file.name);
      if (isVideo && (!largest || file.length > largest.length)) {
        return file;
      }
      return largest;
    }, null);
    
    if (!largestFile) {
      // If no video file found, just use the largest file
      largestFile = torrent.files.reduce((largest, file) => {
        if (!largest || file.length > largest.length) {
          return file;
        }
        return largest;
      });
    }
    
    if (largestFile) {
      console.log("Streaming file:", largestFile.name, formatBytes(largestFile.length));
      addMessageToUI('System', `Streaming file: ${largestFile.name} (${formatBytes(largestFile.length)})`);
      
      // Prioritize beginning of the file for faster start
      if (largestFile.length > 10 * 1024 * 1024) { // If larger than 10MB
        console.log("Prioritizing beginning of file for faster playback");
        // Use select() with high priority (1) to prioritize this file
        largestFile.select(1);
        
        // Create a stream with range to prioritize the beginning
        const startPieces = Math.ceil(torrent.pieces.length * 0.05);
        console.log(`Prioritizing first ${startPieces} pieces of ${torrent.pieces.length} total`);
      }
      
      // Get video player and status
      const videoEl = videoPlayerEl;
      const videoStatusEl = document.getElementById('video-status');
      
      // Update status
      if (videoStatusEl) {
        videoStatusEl.textContent = 'Buffering video... Please wait';
        videoStatusEl.style.opacity = '1';
        videoStatusEl.className = 'video-status';
      }
      
      // Log file download progress information
      addMessageToUI('System', `Starting video playback. Initial download: ${Math.round(largestFile.progress * 100)}%`);
      
      // Variable to track if we're using the fallback
      let usingFallback = false;
      
      // Add event listeners for video events
      videoEl.addEventListener('canplay', () => {
        console.log('Video can play, enough is buffered');
        if (videoStatusEl) {
          videoStatusEl.textContent = 'Video ready - playback started';
          videoStatusEl.classList.add('success');
          setTimeout(() => {
            if (videoStatusEl) videoStatusEl.style.opacity = '0';
          }, 3000);
        }
      });
      
      videoEl.addEventListener('playing', () => {
        console.log('Video is now playing');
        if (videoStatusEl) {
          videoStatusEl.textContent = 'Video is playing';
          videoStatusEl.classList.add('success');
          setTimeout(() => {
            if (videoStatusEl) videoStatusEl.style.opacity = '0';
          }, 3000);
        }
      });
      
      videoEl.addEventListener('waiting', () => {
        console.log('Video is waiting for more data');
        if (videoStatusEl) {
          videoStatusEl.textContent = 'Buffering... Please wait';
          videoStatusEl.style.opacity = '1';
          videoStatusEl.classList.remove('success');
        }
      });
      
      videoEl.addEventListener('error', (e) => {
        // Only process error if not already using fallback
        if (!usingFallback) {
          console.error('Video error:', e);
          if (videoStatusEl) {
            videoStatusEl.textContent = `Video error: ${videoEl.error ? videoEl.error.message : 'Unknown error'}`;
            videoStatusEl.classList.add('error');
          }
          
          // Try fallback on error
          tryStreamingFallback();
        }
      });
      
      // Double-check that torrent hasn't completed while we were setting up
      if (torrent.done || torrent.progress === 1) {
        console.log("Torrent completed while setting up streaming, using blob instead");
        tryStreamingFallback();
        return;
      }
      
      try {
        // Start with the simplest approach: direct stream to video element via appendTo
        largestFile.appendTo(videoEl, (err) => {
          if (err) {
            console.error("Error appending video:", err);
            if (videoStatusEl) {
              videoStatusEl.textContent = `Error: ${err.message || 'Could not play video'}`;
              videoStatusEl.classList.add('error');
            }
            addMessageToUI('Error', `Video playback error: ${err.message}`);
            
            // Try fallback method
            tryStreamingFallback();
          } else {
            console.log("Video appended successfully");
          }
        });
      } catch (e) {
        console.error("Exception streaming video:", e);
        tryStreamingFallback();
      }
      
      // Fallback streaming method if appendTo fails
      function tryStreamingFallback() {
        if (usingFallback) return; // Prevent multiple fallback attempts
        usingFallback = true;
        
        addMessageToUI('System', 'Trying alternate playback method...');
        
        // Create blob from file when enough has downloaded
        largestFile.getBlobURL((err, url) => {
          if (err) {
            console.error("Error creating blob URL:", err);
            if (videoStatusEl) {
              videoStatusEl.textContent = `Error: ${err.message || 'Could not prepare video'}`;
              videoStatusEl.classList.add('error');
            }
          } else {
            console.log("Created blob URL for playback");
            videoEl.src = url;
            videoEl.load();
            videoEl.play().catch(e => {
              console.warn("Auto-play prevented:", e);
              addMessageToUI('System', 'Please click play to start video');
            });
          }
        });
      }
      
      // Handle download progress specifically for this file
      torrent.on('download', () => {
        const progress = Math.round(largestFile.progress * 100);
        if (progress % 5 === 0) { // Log every 5%
          console.log(`Download progress for ${largestFile.name}: ${progress}%`);
          
          // Give periodic updates about the download
          if (progress % 10 === 0) {
            addMessageToUI('System', `Download progress: ${progress}%`);
          }
        }
      });
    } else {
      console.error("No streamable files found in the torrent");
      addMessageToUI('Error', 'No streamable files found in the torrent');
    }
  }
  
  // Handle a completed torrent
  function handleCompletedTorrent(torrent) {
    console.log("Handling completed torrent");
    
    // Find the largest video file
    const largestFile = torrent.files.reduce((largest, file) => {
      const isVideo = /\.(mp4|mkv|webm|avi)$/i.test(file.name);
      if (isVideo && (!largest || file.length > largest.length)) {
        return file;
      }
      return largest || file; // If no video found, use whatever we have
    }, null);
    
    if (!largestFile) {
      console.error("No files found in completed torrent");
      addMessageToUI('Error', 'No files found in completed torrent');
      return;
    }
    
    console.log("Processing completed file:", largestFile.name);
    addMessageToUI('System', `Processing completed file: ${largestFile.name}`);
    
    // Get video player and status
    const videoEl = videoPlayerEl;
    const videoStatusEl = document.getElementById('video-status');
    
    // Update status
    if (videoStatusEl) {
      videoStatusEl.textContent = 'Processing completed file...';
      videoStatusEl.style.opacity = '1';
      videoStatusEl.className = 'video-status';
    }
    
    // Store current playback position if video is already playing
    let currentTime = 0;
    if (videoEl && !videoEl.paused) {
      currentTime = videoEl.currentTime;
      console.log("Saved playback position:", currentTime);
    }
    
    // Get blob URL for the completed file
    largestFile.getBlobURL((err, url) => {
      if (err) {
        console.error("Error creating blob URL for completed file:", err);
        addMessageToUI('Error', `Failed to process completed file: ${err.message}`);
        return;
      }
      
      console.log("Created blob URL for completed file");
      
      // Set the source of the video
      videoEl.src = url;
      videoEl.load();
      
      // Restore playback position if we had one
      if (currentTime > 0) {
        videoEl.currentTime = currentTime;
        console.log("Restored playback position to:", currentTime);
      }
      
      // Update status if we have one
      if (videoStatusEl) {
        videoStatusEl.textContent = 'Video ready - playback started';
        videoStatusEl.classList.add('success');
        setTimeout(() => {
          if (videoStatusEl) videoStatusEl.style.opacity = '0';
        }, 3000);
      }
      
      // Try to play automatically
      videoEl.play().catch(e => {
        console.warn("Auto-play prevented for completed video:", e);
        addMessageToUI('System', 'Please click play to start video');
      });
    });
  }
  
  // Update torrent statistics in the UI
  function updateTorrentStats(torrent) {
    // Only update if the torrent still exists
    if (!torrent || torrent.destroyed) return;
    
    // Update download speed
    const dlSpeed = formatBytes(torrent.downloadSpeed) + '/s';
    downloadSpeedEl.textContent = dlSpeed;
    
    // Update upload speed
    const ulSpeed = formatBytes(torrent.uploadSpeed) + '/s';
    uploadSpeedEl.textContent = ulSpeed;
    
    // Update peer count
    const peers = torrent.numPeers;
    peerCountEl.textContent = peers;
    
    // Update download progress
    const progress = Math.round(torrent.progress * 100);
    downloadProgressEl.textContent = progress + '%';
    
    // Log stats periodically
    if (torrent.progress < 1) {
      console.log(`Progress: ${progress}%, DL: ${dlSpeed}, UL: ${ulSpeed}, Peers: ${peers}`);
    }
  }
  
  // Format bytes to human-readable format
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  // Add a message to the UI
  function addMessageToUI(sender, text) {
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
        const magnetInputEl = document.getElementById('magnet-input');
        if (magnetInputEl) {
          magnetInputEl.value = text;
        }
      };
      messageEl.appendChild(useButton);
    }
    
    // Add the message to the UI
    messageListEl.appendChild(messageEl);
    messageListEl.scrollTop = messageListEl.scrollHeight;
    
    console.log(`[${sender}] ${text}`);
  }
  
  // Add video-specific styles
  function addVideoStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #video-player {
        max-width: 100%;
        width: 100%;
        background-color: #000;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        min-height: 360px;
      }
      
      .video-status {
        margin-top: 8px;
        padding: 8px;
        background-color: #f8f9fa;
        border-radius: 4px;
        text-align: center;
        font-weight: bold;
        transition: opacity 0.5s ease;
      }
      
      .video-status.success {
        background-color: #d4edda;
        color: #155724;
      }
      
      .video-status.error {
        background-color: #f8d7da;
        color: #721c24;
      }
      
      .message {
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 4px;
        background-color: #f8f9fa;
        border-left: 4px solid #6c757d;
      }
      
      .message .message-time {
        color: #6c757d;
        margin-right: 5px;
      }
      
      .message .message-sender {
        font-weight: bold;
        margin-right: 5px;
      }
      
      .message .message-sender.system {
        color: #fd7e14;
      }
      
      .message .message-sender.error {
        color: #dc3545;
      }
      
      .use-magnet-btn {
        margin-top: 5px;
        padding: 4px 8px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .use-magnet-btn:hover {
        background-color: #0069d9;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Initialize everything
  function init() {
    console.log("Initializing application");
    
    // Add video-specific styles
    addVideoStyles();
    
    // Setup UI event listeners
    loadTorrentBtnEl.addEventListener('click', (event) => {
      console.log("Load torrent button clicked");
      event.preventDefault();
      const magnetURI = magnetInputEl.value.trim();
      console.log("Magnet URI:", magnetURI);
      
      if (magnetURI) {
        console.log("Attempting to load torrent");
        loadTorrent(magnetURI);
      } else {
        console.log("No magnet URI provided");
        addMessageToUI('Error', 'Please enter a valid magnet link or torrent URL');
      }
    });
    
    // Initialize WebTorrent
    initWebTorrent();
    
    // Add a welcome message
    addMessageToUI('System', 'Welcome to TorrentMonkey Streaming Client! Paste a magnet link and click "Load Torrent" to begin.');
    
    // Provide sample magnet links in the UI - fixed complete links
    const sintelMagnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent';
    addMessageToUI('System', 'Sample magnet for Sintel: ' + sintelMagnet);
    
    const bunnyMagnet = 'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fbig-buck-bunny.torrent';
    addMessageToUI('System', 'Sample magnet for Big Buck Bunny: ' + bunnyMagnet);
    
    // Also check if the URL has a magnet parameter
    const urlParams = new URLSearchParams(window.location.search);
    const magnetParam = urlParams.get('magnet');
    if (magnetParam) {
      console.log("Found magnet parameter in URL:", magnetParam);
      magnetInputEl.value = magnetParam;
      loadTorrent(magnetParam);
    }
  }
  
  // Start the application
  init();
});
