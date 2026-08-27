#!/bin/bash
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 server.py
else
  echo "Python 3 is required to launch the offline JSON viewer."
  read -p "Press Return to close."
fi
