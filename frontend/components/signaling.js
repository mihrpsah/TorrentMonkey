export function setupWebSocket(url) {
  let ws = null;
  let reconnectAttempt = 0;
  const maxReconnectDelay = 30000; // 30 seconds max delay
  
  function connect() {
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log("WebSocket connection established.");
      reconnectAttempt = 0; // Reset reconnect attempt counter
      
      // Dispatch a custom event that other parts of the app can listen for
      window.dispatchEvent(new CustomEvent('websocket-connected'));
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    ws.onclose = (event) => {
      console.warn(`WebSocket connection closed (${event.code}). Attempting to reconnect...`);
      
      // Calculate reconnect delay with exponential backoff
      const delay = Math.min(Math.pow(2, reconnectAttempt) * 1000, maxReconnectDelay);
      reconnectAttempt++;
      
      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt})...`);
      setTimeout(connect, delay);
      
      // Dispatch a custom event that other parts of the app can listen for
      window.dispatchEvent(new CustomEvent('websocket-disconnected'));
    };
    
    // Add custom send method to handle connection state
    const originalSend = ws.send;
    ws.send = function(data) {
      if (this.readyState === WebSocket.OPEN) {
        return originalSend.call(this, data);
      } else {
        console.warn("Attempted to send message while WebSocket is not open");
        return false;
      }
    };
  }
  
  // Initial connection
  connect();
  
  return ws;
}

function handleSignalingMessage(message) {
  //Handle signaling messages (offer, answer, ICE candidates)
  console.log("Signaling message:", message);
  //dispatch these messages to the peer connection logic
}
