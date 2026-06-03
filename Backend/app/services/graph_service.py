"""
Graph/chart analysis: axis detection, points, lines, bars; CSV export.
"""
from __future__ import annotations

import logging
import os
import csv
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from ..config import settings
from ..utils.image_preprocessing import preprocess_for_graph

logger = logging.getLogger(__name__)


def _classify_lines(
    lines: Optional[np.ndarray], min_length: int = 40
) -> Tuple[List[Tuple[int, int, int, int]], List[Tuple[int, int, int, int]]]:
    horizontal: List[Tuple[int, int, int, int]] = []
    vertical: List[Tuple[int, int, int, int]] = []
    if lines is None:
        return horizontal, vertical

    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = np.hypot(x2 - x1, y2 - y1)
        if length < min_length:
            continue
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if angle < 15 or angle > 165:
            horizontal.append((x1, y1, x2, y2))
        elif 75 < angle < 105:
            vertical.append((x1, y1, x2, y2))
    return horizontal, vertical


def _pick_axis(
    lines: List[Tuple[int, int, int, int]], axis: str, shape: Tuple[int, int]
) -> Optional[Dict[str, List[float]]]:
    if not lines:
        return None
    h, w = shape

    if axis == "x":
        candidates = sorted(
            lines,
            key=lambda ln: (ln[1] + ln[3]) / 2,
            reverse=True,
        )[:5]
        x1, y1, x2, y2 = max(candidates, key=lambda ln: abs(ln[2] - ln[0]))
    else:
        candidates = sorted(lines, key=lambda ln: (ln[0] + ln[2]) / 2)[:5]
        x1, y1, x2, y2 = min(candidates, key=lambda ln: (ln[0] + ln[2]) / 2)

    return {"start": [float(x1), float(y1)], "end": [float(x2), float(y2)]}


def _detect_plot_points(edges: np.ndarray, origin: Tuple[float, float]) -> List[Dict[str, float]]:
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    points: List[Dict[str, float]] = []
    ox, oy = origin

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 20 or area > 8000:
            continue
        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        if circularity < 0.35:
            continue
        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            continue
        px = moments["m10"] / moments["m00"]
        py = moments["m01"] / moments["m00"]
        points.append(
            {
                "x": round((px - ox) / max(1.0, 1.0), 4),
                "y": round((oy - py) / max(1.0, 1.0), 4),
                "pixel_x": float(px),
                "pixel_y": float(py),
            }
        )
    return points[:200]


def _detect_bars(gray: np.ndarray, origin: Tuple[float, float]) -> List[Dict[str, float]]:
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 9))
    morphed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    bars: List[Dict[str, float]] = []
    ox, oy = origin
    h, w = gray.shape[:2]

    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        if bh < h * 0.05 or bh > h * 0.85:
            continue
        if bw < 5 or bw > w * 0.25:
            continue
        aspect = bh / max(bw, 1)
        if aspect < 1.2:
            continue
        cx = x + bw / 2
        bars.append(
            {
                "x": round((cx - ox) / max(1.0, 1.0), 4),
                "height": round((oy - y) / max(1.0, 1.0), 4),
                "pixel_x": float(cx),
                "pixel_y": float(y),
                "width": float(bw),
            }
        )
    return bars[:100]


def _detect_line_series(edges: np.ndarray, origin: Tuple[float, float]) -> List[Dict[str, Any]]:
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=60, minLineLength=30, maxLineGap=8
    )
    if lines is None:
        return []

    ox, oy = origin
    series_points: List[Dict[str, float]] = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = np.hypot(x2 - x1, y2 - y1)
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if length < 40 or angle < 10 or angle > 170:
            continue
        for px, py in ((x1, y1), (x2, y2)):
            series_points.append(
                {
                    "x": round((px - ox) / max(1.0, 1.0), 4),
                    "y": round((oy - py) / max(1.0, 1.0), 4),
                    "pixel_x": float(px),
                    "pixel_y": float(py),
                }
            )

    if len(series_points) < 2:
        return []
    return [{"points": series_points[:150]}]


def _infer_graph_type(
    points: List[dict], bars: List[dict], lines: List[dict]
) -> str:
    if bars and len(bars) >= 2:
        return "bar"
    if lines:
        return "line"
    if len(points) >= 3:
        return "scatter"
    if points:
        return "mixed"
    return "unknown"


def _save_graph_csv(
    graph_type: str,
    points: List[dict],
    bars: List[dict],
    lines: List[dict],
    axes: dict,
) -> str:
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    filename = f"graph_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.csv"
    csv_path = os.path.join(settings.EXPORT_DIR, filename)

    rows: List[dict] = []
    for idx, pt in enumerate(points):
        rows.append(
            {
                "record_type": "point",
                "index": idx,
                "graph_type": graph_type,
                "x": pt.get("x"),
                "y": pt.get("y"),
                "pixel_x": pt.get("pixel_x"),
                "pixel_y": pt.get("pixel_y"),
            }
        )
    for idx, bar in enumerate(bars):
        rows.append(
            {
                "record_type": "bar",
                "index": idx,
                "graph_type": graph_type,
                "x": bar.get("x"),
                "y": bar.get("height"),
                "pixel_x": bar.get("pixel_x"),
                "pixel_y": bar.get("pixel_y"),
                "width": bar.get("width"),
            }
        )
    for s_idx, series in enumerate(lines):
        for p_idx, pt in enumerate(series.get("points", [])):
            rows.append(
                {
                    "record_type": "line_point",
                    "series": s_idx,
                    "index": p_idx,
                    "graph_type": graph_type,
                    "x": pt.get("x"),
                    "y": pt.get("y"),
                    "pixel_x": pt.get("pixel_x"),
                    "pixel_y": pt.get("pixel_y"),
                }
            )

    if axes.get("origin"):
        rows.append(
            {
                "record_type": "origin",
                "x": axes["origin"][0],
                "y": axes["origin"][1],
            }
        )

    fieldnames = [
        "record_type",
        "series",
        "index",
        "graph_type",
        "x",
        "y",
        "pixel_x",
        "pixel_y",
        "width",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    logger.info("Graph CSV saved: %s (%d rows)", csv_path, len(rows))
    return csv_path


def analyze_graph(image_path: str) -> dict:
    """
    Detect axes, plotted points, line graphs, and bar charts; export CSV to exports/.
    """
    try:
        gray = preprocess_for_graph(image_path)
        h, w = gray.shape[:2]

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 40, 120)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=80, minLineLength=min(w, h) // 8, maxLineGap=12
        )

        horiz, vert = _classify_lines(lines)
        x_axis = _pick_axis(horiz, "x", (h, w))
        y_axis = _pick_axis(vert, "y", (h, w))

        origin = [float(w * 0.1), float(h * 0.9)]
        if x_axis and y_axis:
            origin = [
                float(y_axis["start"][0]),
                float(x_axis["start"][1]),
            ]

        points = _detect_plot_points(edges, (origin[0], origin[1]))
        bars = _detect_bars(gray, (origin[0], origin[1]))
        line_series = _detect_line_series(edges, (origin[0], origin[1]))
        graph_type = _infer_graph_type(points, bars, line_series)

        axes = {
            "x_axis": x_axis,
            "y_axis": y_axis,
            "origin": origin,
        }

        coordinates = points + [
            {"type": "bar", **b} for b in bars
        ]

        confidence = 0.0
        score_parts = [
            0.35 if x_axis else 0,
            0.35 if y_axis else 0,
            0.15 if points else 0,
            0.1 if bars else 0,
            0.05 if line_series else 0,
        ]
        confidence = min(0.98, sum(score_parts) + (0.1 if graph_type != "unknown" else 0))

        csv_path = _save_graph_csv(graph_type, points, bars, line_series, axes)

        return {
            "success": True,
            "graph_type": graph_type,
            "axes": axes,
            "points": points,
            "lines": line_series,
            "bars": bars,
            "coordinates": coordinates,
            "confidence": round(confidence, 4),
            "csv_file": csv_path.replace("\\", "/"),
            "metadata": {
                "image_width": w,
                "image_height": h,
                "points_detected": len(points),
                "bars_detected": len(bars),
                "line_series_detected": len(line_series),
            },
        }

    except Exception as exc:
        logger.exception("Graph analysis failed: %s", exc)
        return {
            "success": False,
            "graph_type": "unknown",
            "axes": {},
            "points": [],
            "lines": [],
            "bars": [],
            "coordinates": [],
            "confidence": 0.0,
            "csv_file": None,
            "metadata": {"error": str(exc)},
        }
