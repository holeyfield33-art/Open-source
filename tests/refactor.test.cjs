const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const repo = 'https://github.com/octocat/Hello-World';
const base = 'a'.repeat(40), result = 'b'.repeat(40);
const response = (data, status = 200, headers = {}) => ({ ok: status === 200, status, headers: { get: k => headers[k] || null }, json: async () => data });
const comparison = (extra = {}) => ({ base_commit: { sha: base }, merge_base_commit: { sha: base }, status: 'ahead', files: [{ filename: 'index.html', status: 'modified', additions: 2, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' }], ...extra });
async function project(a) {
  a.state.kp = await a.loadOrCreateKeypair();
  const p = a.newProject('Test workspace', repo);
  a.OS.openLocal(p.id);
  return p;
}

test('prompt diff: initial, added, removed, context, multiline, empty and unchanged', () => {
  const a = app();
  assert.equal(a.promptDiff(null, 'First\nSecond').initial, true);
  assert.match(a.renderPromptDiff(null, ''), /Initial instruction/);
  const diff = a.promptDiff('keep\nold\nend', 'keep\nnew\nend');
  assert.deepEqual(Array.from(diff.rows, r => [r.kind,r.text]), [['context','keep'],['removed','old'],['added','new'],['context','end']]);
  assert.equal(a.promptDiff('same', 'same').unchanged, true);
  assert.equal(a.promptDiff('a\r\nb', 'a\nb').unchanged, true);
  assert.deepEqual(Array.from(a.promptDiff('', 'new').rows, r => r.kind), ['added']);
  assert.deepEqual(Array.from(a.promptDiff('old', '').rows, r => r.kind), ['removed']);
  assert.match(a.renderPromptDiff('', '<script>'), /&lt;script&gt;/);
  const large = a.promptDiff(Array(1100).fill('old').join('\n'), Array(1100).fill('new').join('\n'));
  assert.equal(large.coarse, true);
});

test('prompt diff reconstructs both texts for repeated lines and randomized edits', () => {
  const a = app();
  let seed = 19;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < 300; k++) {
    const text = () => Array.from({ length: 1 + Math.floor(random() * 12) }, () => ['a','b','c',''][Math.floor(random() * 4)]).join('\n');
    const before = text(), after = text(), rows = a.promptDiff(before, after).rows;
    assert.equal(rows.filter(r => r.kind !== 'added').map(r => r.text).join('\n'), before);
    assert.equal(rows.filter(r => r.kind !== 'removed').map(r => r.text).join('\n'), after);
  }
});

test('comparison: SHA endpoint, cache and in-flight deduplication independent of branch', async () => {
  const a = app(); let calls = 0, url;
  a.context.fetch = async u => { calls++; url = u; return response(comparison()); };
  const [one, two] = await Promise.all([a.compareCommits(repo, base, result), a.compareCommits(repo, base, result)]);
  assert.equal(one.state, 'ready'); assert.equal(two.state, 'ready'); assert.equal(calls, 1);
  assert.match(url, new RegExp('/compare/' + base + '\\.\\.\\.' + result));
  await a.compareCommits(repo, base, result); assert.equal(calls, 1);
  const html = a.renderComparison(one);
  assert.match(html, /index.html/); assert.match(html, /\+2 \/ −1/); assert.match(html, /old/);
  const p = await project(a);
  await a.appendDirective(p, 'Actual prompt', 'Intent', 'deleted-branch', base, result);
  await a.OS.loadComparison(0);
  assert.equal(calls, 1); assert.match(a.element('compare-0').innerHTML, /Commit anchors found/);
});

test('comparison: invalid base/result format, unreachable SHA, offline, timeout, HTTP failure', async () => {
  for (const [b,r] of [['main',result],[base,'123']]) {
    const a = app(); let calls = 0; a.context.fetch = async () => { calls++; };
    assert.equal((await a.compareCommits(repo,b,r)).state,'error'); assert.equal(calls,0);
  }
  for (const [b,r] of [['c'.repeat(40),result],[base,'d'.repeat(40)]]) {
    const a = app(); a.context.fetch = async () => response({},404);
    assert.match((await a.compareCommits(repo,b,r)).reason,/base SHA, result SHA/);
  }
  const offline = app(); offline.context.fetch = async () => { throw new TypeError('Failed to fetch'); };
  assert.match((await offline.compareCommits(repo,base,result)).reason,/offline/);
  const timeout = app(); timeout.context.fetch = async () => { throw Object.assign(new Error(), { name:'TimeoutError' }); };
  assert.match((await timeout.compareCommits(repo,base,result)).reason,/timed out/);
  const http = app(); http.context.fetch = async () => response({},503);
  assert.match((await http.compareCommits(repo,base,result)).reason,/503/);
});

test('comparison: 403/429 give reset guidance and suppress requests during cooldown', async () => {
  for (const status of [403,429]) {
    const a = app(); let calls=0;
    a.context.fetch = async () => { calls++; return response({},status, {'x-ratelimit-reset': String(Math.ceil(Date.now()/1000)+180)}); };
    assert.match((await a.compareCommits(repo,base,result)).reason,/retry after/);
    assert.match((await a.compareCommits(repo,base,'c'.repeat(40),true)).reason,/rate limit/);
    assert.equal(calls,1);
  }
});

test('comparison: identical commits, omitted patches, diverged and capped file results', async () => {
  const a = app(); a.context.fetch = async () => response(comparison({ status:'identical', files:[] }));
  const same = await a.compareCommits(repo,base,base);
  assert.match(a.renderComparison(same),/No changed files/);
  const html = a.renderComparison({ state:'ready', base, result, url:repo, status:'diverged', mergeBase:'c'.repeat(40), files:[{ filename:'<img>.png',status:'modified' }] });
  assert.match(html,/Patch unavailable/); assert.match(html,/merge base/); assert.match(html,/&lt;img&gt;/);
  assert.match(a.renderComparison({state:'ready',base,result,url:repo,files:Array(300).fill({filename:'file'})}),/may be incomplete/);
});

test('review before save, blank candidate remains draft, anchors hashed, double-save prevented', async () => {
  const a = app(), p = await project(a);
  p.drafts = [{ id:'candidate', prompt:'', why:'', branch:'main', baseCommit:base, resultCommit:result }];
  await a.OS.chainDraft('candidate'); assert.equal(p.directives.length,0); assert.equal(p.drafts.length,1);
  p.drafts[0].prompt = 'Actual instruction'; p.drafts[0].why = 'Intent';
  a.context.fetch = async () => response(comparison());
  await a.OS.chainDraft('candidate');
  assert.equal(p.directives.length,0); assert.match(a.element('modal-root').innerHTML,/Review AI Change/);
  await Promise.all([a.OS.saveReviewed(),a.OS.saveReviewed()]);
  assert.equal(p.directives.length,1); assert.equal(p.drafts.length,0);
  assert.equal(p.directives[0].baseCommit,base); assert.equal(p.directives[0].schemaVersion,2);
  assert.equal((await a.verifyRecord(p)).chainOk,true);
});

test('scanner stages actual transitions without inferring prompts or changing provenance', async () => {
  const a = app(), p = await project(a);
  await a.appendDirective(p,'Existing prompt','Intent','main');
  const head = p.directives[0].chainHash;
  a.OS.scanReview({owner:'octocat',repo:'Hello-World'}, { at:Date.now(), branches:[{name:'main',commit:{sha:result}}], commits:[{sha:result,parents:[{sha:base}],commit:{message:'Git commit message'}}] });
  a.context.document.querySelectorAll = () => [{checked:true,dataset:{i:'0'}}];
  await a.OS.stageDrafts();
  assert.equal(p.drafts[0].prompt,''); assert.equal(p.drafts[0].why,'');
  assert.equal(p.drafts[0].sourceMessage,'Git commit message');
  assert.equal(p.drafts[0].baseCommit,base); assert.equal(p.drafts[0].resultCommit,result);
  assert.equal(p.directives.length,1); assert.equal(p.directives[0].chainHash,head);
});

test('seal excludes all private metadata; altered prompt/intent/branch/anchors/version fail closed', async () => {
  const a = app(), p = await project(a);
  await a.appendDirective(p,'Build it','Because','main',base,result);
  p.directives[0].note='secret'; p.directives[0].phase='build'; p.directives[0].deps=['test'];
  p.journal='journal'; p.checklist={0:true}; p.drafts=[{prompt:'draft'}];
  const rec = await a.publishProject(p);
  assert.equal((await a.verifyRecord(rec)).sigOk,true);
  for (const field of ['note','phase','deps']) assert.equal(rec.directives[0][field],undefined);
  for (const field of ['journal','checklist','drafts']) assert.equal(rec[field],undefined);
  for (const field of ['prompt','reasoning','branch','baseCommit','resultCommit','schemaVersion']) {
    const copy=JSON.parse(JSON.stringify(rec)); copy.directives[0][field] = field === 'schemaVersion' ? 3 : 'altered';
    assert.equal((await a.verifyRecord(copy)).chainOk,false,field);
    await assert.rejects(a.publishProject(copy),/verification failed/);
  }
  const noVersion=JSON.parse(JSON.stringify(rec)); delete noVersion.directives[0].schemaVersion;
  assert.equal((await a.verifyRecord(noVersion)).chainOk,false);
  rec.sig='00'; a.state.feed=[rec]; a.state.verif[rec.id]=await a.verifyRecord(rec); a.OS.openPub(rec.id);
  assert.match(a.element('pane').innerHTML,/VERIFICATION FAILED/);
  assert.doesNotMatch(a.element('pane').innerHTML,/class="review-grid"/);
});

test('backup restores legacy-compatible local data and sealed snapshots without replacing existing seals', async () => {
  const a=app(),p=await project(a);
  await a.appendDirective(p,'Prompt','Intent','main',base,result);
  p.journal='journal';p.directives[0].note='note';p.checklist={0:true};
  const rec=await a.publishProject(p), backup=await a.buildBackup();
  assert.equal(backup.version,2);assert.equal(backup.sealed.length,1);
  assert.doesNotMatch(JSON.stringify(backup),/"priv"/);
  const b=app();b.element('imp-json').value=JSON.stringify(backup);await b.OS.doImport();
  assert.equal(b.state.local.projects[p.id].journal,'journal');assert.equal(b.state.local.projects[p.id].directives[0].note,'note');
  assert.equal((await b.verifyRecord(b.state.feed[0])).sigOk,true);
  const stored=b.values.get('proj:'+rec.id);
  await b.OS.doImport();assert.equal(b.values.get('proj:'+rec.id),stored);
  const c=app();c.element('imp-json').value=JSON.stringify({kind:'vibe-ledger-backup',version:1,local:backup.local});
  await c.OS.doImport();assert.equal(c.state.local.projects[p.id].checklist[0],true);
});

test('Continue with AI includes anchors, verification, drafts and notes without changing provenance/storage', async () => {
  const a=app(),p=await project(a);
  await a.appendDirective(p,'Prompt','Intent','feature/branch',base,result);
  p.drafts=[{prompt:'Next prompt',why:'Next intent',baseCommit:result,resultCommit:base}];p.journal='Next work?';p.directives[0].note='Unresolved?';
  const before=JSON.stringify(p), storage=JSON.stringify([...a.values]);
  await a.OS.agentBrief();
  assert.equal(JSON.stringify(p),before);assert.equal(JSON.stringify([...a.values]),storage);
  assert.match(a.OS._brief.text,/Next prompt/);assert.match(a.OS._brief.text,/Next work\?/);
  assert.match(a.OS._brief.text,/chain intact/);assert.ok(a.OS._brief.text.includes(base));
  assert.equal(a.OS._brief.json.directives[0].resultCommit,result);
  assert.equal(a.OS._brief.json.drafts[0].baseCommit,result);
});

test('fork/clone preserve source parent and anchor context; map/history/notes remain available', async () => {
  const a=app(),p=await project(a);await a.appendDirective(p,'Prompt','Intent','main',base,result);
  p.journal='Private journal';p.directives[0].deps=['react'];p.directives[0].phase='build';
  const rec=await a.publishProject(p);
  for(const fork of [a.forkPlan(rec,0),a.forkProject(rec)]) {
    assert.equal(fork.forkOf.chainHash,p.directives[0].chainHash);assert.equal(fork.ancestry[0].resultCommit,result);
    await a.appendDirective(fork,'Alternative','Intent','feature');assert.equal((await a.verifyRecord(fork)).chainOk,true);
  }
  a.OS.openLocal(p.id);a.OS.setPane('map');assert.match(a.element('pane').innerHTML,/commit bbbbbbbbbb/);assert.match(a.element('pane').innerHTML,/react/);
  a.OS.setPane('chain');assert.match(a.element('pane').innerHTML,/commit anchors/);
  a.OS.setPane('notebook');assert.match(a.element('pane').innerHTML,/Private journal/);
});

test('storage failure keeps reviewed draft and prevents false saved history', async () => {
  const a=app(),p=await project(a);
  p.drafts=[{id:'draft',prompt:'Actual prompt',why:'Intent',branch:''}];
  await a.OS.chainDraft('draft');
  a.context.console={...console,error(){}};
  a.context.localStorage.setItem=()=>{throw new Error('Quota exceeded');};
  await a.OS.saveReviewed();
  assert.equal(p.directives.length,0);assert.equal(p.drafts.length,1);
  assert.match(a.element('toast').textContent,/not saved/);assert.ok(a.OS._review);
});

test('branch recheck removes stale positive observation; invalid seals cannot fork', async () => {
  const a=app(),p=await project(a);await a.appendDirective(p,'Prompt','Intent','deleted',base,result);
  p.directives[0].ghVerified=true;p.directives[0].ghSha=result;
  a.context.fetch=async url=>response({},url.includes('/branches/')?404:200);
  await a.OS.verifyBranch(p.id,0);assert.equal(p.directives[0].ghVerified,false);
  assert.match(a.buildBrief(p,0),/branch unverified/);
  const rec=await a.publishProject(p);rec.sig='00';a.state.feed=[rec];
  const count=a.state.local.order.length;
  await a.OS.doForkProject(rec.id);await a.OS.doForkPlan(rec.id,0);
  assert.equal(a.state.local.order.length,count);
});
