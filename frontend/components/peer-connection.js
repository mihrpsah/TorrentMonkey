// export function createPeerConnection(ws) {
//   const peerConnection = new RTCPeerConnection({
//     iceServers: [
//       { urls: "stun:stun.l.google.com:19302" }, // Public STUN server
//     ],
//   });

//   // Handle ICE candidates
//   peerConnection.onicecandidate = (event) => {
//     if (event.candidate) {
//       console.log("Sending ICE candidate:", event.candidate);
//       ws.send(JSON.stringify({ type: "ice-candidate", data: event.candidate }));
//     }
//   };

//   // Handle data channel
//   const dataChannel = peerConnection.createDataChannel("data");
//   dataChannel.onopen = () => console.log("Data channel opened.");
//   dataChannel.onmessage = (event) =>
//     console.log("Received message from peer:", event.data);

//   console.log("Peer connection initialized.");
//   return peerConnection;
// }
//
// original up

export function createPeerConnection(ws) {
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }, // Public STUN server
    ],
  });

  // Queue to hold ICE candidates if WebSocket is not yet open
  const iceCandidateQueue = [];

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Generated ICE candidate:", event.candidate);

      // If WebSocket is open, send immediately
      if (ws.readyState === WebSocket.OPEN) {
        console.log("Sending ICE candidate:", event.candidate);
        ws.send(JSON.stringify({ type: "candidate", data: event.candidate }));
      } else {
        // Otherwise, queue the candidate to send later
        iceCandidateQueue.push(event.candidate);
      }
    } else {
      console.log("ICE gathering complete.");
    }
  };

  // Check if WebSocket is connected and send queued candidates if any
  ws.onopen = () => {
    console.log("WebSocket connected, sending queued ICE candidates.");
    iceCandidateQueue.forEach((candidate) => {
      ws.send(JSON.stringify({ type: "candidate", data: candidate }));
    });
    iceCandidateQueue.length = 0; // Clear the queue after sending
  };

  // Handle data channel
  const dataChannel = peerConnection.createDataChannel("data");
  dataChannel.onopen = () => console.log("Data channel opened.");
  dataChannel.onmessage = (event) =>
    console.log("Received message from peer:", event.data);

  console.log("Peer connection initialized.");
  return peerConnection;
}
