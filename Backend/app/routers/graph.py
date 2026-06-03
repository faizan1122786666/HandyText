"""
POST /api/graph — detect axes, points, lines, bars; export CSV to exports/.
"""
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from ..schemas.graph import GraphResponse
from ..services.graph_service import analyze_graph
from ..utils.media_io import cleanup_paths, resolve_image_paths, save_upload_to_disk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/graph", tags=["Graph"])


@router.post("", response_model=GraphResponse)
async def analyze_graph_upload(
    file: UploadFile = File(..., description="JPG, JPEG, PNG, or PDF containing a chart/graph"),
):
    """
    Analyze a chart image: detect axes, plotted points, line graphs, bar charts.
    Saves extracted coordinates to exports/ as CSV.
    """
    temp_paths: List[str] = []

    try:
        local_path, ext, _ = await save_upload_to_disk(file)
        temp_paths.append(local_path)

        image_paths = resolve_image_paths(local_path, ext)
        temp_paths.extend(image_paths)

        # Use first page for graph analysis (multi-page PDF: analyze page 1)
        result = analyze_graph(image_paths[0])

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.get("metadata", {}).get("error", "Graph analysis failed"),
            )

        csv_file = result.get("csv_file")
        if csv_file:
            result["csv_file"] = csv_file.replace("\\", "/")

        return GraphResponse(**result)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Graph API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph processing failed: {exc}",
        ) from exc
    finally:
        cleanup_paths(temp_paths)
