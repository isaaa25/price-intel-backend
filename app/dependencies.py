from __future__ import annotations
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models import * 
import uuid
from fastapi import Depends,HTTPException,status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import verify_access_token

async def get_db() -> AsyncGenerator[AsyncSession,None]:
        async with AsyncSessionLocal() as session:
                try:
                        yield session
                        await session.commit()
                except Exception:
                        await session.rollback()
                        raise
                

# OAuth2scheme - this tells fast api where to find the tokens 
# token url is shown in /docs so the UI knows where to login 
oauth2_scheme =OAuth2PasswordBearer(tokenUrl="/auth/login")

# get_current_user -- the dependency every protected route uses

async def get_current_user(
                token : str = Depends(oauth2_scheme), # fast api extracts bearer token from the headers
                db : AsyncSession = Depends(get_db), # Inject db session
) -> User:
        """Validates the JWT token and return the user it belongs to.
        Any endpoint that declares Depends(get_current_user) is automatically protected.
        If token is missing, invalid or expired - 401 is returned before the endpoint returns"""

        # step 1 verify token signature and expiry, get user_id string 
        user_id_str = verify_access_token(token)

        # step 2  fetch user from the database 
        result = await db.execute(
                select(User).where(User.id == uuid.UUID(user_id_str))
        )
        user = result.scalar_one_or_none()

        # step 3 - confirms user still exists and active 
        if user is None:
                raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User Not Found",
                        headers={"WWW-Authenticate":"Bearer"},
                )
        if not user.is_active:
                raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This account has been deactivated",
                )
        return user
