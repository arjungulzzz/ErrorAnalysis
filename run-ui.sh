#!/bin/bash

# Enhanced Next.js UI Docker Service Runner
# This script manages Docker containers for Next.js applications with proper port handling

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

# Configuration variables
readonly CONTAINER_NAME="next-container"
readonly DOCKER_IMAGE="my-centos-node"
readonly DEFAULT_PORT=3000
readonly SCRIPT_NAME="$(basename "$0")"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

# Cleanup function for errors and interruptions
cleanup_on_error() {
    log_info "Performing cleanup due to error or interruption..."
    
    # Stop and remove container if it exists
    if docker ps -a --format "table {{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Stopping and removing existing container: ${CONTAINER_NAME}"
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}" 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Function to disable cleanup trap (called on successful completion)
disable_cleanup_trap() {
    trap - INT TERM
}

# Signal handlers for graceful shutdown on interruption only
trap 'echo ""; log_warning "Interrupted by user"; cleanup_on_error; exit 130' INT TERM

# Function to check if container is running
is_container_running() {
    docker ps --format "table {{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if container exists (running or stopped)
container_exists() {
    docker ps -a --format "table {{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if port is available
is_port_available() {
    local port="$1"
    ! (netstat -tuln 2>/dev/null | grep -q ":${port} " || ss -tuln 2>/dev/null | grep -q ":${port} ")
}

# Function to get local IP address
get_local_ip() {
    local local_ip=""
    
    # Try different methods to get local IP
    if command -v ip &> /dev/null; then
        local_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    elif command -v ifconfig &> /dev/null; then
        local_ip=$(ifconfig | grep -E 'inet ([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    elif command -v hostname &> /dev/null; then
        local_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    echo "$local_ip"
}

# Function to display service URLs
display_service_urls() {
    local port="$1"
    
    log_success "Next.js UI started successfully in background"
    echo "📋 Container name: ${CONTAINER_NAME}"
    echo "🌐 UI available at:"
    echo "   • http://localhost:${port}"
    echo "   • http://127.0.0.1:${port}"
    
    # Get and display hostname
    if command -v hostname &> /dev/null; then
        local hostname
        hostname=$(hostname)
        echo "   • http://${hostname}:${port}"
    fi
    
    # Get and display local IP
    local local_ip
    local_ip=$(get_local_ip)
    if [[ -n "$local_ip" && "$local_ip" != "127.0.0.1" ]]; then
        echo "   • http://${local_ip}:${port}"
    fi
}

# Function to display helpful commands
display_helpful_commands() {
    echo ""
    echo "Useful commands:"
    echo "  View logs: docker logs ${CONTAINER_NAME}"
    echo "  Follow logs: docker logs -f ${CONTAINER_NAME}"
    echo "  Stop service: docker stop ${CONTAINER_NAME}"
    echo "  Check status: docker ps"
    echo "  Restart service: docker restart ${CONTAINER_NAME}"
    echo ""
    echo "To perform cleanup manually, run: docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME}"
    echo ""
    log_warning "Note: Next.js might show a different port in logs if the specified port is unavailable"
    echo "Check the container logs to see the actual port where Next.js is running"
}

# Function to handle .env file
handle_env_file() {
    if [[ ! -f ".env" ]]; then
        log_warning ".env file not found in current directory"
        
        if [[ -f ".env.example" ]]; then
            log_info "Found .env.example file. Copying to .env..."
            cp .env.example .env
            log_success ".env file created from template"
            echo ""
            echo "📋 Configuration variables that need to be set:"
            echo "=============================================="
            grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env
            echo "=============================================="
            echo ""
            log_warning "Please edit the .env file with your actual values and re-run this script."
            echo "   You can edit it with: nano .env  or  vim .env  or  code .env"
            exit 0
        else
            log_error "No .env.example file found either."
            read -p "Do you want to continue without .env file? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Exiting..."
                exit 0
            fi
        fi
    else
        log_success ".env file found"
    fi
}

# Function to load environment variables
load_env_vars() {
    if [[ -f ".env" ]]; then
        # Use a safer method to load environment variables
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z "$key" ]] && continue
            
            # Export the variable
            export "$key"="$value"
        done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env)
    fi
}

# Function to check Docker prerequisites
check_docker_prerequisites() {
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        cleanup_on_error
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker and try again."
        cleanup_on_error
        exit 1
    fi

    # Check if the Docker image exists
    if ! docker image inspect "$DOCKER_IMAGE" &> /dev/null; then
        log_error "Docker image '$DOCKER_IMAGE' not found"
        echo "Please build the image first or check the image name"
        cleanup_on_error
        exit 1
    fi
}

# Function to handle existing containers
handle_existing_container() {
    if is_container_running; then
        log_warning "Container '$CONTAINER_NAME' is already running"
        read -p "Do you want to restart it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restarting existing container..."
            docker stop "$CONTAINER_NAME"
            # Wait for container to fully stop
            sleep 2
            docker rm "$CONTAINER_NAME" 2>/dev/null || true
        else
            log_info "Exiting..."
            exit 0
        fi
    elif container_exists; then
        log_info "Removing stopped container: $CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
    fi
}

# Function to check port availability
check_port_availability() {
    local port="$1"
    
    if ! is_port_available "$port"; then
        log_warning "Port $port appears to be in use"
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Exiting..."
            exit 0
        fi
    fi
}

# Function to install dependencies
install_dependencies() {
    log_info "Cleaning old installation and installing dependencies..."
    
    if ! docker run --rm -v "$(pwd):/app" -w /app "$DOCKER_IMAGE" sh -c "
        rm -rf node_modules package-lock.json && 
        npm install
    "; then
        log_error "Failed to install dependencies"
        cleanup_on_error
        exit 1
    fi
    
    log_success "Dependencies installed successfully"
}

# Function to start the Next.js service
start_nextjs_service() {
    local port="$1"
    
    log_info "Starting Next.js UI on port $port in background..."
    
    # Create a startup script that properly configures Next.js port
    local startup_script="
        export PORT=$port
        export NEXT_PUBLIC_PORT=$port
        echo 'Starting Next.js on port $port...'
        echo 'Environment variables:'
        echo 'PORT='$port
        echo 'NEXT_PUBLIC_PORT='$port
        npm run dev -- --port $port --hostname 0.0.0.0
    "
    
    # Start the container with proper environment variables and port mapping
    if ! docker run --rm -d \
        -v "$(pwd):/app" \
        -w /app \
        -p "$port:$port" \
        -e "PORT=$port" \
        -e "NEXT_PUBLIC_PORT=$port" \
        -e "HOSTNAME=0.0.0.0" \
        --name "$CONTAINER_NAME" \
        "$DOCKER_IMAGE" \
        sh -c "$startup_script"; then
        log_error "Failed to start Next.js service"
        cleanup_on_error
        exit 1
    fi
    
    # Wait a moment for the service to start
    sleep 3
    
    # Display service information
    display_service_urls "$port"
    display_helpful_commands
    
    # Show initial logs to help with troubleshooting
    echo ""
    log_info "Initial container logs:"
    echo "========================"
    docker logs "$CONTAINER_NAME" 2>/dev/null || true
    echo "========================"
    
    # Disable cleanup trap since service started successfully
    disable_cleanup_trap
}

# Main function
main() {
    log_info "Starting $SCRIPT_NAME for Next.js UI..."
    
    # Handle .env file
    handle_env_file
    
    # Load environment variables
    load_env_vars
    
    # Set port (from environment or default)
    local port="${PORT:-$DEFAULT_PORT}"
    
    # Check Docker prerequisites
    check_docker_prerequisites
    
    # Handle existing containers
    handle_existing_container
    
    # Check port availability
    check_port_availability "$port"
    
    # Install dependencies
    install_dependencies
    
    # Start the Next.js service
    start_nextjs_service "$port"
    
    log_success "Next.js UI management completed successfully"
}

# Run main function
main "$@"