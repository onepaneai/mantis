<div align="center">
  <h1>LLMSec<br>Agentic Security & Testing Framework</h1>
  <p><strong>A comprehensive Evaluation, Testing, and Security engine for Agentic AI applications.</strong></p>
</div>

## 📖 Executive Summary
**LLMSec** is an advanced framework that acts primarily as a **Testing and Evaluation Engine** for Agentic AI applications, while also supplying a robust suite of **Security Testing** features. 

Define comprehensive testing environments ("Bots" or "Targets") by providing text explanations of their purpose, enabling our internal agents to autonomously analyze, evaluate, and attack your chat AI interfaces. 

Whether testing against a direct REST API or intercepting a web-based Chat UI using our Chrome Extension, LLMSec orchestrates everything from functional Use Cases to sophisticated Multi-Turn adversarial attacks.

## ✨ Key Features

### 🎯 1. Testing & Evaluation Engine (Primary)
- **Bot Context Engine:** Define your target model's purpose and limits so LLMSec agents know precisely how to interact with it.
- **Use Cases & Test Cases:** Manually build or automatically compose hierarchical Use Cases and individual Test Cases.
- **Evaluation Scoring:** Let the engine analyze the AI response and assign standard quantitative evaluation scores.
- **Ground Truth Pipeline:** Store historical execution results and lock in validated runs as regression "Ground Truth Data".
- **Adaptive Execution:** The LLMSec agent halts execution to ask the human user clarifying questions if it lacks the specific context needed to grade or execute a test.

### 🛡️ 2. Security Testing (Adversarial)
- **Advanced Attack Vectors:** Run Prompt Injections, Role-Playing (DAN/STAN), Persuasion, Encoding, and Storyboarding attacks.
- **Sequential Attacks:** Coordinate multi-turn conversational social engineering attacks that dynamically adapt to the target's defenses.

### 🔌 3. Integrations
- **REST API:** Direct server-to-server testing.
- **Browser Extension:** A powerful Chrome Extension that interacts directly with any DOM-based web chat application, bypassing complex authentication and API mocking entirely.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+ (for web dashboard)
- Google Chrome (for browser extension)

### 1. Start the Backend API

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env

# Start the FastAPI Server
uvicorn main:app --reload
```
*The API is now available at `http://localhost:8000` (Swagger UI at `/docs`)*

### 2. Start the Web Dashboard

```bash
cd frontend
npm install
npm run dev
```
*Visit the dashboard at `http://localhost:3000`*

### 3. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **"Developer mode"** in the top right.
3. Click **"Load unpacked"**.
4. Select the `extension/` directory from this repository.
5. Pin the extension. When you click it, set the Backend URL to `http://localhost:8000` and click "Connect".

---

## 📚 Documentation
For detailed guides on setting up, using the Chrome Extension, and exploring the backend models, please check our documentation folder.

- **[Architecture Deep Dive](docs/ARCHITECTURE.md)**: Explore the system architecture, file structure, component breakdown, and Database schemas.
- **[Installation & Troubleshooting Guide](docs/SETUP.md)**: Detailed dependency setup, Docker coming soon, and deep troubleshooting steps for Backend, Frontend, and the Database.
- **[Detailed Usage Guide](docs/USAGE.md)**: Master the API, build Custom Scenarios, trigger Dataset Generation pipelines, and read Security Evaluation Analytics.

## 🤝 Contributing
- Always test using `pytest` in the backend before pushing changes.
- Ensure Prettier formatting is run for Frontend modifications.
- Run `npm run lint` inside the `extension` folder to validate Chrome V3 standards.

## 📜 Legal Notice & License
This tool is strictly designed for **authorized security testing**. Always ensure you have explicit, written authorization before testing any system you do not own. Unauthorized security testing may be illegal.

Licensed under the **MIT License**.
