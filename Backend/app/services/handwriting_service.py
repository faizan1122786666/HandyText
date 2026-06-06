"""
Digital text -> handwriting renderer.

Renders typed text in a handwriting-style font onto a page. The page can be:
  - a blank A4 sheet,
  - a ruled ("lined") notebook page with a margin line, or
  - an image the user uploads (used as the paper/background).

To look genuinely hand-written (not like a font), each glyph is drawn
individually with a small random rotation, a wavy baseline, per-character
vertical jitter and slight ink-pressure (alpha) variation.
"""
import io
import math
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

PAGE_TYPES = ("a4", "ruled")

# A4 at ~150 DPI for the generated pages.
A4_W, A4_H = 1240, 1754
MAX_BG_WIDTH = 1600

# Ruled-page colours.
_RULE_COLOR = (173, 196, 230)      # soft blue rule lines
_MARGIN_COLOR = (226, 160, 160)    # faded red left margin line
_PAPER_COLOR = (253, 252, 247)     # very light cream paper


def list_fonts():
    return [{"id": key, "label": label} for key, (label, _file, _style) in FONTS.items()]


def _font_path(font_id: str) -> str:
    _label, file_name, _style = FONTS.get(font_id, FONTS[DEFAULT_FONT])
    return os.path.join(_FONT_DIR, file_name)


def _font_style(font_id: str) -> dict:
    _label, _file_name, style = FONTS.get(font_id, FONTS[DEFAULT_FONT])
    return style


def _hex_to_rgb(value: str) -> tuple:
    h = (value or "#22356f").lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return (34, 53, 111)


def _break_long_word(word: str, font: ImageFont.FreeTypeFont, max_width: float):
    """Split a single word that is wider than the page into character chunks
    that each fit within max_width. Without this, one very long word (or the
    same word typed many times with no spaces) would run past the page border
    instead of wrapping onto the next line."""
    pieces = []
    current = ""
    for ch in word:
        trial = current + ch
        if current and font.getlength(trial) > max_width:
            pieces.append(current)
            current = ch
        else:
            current = trial
    if current:
        pieces.append(current)
    return pieces or [word]


def _wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_width: float):
    """Word-wrap to the page width while preserving the user's own line breaks."""
    lines = []
    for raw in (text or "").replace("\r\n", "\n").split("\n"):
        if not raw.strip():
            lines.append("")
            continue
        current = ""
        for word in raw.split(" "):
            # A single word longer than the line width is split across lines so
            # it never overflows the page border.
            if font.getlength(word) > max_width:
                if current:
                    lines.append(current)
                    current = ""
                pieces = _break_long_word(word, font, max_width)
                lines.extend(pieces[:-1])  # full lines
                current = pieces[-1]        # remainder continues this line
                continue
            trial = word if not current else f"{current} {word}"
            if not current or font.getlength(trial) <= max_width:
                current = trial
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def _draw_natural_line(canvas, line, font, x_start, baseline_y, ink_rgb, jitter, stroke_width, rng):
    """Draw one line of text glyph-by-glyph with rotation/jitter for a human look."""
    ascent, descent = font.getmetrics()
    pad = 10
    x = x_start
    wave_phase = rng.uniform(0, math.tau)
    for ch in line:
        if ch == " ":
            x += font.getlength(" ") * rng.uniform(0.85, 1.2)
            continue

        glyph_w = max(1, int(math.ceil(font.getlength(ch))) + 2 * stroke_width)
        glyph = Image.new("RGBA", (glyph_w + 2 * pad, ascent + descent + 2 * pad), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glyph)
        # Slight per-glyph ink-pressure variation.
        alpha = rng.randint(225, 255)
        ink = (ink_rgb[0], ink_rgb[1], ink_rgb[2], alpha)
        gd.text((pad, pad), ch, font=font, fill=ink, stroke_width=stroke_width, stroke_fill=ink)

        # Rotate a touch around the baseline-left point so letters lean naturally.
        rot = rng.uniform(-4.5, 4.5)
        glyph = glyph.rotate(rot, resample=Image.BICUBIC, expand=False, center=(pad, pad + ascent))

        # Wavy baseline + small per-letter vertical jitter.
        wave = math.sin(wave_phase + x * 0.012) * (jitter * 0.6)
        y_off = wave + rng.uniform(-jitter, jitter)
        paste_x = int(round(x - pad))
        paste_y = int(round(baseline_y - (pad + ascent) + y_off))
        canvas.paste(glyph, (paste_x, paste_y), glyph)

        # Advance with a little kerning variation.
        x += font.getlength(ch) * rng.uniform(0.95, 1.07)


def _make_ruled_canvas(line_height: int, margin_x: int, top_margin: int):
    """A lined notebook page: just soft blue horizontal rule lines (no margin)."""
    canvas = Image.new("RGB", (A4_W, A4_H), _PAPER_COLOR)
    draw = ImageDraw.Draw(canvas)
    left = int(A4_W * 0.05)
    right = A4_W - int(A4_W * 0.05)

    baselines = []
    y = top_margin + line_height
    while y < A4_H - top_margin * 0.5:
        draw.line([(left, y), (right, y)], fill=_RULE_COLOR, width=2)
        baselines.append(y - int(line_height * 0.16))  # text sits just above the rule
        y += line_height

    return canvas, baselines


def generate_handwriting(
    text: str,
    font_id: str = DEFAULT_FONT,
    font_size: int = 44,
    ink_color: str = "#22356f",
    background_bytes: bytes | None = None,
    page_type: str = "a4",
) -> Image.Image:
    style = _font_style(font_id)
    font_size = max(20, min(int(font_size or 44) + style.get("size_delta", 0), 120))
    font = ImageFont.truetype(_font_path(font_id), font_size)
    line_height = int(font_size * style.get("line_height", 1.65))
    jitter = float(style.get("jitter", 2)) + 1.5
    stroke_width = int(style.get("stroke", 0))
    ink_rgb = _hex_to_rgb(ink_color)
    rng = random.Random()

    page_type = (page_type or "a4").lower()
    ascent, _descent = font.getmetrics()

    # --- Build the page (canvas) and decide where each text baseline sits. ---
    ruled_baselines = None
    if background_bytes:
        # Custom uploaded paper/background.
        try:
            bg = Image.open(io.BytesIO(background_bytes)).convert("RGB")
            if bg.width > MAX_BG_WIDTH:
                ratio = MAX_BG_WIDTH / bg.width
                bg = bg.resize((MAX_BG_WIDTH, int(bg.height * ratio)))
            canvas = bg
        except Exception:
            canvas = Image.new("RGB", (A4_W, A4_H), "white")
    elif page_type == "ruled":
        margin_x = int(A4_W * 0.12)
        top_margin = int(A4_H * 0.06)
        canvas, ruled_baselines = _make_ruled_canvas(line_height, margin_x, top_margin)
    else:
        canvas = Image.new("RGB", (A4_W, A4_H), "white")

    canvas = canvas.convert("RGB")
    margin_x = int(canvas.width * 0.08)
    margin_y = int(canvas.height * 0.06)
    max_text_width = canvas.width - margin_x - int(canvas.width * 0.06)

    lines = _wrap_lines(text, font, max_text_width)

    # --- Render the text. ---
    if ruled_baselines is not None:
        for i, line in enumerate(lines):
            if i >= len(ruled_baselines):
                break  # one page
            if line:
                _draw_natural_line(canvas, line, font, margin_x + rng.randint(0, 6),
                                   ruled_baselines[i], ink_rgb, jitter, stroke_width, rng)
    else:
        baseline_y = margin_y + ascent
        for line in lines:
            if baseline_y > canvas.height - margin_y:
                break  # single page for now; overflow is dropped
            if line:
                _draw_natural_line(canvas, line, font, margin_x + rng.randint(0, 6),
                                   baseline_y, ink_rgb, jitter, stroke_width, rng)
            baseline_y += line_height

    return canvas


def to_bytes(image: Image.Image, fmt: str = "png") -> io.BytesIO:
    buf = io.BytesIO()
    if fmt == "pdf":
        image.save(buf, format="PDF", resolution=150.0)
    else:
        image.save(buf, format="PNG")
    buf.seek(0)
    return buf
