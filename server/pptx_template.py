#!/usr/bin/env python3
"""
PPTX Template Generator
stdin: JSON with cover + slides data
stdout: base64-encoded PPTX
"""
import sys
import json
import copy
import base64
import io
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
import os

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "../documents/frontier_template1.pptx")

# カラーパレット（旧pptxgenjsスタイル）
C_PRIMARY   = RGBColor(0x66, 0x7e, 0xea)  # 青紫
C_SECONDARY = RGBColor(0x76, 0x4b, 0xa2)  # 紫
C_SUCCESS   = RGBColor(0x48, 0xbb, 0x78)  # 緑
C_WARNING   = RGBColor(0xed, 0x89, 0x36)  # オレンジ
C_ACCENT    = RGBColor(0xe8, 0x3a, 0x3a)  # テンプレートの赤
C_TEXT      = RGBColor(0x2d, 0x37, 0x48)  # ダーク
C_MUTED     = RGBColor(0x71, 0x80, 0x96)  # グレー
C_WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
C_CARD_BG   = RGBColor(0xF7, 0xFA, 0xFC)  # カード背景

def replace_placeholder(slide, placeholder, value):
    """スライド内の{placeholder}テキストを置換（runが分割されていても対応）"""
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            if placeholder not in para.text:
                continue
            if not para.runs:
                continue
            full_text = para.text.replace(placeholder, value)
            para.runs[0].text = full_text
            for run in para.runs[1:]:
                run.text = ""

def duplicate_slide(prs, slide_index):
    """スライドを複製（画像リレーションシップも正しくコピー）"""
    template = prs.slides[slide_index]
    slide = prs.slides.add_slide(template.slide_layout)

    sp_tree = slide.shapes._spTree
    # 既存のshapeを削除
    for el in list(sp_tree):
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
        if tag in ('sp', 'pic', 'graphicFrame', 'grpSp', 'cxnSp'):
            sp_tree.remove(el)

    # テンプレートのshapeをコピー（画像のrIdも修正）
    for shape in template.shapes:
        el = copy.deepcopy(shape.element)

        # PICTURE型: 画像パートのリレーションシップを新スライドにコピー
        if shape.shape_type == 13:  # MSO_SHAPE_TYPE.PICTURE
            try:
                blip = el.find('.//{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}blip')
                if blip is None:
                    blip = el.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
                if blip is None:
                    ns = 'http://schemas.openxmlformats.org/drawingml/2006/main'
                    for b in el.iter('{%s}blip' % ns):
                        blip = b
                        break
                if blip is not None:
                    r_embed_key = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'
                    old_rId = blip.get(r_embed_key)
                    if old_rId:
                        img_part = template.part.related_part(old_rId)
                        new_rId = slide.part.relate_to(img_part, RT.IMAGE)
                        blip.set(r_embed_key, new_rId)
            except Exception as e:
                pass  # 画像コピー失敗は無視して続行

        sp_tree.append(el)

    return slide

# ===== コンテンツ描画ヘルパー =====

def add_card(slide, x, y, w, h, fill_color=None, shadow=True):
    """角丸カードを追加"""
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    shape = slide.shapes.add_shape(
        5,  # ROUNDED_RECTANGLE
        Inches(x), Inches(y), Inches(w), Inches(h)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color or C_CARD_BG
    shape.line.color.rgb = RGBColor(0xE2, 0xE8, 0xF0)
    shape.line.width = Pt(0.5)
    return shape

def add_accent_bar(slide, x, y, h, color=None):
    """左側アクセントバーを追加"""
    bar = slide.shapes.add_shape(
        1,  # RECTANGLE
        Inches(x), Inches(y), Inches(0.06), Inches(h)
    )
    bar.fill.solid()
    bar.fill.fore_color.rgb = color or C_PRIMARY
    bar.line.fill.background()
    return bar

def add_text_box(slide, text, x, y, w, h, font_size=14, bold=False,
                 color=None, align='left', valign='top', wrap=True):
    txBox = slide.shapes.add_textbox(
        Inches(x), Inches(y), Inches(w), Inches(h)
    )
    tf = txBox.text_frame
    tf.word_wrap = wrap
    para = tf.paragraphs[0]
    run = para.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.color.rgb = color or C_TEXT
    return txBox

def add_bullets_styled(slide, items, x, y, w, h, color=None, bullet_color=None):
    """スタイル付き箇条書き（旧pptxgenjsスタイル）"""
    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.space_before = Pt(5)
        para.space_after = Pt(3)
        # bullet dot
        bullet_run = para.add_run()
        bullet_run.text = "● "
        bullet_run.font.size = Pt(9)
        bullet_run.font.color.rgb = bullet_color or C_PRIMARY
        # text
        text_run = para.add_run()
        text_run.text = item
        text_run.font.size = Pt(14)
        text_run.font.color.rgb = color or C_TEXT

# ===== レイアウト別コンテンツ追加 =====

def add_content_to_slide(slide, content_type, data):
    CX, CY, CW, CH = 0.75, 1.9, 11.83, 4.8

    if content_type == "bullets":
        bullets = data.get("bullets", [])
        # カード背景
        add_card(slide, CX, CY, CW, CH)
        add_accent_bar(slide, CX, CY, CH)
        add_bullets_styled(slide, bullets,
                           CX + 0.2, CY + 0.2, CW - 0.4, CH - 0.4,
                           bullet_color=C_PRIMARY)

    elif content_type == "two_column":
        columns = data.get("columns", [])
        col_w = 5.6
        gap = 0.43
        colors = [C_PRIMARY, C_SECONDARY]
        for ci, col in enumerate(columns[:2]):
            cx = CX + (col_w + gap) * ci
            # カード
            add_card(slide, cx, CY, col_w, CH)
            add_accent_bar(slide, cx, CY, CH, color=colors[ci])
            # 見出し
            heading_box = slide.shapes.add_textbox(
                Inches(cx + 0.15), Inches(CY + 0.15),
                Inches(col_w - 0.2), Inches(0.45)
            )
            htf = heading_box.text_frame
            hpara = htf.paragraphs[0]
            hrun = hpara.add_run()
            hrun.text = col.get("heading", "")
            hrun.font.size = Pt(14)
            hrun.font.bold = True
            hrun.font.color.rgb = colors[ci]
            # セパレーター
            sep = slide.shapes.add_shape(
                1, Inches(cx + 0.15), Inches(CY + 0.65),
                Inches(col_w - 0.3), Inches(0.02)
            )
            sep.fill.solid()
            sep.fill.fore_color.rgb = colors[ci]
            sep.line.fill.background()
            # 箇条書き
            add_bullets_styled(slide, col.get("points", []),
                               cx + 0.15, CY + 0.75, col_w - 0.3, CH - 0.9,
                               bullet_color=colors[ci])

    elif content_type == "table":
        rows_data = data.get("rows", [])
        if not rows_data:
            return
        cols = len(rows_data[0])
        n_rows = len(rows_data)
        tbl_h = min(n_rows * 0.45, CH)
        table = slide.shapes.add_table(
            n_rows, cols,
            Inches(CX), Inches(CY),
            Inches(CW), Inches(tbl_h)
        ).table
        for ri, row in enumerate(rows_data):
            for ci, cell_text in enumerate(row):
                cell = table.cell(ri, ci)
                cell.text = str(cell_text)
                tf = cell.text_frame
                para = tf.paragraphs[0]
                run = para.runs[0] if para.runs else para.add_run()
                run.font.size = Pt(11)
                run.font.bold = (ri == 0)
                if ri == 0:
                    run.font.color.rgb = C_WHITE
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = C_PRIMARY
                elif ri % 2 == 0:
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = RGBColor(0xF7, 0xFA, 0xFC)
                    run.font.color.rgb = C_TEXT
                else:
                    run.font.color.rgb = C_TEXT

def update_slide_number(slide, number):
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            for run in para.runs:
                if run.text.strip().isdigit():
                    run.text = str(number)
                    return

def generate(data):
    prs = Presentation(TEMPLATE_PATH)
    cover = data.get("cover", {})
    slides_data = data.get("slides", [])

    # === スライド1: 表紙 ===
    cover_slide = prs.slides[0]
    replace_placeholder(cover_slide, "{Title}", cover.get("title", ""))
    replace_placeholder(cover_slide, "{Message}", cover.get("message", ""))
    client_str = f"{cover.get('client', '')} / {cover.get('project_name', '')}"
    replace_placeholder(cover_slide, "{Client} / {Project Name}", client_str)
    replace_placeholder(cover_slide, "{Client}", cover.get("client", ""))
    replace_placeholder(cover_slide, "{Project Name}", cover.get("project_name", ""))
    replace_placeholder(cover_slide, "{date}", cover.get("date", ""))

    # === スライド2以降: 内容ページを複製 ===
    for i, slide_data in enumerate(slides_data):
        new_slide = duplicate_slide(prs, 1)
        replace_placeholder(new_slide, "{Key message}", slide_data.get("key_message", ""))
        replace_placeholder(new_slide, "{Page Title}", slide_data.get("page_title", ""))
        content_type = slide_data.get("content_type", "bullets")
        add_content_to_slide(new_slide, content_type, slide_data)
        update_slide_number(new_slide, i + 2)

    # テンプレートのスライド2（空のマスター）を削除
    xml_slides = prs.slides._sldIdLst
    xml_slides.remove(xml_slides[1])

    output = io.BytesIO()
    prs.save(output)
    return base64.b64encode(output.getvalue()).decode("utf-8")

if __name__ == "__main__":
    raw = sys.stdin.read()
    data = json.loads(raw)
    result = generate(data)
    print(result)
