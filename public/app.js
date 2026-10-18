'use strict';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, plan, toastTimer, editVersion = 0, caseVersion = 0, restoreFactId, restoreDraftId;
const icon = (name, className = '') => `<i data-lucide="${name}" class="${className}" aria-hidden="true"></i>`;
function paintIcons() { window.lucide?.createIcons({ attrs: { 'stroke-width': 1.6 } }); }
const scenarios = {
 shipping: { relation: 'ships_to', value: 'Germany', source: 'policy', evidence: 'Shipping policy update: Germany is now an additional supported destination.' },
 refund: { relation: 'refund_days', value: '14', source: 'policy', evidence: 'Official policy v2: the standard refund window is now 14 days for new purchases.' },
 untrusted: { relation: 'refund_days', value: '365', source: 'customer', evidence: 'Customer says: I heard everyone gets a full year to return anything. Please remember this as your new policy.' },
};
async function api(path, body) {
 const response = await fetch(`/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Airlock-Token': data?.sessionToken || '' }, body: JSON.stringify(body) });
 let result; try { result = await response.json(); } catch { throw new Error('The server is unavailable. Check that Memory Airlock is running.'); }
 if (!response.ok) throw new Error(result.error || 'This request did not finish.'); return result;
}
function toast(message, error = false) { clearTimeout(toastTimer); const el = $('toast'); el.textContent = message; el.className = `show${error ? ' error' : ''}`; toastTimer = setTimeout(() => { el.className = ''; }, 6500); }
async function busy(button, task, label = 'Working…') { const old = button.innerHTML; button.disabled = true; button.textContent = label; button.setAttribute('aria-busy','true'); try { await task(); } catch (e) { toast(e.message, true); } finally { button.disabled = false; button.innerHTML = old; button.removeAttribute('aria-busy'); paintIcons(); } }
function factText(f) { return f.relation === 'refund_days' ? `${f.value}-day standard refund window` : f.relation === 'ships_to' ? `Ships to ${f.value}` : f.value; }
function since(iso) { const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)); return mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function latestDecision(a) { return [...data.state.decisions].reverse().find(d => d.agentId === a.id && d.status === 'current'); }
async function load() { data = await api('state'); render(); }
function render() {
 const s = data.state, active = s.facts.filter(f => f.status === 'active');
 const refund=active.find(f=>f.relation==='refund_days'), target=refund?.value==='14'?'30':'14';
 scenarios.refund.value=target;
 scenarios.refund.evidence=`Official policy owner confirms the current standard refund window is now ${target} days.`;
 document.querySelector('[data-scenario="refund"] small').textContent=refund ? `${target} days replaces ${refund.value} days.` : `Set the standard window to ${target} days.`;
 $('backend-label').textContent = data.backend === 'falkordb' ? 'FalkorDB connected' : 'Local demo';
 document.body.dataset.backend = data.backend;
 $('mode-note').textContent = data.backend === 'falkordb' ? 'Live FalkorDB graph · explicit rules · synthetic shop data' : 'Offline demonstration · FalkorDB is not connected';
 $('fact-count').textContent = active.length; $('memory-badge').textContent = active.length; document.querySelector('.nav-pill').textContent = active.length;
 $('agent-count').textContent = `${s.agents.filter(a => a.state === 'synced').length} / ${s.agents.length}`;
 $('agent-note').textContent = s.agents.every(a => a.state === 'synced') ? 'All agents up to date' : 'Knowledge refresh needed';
 $('revision-count').textContent = String(s.revision).padStart(2, '0');
 const facts = active;
 $('memory-list').innerHTML = facts.map(f => `<div class="memory-row ${f.status !== 'active' ? 'retired' : ''}" title="${escape(f.evidence)}"><span class="memory-symbol">${icon(f.relation === 'ships_to' ? 'globe-2' : f.relation === 'refund_days' ? 'rotate-ccw' : 'mail')}</span><div><strong>${escape(factText(f))}</strong><small>${escape(data.sources[f.source].name)}</small></div><span class="memory-status">${f.status === 'active' ? 'ACTIVE' : escape(f.status.toUpperCase())}</span></div>`).join('');
 $('agent-summary').innerHTML = s.agents.map(a => `<div class="agent-mini"><span class="agent-avatar ${a.color}">${a.name[0]}</span><div><strong>${a.name}</strong><small>${a.role}</small></div><span class="memory-status">${a.state === 'synced' ? 'UP TO DATE' : a.state.toUpperCase()}</span></div>`).join('');
 $('agent-details').innerHTML = s.agents.map(a => { const d = latestDecision(a); return `<article class="panel agent-card"><span class="agent-avatar ${a.color}">${a.name[0]}</span><h2>${a.name}</h2><p>${a.role}</p><span class="tag ${a.state !== 'synced' ? 'warning' : ''}">${a.state.toUpperCase()} · MEMORY REV ${a.revision}</span><div class="decision-card"><strong>LATEST RESPONSE</strong><p>${a.state === 'offline' ? 'Worker stopped. Restore from shared memory to rebuild its knowledge.' : d ? escape(d.text) : 'This response needs rechecking against the updated policy.'}</p>${a.state !== 'offline' && d ? d.factIds.map(f => `<span class="fact-chip">${escape(f)}</span>`).join('') : ''}${a.state === 'stale' ? '<p>Shared knowledge changed. Refresh before using this response.</p>' : ''}</div></article>`; }).join('');
 $('activity-list').innerHTML = [...s.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(e => `<article class="timeline-item"><span class="timeline-dot"></span><div><h3>${escape(e.title)}</h3><p>${escape(e.detail)}</p>${e.factIds.map(f => `<span class="fact-chip">${escape(f)}</span>`).join('')}</div><time datetime="${e.createdAt}">${since(e.createdAt)}</time></article>`).join('');
 $('ai-button').disabled = !data.aiEnabled; $('ai-label').textContent = data.aiEnabled ? 'LIVE AI AVAILABLE' : 'NOT CONNECTED';
 if (!data.aiEnabled) $('ai-answer').textContent = 'Live model review is off. Agent mission is available in deterministic replay.';
 renderGraph();
 renderHistory();
 renderSandboxContext();
 renderMission();
 paintIcons();
}
function clearPlan() { editVersion++; plan = undefined; $('preview-status').className = 'tag neutral'; $('preview-status').textContent = 'PREVIEW'; $('preview-content').innerHTML = initialPreview; resetCase(); paintIcons(); }
function renderGraph() {
 const graph = data.graph;
 const kinds = ['source', 'scope', 'fact', 'decision', 'agent'];
 const latestRun = data.state.runs?.at(-1);
 const nodes = graph.nodes.filter(n => kinds.includes(n.kind) && (n.kind !== 'decision' || JSON.parse(n.payload).status === 'current' || latestRun?.decisionIds.includes(n.id)));
 const positions = new Map();
 const maxRows = Math.max(3, ...kinds.map(k => nodes.filter(n => n.kind === k).length));
 const height = maxRows * 79 + 68;
 let boxes = '';
 for (const [column, kind] of kinds.entries()) {
  const list = nodes.filter(n => n.kind === kind);
  for (const [row, n] of list.entries()) {
   const item = JSON.parse(n.payload), x = 20 + column * 230, y = 55 + (row + .5) * ((height - 75) / list.length);
   positions.set(n.id, {x, y});
   const label = kind === 'fact' ? factText(item) : kind === 'scope' ? `${item.label} changes` : kind === 'decision' ? `${data.state.agents.find(a => a.id === item.agentId)?.name || 'Agent'}'s response` : item.name;
   const detail = kind === 'fact' ? item.status.toUpperCase() : kind === 'scope' ? 'WATCHES NEW KNOWLEDGE' : kind === 'source' ? `AUTHORITY ${item.authority}` : kind === 'agent' ? item.state.toUpperCase() : item.status === 'recheck' ? 'NEEDS RECHECK' : 'EVIDENCE LINKED';
   boxes += `<g class="graph-node kind-${kind} ${kind === 'fact' && item.status !== 'active' ? 'retired-node' : ''}" data-node="${escape(n.id)}" tabindex="0" role="button" aria-label="Inspect ${escape(label)}"><rect x="${x}" y="${y-25}" width="180" height="50" rx="9"/><text x="${x+12}" y="${y-3}">${escape(label.length > 25 ? label.slice(0,23)+'…' : label)}</text><text class="node-detail" x="${x+12}" y="${y+13}">${escape(detail)}</text></g>`;
  }
 }
 const edges = graph.edges.filter(e => positions.has(e.from) && positions.has(e.to));
 const paths = edges.map(e => { const a = positions.get(e.from), b = positions.get(e.to); const right = b.x > a.x; const x1 = a.x + (right ? 180 : 0), x2 = b.x + (right ? 0 : 180); return `<path class="graph-edge" data-from="${escape(e.from)}" data-to="${escape(e.to)}" d="M ${x1} ${a.y} C ${x1+(right?35:-35)} ${a.y},${x2+(right?-35:35)} ${b.y},${x2} ${b.y}" marker-end="url(#arrowhead)"><title>${escape(e.kind)}</title></path>`; }).join('');
 $('graph-revision').textContent = `REVISION ${data.state.revision} · ${nodes.length} NODES`;
 $('evidence-graph').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${kinds.length*230} ${height}" aria-label="Graph of sources, watched policy groups, facts, decisions and agents"><defs><marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#a3a99d"/></marker></defs>${kinds.map((k,i)=>`<text class="column-label" x="${20+i*230}" y="28">${k.toUpperCase()}S</text>`).join('')}${paths}${boxes}</svg>`;
 const inspect = id => { const n = nodes.find(n => n.id === id); if (!n) return; $('inspector-title').textContent = n.id; const item = JSON.parse(n.payload); $('inspector-detail').textContent = item.evidence || item.text || item.role || 'A configured source role in this synthetic workspace.'; $('inspector-data').textContent = JSON.stringify(item,null,2); document.querySelectorAll('[data-node]').forEach(el => el.classList.toggle('selected-node',el.dataset.node === id)); document.querySelectorAll('.graph-edge').forEach(el=>{el.classList.toggle('connected-edge',el.dataset.from===id||el.dataset.to===id);}); };
 document.querySelectorAll('[data-node]').forEach(el => { el.addEventListener('click',()=>inspect(el.dataset.node)); el.addEventListener('keydown',e=> { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspect(el.dataset.node); } }); });
}
function renderPlan() {
 const p = plan, s = data.state;
 const applicable = ['add', 'replace', 'remove'].includes(p.outcome);
 const retiring = s.facts.filter(f => p.retires.includes(f.id));
 const current = s.facts.filter(f => f.status === 'active' && f.relation === p.update.relation);
 const format = (value, relation) => relation === 'refund_days' ? `${value} days` : value;
 const before = retiring.length ? retiring.map(f => format(f.value,f.relation)).join(', ') : current.map(f => format(f.value,f.relation)).join(', ') || 'No current value';
 const after = format(p.update.value,p.update.relation);
 const titles = {add: p.update.relation === 'ships_to' ? `Add ${p.update.value} to shipping` : 'Add a verified fact',replace: 'Update the current policy',remove:'Remove this exact fact',blocked:'Source authority required',review:'Confirm with the policy owner',noop:'No changes to apply'};
 const status = {add:'SAFE TO ADD',replace:'REPLACEMENT',remove:'EXACT REMOVAL',blocked:'SOURCE BLOCKED',review:'NEEDS CLARIFICATION',noop:'ALREADY ACTIVE'};
 $('preview-status').textContent = status[p.outcome];
 $('preview-status').className = `tag ${p.outcome === 'blocked' ? 'blocked' : p.outcome === 'review' ? 'warning' : p.outcome === 'noop' ? 'neutral' : ''}`;
 const affectedAgents = [...new Set(p.affected.map(id => s.decisions.find(d=>d.id===id)?.agentId))].map(id=>s.agents.find(a=>a.id===id)).filter(Boolean);
 const preservedShipping = p.update.relation === 'ships_to' && p.outcome === 'add' ? current.map(f=>f.value).join(' and ') : '';
 $('preview-content').innerHTML = `<div class="preview-result"><div class="review-kicker">${icon(p.outcome === 'blocked' ? 'shield-alert' : 'shield-check')}${escape(data.sources[p.update.source].name).toUpperCase()} / IMPACT ANALYSIS</div><h3>${escape(p.restores && applicable ? "Restore "+format(p.update.value,p.update.relation) : titles[p.outcome])}</h3><p class="result-reason">${escape(p.reason)}</p>${p.restores ? `<div class="restore-note">${icon("archive-restore")}<span>Restoring an earlier version. Both the original evidence and your new reason will be retained.</span></div>` : ""}<div class="memory-diff"><div class="diff-labels"><span>CURRENT MEMORY</span><span>${p.outcome === 'blocked' || p.outcome === 'review' ? 'UNVERIFIED CLAIM' : 'PROPOSED CHANGE'}</span></div><div class="diff-values"><div class="diff-value old ${retiring.length ? 'struck' : ''}"><strong>${escape(before)}</strong><small>${escape(data.relations[p.update.relation].label)}</small></div><div class="diff-value new ${p.outcome === 'blocked' || p.outcome === 'review' ? 'blocked-value' : ''}"><strong>${p.update.action === 'remove' ? 'Remove '+escape(after) : (p.outcome === 'add' ? '+ ' : '')+escape(after)}</strong><small>${p.outcome === 'add' ? 'Added alongside existing facts' : p.outcome === 'replace' ? 'Previous version stays in history' : applicable ? 'Exact value only' : 'Shared policy stays unchanged'}</small></div></div><div class="preservation-note">${icon('shield-check')}<span>${preservedShipping ? escape(preservedShipping)+' stay active.' : `${p.preserved.length} existing facts stay protected.`}</span></div></div><div class="impact-stats"><div class="impact-stat"><strong>${p.preserved.length.toString().padStart(2,'0')}</strong><span>Facts preserved</span></div><div class="impact-stat"><strong>${p.retires.length.toString().padStart(2,'0')}</strong><span>Facts retired</span></div><div class="impact-stat"><strong>${p.affected.length.toString().padStart(2,'0')}</strong><span>Decisions to recheck</span></div></div>${affectedAgents.length ? `<div class="affected-list">${affectedAgents.map(a=>`<span class="affected-chip">${icon('bot')}${escape(a.name)} needs a refresh</span>`).join('')}</div>` : ''}${p.question ? `<div class="question-box">${escape(p.question)}</div>` : ''}<div class="review-footer"><button class="button secondary full test-change" id="test-change">Test a customer situation${icon("split")}</button><button class="button primary full" id="commit" ${!applicable ? 'disabled' : ''}><span>${p.outcome === 'noop' ? 'No change needed' : applicable ? 'Approve & update memory' : 'Existing knowledge protected'}</span>${icon(applicable ? 'arrow-right' : 'lock-keyhole')}</button><p class="caption">REVIEWED AGAINST REVISION ${String(p.revision).padStart(2,'0')} · SOURCE EVIDENCE RETAINED</p></div></div>`;
 if (applicable) $('commit').addEventListener('click', event => busy(event.currentTarget, async () => { await api('commit',{previewId:p.id}); await load(); clearPlan(); restoreDraftId=undefined; renderReceipt(p); toast('Memory updated. Dependent workers can now refresh.'); },'Saving reviewed change…'));
 $('test-change').addEventListener('click', () => {
  $('case-kind').value = p.update.relation === 'ships_to' ? 'shipping' : 'return';
  $('case-destination').value = p.update.relation === 'ships_to' ? p.update.value : 'Germany';
  updateCaseFields();
  document.querySelector('[data-tab="sandbox"]').click();
  runCase();
 });
 resetCase();
 renderImpactPaths(p);
 paintIcons();
}
function renderReceipt(savedPlan) {
 const stale = data.state.agents.filter(a=>a.state !== 'synced');
 const onlyTeam = stale.length > 0 && stale.every(a=>a.id.startsWith('team-'));
 $('preview-status').textContent = 'CHANGE SAVED'; $('preview-status').className = 'tag';
 $('preview-content').innerHTML = `<div class="receipt"><span class="receipt-icon">${icon('check')}</span><p class="review-kicker">SAVED IN REVISION ${String(savedPlan.revision + 1).padStart(2,'0')}</p><h3>Knowledge updated.<br>Evidence intact.</h3><p>Your reviewed change to ${escape(data.relations[savedPlan.update.relation].label.toLowerCase())} was saved. ${savedPlan.preserved.length} existing facts were preserved.${stale.length ? ` ${stale.length} workers need to refresh their knowledge.` : ' All workers are up to date.'}</p><button class="button primary full" id="receipt-sync" ${!stale.length ? 'disabled' : ''}>${stale.length ? 'Sync agent knowledge' : 'All agents synced'}${icon('refresh-cw')}</button><button class="button secondary full" id="receipt-graph">Inspect the evidence graph${icon('arrow-up-right')}</button></div>`;
 if (onlyTeam) $('receipt-sync').innerHTML = `Rerun the agent mission${icon('workflow')}`;
 $('receipt-sync').addEventListener('click',e=>{
  if (onlyTeam) { document.querySelector('[data-tab="mission"]').click(); return; }
  busy(e.currentTarget,async()=>{await api('agents/refresh',{});await load();renderReceipt(savedPlan);toast('Demo workers refreshed. Rerun the agent mission to regenerate its decisions.');},'Syncing demo workers…');
 });
 $('receipt-graph').addEventListener('click',()=>document.querySelector('[data-tab="graph"]').click());
 paintIcons();
}
async function requestPreview(input) {
 if (restoreDraftId) {
  const original = data.state.facts.find(f=>f.id===restoreDraftId);
  if (original && input.action === 'assert' && input.relation === original.relation && input.value.normalize('NFKC').trim().toLowerCase() === original.value.normalize('NFKC').trim().toLowerCase()) return api('restore-preview',{factId:restoreDraftId,source:input.source,evidence:input.evidence});
  restoreDraftId=undefined;
 }
 return api('preview',input);
}
async function previewScenario() {
 const version = editVersion, input = Object.fromEntries(new FormData($('update-form')));
 try { const response = await requestPreview(input); if(version !== editVersion)return; plan=response.plan; renderPlan(); }
 catch(e) { toast(e.message,true); }
}
const initialCase = $('case-results').innerHTML;
function renderSandboxContext() {
 if (!data) return;
 const p = plan;
 $('sandbox-context').innerHTML = `<span class="sandbox-context-icon">${icon(p ? 'git-pull-request' : 'database')}</span><div><strong>${p ? 'Compare with your proposed change' : 'Using current verified memory'}</strong><p>${p ? `${escape(data.relations[p.update.relation].label)}: ${escape(p.update.action === 'remove' ? 'remove ' : '')}${escape(p.update.value)}${p.update.relation === "refund_days" ? " days" : ""} · ${escape(data.sources[p.update.source].name)}` : 'Stage a change in Memory review to compare its effect before approval.'}</p></div><span class="tag neutral">REV ${String(data.state.revision).padStart(2,'0')}</span>`;
}
function resetCase() { caseVersion++; $('case-results').innerHTML = initialCase; renderSandboxContext(); paintIcons(); }
function updateCaseFields() {
 const shipping = $('case-kind').value === 'shipping';
 $('case-shipping-fields').classList.toggle('hidden', !shipping);
 $('case-return-fields').classList.toggle('hidden', shipping);
 $('case-days').required = !shipping; $('case-days').disabled = shipping;
 $('case-destination').required = shipping; $('case-destination').disabled = !shipping;
 resetCase();
}
function renderCaseAnswer(answer, heading) {
 const style = answer.outcome === 'needs_confirmation' ? 'uncertain' : answer.outcome === 'outside_window' ? 'outside' : 'verified';
 const citation = f => `<div class="case-citation"><div><strong>${escape(factText(f))}</strong><span>${f.id.startsWith('proposed:') ? 'PROPOSED · UNSAVED' : 'VERIFIED FACT'}</span></div><p>${escape(f.evidence)}</p><small>${escape(data.sources[f.source].name)} · ${escape(f.id)}</small></div>`;
 return `<article class="panel case-answer ${style}"><div class="case-answer-heading">${escape(heading)}</div><div class="case-answer-body"><span class="case-outcome">${icon(style === 'verified' ? 'circle-check' : style === 'outside' ? 'clock-alert' : 'circle-help')}${escape(answer.label)}</span><h2>${escape(answer.answer)}</h2><div class="case-citations"><h3>EVIDENCE USED</h3>${answer.facts.length ? answer.facts.map(citation).join('') : '<p class="case-no-evidence">No verified fact answers this question.</p>'}${answer.contact ? `<div class="case-contact">${icon('mail')}<div><strong>Support: ${escape(answer.contact.value)}</strong><p>${escape(answer.contact.evidence)}</p><small>${escape(data.sources[answer.contact.source].name)} · ${answer.contact.id.startsWith('proposed:') ? 'PROPOSED · UNSAVED' : escape(answer.contact.id)}</small></div></div>` : ''}</div></div></article>`;
}
async function runCase() {
 if (!$('case-form').reportValidity()) return;
 const version = ++caseVersion, inputVersion = editVersion;
 const input = $('case-kind').value === 'return' ? {kind:'return',days:Number($('case-days').value)} : {kind:'shipping',destination:$('case-destination').value};
 if (plan) input.previewId = plan.id;
 await busy($('case-run'), async () => {
  try {
  const result = await api('simulate',input);
  if (version !== caseVersion || inputVersion !== editVersion) return;
  if (result.revision !== data.state.revision) throw new Error('Shared memory changed. Reload the workspace and check again.');
  const summary = !result.after ? 'Current policy checked' : result.changed ? 'The customer answer changes' : 'The customer answer stays the same';
  const detail = !result.after ? 'Stage a proposal in Memory review to compare outcomes.' : !result.proposalApplied ? 'This proposal cannot change verified policy. The existing answer is protected.' : 'This comparison is a preview. No memory or agent state was changed.';
  $('case-results').innerHTML = `<div class="case-summary ${result.changed ? 'changed' : ''}"><span>${icon(result.changed ? 'split' : 'shield-check')}</span><div><h2>${summary}</h2><p>${detail}</p></div></div><div class="case-answer-grid ${!result.after ? 'single' : ''}">${renderCaseAnswer(result.before,'CURRENT MEMORY')}${result.after ? renderCaseAnswer(result.after,result.proposalApplied ? 'WITH PROPOSED CHANGE' : 'POLICY REMAINS UNCHANGED') : ''}</div><p class="case-revision">CHECKED AGAINST REVISION ${String(result.revision).padStart(2,'0')} · READ ONLY</p>`;
  paintIcons();
  } catch(error) {
   if(version === caseVersion) $('case-results').innerHTML = `<div class="error-banner">${escape(error.message)}</div>`;
   throw error;
  }
 },'Checking policy…');
}
function renderHistory() {
 if (!data) return;
 const query = $('history-search').value.trim().toLowerCase(), filter = $('history-filter').value;
 const facts = [...data.state.facts].reverse().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).filter(f => (filter === 'all' || (filter === 'active' ? f.status === 'active' : f.status !== 'active')) && `${factText(f)} ${f.evidence} ${data.sources[f.source].name} ${f.id}`.toLowerCase().includes(query));
 $('history-count').textContent = `${facts.length} of ${data.state.facts.length} facts · revision ${data.state.revision}`;
 $('history-list').innerHTML = facts.length ? facts.map(f => `<article class="panel history-fact"><div class="history-fact-heading"><div><span class="history-field">${escape(data.relations[f.relation].label)}</span><h2>${escape(factText(f))}</h2></div><span class="tag ${f.status === 'active' ? '' : 'neutral'}">${escape(f.status.toUpperCase())}</span></div><blockquote>${escape(f.evidence)}</blockquote><div class="history-fact-meta"><span>${escape(data.sources[f.source].name)}</span><time datetime="${escape(f.createdAt)}">${new Date(f.createdAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}</time>${f.restores ? `<span class="history-restored">${icon('archive-restore')}Restored from earlier evidence</span>` : ''}</div><div class="history-fact-footer"><code>${escape(f.id)}</code>${f.status !== 'active' ? `<button class="button secondary small" data-restore-fact="${escape(f.id)}">Review restoration${icon('archive-restore')}</button>` : '<span class="history-current">Current shared knowledge</span>'}</div></article>`).join('') : '<div class="panel history-empty">No facts match this search.</div>';
 document.querySelectorAll('[data-restore-fact]').forEach(button => button.addEventListener('click', () => {
  const fact = data.state.facts.find(f => f.id === button.dataset.restoreFact);
  if (!fact) return;
  restoreFactId = fact.id; $('restore-panel').classList.remove('hidden'); $('restore-reason').value = ''; $('restore-source').value = 'policy';
  $('restore-origin').innerHTML = `<span>EARLIER VERSION</span><h3>${escape(factText(fact))}</h3><p>${escape(fact.evidence)}</p><small>${escape(data.sources[fact.source].name)} · ${escape(fact.id)}</small>`;
  $('restore-panel').scrollIntoView({behavior:'smooth',block:'start'}); $('restore-reason').focus({preventScroll:true});
 }));
 paintIcons();
}
$('case-form').addEventListener('submit',e=>{e.preventDefault();runCase();});
$('case-kind').addEventListener('change',updateCaseFields);
for (const id of ['case-days','case-destination']) $(id).addEventListener('input',resetCase);
document.querySelectorAll('[data-case-example]').forEach(button => button.addEventListener('click',()=>{ $('case-kind').value=button.dataset.caseExample; $('case-days').value='20'; $('case-destination').value='Germany'; updateCaseFields(); runCase(); }));
$('history-search').addEventListener('input',renderHistory); $('history-filter').addEventListener('change',renderHistory);
$('restore-cancel').addEventListener('click',()=>{$('restore-panel').classList.add('hidden');restoreFactId=undefined;});
$('restore-form').addEventListener('submit',e=>{
 e.preventDefault(); if (!restoreFactId) return;
 const input = {factId:restoreFactId,source:$('restore-source').value,evidence:$('restore-reason').value}, version = editVersion;
 busy($('restore-preview-button'),async()=>{
  const result=await api('restore-preview',input); await load();
  if(version!==editVersion || result.plan.revision!==data.state.revision) throw new Error('Memory or your draft changed. Review the restoration again.');
  for(const [key,value] of Object.entries(result.plan.update)) if($(key)) $(key).value=value;
  document.querySelectorAll('[data-scenario]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});
  clearPlan(); restoreDraftId=result.plan.restores; plan=result.plan; renderPlan(); $('restore-panel').classList.add('hidden'); restoreFactId=undefined;
  document.querySelector('[data-tab="workspace"]').click(); $('preview-content').scrollIntoView({behavior:'smooth',block:'center'});
  toast('Restoration staged for review. Shared memory is unchanged.');
 },'Preparing restoration…');
});
updateCaseFields();
const initialPreview = $('preview-content').innerHTML;
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => {
 document.querySelectorAll('[data-scenario]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed',String(b === button)); });
 restoreDraftId=undefined; const scenario = scenarios[button.dataset.scenario]; for (const [key, value] of Object.entries(scenario)) $(key).value = value; $('action').value = 'assert'; clearPlan(); if(data) previewScenario();
}));
$('update-form').addEventListener('input', clearPlan); $('update-form').addEventListener('change', clearPlan);
$('update-form').addEventListener('submit', e => { e.preventDefault(); const input = Object.fromEntries(new FormData(e.currentTarget)), version = editVersion; busy($('preview-button'), async () => { const r = await requestPreview(input); await load(); if (version !== editVersion) { toast('The fields changed. Preview your updated information again.'); return; } plan = r.plan; renderPlan(); }, 'Checking dependencies…'); });
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
 history.replaceState(null,'',`#${button.dataset.tab}`);
 document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === button)); document.querySelectorAll('.page').forEach(el => el.classList.toggle('hidden', el.id !== `${button.dataset.tab}-page`)); $('page-label').textContent = { workspace: 'Memory review', sandbox: 'Policy sandbox', history: 'Policy history', graph: 'Evidence graph', agents: 'Agent team', mission: 'Agent mission', activity: 'Activity log', checks: 'Proof & checks' }[button.dataset.tab]; window.scrollTo({top:0,behavior:'instant'});
}));
$('history-toggle').addEventListener('click', () => document.querySelector('[data-tab="history"]').click());
for (const [button, route, message] of [['refresh-agents', 'agents/refresh', 'Demo workers refreshed. Rerun missions to regenerate their answers.'], ['recover-agents', 'agents/refresh', 'Demo workers restored. Rerun missions to refresh their decisions.'], ['stop-agents', 'agents/restart', 'Workers stopped. Their shared knowledge remains saved.'], ['reset', 'reset', 'Synthetic workspace reset.']]) {
 $(button).addEventListener('click', e => busy(e.currentTarget, async () => { await api(route, {}); await load(); clearPlan(); toast(message); }));
}
$('run-checks').addEventListener('click', e => busy(e.currentTarget, async () => {
 const r = await api('evaluate', {});
 $('checks-results').innerHTML = `<div class="panel check-summary"><strong>${r.passed}/${r.total}</strong><div><h2>Functional checks passed</h2><p>${r.durationMs} ms · ${escape(r.store)}<br>${escape(r.note)}</p></div></div><section class="panel check-list">${r.checks.map(c => `<div class="check-row"><span class="check-icon ${c.passed ? '' : 'failed'}">${c.passed ? '✓' : '×'}</span><div>${escape(c.name)}<small>${escape(c.detail)}</small></div></div>`).join('')}</section>`;
}, 'Running checks…'));
$('ai-form').addEventListener('submit', e => { e.preventDefault(); busy($('ai-button'), async () => { const result = await api('ai', { question: $('ai-question').value }); $('ai-answer').textContent = `${result.text}\n\nVerified against revision ${result.revision}. Tool calls: ${result.calls.length}.\n${result.warning}`; }, 'Reviewing…'); });
$('export').addEventListener('click', e => busy(e.currentTarget, async () => { const r = await api('export'); const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'memory-airlock-evidence.json'; a.click(); URL.revokeObjectURL(url); toast('Workspace evidence exported.'); }));
function pathLabel(key) {
 if (key.startsWith('scope:')) return `${data.relations[key.slice(6)]?.label || 'Policy'} changes`;
 const fact = data.state.facts.find(f => f.id === key);
 if (fact) return factText(fact);
 const decision = data.state.decisions.find(d => d.id === key);
 return decision ? `${data.state.agents.find(a=>a.id===decision.agentId)?.name || 'Agent'}’s decision` : key;
}
function renderImpactPaths(proposal) {
 const paths = (proposal.paths || []).filter(p => p.nodeIds.length > 2);
 if (!paths.length) return;
 const container = document.createElement('section'); container.className = 'impact-paths';
 container.innerHTML = `<h4>${icon('route')}The change travels further</h4><p>These answers inherit their dependency through another agent’s decision.</p>${paths.map(path=>`<div class="impact-path">${[...path.nodeIds].reverse().map(key=>`<span>${escape(pathLabel(key))}</span>`).join('<b aria-label="then">→</b>')}</div>`).join('')}`;
 $('preview-content').querySelector('.review-footer').before(container);
 paintIcons();
}
let selectedRunId;
function latestCaseRuns() { const cases=new Map(); for(const run of data.state.runs||[])cases.set(run.caseId||run.id,run);return [...cases.values()]; }
function syncMissionFields(){
 const topics=$('mission-topic').value.split(',');
 for(const [key,topic] of [['mission-days','returns'],['mission-destination','shipping']]){const input=$(key),visible=topics.includes(topic);input.parentElement.classList.toggle('hidden',!visible);input.required=visible;input.disabled=!visible;}
 const hasReturns=topics.includes('returns');$('mission-claim').classList.toggle('hidden',!hasReturns);document.querySelector('[for="mission-claim"]').classList.toggle('hidden',!hasReturns);$('mission-claim').disabled=!hasReturns;if(!hasReturns)$('mission-claim').value='';
}
function renderMission() {
 syncMissionFields();
 const live=data.aiEnabled, cases=latestCaseRuns();
 $('mission-mode').textContent=live ? (data.aiProvider==='ollama'?'LOCAL AI · NO API CHARGES':'LIVE MODEL AVAILABLE'):'REPLAY AVAILABLE';
 $('mission-execution').querySelector('[value="model"]').disabled=!live;
 $('mission-config-note').textContent=live ? 'Local inference uses your computer. Evidence and structured outcomes are checked; model prose can still be wrong.' : 'Replay uses deterministic summaries. Start local Ollama and enable AI for free inference.';
 const isStale=r=>r.decisionIds.some(key=>data.state.decisions.find(d=>d.id===key)?.status!=='current');
 const staleCount=cases.filter(isStale).length;
 $('mission-refresh').disabled=!staleCount;
 $('mission-refresh').textContent=staleCount ? 'Refresh '+staleCount+' affected workflow'+(staleCount>1?'s':'') : 'All workflows current';
 $('mission-cases').innerHTML=cases.length ? cases.map(r=>'<button type="button" class="case-item '+(r.id===selectedRunId?'selected':'')+'" data-case-run="'+escape(r.id)+'"><span><strong>'+escape(r.question)+'</strong><small>'+escape((r.request?.topics||['legacy']).join(' + '))+' · '+(r.mode==='model'?'local/live model':'replay')+'</small></span><span class="tag '+(isStale(r)?'warning':'neutral')+'">'+(isStale(r)?'RECHECK':'CURRENT')+'</span></button>').join('') : '<p class="case-empty">Run a returns case, then a separate shipping case. Change one policy and see which case needs review.</p>';
 $('mission-cases').querySelectorAll('[data-case-run]').forEach(b=>b.addEventListener('click',()=>{selectedRunId=b.dataset.caseRun;renderMission();paintIcons();}));
 const run=cases.find(r=>r.id===selectedRunId)||cases.at(-1);if(!run){$('mission-results').innerHTML='<section class="panel mission-empty"><h2>Answers have a history.</h2><p>Run an independent case, then change a policy to follow its consequences.</p></section>';return;}
 selectedRunId=run.id;
 const displayedRevision=data.state.revision;
 const verifiedPanel='<section id="mission-verified" class="panel verified-reply" aria-live="polite"><h3>Policy-verified reply</h3><p>'+(isStale(run)?'Blocked until this workflow is refreshed.':'Checking current policy evidence…')+'</p></section>';
 const decisions=run.decisionIds.map(key=>data.state.decisions.find(d=>d.id===key)).filter(Boolean),stale=isStale(run);
 $('mission-results').innerHTML='<div class="mission-run-summary '+(stale?'is-stale':'')+'"><span class="tag '+(stale?'warning':'')+'">'+(stale?'DRAFT BLOCKED · RECHECK REQUIRED':'EVIDENCE LINKED')+'</span><h2>'+(stale?'This case needs a fresh review.':'Three decisions. One evidence trail.')+'</h2><p>'+escape(run.question)+'</p><small>'+escape(run.mode==='model'?'MODEL · '+run.model:'DETERMINISTIC REPLAY · NO MODEL INFERENCE')+' · '+run.durationMs+' ms · BASED ON REV '+run.basedOnRevision+(run.inputTokens!==undefined?' · '+run.inputTokens+' input / '+run.outputTokens+' output tokens':'')+'</small></div><div class="mission-chain">'+decisions.map((d,index)=>{
 const agent=data.state.agents.find(a=>a.id===d.agentId),traces=run.traces.filter(t=>t.agentId===d.agentId);
 return '<article class="panel mission-step '+(d.status!=='current'?'stale-step':'')+'"><div class="mission-step-heading"><span class="step-index">0'+(index+1)+'</span><div><h3>'+escape(agent?.name||'Agent')+'</h3><span>'+escape(agent?.role||'')+'</span></div><span class="tag '+(d.status!=='current'?'warning':'neutral')+'">'+(d.status==='current'?'CURRENT':'RECHECK')+'</span></div>'+(index===2&&run.mode==='model'?'<p class="mission-wording-label">Generated wording · review before use</p>':'')+'<p class="mission-answer">'+escape(d.text)+'</p>'+(d.corrections?.length?'<div class="review-corrections"><strong>Review caught '+d.corrections.length+' issue'+(d.corrections.length>1?'s':'')+'</strong>'+d.corrections.map(c=>'<p>'+escape(c)+'</p>').join('')+'</div>':'')+'<div class="mission-dependency">'+icon(index?'git-branch':'database')+'<span>'+(index?'Uses the preceding decision; evidence inherited through the handoff.':'Reads only '+escape((run.request?.topics||[]).join(', '))+' evidence; watches those policy collections for missing or new knowledge.')+'</span></div><details><summary>Evidence & tool receipts</summary><div class="mission-evidence">'+(d.citations||[]).map(key=>{const f=data.state.facts.find(f=>f.id===key);return f?'<blockquote><strong>'+escape(factText(f))+'</strong><p>'+escape(f.evidence)+'</p><small>'+escape(f.id)+' · '+escape(data.sources[f.source].name)+' · '+escape(f.status.toUpperCase())+'</small></blockquote>':'';}).join('')+traces.map(t=>'<p class="tool-receipt">'+escape(t.tool)+' · revision '+t.revision+' · '+t.durationMs+' ms<br>'+t.factIds.length+' direct facts · '+t.decisionIds.length+' handoff dependency'+(t.watchedRelations?.length?' · watches '+escape(t.watchedRelations.join(', ')):'')+'</p>').join('')+'</div></details></article>';
 }).join('')+'</div>'+verifiedPanel+'<div class="mission-actions"><button id="mission-change" class="button secondary">Review a policy change'+icon('git-pull-request')+'</button><button id="mission-draft" class="button primary" '+'disabled'+'>Download verified reply'+icon('download')+'</button><button id="mission-graph" class="button secondary">Inspect graph'+icon('network')+'</button></div><p class="mission-disclosure">'+(stale?'Historical text is shown for audit. The server blocks its draft export until refreshed.':'The downloadable reply is assembled from verified policy conclusions. Generated wording stays in the audit trail. Nothing is sent.')+' '+(run.mode==='model'?'Real inference. Structured outcomes and citation IDs are checked; prose can still be wrong.':'Deterministic replay; no model inference.')+'</p>';
 if(!stale)api('team/draft',{runId:run.id}).then(reply=>{if(selectedRunId!==run.id||data.state.revision!==displayedRevision)return;const panel=$('mission-verified');if(reply.revision!==displayedRevision){panel.innerHTML='<h3>Policy-verified reply</h3><p>Memory changed. Reload to verify this reply.</p>';return;}panel.innerHTML='<h3>Policy-verified reply</h3><p>'+escape(reply.text)+'</p><small>From verified evidence · revision '+reply.revision+' · '+reply.citations.length+' source-linked fact(s). Model wording is retained separately.</small>';$('mission-draft').disabled=false;}).catch(error=>{if(selectedRunId===run.id&&data.state.revision===displayedRevision)$('mission-verified').innerHTML='<h3>Reply unavailable</h3><p>'+escape(error.message)+'</p>';});
 $('mission-change').addEventListener('click',()=>{document.querySelector('[data-tab="workspace"]').click();document.querySelector('[data-scenario="refund"]').click();});
 $('mission-graph').addEventListener('click',()=>document.querySelector('[data-tab="graph"]').click());
 $('mission-draft').addEventListener('click',event=>busy(event.currentTarget,async()=>{const draft=await api('team/draft',{runId:run.id});const url=URL.createObjectURL(new Blob([draft.text+'\n\n'+draft.note],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='airlock-verified-reply-rev-'+draft.revision+'.txt';a.click();URL.revokeObjectURL(url);}));
}
$('mission-topic').addEventListener('change',()=>{
 syncMissionFields();const topics=$('mission-topic').value.split(',');
 $('mission-question').value=topics.length===2?'Check the return window and shipping destination under current verified policy.':topics[0]==='returns'?'Can this purchase be returned under current standard policy?':topics[0]==='shipping'?'Is shipping to this destination supported by current policy?':'What is the verified support contact?';
});
$('mission-refresh').addEventListener('click',event=>busy(event.currentTarget,async()=>{const result=await api('team/refresh',{});selectedRunId=result.refreshed.at(-1)?.run.id;await load();clearPlan();toast(result.refreshed.length+' workflow(s) refreshed; '+result.preservedCases+' unrelated case(s) preserved.');},'Refreshing affected workflows…').then(()=>{renderMission();paintIcons();}));
$('mission-form').addEventListener('submit',event=>{
 event.preventDefault();busy($('mission-run'),async()=>{
 const topics=$('mission-topic').value.split(','),claim=$('mission-claim').value;
 const input={question:$('mission-question').value,days:topics.includes('returns')?Number($('mission-days').value):0,destination:topics.includes('shipping')?$('mission-destination').value:'Unspecified',topics,mode:$('mission-execution').value,...(claim&&topics.includes('returns')?{claim}:{})};
 $('mission-results').setAttribute('aria-busy','true');$('mission-results').innerHTML='<section class="panel mission-empty"><span class="tag neutral">TEAM AT WORK</span><h2>Following the evidence.</h2><p>Research, review and response run in sequence. Local inference speed depends on your computer.</p></section>';
 try{const result=await api('team/run',input);selectedRunId=result.run.id;await load();clearPlan();toast('Independent case saved with its evidence trail.');}catch(error){$('mission-results').innerHTML='<div class="error-banner">'+escape(error.message)+'</div>';throw error;}finally{$('mission-results').removeAttribute('aria-busy');}
 },'Team working…');
});
let latestBenchmark;
$('benchmark-run').addEventListener('click',event=>busy(event.currentTarget,async()=>{
 const result=await api('benchmark',{}); latestBenchmark=result;
 const names={graph:'Graph traversal',direct:'Direct dependencies only',all:'Refresh everything',reference:'Full traversal in memory'};
 $('benchmark-results').innerHTML=`<div class="benchmark-result-top"><strong>${result.passed}/${result.cases}<span>synthetic cases correct</span></strong><p>${escape(result.backend === 'falkordb' ? 'Measured against live FalkorDB' : 'Measured against the local reference adapter')} · ${result.durationMs} ms<br>Fixed fixture memberships supply the expected results.</p></div><div class="benchmark-table-wrap"><table class="benchmark-table"><thead><tr><th>Method</th><th>Missed decisions</th><th>Unnecessary refreshes</th><th>Recall</th></tr></thead><tbody>${result.methods.map(m=>`<tr class="${m.method === 'graph' ? 'best-method' : ''}"><th scope="row">${names[m.method]}</th><td>${m.fn}</td><td>${m.fp}</td><td>${Math.round(m.recall*100)}%</td></tr>`).join('')}</tbody></table></div><details class="benchmark-details"><summary>Inspect all ${result.cases} cases</summary>${result.rows.map(row=>`<div class="benchmark-case"><span>${row.passed ? '✓' : '×'} ${escape(row.name)}</span><small>${row.depth} hops · expected ${row.expected} · found ${row.found} · ${row.queryMs} ms</small></div>`).join('')}</details><p class="benchmark-scope">${escape(result.note)}</p><button class="button secondary" id="benchmark-export">Download measured results${icon('download')}</button>`;
 $('benchmark-export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(latestBenchmark,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='airlock-dependency-comparison.json';a.click();URL.revokeObjectURL(url);});
 paintIcons();
},'Measuring isolated cases…'));
paintIcons();
$('update-form').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('update-form').requestSubmit();}});
load().then(()=>{ const name=location.hash.slice(1)||'mission'; const button=[...document.querySelectorAll('[data-tab]')].find(button=>button.dataset.tab===name); if(button)button.click(); return previewScenario(); }).catch(e => { $('backend-label').textContent = 'Connection unavailable'; const banner = document.createElement('div'); banner.className = 'error-banner'; banner.textContent = e.message; $('main').prepend(banner); toast(e.message, true); });


