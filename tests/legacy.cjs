const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
(async () => {
  // Use the actual pre-refactor implementation as the compatibility oracle.
  const original = execFileSync('git', ['show', '280af7ea45208bb48367d2cd62a9430deb37af98:index.html'], { encoding: 'utf8' });
  const old = app(original);
  old.state.kp = await old.loadOrCreateKeypair();
  const p = old.newProject('Legacy fixture', 'https://github.com/octocat/Hello-World');
  await old.appendDirective(p, 'Build the first version', 'Original intent', 'main');
  await old.appendDirective(p, 'Build the second version\nKeep notes', 'Second intent', 'old-branch');
  p.directives[0].note = 'private note'; p.journal = 'private journal'; p.checklist = { 0: true };
  const sealed = await old.publishProject(p);
  const fresh = app();
  fresh.state.kp = await fresh.loadOrCreateKeypair();
  assert.equal((await fresh.verifyRecord(sealed)).chainOk, true);
  assert.equal((await fresh.verifyRecord(sealed)).sigOk, true);
  const before = JSON.stringify(sealed);
  for (const d of sealed.directives) assert.equal(await fresh.contentHash(d), await old.contentHash(d));
  fresh.values.set('os-local-v1', old.values.get('os-local-v1'));
  fresh.values.set('proj:' + sealed.id, before);
  await fresh.loadLocal(); await fresh.loadFeed();
  fresh.OS.openLocal(p.id);
  assert.match(fresh.element('pane').innerHTML, /Build the first version/);
  assert.equal(fresh.state.local.projects[p.id].journal, 'private journal');
  assert.equal(fresh.state.local.projects[p.id].directives[0].note, 'private note');
  const imported = app();
  imported.element('imp-json').value = JSON.stringify({ kind: 'vibe-ledger-backup', version: 1, local: old.state.local });
  await imported.OS.doImport();
  assert.equal(imported.state.local.projects[p.id].journal, 'private journal');
  assert.equal(imported.state.local.projects[p.id].directives[0].note, 'private note');
  assert.equal((await imported.verifyRecord(imported.state.local.projects[p.id])).chainOk, true);
  const mixed = fresh.state.local.projects[p.id];
  await fresh.appendDirective(mixed, 'New prompt', 'New intent', '', 'a'.repeat(40), 'b'.repeat(40));
  assert.equal((await fresh.verifyRecord(mixed)).chainOk, true);
  const resealed = await fresh.publishProject(mixed);
  assert.equal((await fresh.verifyRecord(resealed)).sigOk, true);
  assert.equal(JSON.stringify(sealed), before);
  assert.equal(resealed.directives[0].schemaVersion, undefined);
  assert.equal(resealed.directives[2].schemaVersion, 2);
  for (const key of ['prompt','reasoning','baseCommit','resultCommit']) {
    const tampered = JSON.parse(JSON.stringify(resealed));
    tampered.directives[2][key] = key.includes('Commit') ? 'c'.repeat(40) : 'tampered';
    assert.equal((await fresh.verifyRecord(tampered)).chainOk, false, key);
  }
  console.log('PASS: original legacy hashes/signature, load/render/private data, mixed chain, seal, tamper detection');
})();
