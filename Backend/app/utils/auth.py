from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi import Request
from fastapi.security import OAuth2PasswordBearer
from beanie.exceptions import CollectionWasNotInitialized
from pymongo.errors import PyMongoError
from ..config import settings
from ..models.user import User
from ..schemas.user import TokenData

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def require_db_ready(request: Request):
    if getattr(request.app.state, "db_ready", False):
        return

    db_error = getattr(request.app.state, "db_error", None)
    detail = "Database is not connected. Please check Backend/.env DATABASE_URL and restart backend."
    if db_error:
        detail = f"{detail} Startup error: {db_error}"
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    try:
        user = await User.find_one({"username": token_data.username})
    except (CollectionWasNotInitialized, PyMongoError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database is not ready. Please restart backend and verify DATABASE_URL. Error: {exc}",
        )
    if user is None:
        raise credentials_exception
    return user

async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional)
):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None

    try:
        return await User.find_one({"username": username})
    except (CollectionWasNotInitialized, PyMongoError):
        return None
