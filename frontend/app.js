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
  
  // Extract basic media info using the browser's native capabilities
  function extractBasicMediaInfo(file) {
    return new Promise((resolve) => {
      // Create a temporary video element to get basic info
      const tempVideo = document.createElement('video');
      tempVideo.style.display = 'none';
      document.body.appendChild(tempVideo);
      
      // Create object URL for the file
      const objectURL = URL.createObjectURL(file);
      tempVideo.src = objectURL;
      
      // Set up event listeners
      tempVideo.addEventListener('loadedmetadata', () => {
        const basicInfo = {
          duration: tempVideo.duration,
          resolution: `${tempVideo.videoWidth}×${tempVideo.videoHeight}`,
          videoCodec: 'Browser native playback',
          audioCodec: 'Browser native playback',
          fps: 'Not available in browser API',
        };
        
        // Clean up
        document.body.removeChild(tempVideo);
        URL.revokeObjectURL(objectURL);
        
        resolve(basicInfo);
      });
      
      // Handle errors
      tempVideo.addEventListener('error', () => {
        console.error('Error loading video for basic analysis');
        document.body.removeChild(tempVideo);
        URL.revokeObjectURL(objectURL);
        resolve(null);
      });
      
      // Set a timeout in case the video never loads
      setTimeout(() => {
        if (document.body.contains(tempVideo)) {
          document.body.removeChild(tempVideo);
          URL.revokeObjectURL(objectURL);
          resolve(null);
        }
      }, 5000);
      
      // Try to load the video
      tempVideo.load();
    });
  }
  
  // Generate thumbnails from a video file using HTML5 Canvas
  function generateThumbnails(file, numThumbnails = 5) {
    return new Promise((resolve) => {
      // Create a temporary video element for thumbnail generation
      const videoEl = document.createElement('video');
      videoEl.style.display = 'none';
      document.body.appendChild(videoEl);
      
      // Create a canvas for capturing frames
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Create object URL for the file
      const objectURL = URL.createObjectURL(file);
      videoEl.src = objectURL;
      
      // Array to store thumbnail data
      const thumbnails = [];
      
      // Load the video metadata
      videoEl.addEventListener('loadedmetadata', () => {
        // Set canvas dimensions based on video
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        
        // Check if we have a valid duration
        if (!videoEl.duration || isNaN(videoEl.duration) || videoEl.duration === Infinity) {
          console.error('Could not determine video duration for thumbnails');
          cleanup();
          resolve([]);
          return;
        }
        
        console.log(`Video duration for thumbnails: ${videoEl.duration} seconds`);
        addMessageToUI('System', 'Generating video thumbnails...');
        
        // Function to capture a frame at a specific time
        const captureFrame = (time) => {
          return new Promise((resolveFrame) => {
            // Set the video to the specific time
            videoEl.currentTime = time;
            
            // Once the video is seeked to the time, capture the frame
            videoEl.addEventListener('seeked', function onSeeked() {
              // Remove the event listener to avoid multiple calls
              videoEl.removeEventListener('seeked', onSeeked);
              
              // Draw the current frame to the canvas
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              
              // Convert the canvas to a data URL (image)
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
              
              // Store both the URL and the timestamp
              thumbnails.push({
                url: thumbnailUrl,
                time: time,
                formattedTime: formatDuration(time)
              });
              
              // Resolve this frame
              resolveFrame();
            });
          });
        };
        
        // Capture frames sequentially
        const captureFrames = async () => {
          // Calculate time points for thumbnails (evenly distributed)
          const timePoints = [];
          for (let i = 1; i <= numThumbnails; i++) {
            // Skip the very beginning and very end
            const timePoint = (videoEl.duration * i) / (numThumbnails + 1);
            timePoints.push(timePoint);
          }
          
          // Capture each frame sequentially
          for (const time of timePoints) {
            await captureFrame(time);
          }
          
          // Clean up and resolve with all thumbnails
          cleanup();
          console.log(`Generated ${thumbnails.length} thumbnails`);
          resolve(thumbnails);
        };
        
        // Start capturing frames
        captureFrames();
      });
      
      // Handle errors
      videoEl.addEventListener('error', () => {
        console.error('Error loading video for thumbnail generation');
        cleanup();
        resolve([]);
      });
      
      // Cleanup function
      function cleanup() {
        if (document.body.contains(videoEl)) {
          document.body.removeChild(videoEl);
        }
        URL.revokeObjectURL(objectURL);
      }
      
      // Set a timeout in case the video never loads
      setTimeout(() => {
        if (document.body.contains(videoEl)) {
          cleanup();
          resolve([]);
        }
      }, 20000); // Longer timeout for thumbnail generation
      
      // Try to load the video
      videoEl.load();
    });
  }
  
  // Display media information in the UI
  function displayMediaInfo(metadata, thumbnails) {
    if (!metadata) return;
    
    // Create or find the media info container
    let mediaInfoContainer = document.getElementById('media-info-container');
    if (!mediaInfoContainer) {
      mediaInfoContainer = document.createElement('div');
      mediaInfoContainer.id = 'media-info-container';
      
      // Find the appropriate place to insert it
      const videoContainer = document.getElementById('video-container');
      if (videoContainer && videoContainer.parentNode) {
        videoContainer.parentNode.insertBefore(mediaInfoContainer, videoContainer.nextSibling);
      } else {
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
          appContainer.appendChild(mediaInfoContainer);
        }
      }
    }
    
    // Create the content for the media info
    mediaInfoContainer.className = 'media-info-container';
    
    // Construct HTML for the metadata
    let metadataHTML = '<div class="media-metadata">';
    metadataHTML += '<h3>Video Information</h3>';
    metadataHTML += '<table class="metadata-table">';
    
    if (metadata.duration) {
      const formattedDuration = formatDuration(metadata.duration);
      metadataHTML += `<tr><td>Duration</td><td>${formattedDuration}</td></tr>`;
    }
    
    if (metadata.resolution) {
      metadataHTML += `<tr><td>Resolution</td><td>${metadata.resolution}</td></tr>`;
    }
    
    if (metadata.bitrate) {
      metadataHTML += `<tr><td>Bitrate</td><td>${metadata.bitrate}</td></tr>`;
    }
    
    if (metadata.videoCodec) {
      metadataHTML += `<tr><td>Video Codec</td><td>${metadata.videoCodec}</td></tr>`;
    }
    
    if (metadata.audioCodec) {
      metadataHTML += `<tr><td>Audio Codec</td><td>${metadata.audioCodec}</td></tr>`;
    }
    
    if (metadata.fps) {
      metadataHTML += `<tr><td>Frame Rate</td><td>${metadata.fps}</td></tr>`;
    }
    
    metadataHTML += '</table></div>';
    
    // Add thumbnails if available
    let thumbnailsHTML = '';
    if (thumbnails && thumbnails.length > 0) {
      thumbnailsHTML = '<div class="media-thumbnails">';
      thumbnailsHTML += '<h3>Preview Thumbnails</h3>';
      thumbnailsHTML += '<p class="thumbnail-help">Click on any thumbnail to jump to that position in the video</p>';
      thumbnailsHTML += '<div class="thumbnail-container">';
      
      thumbnails.forEach((thumbnail, index) => {
        thumbnailsHTML += `<div class="thumbnail" data-time="${thumbnail.time}">
          <img src="${thumbnail.url}" alt="Thumbnail ${index + 1}">
          <div class="thumbnail-caption">Scene ${index + 1} - ${thumbnail.formattedTime}</div>
        </div>`;
      });
      
      thumbnailsHTML += '</div></div>';
    }
    
    // Set the HTML
    mediaInfoContainer.innerHTML = metadataHTML + thumbnailsHTML;
    
    // Add click event handlers for thumbnails
    if (thumbnails && thumbnails.length > 0) {
      const thumbnailElements = mediaInfoContainer.querySelectorAll('.thumbnail');
      thumbnailElements.forEach(thumbnail => {
        thumbnail.addEventListener('click', function() {
          const time = parseFloat(this.getAttribute('data-time'));
          if (!isNaN(time)) {
            const videoPlayer = document.getElementById('video-player');
            if (videoPlayer) {
              videoPlayer.currentTime = time;
              videoPlayer.play().catch(e => console.warn('Could not autoplay after seek:', e));
              console.log(`Seeked to ${formatDuration(time)}`);
              addMessageToUI('System', `Seeked to ${formatDuration(time)}`);
            }
          }
        });
        thumbnail.style.cursor = 'pointer';
      });
    }
    
    // Add CSS styles if not already added
    if (!document.getElementById('media-info-styles')) {
      const style = document.createElement('style');
      style.id = 'media-info-styles';
      style.textContent = `
        .media-info-container {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .media-metadata h3,
        .media-thumbnails h3 {
          margin-top: 0;
          color: #343a40;
          font-size: 18px;
        }
        
        .metadata-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        
        .metadata-table td {
          padding: 8px;
          border-bottom: 1px solid #dee2e6;
        }
        
        .metadata-table td:first-child {
          font-weight: bold;
          width: 40%;
        }
        
        .thumbnail-help {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 10px;
          font-style: italic;
        }
        
        .thumbnail-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: space-around;
          margin-top: 10px;
        }
        
        .thumbnail {
          width: 160px;
          text-align: center;
          transition: transform 0.2s ease;
        }
        
        .thumbnail:hover {
          transform: scale(1.05);
          box-shadow: 0 3px 7px rgba(0,0,0,0.3);
        }
        
        .thumbnail img {
          width: 100%;
          height: auto;
          border-radius: 3px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        
        .thumbnail-caption {
          margin-top: 5px;
          font-size: 12px;
          color: #6c757d;
        }
      `;
      document.head.appendChild(style);
    }
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
      
      // Create WebTorrent client with enhanced configuration for better streaming
      const config = {
        tracker: {
          wrtc: false, // Disable WebRTC if possible
          announce: [
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.btorrent.xyz',
            'wss://tracker.fastcast.nz'
          ]
        },
        // Configure lower announce interval to find peers faster
        announceList: [
          ['wss://tracker.openwebtorrent.com'],
          ['wss://tracker.btorrent.xyz'],
          ['wss://tracker.fastcast.nz']
        ],
        // More aggressive DHT settings
        dht: { 
          bootstrap: [
            'router.bittorrent.com:6881',
            'dht.transmissionbt.com:6881'
          ]
        },
        // Set to false to use TCPPool for better compatibility
        webSeeds: true,
        // More aggressive connection settings
        maxConns: 100,
        // Better support for streaming
        strategy: 'rarest'
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
      
      // Advanced torrent options for better streaming
      const torrentOptions = {
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz',
          'wss://tracker.fastcast.nz',
          'wss://tracker.webtorrent.dev',
        ],
        path: '/tmp/webtorrent', // Temporary storage path
        destroyStoreOnDestroy: true, // Clean up when destroyed
        strategy: 'sequential' // Important for streaming - get pieces in order
      };
      
      console.log("Adding torrent with streaming options:", torrentOptions);
      
      // Load the new torrent with streaming-optimized options
      torrentClient.add(magnetURI, torrentOptions, torrent => {
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
          
          // Setup video streaming with immediate start
          setupTorrentStreaming(torrent);
        });
        
        // Download complete
        torrent.on('done', () => {
          console.log("Torrent download complete!");
          addMessageToUI('System', 'Torrent download complete! Starting final processing...');
          
          // Handle the completed torrent
          handleCompletedTorrent(torrent);
        });
        
        // Listen for warning events
        torrent.on('warning', (warning) => {
          console.warn('Torrent warning:', warning);
        });
        
        // Listen for wire (peer connection) events for debugging
        torrent.on('wire', (wire, addr) => {
          console.log(`Connected to peer: ${addr}`);
          
          // Listen for download events on this peer
          wire.on('download', (downloaded) => {
            // Each time we get data from this peer
            if (downloaded > 1000000) { // Only log significant chunks (> 1MB)
              console.log(`Downloaded ${formatBytes(downloaded)} from ${addr}`);
            }
          });
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
      console.log("Torrent is already complete, using completed torrent handler");
      handleCompletedTorrent(torrent);
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
      console.log("Selected file for download:", largestFile.name, formatBytes(largestFile.length));
      addMessageToUI('System', `Selected file: ${largestFile.name} (${formatBytes(largestFile.length)})`);
      
      // Prioritization approach for faster download
      console.log("Setting up file prioritization");
      
      // First, deselect all files except the one we want to download
      torrent.files.forEach(file => {
        if (file !== largestFile) {
          file.deselect();
        }
      });
      
      // Select our file with high priority
      largestFile.select(1);
      
      // Get the video status element
      const videoStatusEl = document.getElementById('video-status');
      
      // Update status to show downloading (not streaming)
      if (videoStatusEl) {
        videoStatusEl.textContent = 'Downloading video... Please wait for completion';
        videoStatusEl.style.opacity = '1';
        videoStatusEl.className = 'video-status';
      }
      
      // Clean any existing video player and show download progress indicator
      const videoContainer = document.getElementById('video-container');
      if (videoContainer) {
        // Clear previous content
        videoContainer.innerHTML = '';
        
        // Create a download progress display
        const progressDisplay = document.createElement('div');
        progressDisplay.id = 'download-progress-display';
        progressDisplay.className = 'download-progress-container';
        progressDisplay.innerHTML = `
          <div class="progress-bar-container">
            <div class="progress-bar" id="detailed-progress-bar" style="width: 0%"></div>
          </div>
          <div class="progress-text" id="detailed-progress-text">0%</div>
          <div class="file-info">Downloading: ${largestFile.name}</div>
        `;
        videoContainer.appendChild(progressDisplay);
        
        // Add download info styles if not already added
        if (!document.getElementById('download-progress-styles')) {
          const style = document.createElement('style');
          style.id = 'download-progress-styles';
          style.textContent = `
            .download-progress-container {
              background-color: #f8f9fa;
              border-radius: 4px;
              padding: 20px;
              margin-bottom: 15px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              text-align: center;
            }
            .progress-bar-container {
              height: 24px;
              background-color: #e9ecef;
              border-radius: 4px;
              margin-bottom: 10px;
              overflow: hidden;
            }
            .progress-bar {
              height: 100%;
              background-color: #007bff;
              border-radius: 4px;
              transition: width 0.3s ease;
            }
            .progress-text {
              font-size: 16px;
              font-weight: bold;
              color: #495057;
              margin-bottom: 5px;
            }
            .file-info {
              font-size: 14px;
              color: #6c757d;
              word-break: break-all;
            }
            .action-button {
              margin-top: 15px;
              padding: 8px 16px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            }
            .action-button:hover {
              background-color: #0069d9;
            }
          `;
          document.head.appendChild(style);
        }
      }
      
      // Handle download progress for this file
      torrent.on('download', () => {
        const progress = Math.round(largestFile.progress * 100);
        
        // Update the detailed progress display
        const progressBar = document.getElementById('detailed-progress-bar');
        const progressText = document.getElementById('detailed-progress-text');
        
        if (progressBar) {
          progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
          progressText.textContent = `${progress}%`;
        }
        
        // Log progress at regular intervals
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
    
    // Get video container and status
    const videoContainer = document.getElementById('video-container');
    const videoStatusEl = document.getElementById('video-status');
    
    // Update status
    if (videoStatusEl) {
      videoStatusEl.textContent = 'Processing completed file...';
      videoStatusEl.style.opacity = '1';
      videoStatusEl.className = 'video-status';
    }
    
    // Clean the container first to remove any previous players/elements
    if (videoContainer) {
      videoContainer.innerHTML = '';
    }
    
    try {
      // AVOID WebTorrent's built-in playback methods entirely
      // Instead, get a direct blob URL and create our own video element manually
      console.log("Creating direct Blob URL for playback");
      addMessageToUI('System', 'Preparing video file for playback...');
      
      // Use getBlobURL directly - this avoids the streaming methods that cause conflicts
      largestFile.getBlobURL((err, url) => {
        // Remove the loading indicator
        if (videoContainer) {
          videoContainer.innerHTML = '';
        }
        
        if (err) {
          console.error("Error getting blob URL:", err);
          addMessageToUI('Error', `Failed to prepare video: ${err.message}`);
          
          // Show a manual download option as fallback
          const downloadButton = document.createElement('button');
          downloadButton.className = 'action-button';
          downloadButton.textContent = 'Download File Instead';
          downloadButton.onclick = () => {
            // Try to get the file as a direct download
            window.location.href = largestFile.path || '';
          };
          videoContainer.appendChild(downloadButton);
        } else {
          console.log("Blob URL created:", url);
          
          // Create our own video element manually
          const videoEl = document.createElement('video');
          videoEl.id = 'video-player';
          videoEl.controls = false; // We'll use our custom controls
          videoEl.autoplay = true;
          videoEl.src = url; // Set src directly to the blob URL
          videoEl.style.width = '100%';
          videoEl.style.maxWidth = '100%';
          videoEl.style.backgroundColor = '#000';
          videoEl.style.borderRadius = '4px';
          videoEl.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          videoEl.style.minHeight = '360px';
          
          // Add event listeners
          videoEl.addEventListener('canplay', () => {
            console.log('Video can play now');
            if (videoStatusEl) {
              videoStatusEl.textContent = 'Video ready - playback started';
              videoStatusEl.classList.add('success');
              setTimeout(() => {
                if (videoStatusEl) videoStatusEl.style.opacity = '0';
              }, 3000);
            }
          });
          
          videoEl.addEventListener('error', (e) => {
            console.error('Video playback error:', e);
            addMessageToUI('Error', `Video playback error: ${videoEl.error ? videoEl.error.message : 'Unknown error'}`);
          });
          
          // Clean up the blob URL when done
          videoEl.addEventListener('ended', () => {
            URL.revokeObjectURL(url);
          });
          
          // Create enhanced video player with custom controls instead of adding directly
          const enhancedPlayer = createEnhancedVideoPlayer(videoEl, videoContainer);
          
          // Update reference to video player
          videoPlayerEl = videoEl;
          
          // Get media info using browser capabilities if video file
          if (isVideo(largestFile.name)) {
            addMessageToUI('System', 'Analyzing media with browser capabilities...');
            
            // Get file as blob for analysis
            largestFile.getBlob((err, blob) => {
              if (!err && blob) {
                // Start both operations in parallel
                Promise.all([
                  extractBasicMediaInfo(blob),
                  generateThumbnails(blob)
                ]).then(([metadata, thumbnails]) => {
                  if (metadata) {
                    console.log("Media analysis complete:", metadata);
                    addMessageToUI('System', 'Media analysis complete!');
                    
                    // Display metadata and thumbnails
                    displayMediaInfo(metadata, thumbnails);
                    
                    if (thumbnails && thumbnails.length > 0) {
                      console.log(`Generated ${thumbnails.length} thumbnails`);
                      addMessageToUI('System', `Generated ${thumbnails.length} video preview thumbnails`);
                    }
                  }
                }).catch(error => {
                  console.error("Error during media analysis:", error);
                });
              }
            });
          }
          
          // Try to play (might be blocked by autoplay policy)
          videoEl.load();
          videoEl.play().catch(e => {
            console.warn("Autoplay prevented:", e);
            addMessageToUI('System', 'Please click play to start video');
          });
          
          console.log("Video element created and added to page");
          addMessageToUI('System', 'Video player ready! You can now watch the video.');
          
          // Attach metadata loaded event listener for basic info
          videoEl.addEventListener('loadedmetadata', () => {
            console.log("Video metadata loaded via HTML5 API");
            
            // Create basic metadata from the video element
            const basicMetadata = {
              duration: videoEl.duration,
              resolution: `${videoEl.videoWidth}×${videoEl.videoHeight}`,
              videoCodec: 'Browser native playback',
              audioCodec: 'Browser native playback',
              fps: 'Browser native playback'
            };
            
            // Display this basic metadata
            displayMediaInfo(basicMetadata, []);
          });
        }
      });
    } catch (e) {
      console.error("Error handling completed torrent:", e);
      addMessageToUI('Error', `Failed to process completed file: ${e.message}`);
    }
  }
  
  // Helper function to check if a file is a video
  function isVideo(filename) {
    return /\.(mp4|mkv|webm|avi|mov|flv|wmv)$/i.test(filename);
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
  
  // Create enhanced video player with custom controls
  function createEnhancedVideoPlayer(videoEl, container) {
    // Make sure we have references to the video and container
    if (!videoEl || !container) {
      console.error('Cannot create enhanced video player - missing video element or container');
      return;
    }
    
    // Create a wrapper for the video and controls
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    
    // Move the video element into our wrapper
    videoEl.parentNode.removeChild(videoEl);
    videoWrapper.appendChild(videoEl);
    
    // Create custom controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'custom-controls';
    
    // Play/Pause button
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'control-button play-pause';
    playPauseBtn.innerHTML = '<i class="play-icon">▶</i>';
    playPauseBtn.title = 'Play/Pause';
    
    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const loadProgress = document.createElement('div');
    loadProgress.className = 'load-progress';
    
    const playProgress = document.createElement('div');
    playProgress.className = 'play-progress';
    
    progressBar.appendChild(loadProgress);
    progressBar.appendChild(playProgress);
    progressContainer.appendChild(progressBar);
    
    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    timeDisplay.textContent = '0:00 / 0:00';
    
    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.className = 'volume-container';
    
    const volumeButton = document.createElement('button');
    volumeButton.className = 'control-button volume';
    volumeButton.innerHTML = '<i class="volume-icon">🔊</i>';
    volumeButton.title = 'Mute/Unmute';
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = 0;
    volumeSlider.max = 1;
    volumeSlider.step = 0.1;
    volumeSlider.value = 1;
    volumeSlider.className = 'volume-slider';
    
    volumeContainer.appendChild(volumeButton);
    volumeContainer.appendChild(volumeSlider);
    
    // Playback speed control
    const speedButton = document.createElement('button');
    speedButton.className = 'control-button speed';
    speedButton.textContent = '1x';
    speedButton.title = 'Playback Speed';
    
    // Picture-in-Picture button
    const pipButton = document.createElement('button');
    pipButton.className = 'control-button pip';
    pipButton.innerHTML = '<i class="pip-icon">⤧</i>';
    pipButton.title = 'Picture-in-Picture';
    
    // Fullscreen button
    const fullscreenButton = document.createElement('button');
    fullscreenButton.className = 'control-button fullscreen';
    fullscreenButton.innerHTML = '<i class="fullscreen-icon">⤢</i>';
    fullscreenButton.title = 'Fullscreen';
    
    // Add all elements to the controls container
    controlsContainer.appendChild(playPauseBtn);
    controlsContainer.appendChild(progressContainer);
    controlsContainer.appendChild(timeDisplay);
    controlsContainer.appendChild(volumeContainer);
    controlsContainer.appendChild(speedButton);
    controlsContainer.appendChild(pipButton);
    controlsContainer.appendChild(fullscreenButton);
    
    // Add controls to wrapper
    videoWrapper.appendChild(controlsContainer);
    
    // Add the wrapper to the container
    container.appendChild(videoWrapper);
    
    // Styling for the custom controls
    const style = document.createElement('style');
    style.textContent = `
      .video-wrapper {
        position: relative;
        width: 100%;
        background-color: #000;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .custom-controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 40px;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        padding: 0 10px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .video-wrapper:hover .custom-controls {
        opacity: 1;
      }
      
      .control-button {
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        width: 30px;
        height: 30px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0 5px;
        border-radius: 4px;
      }
      
      .control-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
      
      .progress-container {
        flex-grow: 1;
        height: 10px;
        margin: 0 10px;
        cursor: pointer;
      }
      
      .progress-bar {
        height: 4px;
        width: 100%;
        background-color: rgba(255, 255, 255, 0.2);
        position: relative;
        border-radius: 2px;
      }
      
      .load-progress {
        height: 100%;
        width: 0;
        background-color: rgba(255, 255, 255, 0.4);
        position: absolute;
        border-radius: 2px;
      }
      
      .play-progress {
        height: 100%;
        width: 0;
        background-color: #007bff;
        position: absolute;
        border-radius: 2px;
      }
      
      .time-display {
        color: white;
        font-size: 12px;
        min-width: 80px;
        text-align: center;
      }
      
      .volume-container {
        display: flex;
        align-items: center;
      }
      
      .volume-slider {
        width: 0;
        transition: width 0.3s ease;
        opacity: 0;
      }
      
      .volume-container:hover .volume-slider {
        width: 60px;
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
    
    // Event listeners for the controls
    
    // Play/Pause
    playPauseBtn.addEventListener('click', () => {
      if (videoEl.paused) {
        videoEl.play();
        playPauseBtn.innerHTML = '<i class="play-icon">❙❙</i>';
      } else {
        videoEl.pause();
        playPauseBtn.innerHTML = '<i class="play-icon">▶</i>';
      }
    });
    
    // Update progress bar
    videoEl.addEventListener('timeupdate', () => {
      const currentTime = videoEl.currentTime;
      const duration = videoEl.duration;
      
      // Update play progress
      if (duration > 0) {
        playProgress.style.width = `${(currentTime / duration) * 100}%`;
      }
      
      // Update time display
      timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    });
    
    // Update loaded progress
    videoEl.addEventListener('progress', () => {
      if (videoEl.buffered.length > 0) {
        const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        loadProgress.style.width = `${(bufferedEnd / videoEl.duration) * 100}%`;
      }
    });
    
    // Click on progress bar to seek
    progressContainer.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoEl.currentTime = pos * videoEl.duration;
    });
    
    // Volume controls
    volumeButton.addEventListener('click', () => {
      videoEl.muted = !videoEl.muted;
      volumeButton.innerHTML = videoEl.muted ? 
        '<i class="volume-icon">🔇</i>' : 
        '<i class="volume-icon">🔊</i>';
      volumeSlider.value = videoEl.muted ? 0 : videoEl.volume;
    });
    
    volumeSlider.addEventListener('input', () => {
      videoEl.volume = volumeSlider.value;
      videoEl.muted = (volumeSlider.value === 0);
      volumeButton.innerHTML = (volumeSlider.value === 0) ? 
        '<i class="volume-icon">🔇</i>' : 
        '<i class="volume-icon">🔊</i>';
    });
    
    // Playback speed
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    let currentSpeedIndex = 2; // Default 1x
    
    speedButton.addEventListener('click', () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      const newSpeed = speeds[currentSpeedIndex];
      videoEl.playbackRate = newSpeed;
      speedButton.textContent = `${newSpeed}x`;
    });
    
    // Picture in Picture
    pipButton.addEventListener('click', () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(err => {
          console.error('Failed to exit Picture-in-Picture mode:', err);
        });
      } else {
        if (document.pictureInPictureEnabled) {
          videoEl.requestPictureInPicture().catch(err => {
            console.error('Failed to enter Picture-in-Picture mode:', err);
          });
        } else {
          addMessageToUI('Error', 'Picture-in-Picture mode is not supported in your browser');
        }
      }
    });
    
    // Fullscreen
    fullscreenButton.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.error('Failed to exit fullscreen mode:', err);
        });
      } else {
        videoWrapper.requestFullscreen().catch(err => {
          console.error('Failed to enter fullscreen mode:', err);
        });
      }
    });
    
    // Play/Pause when clicking on video
    videoEl.addEventListener('click', () => {
      if (videoEl.paused) {
        videoEl.play();
        playPauseBtn.innerHTML = '<i class="play-icon">❙❙</i>';
      } else {
        videoEl.pause();
        playPauseBtn.innerHTML = '<i class="play-icon">▶</i>';
      }
    });
    
    // Update play/pause button state based on video events
    videoEl.addEventListener('play', () => {
      playPauseBtn.innerHTML = '<i class="play-icon">❙❙</i>';
    });
    
    videoEl.addEventListener('pause', () => {
      playPauseBtn.innerHTML = '<i class="play-icon">▶</i>';
    });
    
    videoEl.addEventListener('ended', () => {
      playPauseBtn.innerHTML = '<i class="play-icon">▶</i>';
    });
    
    // Helper function to format time in MM:SS
    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    // Return the enhanced video player
    return {
      videoElement: videoEl,
      wrapper: videoWrapper,
      controls: controlsContainer
    };
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
