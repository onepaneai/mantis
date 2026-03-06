# Installation Guide

## Prerequisites

- Python 3.9 or higher
- Node.js 16 or higher (for frontend)
- Chrome browser (for extension)
- Git

## Quick Install

### 1. Clone Repository

```bash
git clone <repository-url>
cd LLMSec
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env with your settings (optional)
nano .env
```

### 3. Frontend Setup (Optional)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000)

### 4. Chrome Extension Setup (Optional)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` directory from the project
5. Pin the extension to your toolbar for easy access

## Running the Application

### Start Backend Server

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python main.py
```

The API will be available at [http://localhost:8000](http://localhost:8000)

API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### Start Frontend Dashboard (Optional)

```bash
cd frontend
npm run dev
```

Dashboard: [http://localhost:3000](http://localhost:3000)

## Verify Installation

### Check Backend Health

```bash
curl http://localhost:8000/health
```

Expected response: `{"status":"healthy"}`

### Run Quick Start Example

```bash
cd examples
python quick_start.py
```

This will run a complete demo of all features.

## Configuration

### Backend Configuration (.env)

```bash
# Server settings
HOST=0.0.0.0
PORT=8000
DEBUG=True

# CORS (add your frontend URLs)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Database
DATABASE_URL=sqlite:///./llmsec.db

# Optional: API keys for testing with real LLMs
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
```

### Chrome Extension Configuration

1. Click the extension icon
2. Enter backend URL: `http://localhost:8000`
3. Click "Connect"
4. Navigate to target LLM application
5. Click "Auto-Detect" or manually configure selectors

## Troubleshooting

### Backend won't start

**Error: `ModuleNotFoundError: No module named 'fastapi'`**

Solution:
```bash
# Make sure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

**Error: `Address already in use`**

Solution:
```bash
# Change port in .env file
PORT=8001
```

Or kill the process using port 8000:
```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Frontend issues

**Error: `Cannot find module`**

Solution:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Port 3000 already in use**

Solution:
```bash
# Vite will automatically suggest another port
# Or specify custom port:
npm run dev -- --port 3001
```

### Extension issues

**Extension not loading**

Solution:
1. Ensure manifest.json is valid
2. Check Chrome version (must be 88+)
3. Try removing and re-adding the extension
4. Check Chrome console for errors (right-click extension → Inspect)

**Can't connect to backend**

Solution:
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check CORS settings in backend/.env
3. Make sure `chrome-extension://*` is in CORS_ORIGINS

**Auto-detect not working**

Solution:
1. Use manual selector configuration
2. Inspect page elements to find correct selectors
3. Some sites use Shadow DOM - may require custom selectors
4. Try refreshing the page after extension loads

### Database issues

**Error: `no such table`**

Solution:
```bash
cd backend
rm llmsec.db  # Delete old database
python main.py  # Will create new database
```

## Development Setup

### Install Development Dependencies

```bash
# Backend
cd backend
pip install pytest pytest-asyncio pytest-cov black flake8 mypy

# Frontend
cd frontend
npm install --save-dev @types/react @types/react-dom
```

### Run Tests

```bash
# Backend tests
cd backend
pytest

# With coverage
pytest --cov=. --cov-report=html
```

### Code Formatting

```bash
# Format Python code
cd backend
black .

# Lint Python code
flake8 .

# Type checking
mypy .
```

### Build for Production

```bash
# Backend (no build needed, just install requirements)
pip install -r requirements.txt

# Frontend
cd frontend
npm run build
# Output will be in frontend/dist/

# Extension
# Zip the extension directory
cd extension
zip -r llmsec-extension.zip . -x "*.git*"
```

## Docker Setup (Alternative)

Coming soon! Will include:
- Docker Compose setup
- Backend container
- Frontend container
- Pre-configured networking

## System Requirements

### Minimum
- CPU: 2 cores
- RAM: 2GB
- Disk: 500MB
- Internet connection (for API testing)

### Recommended
- CPU: 4 cores
- RAM: 4GB
- Disk: 2GB
- SSD for better database performance

## Next Steps

After installation:

1. Read [USAGE_GUIDE.md](USAGE_GUIDE.md) for detailed usage instructions
2. Run the quick start example: `python examples/quick_start.py`
3. Configure your first target application
4. Generate a test dataset
5. Run your first security evaluation

## Getting Help

- Documentation: See [README.md](README.md)
- Usage Guide: See [USAGE_GUIDE.md](USAGE_GUIDE.md)
- API Docs: http://localhost:8000/docs (when server is running)
- Issues: GitHub Issues (when repository is public)

## Security Note

This tool is designed for authorized security testing only. Always ensure you have proper authorization before testing any system.
