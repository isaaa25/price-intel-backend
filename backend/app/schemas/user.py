from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel,EmailStr,ConfigDict,field_validator,Field

# Input schemas -- What the API accepts 
class UserRegister(BaseModel):
    """Shape of the data required to create a new account."""
    email : EmailStr   # pydantic validates email format automatically
    password : str = Field(...,min_length=8)
    full_name : str | None = None # Optional -- user may not provide it


    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be atleast 8 characters.")
        return v.lower()
    
class UserLogin(BaseModel):
    """Shape of the data required to authenticate"""
    email : EmailStr
    password : str

# Output schemas -- What the API returns 
class UserResponse(BaseModel):
    """Safe public representation of a user.
    Never includes password or password hash."""
    model_config = ConfigDict(from_attributes=True)
       # from_attributes=True is the bridge between SQLAlchemy and Pydantic.
    # Without it, Pydantic only reads plain dicts.
    # With it, Pydantic can read directly from SQLAlchemy model attributes.
    # This means you can do: UserResponse.model_validate(user_orm_object)
    id : uuid.UUID
    email : EmailStr
    full_name : str | None
    plan : str
    is_active : bool
    created_at : datetime
    updated_at : datetime

class TokenResponse(BaseModel):
    """Shape of the authentication token returned after login or register"""
    access_token : str
    token_type : str = "bearer" # always bearer -- this is the HTTP standard
    user : UserResponse # embed the safe user object alongside the token 

#     class UserBase(BaseModel):
#     email: EmailStr
#     full_name: str | None = None

# class UserRegister(UserBase):      # inherits email and full_name, adds password
#     password: str

# class UserUpdate(UserBase):        # inherits email and full_name, all optional
#     email: EmailStr | None = None

