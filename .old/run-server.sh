#!/bin/bash

# Run Deno server locally for testing
# Make sure you have Deno installed: https://deno.land/

echo "Starting Deno server on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

deno run --allow-net --allow-read --allow-env --unstable-kv server.ts