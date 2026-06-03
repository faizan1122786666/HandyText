from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml.shared import OxmlElement, qn
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.units import inch
from bs4 import BeautifulSoup
import os
import uuid
import re
from xml.sax.saxutils import escape


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
            paragraph.paragraph_format.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
    
    doc.save(file_path)
    return file_path


def _html_to_reportlab_markup(html_content: str) -> list[str]:
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
        paragraphs.append(content or "&nbsp;")
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
    
    story = []

    if html_content:
        paragraphs = _html_to_reportlab_markup(html_content)
    else:
        paragraphs = [escape(line) if line.strip() else "" for line in (plain_text or "").splitlines()]

    for para in paragraphs:
        if para.strip():
            story.append(Paragraph(para, normal_style))
        else:
            story.append(Spacer(1, 6))
    
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
