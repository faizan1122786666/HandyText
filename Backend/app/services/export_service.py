from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml.shared import OxmlElement, qn
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from bs4 import BeautifulSoup
import arabic_reshaper
from bidi.algorithm import get_display
import os
import uuid
import re
from xml.sax.saxutils import escape


# --- Arabic / Urdu (RTL) script support ---------------------------------------
# reportlab's built-in fonts (Times-Roman, etc.) contain no Arabic glyphs, so
# Urdu text renders as empty boxes. We bundle a Unicode font with Arabic glyphs
# and reshape + reorder the text ourselves because reportlab has no shaping or
# bidirectional layout engine.
_FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
ARABIC_FONT_NAME = "NotoNaskhArabic"
_arabic_font_registered = False

# Arabic, Arabic Supplement, Arabic Extended-A, and the presentation-form blocks.
_ARABIC_RANGES = (
    (0x0600, 0x06FF),
    (0x0750, 0x077F),
    (0x08A0, 0x08FF),
    (0xFB50, 0xFDFF),
    (0xFE70, 0xFEFF),
)


def _register_arabic_font() -> bool:
    """Register the bundled Arabic-capable font with reportlab (once)."""
    global _arabic_font_registered
    if _arabic_font_registered:
        return True
    font_path = os.path.join(_FONT_DIR, "NotoNaskhArabic-Regular.ttf")
    if os.path.exists(font_path):
        try:
            pdfmetrics.registerFont(TTFont(ARABIC_FONT_NAME, font_path))
            _arabic_font_registered = True
        except Exception:
            _arabic_font_registered = False
    return _arabic_font_registered


def _has_arabic(text: str) -> bool:
    for ch in text or "":
        cp = ord(ch)
        for lo, hi in _ARABIC_RANGES:
            if lo <= cp <= hi:
                return True
    return False


def _shape_rtl(text: str) -> str:
    """Connect Arabic/Urdu letters into their contextual forms and apply
    bidirectional reordering so the (shaping-less) PDF renderer lays them out
    correctly."""
    return get_display(arabic_reshaper.reshape(text))


def _wrap_rtl_lines(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    """Greedily word-wrap RTL text in *logical* order so multi-line paragraphs
    keep the correct line order. reportlab can't wrap pre-reordered bidi text,
    so we break into fitting lines here and shape each line separately."""
    words = (text or "").split()
    if not words:
        return [text or ""]
    lines: list[str] = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if not current or stringWidth(_shape_rtl(trial), font_name, font_size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _safe_export_name(filename: str) -> str:
    base = os.path.basename(filename or "document")
    base = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", base).strip(" .")
    return base or "document"


def generate_txt(text: str, filename: str) -> str:
    """Generate a .txt file and return its path."""
    file_path = f"exports/{uuid.uuid4()}_{_safe_export_name(filename)}.txt"
    os.makedirs("exports", exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text)
    return file_path


def _css_value(style: str, name: str) -> str:
    match = re.search(rf"{re.escape(name)}\s*:\s*([^;]+)", style or "", flags=re.I)
    return match.group(1).strip().lower() if match else ""


def _is_highlighted(node) -> bool:
    if getattr(node, "name", None) == "mark":
        return True
    style = node.get("style", "") if hasattr(node, "get") else ""
    return bool(_css_value(style, "background-color") or _css_value(style, "background"))


def _is_bold(node) -> bool:
    if getattr(node, "name", None) in ("b", "strong"):
        return True
    style = node.get("style", "") if hasattr(node, "get") else ""
    weight = _css_value(style, "font-weight")
    return weight in ("bold", "bolder", "600", "700", "800", "900")


def _is_italic(node) -> bool:
    if getattr(node, "name", None) in ("i", "em"):
        return True
    return _css_value(node.get("style", "") if hasattr(node, "get") else "", "font-style") == "italic"


def _is_underline(node) -> bool:
    if getattr(node, "name", None) == "u":
        return True
    decoration = _css_value(node.get("style", "") if hasattr(node, "get") else "", "text-decoration")
    return "underline" in decoration


def _is_strike(node) -> bool:
    if getattr(node, "name", None) in ("s", "strike", "del"):
        return True
    decoration = _css_value(node.get("style", "") if hasattr(node, "get") else "", "text-decoration")
    return "line-through" in decoration


def _block_elements(soup: BeautifulSoup):
    blocks = soup.find_all(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"], recursive=True)
    if blocks:
        return blocks
    return [soup]


def _set_paragraph_rtl(paragraph):
    """Mark a Word paragraph as right-to-left and justified (fill width). Word
    performs its own Arabic shaping, so this is all that's needed for correct
    Urdu."""
    pPr = paragraph._p.get_or_add_pPr()
    bidi = OxmlElement('w:bidi')
    bidi.set(qn('w:val'), '1')
    pPr.append(bidi)
    paragraph.paragraph_format.alignment = WD_PARAGRAPH_ALIGNMENT.JUSTIFY
    for run in paragraph.runs:
        rPr = run._r.get_or_add_rPr()
        rtl = OxmlElement('w:rtl')
        rtl.set(qn('w:val'), '1')
        rPr.append(rtl)


def parse_html_to_docx(html_content: str, doc: Document):
    """Parse HTML and add to Word document with formatting."""
    if not html_content:
        return
    
    soup = BeautifulSoup(html_content, 'html.parser')

    def add_runs(paragraph, node, state):
        if getattr(node, "name", None) is None:
            text = str(node).replace("\xa0", " ")
            if text:
                run = paragraph.add_run(text)
                run.bold = state["bold"]
                run.italic = state["italic"]
                run.underline = state["underline"]
                run.font.strike = state["strike"]
                if state["highlight"]:
                    run.font.highlight_color = WD_COLOR_INDEX.YELLOW
            return

        if node.name == "br":
            paragraph.add_run().add_break()
            return

        next_state = {
            "bold": state["bold"] or _is_bold(node),
            "italic": state["italic"] or _is_italic(node),
            "underline": state["underline"] or _is_underline(node),
            "strike": state["strike"] or _is_strike(node),
            "highlight": state["highlight"] or _is_highlighted(node),
        }

        for child in node.children:
            add_runs(paragraph, child, next_state)

    for element in _block_elements(soup):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.paragraph_format.line_spacing = 1.15
        paragraph.paragraph_format.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT

        if element.name in ["h1", "h2", "h3"] or element.get("data-auto-heading") == "true":
            paragraph.paragraph_format.space_after = Pt(8)
            base_state = {"bold": True, "italic": False, "underline": False, "strike": False, "highlight": False}
        else:
            base_state = {"bold": False, "italic": False, "underline": False, "strike": False, "highlight": False}

        add_runs(paragraph, element, base_state)

        if _has_arabic(element.get_text()):
            _set_paragraph_rtl(paragraph)

def generate_docx(html_content: str, plain_text: str, filename: str) -> str:
    """Generate a .docx file and return its path."""
    file_path = f"exports/{uuid.uuid4()}_{_safe_export_name(filename)}.docx"
    os.makedirs("exports", exist_ok=True)
    doc = Document()
    
    # Set page size to A4
    section = doc.sections[0]
    section.page_height = Pt(841.89)  # 11.69 inches
    section.page_width = Pt(595.28)   # 8.27 inches
    section.left_margin = Pt(72)      # 1 inch
    section.right_margin = Pt(72)     # 1 inch
    section.top_margin = Pt(72)       # 1 inch
    section.bottom_margin = Pt(72)    # 1 inch
    
    # Set page border
    def set_page_border(section, border_color='000000', border_size=4):
        p = section._sectPr
        pgBorders = OxmlElement('w:pgBorders')
        pgBorders.set(qn('w:offsetFrom'), 'page')
        
        for border in ['top', 'left', 'bottom', 'right']:
            bd = OxmlElement(f'w:{border}')
            bd.set(qn('w:val'), 'single')
            bd.set(qn('w:sz'), str(border_size))
            bd.set(qn('w:space'), '24')
            bd.set(qn('w:color'), border_color)
            pgBorders.append(bd)
        
        p.append(pgBorders)
    
    set_page_border(section)
    
    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.size = Pt(12)
    font.name = 'Times New Roman'
    
    if html_content:
        parse_html_to_docx(html_content, doc)
    else:
        for line in (plain_text or "").splitlines():
            paragraph = doc.add_paragraph()
            paragraph.add_run(line)
            paragraph.paragraph_format.space_after = Pt(4)
            paragraph.paragraph_format.line_spacing = 1.15
            if _has_arabic(line):
                _set_paragraph_rtl(paragraph)
            else:
                paragraph.paragraph_format.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
    
    doc.save(file_path)
    return file_path


def _html_to_reportlab_markup(html_content: str) -> list[tuple[str, str]]:
    """Return a list of (reportlab_markup, plain_text) tuples, one per block.
    The plain text is used to decide whether a paragraph needs RTL handling."""
    soup = BeautifulSoup(html_content, "html.parser")

    def node_to_markup(node, state) -> str:
        if getattr(node, "name", None) is None:
            return escape(str(node).replace("\xa0", " "))
        if node.name == "br":
            return "<br/>"

        next_state = {
            "bold": state["bold"] or _is_bold(node),
            "italic": state["italic"] or _is_italic(node),
            "underline": state["underline"] or _is_underline(node),
            "strike": state["strike"] or _is_strike(node),
            "highlight": state["highlight"] or _is_highlighted(node),
        }

        inner = "".join(node_to_markup(child, next_state) for child in node.children)
        if not inner:
            return ""
        if not state["highlight"] and next_state["highlight"]:
            inner = f'<font backColor="yellow">{inner}</font>'
        if not state["strike"] and next_state["strike"]:
            inner = f"<strike>{inner}</strike>"
        if not state["underline"] and next_state["underline"]:
            inner = f"<u>{inner}</u>"
        if not state["italic"] and next_state["italic"]:
            inner = f"<i>{inner}</i>"
        if not state["bold"] and next_state["bold"]:
            inner = f"<b>{inner}</b>"
        return inner

    paragraphs = []
    for element in _block_elements(soup):
        base_state = {
            "bold": element.name in ["h1", "h2", "h3"] or element.get("data-auto-heading") == "true",
            "italic": False,
            "underline": False,
            "strike": False,
            "highlight": False,
        }
        content = "".join(node_to_markup(child, base_state) for child in element.children).strip()
        if base_state["bold"] and content:
            content = f"<b>{content}</b>"
        paragraphs.append((content or "&nbsp;", element.get_text()))
    return paragraphs

def generate_pdf(html_content: str, plain_text: str, filename: str) -> str:
    """Generate a .pdf file and return its path."""
    file_path = f"exports/{uuid.uuid4()}_{_safe_export_name(filename)}.pdf"
    os.makedirs("exports", exist_ok=True)
    
    doc = SimpleDocTemplate(
        file_path, 
        pagesize=A4, 
        leftMargin=1*inch, 
        rightMargin=1*inch,
        topMargin=1*inch, 
        bottomMargin=1*inch
    )
    
    styles = getSampleStyleSheet()

    arabic_ok = _register_arabic_font()

    # Create a style that ensures text fills the full width
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=12,
        leading=15,
        alignment=TA_LEFT,
        leftIndent=0,
        rightIndent=0,
        firstLineIndent=0,
        spaceAfter=4
    )

    # Smart fill-width for Urdu / Arabic lines: lines long enough to wrap are
    # justified (fill width); short single lines stay at the right margin
    # (natural Urdu), avoiding the gappy look of stretching a short line.
    arabic_font = ARABIC_FONT_NAME if arabic_ok else 'Times-Roman'
    # Last/short physical line of a paragraph: sit at the right margin.
    arabic_right = ParagraphStyle(
        'ArabicRight', parent=normal_style, fontName=arabic_font, alignment=TA_RIGHT,
    )
    # A "full" physical line that should stretch edge-to-edge. justifyLastLine=1
    # forces the (single-line) flowable to justify; spaceAfter=0 keeps wrapped
    # lines of one paragraph tight together.
    arabic_justify = ParagraphStyle(
        'ArabicJustify', parent=normal_style, fontName=arabic_font,
        alignment=TA_JUSTIFY, justifyLastLine=1, spaceAfter=0,
    )
    # Text width available inside the 1-inch left/right margins, minus the
    # reportlab Frame's default 6pt padding on each side (plus a small safety
    # margin) so our pre-wrapped lines are never re-wrapped by reportlab.
    avail_width = A4[0] - 2 * inch - 12 - 2

    story = []

    if html_content:
        paragraphs = _html_to_reportlab_markup(html_content)
    else:
        paragraphs = [
            (escape(line), line) if line.strip() else ("", "")
            for line in (plain_text or "").splitlines()
        ]

    for markup, plain in paragraphs:
        if not (markup and markup.strip()):
            story.append(Spacer(1, 6))
        elif arabic_ok and _has_arabic(plain):
            # Wrap in logical order, then shape each physical line. Full lines
            # fill the width; the final (short) line sits at the right margin.
            # Inline markup is dropped for RTL lines so shaping gets a clean run.
            lines = _wrap_rtl_lines(plain, arabic_font, normal_style.fontSize, avail_width)
            for i, line in enumerate(lines):
                is_last = i == len(lines) - 1
                story.append(Paragraph(escape(_shape_rtl(line)),
                                       arabic_right if is_last else arabic_justify))
        else:
            story.append(Paragraph(markup, normal_style))
    
    # Custom page template with border
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColorRGB(0, 0, 0)
        canvas.setLineWidth(2)
        border_margin = 0.5 * inch
        page_width, page_height = A4
        canvas.rect(
            border_margin, 
            border_margin, 
            page_width - 2 * border_margin, 
            page_height - 2 * border_margin, 
            stroke=1, 
            fill=0
        )
        canvas.restoreState()
    
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    
    return file_path
