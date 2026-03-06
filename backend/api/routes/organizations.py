from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.db_models import User, Organization, OrganizationMember
from core.models import OrganizationResponse, OrganizationMemberResponse, OrganizationCreate, OrganizationInvite
from core.auth import get_current_active_user, require_role
from core.models import OrganizationAPIKeysUpdate, LLMModelResponse, LLMModelCreate
from core.db_models import OrganizationLLMModel

router = APIRouter()

@router.get("/", response_model=List[OrganizationResponse])
async def get_my_organizations(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Get all organizations the user is a member of"""
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).all()
    org_ids = [m.organization_id for m in memberships]
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    
    result = []
    for org in orgs:
        db_models = db.query(OrganizationLLMModel).filter(OrganizationLLMModel.organization_id == org.id).all()
        org_resp = OrganizationResponse.model_validate(org)
        org_resp.has_gemini_key = bool(org.gemini_api_key)
        org_resp.has_openai_key = bool(org.openai_api_key)
        org_resp.has_anthropic_key = bool(org.anthropic_api_key)
        org_resp.llm_models = [LLMModelResponse.model_validate(m) for m in db_models]
        result.append(org_resp)
        
    return result

@router.post("/", response_model=OrganizationResponse)
async def create_organization(org_in: OrganizationCreate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Create a new organization (Max 1 per user)"""
    owned_orgs_count = db.query(Organization).filter(Organization.owner_id == current_user.id).count()
    if owned_orgs_count >= 1:
        raise HTTPException(status_code=400, detail="Users are limited to a maximum of 1 owned organization.")
        
    org = Organization(name=org_in.name, owner_id=current_user.id)
    db.add(org)
    db.flush()
    
    member = OrganizationMember(organization_id=org.id, user_id=current_user.id, role="owner")
    db.add(member)
    db.commit()
    db.refresh(org)
    return org

@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
async def get_organization_members(
    org_id: str, 
    current_user: User = Depends(require_role(["owner", "member", "reader"])), 
    db: Session = Depends(get_db)
):
    """List members of the organization"""
    members = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id).all()
    
    # Manually populate the nested user object for the response
    for m in members:
        m.user = db.query(User).filter(User.id == m.user_id).first()
        
    return members

@router.post("/{org_id}/invites", response_model=OrganizationMemberResponse)
async def invite_member(
    org_id: str, 
    invite: OrganizationInvite,
    current_user: User = Depends(require_role(["owner", "member"])), # Only members and owners can invite
    db: Session = Depends(get_db)
):
    """Invite a user to the organization by email"""
    # Check if target user exists. If not, create placeholder (or reject based on requirements)
    invitee = db.query(User).filter(User.email == invite.email).first()
    if not invitee:
        # Create a placeholder user so they can sign in later via Google and match the email
        invitee = User(email=invite.email, name=invite.email.split('@')[0])
        db.add(invitee)
        db.flush()
        
    # Check if already a member
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == invitee.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this organization")
        
    member = OrganizationMember(organization_id=org_id, user_id=invitee.id, role=invite.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    
    member.user = invitee
    return member

@router.patch("/{org_id}/api-keys", response_model=OrganizationResponse)
async def update_organization_api_keys(
    org_id: str,
    keys: OrganizationAPIKeysUpdate,
    current_user: User = Depends(require_role(["owner", "member"])),
    db: Session = Depends(get_db)
):
    """Update API keys for an organization"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    if keys.gemini_api_key is not None:
        org.gemini_api_key = keys.gemini_api_key if keys.gemini_api_key else None
    if keys.openai_api_key is not None:
        org.openai_api_key = keys.openai_api_key if keys.openai_api_key else None
    if keys.anthropic_api_key is not None:
        org.anthropic_api_key = keys.anthropic_api_key if keys.anthropic_api_key else None
        
    db.commit()
    db.refresh(org)
    
    # Format response
    db_models = db.query(OrganizationLLMModel).filter(OrganizationLLMModel.organization_id == org_id).all()
    org_resp = OrganizationResponse.model_validate(org)
    org_resp.has_gemini_key = bool(org.gemini_api_key)
    org_resp.has_openai_key = bool(org.openai_api_key)
    org_resp.has_anthropic_key = bool(org.anthropic_api_key)
    org_resp.llm_models = [LLMModelResponse.model_validate(m) for m in db_models]
    return org_resp

@router.post("/{org_id}/models", response_model=LLMModelResponse)
async def add_organization_model(
    org_id: str,
    model_in: LLMModelCreate,
    current_user: User = Depends(require_role(["owner", "member"])),
    db: Session = Depends(get_db)
):
    """Add a new saved model configuration"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    # Check if this is the first one, make it active if so
    count = db.query(OrganizationLLMModel).filter(OrganizationLLMModel.organization_id == org_id).count()
    is_active = count == 0
    
    new_model = OrganizationLLMModel(
        organization_id=org_id,
        provider=model_in.provider,
        model_name=model_in.model_name,
        is_active=is_active
    )
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    return new_model

@router.post("/{org_id}/models/{model_id}/activate", response_model=OrganizationResponse)
async def activate_organization_model(
    org_id: str,
    model_id: str,
    current_user: User = Depends(require_role(["owner", "member"])),
    db: Session = Depends(get_db)
):
    """Set a specific model as the active one for the organization"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    model_to_activate = db.query(OrganizationLLMModel).filter(
        OrganizationLLMModel.id == model_id,
        OrganizationLLMModel.organization_id == org_id
    ).first()
    
    if not model_to_activate:
        raise HTTPException(status_code=404, detail="Model configuration not found")
        
    # Deactivate all others
    db.query(OrganizationLLMModel).filter(OrganizationLLMModel.organization_id == org_id).update({"is_active": False})
    
    # Activate the target
    model_to_activate.is_active = True
    db.commit()
    
    # Format response
    db.refresh(org)
    db_models = db.query(OrganizationLLMModel).filter(OrganizationLLMModel.organization_id == org_id).all()
    org_resp = OrganizationResponse.model_validate(org)
    org_resp.has_gemini_key = bool(org.gemini_api_key)
    org_resp.has_openai_key = bool(org.openai_api_key)
    org_resp.has_anthropic_key = bool(org.anthropic_api_key)
    org_resp.llm_models = [LLMModelResponse.model_validate(m) for m in db_models]
    return org_resp

@router.delete("/{org_id}/models/{model_id}")
async def delete_organization_model(
    org_id: str,
    model_id: str,
    current_user: User = Depends(require_role(["owner", "member"])),
    db: Session = Depends(get_db)
):
    """Delete a saved model configuration"""
    model_to_delete = db.query(OrganizationLLMModel).filter(
        OrganizationLLMModel.id == model_id,
        OrganizationLLMModel.organization_id == org_id
    ).first()
    
    if not model_to_delete:
        raise HTTPException(status_code=404, detail="Model configuration not found")
        
    was_active = model_to_delete.is_active
    db.delete(model_to_delete)
    db.commit()
    
    # If we deleted the active one, try to make another one active
    if was_active:
        fallback = db.query(OrganizationLLMModel).filter(OrganizationLLMModel.organization_id == org_id).first()
        if fallback:
            fallback.is_active = True
            db.commit()
            
    return {"status": "success"}
