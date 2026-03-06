"""
API routes for target management
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
import uuid
from sqlalchemy.orm import Session

from core.models import TargetConfig, ProjectCreate, ProjectUpdate, ProjectResponse
from core.database import get_db
from core.db_models import DBBot, DBProject, User
from core.auth import require_role

router = APIRouter()

@router.post("/", response_model=TargetConfig)
async def create_target(
    request: Request,
    target: TargetConfig, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    """Create a new target configuration"""
    
    # Generate ID if not provided
    if not target.id:
        target.id = str(uuid.uuid4())
        
    org_id = getattr(request.state, "organization_id", None)
        
    db_bot = DBBot(
        id=target.id,
        name=target.name,
        description=target.description,
        purpose=target.purpose,
        context=target.context,
        agent_memory=target.agent_memory,
        organization_id=org_id,
        target_type=target.target_type.value,
        endpoint=target.endpoint,
        method=target.method,
        headers=target.headers,
        auth=target.auth,
        url=target.url,
        selector=target.selector,
        expected_restrictions=target.expected_restrictions,
        prohibited_topics=target.prohibited_topics,
        created_at=target.created_at
    )
    
    db.add(db_bot)
    db.commit()
    db.refresh(db_bot)

    return target

@router.get("/", response_model=List[TargetConfig])
async def list_targets(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member", "reader"]))
):
    """List all target configurations"""
    org_id = getattr(request.state, "organization_id", None)
    bots = db.query(DBBot).filter(DBBot.organization_id == org_id).all()
    
    result = []
    for bot in bots:
        # Convert DBBot to TargetConfig
        tc_dict = {
            "id": bot.id,
            "name": bot.name,
            "description": bot.description,
            "purpose": bot.purpose,
            "context": bot.context,
            "agent_memory": bot.agent_memory,
            "target_type": bot.target_type,
            "endpoint": bot.endpoint,
            "method": bot.method,
            "headers": bot.headers if bot.headers else {},
            "auth": bot.auth,
            "url": bot.url,
            "selector": bot.selector,
            "expected_restrictions": bot.expected_restrictions if bot.expected_restrictions else [],
            "prohibited_topics": bot.prohibited_topics if bot.prohibited_topics else [],
            "created_at": bot.created_at
        }
        result.append(TargetConfig(**tc_dict))
        
    return result

@router.get("/{target_id}", response_model=TargetConfig)
async def get_target(
    target_id: str, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member", "reader"]))
):
    """Get a specific target configuration"""
    org_id = getattr(request.state, "organization_id", None)

    bot = db.query(DBBot).filter(
        DBBot.id == target_id,
        DBBot.organization_id == org_id
    ).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found or unauthorized")

    tc_dict = {
        "id": bot.id,
        "name": bot.name,
        "description": bot.description,
        "purpose": bot.purpose,
        "context": bot.context,
        "agent_memory": bot.agent_memory,
        "target_type": bot.target_type,
        "endpoint": bot.endpoint,
        "method": bot.method,
        "headers": bot.headers if bot.headers else {},
        "auth": bot.auth,
        "url": bot.url,
        "selector": bot.selector,
        "expected_restrictions": bot.expected_restrictions if bot.expected_restrictions else [],
        "prohibited_topics": bot.prohibited_topics if bot.prohibited_topics else [],
        "created_at": bot.created_at
    }
    return TargetConfig(**tc_dict)

@router.put("/{target_id}", response_model=TargetConfig)
async def update_target(
    target_id: str, 
    target: TargetConfig, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    """Update a target configuration"""
    org_id = getattr(request.state, "organization_id", None)

    bot = db.query(DBBot).filter(
        DBBot.id == target_id,
        DBBot.organization_id == org_id
    ).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found or unauthorized")

    target.id = target_id
    
    # Update fields
    bot.name = target.name
    bot.description = target.description
    bot.purpose = target.purpose
    bot.context = target.context
    bot.agent_memory = target.agent_memory
    bot.target_type = target.target_type.value
    bot.endpoint = target.endpoint
    bot.method = target.method
    bot.headers = target.headers
    bot.auth = target.auth
    bot.url = target.url
    bot.selector = target.selector
    bot.expected_restrictions = target.expected_restrictions
    bot.prohibited_topics = target.prohibited_topics
    
    db.commit()
    db.refresh(bot)

    return target

@router.delete("/{target_id}")
async def delete_target(
    target_id: str, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    """Delete a target configuration"""
    org_id = getattr(request.state, "organization_id", None)

    bot = db.query(DBBot).filter(
        DBBot.id == target_id,
        DBBot.organization_id == org_id
    ).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found or unauthorized")

    db.delete(bot)
    db.commit()

    return {"message": "Target deleted"}

@router.post("/{target_id}/test")
async def test_target_connection(target_id: str, db: Session = Depends(get_db)):
    """Test connection to a target"""

    bot = db.query(DBBot).filter(DBBot.id == target_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found")

    # Simple connectivity test
    import httpx

    if bot.target_type == "api_endpoint":
        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method="GET",
                    url=bot.endpoint.rsplit('/', 1)[0],  # Base URL
                    timeout=5.0
                )
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "message": "Connection successful"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}"
            }
    else:
        return {
            "success": True,
            "message": "Browser-based target, test via extension"
        }

# Project Management within Targets (Bots)

@router.post("/{target_id}/projects", response_model=ProjectResponse)
async def create_project(
    target_id: str,
    project: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    """Create a new project under a target"""
    org_id = getattr(request.state, "organization_id", None)
    
    # Verify bot ownership
    bot = db.query(DBBot).filter(
        DBBot.id == target_id,
        DBBot.organization_id == org_id
    ).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found or unauthorized")
        
    db_project = DBProject(
        id=str(uuid.uuid4()),
        bot_id=target_id,
        name=project.name,
        description=project.description
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return db_project

@router.get("/{target_id}/projects", response_model=List[ProjectResponse])
async def list_projects(
    target_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member", "reader"]))
):
    """List all projects under a specific target"""
    org_id = getattr(request.state, "organization_id", None)
    
    # Verify bot ownership
    bot = db.query(DBBot).filter(
        DBBot.id == target_id,
        DBBot.organization_id == org_id
    ).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found or unauthorized")
        
    projects = db.query(DBProject).filter(DBProject.bot_id == target_id).all()
    return projects

@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    """Update a specific project"""
    db_project = db.query(DBProject).filter(DBProject.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Optional authorization mapping: Check if the project's bot_id belongs to the org
    org_id = getattr(request.state, "organization_id", None)
    bot = db.query(DBBot).filter(DBBot.id == db_project.bot_id, DBBot.organization_id == org_id).first()
    if not bot:
         raise HTTPException(status_code=403, detail="Unauthorized access to project")
         
    if project_update.name is not None:
        db_project.name = project_update.name
    if project_update.description is not None:
        db_project.description = project_update.description
        
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    """Delete a specific project"""
    db_project = db.query(DBProject).filter(DBProject.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Authorization mapping
    org_id = getattr(request.state, "organization_id", None)
    bot = db.query(DBBot).filter(DBBot.id == db_project.bot_id, DBBot.organization_id == org_id).first()
    if not bot:
         raise HTTPException(status_code=403, detail="Unauthorized access to project")
         
    db.delete(db_project)
    db.commit()
    
    return {"message": "Project deleted successfully"}
