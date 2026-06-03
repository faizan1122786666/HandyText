import cv2
import numpy as np
from PIL import Image
import os
import uuid
from ..config import settings

def preprocess_image(file_path: str, enhance: bool = True, lang_code: str = 'en') -> str:
    """
    Preprocess image for better OCR results: grayscale, denoise, threshold, resize.
    """
    if not enhance:
        return file_path
        
    try:
        # For Urdu, use the original image as-is!
        if lang_code == 'ur':
            return file_path

        # Load image
        img = cv2.imread(file_path)
        if img is None:
            raise Exception("Could not read image with OpenCV")

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Upscale if too small (min width 1000px)
        height, width = gray.shape
        if width < 1000:
            scaling_factor = 1000 / width
            gray = cv2.resize(gray, None, fx=scaling_factor, fy=scaling_factor, interpolation=cv2.INTER_CUBIC)

        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray, h=10)

        # Threshold (Otsu's binarization)
        _, thresholded = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Save preprocessed image
        processed_filename = f"processed_{uuid.uuid4()}.png"
        processed_path = os.path.join(settings.UPLOAD_DIR, processed_filename)
        cv2.imwrite(processed_path, thresholded)

        return processed_path

    except Exception as e:
        print(f"Image Preprocessing Error: {e}")
        # Return original path if preprocessing fails
        return file_path
