"""Rebuild OCR detections into multi-line text that matches document layout."""
from typing import List, Tuple, Any


def _bbox_metrics(bbox) -> tuple:
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    height = max(ys) - min(ys)
    width = max(xs) - min(xs)
    return cx, cy, height, width


def layout_text_from_detections(
    results: List[Tuple[Any, str, float]],
    paragraph_gap_factor: float = 1.35,
    lang_code: str = 'en'
) -> str:
    """
    Group EasyOCR boxes into lines (by Y position) and paragraphs (by vertical gaps).
    Words on the same line are joined with spaces; lines with \n; larger gaps get a blank line.
    Attempts to preserve horizontal spacing (useful for letters/forms).
    Handles Urdu (RTL).
    """
    items = []
    for bbox, text, prob in results:
        stripped = (text or "").strip()
        if not stripped:
            continue
        cx, cy, h, w = _bbox_metrics(bbox)
        # Calculate left and right edges
        left = cx - w / 2
        right = cx + w / 2
        items.append({
            "text": stripped, 
            "cx": cx, 
            "cy": cy, 
            "h": h, 
            "w": w, 
            "left": left,
            "right": right,
            "prob": prob
        })

    if not items:
        return ""

    # Estimate average character width
    total_chars = sum(len(i["text"]) for i in items)
    total_width = sum(i["w"] for i in items)
    avg_char_width = total_width / total_chars if total_chars > 0 else 10.0
    
    avg_height = sum(i["h"] for i in items) / len(items) or 12.0
    line_threshold = max(avg_height * 0.55, 10.0)

    items.sort(key=lambda i: (i["cy"], i["cx"]))

    line_groups: List[List[dict]] = []
    current = [items[0]]
    for item in items[1:]:
        if abs(item["cy"] - current[-1]["cy"]) <= line_threshold:
            current.append(item)
        else:
            line_groups.append(current)
            current = [item]
    line_groups.append(current)

    output_lines: List[str] = []
    prev_bottom = None
    is_rtl = lang_code == 'ur'

    for group in line_groups:
        if is_rtl:
            # For RTL, sort from right to left
            group.sort(key=lambda i: -i["left"])
        else:
            group.sort(key=lambda i: i["left"])
        
        top = min(i["cy"] - i["h"] / 2 for i in group)
        bottom = max(i["cy"] + i["h"] / 2 for i in group)

        if prev_bottom is not None:
            gap = top - prev_bottom
            if gap > avg_height * paragraph_gap_factor:
                output_lines.append("")

        # Join words with appropriate spacing
        line_text = ""
        last_right = None
        
        # Handle initial indentation (if any)
        min_left = min(i["left"] for i in items)
        if not is_rtl and group[0]["left"] - min_left > avg_char_width * 4:
            num_spaces = int((group[0]["left"] - min_left) / avg_char_width)
            line_text += " " * num_spaces

        for item in group:
            if last_right is not None:
                gap = abs(item["left"] - last_right)
                if gap > avg_char_width * 1.5:
                    num_spaces = max(1, int(gap / avg_char_width))
                    line_text += " " * num_spaces
                else:
                    line_text += " "
            
            line_text += item["text"]
            last_right = item["right"]

        output_lines.append(line_text)
        prev_bottom = bottom

    return "\n".join(output_lines)


def low_confidence_spans(
    results: List[Tuple[Any, str, float]],
    threshold: float = 0.65,
) -> List[dict]:
    """Flag likely OCR mistakes for the AI suggestions panel."""
    spans = []
    for bbox, text, prob in results:
        stripped = (text or "").strip()
        if stripped and prob < threshold:
            spans.append({"text": stripped, "confidence": round(prob, 2)})
    return spans
