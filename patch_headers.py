from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
p='D:/Client_Projects/redline/AI_Automation_Multi_Agent_SOW.docx'
d=Document(p)
for t in d.tables:
    trPr=t.rows[0]._tr.get_or_add_trPr(); el=OxmlElement('w:tblHeader'); el.set(qn('w:val'),'true'); trPr.append(el)
d.save(p)
print('patched')
