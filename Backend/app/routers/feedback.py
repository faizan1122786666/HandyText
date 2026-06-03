from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from ..models.feedback import Feedback
from ..models.user import User
from ..utils.auth import get_current_user
from beanie import PydanticObjectId

router = APIRouter(prefix="/feedback", tags=["Feedback"])

class FeedbackCreate(BaseModel):
    comment: str
    rating: int

class FeedbackOut(BaseModel):
    id: PydanticObjectId
    username: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    comment: str
    rating: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=FeedbackOut)
async def create_feedback(
    feedback_in: FeedbackCreate,
    current_user: User = Depends(get_current_user)
):
    if feedback_in.rating < 1 or feedback_in.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    if not feedback_in.comment.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    feedback = Feedback(
        user_id=str(current_user.id),
        username=current_user.username,
        full_name=current_user.full_name,
        profile_image=current_user.profile_image,
        comment=feedback_in.comment,
        rating=feedback_in.rating
    )
    await feedback.insert()
    return feedback

@router.get("/", response_model=List[FeedbackOut])
async def get_feedbacks():
    feedbacks = await Feedback.find_all().sort("-created_at").limit(50).to_list()
    
    # Get all unique user IDs
    user_ids = list({f.user_id for f in feedbacks})
    
    # Fetch the latest user data for all users
    users = await User.find({"_id": {"$in": [PydanticObjectId(uid) for uid in user_ids]}}).to_list()
    user_map = {str(user.id): user for user in users}
    
    # Update feedbacks with latest user data
    for feedback in feedbacks:
        if feedback.user_id in user_map:
            user = user_map[feedback.user_id]
            feedback.full_name = user.full_name
            feedback.username = user.username
            feedback.profile_image = user.profile_image
    
    return feedbacks
