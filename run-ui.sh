#!/bin/bash

# Next UI start is not obeying port specified in .env file. Tries default ports only.
# After starting UI, check it's logs to get the port where it started

# Docker service runner script
# This script checks for .env file, installs dependencies and starts the Node.js service

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found in current directory"
    
    if [ -f ".env.example" ]; then
        echo "Found .env.example file. Copying to .env..."
        cp .env.example .env
        echo "✅ .env file created from template"
        echo ""
        echo "📋 Configuration variables that need to be set:"
        echo "=============================================="
        grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env
        echo "=============================================="
        echo ""
        echo "⚠️  Please edit the .env file with your actual values and re-run this script."
        echo "   You can edit it with: nano .env  or  vim .env  or  code .env"
        exit 0
    else
        echo "No .env.example file found either."
        read -p "Do you want to continue without .env file? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Exiting..."
            exit 1
        fi
    fi
else
    echo ".env file found"
fi

# Load environment variables from .env file
if [ -f ".env" ]; then
    export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | xargs)
fi

# Set default port if not specified in .env
PORT=${PORT:-3001}

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker and try again."
    exit 1
fi

# Check if the Docker image exists
if ! docker image inspect my-centos-node &> /dev/null; then
    echo "❌ Docker image 'my-centos-node' not found"
    echo "Please build the image first or check the image name"
    exit 1
fi

# Check if port is already in use
if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo "⚠️  Port $PORT appears to be in use"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 1
    fi
fi

echo "🔧 Installing dependencies..."
docker run --rm -v $(pwd):/app -w /app my-centos-node npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully. Starting service..."
    echo "🚀 Starting service on port $PORT in background..."
    #docker run --rm -d -v $(pwd):/app -w /app -p $PORT:$PORT --name next-container my-centos-node npm run dev
    docker run --rm -d -v $(pwd):/app -w /app -p $PORT:3000 --name next-container my-centos-node npm run dev
    
    if [ $? -eq 0 ]; then
        echo "✅ Service started successfully in background"
        echo "📋 Container name: mnext-container"
        echo "🌐 Service available at: http://localhost:$PORT"
        echo ""
        echo "Useful commands:"
        echo "  View logs: docker logs next-container"
        echo "  Follow logs: docker logs -f next-container"
        echo "  Stop service: docker stop next-container"
        echo "  Check status: docker ps"
    else
        echo "❌ Failed to start service"
        exit 1
    fi
else
    echo "❌ Failed to install dependencies. Exiting."
    exit 1
fi
