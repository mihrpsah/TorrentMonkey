import os
import http.server
import socketserver
import argparse
import sys

class BetterHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow requests from anywhere
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Override to provide more concise logging
        sys.stdout.write("%s - %s\n" % (self.address_string(), format % args))
        sys.stdout.flush()

    def copyfile(self, source, outputfile):
        """Copy file with better error handling for broken pipes"""
        try:
            super().copyfile(source, outputfile)
        except BrokenPipeError:
            # Just log the error but don't crash the server
            self.log_message("Broken pipe error during file transfer - client disconnected")
        except ConnectionResetError:
            # Just log the error but don't crash the server
            self.log_message("Connection reset during file transfer - client disconnected")

def run_server(port=8000, directory=None):
    handler = BetterHTTPRequestHandler
    
    # Set the directory to serve from
    if directory:
        os.chdir(directory)
        handler.directory = directory
    
    # Test if the port is available
    try:
        httpd = socketserver.ThreadingTCPServer(("", port), handler)
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"Port {port} is already in use. Trying a different port...")
            port = 8080
            try:
                httpd = socketserver.ThreadingTCPServer(("", port), handler)
            except OSError:
                print(f"Port {port} is also in use. Please free up a port and try again.")
                return
        else:
            print(f"Error starting server: {e}")
            return

    print(f"Starting Torrent Monkey server on port {port}...")
    print(f"Open your browser and visit: http://localhost:{port}")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server error: {e}")
    finally:
        httpd.server_close()
        print("Server shutdown complete")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simple HTTP Server with error handling")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("--dir", type=str, default=".", help="Directory to serve files from")
    args = parser.parse_args()
    
    run_server(port=args.port, directory=args.dir) 