#!/usr/bin/env python3
from __future__ import annotations
import argparse, contextlib, http.server, os, socket, sys, threading, time, webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".json": "application/json; charset=utf-8", ".js": "text/javascript; charset=utf-8"}
    def log_message(self, fmt, *args):
        print("[V360] " + fmt % args)


def choose_port(start=8123, attempts=30):
    for port in range(start, start + attempts):
        with contextlib.closing(socket.socket()) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("No available localhost port found")


def main():
    parser = argparse.ArgumentParser(description="Launch the offline V360 direct JSON viewer")
    parser.add_argument("--test", action="store_true", help="start without opening a browser")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    os.chdir(ROOT)
    port = args.port or choose_port()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/report.html"
    print("\nVision 360 direct JSON viewer")
    print("Offline address:", url)
    print("Press Ctrl+C to stop.\n")
    if not args.test:
        threading.Timer(0.7, lambda: webbrowser.open(url, new=1)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nViewer stopped.")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
