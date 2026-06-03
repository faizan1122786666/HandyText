from pydantic import BaseModel, EmailStr, ConfigDict, Field
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(UserBase):
    id: PydanticObjectId
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool
    full_name: Optional[str] = None
    profile_image: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenData(BaseModel):
    username: Optional[str] = None
