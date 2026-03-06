# Project Structure

```
LLMSec/
│
├── README.md                      # Main project documentation
├── INSTALL.md                     # Installation guide
├── USAGE_GUIDE.md                 # Detailed usage instructions
├── PROJECT_OVERVIEW.md            # Comprehensive project overview
├── STRUCTURE.md                   # This file
├── .gitignore                     # Git ignore patterns
│
├── backend/                       # Python FastAPI backend
│   ├── main.py                    # Application entry point
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example              # Environment variables template
│   │
│   ├── core/                      # Core functionality
│   │   ├── __init__.py
│   │   ├── config.py             # Configuration settings
│   │   ├── models.py             # Pydantic data models
│   │   └── attack_orchestrator.py # Attack execution engine
│   │
│   ├── strategies/                # Attack strategy implementations
│   │   ├── __init__.py
│   │   ├── base.py               # Base strategy classes
│   │   └── jailbreak_strategies.py # Concrete attack strategies
│   │
│   ├── dataset/                   # Dataset generation
│   │   ├── __init__.py
│   │   └── generator.py          # Ground truth dataset generator
│   │
│   ├── evaluation/                # Evaluation system
│   │   ├── __init__.py
│   │   └── evaluator.py          # Security evaluator
│   │
│   └── api/                       # REST API
│       ├── __init__.py
│       └── routes/                # API endpoints
│           ├── __init__.py
│           ├── attacks.py        # Attack execution endpoints
│           ├── targets.py        # Target management endpoints
│           ├── datasets.py       # Dataset endpoints
│           ├── evaluation.py     # Evaluation endpoints
│           └── reports.py        # Report generation endpoints
│
├── frontend/                      # React web dashboard
│   ├── package.json              # Node dependencies
│   ├── vite.config.js            # Vite configuration
│   ├── index.html                # HTML entry point
│   │
│   └── src/                      # Source code
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Main application component
│       └── index.css             # Global styles
│
├── extension/                     # Chrome extension
│   ├── manifest.json             # Extension manifest (V3)
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Popup logic
│   ├── content.js                # Content script (page interaction)
│   ├── background.js             # Background worker (orchestration)
│   │
│   └── icons/                    # Extension icons (create these)
│       ├── icon16.png            # 16x16 icon
│       ├── icon48.png            # 48x48 icon
│       └── icon128.png           # 128x128 icon
│
└── examples/                      # Example scripts
    └── quick_start.py            # Quick start demo script
```

## Component Responsibilities

### Backend (`backend/`)

#### Core Module (`core/`)
- **config.py**: Application configuration and settings
- **models.py**: Data models for all entities (Target, Attack, Dataset, Evaluation)
- **attack_orchestrator.py**: Main attack execution engine
  - Single-turn attacks
  - Sequential attacks
  - Adaptive attacks
  - Improvement loops

#### Strategies Module (`strategies/`)
- **base.py**: Abstract base classes
  - BaseAttackStrategy
  - SequentialAttackStrategy
  - AdaptiveAttackStrategy
- **jailbreak_strategies.py**: Concrete implementations
  - PromptInjectionStrategy
  - RolePlayingStrategy (DAN, STAN, Developer Mode)
  - PersuasionChainStrategy
  - StorytellingStrategy
  - EncodingStrategy

#### Dataset Module (`dataset/`)
- **generator.py**: Ground truth dataset generation
  - Auto-generated datasets
  - Custom scenarios
  - Progressive attack chains

#### Evaluation Module (`evaluation/`)
- **evaluator.py**: Security evaluation system
  - Run evaluations
  - Calculate metrics
  - Generate reports
  - Provide recommendations

#### API Module (`api/`)
- **routes/attacks.py**: Attack execution endpoints
  - POST /api/v1/attacks/execute
  - GET /api/v1/attacks/status/{id}
  - GET /api/v1/attacks/strategies

- **routes/targets.py**: Target management
  - CRUD operations for targets
  - Connection testing

- **routes/datasets.py**: Dataset management
  - Dataset generation
  - Custom scenarios
  - Attack chains

- **routes/evaluation.py**: Evaluation endpoints
  - Run evaluations
  - View reports

- **routes/reports.py**: Report generation
  - Export to JSON, Markdown, HTML

### Frontend (`frontend/`)

React-based web dashboard with tabs:
- **Targets**: Configure and manage target LLM applications
- **Attacks**: Execute manual security tests
- **Datasets**: Generate and manage test datasets
- **Evaluations**: Run and view security evaluations

### Chrome Extension (`extension/`)

Browser-based testing components:
- **popup.html/js**: User interface for configuration and control
- **content.js**: Interacts with web pages
  - Detects chat interfaces
  - Injects prompts
  - Captures responses
- **background.js**: Orchestrates attacks
  - Manages attack execution
  - Communicates with backend API
  - Coordinates multi-turn attacks

### Examples (`examples/`)

Demonstration scripts showing:
- Target configuration
- Attack execution
- Dataset generation
- Evaluation running
- Report exporting

## Data Flow

### Browser-Based Attack Flow
```
1. User configures attack in Extension Popup
2. Popup sends message to Background Worker
3. Background Worker:
   - Creates target in Backend API
   - Gets attack strategy
   - Coordinates attack execution
4. For each turn:
   - Background sends message to Content Script
   - Content Script injects prompt into page
   - Content Script captures response
   - Background evaluates response
   - Background decides next action
5. Background sends completion message to Popup
6. Popup displays results
```

### API-Based Attack Flow
```
1. Client creates target via API
2. Client submits attack request
3. Attack Orchestrator:
   - Selects strategy
   - Generates prompts
   - Sends to target API
   - Receives responses
   - Evaluates results
   - Improves prompts (if enabled)
4. Returns attack result with full history
```

### Evaluation Flow
```
1. Generate or load dataset
2. For each example in dataset:
   - Execute attack with example prompt
   - Compare response to expected behavior
   - Record result
3. Calculate aggregate metrics
4. Generate recommendations
5. Create report
```

## Key Files Description

### Backend Files

**main.py** (Entry Point)
- FastAPI application setup
- CORS configuration
- Route registration
- Server startup

**core/models.py** (Data Models)
- AttackType, AttackMode enums
- TargetConfig, AttackRequest, AttackResult
- Dataset, GroundTruthExample
- EvaluationReport, EvaluationMetrics

**core/attack_orchestrator.py** (Attack Engine)
- execute_attack() - Main entry point
- _execute_single_attack() - One-turn attacks
- _execute_sequential_attack() - Multi-turn attacks
- _execute_adaptive_attack() - Self-improving attacks
- _improve_and_retry() - Improvement loop

**strategies/base.py** (Strategy Framework)
- BaseAttackStrategy - Abstract base
- SequentialAttackStrategy - Multi-turn base
- AdaptiveAttackStrategy - Self-improving base
  - analyze_response() - Response analysis
  - adapt_strategy() - Strategy modification

**strategies/jailbreak_strategies.py** (Attack Implementations)
- PromptInjectionStrategy
- RolePlayingStrategy
- PersuasionChainStrategy
- StorytellingStrategy
- EncodingStrategy
- ATTACK_STRATEGIES registry

**dataset/generator.py** (Dataset Generation)
- generate_dataset() - Auto-generate tests
- generate_custom_scenarios() - User-defined tests
- generate_progressive_attack_chains() - Sequential tests

**evaluation/evaluator.py** (Evaluation System)
- evaluate_with_dataset() - Run full evaluation
- _evaluate_against_ground_truth() - Compare results
- _calculate_metrics() - Compute statistics
- _generate_recommendations() - Create action items

### Frontend Files

**src/App.jsx** (Main Component)
- Tab navigation
- TargetsTab - Target management
- AttacksTab - Manual testing
- DatasetsTab - Dataset operations
- EvaluationsTab - View reports

### Extension Files

**popup.html/js** (User Interface)
- Backend connection
- Target detection
- Attack configuration
- Results display

**content.js** (Page Interaction)
- detectChatInterface() - Find input/button
- injectPrompt() - Send message
- getLatestResponse() - Capture reply

**background.js** (Attack Coordination)
- handleStartAttack() - Initialize attack
- executeSingleAttack() - One-turn execution
- executeSequentialAttack() - Multi-turn execution
- generatePromptForTurn() - Progressive prompts

## Configuration Files

**.env** (Backend Environment)
```
HOST=0.0.0.0
PORT=8000
DEBUG=True
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=sqlite:///./llmsec.db
OPENAI_API_KEY=optional
ANTHROPIC_API_KEY=optional
```

**package.json** (Frontend Dependencies)
- React 18
- Axios for API calls
- Recharts for visualization
- Vite for build

**manifest.json** (Extension Configuration)
- Manifest V3
- Permissions: activeTab, storage, webRequest
- Service worker: background.js
- Content scripts: content.js

## Database Schema (SQLite)

```sql
-- Would be created if using persistent storage
-- Currently using in-memory dictionaries

CREATE TABLE targets (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    purpose TEXT,
    target_type TEXT,
    endpoint TEXT,
    created_at TIMESTAMP
);

CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    target_id TEXT,
    version TEXT,
    created_at TIMESTAMP
);

CREATE TABLE evaluations (
    id TEXT PRIMARY KEY,
    target_id TEXT,
    dataset_id TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    metrics JSON
);
```

## API Documentation

When backend is running, full interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## File Count Summary

- Python files: 15+
- JavaScript files: 4
- React components: 1 (with 4 sub-components)
- JSON config files: 3
- Documentation files: 5
- Total: ~30 files

## Next Steps for Development

1. **Create extension icons** (icons/ directory)
2. **Add tests** (tests/ directory with pytest)
3. **Add logging** (Implement structured logging)
4. **Database persistence** (Replace in-memory stores)
5. **Authentication** (Add user management)
6. **Rate limiting** (Implement request throttling)
7. **Caching** (Add Redis caching layer)
8. **Monitoring** (Add metrics and monitoring)
9. **Docker** (Create Dockerfile and docker-compose)
10. **CI/CD** (Add GitHub Actions workflows)

## Development Workflow

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
python main.py

# Terminal 2: Frontend (optional)
cd frontend
npm run dev

# Terminal 3: Testing
cd examples
python quick_start.py
```

## Architecture Patterns

- **Strategy Pattern**: Attack strategies are interchangeable
- **Factory Pattern**: Strategy registry for dynamic creation
- **Observer Pattern**: Extension components communicate via messages
- **MVC Pattern**: Frontend separates concerns
- **REST API**: Backend exposes RESTful endpoints
- **Async/Await**: Python backend uses async for performance
- **Component-Based**: React frontend uses composable components
