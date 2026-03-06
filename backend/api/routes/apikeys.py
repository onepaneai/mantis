import secrets
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.db_models import User, APIKey
from core.models import APIKeyResponse, APIKeyCreate
from core.auth import get_current_active_user, require_role

router = APIRouter()

def generate_api_key_string():
    # Generate a random 32-byte hex string
    key_secret = secrets.token_hex(32)
    return f"mtis_{key_secret}"

@router.get("/", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(require_role(["owner", "member"])),
    x_organization_id: str = Header(...),
    db: Session = Depends(get_db)
):
    """List all API keys for the organization that the user has generated"""
    keys = db.query(APIKey).filter(
        APIKey.organization_id == x_organization_id,
        APIKey.user_id == current_user.id
    ).all()
    return keys

@router.post("/", response_model=APIKeyCreate)
async def generate_api_key(
    current_user: User = Depends(require_role(["owner", "member"])),
    x_organization_id: str = Header(...),
    db: Session = Depends(get_db)
):
    """Generate a new API key for the Chrome extension"""
    raw_key = generate_api_key_string()
    
    # In a full production system, we would hash 'raw_key' properly using passlib 
    # before storing it in key_hash, and NEVER return the raw key again.
    # For MVP simplicity, we store the token itself in key_hash so we can quickly look it up.
    
    prefix = raw_key[:12] + "..."
    
    db_key = APIKey(
        key_hash=raw_key, 
        display_prefix=prefix, 
        user_id=current_user.id, 
        organization_id=x_organization_id
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)
    
    return {
        "key": raw_key,
        "api_key": db_key
    }

@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(require_role(["owner", "member"])),
    x_organization_id: str = Header(...),
    db: Session = Depends(get_db)
):
    """Revoke an API key"""
    db_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.organization_id == x_organization_id,
        APIKey.user_id == current_user.id
    ).first()
    
    if not db_key:
        raise HTTPException(status_code=404, detail="API Key not found or belongs to someone else")
        
    db.delete(db_key)
    db.commit()
    return {"status": "success", "message": "API key revoked"}
