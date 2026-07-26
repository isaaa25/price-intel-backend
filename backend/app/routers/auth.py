from __future__ import annotations
from fastapi import APIRouter,Depends,status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import TYPE_CHECKING


from app.dependencies import get_db, get_current_user
from app.schemas.user import UserRegister,UserLogin,TokenResponse, UserResponse
from app.services import auth_service

# use type checking to avoid circular imports for the User Model hint
if TYPE_CHECKING:
    from app.models.user import User

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)
@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Account",
)
async def register(
    data : UserRegister,
    db : AsyncSession = Depends(get_db),
) -> TokenResponse:
    # Service handles hashing and flushing
    user = await auth_service.create_user(db,data)

    # we should commit here to ensure data integrity before token generation
    await db.commit()

    token = auth_service.create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )

@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login to existing Account",
)
async def login(
    data : UserLogin,
    db : AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await auth_service.authenticate_user(db,data.email,data.password)
    token = auth_service.create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user",
)
async def get_me(
    current_user : User = Depends(get_current_user),
) -> UserResponse:
    """Returns the profile of whoever is making the request.
    Token is validated automatically by the get_current_user dependency"""
    return UserResponse.model_validate(current_user)