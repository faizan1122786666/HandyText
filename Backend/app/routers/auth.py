from fastapi import APIRouter, Depends, HTTPException, status, Request
from ..models.user import User
from ..models.otp import OTP
from ..models.feedback import Feedback
from ..schemas.user import UserCreate, UserLogin, UserOut, Token, UserUpdate
from ..utils.auth import get_password_hash, verify_password, create_access_token, get_current_user
from ..services.mail_service import generate_otp, send_otp_email
from ..services.cloudinary_service import upload_profile_image
from ..config import settings
from datetime import datetime, timedelta, timezone
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import UploadFile, File
from beanie.exceptions import CollectionWasNotInitialized
from pymongo.errors import DuplicateKeyError, PyMongoError

router = APIRouter(prefix="/auth", tags=["Authentication"])


def ensure_db_ready(request: Request):
    if getattr(request.app.state, "db_ready", False):
        return
    db_error = getattr(request.app.state, "db_error", None)
    detail = "Database is not connected. Please check Backend/.env DATABASE_URL and restart backend."
    if db_error:
        detail = f"{detail} Startup error: {db_error}"
    raise HTTPException(status_code=503, detail=detail)


def raise_db_error(exc: Exception):
    raise HTTPException(
        status_code=503,
        detail=f"Database operation failed. Please verify DATABASE_URL and backend startup logs. Error: {exc}"
    )

@router.post("/google-login", response_model=Token)
async def google_login(token_data: dict, request: Request):
    """
    Verify Google ID token and login/register the user.
    """
    ensure_db_ready(request)
    credential = token_data.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    try:
        # Get client ID from KEYS.txt or settings
        client_id = None
        master_keys_path = os.path.join(os.getcwd(), "KEYS.txt")
        if os.path.exists(master_keys_path):
            with open(master_keys_path, "r") as f:
                for line in f:
                    if line.startswith("GOOGLE_CLIENT_ID="):
                        client_id = line.strip().split("=", 1)[1]
                        break
        
        if not client_id or client_id == "your_google_client_id_here":
            client_id = settings.GOOGLE_CLIENT_ID

        if not client_id:
            raise HTTPException(status_code=500, detail="Google Client ID not configured")

        # Verify the token
        idinfo = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
        
        email = idinfo['email']
        username = idinfo.get('name', email.split('@')[0])
        
        # Check if user exists
        try:
            user = await User.find_one({"email": email})
        except (CollectionWasNotInitialized, PyMongoError) as db_exc:
            raise_db_error(db_exc)

        if not user:
            # Register new user
            user = User(
                username=username,
                email=email,
                hashed_password=get_password_hash(generate_otp(12)) # Random password for social login
            )
            try:
                await user.insert()
            except DuplicateKeyError:
                # A user might have been created concurrently; fetch it and continue.
                user = await User.find_one({"email": email})
            except (CollectionWasNotInitialized, PyMongoError) as db_exc:
                raise_db_error(db_exc)
        
        access_token = create_access_token(data={"sub": user.username})
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": user
        }
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, request: Request):
    ensure_db_ready(request)
    # Check if user exists
    try:
        existing_user = await User.find_one({"$or": [{"username": user_in.username}, {"email": user_in.email}]})
    except (CollectionWasNotInitialized, PyMongoError) as db_exc:
        raise_db_error(db_exc)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password)
    )
    try:
        await new_user.insert()
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    except (CollectionWasNotInitialized, PyMongoError) as db_exc:
        raise_db_error(db_exc)
    return new_user

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, request: Request):
    ensure_db_ready(request)
    # Allow login by email or username
    try:
        user = await User.find_one({"$or": [{"username": user_in.username}, {"email": user_in.username}]})
    except (CollectionWasNotInitialized, PyMongoError) as db_exc:
        raise_db_error(db_exc)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/forgot-password")
async def forgot_password(email: str):
    # Check if user exists
    user = await User.find_one({"email": email})
    if not user:
        # For security, we don't reveal if the user exists
        return {"message": "If an account exists with this email, an OTP has been sent."}

    # Generate and save OTP
    code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=1)
    
    otp_record = OTP(email=email, code=code, expires_at=expires_at)
    await otp_record.insert()

    # Send OTP
    await send_otp_email(email, code)
    
    return {"message": "OTP sent successfully"}

@router.post("/verify-otp")
async def verify_otp(email: str, code: str):
    # Verify OTP
    otp_record = await OTP.find_one({"email": email, "code": code}, sort=[("-created_at", -1)])

    if not otp_record or otp_record.is_expired():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return {"message": "OTP verified successfully"}

@router.post("/reset-password")
async def reset_password(email: str, code: str, new_password: str):
    # Verify OTP
    otp_record = await OTP.find_one({"email": email, "code": code}, sort=[("-created_at", -1)])

    if not otp_record or otp_record.is_expired():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Update Password
    user = await User.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.hashed_password = get_password_hash(new_password)
    await user.save()
    
    # Delete the used OTP
    await otp_record.delete()

    return {"message": "Password reset successful"}

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserOut)
async def update_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    
    # Update all user's existing feedbacks with latest full name
    await Feedback.find_many({"user_id": str(current_user.id)}).update(
        {"$set": {"full_name": current_user.full_name}}
    )
    
    return current_user

@router.post("/profile-image", response_model=UserOut)
async def update_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Save file temporarily
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    import uuid
    temp_path = os.path.join(settings.UPLOAD_DIR, f"temp_profile_{uuid.uuid4()}{os.path.splitext(file.filename)[1]}")
    import aiofiles
    async with aiofiles.open(temp_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    # Upload to Cloudinary
    image_url = upload_profile_image(temp_path)
    
    # Cleanup temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)
    
    # Update user profile
    current_user.profile_image = image_url
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    
    # Update all user's existing feedbacks with latest profile image
    await Feedback.find_many({"user_id": str(current_user.id)}).update(
        {"$set": {"profile_image": current_user.profile_image}}
    )
    
    return current_user


@router.post("/change-password")
async def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user)
):
    # Verify current password is correct
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Check new password length
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    current_user.hashed_password = get_password_hash(new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    
    return {"message": "Password changed successfully"}
