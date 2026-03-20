#!/bin/bash
pkill -f "node servidor.js" 2>/dev/null
sleep 1
cd "$(dirname "$0")/backend"
nohup node servidor.js > /tmp/trivio.log 2>&1 &
echo "Servidor iniciado em http://localhost:3001"
echo "PID: $!"
