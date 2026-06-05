"""
Digital text -> handwriting renderer.

Renders typed text in a handwriting-style font onto a page. The page is either a
blank A4 sheet or an image the user uploads (used as the paper/background).
"""
import io
import os
import random

from PIL import Image, ImageDraw, ImageFont

_FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "handwriting")

# id -> (display label, file name, style overrides)
FONTS = {
    "caveat": ("Caveat", "Caveat-Regular.ttf", {}),
    "patrick": ("Patrick Hand", "PatrickHand-Regular.ttf", {}),
    "dancing": ("Dancing Script", "DancingScript-Regular.ttf", {}),
    "caveat_large": ("Caveat Notebook", "Caveat-Regular.ttf", {"size_delta": 5, "line_height": 1.72, "jitter": 3}),
    "caveat_tight": ("Caveat Compact", "Caveat-Regular.ttf", {"size_delta": -4, "line_height": 1.42, "jitter": 1}),
    "patrick_marker": ("Patrick Marker", "PatrickHand-Regular.ttf", {"size_delta": 2, "line_height": 1.58, "stroke": 1}),
    "patrick_neat": ("Patrick Neat", "PatrickHand-Regular.ttf", {"size_delta": -2, "line_height": 1.5, "jitter": 1}),
    "dancing_elegant": ("Dancing Elegant", "DancingScript-Regular.ttf", {"size_delta": 3, "line_height": 1.82, "jitter": 2}),
    "dancing_small": ("Dancing Small", "DancingScript-Regular.ttf", {"size_delta": -5, "line_height": 1.55, "jitter": 1}),
}
DEFAULT_FONT = "caveat"

# A4 at ~150 DPI for the blank-page fallback.
A4_W, A4_H = 1240, 1754
MAX_BG_WIDTH = 1600


def list_fonts():
    return [{"id": key, "label": label} for key, (label, _file, _style) in FONTS.items()]


def _font_path(font_id: str) -> str:
    _label, file_name, _style = FONTS.get(font_id, FONTS[DEFAULT_FONT])
    return os.path.join(_FONT_DIR, file_name)


def _font_style(font_id: str) -> dict:
    _label, _file_name, style = FONTS.get(font_id, FONTS[DEFAULT_FONT])
    return style


def _wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_width: float):
    """Word-wrap to the page width while preserving the user's own line breaks."""
    lines = []
    for raw in (text or "").replace("\r\n", "\n").split("\n"):
        if not raw.strip():
            lines.append("")
            continue
        current = ""
        for word in raw.split(" "):
            trial = word if not current else f"{current} {word}"
            if not current or font.getlength(trial) <= max_width:
                current = trial
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def generate_handwriting(
    text: str,
    font_id: str = DEFAULT_FONT,
    font_size: int = 44,
    ink_color: str = "#22356f",
    background_bytes: bytes | None = None,
) -> Image.Image:
    style = _font_style(font_id)
    font_size = max(20, min(int(font_size or 44) + style.get("size_delta", 0), 120))
    font = ImageFont.truetype(_font_path(font_id), font_size)

    # Canvas: the uploaded image (as paper) or a blank A4 sheet.
    canvas = None
    if background_bytes:
        try:
            bg = Image.open(io.BytesIO(background_bytes)).convert("RGB")
            if bg.width > MAX_BG_WIDTH:
                ratio = MAX_BG_WIDTH / bg.width
                bg = bg.resize((MAX_BG_WIDTH, int(bg.height * ratio)))
            canvas = bg
        except Exception:
            canvas = None
    if canvas is None:
        canvas = Image.new("RGB", (A4_W, A4_H), "white")

    draw = ImageDraw.Draw(canvas)
    margin_x = int(canvas.width * 0.08)
    margin_y = int(canvas.height * 0.06)
    max_text_width = canvas.width - 2 * margin_x
    line_height = int(font_size * style.get("line_height", 1.65))
    jitter = int(style.get("jitter", 2))
    stroke_width = int(style.get("stroke", 0))

    lines = _wrap_lines(text, font, max_text_width)

    y = margin_y
    for line in lines:
        if y > canvas.height - margin_y:
            break  # single page for now; overflow is dropped
        if line:
            # Draw word by word with a tiny baseline jitter so it looks natural.
            line_jitter = random.randint(-jitter, jitter)
            x = margin_x
            for word in line.split(" "):
                draw.text(
                    (x, y + line_jitter + random.randint(-1, 1)),
                    word,
                    font=font,
                    fill=ink_color,
                    stroke_width=stroke_width,
                    stroke_fill=ink_color,
                )
                x += font.getlength(f"{word} ")
        y += line_height

    return canvas


def to_bytes(image: Image.Image, fmt: str = "png") -> io.BytesIO:
    buf = io.BytesIO()
    if fmt == "pdf":
        image.save(buf, format="PDF", resolution=150.0)
    else:
        image.save(buf, format="PNG")
    buf.seek(0)
    return buf
