#!/bin/bash
kill $(lsof -t -i :3000) 2>/dev/null || true
cd src
python3 -m http.server 3000 > ../server.log 2>&1 &
cd ..
