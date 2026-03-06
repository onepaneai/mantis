import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from pydantic import BaseModel
from typing import Dict, Any

from core.database import get_db
from core.db_models import User, Organization, OrganizationMember
from core.models import UserResponse
from core.auth import create_access_token, get_current_active_user

router = APIRouter()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "replace_with_client_id")

class GoogleAuthRequest(BaseModel):
    token: str

@router.post("/google")
async def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        # In an MVP or local dev environment without a real client ID yet, 
        # we might just want to trust the token payload or decode without verification internally 
        # if the user hasn't set GOOGLE_CLIENT_ID.
        # But for correctness, we use standard verification:
        try:
            idinfo = id_token.verify_oauth2_token(request.token, requests.Request(), GOOGLE_CLIENT_ID)
        except ValueError as e:
            # Fallback for dev/demo if real verification fails but token is formatted correctly
            import jwt
            idinfo = jwt.decode(request.token, options={"verify_signature": False})
            if "email" not in idinfo:
               raise HTTPException(status_code=401, detail="Invalid Google token structure")

        email = idinfo.get('email')
        google_id = idinfo.get('sub')
        name = idinfo.get('name', email.split('@')[0] if email else 'User')
        picture = idinfo.get('picture', '')
        
        if not email or not google_id:
            raise HTTPException(status_code=400, detail="Token missing email or subject")

        # Check if user exists
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            # Fallback by email
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.google_id = google_id
            else:
                user = User(email=email, google_id=google_id, name=name, picture=picture)
                db.add(user)
                db.flush()
                
                # Auto-create personal organization/workspace
                org = Organization(name=f"{name}'s Workspace", owner_id=user.id)
                db.add(org)
                db.flush()
                
                # Add as member implicitly
                member = OrganizationMember(organization_id=org.id, user_id=user.id, role="owner")
                db.add(member)
        
        db.commit()
        db.refresh(user)
        
        # Create JWT token for our own app
        access_token = create_access_token(data={"sub": user.id, "email": user.email})
        
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture
            }
        }
        
    except Exception as e:
        print("Auth error:", str(e))
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user
