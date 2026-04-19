#!/bin/bash

# HikmahHub - Local Development Setup Script

set -e

echo "🚀 Setting up HikmahHub for local development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Setup Frontend
echo ""
echo "📦 Setting up frontend..."
cd app
npm install
npm run build
cd ..

echo "✅ Frontend setup complete!"

# Setup Backend
echo ""
echo "🔧 Setting up backend..."
cd backend

# Check if .env exists, if not create from template
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please update backend/.env with your credentials"
fi

npm install
cd ..

echo "✅ Backend setup complete!"

# Optional: Install Docker
if ! command -v docker &> /dev/null; then
    echo ""
    echo "⚠️  Docker is not installed. For production deployment, install Docker:"
    echo "   Windows/Mac: https://www.docker.com/products/docker-desktop"
    echo "   Linux: curl -fsSL https://get.docker.com | sh"
else
    echo "✅ Docker version: $(docker --version)"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update app/.env with your credentials"
echo "2. Update backend/.env with your credentials"
echo "3. Run 'npm run dev' in the app folder to start frontend"
echo "4. Run 'npm run dev' in the backend folder to start backend"
echo ""
echo "For production deployment, see DEPLOYMENT_QUICK_START.md"
