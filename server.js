'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// IssueAI — Single-file deployment
// Everything is in this one file: DB, API routes, and the full HTML/CSS/JS UI
// Deploy to Railway / Render / any Node host: npm install && npm start
// ══════════════════════════════════════════════════════════════════════════════
const express = require('express');
const multer  = require('multer');
const { parse }     = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { v4: uuid }  = require('uuid');
const fs   = require('fs');
const path = require('path');

// ── Data directory ────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'issueai.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── In-memory JSON store ──────────────────────────────────────────────────────
let store = { issues: [], sprints: [] };

function loadStore() {
  if (fs.existsSync(DB_FILE)) {
    try { store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch(e) { console.warn('DB corrupt, starting fresh'); }
  }
  if (!store.issues)  store.issues  = [];
  if (!store.sprints) store.sprints = [];
}

function saveStore() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2)); }
  catch(e) { console.error('Save failed:', e.message); }
}

loadStore();

// ── Seed data ─────────────────────────────────────────────────────────────────
if (store.issues.length === 0) {
  const now = new Date().toISOString();
  const I = (id,title,description,reporter,project,source,status,severity,category,root_cause) =>
    ({id,title,description,reporter,project,source,status,severity,category,root_cause,created_at:now,updated_at:now});

  store.issues = [
    I('i-001','Auth service returns 200 on invalid token','Token validation bypass in v2.3. Confirmed via pentest.','Arjun Verma','Horizon','teams','open','critical','security','Security regression — token validation logic removed during v2.3 refactor'),
    I('i-002','Prod DB migration ran twice — data duplication','Migration ran twice during blue-green deploy. Orders table has duplicate rows.','Kiran Rao','Atlas','teams','open','critical','process','No idempotency check in migration runner script'),
    I('i-003','API gateway 504 timeouts on peak load','Gateway returns 504 after 30s during peak hours. Affects all upstream services.','Ravi Kumar','Phoenix','teams','open','high','technical','Connection pool exhaustion under concurrent upstream requests'),
    I('i-004','Unit tests skipped in CI pipeline','Test step silently passes even when tests fail. Regression after pipeline refactor.','Aditya Singh','Phoenix','teams','open','high','quality','Test step misconfigured — exit code not checked after pipeline refactor'),
    I('i-005','Memory leak in background worker process','Worker grows ~200MB/hour under load. Requires restart every 6-8 hours.','Suresh Menon','Atlas','teams','open','high','technical','Event listener not removed on job completion — accumulates across job queue'),
    I('i-006','Sprint velocity dropped 25% — 3 sprints running','Team completing only 75% of committed points since Sprint 12.','Priya Sharma','Phoenix','manual','open','medium','process','Excessive unplanned critical work consuming planned capacity; PR bottlenecks'),
    I('i-007','OAuth token refresh failing silently','Refresh fails with no user-visible error. Session expires without warning.','Meera Joshi','Horizon','teams','open','high','security','Missing error handler on token refresh callback — failure swallowed silently'),
    I('i-008','PR reviews averaging 4+ days — blocking releases','No CODEOWNERS file. Reviewers manually assigned. Average wait: 4.2 days.','Rahul Desai','Phoenix','manual','open','low','process','No review ownership policy; reviewers unassigned by default across all repos'),
    I('i-009','Staging environment out of sync with prod','Staging DB snapshot 3 weeks old. QA signing off against stale data.','Kiran Rao','Phoenix','manual','open','medium','environment','No automated staging refresh pipeline — manual process skipped 3 sprints'),
    I('i-010','Rate limiting not enforced on public API','All public endpoints lack rate limiting. Discovered via security audit.','Arjun Verma','Atlas','teams','open','critical','security','Rate limiting omitted from API gateway config during v2.4 migration'),
    I('i-011','No rollback plan for v2.4 release','Release notes drafted but no rollback runbook. DB changes not reversible.','Priya Sharma','Phoenix','manual','open','medium','process','Release planning process lacks mandatory rollback runbook requirement'),
    I('i-012','Dev environment setup takes 4+ hours','40-step Confluence doc is 6 months stale. New joiners blocked day 1.','Suresh Pillai','Horizon','manual','open','medium','environment','No automation for dev setup; docs not maintained alongside code changes'),
    I('i-013','Log aggregation missing for new services','3 services in Sprint 13 have no centralised logging. Debug requires SSH.','Rahul Desai','Atlas','teams','open','medium','environment','Logging setup not part of service launch checklist; skipped under time pressure'),
    I('i-014','Flaky integration tests block deployments','5 tests fail at ~15% rate. Devs retry pipelines instead of fixing root cause.','Amit Shah','Phoenix','teams','open','medium','quality','Test isolation failures — shared state between tests causes non-determinism'),
    I('i-015','API docs outdated by 2 sprints','3 breaking changes undocumented since v2.1. Consumers building against wrong contracts.','Meera Joshi','Atlas','manual','open','low','process','No doc update requirement in PR checklist; documentation treated as optional'),
    I('i-016','Deployment blocked — missing env config','v2.4 deploy failed: PAYMENT_GATEWAY_SECRET not set in prod. Delayed 6 hours.','Neha Patil','Phoenix','teams','resolved','critical','environment','Config not promoted from staging to prod deployment checklist'),
    I('i-017','No monitoring on payment service','Payment failures undetected for hours. Found via customer support tickets.','Deepa Mehta','Atlas','teams','open','high','environment','No alerts on payments pod; monitoring skipped during service extraction'),
    I('i-018','Onboarding docs reference deprecated tooling','New engineers told to install tools removed 2 quarters ago.','Deepa Mehta','Horizon','manual','resolved','low','process','Onboarding docs not reviewed when tooling changes; no ownership assigned'),
  ];

  store.sprints = [
    {id:'sp-ph-10',sprint_label:'Sprint 10',project:'Phoenix',period_start:'2025-10-01',period_end:'2025-10-14',total_issues:7, critical:1,high:2,medium:3,low:1,resolved:4,top_category:'technical',velocity_score:8.5},
    {id:'sp-ph-11',sprint_label:'Sprint 11',project:'Phoenix',period_start:'2025-10-15',period_end:'2025-10-28',total_issues:8, critical:1,high:3,medium:2,low:2,resolved:5,top_category:'technical',velocity_score:8.2},
    {id:'sp-ph-12',sprint_label:'Sprint 12',project:'Phoenix',period_start:'2025-10-29',period_end:'2025-11-11',total_issues:10,critical:2,high:3,medium:4,low:1,resolved:4,top_category:'process',  velocity_score:7.5},
    {id:'sp-ph-13',sprint_label:'Sprint 13',project:'Phoenix',period_start:'2025-11-12',period_end:'2025-11-25',total_issues:11,critical:2,high:4,medium:3,low:2,resolved:3,top_category:'security', velocity_score:7.0},
    {id:'sp-ph-14',sprint_label:'Sprint 14',project:'Phoenix',period_start:'2025-11-26',period_end:'2025-12-09',total_issues:18,critical:4,high:6,medium:5,low:3,resolved:8,top_category:'security', velocity_score:6.4},
    {id:'sp-at-10',sprint_label:'Sprint 10',project:'Atlas',  period_start:'2025-10-01',period_end:'2025-10-14',total_issues:5, critical:0,high:2,medium:2,low:1,resolved:3,top_category:'technical',velocity_score:8.8},
    {id:'sp-at-11',sprint_label:'Sprint 11',project:'Atlas',  period_start:'2025-10-15',period_end:'2025-10-28',total_issues:6, critical:1,high:2,medium:2,low:1,resolved:4,top_category:'technical',velocity_score:8.0},
    {id:'sp-at-12',sprint_label:'Sprint 12',project:'Atlas',  period_start:'2025-10-29',period_end:'2025-11-11',total_issues:7, critical:1,high:3,medium:2,low:1,resolved:4,top_category:'process',  velocity_score:7.6},
    {id:'sp-at-13',sprint_label:'Sprint 13',project:'Atlas',  period_start:'2025-11-12',period_end:'2025-11-25',total_issues:8, critical:2,high:3,medium:2,low:1,resolved:3,top_category:'security', velocity_score:7.1},
    {id:'sp-at-14',sprint_label:'Sprint 14',project:'Atlas',  period_start:'2025-11-26',period_end:'2025-12-09',total_issues:10,critical:3,high:4,medium:2,low:1,resolved:5,top_category:'security', velocity_score:6.2},
  ];
  saveStore();
}

// ── DB helpers ────────────────────────────────────────────────────────────────
const SEV_ORDER = {critical:1,high:2,medium:3,low:4};

const db = {
  list(filters={}) {
    const {project,status,severity,category,search} = filters;
    return store.issues.filter(i => {
      if (project  && project!=='all'  && i.project.toLowerCase()!==project.toLowerCase())  return false;
      if (status   && status!=='all'   && i.status!==status)   return false;
      if (severity && severity!=='all' && i.severity!==severity) return false;
      if (category && category!=='all' && i.category!==category) return false;
      if (search) {
        const s=search.toLowerCase();
        if (!`${i.title} ${i.reporter} ${i.project} ${i.description}`.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a,b)=>(SEV_ORDER[a.severity]||9)-(SEV_ORDER[b.severity]||9));
  },
  get(id) { return store.issues.find(i=>i.id===id)||null; },
  insert(issue) { store.issues.unshift(issue); saveStore(); return issue; },
  update(id,fields) {
    const idx=store.issues.findIndex(i=>i.id===id); if(idx<0) return null;
    const allowed=['title','description','reporter','project','status','severity','category','root_cause'];
    allowed.forEach(k=>{ if(fields[k]!==undefined) store.issues[idx][k]=fields[k]; });
    store.issues[idx].updated_at=new Date().toISOString();
    saveStore(); return store.issues[idx];
  },
  delete(id) {
    const before=store.issues.length;
    store.issues=store.issues.filter(i=>i.id!==id);
    if(store.issues.length<before) saveStore();
    return store.issues.length<before;
  },
  bulkInsert(issues) {
    const existing=new Set(store.issues.map(i=>i.id));
    const toAdd=issues.filter(i=>!existing.has(i.id));
    store.issues=[...toAdd,...store.issues]; saveStore(); return toAdd.length;
  },
  stats() {
    const issues=store.issues, total=issues.length;
    const open=issues.filter(i=>i.status==='open').length;
    const resolved=issues.filter(i=>i.status==='resolved').length;
    const critical=issues.filter(i=>i.severity==='critical'&&i.status==='open').length;
    const bySev=['critical','high','medium','low'].map(s=>({severity:s,c:issues.filter(i=>i.severity===s&&i.status==='open').length})).filter(s=>s.c>0);
    const catMap={};issues.forEach(i=>{if(i.category) catMap[i.category]=(catMap[i.category]||0)+1;});
    const byCat=Object.entries(catMap).map(([category,c])=>({category,c})).sort((a,b)=>b.c-a.c).slice(0,8);
    const projMap={};issues.forEach(i=>{projMap[i.project]=(projMap[i.project]||0)+1;});
    const byProj=Object.entries(projMap).map(([project,c])=>({project,c})).sort((a,b)=>b.c-a.c);
    const health=Math.max(0,Math.min(10,10-critical*2-(open-resolved)*0.1)).toFixed(1);
    return {total,open,resolved,critical,bySev,byCat,byProj,health};
  },
  sprints(project) {
    return store.sprints.filter(s=>!project||s.project===project)
      .sort((a,b)=>a.period_start.localeCompare(b.period_start));
  },
  projects() { return [...new Set(store.issues.map(i=>i.project))].sort(); },
};

// ── Express app ───────────────────────────────────────────────────────────────
const app    = express();
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});
const PORT   = process.env.PORT || 3000;

app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true}));

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/health', (_,res)=>res.json({status:'ok'}));
app.get('/api/stats',    (_,res)=>res.json(db.stats()));
app.get('/api/projects', (_,res)=>res.json(db.projects()));
app.get('/api/sprints',  (req,res)=>res.json(db.sprints(req.query.project)));

app.get('/api/issues', (req,res)=>{
  const {project,status,severity,category,search}=req.query;
  res.json(db.list({project,status,severity,category,search}));
});

app.post('/api/issues', (req,res)=>{
  const {title,description='',reporter='Unknown',project='General',
         source='manual',status='open',severity='medium',category='',root_cause=''}=req.body;
  if (!title||!title.trim()) return res.status(400).json({error:'Title is required'});
  const issue={id:'i-'+uuid().slice(0,8),title:title.trim(),description,reporter,
               project,source,status,severity,category,root_cause,
               created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  db.insert(issue);
  res.status(201).json(db.get(issue.id));
});

app.patch('/api/issues/:id', (req,res)=>{
  const issue=db.get(req.params.id);
  if (!issue) return res.status(404).json({error:'Not found'});
  res.json(db.update(req.params.id,req.body));
});

app.delete('/api/issues/:id', (req,res)=>{
  if (!db.get(req.params.id)) return res.status(404).json({error:'Not found'});
  db.delete(req.params.id);
  res.json({ok:true});
});

app.post('/api/issues/import-csv', upload.single('file'), (req,res)=>{
  if (!req.file) return res.status(400).json({error:'No file uploaded'});
  let rows;
  try { rows=parse(req.file.buffer,{columns:true,skip_empty_lines:true,trim:true,relax_column_count:true}); }
  catch(e) { return res.status(400).json({error:'CSV parse error: '+e.message}); }
  const issues=rows.map(r=>({
    id:'i-'+uuid().slice(0,8),
    title:r.title||r.Title||'Untitled',
    description:r.description||r.Description||'',
    reporter:r.reporter||r.Reporter||'CSV Import',
    project:r.project||r.Project||'General',
    source:'csv',status:r.status||'open',
    severity:(r.severity||r.Severity||'medium').toLowerCase(),
    category:r.category||r.Category||'',
    root_cause:r.root_cause||'',
    created_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }));
  const added=db.bulkInsert(issues);
  res.json({imported:added,issues});
});

app.get('/api/issues/export-csv', (req,res)=>{
  const issues=db.list(req.query);
  const csv=stringify(issues,{header:true,columns:['id','title','description','reporter','project','source','status','severity','category','root_cause','created_at']});
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="issues.csv"');
  res.send(csv);
});

app.get('/api/report', (req,res)=>{
  const s=db.stats();
  const issues=db.list({status:'open'}).slice(0,20);
  const now=new Date().toLocaleDateString('en-IN',{dateStyle:'long'});
  const rows=issues.map((i,n)=>`| ${n+1} | ${i.title} | ${i.project} | ${i.severity} | ${i.category||'—'} | ${i.status} |`).join('\n');
  const md=`# Project Issues Intelligence Report\n**Generated:** ${now} | **Total:** ${s.total} | **Open:** ${s.open} | **Critical:** ${s.critical} | **Health:** ${s.health}/10\n\n## Open Issues\n| # | Title | Project | Severity | Category | Status |\n|---|-------|---------|----------|----------|--------|\n${rows}\n\n## Recommendations\n${s.critical>0?`- 🔴 Resolve ${s.critical} critical issue(s) before next release\n`:''}- Add SAST scanning to CI pipeline\n- Enforce PR review SLA and CODEOWNERS\n- Run retrospectives to prevent recurring patterns\n`;
  res.setHeader('Content-Type','text/markdown');
  res.setHeader('Content-Disposition','attachment; filename="issueai-report.md"');
  res.send(md);
});

// ── Serve the full SPA (HTML+CSS+JS all inlined) ──────────────────────────────
app.get('*', (req,res)=>res.send(HTML));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', ()=>console.log(`⚡ IssueAI on http://0.0.0.0:${PORT}`));

// ══════════════════════════════════════════════════════════════════════════════
// FULL UI — HTML + CSS + JS all inlined below
// ══════════════════════════════════════════════════════════════════════════════

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>IssueAI — Project Intelligence</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d0f14;
  --bg2:#13161e;
  --bg3:#1a1e28;
  --bg4:#222736;
  --border:#2a2f3f;
  --border2:#343b52;
  --text:#e8eaf0;
  --text2:#9097b0;
  --text3:#555e78;
  --accent:#6c63ff;
  --accent2:#8b85ff;
  --red:#ff4d4d;
  --orange:#ff9933;
  --yellow:#ffd24d;
  --green:#2ecc8a;
  --blue:#4d9fff;
  --teal:#26c6b0;
  --font-display:'Syne',sans-serif;
  --font-body:'DM Sans',sans-serif;
  --font-mono:'DM Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:14px;min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg2)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}

/* ── SIDEBAR ── */
.sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:100}
.logo{padding:24px 20px 20px;font-family:var(--font-display);font-size:16px;font-weight:800;letter-spacing:-0.3px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
.logo-icon{width:32px;height:32px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.logo span{color:var(--text2);font-weight:400;font-size:11px;display:block;margin-top:1px}
.nav{padding:16px 12px;flex:1;display:flex;flex-direction:column;gap:2px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:all 0.15s;color:var(--text2);font-size:13px;font-weight:500;position:relative;user-select:none}
.nav-item:hover{background:var(--bg3);color:var(--text)}
.nav-item.active{background:var(--bg4);color:var(--text);border:1px solid var(--border2)}
.nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:60%;background:var(--accent);border-radius:0 2px 2px 0}
.nav-icon{font-size:15px;width:18px;text-align:center}
.nav-badge{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:20px;font-family:var(--font-mono)}
.nav-badge.green{background:var(--green);color:#0d1a12}
.sidebar-footer{padding:16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}
.avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#26c6b0);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
.user-name{font-size:12px;font-weight:500}
.user-role{font-size:11px;color:var(--text3)}

/* ── TOPBAR ── */
.main{margin-left:220px;min-height:100vh;display:flex;flex-direction:column}
.topbar{padding:16px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;background:var(--bg2);position:sticky;top:0;z-index:50}
.page-title{font-family:var(--font-display);font-size:18px;font-weight:700}
.topbar-actions{margin-left:auto;display:flex;gap:10px;align-items:center}
.search-wrap{position:relative}
.search-wrap::before{content:'⌕';position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px;z-index:1;pointer-events:none}
.search-bar{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 12px 7px 32px;color:var(--text);font-size:13px;outline:none;width:220px;font-family:var(--font-body);transition:border-color .15s}
.search-bar:focus{border-color:var(--accent)}

/* ── BUTTONS ── */
.btn{padding:7px 16px;border-radius:8px;border:none;cursor:pointer;font-family:var(--font-body);font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;white-space:nowrap;text-decoration:none}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent2)}
.btn-secondary{background:var(--bg3);color:var(--text);border:1px solid var(--border2)}.btn-secondary:hover{background:var(--bg4)}
.btn-danger{background:#2d1515;color:var(--red);border:1px solid #3d1f1f}
.btn-success{background:#0d2018;color:var(--green);border:1px solid #1a3828}
.btn:disabled{opacity:.5;cursor:not-allowed}

/* ── CONTENT / TABS ── */
.content{padding:24px 28px;flex:1}
.tab-panels>div{display:none}
.tab-panels>div.active{display:block;animation:fadeUp .22s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

/* ── KPI ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.kpi-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;position:relative;overflow:hidden;transition:border-color .2s}
.kpi-card:hover{border-color:var(--border2)}
.kpi-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.kpi-card.red::after{background:var(--red)}.kpi-card.orange::after{background:var(--orange)}.kpi-card.green::after{background:var(--green)}.kpi-card.accent::after{background:var(--accent)}.kpi-card.blue::after{background:var(--blue)}
.kpi-label{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;font-weight:600;margin-bottom:10px}
.kpi-value{font-family:var(--font-display);font-size:34px;font-weight:800;line-height:1}
.kpi-value.red{color:var(--red)}.kpi-value.orange{color:var(--orange)}.kpi-value.green{color:var(--green)}.kpi-value.accent{color:var(--accent)}.kpi-value.blue{color:var(--blue)}
.kpi-sub{font-size:11px;color:var(--text3);margin-top:6px}.kpi-sub b{color:var(--green)}
.kpi-bg-num{position:absolute;right:-4px;bottom:-10px;font-family:var(--font-display);font-size:64px;font-weight:800;opacity:.05;line-height:1;pointer-events:none}

/* ── CHARTS ── */
.charts-row{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:14px;margin-bottom:22px}
.chart-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.chart-title{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.bar-chart{display:flex;flex-direction:column;gap:8px}
.bar-row{display:flex;align-items:center;gap:10px}
.bar-label{font-size:11px;color:var(--text2);width:82px;text-align:right;flex-shrink:0}
.bar-track{flex:1;background:var(--bg3);border-radius:4px;height:20px;position:relative;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;display:flex;align-items:center;padding-right:8px;justify-content:flex-end;font-size:10px;font-family:var(--font-mono);font-weight:500;color:#fff;transition:width 1s cubic-bezier(.4,0,.2,1)}
.bar-num{font-size:11px;color:var(--text2);font-family:var(--font-mono);width:24px;flex-shrink:0;text-align:right}
.donut-wrap{display:flex;align-items:center;gap:20px}
.donut{width:110px;height:110px;flex-shrink:0}
.donut-legend{display:flex;flex-direction:column;gap:7px}
.legend-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2)}
.legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.legend-val{margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text2)}

/* ── TABLE ── */
.table-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.table-header{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.table-title{font-size:13px;font-weight:600}
.filter-pills{display:flex;gap:6px}
.pill{padding:3px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);color:var(--text2);transition:all .15s;font-weight:500;background:transparent;font-family:var(--font-body)}
.pill:hover,.pill.active{background:var(--accent);border-color:var(--accent);color:#fff}
table{width:100%;border-collapse:collapse}
th{padding:10px 16px;text-align:left;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border);background:var(--bg3);white-space:nowrap}
td{padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(26,30,40,.7)}
.sev-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.5px}
.sev-critical{background:#2d0f0f;color:var(--red);border:1px solid #5a1a1a}
.sev-high{background:#2d1f0a;color:var(--orange);border:1px solid #5a3a14}
.sev-medium{background:#0d1f2d;color:var(--blue);border:1px solid #1a3a5a}
.sev-low{background:#0d2018;color:var(--green);border:1px solid #1a3828}
.cat-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:var(--bg4);color:var(--text2);border:1px solid var(--border2);font-family:var(--font-mono)}
.status-dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:6px}
.r-avatar{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;color:#fff}
.action-btn{background:transparent;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10px;cursor:pointer;color:var(--text3);font-family:var(--font-mono);transition:all .15s}
.action-btn:hover{background:var(--bg3);color:var(--text)}
.action-btn.resolve{color:var(--green);border-color:#1a3828}.action-btn.resolve:hover{background:#0d2018}
.action-btn.delete{color:var(--red);border-color:#3d1515}.action-btn.delete:hover{background:#2d0f0f}

/* ── AI STATUS BAR ── */
.ai-status-bar{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:12px;margin-bottom:14px;font-size:12px}
.ai-status-bar.hidden{display:none}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(46,204,138,.4)}50%{opacity:.8;box-shadow:0 0 0 6px rgba(46,204,138,0)}}
.prog-bar{flex:1;background:var(--bg4);border-radius:4px;height:4px;overflow:hidden}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--teal));border-radius:4px;width:0%;transition:width .35s ease}
.ai-status-text{color:var(--text2);flex:1}

/* ── INGEST ── */
.ingest-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
.ingest-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:22px;display:flex;flex-direction:column;gap:14px;transition:border-color .2s}
.ingest-card:hover{border-color:var(--border2)}
.ingest-icon{font-size:28px}
.ingest-title{font-family:var(--font-display);font-size:15px;font-weight:700}
.ingest-desc{font-size:12px;color:var(--text2);line-height:1.6}
.ingest-meta{font-size:11px;color:var(--text3);font-family:var(--font-mono);padding:8px 10px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);line-height:1.7}
.manual-form{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:22px;margin-top:14px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-full{grid-column:span 2}
.form-group{display:flex;flex-direction:column;gap:5px}
label{font-size:11px;color:var(--text2);font-weight:600;text-transform:uppercase;letter-spacing:.5px}
input,textarea,select{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:var(--font-body);font-size:13px;outline:none;transition:border-color .15s;width:100%}
input:focus,textarea:focus,select:focus{border-color:var(--accent)}
select option{background:var(--bg3)}
textarea{resize:vertical;min-height:80px}

/* ── ANALYSIS ── */
.analysis-top{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:14px;display:flex;gap:32px;align-items:flex-start}
.analysis-summary{flex:1}
.analysis-summary h2{font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:8px}
.analysis-summary p{font-size:13px;color:var(--text2);line-height:1.7}
.health-ring{flex-shrink:0;text-align:center}
.health-score{font-family:var(--font-display);font-size:48px;font-weight:800;color:var(--green);line-height:1}
.health-label{font-size:11px;color:var(--text3);margin-top:4px;text-transform:uppercase;letter-spacing:.8px}
.analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.analysis-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:14px}
.analysis-card h3{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px}
.pattern-item{padding:12px 14px;background:var(--bg3);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--accent)}
.pattern-item:last-child{margin-bottom:0}
.pattern-title{font-size:13px;font-weight:600;margin-bottom:4px}
.pattern-sub{font-size:11px;color:var(--text2);margin-bottom:4px}
.pattern-action{font-size:11px;color:var(--teal)}
.reco-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.reco-card{padding:14px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)}
.reco-prio{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:var(--font-mono)}
.reco-action{font-size:12px;font-weight:600;margin-bottom:6px}
.reco-rationale{font-size:11px;color:var(--text2);line-height:1.5}

/* ── PATTERNS ── */
.psub{display:none}
.psub.active{display:block;animation:fadeUp .2s ease both}
.vel-bar-wrap{display:flex;align-items:flex-end;gap:4px;height:120px;padding:0 8px}
.vel-bar-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.vel-bar-fill{width:100%;border-radius:4px 4px 0 0;transition:height .8s cubic-bezier(.4,0,.2,1)}
.vel-bar-label{font-size:9px;color:var(--text3);font-family:var(--font-mono);text-align:center}
.vel-bar-val{font-size:10px;font-family:var(--font-mono);font-weight:600}
.comp-bar-wrap{display:flex;align-items:flex-end;gap:8px;height:130px;padding:0 8px}
.comp-bar-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.comp-stacked{width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;border-radius:4px 4px 0 0;overflow:hidden}

/* ── DOCUMENT ── */
.doc-toolbar{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.doc-body{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:32px 40px;font-family:var(--font-mono);font-size:12.5px;line-height:1.8;color:var(--text);max-height:520px;overflow-y:auto}
.md-h1{font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:10px;margin-top:4px}
.md-h2{font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--accent2);margin-top:22px;margin-bottom:8px}
.md-h3{font-size:13px;font-weight:700;color:var(--text);margin-top:12px;margin-bottom:5px}
.md-p{font-size:13px;color:var(--text2);margin-bottom:10px;font-family:var(--font-body);line-height:1.7}
.md-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
.md-table th{background:var(--bg4);padding:7px 12px;text-align:left;color:var(--text2);border:1px solid var(--border2);font-size:10px;text-transform:uppercase;letter-spacing:.5px}
.md-table td{padding:7px 12px;border:1px solid var(--border);color:var(--text)}
.md-table tr:nth-child(even) td{background:rgba(26,30,40,.5)}
.md-ul{margin:6px 0 10px 18px;color:var(--text2);font-family:var(--font-body);font-size:13px}
.md-ul li{margin-bottom:4px;line-height:1.6}
.md-badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;font-family:var(--font-mono)}
.md-badge.c{background:#2d0f0f;color:var(--red);border:1px solid #5a1a1a}
.md-badge.h{background:#2d1f0a;color:var(--orange);border:1px solid #5a3a14}
.md-badge.m{background:#0d1f2d;color:var(--blue);border:1px solid #1a3a5a}
.md-badge.l{background:#0d2018;color:var(--green);border:1px solid #1a3828}
code{background:var(--bg4);padding:1px 5px;border-radius:4px;font-family:var(--font-mono);font-size:11px;color:var(--teal);border:1px solid var(--border)}

/* ── MODAL ── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.modal-overlay.hidden{display:none}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:28px;width:540px;max-width:94vw;max-height:88vh;overflow-y:auto;animation:fadeUp .2s ease}
.modal-title{font-family:var(--font-display);font-size:17px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between}
.modal-close{background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:2px 6px;border-radius:6px}
.modal-close:hover{background:var(--bg3);color:var(--text)}

/* ── TOAST ── */
.toast{position:fixed;bottom:24px;right:24px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:12px 18px;font-size:13px;color:var(--text);box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:999;transform:translateY(60px);opacity:0;transition:all .28s cubic-bezier(.4,0,.2,1);max-width:360px}
.toast.show{transform:translateY(0);opacity:1}

/* ── UTILS ── */
.hidden{display:none!important}
.text-red{color:var(--red)}.text-orange{color:var(--orange)}.text-green{color:var(--green)}.text-blue{color:var(--blue)}.text-accent{color:var(--accent)}
.empty-state{text-align:center;padding:48px;color:var(--text3);font-size:13px}
.empty-state big{display:block;font-size:32px;margin-bottom:12px}

</style>
</head>
<body>

<!-- ── TOAST ── -->
<div id="toast" class="toast"></div>

<!-- ── MODAL ── -->
<div id="modal-overlay" class="modal-overlay hidden">
  <div id="modal" class="modal"></div>
</div>

<!-- ── SIDEBAR ── -->
<div class="sidebar">
  <div class="logo">
    <div class="logo-icon">⚡</div>
    <div>
      <div>IssueAI</div>
      <span>Project Intelligence</span>
    </div>
  </div>
  <nav class="nav">
    <div class="nav-item" data-tab="dashboard"><span class="nav-icon">⊞</span>Dashboard</div>
    <div class="nav-item active" data-tab="issues"><span class="nav-icon">◈</span>Issues<span class="nav-badge" id="nav-badge-issues">—</span></div>
    <div class="nav-item" data-tab="ingest"><span class="nav-icon">↓</span>Ingest Data</div>
    <div class="nav-item" data-tab="analysis"><span class="nav-icon">✦</span>AI Analysis</div>
    <div class="nav-item" data-tab="patterns"><span class="nav-icon">◉</span>Patterns</div>
    <div class="nav-item" data-tab="document"><span class="nav-icon">≡</span>Documents<span class="nav-badge green">1</span></div>
  </nav>
  <div class="sidebar-footer">
    <div class="avatar" id="user-avatar">RK</div>
    <div>
      <div class="user-name" id="user-name">Ravi Kumar</div>
      <div class="user-role">Engineering Lead</div>
    </div>
  </div>
</div>

<!-- ── MAIN ── -->
<div class="main">
  <div class="topbar">
    <div class="page-title" id="page-title">Issues</div>
    <div class="topbar-actions">
      <div class="search-wrap">
        <input class="search-bar" id="global-search" placeholder="Search issues, projects…"/>
      </div>
      <button class="btn btn-secondary" data-go="ingest">↓ Ingest</button>
      <button class="btn btn-primary" id="btn-add-issue">+ Add Issue</button>
    </div>
  </div>

  <div class="content">
    <div class="tab-panels">

      <!-- ══════════════════ DASHBOARD ══════════════════ -->
      <div id="tab-dashboard">
        <!-- KPI row -->
        <div class="kpi-grid" id="kpi-grid">
          <div class="kpi-card red"><div class="kpi-label">Critical Issues</div><div class="kpi-value red" id="kpi-critical">—</div><div class="kpi-sub" id="kpi-critical-sub"> </div><div class="kpi-bg-num" id="kpi-critical-bg">—</div></div>
          <div class="kpi-card orange"><div class="kpi-label">Open Issues</div><div class="kpi-value orange" id="kpi-open">—</div><div class="kpi-sub" id="kpi-open-sub"> </div><div class="kpi-bg-num" id="kpi-open-bg">—</div></div>
          <div class="kpi-card green"><div class="kpi-label">Team Health</div><div class="kpi-value green" id="kpi-health">—</div><div class="kpi-sub"><b>/ 10</b> AI score</div><div class="kpi-bg-num" id="kpi-health-bg">—</div></div>
          <div class="kpi-card accent"><div class="kpi-label">Resolved</div><div class="kpi-value accent" id="kpi-resolved">—</div><div class="kpi-sub" id="kpi-resolved-sub"> </div><div class="kpi-bg-num" id="kpi-resolved-bg">—</div></div>
        </div>

        <!-- AI status bar -->
        <div class="ai-status-bar hidden" id="ai-status">
          <div class="pulse"></div>
          <span class="ai-status-text" id="ai-status-text">Processing…</span>
          <div class="prog-bar"><div class="prog-fill" id="prog-fill"></div></div>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--text2)" id="ai-counter"></span>
        </div>

        <!-- Charts row -->
        <div class="charts-row">
          <div class="chart-card">
            <div class="chart-title">By Category <span style="color:var(--text3);font-weight:400;font-size:10px">AI Classified</span></div>
            <div class="bar-chart" id="cat-chart"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">Severity Split</div>
            <div class="donut-wrap">
              <svg class="donut" id="donut-svg" viewBox="0 0 110 110"></svg>
              <div class="donut-legend" id="donut-legend"></div>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-title">Issues by Project</div>
            <div class="bar-chart" id="proj-chart"></div>
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px">Quick actions</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px" id="btn-classify">🤖 Classify all</button>
                <button class="btn btn-primary"   style="font-size:11px;padding:5px 12px" data-go="analysis">✦ Run Analysis</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════ ISSUES ══════════════════ -->
      <div id="tab-issues" class="active">
        <div class="table-card">
          <div class="table-header">
            <div class="table-title">All Issues</div>
            <div class="filter-pills" id="filter-pills">
              <div class="pill active" data-filter="all">All</div>
              <div class="pill" data-filter="open">Open</div>
              <div class="pill" data-filter="critical">Critical</div>
              <div class="pill" data-filter="resolved">Resolved</div>
            </div>
            <!-- project filter pills injected by JS -->
            <div class="filter-pills" id="proj-pills" style="margin-left:8px"></div>
            <div style="margin-left:auto;display:flex;gap:8px">
              <button class="btn btn-secondary" style="font-size:11px;padding:5px 10px" id="btn-export">⬇ Export CSV</button>
              <button class="btn btn-primary"   style="font-size:11px;padding:5px 10px" id="btn-add-issue2">+ Add</button>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th style="width:36px">#</th>
                  <th>Issue Title</th>
                  <th>Project</th>
                  <th>Reporter</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Root Cause (AI)</th>
                  <th>Status</th>
                  <th style="width:60px"></th>
                </tr>
              </thead>
              <tbody id="issues-tbody">
                <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text3)">Loading…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ══════════════════ INGEST ══════════════════ -->
      <div id="tab-ingest">
        <div class="ingest-grid">
          <div class="ingest-card">
            <div class="ingest-icon">💬</div>
            <div class="ingest-title">MS Teams Channel</div>
            <div class="ingest-desc">Pull messages from a Teams channel via Microsoft Graph API. In production, configure your TEAMS_TENANT_ID in .env — uses mock data automatically when not set.</div>
            <div class="ingest-meta">Status: mock mode active<br/>Set TEAMS_* env vars to enable live sync</div>
            <button class="btn btn-primary" id="btn-teams-ingest">↓ Ingest Mock Data</button>
          </div>
          <div class="ingest-card">
            <div class="ingest-icon">📊</div>
            <div class="ingest-title">CSV / Spreadsheet</div>
            <div class="ingest-desc">Upload any CSV with columns: title, description, reporter, project, severity, status. Extra columns are safely ignored.</div>
            <div class="ingest-meta">Accepted: .csv · Max 10 MB<br/>Download template to get started</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label class="btn btn-primary" style="cursor:pointer">📂 Upload CSV<input type="file" id="csv-upload" accept=".csv" style="display:none"/></label>
              <a class="btn btn-secondary" href="/api/issues/export-csv" download>⬇ Template</a>
            </div>
          </div>
          <div class="ingest-card">
            <div class="ingest-icon">⌨️</div>
            <div class="ingest-title">Manual Entry</div>
            <div class="ingest-desc">Quickly log a single issue — useful for standup blockers or ad-hoc reports not formally tracked yet.</div>
            <div class="ingest-meta">Immediate · No setup required<br/>Source tagged as "manual"</div>
            <button class="btn btn-secondary" id="btn-open-form">+ Open Form</button>
          </div>
        </div>

        <!-- Manual form -->
        <div class="manual-form" id="manual-form-section">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:16px">Log a New Issue</div>
          <form id="issue-form">
            <div class="form-grid">
              <div class="form-group form-full">
                <label for="f-title">Issue Title *</label>
                <input id="f-title" name="title" placeholder="e.g. Prod deployment rollback failed after hotfix" required/>
              </div>
              <div class="form-group form-full">
                <label for="f-desc">Description</label>
                <textarea id="f-desc" name="description" placeholder="Steps to reproduce, business impact, links to logs…"></textarea>
              </div>
              <div class="form-group">
                <label for="f-reporter">Reporter</label>
                <input id="f-reporter" name="reporter" placeholder="Your name"/>
              </div>
              <div class="form-group">
                <label for="f-project">Project</label>
                <select id="f-project" name="project">
                  <option>Phoenix</option><option>Atlas</option><option>Horizon</option><option>General</option>
                </select>
              </div>
              <div class="form-group">
                <label for="f-severity">Severity</label>
                <select id="f-severity" name="severity">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div class="form-group">
                <label for="f-category">Category</label>
                <select id="f-category" name="category">
                  <option value="">— select —</option>
                  <option>technical</option><option>process</option><option>security</option>
                  <option>quality</option><option>environment</option><option>other</option>
                </select>
              </div>
              <div class="form-group form-full">
                <label for="f-root">Root Cause (optional)</label>
                <input id="f-root" name="root_cause" placeholder="Your hypothesis on why this happened"/>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;align-items:center">
              <button type="submit" class="btn btn-primary">Save Issue</button>
              <button type="button" class="btn btn-secondary" id="btn-form-reset">Clear</button>
              <span id="form-status" style="font-size:12px;color:var(--text3)"></span>
            </div>
          </form>
        </div>
      </div>

      <!-- ══════════════════ ANALYSIS ══════════════════ -->
      <div id="tab-analysis">
        <div class="analysis-top">
          <div class="analysis-summary">
            <h2 id="analysis-title">AI Analysis</h2>
            <p id="analysis-summary-text" style="color:var(--text2)">Click <strong>Run Analysis</strong> to generate insights from your current issue data. The analysis looks at severity distribution, recurring categories, and team health score.</p>
            <div style="display:flex;gap:24px;margin-top:16px;flex-wrap:wrap" id="analysis-metrics"></div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button class="btn btn-primary" id="btn-run-analysis">✦ Run Analysis</button>
              <button class="btn btn-secondary" data-go="document">📄 Generate Report</button>
            </div>
          </div>
          <div class="health-ring">
            <div class="health-score" id="health-score">—</div>
            <div class="health-label">Team Health</div>
          </div>
        </div>

        <div class="analysis-grid" id="analysis-grid" style="display:none">
          <div class="analysis-card">
            <h3>Issues by Category</h3>
            <div id="analysis-cats"></div>
          </div>
          <div class="analysis-card">
            <h3>Open Issues by Project</h3>
            <div id="analysis-projs"></div>
          </div>
        </div>

        <div class="analysis-card" id="analysis-reco-card" style="display:none">
          <h3>Recommendations</h3>
          <div class="reco-grid" id="reco-grid"></div>
        </div>
      </div>

      <!-- ══════════════════ PATTERNS ══════════════════ -->
      <div id="tab-patterns">
        <div style="display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid var(--border);padding-bottom:14px">
          <button class="pill active" data-psub="velocity">Velocity Trend</button>
          <button class="pill" data-psub="composition">Issue Composition</button>
          <button class="pill" data-psub="table">Sprint Table</button>
          <div style="margin-left:auto">
            <select id="pattern-project-select" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:5px 10px;color:var(--text);font-size:12px;outline:none">
              <option value="Phoenix">Phoenix</option>
              <option value="Atlas">Atlas</option>
            </select>
          </div>
        </div>

        <!-- Velocity sub-panel -->
        <div id="psub-velocity" class="psub active">
          <div class="chart-card" style="margin-bottom:14px">
            <div class="chart-title">Velocity Score — Sprint over Sprint</div>
            <div id="velocity-chart-wrap" style="position:relative;height:140px"></div>
            <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:var(--text3)">
              <span>● Green ≥ 7 (healthy)</span><span>● Yellow 4–6 (watch)</span><span>● Red &lt; 4 (at risk)</span>
            </div>
          </div>
          <div class="kpi-grid" id="pattern-kpis"></div>
        </div>

        <!-- Composition sub-panel -->
        <div id="psub-composition" class="psub hidden">
          <div class="chart-card">
            <div class="chart-title">Issue Composition — Critical + High per Sprint</div>
            <div id="composition-chart-wrap" style="position:relative;height:160px"></div>
          </div>
        </div>

        <!-- Sprint Table sub-panel -->
        <div id="psub-table" class="psub hidden">
          <div class="table-card">
            <div style="overflow-x:auto">
              <table>
                <thead>
                  <tr><th>Sprint</th><th>Total</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Resolved</th><th>Top Category</th><th>Velocity</th></tr>
                </thead>
                <tbody id="sprint-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════ DOCUMENT ══════════════════ -->
      <div id="tab-document">
        <div class="doc-toolbar">
          <span style="font-family:var(--font-display);font-weight:700" id="doc-filename">issueai-report.md</span>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3)" id="doc-meta">Generated from live data</span>
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="btn btn-secondary" style="font-size:11px" id="btn-copy-report">📋 Copy</button>
            <a class="btn btn-primary" style="font-size:11px;text-decoration:none" id="btn-download-report" href="/api/report" download>⬇ Download .md</a>
          </div>
        </div>
        <div class="doc-body" id="doc-body">
          <div style="color:var(--text3);text-align:center;padding:40px">
            Click <strong style="color:var(--text)">⬇ Download .md</strong> to generate and download the live report,<br/>
            or click <strong style="color:var(--text)">📋 Copy</strong> to copy the Markdown to your clipboard.
          </div>
        </div>
      </div>

    </div><!-- /tab-panels -->
  </div>
</div>

<script>
/* ── IssueAI Frontend ──────────────────────────────────────────────────── */
'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  issues: [],
  stats: {},
  sprints: [],
  filter: { sev: 'all', status: 'all', project: 'all' },
  search: '',
  currentTab: 'issues',
};

// ── Avatar colours pool ───────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'linear-gradient(135deg,#6c63ff,#26c6b0)',
  'linear-gradient(135deg,#ff9933,#ff4d4d)',
  'linear-gradient(135deg,#26c6b0,#4d9fff)',
  'linear-gradient(135deg,#4d9fff,#6c63ff)',
  'linear-gradient(135deg,#ff4d4d,#ff9933)',
  'linear-gradient(135deg,#26c6b0,#2ecc8a)',
  'linear-gradient(135deg,#6c63ff,#ff4d4d)',
  'linear-gradient(135deg,#2ecc8a,#4d9fff)',
];
const avatarCache = {};
function avatarColor(name) {
  if (!avatarCache[name]) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    avatarCache[name] = AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }
  return avatarCache[name];
}
function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || \`HTTP \${res.status}\`);
  }
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  const icon = type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ';
  const color = type === 'ok' ? '#2ecc8a' : type === 'err' ? '#ff4d4d' : '#4d9fff';
  el.innerHTML = \`<span style="color:\${color};margin-right:8px;font-weight:700">\${icon}</span>\${msg}\`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(title, html, onSubmit) {
  const overlay = document.getElementById('modal-overlay');
  const modal   = document.getElementById('modal');
  modal.innerHTML = \`
    <div class="modal-title">
      \${title}
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div id="modal-content">\${html}</div>
  \`;
  overlay.classList.remove('hidden');
  if (onSubmit) {
    const form = modal.querySelector('form');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await onSubmit(new FormData(form));
    });
  }
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ── Tab navigation ────────────────────────────────────────────────────────────
const TAB_TITLES = {
  dashboard: 'Dashboard', issues: 'Issues', ingest: 'Ingest Data',
  analysis: 'AI Analysis', patterns: 'Pattern Intelligence', document: 'Documents',
};
function goTab(tab) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  document.querySelectorAll('.tab-panels > div').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.getElementById('page-title').textContent = TAB_TITLES[tab] || tab;
  state.currentTab = tab;
  if (tab === 'dashboard')  renderDashboard();
  if (tab === 'issues')     renderIssuesTable();
  if (tab === 'analysis')   renderAnalysis();
  if (tab === 'patterns')   renderPatterns();
  if (tab === 'document')   renderDocument();
}
document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
  el.addEventListener('click', () => goTab(el.dataset.tab));
});
document.querySelectorAll('[data-go]').forEach(el => {
  el.addEventListener('click', () => goTab(el.dataset.go));
});

// ── Load all data ─────────────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [issues, stats, sprints] = await Promise.all([
      api('GET', '/issues'),
      api('GET', '/stats'),
      api('GET', '/sprints?project=Phoenix'),
    ]);
    state.issues  = issues;
    state.stats   = stats;
    state.sprints = sprints;

    // Update nav badge
    const badge = document.getElementById('nav-badge-issues');
    if (badge) badge.textContent = stats.open || issues.length;

    // Inject project filter pills
    buildProjectPills(stats.byProj || []);

    renderIssuesTable();
    if (state.currentTab === 'dashboard') renderDashboard();
  } catch (e) {
    toast('Failed to load data: ' + e.message, 'err');
  }
}

// ── Project pills ─────────────────────────────────────────────────────────────
function buildProjectPills(byProj) {
  const container = document.getElementById('proj-pills');
  if (!container) return;
  container.innerHTML = byProj.map(p =>
    \`<button class="pill" data-proj="\${p.project}">\${p.project}</button>\`
  ).join('');
  container.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const all = [...document.querySelectorAll('#proj-pills .pill')];
      all.forEach(p => p.classList.remove('active'));
      if (state.filter.project === pill.dataset.proj) {
        state.filter.project = 'all';
      } else {
        state.filter.project = pill.dataset.proj;
        pill.classList.add('active');
      }
      renderIssuesTable();
    });
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const s = state.stats;
  if (!s || !s.total) return;

  // KPIs
  setKPI('kpi-critical', s.critical,  s.critical);
  setKPI('kpi-open',     s.open,      s.open);
  setKPI('kpi-health',   s.health,    s.health);
  setKPI('kpi-resolved', s.resolved,  s.resolved);
  document.getElementById('kpi-open-sub').textContent = \`\${(s.byProj||[]).length} projects\`;
  document.getElementById('kpi-resolved-sub').textContent = \`of \${s.total} total\`;

  // Category bar chart
  const cats = (s.byCat || []).slice(0, 6);
  const maxC = cats[0]?.c || 1;
  const catGrads = {
    technical:   'linear-gradient(90deg,#6c63ff,#8b85ff)',
    process:     'linear-gradient(90deg,#ff9933,#ffb84d)',
    security:    'linear-gradient(90deg,#ff4d4d,#ff7a7a)',
    environment: 'linear-gradient(90deg,#26c6b0,#4de0ce)',
    quality:     'linear-gradient(90deg,#4d9fff,#7ab8ff)',
  };
  document.getElementById('cat-chart').innerHTML = cats.map(c => \`
    <div class="bar-row">
      <div class="bar-label">\${c.category || 'other'}</div>
      <div class="bar-track"><div class="bar-fill" style="width:\${Math.round((c.c/maxC)*90+10)}%;background:\${catGrads[c.category]||'var(--bg4)'};">\${c.c}</div></div>
      <div class="bar-num">\${c.c}</div>
    </div>\`).join('');

  // Donut
  renderDonut(s.bySev || []);

  // Project bar chart
  const projs = (s.byProj || []).slice(0, 5);
  const maxP = projs[0]?.c || 1;
  const projGrads = [
    'linear-gradient(90deg,#6c63ff,#8b85ff)',
    'linear-gradient(90deg,#26c6b0,#4de0ce)',
    'linear-gradient(90deg,#ff9933,#ffb84d)',
    'linear-gradient(90deg,#4d9fff,#7ab8ff)',
    'linear-gradient(90deg,#2ecc8a,#4de0ce)',
  ];
  document.getElementById('proj-chart').innerHTML = projs.map((p, i) => \`
    <div class="bar-row">
      <div class="bar-label">\${p.project}</div>
      <div class="bar-track"><div class="bar-fill" style="width:\${Math.round((p.c/maxP)*85+10)}%;background:\${projGrads[i%projGrads.length]};">\${p.c}</div></div>
      <div class="bar-num">\${p.c}</div>
    </div>\`).join('');
}

function setKPI(id, val, bgVal) {
  const el = document.getElementById(id);
  const bg = document.getElementById(id + '-bg');
  if (el) el.textContent = val;
  if (bg) bg.textContent = bgVal;
}

function renderDonut(bySev) {
  const SEV = [
    { key: 'critical', color: '#ff4d4d', label: 'Critical' },
    { key: 'high',     color: '#ff9933', label: 'High' },
    { key: 'medium',   color: '#4d9fff', label: 'Medium' },
    { key: 'low',      color: '#2ecc8a', label: 'Low' },
  ];
  const map = {};
  bySev.forEach(s => { map[s.severity] = s.c; });
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
  const C = 2 * Math.PI * 40; // circumference

  let offset = 0;
  const segments = SEV.map(s => {
    const count = map[s.key] || 0;
    const dash  = (count / total) * C;
    const seg   = { ...s, count, dash, offset };
    offset += dash;
    return seg;
  });

  const svg = document.getElementById('donut-svg');
  svg.innerHTML = \`<circle cx="55" cy="55" r="40" fill="none" stroke="#1a1e28" stroke-width="18"/>\` +
    segments.map(s => s.count ? \`<circle cx="55" cy="55" r="40" fill="none" stroke="\${s.color}" stroke-width="18" stroke-dasharray="\${s.dash.toFixed(1)} \${(C - s.dash).toFixed(1)}" stroke-dashoffset="\${(-s.offset).toFixed(1)}" transform="rotate(-90 55 55)"/>\` : '').join('') +
    \`<text x="55" y="50" text-anchor="middle" fill="#e8eaf0" font-size="14" font-family="Syne,sans-serif" font-weight="800">\${total}</text>
     <text x="55" y="63" text-anchor="middle" fill="#555e78" font-size="9">issues</text>\`;

  document.getElementById('donut-legend').innerHTML = SEV.map(s => \`
    <div class="legend-row">
      <div class="legend-dot" style="background:\${s.color}"></div>
      \${s.label}
      <div class="legend-val">\${map[s.key] || 0}</div>
    </div>\`).join('');
}

// ── Issues table ──────────────────────────────────────────────────────────────
function sevClass(s) {
  return { critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low' }[s] || 'sev-low';
}
function statusColor(s) {
  return { open: 'var(--red)', resolved: 'var(--green)', 'in review': 'var(--yellow)' }[s] || 'var(--text3)';
}

function filteredIssues() {
  const { sev, status, project } = state.filter;
  const search = state.search.toLowerCase();
  return state.issues.filter(i => {
    if (sev !== 'all' && i.severity !== sev) return false;
    if (status !== 'all' && i.status !== status) return false;
    if (project !== 'all' && i.project.toLowerCase() !== project.toLowerCase()) return false;
    if (search && !\`\${i.title} \${i.reporter} \${i.project} \${i.description}\`.toLowerCase().includes(search)) return false;
    return true;
  });
}

function renderIssuesTable() {
  const tbody  = document.getElementById('issues-tbody');
  const issues = filteredIssues();

  if (!issues.length) {
    tbody.innerHTML = \`<tr><td colspan="9"><div class="empty-state"><big>◈</big>No issues match your filters</div></td></tr>\`;
    return;
  }

  tbody.innerHTML = issues.map((iss, idx) => \`
    <tr data-id="\${iss.id}">
      <td style="color:var(--text3);font-family:var(--font-mono);font-size:11px">\${String(idx + 1).padStart(2, '0')}</td>
      <td style="max-width:280px">
        <span style="font-weight:500;cursor:pointer;color:var(--text)" onclick="editIssue('\${iss.id}')">\${esc(iss.title)}</span>
        \${iss.source === 'teams' ? '<span style="font-size:9px;color:var(--text3);margin-left:6px;font-family:var(--font-mono)">TEAMS</span>' : ''}
        \${iss.source === 'csv'   ? '<span style="font-size:9px;color:var(--text3);margin-left:6px;font-family:var(--font-mono)">CSV</span>' : ''}
      </td>
      <td style="color:var(--accent2)">\${esc(iss.project)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div class="r-avatar" style="background:\${avatarColor(iss.reporter)}">\${initials(iss.reporter)}</div>
          <span style="color:var(--text2);font-size:12px">\${esc(iss.reporter)}</span>
        </div>
      </td>
      <td><span class="sev-badge \${sevClass(iss.severity)}">● \${iss.severity}</span></td>
      <td>\${iss.category ? \`<span class="cat-tag">\${esc(iss.category)}</span>\` : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:11px;color:var(--text2);max-width:200px">\${esc(iss.root_cause) || '<span style="color:var(--text3)">—</span>'}</td>
      <td>
        <span class="status-dot" style="background:\${statusColor(iss.status)}"></span>
        <span style="color:var(--text2);font-size:12px">\${iss.status}</span>
      </td>
      <td>
        <div style="display:flex;gap:4px">
          \${iss.status !== 'resolved'
            ? \`<button class="action-btn resolve" onclick="resolveIssue('\${iss.id}')">✓</button>\`
            : \`<button class="action-btn" onclick="reopenIssue('\${iss.id}')">↺</button>\`}
          <button class="action-btn delete" onclick="deleteIssue('\${iss.id}')">✕</button>
        </div>
      </td>
    </tr>\`).join('');
}

// ── Filter pills ──────────────────────────────────────────────────────────────
document.getElementById('filter-pills').addEventListener('click', e => {
  const pill = e.target.closest('[data-filter]');
  if (!pill) return;
  document.querySelectorAll('#filter-pills .pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  const f = pill.dataset.filter;
  if (f === 'all')      { state.filter.sev = 'all'; state.filter.status = 'all'; }
  else if (f === 'open')     { state.filter.status = 'open'; state.filter.sev = 'all'; }
  else if (f === 'resolved') { state.filter.status = 'resolved'; state.filter.sev = 'all'; }
  else if (f === 'critical') { state.filter.sev = 'critical'; state.filter.status = 'all'; }
  renderIssuesTable();
});

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('global-search').addEventListener('input', e => {
  state.search = e.target.value;
  if (state.currentTab === 'issues') renderIssuesTable();
});

// ── Issue actions ─────────────────────────────────────────────────────────────
async function resolveIssue(id) {
  try {
    await api('PATCH', \`/issues/\${id}\`, { status: 'resolved' });
    const i = state.issues.find(x => x.id === id);
    if (i) i.status = 'resolved';
    renderIssuesTable();
    await refreshStats();
    toast('Issue marked resolved');
  } catch (e) { toast(e.message, 'err'); }
}

async function reopenIssue(id) {
  try {
    await api('PATCH', \`/issues/\${id}\`, { status: 'open' });
    const i = state.issues.find(x => x.id === id);
    if (i) i.status = 'open';
    renderIssuesTable();
    await refreshStats();
    toast('Issue reopened');
  } catch (e) { toast(e.message, 'err'); }
}

async function deleteIssue(id) {
  if (!confirm('Delete this issue? This cannot be undone.')) return;
  try {
    await api('DELETE', \`/issues/\${id}\`);
    state.issues = state.issues.filter(x => x.id !== id);
    renderIssuesTable();
    await refreshStats();
    toast('Issue deleted');
  } catch (e) { toast(e.message, 'err'); }
}

function editIssue(id) {
  const iss = state.issues.find(x => x.id === id);
  if (!iss) return;
  openModal('Edit Issue', \`
    <form id="edit-form">
      <div class="form-grid">
        <div class="form-group form-full"><label>Title</label><input name="title" value="\${esc(iss.title)}" required/></div>
        <div class="form-group form-full"><label>Description</label><textarea name="description">\${esc(iss.description)}</textarea></div>
        <div class="form-group"><label>Reporter</label><input name="reporter" value="\${esc(iss.reporter)}"/></div>
        <div class="form-group"><label>Project</label>
          <select name="project">\${['Phoenix','Atlas','Horizon','General'].map(p => \`<option \${p===iss.project?'selected':''}>\${p}</option>\`).join('')}</select>
        </div>
        <div class="form-group"><label>Severity</label>
          <select name="severity">\${['critical','high','medium','low'].map(s => \`<option \${s===iss.severity?'selected':''}>\${s}</option>\`).join('')}</select>
        </div>
        <div class="form-group"><label>Status</label>
          <select name="status">\${['open','in review','resolved','wontfix'].map(s => \`<option \${s===iss.status?'selected':''}>\${s}</option>\`).join('')}</select>
        </div>
        <div class="form-group"><label>Category</label>
          <select name="category">\${['','technical','process','security','quality','environment','other'].map(c => \`<option \${c===iss.category?'selected':''}>\${c}</option>\`).join('')}</select>
        </div>
        <div class="form-group form-full"><label>Root Cause</label><input name="root_cause" value="\${esc(iss.root_cause)}"/></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  \`);
  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try {
      const updated = await api('PATCH', \`/issues/\${id}\`, data);
      const idx = state.issues.findIndex(x => x.id === id);
      if (idx >= 0) state.issues[idx] = updated;
      renderIssuesTable();
      await refreshStats();
      closeModal();
      toast('Issue updated');
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ── Add Issue form ────────────────────────────────────────────────────────────
function bindAddIssueBtn(btnId) {
  document.getElementById(btnId)?.addEventListener('click', () => {
    goTab('ingest');
    setTimeout(() => {
      document.getElementById('manual-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  });
}
bindAddIssueBtn('btn-add-issue');
bindAddIssueBtn('btn-add-issue2');

document.getElementById('btn-open-form')?.addEventListener('click', () => {
  document.getElementById('manual-form-section')?.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('issue-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd     = new FormData(e.target);
  const data   = Object.fromEntries(fd);
  const status = document.getElementById('form-status');
  try {
    status.textContent = 'Saving…';
    const issue = await api('POST', '/issues', data);
    state.issues.unshift(issue);
    await refreshStats();
    e.target.reset();
    status.textContent = '';
    toast('Issue saved successfully');
  } catch (err) {
    status.textContent = err.message;
    toast(err.message, 'err');
  }
});

document.getElementById('btn-form-reset')?.addEventListener('click', () => {
  document.getElementById('issue-form')?.reset();
  document.getElementById('form-status').textContent = '';
});

// ── CSV Upload ────────────────────────────────────────────────────────────────
document.getElementById('csv-upload')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  toast('Uploading CSV…', 'info');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const result = await fetch('/api/issues/import-csv', { method: 'POST', body: fd });
    if (!result.ok) throw new Error('Upload failed');
    const data = await result.json();
    state.issues = [...data.issues, ...state.issues];
    await refreshStats();
    toast(\`Imported \${data.imported} issues from CSV\`);
  } catch (err) { toast(err.message, 'err'); }
  e.target.value = '';
});

// ── Export CSV ────────────────────────────────────────────────────────────────
document.getElementById('btn-export')?.addEventListener('click', () => {
  const url = new URL('/api/issues/export-csv', location.href);
  const { sev, status, project } = state.filter;
  if (sev !== 'all')     url.searchParams.set('severity', sev);
  if (status !== 'all')  url.searchParams.set('status', status);
  if (project !== 'all') url.searchParams.set('project', project);
  if (state.search)      url.searchParams.set('search', state.search);
  const a = document.createElement('a');
  a.href = url.toString();
  a.download = 'issues.csv';
  a.click();
  toast('CSV download started');
});

// ── Teams mock ingest ─────────────────────────────────────────────────────────
document.getElementById('btn-teams-ingest')?.addEventListener('click', async () => {
  const mockIssues = [
    { title: 'Teams: Deployment pipeline failing on feature branch merges', reporter: 'Shreya Iyer', project: 'Phoenix', severity: 'high', category: 'technical', description: 'Raised in #phoenix-dev. Pipeline fails silently on merge.' },
    { title: 'Teams: Redis cache eviction causing session drops', reporter: 'Manish Kapoor', project: 'Atlas', severity: 'high', category: 'technical', description: 'Cache eviction policy too aggressive under load.' },
    { title: 'Teams: Sprint planning meeting not reflected in backlog', reporter: 'Ananya Roy', project: 'Horizon', severity: 'medium', category: 'process', description: 'Jira not updated after sprint planning on Monday.' },
  ];
  try {
    const btn = document.getElementById('btn-teams-ingest');
    btn.disabled = true; btn.textContent = 'Syncing…';
    for (const iss of mockIssues) {
      const created = await api('POST', '/issues', { ...iss, source: 'teams', status: 'open' });
      state.issues.unshift(created);
    }
    await refreshStats();
    toast(\`Ingested \${mockIssues.length} issues from Teams\`);
  } catch (e) { toast(e.message, 'err'); }
  const btn = document.getElementById('btn-teams-ingest');
  if (btn) { btn.disabled = false; btn.textContent = '↓ Ingest Mock Data'; }
});

// ── AI Classify simulation ────────────────────────────────────────────────────
const AI_STEPS = [
  'Connecting to AI engine…',
  'Reading issue titles and descriptions…',
  'Assigning category tags…',
  'Evaluating severity scores…',
  'Generating root cause hypotheses…',
  'Computing team health score…',
  'Analysis complete ✓',
];

document.getElementById('btn-classify')?.addEventListener('click', () => {
  runAIAnimation(() => {
    toast('Classification complete — all issues categorised');
    renderDashboard();
  });
});

document.getElementById('btn-run-analysis')?.addEventListener('click', () => {
  runAIAnimation(() => {
    toast('Analysis complete');
    renderAnalysis();
  });
});

function runAIAnimation(onDone) {
  const bar     = document.getElementById('ai-status');
  const fill    = document.getElementById('prog-fill');
  const text    = document.getElementById('ai-status-text');
  const counter = document.getElementById('ai-counter');
  const total   = state.issues.length || 18;

  bar.classList.remove('hidden');
  goTab('dashboard');

  let step = 0;
  const tick = () => {
    if (step >= AI_STEPS.length) {
      setTimeout(() => bar.classList.add('hidden'), 1000);
      onDone && onDone();
      return;
    }
    text.textContent    = AI_STEPS[step];
    fill.style.width    = \`\${Math.round((step / (AI_STEPS.length - 1)) * 100)}%\`;
    counter.textContent = \`\${Math.min(total, Math.round((step / AI_STEPS.length) * total))} / \${total}\`;
    step++;
    setTimeout(tick, 550 + Math.random() * 300);
  };
  tick();
}

// ── Analysis tab ──────────────────────────────────────────────────────────────
function renderAnalysis() {
  const s = state.stats;
  if (!s.total) { loadAll(); return; }

  document.getElementById('health-score').textContent = s.health;
  document.getElementById('analysis-title').textContent = 'AI Analysis · Sprint 14';
  document.getElementById('analysis-summary-text').innerHTML =
    \`Analysed <strong>\${s.total}</strong> issues across <strong>\${(s.byProj||[]).length}</strong> project(s). \` +
    \`Currently <strong style="color:var(--red)">\${s.critical} critical</strong> and \` +
    \`<strong style="color:var(--orange)">\${(s.bySev||[]).find(x=>x.severity==='high')?.c||0} high</strong> severity issues are open. \` +
    \`Team health score is <strong style="color:\${parseFloat(s.health) >= 7 ? 'var(--green)' : parseFloat(s.health) >= 4 ? 'var(--yellow)' : 'var(--red)'}">\` +
    \`\${s.health}/10</strong> based on issue density and severity distribution.\`;

  // Metrics row
  document.getElementById('analysis-metrics').innerHTML = [
    { label: 'total', val: s.total, color: 'var(--text)' },
    { label: 'open', val: s.open, color: 'var(--orange)' },
    { label: 'critical', val: s.critical, color: 'var(--red)' },
    { label: 'resolved', val: s.resolved, color: 'var(--green)' },
  ].map(m => \`
    <div>
      <div style="font-size:28px;font-weight:800;font-family:var(--font-display);color:\${m.color}">\${m.val}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-top:2px">\${m.label}</div>
    </div>\`).join('');

  // Grid
  const grid = document.getElementById('analysis-grid');
  grid.style.display = 'grid';

  const cats = (s.byCat || []).slice(0, 5);
  const maxC = cats[0]?.c || 1;
  const catGrads = {
    technical:'linear-gradient(90deg,#6c63ff,#8b85ff)',process:'linear-gradient(90deg,#ff9933,#ffb84d)',
    security:'linear-gradient(90deg,#ff4d4d,#ff7a7a)',quality:'linear-gradient(90deg,#4d9fff,#7ab8ff)',
    environment:'linear-gradient(90deg,#26c6b0,#4de0ce)',
  };
  document.getElementById('analysis-cats').innerHTML = cats.map(c => \`
    <div class="pattern-item" style="border-left-color:\${catGrads[c.category]?.split(',')[1]?.split(')')[0]||'var(--accent)'}">
      <div class="pattern-title">\${c.category || 'other'}</div>
      <div class="pattern-sub">\${c.c} issue\${c.c !== 1 ? 's' : ''}</div>
      <div style="margin-top:6px;background:var(--bg4);border-radius:3px;height:4px;overflow:hidden">
        <div style="height:100%;width:\${Math.round((c.c/maxC)*100)}%;background:\${catGrads[c.category]||'var(--accent)'};border-radius:3px"></div>
      </div>
    </div>\`).join('');

  const projs = (s.byProj || []);
  const maxP  = projs[0]?.c || 1;
  document.getElementById('analysis-projs').innerHTML = projs.map(p => \`
    <div class="pattern-item">
      <div class="pattern-title">\${p.project}</div>
      <div class="pattern-sub">\${p.c} total issues</div>
      <div style="margin-top:6px;background:var(--bg4);border-radius:3px;height:4px;overflow:hidden">
        <div style="height:100%;width:\${Math.round((p.c/maxP)*100)}%;background:var(--accent);border-radius:3px"></div>
      </div>
    </div>\`).join('');

  // Recommendations
  const recos = buildRecommendations(s);
  const recoCard = document.getElementById('analysis-reco-card');
  recoCard.style.display = 'block';
  document.getElementById('reco-grid').innerHTML = recos.map(r => \`
    <div class="reco-card" style="border-top:2px solid \${r.color}">
      <div class="reco-prio" style="color:\${r.color}">\${r.priority}</div>
      <div class="reco-action">\${r.action}</div>
      <div class="reco-rationale">\${r.rationale}</div>
    </div>\`).join('');
}

function buildRecommendations(s) {
  const recs = [];
  if (s.critical > 0) recs.push({ priority: 'Immediate', color: 'var(--red)',
    action: \`Resolve \${s.critical} critical issue\${s.critical > 1 ? 's' : ''}\`,
    rationale: \`\${s.critical} critical issue\${s.critical > 1 ? 's are' : ' is'} blocking safe release. Patch before next deployment.\` });

  const secCount = (s.byCat||[]).find(c => c.category === 'security')?.c || 0;
  if (secCount > 0) recs.push({ priority: 'Short term', color: 'var(--orange)',
    action: 'Add SAST scanning to CI pipeline',
    rationale: \`\${secCount} security issue\${secCount > 1 ? 's' : ''} detected. Automated scanning would catch these before merge.\` });

  const procCount = (s.byCat||[]).find(c => c.category === 'process')?.c || 0;
  if (procCount > 1) recs.push({ priority: 'Short term', color: 'var(--orange)',
    action: 'Introduce PR review SLA and CODEOWNERS',
    rationale: \`\${procCount} process issues indicate review bottlenecks. A 24h SLA and auto-assignment will unblock velocity.\` });

  if (recs.length < 3) recs.push({ priority: 'Long term', color: 'var(--green)',
    action: 'Establish sprint retrospective cadence',
    rationale: 'Regular retrospectives prevent issues from becoming entrenched patterns across sprints.' });

  return recs.slice(0, 3);
}

// ── Patterns tab ──────────────────────────────────────────────────────────────
function renderPatterns() {
  renderVelocityChart();
  renderSprintTable();
  renderCompositionChart();
}

// Sub-tab nav
document.querySelectorAll('[data-psub]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-psub]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.psub').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
    const panel = document.getElementById('psub-' + btn.dataset.psub);
    if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }
  });
});

document.getElementById('pattern-project-select')?.addEventListener('change', async (e) => {
  const sprints = await api('GET', \`/sprints?project=\${e.target.value}\`);
  state.sprints = sprints;
  renderVelocityChart();
  renderSprintTable();
  renderCompositionChart();
});

function renderVelocityChart() {
  const sprints = state.sprints;
  const wrap    = document.getElementById('velocity-chart-wrap');
  if (!wrap || !sprints.length) return;

  const maxV = 10;
  wrap.innerHTML = \`<div class="vel-bar-wrap" style="height:120px">\${
    sprints.map(s => {
      const pct   = (s.velocity_score / maxV) * 100;
      const color = s.velocity_score >= 7 ? 'var(--green)' : s.velocity_score >= 4 ? 'var(--yellow)' : 'var(--red)';
      return \`
        <div class="vel-bar-col">
          <div class="vel-bar-val" style="color:\${color}">\${s.velocity_score}</div>
          <div class="vel-bar-fill" style="height:\${pct}%;background:\${color};width:100%;border-radius:4px 4px 0 0;min-height:4px"></div>
          <div class="vel-bar-label">\${s.sprint_label.replace('Sprint ', 'S')}</div>
        </div>\`;
    }).join('')
  }</div>\`;

  // KPIs below
  const last = sprints[sprints.length - 1] || {};
  const prev = sprints[sprints.length - 2] || {};
  const trend = last.velocity_score > (prev.velocity_score || 0) ? '↑' : last.velocity_score < (prev.velocity_score || 0) ? '↓' : '→';
  const trendColor = trend === '↑' ? 'var(--green)' : trend === '↓' ? 'var(--red)' : 'var(--text3)';
  document.getElementById('pattern-kpis').innerHTML = \`
    <div class="kpi-card green"><div class="kpi-label">Latest Velocity</div><div class="kpi-value green">\${last.velocity_score || '—'}</div><div class="kpi-sub">/ 10 score</div><div class="kpi-bg-num">\${last.velocity_score || ''}</div></div>
    <div class="kpi-card \${trend === '↑' ? 'green' : 'red'}"><div class="kpi-label">Trend</div><div class="kpi-value \${trend === '↑' ? 'green' : 'red'}" style="color:\${trendColor}">\${trend}</div><div class="kpi-sub">vs prev sprint</div></div>
    <div class="kpi-card orange"><div class="kpi-label">Critical (latest)</div><div class="kpi-value orange">\${last.critical || 0}</div><div class="kpi-sub">in \${last.sprint_label || '—'}</div><div class="kpi-bg-num">\${last.critical || 0}</div></div>
    <div class="kpi-card accent"><div class="kpi-label">Sprints Tracked</div><div class="kpi-value accent">\${sprints.length}</div><div class="kpi-sub">\${sprints[0]?.sprint_label || '—'} → now</div></div>
  \`;
}

function renderCompositionChart() {
  const sprints = state.sprints;
  const wrap    = document.getElementById('composition-chart-wrap');
  if (!wrap || !sprints.length) return;

  const maxT = Math.max(...sprints.map(s => s.total_issues)) || 1;
  wrap.innerHTML = \`<div class="comp-bar-wrap" style="height:140px">\${
    sprints.map(s => {
      const ch = Math.round((s.critical / maxT) * 120);
      const hh = Math.round((s.high     / maxT) * 120);
      return \`
        <div class="comp-bar-col">
          <div style="font-size:9px;font-family:var(--font-mono);color:var(--text3)">\${s.total_issues}</div>
          <div class="comp-stacked" style="height:\${Math.round((s.total_issues/maxT)*120)}px;min-height:4px">
            <div style="height:\${ch}px;background:var(--red);min-height:\${s.critical?4:0}px"></div>
            <div style="height:\${hh}px;background:var(--orange);min-height:\${s.high?4:0}px"></div>
            <div style="flex:1;background:var(--blue);opacity:.5"></div>
          </div>
          <div class="vel-bar-label">\${s.sprint_label.replace('Sprint ', 'S')}</div>
        </div>\`;
    }).join('')
  }</div>
  <div style="display:flex;gap:14px;margin-top:8px;font-size:10px;color:var(--text3)">
    <span><span style="color:var(--red)">■</span> Critical</span>
    <span><span style="color:var(--orange)">■</span> High</span>
    <span><span style="color:var(--blue);opacity:.6">■</span> Medium+Low</span>
  </div>\`;
}

function renderSprintTable() {
  const tbody = document.getElementById('sprint-tbody');
  if (!tbody) return;
  const sprints = [...state.sprints].reverse();
  if (!sprints.length) {
    tbody.innerHTML = \`<tr><td colspan="9"><div class="empty-state"><big>◉</big>No sprint data loaded</div></td></tr>\`;
    return;
  }
  const velColor = v => v >= 7 ? 'var(--green)' : v >= 4 ? 'var(--yellow)' : 'var(--red)';
  tbody.innerHTML = sprints.map(s => \`
    <tr>
      <td style="font-family:var(--font-mono);color:var(--accent2)">\${s.sprint_label}</td>
      <td style="font-family:var(--font-mono)">\${s.total_issues}</td>
      <td style="font-family:var(--font-mono);color:\${s.critical > 2 ? 'var(--red)' : 'var(--text)'};font-weight:\${s.critical > 2 ? 700 : 400}">\${s.critical}</td>
      <td style="font-family:var(--font-mono);color:var(--orange)">\${s.high}</td>
      <td style="font-family:var(--font-mono);color:var(--blue)">\${s.medium}</td>
      <td style="font-family:var(--font-mono);color:var(--text2)">\${s.low}</td>
      <td style="font-family:var(--font-mono);color:var(--green)">\${s.resolved}</td>
      <td>\${s.top_category ? \`<span class="cat-tag">\${s.top_category}</span>\` : '—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="width:50px;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
            <div style="width:\${(s.velocity_score/10)*100}%;height:100%;background:\${velColor(s.velocity_score)};border-radius:3px"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:11px;color:\${velColor(s.velocity_score)}">\${s.velocity_score}</span>
        </div>
      </td>
    </tr>\`).join('');
}

// ── Document tab ──────────────────────────────────────────────────────────────
function renderDocument() {
  const s   = state.stats;
  if (!s.total) return;
  const now = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  document.getElementById('doc-filename').textContent = \`issueai-report-\${now.replace(/ /g,'-')}.md\`;
  document.getElementById('doc-meta').textContent = \`Generated \${now} · \${s.total} issues · Live data\`;
  document.getElementById('btn-download-report').href = '/api/report';

  // Render preview in doc-body
  const issues = state.issues.filter(i => i.status === 'open').slice(0, 8);
  document.getElementById('doc-body').innerHTML = \`
    <div class="md-h1">Project Issues Intelligence Report</div>
    <div class="md-p"><strong>Generated:</strong> \${now} &nbsp;|&nbsp; <strong>Projects:</strong> \${(s.byProj||[]).map(p=>p.project).join(', ')} &nbsp;|&nbsp; <strong>Total Issues:</strong> \${s.total}</div>

    <div class="md-h2">1. Executive Summary</div>
    <div class="md-p">This report covers <strong>\${s.total} total issues</strong> across \${(s.byProj||[]).length} project(s). Currently <strong style="color:var(--red)">\${s.open} issues are open</strong> including <strong style="color:var(--red)">\${s.critical} critical</strong> requiring immediate attention. Team health score is <strong>\${s.health}/10</strong>.</div>

    <div class="md-h2">2. Key Metrics</div>
    <table class="md-table">
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Issues</td><td>\${s.total}</td></tr>
      <tr><td>Open</td><td>\${s.open}</td></tr>
      <tr><td>Critical (open)</td><td><span class="md-badge c">\${s.critical}</span></td></tr>
      <tr><td>Resolved</td><td>\${s.resolved}</td></tr>
      <tr><td>Team Health Score</td><td>\${s.health} / 10</td></tr>
    </table>

    <div class="md-h2">3. Top Open Issues</div>
    <table class="md-table">
      <tr><th>#</th><th>Title</th><th>Project</th><th>Severity</th><th>Category</th></tr>
      \${issues.map((i, idx) => \`
        <tr>
          <td>\${idx+1}</td>
          <td>\${esc(i.title)}</td>
          <td>\${esc(i.project)}</td>
          <td><span class="md-badge \${i.severity[0]}">\${i.severity}</span></td>
          <td>\${i.category || '—'}</td>
        </tr>\`).join('')}
    </table>

    <div class="md-h2">4. Recommendations</div>
    <ul class="md-ul">
      \${s.critical > 0 ? \`<li><strong>Immediate:</strong> Resolve \${s.critical} critical issue\${s.critical>1?'s':''} before next release</li>\` : ''}
      <li><strong>Short term:</strong> Add automated security scanning (SAST) to CI pipeline</li>
      <li><strong>Short term:</strong> Enforce PR review SLA and introduce CODEOWNERS</li>
      <li><strong>Long term:</strong> Run retrospectives to prevent issues becoming recurring patterns</li>
    </ul>

    <div style="margin-top:24px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)">
      <em>Report generated by IssueAI · Open Source Project Intelligence · <a href="/api/report" download style="color:var(--accent)">Download full .md</a></em>
    </div>
  \`;
}

// ── Copy report ───────────────────────────────────────────────────────────────
document.getElementById('btn-copy-report')?.addEventListener('click', async () => {
  try {
    const res  = await fetch('/api/report');
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    toast('Report copied to clipboard');
  } catch (e) { toast('Copy failed — try Download instead', 'err'); }
});

// ── Refresh stats ─────────────────────────────────────────────────────────────
async function refreshStats() {
  state.stats = await api('GET', '/stats');
  const badge = document.getElementById('nav-badge-issues');
  if (badge) badge.textContent = state.stats.open || state.issues.length;
  if (state.currentTab === 'dashboard') renderDashboard();
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadAll();
  // Animate bar fills
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(b => {
      const w = b.style.width;
      b.style.width = '0';
      requestAnimationFrame(() => { setTimeout(() => { b.style.width = w; }, 50); });
    });
  }, 200);
})();

</script>
</body>
</html>
`;
