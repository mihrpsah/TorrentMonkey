export function setupWebSocket(url) {
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WebSocket connection established.");
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "candidate") {
      peerConnection
        .addIceCandidate(new RTCIceCandidate(message.data))
        .then(() => console.log("Added ICE candidate."))
        .catch((err) => console.error("Failed to add ICE candidate:", err));
    }
  };

  ws.onerror = (error) => console.error("WebSocket error:", error);
  ws.onclose = () => {
    console.warn("WebSocket connection closed. Attempting to reconnect...");
    // Optionally, add logic here to reconnect the WebSocket if needed.
  };

  return ws;
}

function handleSignalingMessage(message) {
  // Handle signaling messages (offer, answer, ICE candidates)
  console.log("Signaling message:", message);
  // You can dispatch these messages to the peer connection logic
}
