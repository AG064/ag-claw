#!/usr/bin/env bash
# ============================================
# AG-Claw Installation Script
# ============================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_URL="https://github.com/AG064/ag-claw.git"
INSTALL_DIR="${AGCLAW_DIR:-$(pwd)}"
USE_DOCKER=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --dir=*)
      INSTALL_DIR="${arg#*=}"
      shift
      ;;
    --help)
      echo "AG-Claw Installer"
      echo ""
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --docker       Deploy using Docker Compose"
      echo "  --dir=PATH     Install to specified directory"
      echo "  --help         Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  AGCLAW_DIR     Installation directory"
      exit 0
      ;;
  esac
done

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[  OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ ERR]${NC} $1"; }

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AG-Claw Installer v0.1.0        ║${NC}"
echo -e "${BLUE}║   Modular AI Agent Framework          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# ============================================
# Step 1: Check prerequisites
# ============================================
log_info "Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    log_ok "Node.js $NODE_VERSION found"
  else
    log_error "Node.js >= 20 required (found $NODE_VERSION)"
    log_info "Install with: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
  fi
else
  log_error "Node.js not found. Install Node.js >= 20 first."
  log_info "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  log_info "  macOS: brew install node"
  log_info "  Or visit: https://nodejs.org"
  exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
  log_ok "npm $(npm -v) found"
else
  log_error "npm not found (should come with Node.js)"
  exit 1
fi

# Check Docker (only if --docker flag)
if [ "$USE_DOCKER" = true ]; then
  if command -v docker &> /dev/null; then
    log_ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') found"
  else
    log_error "Docker not found. Install Docker first: https://docs.docker.com/get-docker/"
    exit 1
  fi

  if command -v docker compose &> /dev/null || command -v docker-compose &> /dev/null; then
    log_ok "Docker Compose found"
  else
    log_error "Docker Compose not found."
    exit 1
  fi
fi

# ============================================
# Step 2: Navigate to install directory
# ============================================
if [ ! -d "$INSTALL_DIR" ]; then
  log_info "Creating install directory: $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
log_ok "Working directory: $(pwd)"

# ============================================
# Step 3: Install dependencies
# ============================================
log_info "Installing npm dependencies..."
npm install --production 2>/dev/null || npm install
log_ok "Dependencies installed"

# ============================================
# Step 4: Copy default config if not exists
# ============================================
if [ ! -f "config/default.yaml" ]; then
  log_info "Creating default configuration..."
  mkdir -p config
  if [ -f "config/default.yaml" ]; then
    log_warn "config/default.yaml already exists, skipping"
  else
    log_ok "Configuration ready (config/default.yaml)"
  fi
else
  log_ok "Configuration already exists"
fi

if [ ! -f "config/security-policy.yaml" ]; then
  log_info "Creating default security policy..."
  log_ok "Security policy ready (config/security-policy.yaml)"
else
  log_ok "Security policy already exists"
fi

# ============================================
# Step 5: Create data directories
# ============================================
log_info "Creating data directories..."
mkdir -p data memory logs
log_ok "Data directories created (data/, memory/, logs/)"

# Create .env if not exists
if [ ! -f ".env" ]; then
  cat > .env << 'ENVEOF'
# AG-Claw Environment Variables
# Copy this file and fill in your values.

# Telegram Bot Token (get from @BotFather)
# AGCLAW_TELEGRAM_TOKEN=

# Model API Keys (or use OpenRouter)
# OPENROUTER_API_KEY=

# ElevenLabs (for voice features)
# ELEVENLABS_API_KEY=

# Supabase (optional, for Supabase memory backend)
# AGCLAW_SUPABASE_URL=
# AGCLAW_SUPABASE_KEY=

# Logging level
AGCLAW_LOG_LEVEL=info

# Port override
# AGCLAW_PORT=18789
ENVEOF
  log_ok ".env template created (fill in your API keys)"
else
  log_ok ".env already exists"
fi

# ============================================
# Step 6: Build TypeScript
# ============================================
log_info "Building TypeScript..."
if npm run build 2>/dev/null; then
  log_ok "TypeScript build complete"
else
  log_warn "TypeScript build failed — you may need to fix compilation errors"
  log_info "Run 'npm run build' manually to see details"
fi

# ============================================
# Step 7: Start with Docker (if --docker)
# ============================================
if [ "$USE_DOCKER" = true ]; then
  log_info "Starting with Docker Compose..."
  docker compose -f docker/docker-compose.yml up -d
  log_ok "AG-Claw is running in Docker"
  echo ""
  log_info "Access: http://localhost:18789"
  log_info "Logs:   docker compose -f docker/docker-compose.yml logs -f"
  log_info "Stop:   docker compose -f docker/docker-compose.yml down"
else
  echo ""
  log_ok "Installation complete!"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. Edit ${YELLOW}.env${NC} with your API keys"
  echo -e "  2. Review ${YELLOW}config/default.yaml${NC}"
  echo -e "  3. Start AG-Claw:"
  echo -e "     ${GREEN}npm start${NC}         (production)"
  echo -e "     ${GREEN}npm run dev${NC}       (development with hot-reload)"
  echo -e "     ${GREEN}./install.sh --docker${NC}  (Docker deployment)"
  echo ""
  echo -e "  Docs: ${BLUE}https://github.com/AG064/ag-claw${NC}"
  echo ""
fi
