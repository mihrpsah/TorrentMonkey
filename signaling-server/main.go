package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

//

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

//

var clients = make(map[*websocket.Conn]bool)
var broadcast = make(chan Message)

type Message struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading to WebSocket: %v", err)
		return
	}
	defer ws.Close()

	clients[ws] = true
	log.Printf("New connection from: %s", r.RemoteAddr)

	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}
		log.Printf("Received message: %v", msg)
		broadcast <- msg
	}
}

//

//	func handleMessages() {
//		for {
//			msg := <-broadcast
//			for client := range clients {
//				err := client.WriteJSON(msg)
//				if err != nil {
//					log.Printf("Error writing message: %v", err)
//					client.Close()
//					delete(clients, client)
//				}
//			}
//		}
//	}
func handleMessages() {
	for {
		msg := <-broadcast
		log.Printf("Broadcasting message: %v", msg)

		for client := range clients {
			log.Printf("Sending to client: %v", client.RemoteAddr()) // Debugging log
			err := client.WriteJSON(msg)
			if err != nil {
				log.Printf("Error writing message: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

//

func main() {
	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)

	http.HandleFunc("/ws", handleConnections)

	go handleMessages()

	log.Println("Server started on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
