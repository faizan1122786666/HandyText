from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.oxml.shared import OxmlElement, qn
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.units import inch
from bs4 import BeautifulSoup
import os
import uuid
import re
from xml.sax.saxutils import escape

def generate_txt(text: str, filename: str) -> str:
    """Generate a .txt file and return its path."""
    file_path = f"exports/{uuid.uuid4()}_{filename}.txt"
    os.makedirs("exports", exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text)
    return file_path

def parse_html_to_docx(html_content: str, doc: Document):
    """Parse HTML and add to Word document with formatting."""
    if not html_content:
        return
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Process each child element
    for element in soup.children:
        if element.name in ['p', 'div'] or (element.string and element.string.strip()):
            # Create paragraph
            paragraph = doc.add_paragraph()
            
            # Set paragraph style
            paragraph.paragraph_format.space_after = Pt(6)
            paragraph.paragraph_format.line_spacing = 1.5
            paragraph.paragraph_format.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
            
            # Process inline elements (text, <b>, <i>, <u>, <span>)
            def process_node(node, run=None):
                if node.name is None:
                    # Text node
                    text = str(node)
                    if text and text.strip() or len(text) > 0:
                        if run is None:
                            run = paragraph.add_run(text)
                        else:
                            run.add_text(text)
                elif node.name == 'br':
                    # Line break
                    if run is None:
                        run = paragraph.add_run()
                    run.add_break()
                elif node.name in ['b', 'strong']:
                    # Bold
                    if run is None:
                        run = paragraph.add_run()
                    run.bold = True
                    for child in node.children:
                        process_node(child, run)
                    run.bold = False
                elif node.name in ['i', 'em']:
                    # Italic
                    if run is None:
                        run = paragraph.add_run()
                    run.italic = True
                    for child in node.children:
                        process_node(child, run)
                    run.italic = False
                elif node.name in ['u']:
                    # Underline
                    if run is None:
                        run = paragraph.add_run()
                    run.underline = True
                    for child in node.children:
                        process_node(child, run)
                    run.underline = False
                elif node.name == 'mark' or (node.name == 'span' and 'background-color' in node.get('style', '')):
                    # Highlight
                    if run is None:
                        run = paragraph.add_run()
                    # Yellow highlight
                    run.font.highlight_color = 7  # WD_COLOR_INDEX.YELLOW
                    for child in node.children:
                        process_node(child, run)
                    run.font.highlight_color = None
                else:
                    # Recursively process other elements
                    for child in node.children:
                        process_node(child, run)
            
            process_node(element)

def generate_docx(html_content: str, plain_text: str, filename: str) -> str:
    """Generate a .docx file and return its path."""
    file_path = f"exports/{uuid.uuid4()}_{filename}.docx"
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
    
    # Use plain text directly for reliability
    # Split into paragraphs based on double newlines
    paragraphs = plain_text.split('\n\n')
    for para in paragraphs:
        if para.strip():
            paragraph = doc.add_paragraph()
            # Split into lines within the paragraph and join with spaces
            # This allows the text to wrap properly and fill the full page width
            lines = para.split('\n')
            cleaned_para = ' '.join([line.strip() for line in lines if line.strip()])
            paragraph.add_run(cleaned_para)
            paragraph.paragraph_format.space_after = Pt(6)
            paragraph.paragraph_format.line_spacing = 1.5
            paragraph.paragraph_format.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
        else:
            # Add empty paragraph for spacing
            doc.add_paragraph()
    
    doc.save(file_path)
    return file_path

def generate_pdf(html_content: str, plain_text: str, filename: str) -> str:
    """Generate a .pdf file and return its path."""
    file_path = f"exports/{uuid.uuid4()}_{filename}.pdf"
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
        leading=18,  # 1.5 line spacing
        alignment=TA_LEFT,
        leftIndent=0,
        rightIndent=0,
        firstLineIndent=0,
        spaceAfter=6
    )
    
    story = []
    
    # Use plain text directly - it's simpler and more reliable
    # Split into paragraphs based on double newlines
    paragraphs = plain_text.split('\n\n')
    
    for para in paragraphs:
        if para.strip():
            # Split into lines within the paragraph and join with spaces
            # This allows the text to wrap properly and fill the full page width
            lines = para.split('\n')
            cleaned_para = ' '.join([line.strip() for line in lines if line.strip()])
            story.append(Paragraph(escape(cleaned_para), normal_style))
        else:
            # Add spacing for empty paragraphs
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
