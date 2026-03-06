import os
import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from core.db_models import User, APIKey, OrganizationMember

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev_secret_key_change_in_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user_from_token(token: str, db: Session) -> Optional[User]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except jwt.PyJWTError:
        return None

def get_current_user_from_api_key(api_key_header: str, db: Session) -> Optional[User]:
    # In a real app we'd hash the api_key and look up by key_hash
    # For this MVP, we just match it directly to key_hash (so key_hash is the actual key)
    api_key_record = db.query(APIKey).filter(APIKey.key_hash == api_key_header).first()
    if not api_key_record:
        return None
        
    api_key_record.last_used = datetime.utcnow()
    db.commit()
    
    return api_key_record.user

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    user = None
    
    # Check for extension API key first
    api_key_header = request.headers.get("x-api-key")
    if api_key_header:
        user = get_current_user_from_api_key(api_key_header, db)
    elif token:
        user = get_current_user_from_token(token, db)
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user

def require_role(allowed_roles: list[str]):
    """
    Dependency factory to enforce RBAC based on the active organization.
    Requires the client to send an X-Organization-Id header.
    """
    async def role_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        org_id = request.headers.get("x-organization-id")
        
        # If no explicit header, let's try to infer from their memberships or api key
        if not org_id:
            api_key_header = request.headers.get("x-api-key")
            if api_key_header:
                api_key_record = db.query(APIKey).filter(APIKey.key_hash == api_key_header).first()
                if api_key_record:
                    org_id = api_key_record.organization_id
            else:
                # Get the user's primary/first organization if not specified
                member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
                if member:
                    org_id = member.organization_id
                    
        if not org_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Verify membership and role in this specific org
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.organization_id == org_id
        ).first()

        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
            
        # Treat owner_id on Organization as "owner" implied role
        if membership.organization.owner_id == current_user.id:
            user_effective_role = "owner"
        else:
            user_effective_role = membership.role

        if user_effective_role not in allowed_roles and "owner" not in allowed_roles: # Owner can do anything
            if user_effective_role != "owner":
                 raise HTTPException(status_code=403, detail="Insufficient role permissions")

        # Inject org_id into the request state so routes can use it for scoping constraints
        request.state.organization_id = org_id
        return current_user

    return role_checker
