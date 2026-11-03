from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_BREAK
from pathlib import Path

out = Path('D:/Client_Projects/redline/AI_Automation_Multi_Agent_SOW.docx')
doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(0.7); sec.bottom_margin = Inches(0.65); sec.left_margin = Inches(0.8); sec.right_margin = Inches(0.8)

styles = doc.styles
styles['Normal'].font.name='Aptos'; styles['Normal'].font.size=Pt(10); styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'),'Aptos')
styles['Normal'].paragraph_format.space_after=Pt(6)
for name,size,color in [('Title',26,'000000'),('Heading 1',16,'000000'),('Heading 2',12,'1F4E79'),('Heading 3',10,'000000')]:
    st=styles[name]; st.font.name='Aptos Display' if name=='Title' else 'Aptos'; st.font.size=Pt(size); st.font.bold=True; st.font.color.rgb=RGBColor.from_string(color); st._element.rPr.rFonts.set(qn('w:eastAsia'),st.font.name)
    st.paragraph_format.space_before=Pt(12 if name!='Title' else 0); st.paragraph_format.space_after=Pt(5)

# header/footer
header=sec.header.paragraphs[0]; header.text='STATEMENT OF WORK  |  AI AUTOMATION AND MULTI-AGENT OPERATIONS SYSTEM'; header.style='Caption'; header.runs[0].font.color.rgb=RGBColor(90,90,90)
footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=footer.add_run('AI Automation and Multi-Agent Operations System  |  Technical SOW'); r.font.size=Pt(8); r.font.color.rgb=RGBColor(100,100,100)

def shade(cell, fill):
    tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); tcPr.append(shd)
def borders(table, color='D9D9D9'):
    tblPr=table._tbl.tblPr; tb=tblPr.first_child_found_in('w:tblBorders')
    if tb is None: tb=OxmlElement('w:tblBorders'); tblPr.append(tb)
    for edge in ('top','left','bottom','right','insideH','insideV'):
        tag='w:'+edge; el=tb.find(qn(tag))
        if el is None: el=OxmlElement(tag); tb.append(el)
        el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'4'); el.set(qn('w:space'),'0'); el.set(qn('w:color'),color)
def table(headers, rows, widths=None):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'; borders(t)
    for i,h in enumerate(headers):
        c=t.rows[0].cells[i]; c.text=h; shade(c,'1F4E79'); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
        for p in c.paragraphs:
            for rr in p.runs: rr.font.bold=True; rr.font.color.rgb=RGBColor(255,255,255); rr.font.size=Pt(9)
    for ri,row in enumerate(rows):
        cells=t.add_row().cells
        for i,val in enumerate(row):
            cells[i].text=str(val); cells[i].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if ri%2==1: shade(cells[i],'F3F6F8')
            for p in cells[i].paragraphs:
                for rr in p.runs: rr.font.size=Pt(9)
    if widths:
        for row in t.rows:
            for i,w in enumerate(widths): row.cells[i].width=Inches(w)
    doc.add_paragraph().paragraph_format.space_after=Pt(2)
    return t

def bullets(items):
    for item in items:
        p=doc.add_paragraph(style='List Bullet'); p.add_run(item)

def num(items):
    for item in items:
        p=doc.add_paragraph(style='List Number'); p.add_run(item)

p=doc.add_paragraph(style='Title'); p.add_run('Statement of Work')
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.LEFT; r=p.add_run('AI Automation and Multi-Agent Operations System'); r.bold=True; r.font.size=Pt(15); r.font.color.rgb=RGBColor(31,78,121)
p=doc.add_paragraph('Technical delivery document for a multi-client operations automation foundation. This SOW defines the proposed architecture, integrations, initial workflows, delivery phases, assumptions, and completion criteria.')
p.paragraph_format.space_after=Pt(12)
table(['Document item','Detail'],[
['Engagement type','Technical discovery, architecture, implementation, testing, documentation, and handover'],
['Estimated minimum build time','15 working days after required access and test data are available'],
['Primary outcome','A working multi-client automation foundation with a daily operations briefing and prioritized client workflows'],
['Commercial terms','Managed separately by the project manager'],
], [1.7,4.9])

h=doc.add_heading('1 Project purpose',1)
doc.add_paragraph('The project will reduce manual administration across multiple client accounts by connecting communication, project-management, file, and meeting systems to a reusable AI automation layer. The system will identify what requires attention, turn conversations into structured work, keep project boards current, and provide controlled automation with human approval for sensitive actions.')

doc.add_heading('2 Objectives',1)
bullets(['Review the existing operational architecture and identify the highest-impact automation opportunities.','Create a reusable foundation for client-specific agents, integrations, rules, and approval steps.','Connect approved platforms through APIs, webhooks, scheduled jobs, or supported connectors.','Process email, messages, calls, transcripts, documents, and project updates.','Produce a daily briefing that prioritizes urgent, overdue, unassigned, and high-value work.','Convert call summaries into tasks with owners, deadlines, priorities, and dependencies.','Provide execution logs, error visibility, retries, and failure notifications.','Deliver documentation and a technical walkthrough for independent operation.'])

doc.add_heading('3 Proposed technical architecture',1)
doc.add_paragraph('The implementation will use a central integration and orchestration layer. n8n will handle triggers, API calls, webhooks, schedules, approvals, retries, and routing. Relevance AI, or an equivalent orchestration layer if the architecture review recommends it, will manage agent instructions, client context, reusable skills, and workflow state. OpenAI and Anthropic APIs will be routed by task type rather than forcing every task through one model.')
table(['Layer','Proposed tools','Role'],[
['Agent orchestration','Relevance AI or approved equivalent','Client-specific agents, instructions, memory, reusable skills, and workflow coordination'],
['Integration and workflow layer','n8n; Zapier, Make, or webhooks where justified','Triggers, schedules, API calls, filters, approvals, retries, and routing'],
['AI model layer','OpenAI and Anthropic APIs','Classification, extraction, summarization, reasoning, drafting, and document-heavy tasks'],
['Communication sources','Outlook, Gmail, Microsoft Teams, Slack, WhatsApp where supported','Inbound messages, alerts, conversations, and communication context'],
['Work systems','Wrike, ClickUp, Monday.com','Task creation, updates, owners, deadlines, priorities, and status checks'],
['Knowledge and files','Google Drive and approved client repositories','Reference documents, transcripts, templates, and supporting evidence'],
['Reporting and oversight','Daily briefings, logs, alerts, approval queue','Operational visibility, review, failure handling, and auditability'],
], [1.3,2.1,3.2])

doc.add_heading('4 Integration map',1)
table(['Client / workflow','Systems','Planned automation'],[
['Medisca','Outlook, Microsoft Teams, Wrike','Scan and classify messages, identify urgent items, triage submissions, monitor tasks, escalate attention items, and support research workflows'],
['Medisca Marketing Help Center','Help Center source plus approved knowledge sources','Daily scan, completeness checks, triage, routing, and proposed follow-up actions'],
['Corinne Moore','Gmail, Slack, ClickUp, presentation platform','Filter irrelevant email, summarize conversations, extract tasks, update ClickUp after approval, and prepare weekly slide updates'],
['Camp Gravy','Monday.com, Slack, Google Drive','Process calls, maintain Monday tasks, identify overdue or unassigned deliverables, and report current project status'],
['Broken Crown Records','WhatsApp where supported, Google Drive','Optional lightweight research and task agent; future scope subject to client continuation and API availability'],
['Cross-client briefing','All approved sources','Morning briefing of urgent, overdue, unassigned, overnight, and attention-required work'],
], [1.5,2.0,3.1])

doc.add_heading('5 Client-specific workflows',1)
doc.add_heading('5.1 Medisca',2)
bullets(['Monitor Outlook email and Microsoft Teams activity.','Monitor Wrike projects, tasks, statuses, owners, and deadlines.','Classify incoming information as urgent, actionable, informational, incomplete, or requiring clarification.','Identify messages that were missed or need immediate attention.','Detect incomplete Marketing Help Center submissions and propose next actions.','Provide a research agent and a dedicated Marketing Help Center agent.','Create proposed Wrike updates or drafts for review before sensitive execution.'])
doc.add_heading('5.2 Corinne Moore',2)
bullets(['Scan and classify Gmail messages, filtering low-value or irrelevant items.','Monitor Slack conversations relevant to active work.','Process call summaries into ClickUp tasks.','Extract decisions, action items, owners, deadlines, priorities, and dependencies.','Prepare weekly presentation updates from approved ClickUp and Slack information.','Use an approval step before material task or communication changes.'])
doc.add_heading('5.3 Camp Gravy',2)
bullets(['Monitor Monday.com, Slack, and approved Google Drive sources.','Process recurring call summaries and keep project information current.','Create and update Monday.com tasks.','Identify overdue, unassigned, blocked, or incomplete deliverables.','Provide status alerts and a concise operational view of current work.'])
doc.add_heading('5.4 Broken Crown Records',2)
doc.add_paragraph('Broken Crown Records is optional future scope because the client relationship and ongoing requirements are uncertain. If retained, the workflow may support approved WhatsApp capture, Google Drive research, and lightweight task assistance. No production implementation is included in the 15-day minimum estimate unless explicitly prioritized.')

doc.add_heading('6 Cross-client daily operations agent',1)
doc.add_paragraph('A central daily operations agent will scan configured sources on a schedule and produce a morning briefing. The briefing will prioritize work by urgency, due date, client importance, message severity, and project status. Each recommendation should include a source reference or link where the platform permits it.')
bullets(['Urgent messages and overnight activity.','Upcoming and missed deadlines.','Overdue, unassigned, blocked, or incomplete tasks.','New decisions and action items from calls or conversations.','Recommended first actions for the day.','Items waiting for approval or clarification.','Processing failures or unavailable integrations.'])

doc.add_heading('7 Call-to-task automation',1)
doc.add_paragraph('When a transcript, recording summary, or approved call note is available, the relevant client agent will extract structured work and prepare updates for the correct project-management platform.')
table(['Extracted field','Example output'],[['Decision','Approved direction or confirmed outcome'],['Action item','Concrete next step'],['Owner','Person responsible'],['Due date','Explicit or inferred deadline, flagged when uncertain'],['Priority','Urgent, high, normal, or low'],['Dependency','Blocked by person, task, file, or decision'],['Risk or open question','Issue requiring clarification or escalation']], [1.8,4.8])

doc.add_heading('8 Approval, security, and failure handling',1)
bullets(['Draft emails and messages may be prepared automatically, while sending remains approval-controlled unless separately authorized.','Project updates that change ownership, deadlines, priority, or external status require approval.','Every workflow should record the trigger, source, agent action, approval state, result, and error where available.','Failed steps should retry according to configured limits and then create an alert for review.','Credentials and API keys should be stored in the approved secret-management method for the selected platform.','Production data should not be used for testing until access, privacy, and approval requirements are confirmed.'])

doc.add_heading('9 Delivery phases',1)
table(['Phase','Activities','Indicative effort'],[
['1. Architecture and prioritization','Review tools, access, workflows, data sources, constraints, and priority order. Confirm the first production workflow.','2 working days'],
['2. Automation foundation','Configure orchestration, n8n workflows, API connections, shared rules, model routing, logs, approvals, and retries.','3 working days'],
['3. First working workflow','Build the daily briefing and highest-priority client workflow. Test with representative samples and refine behavior.','5 working days'],
['4. Additional workflows','Extend the foundation to the remaining active clients and configure client-specific mappings.','3 working days'],
['5. Testing and handover','Run acceptance tests, fix agreed issues, document the system, and conduct the technical walkthrough.','2 working days'],
], [1.5,4.5,1.2])

doc.add_heading('10 Minimum implementation timeline',1)
doc.add_paragraph('The minimum realistic implementation period is 15 working days after required access, API keys, permissions, sample data, and timely review feedback are available. The estimate assumes that existing platforms expose the required APIs or supported connectors and that no major enterprise security review delays the work.')
doc.add_paragraph('The 15-day estimate covers a working operational foundation and prioritized workflows. A complete enterprise-grade system with extensive edge-case handling, advanced analytics, additional clients, custom interfaces, and every possible integration should be treated as follow-on work.')

doc.add_heading('11 Developer deliverables',1)
bullets(['Architecture and integration map.','Prioritized automation roadmap.','Configured orchestration and workflow foundation.','Daily cross-client operations briefing.','Initial working client workflow.','Client-specific workflow configurations prioritized within the implementation window.','Call-summary extraction and task mapping where source data is available.','Human-approval checkpoints for sensitive actions.','Execution logs, retry behavior, and failure alerts.','Setup and operating documentation.','Technical walkthrough and handover notes.','Future-phase recommendations.'])

doc.add_heading('12 Client dependencies',1)
bullets(['Access to the required platforms and workspaces.','API keys, OAuth permissions, webhook permissions, and test accounts.','Representative emails, transcripts, tasks, documents, and slide templates.','Clear identification of client workspaces, projects, channels, owners, and approval users.','Timely review of proposed rules, drafts, and task mappings.','Confirmation of privacy, data-retention, and security requirements.','Access to the selected presentation platform for weekly slide updates.'])

doc.add_heading('13 Scope boundaries',1)
bullets(['Broken Crown Records production automation is optional future scope.','Fully autonomous sending of sensitive communications is excluded unless separately approved.','Custom mobile applications and replacement of existing project-management platforms are excluded.','Advanced compliance, legal review, enterprise security certification, and custom hosting are excluded from the minimum estimate.','Ongoing maintenance, monitoring, and feature development after handover require a separate arrangement.','Integration behavior remains subject to platform API availability, permissions, rate limits, and third-party changes.'])

doc.add_heading('14 Acceptance criteria',1)
bullets(['The architecture and integration map are documented.','The selected orchestration and workflow foundation is configured.','The daily operations briefing runs against approved test sources.','The agreed initial client workflow is demonstrated with representative data.','The system can extract and present urgent, overdue, unassigned, and attention-required items.','Approval checkpoints operate for the agreed sensitive actions.','Logs and failure notifications are available for the implemented workflows.','Documentation and a technical walkthrough are delivered.','Known limitations and future work are recorded.'])

doc.add_heading('15 Future expansion',1)
bullets(['Additional client-specific agents and research agents.','More advanced meeting and call ingestion.','Automated weekly reporting and slide generation.','Expanded knowledge bases and document retrieval.','Performance metrics and cross-client dashboards.','Additional messaging integrations.','More granular permissions, audit trails, and operational analytics.'])

doc.add_heading('16 Technical assumptions',1)
doc.add_paragraph('The final implementation plan will be confirmed after the architecture review. Tool choices may be adjusted if an existing platform already provides a reliable capability, if an API is unavailable, or if a simpler integration reduces maintenance. The objective is a reliable and extensible system with clear human oversight, rather than unnecessary platform complexity.')

# metadata
props=doc.core_properties; props.title='AI Automation and Multi-Agent Operations System - Statement of Work'; props.subject='Technical SOW'; props.author=''

doc.save(out)
print(out)
