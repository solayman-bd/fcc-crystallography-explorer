"""Optional local launcher: serve the app on localhost and open it in the default browser.

Double-clicking FCC-Explorer.html works too; this is for browsers or setups that
restrict file:// pages. Only the Python standard library is used.

Usage:
    python serve.py [FCC-Explorer.html] [--port 8000]
"""

import argparse
import functools
import http.server
import threading
import webbrowser
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Serve FCC Crystallography Explorer locally.")
    parser.add_argument("file", nargs="?", default="FCC-Explorer.html", help="HTML file to serve")
    parser.add_argument("--port", type=int, default=8000, help="port on 127.0.0.1 (default 8000)")
    args = parser.parse_args()

    page = Path(args.file).resolve()
    if not page.is_file():
        raise SystemExit(f"Not found: {page}")

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(page.parent))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        url = f"http://127.0.0.1:{server.server_address[1]}/{page.name}"
        print(f"Serving {page.name} at {url}  (Ctrl+C to stop)")
        threading.Timer(0.5, webbrowser.open, [url]).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
