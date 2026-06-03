"""
OpenCV-based image preprocessing for OCR and graph analysis.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional, Tuple

import cv2
import numpy as np

from ..config import settings

logger = logging.getLogger(__name__)


def load_image_bgr(path: str) -> np.ndarray:
    image = cv2.imread(path)
    if image is None:
        raise ValueError(f"Could not read image: {path}")
    return image


def to_grayscale(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def remove_noise(gray: np.ndarray) -> np.ndarray:
    return cv2.fastNlMeansDenoising(gray, h=10)


def enhance_contrast(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def apply_threshold(gray: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def deskew(gray: np.ndarray) -> Tuple[np.ndarray, float]:
    """Correct mild rotation using minimum-area rectangle on text pixels."""
    binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(binary > 0))
    if coords.size < 100:
        return gray, 0.0

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90

    if abs(angle) < 0.5:
        return gray, 0.0

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray,
        matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated, float(angle)


def upscale_if_small(gray: np.ndarray, min_width: int = 1000) -> np.ndarray:
    height, width = gray.shape[:2]
    if width >= min_width:
        return gray
    scale = min_width / width
    return cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def preprocess_image_array(
    image: np.ndarray,
    *,
    grayscale: bool = True,
    denoise: bool = True,
    contrast: bool = True,
    threshold: bool = True,
    deskew_image: bool = True,
    upscale: bool = True,
) -> np.ndarray:
    """Run preprocessing pipeline on an in-memory image (BGR or grayscale)."""
    work = image.copy()
    if grayscale and len(work.shape) == 3:
        work = to_grayscale(work)

    if denoise:
        work = remove_noise(work)
    if contrast:
        work = enhance_contrast(work)
    if deskew_image:
        work, angle = deskew(work)
        if abs(angle) >= 0.5:
            logger.debug("Deskew applied: %.2f degrees", angle)
    if upscale:
        work = upscale_if_small(work)
    if threshold:
        work = apply_threshold(work)

    return work


def preprocess_for_ocr(
    file_path: str,
    *,
    enhance: bool = True,
    lang_code: str = "en",
    save_processed: bool = True,
) -> str:
    """
    Preprocess an image file for OCR. Returns path to processed image (or original if enhance=False).
    Urdu uses lighter preprocessing to preserve script details.
    """
    if not enhance:
        return file_path

    try:
        image = load_image_bgr(file_path)
        light_mode = lang_code == "ur"
        processed = preprocess_image_array(
            image,
            grayscale=True,
            denoise=not light_mode,
            contrast=True,
            threshold=not light_mode,
            deskew_image=True,
            upscale=not light_mode,
        )

        if not save_processed:
            temp_path = os.path.join(settings.UPLOAD_DIR, f"tmp_{uuid.uuid4().hex}.png")
            cv2.imwrite(temp_path, processed)
            return temp_path

        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        processed_filename = f"processed_{uuid.uuid4().hex}.png"
        processed_path = os.path.join(settings.UPLOAD_DIR, processed_filename)
        cv2.imwrite(processed_path, processed)
        logger.info("Preprocessed image saved: %s", processed_path)
        return processed_path

    except Exception as exc:
        logger.warning("Preprocessing failed for %s: %s", file_path, exc)
        return file_path


def preprocess_for_graph(file_path: str) -> np.ndarray:
    """Return grayscale ndarray optimized for graph/chart detection."""
    image = load_image_bgr(file_path)
    gray = to_grayscale(image)
    gray = remove_noise(gray)
    gray = enhance_contrast(gray)
    return gray
