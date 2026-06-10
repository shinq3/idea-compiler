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
from pptx.enum.text import PP_ALIGN
import os

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "../documents/frontier_template1.pptx")

def set_shape_text(shape, text):
    """シェイプのテキストを置換（フォーマット維持）"""
    if not shape.has_text_frame:
        return
    tf = shape.text_frame
    for para in tf.paragraphs:
        for run in para.runs:
            if run.text:
                run.text = text
                return
    # runがない場合
    if tf.paragraphs:
        tf.paragraphs[0].text = text

def replace_placeholder(slide, placeholder, value):
    """スライド内の{placeholder}テキストを置換（runが分割されていても対応）"""
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            # paragraph全体のテキストで一致確認
            if placeholder not in para.text:
                continue
            # run[0]に全テキストをまとめ、残りのrunを空にする
            if not para.runs:
                continue
            full_text = para.text.replace(placeholder, value)
            para.runs[0].text = full_text
            for run in para.runs[1:]:
                run.text = ""

def duplicate_slide(prs, slide_index):
    """スライドを複製してプレゼンに追加"""
    template = prs.slides[slide_index]
    blank_layout = template.slide_layout

    # XMLをコピー
    from pptx.oxml.ns import qn
    from lxml import etree
    import copy

    slide = prs.slides.add_slide(blank_layout)

    # テンプレートのshapeをコピー
    sp_tree = slide.shapes._spTree
    # 既存のshapeを削除（レイアウトから来るものは残す）
    for el in list(sp_tree):
        if el.tag.endswith('}sp') or el.tag.endswith('}pic') or el.tag.endswith('}graphicFrame') or el.tag.endswith('}grpSp') or el.tag.endswith('}cxnSp'):
            sp_tree.remove(el)

    # テンプレートのshapeをコピー
    template_sp_tree = template.shapes._spTree
    for el in template_sp_tree:
        if el.tag.endswith('}sp') or el.tag.endswith('}pic') or el.tag.endswith('}graphicFrame') or el.tag.endswith('}grpSp') or el.tag.endswith('}cxnSp'):
            sp_tree.append(copy.deepcopy(el))

    return slide

def add_content_to_slide(slide, content_type, data):
    """内容スライドにコンテンツを追加"""
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN

    # コンテンツエリア: x=0.75", y=1.9", width=11.83", height=4.8"
    CONTENT_X = Inches(0.75)
    CONTENT_Y = Inches(1.9)
    CONTENT_W = Inches(11.83)
    CONTENT_H = Inches(4.8)

    TEXT_COLOR = RGBColor(0x2d, 0x37, 0x48)
    ACCENT_COLOR = RGBColor(0xE8, 0x3A, 0x3A)  # テンプレートの赤

    if content_type == "bullets":
        bullets = data.get("bullets", [])
        txBox = slide.shapes.add_textbox(CONTENT_X, CONTENT_Y, CONTENT_W, CONTENT_H)
        tf = txBox.text_frame
        tf.word_wrap = True
        for i, item in enumerate(bullets):
            if i == 0:
                para = tf.paragraphs[0]
            else:
                para = tf.add_paragraph()
            para.space_before = Pt(6)
            para.space_after = Pt(2)
            run = para.add_run()
            run.text = f"• {item}"
            run.font.size = Pt(16)
            run.font.color.rgb = TEXT_COLOR

    elif content_type == "two_column":
        columns = data.get("columns", [])
        col_w = Inches(5.5)
        gap = Inches(0.83)
        for ci, col in enumerate(columns[:2]):
            cx = CONTENT_X + (col_w + gap) * ci
            # 列タイトル
            heading_box = slide.shapes.add_textbox(cx, CONTENT_Y, col_w, Inches(0.5))
            htf = heading_box.text_frame
            hpara = htf.paragraphs[0]
            hrun = hpara.add_run()
            hrun.text = col.get("heading", "")
            hrun.font.size = Pt(14)
            hrun.font.bold = True
            hrun.font.color.rgb = ACCENT_COLOR
            # 区切り線（細い矩形）
            line_shape = slide.shapes.add_shape(
                1,  # MSO_SHAPE_TYPE.RECTANGLE
                cx, CONTENT_Y + Inches(0.55), col_w, Inches(0.03)
            )
            line_shape.fill.solid()
            line_shape.fill.fore_color.rgb = ACCENT_COLOR
            line_shape.line.fill.background()
            # 箇条書き
            items_box = slide.shapes.add_textbox(cx, CONTENT_Y + Inches(0.65), col_w, Inches(4.0))
            itf = items_box.text_frame
            itf.word_wrap = True
            for pi, point in enumerate(col.get("points", [])):
                if pi == 0:
                    para = itf.paragraphs[0]
                else:
                    para = itf.add_paragraph()
                para.space_before = Pt(5)
                run = para.add_run()
                run.text = f"• {point}"
                run.font.size = Pt(14)
                run.font.color.rgb = TEXT_COLOR

    elif content_type == "table":
        rows_data = data.get("rows", [])
        if not rows_data:
            return
        from pptx.util import Inches
        cols = len(rows_data[0])
        col_w = CONTENT_W // cols
        table = slide.shapes.add_table(
            len(rows_data), cols,
            CONTENT_X, CONTENT_Y,
            CONTENT_W, Inches(min(len(rows_data) * 0.45, 4.5))
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
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = ACCENT_COLOR
                else:
                    run.font.color.rgb = TEXT_COLOR

def update_slide_number(slide, number):
    """スライド番号を更新"""
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
    # {Client} / {Project Name} は同一runに入っているため結合して置換
    client_str = f"{cover.get('client', '')} / {cover.get('project_name', '')}"
    replace_placeholder(cover_slide, "{Client} / {Project Name}", client_str)
    replace_placeholder(cover_slide, "{Client}", cover.get("client", ""))
    replace_placeholder(cover_slide, "{Project Name}", cover.get("project_name", ""))
    replace_placeholder(cover_slide, "{date}", cover.get("date", ""))

    # === スライド2以降: 内容ページを複製 ===
    for i, slide_data in enumerate(slides_data):
        new_slide = duplicate_slide(prs, 1)  # スライド2をテンプレートとして複製

        replace_placeholder(new_slide, "{Key message}", slide_data.get("key_message", ""))
        replace_placeholder(new_slide, "{Page Title}", slide_data.get("page_title", ""))

        # コンテンツを追加
        content_type = slide_data.get("content_type", "bullets")
        add_content_to_slide(new_slide, content_type, slide_data)

        # スライド番号
        update_slide_number(new_slide, i + 2)

    # テンプレートのスライド2（空のマスター）を削除
    from pptx.oxml.ns import qn
    slide2_rId = prs.slides._sldIdLst[1].get('r:id') or prs.slides._sldIdLst[1].attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
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
