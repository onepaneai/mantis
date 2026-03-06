"""
LLMSec - Main Application Entry Point
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import attacks, targets, datasets, evaluation, reports, testing, auth, organizations, apikeys
from core.config import settings
from core.database import engine, Base
import core.db_models  # To ensure models are registered

# Create database tables
Base.metadata.create_all(bind=engine)
app = FastAPI(
    title="LLMSec API",
    description="LLM Security Testing Framework API",
    version="1.0.0"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(attacks.router, prefix="/api/v1/attacks", tags=["attacks"])
app.include_router(targets.router, prefix="/api/v1/targets", tags=["targets"])
app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["datasets"])
app.include_router(evaluation.router, prefix="/api/v1/evaluation", tags=["evaluation"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(testing.router, prefix="/api/v1/testing", tags=["testing"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["organizations"])
app.include_router(apikeys.router, prefix="/api/v1/apikeys", tags=["apikeys"])

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

@app.get("/api")
async def root():
    return {
        "message": "LLMSec API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Serve frontend SPA
if os.path.isdir("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
    
    @app.get("/{catchall:path}")
    async def serve_spa(catchall: str):
        # Serve favicon, manifest, etc. if they exist exactly
        file_path = os.path.join("static", catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback to SPA index.html
        return FileResponse("static/index.html")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
