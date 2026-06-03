import cloudinary
import cloudinary.uploader
import os
from ..config import settings

def get_cloudinary_config():
    """
    Read Cloudinary config from Backend/KEYS.txt or Backend/AI/cloudinary_keys.txt or fallback to environment variables.
    """
    config = {
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "api_key": settings.CLOUDINARY_API_KEY,
        "api_secret": settings.CLOUDINARY_API_SECRET
    }

    # Priority 1: Backend/KEYS.txt
    master_keys_path = os.path.join(os.getcwd(), "KEYS.txt")
    if os.path.exists(master_keys_path):
        with open(master_keys_path, "r") as f:
            for line in f:
                if "=" in line:
                    key, value = line.strip().split("=", 1)
                    if key == "CLOUDINARY_CLOUD_NAME": config["cloud_name"] = value
                    elif key == "CLOUDINARY_API_KEY": config["api_key"] = value
                    elif key == "CLOUDINARY_API_SECRET": config["api_secret"] = value

    # Priority 2: Backend/AI/cloudinary_keys.txt (legacy support)
    if not config["cloud_name"]:
        key_file_path = os.path.join(os.getcwd(), "AI", "cloudinary_keys.txt")
        if os.path.exists(key_file_path):
            with open(key_file_path, "r") as f:
                for line in f:
                    if "=" in line:
                        key, value = line.strip().split("=", 1)
                        if key == "CLOUD_NAME": config["cloud_name"] = value
                        elif key == "API_KEY": config["api_key"] = value
                        elif key == "API_SECRET": config["api_secret"] = value
    
    return config

def init_cloudinary():
    config = get_cloudinary_config()
    if config["cloud_name"] and config["api_key"] and config["api_secret"]:
        cloudinary.config(
            cloud_name=config["cloud_name"],
            api_key=config["api_key"],
            api_secret=config["api_secret"],
            secure=True
        )
        return True
    return False

def upload_image(file_path: str, folder: str = "handytext/uploads") -> dict:
    """
    Upload an image to Cloudinary and return the result.
    """
    if not init_cloudinary():
        print("Cloudinary not configured. Using local path.")
        return {"url": file_path, "public_id": None}

    try:
        result = cloudinary.uploader.upload(file_path, folder=folder)
        return {
            "url": result.get("secure_url"),
            "public_id": result.get("public_id")
        }
    except Exception as e:
        print(f"Cloudinary Upload Error: {e}")
        return {"url": file_path, "public_id": None}

def upload_profile_image(file_path: str) -> str:
    """
    Upload a profile image to Cloudinary and return the URL.
    """
    result = upload_image(file_path, folder="handytext/profiles")
    return result["url"]
