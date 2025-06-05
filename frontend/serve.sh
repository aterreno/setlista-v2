#!/bin/bash

# Check if serve is installed globally
if ! command -v serve &> /dev/null; then
  echo "Installing serve package..."
  npm install -g serve
fi

# Serve the static files from the 'out' directory
echo "Starting static file server on port 3000..."
serve -s out
