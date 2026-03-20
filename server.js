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

// ── OpenRouter AI helpers ─────────────────────────────────────────────────────
const OPENROUTER_KEY   = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL   || 'mistralai/mistral-7b-instruct:free';

async function callAI(systemPrompt, userPrompt) {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://issueai.app',
      'X-Title':       'IssueAI',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function safeParseJSON(text) {
  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g,'').trim();
  return JSON.parse(clean);
}

// ── POST /api/ai/classify — classify all untagged issues ──────────────────────
app.post('/api/ai/classify', async (req, res) => {
  const issues = db.list({}).filter(i => !i.category || !i.root_cause);
  if (!issues.length) return res.json({ updated: 0, message: 'All issues already classified' });

  const SYSTEM = `You are a software engineering analyst. Classify each issue and return ONLY a valid JSON array. No markdown, no explanation.`;
  const issueList = issues.map((i,n) =>
    `${n+1}. [${i.severity}] ${i.title} — ${i.description||i.title} (Project: ${i.project}, Reporter: ${i.reporter})`
  ).join('\n');

  const USER = `Classify these ${issues.length} software project issues. Return a JSON array with one object per issue in this exact format:
[
  {
    "index": 1,
    "category": "one of: technical|process|security|quality|environment|communication|other",
    "severity": "one of: critical|high|medium|low",
    "root_cause": "concise 1 sentence root cause hypothesis"
  }
]

Issues:
${issueList}`;

  try {
    const text   = await callAI(SYSTEM, USER);
    const parsed = safeParseJSON(text);
    let updated  = 0;
    for (const item of parsed) {
      const issue = issues[item.index - 1];
      if (!issue) continue;
      db.update(issue.id, {
        category:   item.category   || issue.category,
        root_cause: item.root_cause || issue.root_cause,
        severity:   item.severity   || issue.severity,
      });
      updated++;
    }
    res.json({ updated, message: `Classified ${updated} issues using AI` });
  } catch(e) {
    console.error('classify error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/ai/analyse — full analysis of all issues ────────────────────────
app.post('/api/ai/analyse', async (req, res) => {
  const issues = db.list({});
  const stats  = db.stats();
  if (!issues.length) return res.status(400).json({ error: 'No issues to analyse' });

  const SYSTEM = `You are a senior engineering manager analysing project issues. Return ONLY valid JSON, no markdown fences, no explanation.`;

  const issueList = issues.map((i,n) =>
    `${n+1}. [${i.severity?.toUpperCase()}] ${i.title} | Project: ${i.project} | Category: ${i.category||'unknown'} | Reporter: ${i.reporter} | Status: ${i.status}`
  ).join('\n');

  const USER = `Analyse these ${issues.length} project issues and return a JSON object:
{
  "executive_summary": "3-4 sentence summary of the team's current situation",
  "team_health_score": <number 0-10>,
  "team_health_reasoning": "one sentence explanation of the score",
  "top_risks": ["risk 1", "risk 2", "risk 3"],
  "recurring_patterns": [
    { "pattern": "short pattern name", "affected_projects": ["proj"], "count": N, "recommended_action": "specific action" }
  ],
  "root_causes": [
    { "cause": "root cause name", "frequency": "high|medium|low", "description": "one sentence" }
  ],
  "recommendations": [
    { "priority": "immediate|short_term|long_term", "action": "specific action", "rationale": "why this matters" }
  ]
}

Issues:
${issueList}

Stats: Total=${stats.total}, Open=${stats.open}, Critical=${stats.critical}, Resolved=${stats.resolved}`;

  try {
    const text   = await callAI(SYSTEM, USER);
    const parsed = safeParseJSON(text);
    // Cache result in store
    store.last_analysis = { ...parsed, generated_at: new Date().toISOString() };
    saveStore();
    res.json(parsed);
  } catch(e) {
    console.error('analyse error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/ai/report — AI-written full markdown report ─────────────────────
app.post('/api/ai/report', async (req, res) => {
  const issues = db.list({});
  const stats  = db.stats();
  const cached = store.last_analysis;

  const SYSTEM = `You are a technical writer. Generate a professional Markdown report. Use proper Markdown formatting with headers, tables and bullet points.`;

  const issueRows = issues.slice(0,20).map((i,n) =>
    `| ${n+1} | ${i.title} | ${i.project} | ${i.severity} | ${i.category||'—'} | ${i.status} |`
  ).join('\n');

  const analysisCtx = cached
    ? `Previous AI analysis summary: ${cached.executive_summary}\nTeam health: ${cached.team_health_score}/10`
    : `Stats: ${stats.total} total, ${stats.open} open, ${stats.critical} critical, health score ${stats.health}/10`;

  const USER = `Write a complete project issues intelligence report in Markdown.

${analysisCtx}

Projects: ${stats.byProj.map(p=>p.project).join(', ')}
Date: ${new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}

Issue register (top 20):
| # | Title | Project | Severity | Category | Status |
|---|-------|---------|----------|----------|--------|
${issueRows}

Include these sections:
1. Executive Summary
2. Key Metrics (table)
3. Issue Analysis by Category
4. Recurring Patterns & Root Causes
5. Risk Assessment
6. Prioritised Recommendations (Immediate / Short term / Long term)
7. Issue Register
8. Next Steps`;

  try {
    const markdown = await callAI(SYSTEM, USER);
    store.last_report = { content: markdown, generated_at: new Date().toISOString() };
    saveStore();
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="issueai-ai-report.md"');
    res.send(markdown);
  } catch(e) {
    console.error('report error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/ai/status — check if AI is configured ───────────────────────────
app.get('/api/ai/status', (_,res) => {
  res.json({
    configured: !!OPENROUTER_KEY,
    model: OPENROUTER_MODEL,
    last_analysis: store.last_analysis?.generated_at || null,
    last_report:   store.last_report?.generated_at   || null,
  });
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
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>IssueAI — Project Intelligence</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#09090b;--bg2:#111113;--bg3:#18181b;--bg4:#27272a;
  --border:#27272a;--border2:#3f3f46;
  --text:#fafafa;--text2:#a1a1aa;--text3:#52525b;
  --accent:#7c3aed;--accent2:#8b5cf6;--accent3:#ede9fe;
  --red:#ef4444;--red2:#fca5a5;--redbg:#1c0a0a;
  --orange:#f97316;--orangebg:#1c0f0a;
  --green:#22c55e;--green2:#86efac;--greenbg:#0a1c0f;
  --blue:#3b82f6;--bluebg:#0a0f1c;
  --yellow:#eab308;--yellowbg:#1c1a0a;
  --teal:#14b8a6;
  --font-d:'Syne',sans-serif;
  --font-b:'Inter',sans-serif;
  --font-m:'DM Mono',monospace;
  --r:10px;--r-sm:6px;--r-lg:14px;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-b);font-size:14px;min-height:100vh;line-height:1.5}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}

/* ── LAYOUT ── */
.sidebar{position:fixed;left:0;top:0;bottom:0;width:232px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:100}
.main{margin-left:232px;min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}

/* ── SIDEBAR ── */
.logo{padding:20px 18px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
.logo-mark{width:32px;height:32px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;box-shadow:0 0 0 4px rgba(124,58,237,.15)}
.logo-name{font-family:var(--font-d);font-size:15px;font-weight:800;letter-spacing:-.3px}
.logo-tag{font-size:10px;color:var(--text3);margin-top:1px;font-weight:400}
.nav{padding:12px 10px;flex:1;display:flex;flex-direction:column;gap:1px}
.nav-section{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;font-weight:600;padding:10px 8px 5px}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:var(--r-sm);cursor:pointer;transition:all .12s;color:var(--text2);font-size:13px;font-weight:500;position:relative;user-select:none;border:1px solid transparent}
.nav-item:hover{background:var(--bg3);color:var(--text)}
.nav-item.active{background:rgba(124,58,237,.12);color:var(--text);border-color:rgba(124,58,237,.25)}
.nav-item.active .nav-icon{color:var(--accent2)}
.nav-icon{font-size:14px;width:16px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;font-family:var(--font-m);background:var(--red);color:#fff}
.nav-badge.ok{background:var(--greenbg);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.nav-badge.ai{background:rgba(124,58,237,.2);color:var(--accent2);border:1px solid rgba(124,58,237,.3);animation:abadge 2s infinite}
@keyframes abadge{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.4)}50%{box-shadow:0 0 0 3px rgba(124,58,237,0)}}
.sidebar-footer{padding:12px 14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}
.av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--teal));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
.av-name{font-size:12px;font-weight:600}
.av-role{font-size:11px;color:var(--text3)}
.status-online{width:7px;height:7px;border-radius:50%;background:var(--green);margin-left:auto;flex-shrink:0}

/* ── TOPBAR ── */
.topbar{padding:14px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;background:rgba(9,9,11,.8);backdrop-filter:blur(16px);position:sticky;top:0;z-index:50}
.page-title{font-family:var(--font-d);font-size:16px;font-weight:800;letter-spacing:-.3px}
.page-sub{font-size:11px;color:var(--text3);margin-left:2px}
.topbar-right{margin-left:auto;display:flex;gap:8px;align-items:center}
.search-wrap{position:relative}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;pointer-events:none}
.search-bar{background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm);padding:7px 12px 7px 30px;color:var(--text);font-size:12px;outline:none;width:200px;font-family:var(--font-b);transition:border-color .15s;color:var(--text)}
.search-bar::placeholder{color:var(--text3)}
.search-bar:focus{border-color:var(--accent);background:var(--bg2)}

/* ── BUTTONS ── */
.btn{padding:7px 14px;border-radius:var(--r-sm);border:none;cursor:pointer;font-family:var(--font-b);font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:5px;transition:all .12s;white-space:nowrap;line-height:1}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent2)}
.btn-secondary{background:var(--bg3);color:var(--text2);border:1px solid var(--border)}.btn-secondary:hover{background:var(--bg4);color:var(--text)}
.btn-ghost{background:transparent;color:var(--text3);border:1px solid var(--border)}.btn-ghost:hover{color:var(--text);background:var(--bg3)}
.btn-danger{background:var(--redbg);color:var(--red);border:1px solid rgba(239,68,68,.2)}.btn-danger:hover{background:rgba(239,68,68,.15)}
.btn-success{background:var(--greenbg);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.btn-ai{background:linear-gradient(135deg,var(--accent),#6d28d9);color:#fff;font-weight:600}.btn-ai:hover{opacity:.9}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-sm{padding:5px 10px;font-size:11px}
.btn-lg{padding:9px 18px;font-size:13px;font-weight:600}

/* ── CONTENT ── */
.content{padding:22px 24px;flex:1}
.tab-panels>div{display:none}
.tab-panels>div.active{display:block;animation:fadeUp .18s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.page-header h1{font-family:var(--font-d);font-size:18px;font-weight:800}
.page-header p{font-size:12px;color:var(--text3);margin-top:2px}

/* ── CARDS ── */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r)}
.card-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.card-title{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.7px}
.card-body{padding:16px}

/* ── KPI GRID ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.kpi{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;position:relative;overflow:hidden;transition:border-color .15s,transform .15s;cursor:default}
.kpi:hover{border-color:var(--border2);transform:translateY(-1px)}
.kpi-accent{border-top:2px solid var(--accent)}
.kpi-red{border-top:2px solid var(--red)}
.kpi-orange{border-top:2px solid var(--orange)}
.kpi-green{border-top:2px solid var(--green)}
.kpi-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.9px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:5px}
.kpi-value{font-family:var(--font-d);font-size:32px;font-weight:800;line-height:1}
.kpi-value.c-accent{color:var(--accent2)}.kpi-value.c-red{color:var(--red)}.kpi-value.c-orange{color:var(--orange)}.kpi-value.c-green{color:var(--green)}
.kpi-sub{font-size:11px;color:var(--text3);margin-top:6px}
.kpi-sub .up{color:var(--red)}.kpi-sub .dn{color:var(--green)}
.kpi-ghost{position:absolute;right:-6px;bottom:-8px;font-family:var(--font-d);font-size:60px;font-weight:800;opacity:.04;line-height:1;pointer-events:none;user-select:none}

/* ── CHARTS ── */
.charts-row{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:12px;margin-bottom:16px}
.bar-chart-list{display:flex;flex-direction:column;gap:9px}
.bc-row{display:flex;align-items:center;gap:8px}
.bc-label{font-size:11px;color:var(--text2);width:84px;text-align:right;flex-shrink:0}
.bc-track{flex:1;background:var(--bg4);border-radius:3px;height:16px;overflow:hidden}
.bc-fill{height:100%;border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:9px;font-family:var(--font-m);color:rgba(255,255,255,.8);font-weight:500;transition:width 1s cubic-bezier(.4,0,.2,1)}
.bc-num{font-size:10px;color:var(--text3);font-family:var(--font-m);width:18px;text-align:right;flex-shrink:0}
.donut-wrap{display:flex;align-items:center;gap:16px}
.donut{width:100px;height:100px;flex-shrink:0}
.donut-legend{display:flex;flex-direction:column;gap:7px;flex:1}
.dl-row{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text2)}
.dl-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dl-val{margin-left:auto;font-family:var(--font-m);font-size:11px;color:var(--text3)}

/* ── AI STATUS BAR ── */
.ai-bar{background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:var(--r);padding:10px 14px;display:none;align-items:center;gap:12px;margin-bottom:14px;font-size:12px}
.ai-bar.show{display:flex}
.ai-pulse{width:7px;height:7px;border-radius:50%;background:var(--accent2);flex-shrink:0;animation:aipulse 1.2s infinite}
@keyframes aipulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(139,92,246,.5)}50%{opacity:.7;box-shadow:0 0 0 5px rgba(139,92,246,0)}}
.ai-text{color:var(--text2);flex:1;font-size:12px}
.ai-prog-track{width:160px;background:var(--bg4);border-radius:4px;height:3px;overflow:hidden;flex-shrink:0}
.ai-prog-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--teal));border-radius:4px;transition:width .35s ease}
.ai-counter{font-family:var(--font-m);color:var(--text3);font-size:11px;flex-shrink:0;min-width:40px;text-align:right}

/* ── TABLE ── */
.tbl-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.tbl-toolbar{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;gap:8px}
.tbl-title{font-size:13px;font-weight:600}
.pills{display:flex;gap:4px;flex-wrap:wrap}
.pill{padding:3px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);color:var(--text3);transition:all .12s;font-weight:500;background:transparent;font-family:var(--font-b)}
.pill:hover{border-color:var(--border2);color:var(--text2)}
.pill.active{background:var(--accent);border-color:var(--accent);color:#fff}
table{width:100%;border-collapse:collapse}
th{padding:9px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border);background:var(--bg3);white-space:nowrap}
td{padding:11px 14px;border-bottom:1px solid rgba(39,39,42,.6);font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(24,24,27,.6)}
.sev{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:var(--font-m);text-transform:uppercase;letter-spacing:.4px}
.sev-critical{background:var(--redbg);color:var(--red);border:1px solid rgba(239,68,68,.2)}
.sev-high{background:var(--orangebg);color:var(--orange);border:1px solid rgba(249,115,22,.2)}
.sev-medium{background:var(--bluebg);color:var(--blue);border:1px solid rgba(59,130,246,.2)}
.sev-low{background:var(--greenbg);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.cat{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:500;background:var(--bg4);color:var(--text3);border:1px solid var(--border2);font-family:var(--font-m)}
.rdot{width:5px;height:5px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:middle}
.rav{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;color:#fff}
.act-btn{background:transparent;border:1px solid var(--border);border-radius:4px;padding:3px 7px;font-size:10px;cursor:pointer;color:var(--text3);font-family:var(--font-m);transition:all .12s}
.act-btn:hover{background:var(--bg4);color:var(--text2)}
.act-btn.ok:hover{background:var(--greenbg);color:var(--green);border-color:rgba(34,197,94,.3)}
.act-btn.del:hover{background:var(--redbg);color:var(--red);border-color:rgba(239,68,68,.3)}

/* ── INGEST ── */
.ingest-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.ic{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:20px;display:flex;flex-direction:column;gap:12px;transition:border-color .15s}
.ic:hover{border-color:var(--border2)}
.ic-icon{font-size:22px}
.ic-title{font-family:var(--font-d);font-size:14px;font-weight:700}
.ic-desc{font-size:12px;color:var(--text3);line-height:1.65}
.ic-meta{font-size:10px;color:var(--text3);font-family:var(--font-m);padding:7px 9px;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border);line-height:1.7}
.form-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-top:14px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.form-full{grid-column:span 2}
.fg{display:flex;flex-direction:column;gap:4px}
.fg label{font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.6px}
input,textarea,select{background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 11px;color:var(--text);font-family:var(--font-b);font-size:13px;outline:none;transition:border-color .12s;width:100%}
input::placeholder,textarea::placeholder{color:var(--text3)}
input:focus,textarea:focus,select:focus{border-color:var(--accent);background:var(--bg2)}
select option{background:var(--bg3)}
textarea{resize:vertical;min-height:76px}

/* ── ANALYSIS ── */
.analysis-hero{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:22px;margin-bottom:14px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start}
.hero-title{font-family:var(--font-d);font-size:18px;font-weight:800;margin-bottom:6px}
.hero-text{font-size:13px;color:var(--text2);line-height:1.7;max-width:600px}
.hero-metrics{display:flex;gap:20px;margin-top:14px;flex-wrap:wrap}
.hm{text-align:center}
.hm-val{font-family:var(--font-d);font-size:26px;font-weight:800;line-height:1}
.hm-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-top:2px}
.health-box{text-align:center;background:var(--bg3);border-radius:var(--r);padding:16px 20px;min-width:120px}
.health-num{font-family:var(--font-d);font-size:44px;font-weight:800;color:var(--green);line-height:1}
.health-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:4px}
.health-subs{margin-top:10px;display:flex;flex-direction:column;gap:4px}
.hs-row{display:flex;justify-content:space-between;gap:16px;font-size:11px;color:var(--text3)}
.analysis-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.a-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px}
.a-card h3{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px}
.pat-item{padding:10px 12px;background:var(--bg3);border-radius:var(--r-sm);margin-bottom:7px;border-left:2px solid var(--accent)}
.pat-item:last-child{margin-bottom:0}
.pat-title{font-size:12px;font-weight:600;margin-bottom:3px}
.pat-sub{font-size:11px;color:var(--text3);margin-bottom:4px}
.pat-action{font-size:11px;color:var(--teal)}
.reco-3col{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.reco{padding:14px;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border)}
.reco-prio{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;margin-bottom:7px;font-family:var(--font-m)}
.reco-action{font-size:12px;font-weight:600;margin-bottom:5px}
.reco-why{font-size:11px;color:var(--text3);line-height:1.55}
.ai-result-banner{background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:var(--r);padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--text2);line-height:1.65;display:none}
.ai-result-banner.show{display:block}

/* ── DOCUMENT ── */
.doc-header{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.doc-body{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:28px 36px;font-family:var(--font-m);font-size:12.5px;line-height:1.8;color:var(--text);max-height:520px;overflow-y:auto}
.md-h1{font-family:var(--font-d);font-size:20px;font-weight:800;margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:10px}
.md-h2{font-family:var(--font-d);font-size:14px;font-weight:700;color:var(--accent2);margin-top:20px;margin-bottom:7px}
.md-h3{font-size:13px;font-weight:600;margin-top:12px;margin-bottom:5px}
.md-p{font-size:12.5px;color:var(--text2);margin-bottom:9px;font-family:var(--font-b);line-height:1.72}
.md-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
.md-table th{background:var(--bg4);padding:7px 11px;text-align:left;color:var(--text2);border:1px solid var(--border2);font-size:10px;text-transform:uppercase;letter-spacing:.5px}
.md-table td{padding:7px 11px;border:1px solid var(--border);color:var(--text)}
.md-table tr:nth-child(even) td{background:rgba(24,24,27,.5)}
.md-ul{margin:5px 0 9px 16px;color:var(--text2);font-family:var(--font-b);font-size:12.5px}
.md-ul li{margin-bottom:4px;line-height:1.6}
.mdb{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;font-family:var(--font-m)}
.mdb.c{background:var(--redbg);color:var(--red)}.mdb.h{background:var(--orangebg);color:var(--orange)}.mdb.m{background:var(--bluebg);color:var(--blue)}.mdb.l{background:var(--greenbg);color:var(--green)}
code{background:var(--bg4);padding:1px 5px;border-radius:3px;font-family:var(--font-m);font-size:11px;color:var(--teal)}

/* ── MODAL ── */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.overlay.hidden{display:none}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r-lg);padding:24px;width:520px;max-width:92vw;max-height:88vh;overflow-y:auto;animation:fadeUp .16s ease}
.modal-hd{font-family:var(--font-d);font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.modal-x{background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;transition:color .12s}
.modal-x:hover{color:var(--text);background:var(--bg3)}

/* ── TOAST ── */
.toast{position:fixed;bottom:20px;right:20px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r);padding:11px 16px;font-size:13px;color:var(--text);box-shadow:0 8px 24px rgba(0,0,0,.6);z-index:999;transform:translateY(56px);opacity:0;transition:all .24s cubic-bezier(.4,0,.2,1);max-width:340px;display:flex;align-items:center;gap:8px}
.toast.show{transform:translateY(0);opacity:1}

/* ── PATTERNS / INSIGHTS ── */
.ins-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.ins-subnav{display:flex;gap:4px;margin-bottom:18px;border-bottom:1px solid var(--border);padding-bottom:12px;align-items:center}
.psub{display:none}.psub.active{display:block;animation:fadeUp .18s ease}
.vel-bars{display:flex;align-items:flex-end;gap:6px;height:120px;padding:0 4px}
.vel-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.vel-fill{width:100%;border-radius:4px 4px 0 0;transition:height .8s cubic-bezier(.4,0,.2,1)}
.vel-lbl{font-size:9px;color:var(--text3);font-family:var(--font-m);text-align:center}
.vel-num{font-size:10px;font-family:var(--font-m);font-weight:600}
.comp-bars{display:flex;align-items:flex-end;gap:8px;height:130px;padding:0 4px}
.comp-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.comp-stk{width:100%;display:flex;flex-direction:column;justify-content:flex-end;border-radius:3px 3px 0 0;overflow:hidden}
.vel-bar{height:5px;border-radius:3px;background:var(--bg4);overflow:hidden;width:50px;display:inline-block;vertical-align:middle;margin-right:4px}
.vel-bar-fill{height:100%;border-radius:3px}

/* ── EMPTY STATE ── */
.empty{text-align:center;padding:44px 20px;color:var(--text3)}
.empty-icon{font-size:28px;margin-bottom:10px;opacity:.5}
.empty-title{font-size:14px;font-weight:600;color:var(--text2);margin-bottom:4px}
.empty-sub{font-size:12px}

/* ── AI CONFIG BANNER ── */
.ai-config-banner{background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.2);border-radius:var(--r);padding:11px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text2)}
.ai-config-banner.ok{background:rgba(34,197,94,.06);border-color:rgba(34,197,94,.2)}
.hidden{display:none!important}
</style>
</head>
<body>

<!-- TOAST -->
<div id="toast" class="toast"></div>

<!-- MODAL -->
<div id="overlay" class="overlay hidden">
  <div id="modal" class="modal"></div>
</div>

<!-- SIDEBAR -->
<div class="sidebar">
  <div class="logo">
    <div class="logo-mark">⚡</div>
    <div>
      <div class="logo-name">IssueAI</div>
      <div class="logo-tag">Project Intelligence</div>
    </div>
  </div>
  <nav class="nav">
    <div class="nav-section">Workspace</div>
    <div class="nav-item" data-tab="dashboard"><span class="nav-icon">⊞</span>Dashboard</div>
    <div class="nav-item active" data-tab="issues"><span class="nav-icon">◈</span>Issues<span class="nav-badge" id="nav-issues-badge">—</span></div>
    <div class="nav-item" data-tab="ingest"><span class="nav-icon">↓</span>Ingest Data</div>
    <div class="nav-section">Intelligence</div>
    <div class="nav-item" data-tab="analysis"><span class="nav-icon">✦</span>AI Analysis</div>
    <div class="nav-item" data-tab="patterns"><span class="nav-icon">◉</span>Insights</div>
    <div class="nav-item" data-tab="document"><span class="nav-icon">≡</span>Report<span class="nav-badge ok" id="nav-doc-badge" style="display:none">New</span></div>
  </nav>
  <div class="sidebar-footer">
    <div class="av" id="user-av">RK</div>
    <div>
      <div class="av-name" id="user-name">Team Lead</div>
      <div class="av-role">Engineering</div>
    </div>
    <div class="status-online"></div>
  </div>
</div>

<!-- MAIN -->
<div class="main">
  <div class="topbar">
    <div>
      <div class="page-title" id="page-title">Issues</div>
    </div>
    <div class="topbar-right">
      <div class="search-wrap">
        <span class="search-icon">⌕</span>
        <input class="search-bar" id="global-search" placeholder="Search issues…"/>
      </div>
      <button class="btn btn-secondary btn-sm" data-go="ingest">↓ Ingest</button>
      <button class="btn btn-primary btn-sm" id="btn-add-issue">+ Add Issue</button>
    </div>
  </div>

  <div class="content">
    <div class="tab-panels">

    <!-- ════════════ DASHBOARD ════════════ -->
    <div id="tab-dashboard">
      <div class="kpi-grid">
        <div class="kpi kpi-red">
          <div class="kpi-label">🔴 Critical</div>
          <div class="kpi-value c-red" id="kpi-critical">—</div>
          <div class="kpi-sub" id="kpi-critical-sub">open issues</div>
          <div class="kpi-ghost" id="kpi-critical-bg">—</div>
        </div>
        <div class="kpi kpi-orange">
          <div class="kpi-label">📂 Open Issues</div>
          <div class="kpi-value c-orange" id="kpi-open">—</div>
          <div class="kpi-sub" id="kpi-open-sub">across projects</div>
          <div class="kpi-ghost" id="kpi-open-bg">—</div>
        </div>
        <div class="kpi kpi-green">
          <div class="kpi-label">💚 Team Health</div>
          <div class="kpi-value c-green" id="kpi-health">—</div>
          <div class="kpi-sub">/ 10 AI score</div>
          <div class="kpi-ghost" id="kpi-health-bg">—</div>
        </div>
        <div class="kpi kpi-accent">
          <div class="kpi-label">✓ Resolved</div>
          <div class="kpi-value c-accent" id="kpi-resolved">—</div>
          <div class="kpi-sub" id="kpi-resolved-sub">total closed</div>
          <div class="kpi-ghost" id="kpi-resolved-bg">—</div>
        </div>
      </div>

      <!-- AI status bar -->
      <div class="ai-bar" id="ai-bar">
        <div class="ai-pulse"></div>
        <div class="ai-text" id="ai-text">Connecting to AI…</div>
        <div class="ai-prog-track"><div class="ai-prog-fill" id="ai-prog" style="width:0%"></div></div>
        <div class="ai-counter" id="ai-counter"></div>
        <button class="btn btn-ghost btn-sm" id="ai-cancel">✕</button>
      </div>

      <!-- Charts -->
      <div class="charts-row">
        <div class="card">
          <div class="card-header"><span class="card-title">By Category</span><span style="font-size:10px;color:var(--teal);background:rgba(20,184,166,.1);padding:2px 7px;border-radius:20px;border:1px solid rgba(20,184,166,.2)">AI Tagged</span></div>
          <div class="card-body"><div class="bar-chart-list" id="cat-chart"></div></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Severity Split</span></div>
          <div class="card-body">
            <div class="donut-wrap">
              <svg class="donut" id="donut-svg" viewBox="0 0 110 110"></svg>
              <div class="donut-legend" id="donut-legend"></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">By Project</span></div>
          <div class="card-body">
            <div class="bar-chart-list" id="proj-chart" style="margin-bottom:14px"></div>
            <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:7px">
              <button class="btn btn-ai" style="width:100%;justify-content:center" id="btn-classify">⚡ Classify with AI</button>
              <button class="btn btn-secondary" style="width:100%;justify-content:center" data-go="analysis">✦ Run Analysis</button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI config status -->
      <div class="ai-config-banner hidden" id="ai-config-banner">
        <span id="ai-config-icon">⚙</span>
        <span id="ai-config-text">Checking AI configuration…</span>
      </div>
    </div>

    <!-- ════════════ ISSUES ════════════ -->
    <div id="tab-issues" class="active">
      <div class="tbl-card">
        <div class="tbl-toolbar">
          <span class="tbl-title">All Issues</span>
          <div class="pills" id="filter-pills">
            <button class="pill active" data-filter="all">All</button>
            <button class="pill" data-filter="open">Open</button>
            <button class="pill" data-filter="critical">Critical</button>
            <button class="pill" data-filter="resolved">Resolved</button>
          </div>
          <div class="pills" id="proj-pills"></div>
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" id="btn-export">⬇ CSV</button>
            <button class="btn btn-primary btn-sm" id="btn-add-issue2">+ Add</button>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th style="width:36px">#</th>
                <th>Title</th>
                <th>Project</th>
                <th>Reporter</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Root Cause</th>
                <th>Status</th>
                <th style="width:70px"></th>
              </tr>
            </thead>
            <tbody id="issues-tbody">
              <tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3)">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ════════════ INGEST ════════════ -->
    <div id="tab-ingest">
      <div class="ingest-grid">
        <div class="ic">
          <div class="ic-icon">💬</div>
          <div class="ic-title">MS Teams</div>
          <div class="ic-desc">Pull messages from a Teams channel via Microsoft Graph API. Uses mock data when credentials are not configured.</div>
          <div class="ic-meta">Mode: mock · Set TEAMS_* env vars for live sync</div>
          <button class="btn btn-primary btn-sm" id="btn-teams-ingest">↓ Ingest Mock Data</button>
        </div>
        <div class="ic">
          <div class="ic-icon">📊</div>
          <div class="ic-title">CSV Upload</div>
          <div class="ic-desc">Upload any CSV. Columns auto-mapped: title, description, reporter, project, severity, status, category.</div>
          <div class="ic-meta">Accepted: .csv · Max 10MB</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <label class="btn btn-primary btn-sm" style="cursor:pointer">📂 Upload<input type="file" id="csv-upload" accept=".csv" style="display:none"/></label>
            <a class="btn btn-ghost btn-sm" href="/api/issues/export-csv" download>⬇ Template</a>
          </div>
        </div>
        <div class="ic">
          <div class="ic-icon">⌨</div>
          <div class="ic-title">Manual Entry</div>
          <div class="ic-desc">Log a single issue directly. Useful for standup blockers or ad-hoc reports. Saves instantly to the database.</div>
          <div class="ic-meta">Immediate · Source tagged as "manual"</div>
          <button class="btn btn-secondary btn-sm" id="btn-open-form">+ Open Form ↓</button>
        </div>
      </div>

      <div class="form-card" id="manual-form-section">
        <div style="font-family:var(--font-d);font-size:14px;font-weight:700;margin-bottom:14px;color:var(--text)">Log a New Issue</div>
        <form id="issue-form">
          <div class="form-grid">
            <div class="fg form-full"><label>Title *</label><input name="title" placeholder="e.g. Prod deployment rollback failed" required/></div>
            <div class="fg form-full"><label>Description</label><textarea name="description" placeholder="Steps to reproduce, business impact, links to logs…"></textarea></div>
            <div class="fg"><label>Reporter</label><input name="reporter" placeholder="Your name"/></div>
            <div class="fg"><label>Project</label>
              <select name="project"><option>Phoenix</option><option>Atlas</option><option>Horizon</option><option>General</option></select>
            </div>
            <div class="fg"><label>Severity</label>
              <select name="severity"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            </div>
            <div class="fg"><label>Category</label>
              <select name="category"><option value="">— auto-detect —</option><option>technical</option><option>process</option><option>security</option><option>quality</option><option>environment</option><option>other</option></select>
            </div>
            <div class="fg form-full"><label>Root Cause (optional)</label><input name="root_cause" placeholder="Your hypothesis on why this happened"/></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
            <button type="submit" class="btn btn-primary">Save Issue</button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-form-reset">Clear</button>
            <span id="form-status" style="font-size:12px;color:var(--text3)"></span>
          </div>
        </form>
      </div>
    </div>

    <!-- ════════════ ANALYSIS ════════════ -->
    <div id="tab-analysis">
      <!-- AI result banner -->
      <div class="ai-result-banner" id="ai-result-banner"></div>

      <div class="analysis-hero">
        <div>
          <div class="hero-title" id="analysis-title">AI Analysis</div>
          <div class="hero-text" id="analysis-summary-text" style="color:var(--text3)">Click <strong style="color:var(--text)">Run Analysis</strong> to generate AI-powered insights from your current issue data. Requires OpenRouter API key.</div>
          <div class="hero-metrics" id="analysis-metrics"></div>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
            <button class="btn btn-ai btn-lg" id="btn-run-analysis">✦ Run AI Analysis</button>
            <button class="btn btn-secondary" data-go="document">≡ View Report</button>
          </div>
        </div>
        <div class="health-box">
          <div class="health-num" id="health-score">—</div>
          <div class="health-lbl">Team Health</div>
          <div class="health-subs" id="health-subs"></div>
        </div>
      </div>

      <div class="analysis-2col hidden" id="analysis-grid">
        <div class="a-card">
          <h3>Issues by Category</h3>
          <div id="analysis-cats"></div>
        </div>
        <div class="a-card">
          <h3>Issues by Project</h3>
          <div id="analysis-projs"></div>
        </div>
      </div>

      <div class="a-card hidden" id="analysis-reco-card" style="margin-bottom:0">
        <h3>Recommendations</h3>
        <div class="reco-3col" id="reco-grid"></div>
      </div>
    </div>

    <!-- ════════════ INSIGHTS / PATTERNS ════════════ -->
    <div id="tab-patterns">
      <div class="ins-subnav">
        <button class="pill active" data-psub="velocity">Velocity Trend</button>
        <button class="pill" data-psub="composition">Issue Composition</button>
        <button class="pill" data-psub="table">Data Table</button>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:var(--text3)">Project:</span>
          <select id="pattern-project-select" style="width:auto;padding:4px 8px;font-size:12px">
            <option value="Phoenix">Phoenix</option>
            <option value="Atlas">Atlas</option>
          </select>
        </div>
      </div>

      <div id="psub-velocity" class="psub active">
        <div class="card" style="margin-bottom:12px">
          <div class="card-header"><span class="card-title">Velocity Score — Over Time</span></div>
          <div class="card-body">
            <div class="vel-bars" id="velocity-chart-wrap" style="height:120px"></div>
            <div style="display:flex;gap:14px;margin-top:8px;font-size:10px;color:var(--text3)">
              <span>● Green ≥ 7 healthy</span><span>● Yellow 4–6 watch</span><span>● Red &lt; 4 risk</span>
            </div>
          </div>
        </div>
        <div class="kpi-grid" id="pattern-kpis"></div>
      </div>

      <div id="psub-composition" class="psub">
        <div class="card">
          <div class="card-header"><span class="card-title">Issue Composition — Critical + High Over Time</span></div>
          <div class="card-body">
            <div class="comp-bars" id="composition-chart-wrap" style="height:130px"></div>
            <div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:var(--text3)">
              <span style="color:var(--red)">■ Critical</span>
              <span style="color:var(--orange)">■ High</span>
              <span style="color:var(--blue);opacity:.6">■ Med+Low</span>
            </div>
          </div>
        </div>
      </div>

      <div id="psub-table" class="psub">
        <div class="tbl-card">
          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr><th>Period</th><th>Total</th><th>Critical</th><th>High</th><th>Med</th><th>Low</th><th>Resolved</th><th>Top Category</th><th>Velocity</th></tr>
              </thead>
              <tbody id="sprint-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════ DOCUMENT ════════════ -->
    <div id="tab-document">
      <div class="doc-header">
        <div>
          <div style="font-family:var(--font-d);font-weight:700;font-size:14px" id="doc-filename">issueai-report.md</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px" id="doc-meta">Live data report</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:7px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="btn-copy-report">📋 Copy</button>
          <button class="btn btn-ai btn-sm" id="btn-ai-report">⚡ AI Report</button>
          <a class="btn btn-secondary btn-sm" id="btn-download-report" href="/api/report" download>⬇ Download .md</a>
        </div>
      </div>
      <div class="doc-body" id="doc-body">
        <div class="empty">
          <div class="empty-icon">≡</div>
          <div class="empty-title">No report yet</div>
          <div class="empty-sub">Click <strong>⬇ Download .md</strong> for a basic report, or <strong>⚡ AI Report</strong> for a full AI-written document.</div>
        </div>
      </div>
    </div>

    </div>
  </div>
</div>

<script>
'use strict';
// ── State ──────────────────────────────────────────────────────────────────
const S = { issues:[], stats:{}, sprints:[], filter:{sev:'all',status:'all',project:'all'}, search:'', tab:'issues', aiConfigured:false };

// ── Avatar colours ─────────────────────────────────────────────────────────
const GRADS = ['linear-gradient(135deg,#7c3aed,#14b8a6)','linear-gradient(135deg,#f97316,#ef4444)','linear-gradient(135deg,#14b8a6,#3b82f6)','linear-gradient(135deg,#3b82f6,#7c3aed)','linear-gradient(135deg,#ef4444,#f97316)','linear-gradient(135deg,#14b8a6,#22c55e)','linear-gradient(135deg,#7c3aed,#ef4444)'];
const AVC = {};
function ac(n){ if(!AVC[n]){let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);AVC[n]=GRADS[Math.abs(h)%GRADS.length];}return AVC[n]; }
function ini(n){ return(n||'?').split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''); }

// ── API ────────────────────────────────────────────────────────────────────
async function call(method,path,body){
  const o={method,headers:{}};
  if(body instanceof FormData){o.body=body;}
  else if(body){o.headers['Content-Type']='application/json';o.body=JSON.stringify(body);}
  const r=await fetch('/api'+path,o);
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'HTTP '+r.status);}
  return r.json();
}

// ── Toast ──────────────────────────────────────────────────────────────────
let TT;
function toast(msg,type='ok'){
  const el=document.getElementById('toast');
  const ic=type==='ok'?'✓':type==='err'?'✕':'ℹ';
  const cl=type==='ok'?'#22c55e':type==='err'?'#ef4444':'#3b82f6';
  el.innerHTML=\`<span style="color:\${cl};font-weight:700;font-size:15px">\${ic}</span><span>\${msg}</span>\`;
  el.classList.add('show');clearTimeout(TT);
  TT=setTimeout(()=>el.classList.remove('show'),3200);
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(title,html,onSub){
  const o=document.getElementById('overlay'),m=document.getElementById('modal');
  m.innerHTML=\`<div class="modal-hd">\${title}<button class="modal-x" onclick="closeModal()">✕</button></div><div id="mc">\${html}</div>\`;
  o.classList.remove('hidden');
  if(onSub){const f=m.querySelector('form');if(f)f.addEventListener('submit',async e=>{e.preventDefault();await onSub(new FormData(f));});}
}
function closeModal(){document.getElementById('overlay').classList.add('hidden');}
document.getElementById('overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});

// ── Navigation ─────────────────────────────────────────────────────────────
const TITLES={dashboard:'Dashboard',issues:'Issues',ingest:'Ingest Data',analysis:'AI Analysis',patterns:'Team Insights',document:'Report'};
function goTab(tab){
  document.querySelectorAll('.nav-item[data-tab]').forEach(n=>n.classList.toggle('active',n.dataset.tab===tab));
  document.querySelectorAll('.tab-panels>div').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab)?.classList.add('active');
  document.getElementById('page-title').textContent=TITLES[tab]||tab;
  S.tab=tab;
  if(tab==='dashboard')renderDashboard();
  if(tab==='issues')renderTable();
  if(tab==='analysis')renderAnalysis();
  if(tab==='patterns')renderPatterns();
  if(tab==='document')renderDoc();
}
document.querySelectorAll('.nav-item[data-tab]').forEach(el=>el.addEventListener('click',()=>goTab(el.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>goTab(el.dataset.go)));

// ── Load data ──────────────────────────────────────────────────────────────
async function loadAll(){
  try{
    const[iss,stats,spr]=await Promise.all([call('GET','/issues'),call('GET','/stats'),call('GET','/sprints?project=Phoenix')]);
    S.issues=iss;S.stats=stats;S.sprints=spr;
    const b=document.getElementById('nav-issues-badge');
    if(b)b.textContent=stats.open||iss.length;
    buildProjPills(stats.byProj||[]);
    renderTable();
    if(S.tab==='dashboard')renderDashboard();
    // Check AI status
    call('GET','/ai/status').then(st=>{
      S.aiConfigured=st.configured;
      showAIConfig(st);
    }).catch(()=>{});
  }catch(e){toast('Load failed: '+e.message,'err');}
}

function showAIConfig(st){
  const b=document.getElementById('ai-config-banner');
  if(!b)return;
  if(st.configured){
    b.className='ai-config-banner ok';
    b.innerHTML=\`<span>✓</span><span>AI ready · Model: <strong>\${st.model}</strong>\${st.last_analysis?' · Last analysis: '+new Date(st.last_analysis).toLocaleString():''}</span>\`;
  }else{
    b.className='ai-config-banner';
    b.innerHTML=\`<span>⚠</span><span>AI not configured — add <strong>OPENROUTER_API_KEY</strong> in Railway → Variables to enable AI classification &amp; analysis.</span>\`;
  }
  b.classList.remove('hidden');
}

// ── Project pills ──────────────────────────────────────────────────────────
function buildProjPills(byProj){
  const c=document.getElementById('proj-pills');if(!c)return;
  c.innerHTML=byProj.map(p=>\`<button class="pill" data-proj="\${p.project}">\${p.project}</button>\`).join('');
  c.querySelectorAll('.pill').forEach(p=>p.addEventListener('click',()=>{
    c.querySelectorAll('.pill').forEach(x=>x.classList.remove('active'));
    if(S.filter.project===p.dataset.proj){S.filter.project='all';}
    else{S.filter.project=p.dataset.proj;p.classList.add('active');}
    renderTable();
  }));
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard(){
  const s=S.stats;if(!s||!s.total)return;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('kpi-critical',s.critical);set('kpi-critical-bg',s.critical);
  set('kpi-open',s.open);set('kpi-open-sub',\`across \${(s.byProj||[]).length} projects\`);set('kpi-open-bg',s.open);
  set('kpi-health',s.health);set('kpi-health-bg',s.health);
  set('kpi-resolved',s.resolved);set('kpi-resolved-sub',\`of \${s.total} total\`);set('kpi-resolved-bg',s.resolved);

  // Category bars
  const cats=(s.byCat||[]).slice(0,6),maxC=cats[0]?.c||1;
  const CG={technical:'linear-gradient(90deg,#7c3aed,#8b5cf6)',process:'linear-gradient(90deg,#f97316,#fb923c)',security:'linear-gradient(90deg,#ef4444,#f87171)',environment:'linear-gradient(90deg,#14b8a6,#2dd4bf)',quality:'linear-gradient(90deg,#3b82f6,#60a5fa)',other:'linear-gradient(90deg,#52525b,#71717a)'};
  document.getElementById('cat-chart').innerHTML=cats.map(c=>\`
    <div class="bc-row">
      <div class="bc-label">\${c.category||'other'}</div>
      <div class="bc-track"><div class="bc-fill" style="width:\${Math.round((c.c/maxC)*88+8)}%;background:\${CG[c.category]||CG.other}">\${c.c}</div></div>
      <div class="bc-num">\${c.c}</div>
    </div>\`).join('');

  renderDonut(s.bySev||[]);

  // Project bars
  const projs=(s.byProj||[]).slice(0,5),maxP=projs[0]?.c||1;
  const PG=['linear-gradient(90deg,#7c3aed,#8b5cf6)','linear-gradient(90deg,#14b8a6,#2dd4bf)','linear-gradient(90deg,#f97316,#fb923c)','linear-gradient(90deg,#3b82f6,#60a5fa)'];
  document.getElementById('proj-chart').innerHTML=projs.map((p,i)=>\`
    <div class="bc-row">
      <div class="bc-label">\${p.project}</div>
      <div class="bc-track"><div class="bc-fill" style="width:\${Math.round((p.c/maxP)*88+8)}%;background:\${PG[i%PG.length]}">\${p.c}</div></div>
      <div class="bc-num">\${p.c}</div>
    </div>\`).join('');
}

function renderDonut(bySev){
  const SEV=[{k:'critical',c:'#ef4444',l:'Critical'},{k:'high',c:'#f97316',l:'High'},{k:'medium',c:'#3b82f6',l:'Medium'},{k:'low',c:'#22c55e',l:'Low'}];
  const map={};bySev.forEach(s=>{map[s.severity]=s.c;});
  const total=Object.values(map).reduce((a,b)=>a+b,0)||1;
  const C=2*Math.PI*40;let off=0;
  const segs=SEV.map(s=>{const n=map[s.k]||0,d=(n/total)*C,seg={...s,n,d,off};off+=d;return seg;});
  const svg=document.getElementById('donut-svg');
  svg.innerHTML=\`<circle cx="55" cy="55" r="40" fill="none" stroke="#27272a" stroke-width="16"/>\` +
    segs.map(s=>s.n?\`<circle cx="55" cy="55" r="40" fill="none" stroke="\${s.c}" stroke-width="16" stroke-dasharray="\${s.d.toFixed(1)} \${(C-s.d).toFixed(1)}" stroke-dashoffset="\${(-s.off).toFixed(1)}" transform="rotate(-90 55 55)"/>\` : '').join('')+
    \`<text x="55" y="51" text-anchor="middle" fill="#fafafa" font-size="14" font-family="Syne,sans-serif" font-weight="800">\${total}</text><text x="55" y="63" text-anchor="middle" fill="#52525b" font-size="9">issues</text>\`;
  document.getElementById('donut-legend').innerHTML=SEV.map(s=>\`
    <div class="dl-row"><div class="dl-dot" style="background:\${s.c}"></div>\${s.l}<div class="dl-val">\${map[s.k]||0}</div></div>\`).join('');
}

// ── Issues table ───────────────────────────────────────────────────────────
const SC={critical:'sev-critical',high:'sev-high',medium:'sev-medium',low:'sev-low'};
const DC={open:'var(--red)',resolved:'var(--green)','in review':'var(--yellow)'};

function filtered(){
  const {sev,status,project}=S.filter,q=S.search.toLowerCase();
  return S.issues.filter(i=>{
    if(sev!=='all'&&i.severity!==sev)return false;
    if(status!=='all'&&i.status!==status)return false;
    if(project!=='all'&&i.project.toLowerCase()!==project.toLowerCase())return false;
    if(q&&!\`\${i.title} \${i.reporter} \${i.project} \${i.description}\`.toLowerCase().includes(q))return false;
    return true;
  });
}

function renderTable(){
  const tb=document.getElementById('issues-tbody'),rows=filtered();
  if(!rows.length){tb.innerHTML=\`<tr><td colspan="9"><div class="empty"><div class="empty-icon">◈</div><div class="empty-title">No issues found</div><div class="empty-sub">Try a different filter or add a new issue.</div></div></td></tr>\`;return;}
  tb.innerHTML=rows.map((i,n)=>\`
    <tr>
      <td style="color:var(--text3);font-family:var(--font-m);font-size:11px">\${String(n+1).padStart(2,'0')}</td>
      <td style="max-width:260px">
        <span style="font-weight:500;cursor:pointer" onclick="editIssue('\${i.id}')">\${esc(i.title)}</span>
        \${i.source==='teams'?'<span style="font-size:9px;color:var(--text3);margin-left:5px;font-family:var(--font-m)">TEAMS</span>':''}
        \${i.source==='csv'?'<span style="font-size:9px;color:var(--text3);margin-left:5px;font-family:var(--font-m)">CSV</span>':''}
      </td>
      <td style="color:var(--accent2);font-size:12px">\${esc(i.project)}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><div class="rav" style="background:\${ac(i.reporter)}">\${ini(i.reporter)}</div><span style="color:var(--text2);font-size:12px">\${esc(i.reporter)}</span></div></td>
      <td><span class="sev \${SC[i.severity]||'sev-low'}">● \${i.severity}</span></td>
      <td>\${i.category?\`<span class="cat">\${esc(i.category)}</span>\`:'<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:11px;color:var(--text3);max-width:180px">\${esc(i.root_cause)||'<span style="color:var(--text3)">—</span>'}</td>
      <td><span class="rdot" style="background:\${DC[i.status]||'var(--text3)'}"></span><span style="color:var(--text2);font-size:12px">\${i.status}</span></td>
      <td><div style="display:flex;gap:3px">
        \${i.status!=='resolved'?\`<button class="act-btn ok" onclick="resolveIssue('\${i.id}')">✓</button>\`:\`<button class="act-btn" onclick="reopenIssue('\${i.id}')">↺</button>\`}
        <button class="act-btn del" onclick="deleteIssue('\${i.id}')">✕</button>
      </div></td>
    </tr>\`).join('');
}

// ── Filter pills ───────────────────────────────────────────────────────────
document.getElementById('filter-pills').addEventListener('click',e=>{
  const p=e.target.closest('[data-filter]');if(!p)return;
  document.querySelectorAll('#filter-pills .pill').forEach(x=>x.classList.remove('active'));
  p.classList.add('active');
  const f=p.dataset.filter;
  S.filter.sev='all';S.filter.status='all';
  if(f==='open')S.filter.status='open';
  else if(f==='resolved')S.filter.status='resolved';
  else if(f==='critical')S.filter.sev='critical';
  renderTable();
});
document.getElementById('global-search').addEventListener('input',e=>{
  S.search=e.target.value;
  if(S.tab==='issues')renderTable();
});

// ── Issue actions ──────────────────────────────────────────────────────────
async function resolveIssue(id){
  try{await call('PATCH',\`/issues/\${id}\`,{status:'resolved'});const i=S.issues.find(x=>x.id===id);if(i)i.status='resolved';renderTable();await refreshStats();toast('Resolved ✓');}catch(e){toast(e.message,'err');}
}
async function reopenIssue(id){
  try{await call('PATCH',\`/issues/\${id}\`,{status:'open'});const i=S.issues.find(x=>x.id===id);if(i)i.status='open';renderTable();await refreshStats();toast('Reopened');}catch(e){toast(e.message,'err');}
}
async function deleteIssue(id){
  if(!confirm('Delete this issue?'))return;
  try{await call('DELETE',\`/issues/\${id}\`);S.issues=S.issues.filter(x=>x.id!==id);renderTable();await refreshStats();toast('Deleted');}catch(e){toast(e.message,'err');}
}
function editIssue(id){
  const i=S.issues.find(x=>x.id===id);if(!i)return;
  openModal('Edit Issue',\`
    <form id="ef">
      <div class="form-grid">
        <div class="fg form-full"><label>Title</label><input name="title" value="\${esc(i.title)}" required/></div>
        <div class="fg form-full"><label>Description</label><textarea name="description">\${esc(i.description)}</textarea></div>
        <div class="fg"><label>Reporter</label><input name="reporter" value="\${esc(i.reporter)}"/></div>
        <div class="fg"><label>Project</label><select name="project">\${['Phoenix','Atlas','Horizon','General'].map(p=>\`<option \${p===i.project?'selected':''}>\${p}</option>\`).join('')}</select></div>
        <div class="fg"><label>Severity</label><select name="severity">\${['critical','high','medium','low'].map(s=>\`<option \${s===i.severity?'selected':''}>\${s}</option>\`).join('')}</select></div>
        <div class="fg"><label>Status</label><select name="status">\${['open','in review','resolved','wontfix'].map(s=>\`<option \${s===i.status?'selected':''}>\${s}</option>\`).join('')}</select></div>
        <div class="fg"><label>Category</label><select name="category">\${['','technical','process','security','quality','environment','other'].map(c=>\`<option \${c===i.category?'selected':''}>\${c}</option>\`).join('')}</select></div>
        <div class="fg form-full"><label>Root Cause</label><input name="root_cause" value="\${esc(i.root_cause)}"/></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      </div>
    </form>\`);
  document.getElementById('ef').addEventListener('submit',async e=>{
    e.preventDefault();
    try{const d=Object.fromEntries(new FormData(e.target));const u=await call('PATCH',\`/issues/\${id}\`,d);const x=S.issues.findIndex(x=>x.id===id);if(x>=0)S.issues[x]=u;renderTable();await refreshStats();closeModal();toast('Updated ✓');}
    catch(err){toast(err.message,'err');}
  });
}

// ── Add issue form ─────────────────────────────────────────────────────────
['btn-add-issue','btn-add-issue2'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{goTab('ingest');setTimeout(()=>document.getElementById('manual-form-section')?.scrollIntoView({behavior:'smooth'}),80);}));
document.getElementById('btn-open-form')?.addEventListener('click',()=>document.getElementById('manual-form-section')?.scrollIntoView({behavior:'smooth'}));
document.getElementById('issue-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const st=document.getElementById('form-status');
  try{st.textContent='Saving…';const d=Object.fromEntries(new FormData(e.target));const iss=await call('POST','/issues',d);S.issues.unshift(iss);await refreshStats();e.target.reset();st.textContent='';toast('Issue saved ✓');}
  catch(err){st.textContent=err.message;toast(err.message,'err');}
});
document.getElementById('btn-form-reset')?.addEventListener('click',()=>{document.getElementById('issue-form')?.reset();document.getElementById('form-status').textContent='';});

// ── CSV upload ─────────────────────────────────────────────────────────────
document.getElementById('csv-upload')?.addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  toast('Uploading…','info');
  try{const fd=new FormData();fd.append('file',f);const r=await fetch('/api/issues/import-csv',{method:'POST',body:fd});if(!r.ok)throw new Error('Upload failed');const d=await r.json();S.issues=[...d.issues,...S.issues];await refreshStats();toast(\`Imported \${d.imported} issues ✓\`);}
  catch(err){toast(err.message,'err');}
  e.target.value='';
});

// ── Export ─────────────────────────────────────────────────────────────────
document.getElementById('btn-export')?.addEventListener('click',()=>{
  const u=new URL('/api/issues/export-csv',location.href);
  const{sev,status,project}=S.filter;
  if(sev!=='all')u.searchParams.set('severity',sev);
  if(status!=='all')u.searchParams.set('status',status);
  if(project!=='all')u.searchParams.set('project',project);
  if(S.search)u.searchParams.set('search',S.search);
  Object.assign(document.createElement('a'),{href:u.toString(),download:'issues.csv'}).click();
  toast('CSV download started');
});

// ── Teams mock ─────────────────────────────────────────────────────────────
document.getElementById('btn-teams-ingest')?.addEventListener('click',async()=>{
  const btn=document.getElementById('btn-teams-ingest');
  btn.disabled=true;btn.textContent='Syncing…';
  const mock=[
    {title:'Teams: Deployment pipeline failing on feature branch merges',reporter:'Shreya Iyer',project:'Phoenix',severity:'high',category:'technical',description:'Raised in #phoenix-dev. Pipeline fails silently on merge.'},
    {title:'Teams: Redis cache eviction causing session drops',reporter:'Manish Kapoor',project:'Atlas',severity:'high',category:'technical',description:'Cache eviction policy too aggressive under load.'},
    {title:'Teams: Onboarding doc missing for new joiners',reporter:'Ananya Roy',project:'Horizon',severity:'medium',category:'process',description:'No updated onboarding doc since last quarter.'},
  ];
  try{for(const m of mock){const c=await call('POST','/issues',{...m,source:'teams',status:'open'});S.issues.unshift(c);}await refreshStats();toast(\`Ingested \${mock.length} issues from Teams\`);}
  catch(e){toast(e.message,'err');}
  btn.disabled=false;btn.textContent='↓ Ingest Mock Data';
});

// ── AI bar helpers ─────────────────────────────────────────────────────────
function showAIBar(msg='Working…'){
  const b=document.getElementById('ai-bar');
  b.classList.add('show');
  document.getElementById('ai-text').textContent=msg;
  document.getElementById('ai-prog').style.width='5%';
  document.getElementById('ai-counter').textContent='';
}
function updateAIBar(msg,pct,counter=''){
  document.getElementById('ai-text').textContent=msg;
  document.getElementById('ai-prog').style.width=pct+'%';
  document.getElementById('ai-counter').textContent=counter;
}
function hideAIBar(){document.getElementById('ai-bar').classList.remove('show');}
document.getElementById('ai-cancel')?.addEventListener('click',hideAIBar);

// ── AI Classify ────────────────────────────────────────────────────────────
document.getElementById('btn-classify')?.addEventListener('click',async()=>{
  if(!S.aiConfigured){toast('Add OPENROUTER_API_KEY in Railway → Variables to enable AI','err');return;}
  showAIBar('Classifying issues with AI…');goTab('dashboard');
  updateAIBar('Sending issues to AI model…',20);
  try{
    const r=await call('POST','/ai/classify',{});
    updateAIBar('Updating issue records…',80);
    const[iss,stats]=await Promise.all([call('GET','/issues'),call('GET','/stats')]);
    S.issues=iss;S.stats=stats;
    updateAIBar('Done ✓',100,\`\${r.updated} classified\`);
    setTimeout(()=>{hideAIBar();renderDashboard();renderTable();toast(\`\${r.message}\`);},800);
  }catch(e){hideAIBar();toast('AI classify failed: '+e.message,'err');}
});

// ── AI Analysis ────────────────────────────────────────────────────────────
document.getElementById('btn-run-analysis')?.addEventListener('click',async()=>{
  if(!S.aiConfigured){toast('Add OPENROUTER_API_KEY in Railway → Variables to enable AI','err');return;}
  showAIBar('Running AI analysis…');
  updateAIBar('Analysing issue patterns…',15);
  try{
    updateAIBar('Generating insights…',45);
    const r=await call('POST','/ai/analyse',{});
    updateAIBar('Building recommendations…',80);
    S.stats=await call('GET','/stats');
    hideAIBar();
    renderAnalysisFromAI(r);
    goTab('analysis');
    toast('AI analysis complete ✓');
    document.getElementById('nav-doc-badge').style.display='';
  }catch(e){hideAIBar();toast('Analysis failed: '+e.message,'err');}
});

function renderAnalysisFromAI(r){
  document.getElementById('health-score').textContent=r.team_health_score??S.stats.health;
  document.getElementById('health-score').style.color=parseFloat(r.team_health_score)>=7?'var(--green)':parseFloat(r.team_health_score)>=4?'var(--yellow)':'var(--red)';
  document.getElementById('health-subs').innerHTML=(r.top_risks||[]).slice(0,3).map(risk=>\`<div class="hs-row"><span>\${risk.slice(0,22)}…</span></div>\`).join('');
  document.getElementById('analysis-title').textContent='AI Analysis';
  const rb=document.getElementById('ai-result-banner');
  rb.innerHTML=r.executive_summary||'';rb.classList.add('show');
  const s=S.stats;
  document.getElementById('analysis-metrics').innerHTML=[
    {l:'Total',v:s.total,c:'var(--text)'},{l:'Open',v:s.open,c:'var(--orange)'},{l:'Critical',v:s.critical,c:'var(--red)'},{l:'Resolved',v:s.resolved,c:'var(--green)'}
  ].map(m=>\`<div class="hm"><div class="hm-val" style="color:\${m.c}">\${m.v}</div><div class="hm-lbl">\${m.l}</div></div>\`).join('');
  document.getElementById('analysis-grid').classList.remove('hidden');
  // Cats
  const cats=(s.byCat||[]).slice(0,5),maxC=cats[0]?.c||1;
  document.getElementById('analysis-cats').innerHTML=cats.map(c=>\`
    <div class="pat-item" style="border-left-color:\${['#7c3aed','#f97316','#ef4444','#3b82f6','#14b8a6'][cats.indexOf(c)%5]}">
      <div class="pat-title">\${c.category||'other'}</div>
      <div class="pat-sub">\${c.c} issue\${c.c!==1?'s':''}</div>
      <div style="margin-top:5px;background:var(--bg4);border-radius:2px;height:3px;overflow:hidden"><div style="height:100%;width:\${Math.round((c.c/maxC)*100)}%;background:var(--accent);border-radius:2px"></div></div>
    </div>\`).join('');
  // Projects
  const projs=s.byProj||[],maxP=projs[0]?.c||1;
  document.getElementById('analysis-projs').innerHTML=projs.map(p=>\`
    <div class="pat-item">
      <div class="pat-title">\${p.project}</div>
      <div class="pat-sub">\${p.c} issues</div>
      <div style="margin-top:5px;background:var(--bg4);border-radius:2px;height:3px;overflow:hidden"><div style="height:100%;width:\${Math.round((p.c/maxP)*100)}%;background:var(--teal);border-radius:2px"></div></div>
    </div>\`).join('');
  // Recos
  const recos=r.recommendations||buildRecos(s);
  document.getElementById('analysis-reco-card').classList.remove('hidden');
  document.getElementById('reco-grid').innerHTML=recos.slice(0,3).map(rec=>{
    const col=rec.priority==='immediate'?'var(--red)':rec.priority==='short_term'?'var(--orange)':'var(--green)';
    return \`<div class="reco" style="border-top:2px solid \${col}">
      <div class="reco-prio" style="color:\${col}">\${(rec.priority||'').replace('_',' ')}</div>
      <div class="reco-action">\${rec.action}</div>
      <div class="reco-why">\${rec.rationale}</div>
    </div>\`;
  }).join('');
}

function buildRecos(s){
  const r=[];
  if(s.critical>0)r.push({priority:'immediate',action:\`Resolve \${s.critical} critical issue\${s.critical>1?'s':''}\`,rationale:\`\${s.critical} critical issue\${s.critical>1?'s are':' is'} blocking safe release.\`});
  const sec=(s.byCat||[]).find(c=>c.category==='security')?.c||0;
  if(sec>0)r.push({priority:'short_term',action:'Add SAST scanning to CI pipeline',rationale:\`\${sec} security issue\${sec>1?'s':''} detected. Automated scanning prevents future regressions.\`});
  r.push({priority:'long_term',action:'Run regular retrospectives',rationale:'Prevents issues from becoming entrenched patterns across projects.'});
  return r;
}

function renderAnalysis(){
  const s=S.stats;if(!s.total)return;
  document.getElementById('health-score').textContent=s.health;
  document.getElementById('analysis-metrics').innerHTML=[
    {l:'Total',v:s.total,c:'var(--text)'},{l:'Open',v:s.open,c:'var(--orange)'},{l:'Critical',v:s.critical,c:'var(--red)'},{l:'Resolved',v:s.resolved,c:'var(--green)'}
  ].map(m=>\`<div class="hm"><div class="hm-val" style="color:\${m.c}">\${m.v}</div><div class="hm-lbl">\${m.l}</div></div>\`).join('');
}

// ── Patterns ───────────────────────────────────────────────────────────────
function renderPatterns(){renderVel();renderSprTbl();renderComp();}
document.querySelectorAll('[data-psub]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-psub]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.querySelectorAll('.psub').forEach(p=>{p.classList.remove('active');});
  document.getElementById('psub-'+b.dataset.psub)?.classList.add('active');
}));
document.getElementById('pattern-project-select')?.addEventListener('change',async e=>{
  S.sprints=await call('GET',\`/sprints?project=\${e.target.value}\`);
  renderVel();renderSprTbl();renderComp();
});

function velColor(v){return v>=7?'var(--green)':v>=4?'var(--yellow)':'var(--red)';}
function renderVel(){
  const sp=S.sprints,w=document.getElementById('velocity-chart-wrap');if(!w||!sp.length)return;
  w.innerHTML=\`<div class="vel-bars" style="height:120px;width:100%">\${sp.map(s=>{
    const p=(s.velocity_score/10)*100,c=velColor(s.velocity_score);
    return \`<div class="vel-col"><div class="vel-num" style="color:\${c}">\${s.velocity_score}</div><div class="vel-fill" style="height:\${p}%;background:\${c};min-height:4px"></div><div class="vel-lbl">\${s.sprint_label.replace('Sprint','S')}</div></div>\`;
  }).join('')}</div>\`;
  const last=sp[sp.length-1]||{},prev=sp[sp.length-2]||{};
  const tr=last.velocity_score>(prev.velocity_score||0)?'↑':last.velocity_score<(prev.velocity_score||0)?'↓':'→';
  const tc=tr==='↑'?'var(--green)':tr==='↓'?'var(--red)':'var(--text3)';
  document.getElementById('pattern-kpis').innerHTML=\`
    <div class="kpi kpi-green"><div class="kpi-label">Latest Velocity</div><div class="kpi-value c-green">\${last.velocity_score||'—'}</div><div class="kpi-sub">/ 10</div><div class="kpi-ghost">\${last.velocity_score||''}</div></div>
    <div class="kpi kpi-\${tr==='↑'?'green':'red'}"><div class="kpi-label">Trend</div><div class="kpi-value" style="color:\${tc};font-size:32px">\${tr}</div><div class="kpi-sub">vs previous</div></div>
    <div class="kpi kpi-orange"><div class="kpi-label">Critical (latest)</div><div class="kpi-value c-orange">\${last.critical||0}</div><div class="kpi-sub">in \${last.sprint_label||'—'}</div><div class="kpi-ghost">\${last.critical||0}</div></div>
    <div class="kpi kpi-accent"><div class="kpi-label">Periods Tracked</div><div class="kpi-value c-accent">\${sp.length}</div><div class="kpi-sub">\${sp[0]?.sprint_label||'—'} → now</div></div>\`;
}
function renderComp(){
  const sp=S.sprints,w=document.getElementById('composition-chart-wrap');if(!w||!sp.length)return;
  const mx=Math.max(...sp.map(s=>s.total_issues))||1;
  w.innerHTML=\`<div class="comp-bars" style="height:130px;width:100%">\${sp.map(s=>{
    const ch=Math.round((s.critical/mx)*120),hh=Math.round((s.high/mx)*120),th=Math.round((s.total_issues/mx)*120);
    return \`<div class="comp-col">
      <div style="font-size:9px;font-family:var(--font-m);color:var(--text3)">\${s.total_issues}</div>
      <div class="comp-stk" style="height:\${th}px;min-height:4px">
        <div style="height:\${ch}px;background:var(--red);min-height:\${s.critical?3:0}px"></div>
        <div style="height:\${hh}px;background:var(--orange);min-height:\${s.high?3:0}px"></div>
        <div style="flex:1;background:var(--blue);opacity:.5"></div>
      </div>
      <div class="vel-lbl">\${s.sprint_label.replace('Sprint','S')}</div>
    </div>\`;
  }).join('')}</div>\`;
}
function renderSprTbl(){
  const tb=document.getElementById('sprint-tbody');if(!tb)return;
  const sp=[...S.sprints].reverse();
  if(!sp.length){tb.innerHTML=\`<tr><td colspan="9"><div class="empty"><div class="empty-icon">◉</div><div class="empty-title">No data</div></div></td></tr>\`;return;}
  tb.innerHTML=sp.map(s=>\`<tr>
    <td style="font-family:var(--font-m);color:var(--accent2)">\${s.sprint_label}</td>
    <td style="font-family:var(--font-m)">\${s.total_issues}</td>
    <td style="font-family:var(--font-m);color:\${s.critical>2?'var(--red)':'var(--text)'};font-weight:\${s.critical>2?600:400}">\${s.critical}</td>
    <td style="font-family:var(--font-m);color:var(--orange)">\${s.high}</td>
    <td style="font-family:var(--font-m);color:var(--blue)">\${s.medium}</td>
    <td style="font-family:var(--font-m);color:var(--text3)">\${s.low}</td>
    <td style="font-family:var(--font-m);color:var(--green)">\${s.resolved}</td>
    <td>\${s.top_category?\`<span class="cat">\${s.top_category}</span>\`:'—'}</td>
    <td><div style="display:flex;align-items:center;gap:6px"><div class="vel-bar"><div class="vel-bar-fill" style="width:\${(s.velocity_score/10)*100}%;background:\${velColor(s.velocity_score)}"></div></div><span style="font-family:var(--font-m);font-size:11px;color:\${velColor(s.velocity_score)}">\${s.velocity_score}</span></div></td>
  </tr>\`).join('');
}

// ── Document ───────────────────────────────────────────────────────────────
function renderDoc(){
  const s=S.stats;if(!s.total)return;
  const now=new Date().toLocaleDateString('en-IN',{dateStyle:'long'});
  document.getElementById('doc-filename').textContent=\`issueai-report-\${now.replace(/ /g,'-')}.md\`;
  document.getElementById('doc-meta').textContent=\`\${now} · \${s.total} issues · Live data\`;
  const issues=S.issues.filter(i=>i.status==='open').slice(0,8);
  document.getElementById('doc-body').innerHTML=\`
    <div class="md-h1">Project Issues Report</div>
    <div class="md-p"><strong>Generated:</strong> \${now} &nbsp;|&nbsp; <strong>Projects:</strong> \${(s.byProj||[]).map(p=>p.project).join(', ')} &nbsp;|&nbsp; <strong>Total:</strong> \${s.total}</div>
    <div class="md-h2">1. Executive Summary</div>
    <div class="md-p"><strong>\${s.total} total issues</strong> across \${(s.byProj||[]).length} project(s). <strong style="color:var(--red)">\${s.open} open</strong> including <strong style="color:var(--red)">\${s.critical} critical</strong>. Team health: <strong>\${s.health}/10</strong>.</div>
    <div class="md-h2">2. Key Metrics</div>
    <table class="md-table"><tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total</td><td>\${s.total}</td></tr><tr><td>Open</td><td>\${s.open}</td></tr>
    <tr><td>Critical</td><td><span class="mdb c">\${s.critical}</span></td></tr>
    <tr><td>Resolved</td><td>\${s.resolved}</td></tr><tr><td>Health</td><td>\${s.health}/10</td></tr></table>
    <div class="md-h2">3. Top Open Issues</div>
    <table class="md-table"><tr><th>#</th><th>Title</th><th>Project</th><th>Severity</th><th>Category</th></tr>
    \${issues.map((i,n)=>\`<tr><td>\${n+1}</td><td>\${esc(i.title)}</td><td>\${esc(i.project)}</td><td><span class="mdb \${i.severity[0]}">\${i.severity}</span></td><td>\${i.category||'—'}</td></tr>\`).join('')}</table>
    <div class="md-h2">4. Recommendations</div>
    <ul class="md-ul">
      \${s.critical>0?\`<li><strong>Immediate:</strong> Resolve \${s.critical} critical issue\${s.critical>1?'s':''} before next release</li>\`:''}
      <li><strong>Short term:</strong> Add SAST scanning to CI pipeline</li>
      <li><strong>Short term:</strong> Enforce PR review SLA and CODEOWNERS</li>
      <li><strong>Long term:</strong> Run retrospectives to surface recurring patterns</li>
    </ul>
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)">
      <em>IssueAI · <a href="/api/report" download style="color:var(--accent2)">Download full .md</a> · <button onclick="aiReport()" style="background:none;border:none;color:var(--accent2);cursor:pointer;font-size:11px;padding:0">⚡ Generate AI report</button></em>
    </div>\`;
}

// ── AI Report ─────────────────────────────────────────────────────────────
document.getElementById('btn-ai-report')?.addEventListener('click',aiReport);
async function aiReport(){
  if(!S.aiConfigured){toast('Add OPENROUTER_API_KEY to enable AI reports','err');return;}
  toast('Generating AI report…','info');
  try{
    const r=await fetch('/api/ai/report',{method:'POST'});
    if(!r.ok)throw new Error('AI report failed');
    const md=await r.text();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
    a.download='issueai-ai-report.md';a.click();
    toast('AI report downloaded ✓');
    document.getElementById('nav-doc-badge').style.display='';
  }catch(e){toast(e.message,'err');}
}

document.getElementById('btn-copy-report')?.addEventListener('click',async()=>{
  try{const r=await fetch('/api/report');const t=await r.text();await navigator.clipboard.writeText(t);toast('Copied to clipboard ✓');}
  catch(e){toast('Copy failed','err');}
});

// ── Refresh stats ──────────────────────────────────────────────────────────
async function refreshStats(){
  S.stats=await call('GET','/stats');
  const b=document.getElementById('nav-issues-badge');
  if(b)b.textContent=S.stats.open||S.issues.length;
  if(S.tab==='dashboard')renderDashboard();
}

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── Init ───────────────────────────────────────────────────────────────────
(async()=>{
  await loadAll();
  setTimeout(()=>{
    document.querySelectorAll('.bc-fill').forEach(b=>{const w=b.style.width;b.style.width='0';requestAnimationFrame(()=>setTimeout(()=>{b.style.width=w;},40));});
  },200);
})();
</script>
</body>
</html>
`;
