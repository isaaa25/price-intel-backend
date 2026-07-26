# from __future__ import annotations
# from typing import AsyncGenerator
# from sqlalchemy.ext.asyncio import AsyncSession
# from app.database import AsyncSessionLocal
# from app.models import * 
# import uuid
# from fastapi import Depends,HTTPException,status
# from fastapi.security import OAuth2PasswordBearer
# from sqlalchemy import select
# from sqlalchemy.ext.asyncio import AsyncSession

# from app.database import AsyncSessionLocal
# from app.models.user import User
# from app.services.auth_service import verify_access_token

# async def get_db() -> AsyncGenerator[AsyncSession,None]:
#         async with AsyncSessionLocal() as session:
#                 try:
#                         yield session
#                         await session.commit()
#                 except Exception:
#                         await session.rollback()
#                         raise
                

# # OAuth2scheme - this tells fast api where to find the tokens 
# # token url is shown in /docs so the UI knows where to login 
# oauth2_scheme =OAuth2PasswordBearer(tokenUrl="/auth/login")

# # get_current_user -- the dependency every protected route uses

# async def get_current_user(
#                 token : str = Depends(oauth2_scheme), # fast api extracts bearer token from the headers
#                 db : AsyncSession = Depends(get_db), # Inject db session
# ) -> User:
#         """Validates the JWT token and return the user it belongs to.
#         Any endpoint that declares Depends(get_current_user) is automatically protected.
#         If token is missing, invalid or expired - 401 is returned before the endpoint returns"""

#         # step 1 verify token signature and expiry, get user_id string 
#         user_id_str = verify_access_token(token)

#         # step 2  fetch user from the database 
#         result = await db.execute(
#                 select(User).where(User.id == uuid.UUID(user_id_str))
#         )
#         user = result.scalar_one_or_none()

#         # step 3 - confirms user still exists and active 
#         if user is None:
#                 raise HTTPException(
#                         status_code=status.HTTP_401_UNAUTHORIZED,
#                         detail="User Not Found",
#                         headers={"WWW-Authenticate":"Bearer"},
#                 )
#         if not user.is_active:
#                 raise HTTPException(
#                         status_code=status.HTTP_403_FORBIDDEN,
#                         detail="This account has been deactivated",
#                 )
#         return user
"""
app/dependencies.py

FIX vs. previous version: OAuth2PasswordBearer swapped for HTTPBearer.

WHY THIS CHANGE:
OAuth2PasswordBearer tells Swagger UI's "Authorize" dialog to behave
like a real OAuth2 password-grant client: it POSTs username/password
as form-encoded data directly to tokenUrl, expecting back a token in
the OAuth2-standard shape. But /auth/login here is a plain JSON
endpoint (UserLogin schema, presumably an "email" field, not
"username"), returning a custom TokenResponse shape — it was never
built to be a spec-compliant OAuth2 token endpoint. That mismatch is
exactly what produced the 422 "Unprocessable Content" when Swagger
tried to log in on your behalf.

HTTPBearer is simpler and matches what's actually happening: the user
logs in separately via POST /auth/login (as a normal JSON request,
either through Swagger's own request body or a frontend), copies the
returned access_token, and pastes it into Swagger's Authorize dialog
directly. HTTPBearer's dialog is just a single "Value" text box for
the raw token — no fake login attempt involved.

Nothing about get_current_user's actual logic changes — it still reads
a bearer token string and validates it the same way. Only where that
token string comes from (a full HTTPAuthorizationCredentials object
now, instead of a bare string) changes, so token.credentials replaces
the bare token parameter.
"""

from __future__ import annotations
from typing import AsyncGenerator
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import verify_access_token


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# HTTPBearer — tells Swagger UI's Authorize dialog to show a single
# "paste your token" field, matching how this API actually issues and
# expects tokens (a JSON login endpoint returning access_token, not a
# spec OAuth2 password-grant flow).
bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates the JWT token and returns the user it belongs to.
    Any endpoint that declares Depends(get_current_user) is
    automatically protected. If the token is missing, invalid, or
    expired — 401 is returned before the endpoint runs.

    credentials.credentials is the raw bearer token string —
    HTTPBearer already stripped the "Bearer " prefix and validated
    that the Authorization header was present and well-formed before
    this function ever runs; a missing/malformed header short-circuits
    to a 401/403 automatically, same as OAuth2PasswordBearer did.
    """
    token = credentials.credentials

    # step 1: verify token signature and expiry, get user_id string
    user_id_str = verify_access_token(token)

    # step 2: fetch user from the database
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id_str))
    )
    user = result.scalar_one_or_none()

    # step 3: confirm user still exists and is active
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User Not Found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )
    return user