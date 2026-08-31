#!/usr/bin/env bash

# ==============================================================================
# Simple Business Journal - Fullstack Deployment Script
# Deploys Backend Cloud Functions and Frontend Next.js / Firebase Hosting.
# ==============================================================================

set -euo pipefail

# Determine script root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_FUNCTIONS_DIR="$ROOT_DIR/backend/functions"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Colors for terminal output
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  GREEN="\033[0;32m"
  BLUE="\033[0;34m"
  YELLOW="\033[1;33m"
  RED="\033[0;31m"
  BOLD="\033[1m"
  NC="\033[0m" # No Color
else
  GREEN=""
  BLUE=""
  YELLOW=""
  RED=""
  BOLD=""
  NC=""
fi

log_info() {
  echo -e "${BLUE}${BOLD}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}${BOLD}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}${BOLD}[ERROR]${NC} $1" >&2
}

show_usage() {
  echo -e "${BOLD}Usage:${NC} $0 [OPTIONS]"
  echo ""
  echo "Deploy backend functions, frontend hosting, or both."
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  -a, --all            Deploy both backend functions and frontend (default)"
  echo "  -b, --backend        Deploy only backend functions (backend/functions)"
  echo "  -f, --frontend       Deploy only frontend (frontend)"
  echo "  -h, --help           Display this help message"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  $0                   # Deploys backend functions followed by frontend"
  echo "  $0 --backend         # Deploys only backend/functions"
  echo "  $0 --frontend        # Deploys only frontend"
}

deploy_backend() {
  log_info "Deploying Backend Functions (${BACKEND_FUNCTIONS_DIR})..."
  if [[ ! -d "$BACKEND_FUNCTIONS_DIR" ]]; then
    log_error "Backend functions directory not found at $BACKEND_FUNCTIONS_DIR"
    return 1
  fi

  (
    cd "$BACKEND_FUNCTIONS_DIR"
    npm run deploy
  )
  log_success "Backend functions deployed successfully."
}

deploy_frontend() {
  log_info "Deploying Frontend (${FRONTEND_DIR})..."
  if [[ ! -d "$FRONTEND_DIR" ]]; then
    log_error "Frontend directory not found at $FRONTEND_DIR"
    return 1
  fi

  (
    cd "$FRONTEND_DIR"
    npm run deploy
  )
  log_success "Frontend deployed successfully."
}

# Parse command line options
TARGET="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--all)
      TARGET="all"
      shift
      ;;
    -b|--backend|--functions)
      TARGET="backend"
      shift
      ;;
    -f|--frontend|--hosting)
      TARGET="frontend"
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

START_TIME=$(date +%s)

echo -e "${BOLD}====================================================${NC}"
echo -e "${BOLD}  Starting Deployment for Simple Business Journal   ${NC}"
echo -e "${BOLD}====================================================${NC}"

case "$TARGET" in
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_backend
    echo ""
    deploy_frontend
    ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}====================================================${NC}"
log_success "Deployment completed in ${DURATION}s."
echo -e "${BOLD}====================================================${NC}"
