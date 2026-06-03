from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class AxisLine(BaseModel):
    start: List[float] = Field(default_factory=lambda: [0.0, 0.0])
    end: List[float] = Field(default_factory=lambda: [0.0, 0.0])


class GraphAxes(BaseModel):
    x_axis: Optional[AxisLine] = None
    y_axis: Optional[AxisLine] = None
    origin: Optional[List[float]] = None


class GraphPoint(BaseModel):
    x: float
    y: float
    pixel_x: float
    pixel_y: float


class GraphBar(BaseModel):
    x: float
    height: float
    pixel_x: float
    pixel_y: float
    width: float


class GraphLineSeries(BaseModel):
    points: List[GraphPoint] = Field(default_factory=list)


class GraphResponse(BaseModel):
    success: bool = True
    graph_type: str = "unknown"
    axes: GraphAxes = Field(default_factory=GraphAxes)
    points: List[GraphPoint] = Field(default_factory=list)
    lines: List[GraphLineSeries] = Field(default_factory=list)
    bars: List[GraphBar] = Field(default_factory=list)
    coordinates: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    csv_file: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
