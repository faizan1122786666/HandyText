"""
Database configuration for HandyText.
Uses MongoDB with Motor (async driver) and Beanie ODM.
"""
import os
from .config import settings


def get_database_url() -> str:
    """
    Resolve the MongoDB connection URL.
    Priority: KEYS.txt → .env / settings.DATABASE_URL
    """
    # Priority 1: Backend/KEYS.txt
    master_keys_path = os.path.join(os.getcwd(), "KEYS.txt")
    if os.path.exists(master_keys_path):
        with open(master_keys_path, "r") as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    url = line.strip().split("=", 1)[1]
                    # Only use KEYS.txt value if it's a valid MongoDB URL
                    if url and url.startswith("mongodb"):
                        return url

    return settings.DATABASE_URL