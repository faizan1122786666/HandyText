"""Rebuild OCR detections into multi-line text that matches document layout."""
import re
from typing import List, Tuple, Any

# Lines that should always start their own block (never merged into a paragraph).
_BLOCK_START_RE = re.compile(r'^\s*([•‣◦⁃·•\-\*]|\d+[.)])\s+')

# A line ending with one of these is treated as a finished sentence/label, so the
# next line begins a new paragraph instead of being merged in. '_' is included
# because OCR commonly misreads a sentence-ending '.' as '_'.
_TERMINAL_PUNCT = ('.', '!', '?', ':', ';', '_')


def reflow_paragraphs(text: str) -> str:
    """Join wrap-induced line breaks into flowing paragraphs.

    OCR engines emit one hard line break per visual line, which leaves a
    paragraph chopped into a narrow column. This rebuilds flowing paragraphs that
    fill the page left-to-right. Rules:
      - A blank line is a real paragraph break and is kept.
      - A list item (bullet/number) stays on its own line.
      - A short heading/label line keeps the following text on a new line.
      - A line that ends a sentence/label (terminal punctuation) starts a new line.
      - A line ending mid-sentence is merged with the next line (soft wrap).
      - A line ending with '-' joins the next without a space (hyphenated word).
    """
    if not text:
        return text

    lines = text.replace('\r\n', '\n').split('\n')

    # Typical line length (of normal body lines) used to spot short heading lines.
    body_lengths = sorted(
        len(s) for s in (ln.strip() for ln in lines)
        if s and not _BLOCK_START_RE.match(s)
    )
    median_len = body_lengths[len(body_lengths) // 2] if body_lengths else 0
    short_threshold = max(median_len * 0.5, 14)

    def is_headingish(line: str) -> bool:
        # Short line that does not finish a sentence -> likely a heading/title.
        return len(line) <= short_threshold and not line.endswith(_TERMINAL_PUNCT)

    out: List[str] = []
    for raw in lines:
        stripped = raw.strip()

        if not stripped:
            if out and out[-1] != '':
                out.append('')  # keep a single blank line between paragraphs
            continue

        is_block = bool(_BLOCK_START_RE.match(stripped))

        # Start a fresh line after a blank, at the very start, or for a list item.
        if not out or out[-1] == '' or is_block:
            out.append(stripped)
            continue

        prev = out[-1]
        prev_is_block = bool(_BLOCK_START_RE.match(prev))

        if prev.endswith(_TERMINAL_PUNCT):
            out.append(stripped)             # previous sentence/label ended here
        elif not prev_is_block and is_headingish(prev):
            out.append(stripped)             # previous line is a short heading/title
        elif prev.endswith('-'):
            out[-1] = prev + stripped        # hyphenated word split across lines
        else:
            out[-1] = prev + ' ' + stripped  # soft-wrapped continuation

    while out and out[-1] == '':
        out.pop()

    return '\n'.join(out)


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

    # Emit one line per visual text row, with a blank line where there is a clear
    # vertical gap (a paragraph/section break). Merging wrapped lines back into
    # flowing paragraphs is done separately by reflow_paragraphs(), which works
    # for every OCR engine (not just ones that return box geometry).
    output_lines: List[str] = []
    prev_bottom = None
    for group in line_groups:
        group.sort(key=lambda i: i["left"])

        top = min(i["cy"] - i["h"] / 2 for i in group)
        bottom = max(i["cy"] + i["h"] / 2 for i in group)

        if prev_bottom is not None and (top - prev_bottom) > avg_height * paragraph_gap_factor:
            output_lines.append("")

        line_text = " ".join(i["text"] for i in group).strip()
        if line_text:
            output_lines.append(line_text)
            prev_bottom = bottom

    return reflow_paragraphs("\n".join(output_lines))


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
