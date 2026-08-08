import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
import bcrypt as bcrypt_lib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException,status
from fastapi.concurrency import run_in_threadpool # for non blocking cpu work

from app.config import get_settings
from app.models.user import User
from app.schemas.user import UserRegister

settings = get_settings()
# Using bcrypt directly — passlib is incompatible with bcrypt 4.x+

# Job 1 is password operation  (It should be non-blocking)
async def hash_password(plain_password: str) -> str:
    """Uses the threadpool to avoid blocking the async event loop"""
    def _hash() -> str:
        salt = bcrypt_lib.gensalt()
        return bcrypt_lib.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")
    return await run_in_threadpool(_hash)

async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Uses a threadpool to avoid blocking the async event loop"""
    def _verify() -> bool:
        return bcrypt_lib.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    return await run_in_threadpool(_verify)

# Job 2 Database Operations 
async def get_user_by_email(db:AsyncSession,email:str) -> User | None:
    # always lowercase emails for consistency 
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()

# creating a new user in the databse
async def create_user(db:AsyncSession, data:UserRegister) -> User:
    existing = await get_user_by_email(db,data.email)
    if existing:
        # raise user already registered 
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )
    user = User(
        email = data.email.lower(), # normalize to lowercase
        password_hash = await hash_password(data.password),
        full_name = data.full_name,
    )
    db.add(user)
    await db.flush() # transaction boundary managed by dependency 
    await db.refresh(user) # fetch db generated values 
    return user

# Job 3 Token Operations 

def create_access_token(user_id : uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes= settings.access_token_expire_minutes
    )
    payload = {
        "sub":str(user_id),
        "exp":expire,
        "iat":datetime.now(timezone.utc),
    }
    return jwt.encode(payload,settings.secret_key, algorithm=settings.algorithm)

def verify_access_token(token:str)-> str:
    """Verify signature and return user_id. It's very critical for get_current_user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate":"Bearer"},
    )
    try:
        payload = jwt.decode(token,settings.secret_key,algorithms=[settings.algorithm])
        user_id : str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return user_id
    except JWTError:
        raise credentials_exception
    

# verify_access_token remains same as yours (it's already solid) ...
async def authenticate_user(db:AsyncSession,email:str,password:str) -> User:
    user = await get_user_by_email(db,email)

    # we are using await here because verify_password is also async/threaded
    if not user or not await verify_password(password,user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password", # this will avoid info leaks
            headers={"WWW-Authenticate":"Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated"
        )
    return user
