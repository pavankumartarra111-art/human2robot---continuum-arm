#!/usr/bin/env python3
"""
Local HTTP Server for Continuum Morph-Arm Simulation
Provides localhost origin required for browser camera/MediaPipe permissions.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class SimulationHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin isolation and resource sharing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), SimulationHTTPHandler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("=" * 60)
        print("  CONTINUUM MORPH-ARM SIMULATION WORKCELL")
        print("=" * 60)
        print(f"Server running at: {url}")
        print("Serving files with CORS and no-cache headers.")
        print("Press Ctrl+C to terminate the server.")
        print("=" * 60)
        
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()

if __name__ == '__main__':
    main()
