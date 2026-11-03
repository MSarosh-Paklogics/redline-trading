from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION
from pathlib import Path

out=Path('Redline_Trading_Platform_Project_Status_and_Implementation_Proposal.docx')
doc=Document()
sec=doc.sections[0]; sec.top_margin=Inches(.65); sec.bottom_margin=Inches(.65); sec.left_margin=Inches(.8); sec.right_margin=Inches(.8)
styles=doc.styles
styles['Normal'].font.name='Aptos'; styles['Normal'].font.size=Pt(10); styles['Normal'].paragraph_format.space_after=Pt(6)
for s in ['Title','Subtitle','Heading 1','Heading 2']:
    styles[s].font.name='Aptos'
styles['Title'].font.size=Pt(25); styles['Title'].font.bold=True; styles['Title'].font.color.rgb=RGBColor(0,0,0)
styles['Subtitle'].font.size=Pt(12); styles['Subtitle'].font.color.rgb=RGBColor(90,90,90)
styles['Heading 1'].font.size=Pt(14); styles['Heading 1'].font.bold=True; styles['Heading 1'].font.color.rgb=RGBColor(0,0,0); styles['Heading 1'].paragraph_format.space_before=Pt(12); styles['Heading 1'].paragraph_format.space_after=Pt(4)
styles['Heading 2'].font.size=Pt(11); styles['Heading 2'].font.bold=True; styles['Heading 2'].font.color.rgb=RGBColor(0,0,0)

def shade(cell, fill):
    tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); tcPr.append(shd)
def borders(table, color='D9D9D9'):
    tblPr=table._tbl.tblPr; b=tblPr.first_child_found_in('w:tblBorders')
    if b is None: b=OxmlElement('w:tblBorders'); tblPr.append(b)
    for e in ('top','left','bottom','right','insideH','insideV'):
        tag='w:'+e; el=b.find(qn(tag))
        if el is None: el=OxmlElement(tag); b.append(el)
        el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'4'); el.set(qn('w:space'),'0'); el.set(qn('w:color'),color)
def set_cell(cell,text,bold=False,color='000000'):
    cell.text=''; p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(2); r=p.add_run(text); r.bold=bold; r.font.name='Aptos'; r.font.size=Pt(9); r.font.color.rgb=RGBColor.from_string(color); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER

doc.add_paragraph('Redline Trading Platform Project Status and Implementation Proposal','Title')
doc.add_paragraph('Prepared for Chief Digital Officer review','Subtitle')
p=doc.add_paragraph('Purpose'); p.style='Heading 1'
doc.add_paragraph('This executive report explains what has been built, what the client supplied, how the platform works, how the project can be completed independently, and which decisions are required for a production-ready release.')
p=doc.add_paragraph('Executive result'); p.style='Heading 1'
doc.add_paragraph('The Redline frontend demonstration is polished, the backend adapter is configurable, local startup documentation is in place, and the API integration path has been verified. The client backend returns real responses for health, market meter, OHLC, sector cards, Fibonacci levels, active waves, trade permission, Engine 25, Engine 29, journal, orders and executions. The new frontend centralizes API access and routes live SPY and ES charts. Integration remains incomplete because presentation fixtures are still present and the local dashboard snapshot is unavailable until the backend generates its strategy snapshot.')

p=doc.add_paragraph('Verification status'); p.style='Heading 1'
t=doc.add_table(rows=1, cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False; widths=[1.3,1.1,4.6]
for i,w in enumerate(widths):
    for c in t.columns[i].cells: c.width=Inches(w)
for i,h in enumerate(['Area','Status','Evidence']): set_cell(t.rows[0].cells[i],h,True,'FFFFFF'); shade(t.rows[0].cells[i],'1F4E79')
rows=[('API route checks','PASS','Health, market meter, equity/futures OHLC, sectors, Fibonacci, waves, trade permission, Engine 25, Engine 29, journal, orders and executions returned 200.'),('Dashboard snapshot','BLOCKED','Returned 503 SNAPSHOT_NOT_READY; strategy-snapshot-es.json is not ready.'),('Root server entrypoint','BLOCKED','server.js imports a missing route file.'),('Browser QA','BLOCKED','Playwright scripts need the workspace Playwright runtime.')]
for row in rows:
    cells=t.add_row().cells
    for i,v in enumerate(row): set_cell(cells[i],v)
    if len(t.rows)%2==0:
        for c in cells: shade(c,'F3F6F8')
borders(t)

doc.add_paragraph('Why demo values still appear','Heading 1')
doc.add_paragraph('The frontend began as a presentation demo, so only selected surfaces are connected. The chart uses live equity/futures OHLC and Overview uses the live score when the snapshot is available. Speedometers, signal fixtures, strategy cards and presentation account values remain fixtures until canonical backend fields are mapped. Third-party keys remain server-side; the browser calls backend APIs only.')

doc.add_paragraph('Current frontend to backend map','Heading 1')
t=doc.add_table(rows=1, cols=2); t.alignment=WD_TABLE_ALIGNMENT.CENTER
for i,h in enumerate(['Frontend surface','Current source']): set_cell(t.rows[0].cells[i],h,True,'FFFFFF'); shade(t.rows[0].cells[i],'1F4E79')
for a,b in [('Overview','Dashboard snapshot, market meter and sectors'),('Chart','Equity OHLC for stocks; futures OHLC for ES/MES'),('Waves','Active waves and Fibonacci'),('Strategies','Permission, reaction, sizing and official plan'),('Journal','Trade journal'),('Positions and orders','Broker endpoints'),('Alerts','Alert endpoint when core exposes it')]:
    c=t.add_row().cells; set_cell(c[0],a,True); set_cell(c[1],b)
    if len(t.rows)%2==0:
        for x in c: shade(x,'F3F6F8')
borders(t)

doc.add_paragraph('Client items required','Heading 1')
items=['Confirm the active Render service and which service runs services/core/server.js.','Provide the deployed route inventory or OpenAPI document.','Confirm the dashboard snapshot schema and generate strategy-snapshot-es.json.','Identify production, paper, experimental and disabled APIs.','Confirm Polygon/Massive freshness and entitlements.','Provide masked seven-account strategy mappings.','Confirm subscriber permissions, alerts and live-order policy.','Provide Render start commands, environment-variable names and logs without secrets.','Provide expected values for the ES snapshot, SPY chart, one strategy permission and one journal trade.']
for i,x in enumerate(items,1): doc.add_paragraph(f'{i}. {x}')

doc.add_paragraph('Recommended implementation sequence','Heading 1')
for h,txt in [('Phase 1 - Contract and parity','Freeze the field-level API contract and complete Market Meter, Sectors, Chart and Wave parity.'),('Phase 2 - Product surfaces','Connect Strategies, Journal, Accounts, Alerts and Replay.'),('Phase 3 - Independent production stack','Deploy our own core API, streamer and workers with persistent storage, observability and rollback.'),('Phase 4 - Controlled release','Validate paper trading before designing any live broker release.')]:
    doc.add_paragraph(h,'Heading 2'); doc.add_paragraph(txt)

doc.add_paragraph('Production readiness actions','Heading 1')
actions=['Make services/core/server.js the verified API service.','Generate the dashboard snapshot.','Replace each fixture block with its canonical response and show timestamp, freshness and error state.','Run browser tests against the local core service.','Compare the new frontend and client dashboard using the same timestamp and payload.','Run the core API, market streamer and worker scheduler as separate services.','Add persistent snapshot storage, WebSocket or SSE reconnect handling, API authentication and strict CORS.','Add provider entitlement and freshness monitoring, plus contract tests for every route.','Keep live broker execution disabled until owner-approved safety tests pass.']
for i,x in enumerate(actions,1): doc.add_paragraph(f'{i}. {x}')

doc.add_paragraph('Known integration issues','Heading 1')
doc.add_paragraph('The local snapshot endpoint returns 503 SNAPSHOT_NOT_READY because strategy-snapshot-es.json is not ready. The root backend entrypoint imports a missing route file. The Finlight WebSocket returned 403 during startup, indicating an entitlement, endpoint or credential issue. Some deployed routes return 404 because the active service does not mount the full core route set. Browser charts can fall back to demo values when the wrong symbol route is used or an old cached bundle is loaded. Provider API keys alone do not create a real-time pipeline; the streamer, refresh jobs, snapshot writer and API service must all be running.')

doc.add_paragraph('Security note','Heading 1'); doc.add_paragraph('Keep deployment configuration separate from the frontend. Third-party credentials should remain server-side, with only approved, authenticated data exposed to the browser.')

# footer
footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT; r=footer.add_run('Redline Trading Platform | CDO review'); r.font.size=Pt(8); r.font.color.rgb=RGBColor(120,120,120)
doc.save(out)
print(out.resolve())
