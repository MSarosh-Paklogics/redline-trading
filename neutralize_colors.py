from docx import Document
from docx.shared import RGBColor
from docx.oxml.ns import qn
from pathlib import Path
p=Path('D:/Client_Projects/redline/AI_Automation_Multi_Agent_SOW.docx')
d=Document(p)
# neutralize heading and direct blue text
for style_name in ['Heading 1','Heading 2','Heading 3']:
    st=d.styles[style_name]
    st.font.color.rgb=RGBColor(0,0,0)
for para in d.paragraphs:
    for run in para.runs:
        if run.font.color and run.font.color.rgb and str(run.font.color.rgb) in ('1F4E79','1f4e79'):
            run.font.color.rgb=RGBColor(0,0,0)
# neutral charcoal table headers
for table in d.tables:
    for cell in table.rows[0].cells:
        tcPr=cell._tc.get_or_add_tcPr()
        for shd in tcPr.findall(qn('w:shd')):
            shd.set(qn('w:fill'),'404040')
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.color.rgb=RGBColor(255,255,255)
# ensure styles don't retain blue in XML
for st_name in ['Title','Heading 1','Heading 2','Heading 3']:
    d.styles[st_name].font.color.rgb=RGBColor(0,0,0)
d.save(p)
print(p)
