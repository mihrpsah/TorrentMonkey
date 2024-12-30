// import { setupWebSocket } from "./components/signaling.js";
// import { createPeerConnection } from "./components/peer-connection.js";

// // Initialize WebRTC and WebSocket
// console.log("App.js loaded.");

// document.addEventListener("DOMContentLoaded", () => {
//   const ws = setupWebSocket("ws://localhost:8080/ws"); // Initialize WebSocket
//   const peerConnection = createPeerConnection(ws); // Initialize WebRTC connection

//   console.log("WebRTC and signaling initialized.");
// });

//test

import { setupWebSocket } from "./components/signaling.js";
import { createPeerConnection } from "./components/peer-connection.js";

// Initialize WebRTC and WebSocket
console.log("App.js loaded.");

document.addEventListener("DOMContentLoaded", () => {
  const ws = setupWebSocket("ws://localhost:8080/ws"); // Initialize WebSocket
  const peerConnection = createPeerConnection(ws); // Initialize WebRTC connection

  console.log("WebRTC and signaling initialized.");

  // Test: Create an offer and send it to the server
  // peerConnection
  //   .createOffer()
  //   .then((offer) => {
  //     console.log("Created offer:", offer);
  //     return peerConnection.setLocalDescription(offer); // Set the local description
  //   })
  //   .then(() => {
  //     ws.send(
  //       JSON.stringify({
  //         type: "offer",
  //         data: peerConnection.localDescription,
  //       }),
  //     ); // Send the offer via WebSocket
  //     console.log("Offer sent via WebSocket.");
  //   })
  //   .catch((error) => {
  //     console.error("Error creating or sending offer:", error);
  //   });

  if (peerConnection.signalingState === "stable") {
    peerConnection
      .createOffer()
      .then((offer) => {
        console.log("Created offer:", offer);
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        ws.send(
          JSON.stringify({
            type: "offer",
            data: peerConnection.localDescription,
          }),
        );
        console.log("Offer sent via WebSocket.");
      })
      .catch((error) =>
        console.error("Error creating or sending offer:", error),
      );
  } else {
    console.error("PeerConnection is not in a stable state.");
  }

  // Log connection state changes (optional for debugging)
  peerConnection.onconnectionstatechange = () => {
    console.log("Connection state:", peerConnection.connectionState);
  };

  // Log ICE candidate events (optional for debugging)
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Generated ICE candidate:", event.candidate);
      ws.send(JSON.stringify({ type: "candidate", data: event.candidate }));
    }
  };

  // Handle incoming ICE candidates from the signaling server
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "candidate") {
      console.log("Received ICE candidate from server:", message.data);
      peerConnection.addIceCandidate(message.data).catch(console.error);
    }
  };
});
