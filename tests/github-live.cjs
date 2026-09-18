const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { app } = require('./harness.cjs');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const a=app();a.context.fetch=fetch;
  const result='280af7ea45208bb48367d2cd62a9430deb37af98';
  const base=execFileSync('git',['rev-parse',result+'^1'],{encoding:'utf8'}).trim();
  const repo='https://github.com/holeyfield33-art/Open-source';
  const value=await a.compareCommits(repo,base,result);
  assert.equal(value.state,'ready',value.reason);assert.ok(value.files.length>0);
  const same=await a.compareCommits(repo,result,result);
  assert.equal(same.state,'ready',same.reason);assert.equal(same.files.length,0);
  for(const [b,r] of [['0'.repeat(40),result],[base,'0'.repeat(40)]]) {
    const invalid=await a.compareCommits(repo,b,r);assert.equal(invalid.state,'error');assert.match(invalid.reason,/base SHA, result SHA/);
  }
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync(path.join(__dirname,'../index.html')));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'Connect GitHub Repository',exact:true}).click();
    await page.locator('#np-title').fill('Public GitHub verification');await page.locator('#np-repo').fill(repo);
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await page.locator('#c-prompt').fill('Review the public code transition');await page.locator('#c-base').fill(base);await page.locator('#c-result').fill(result);
    await page.getByRole('button',{name:'Review & Save AI Change',exact:true}).click();
    await page.locator('#preview-code').getByText(/Commit anchors found on GitHub/).waitFor();
    assert.match(await page.locator('#preview-code').innerText(),/index.html/);
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
  console.log(JSON.stringify({status:'PASS public GitHub (no authentication)',base,result,files:value.files.map(f=>f.filename),patches:value.files.filter(f=>typeof f.patch==='string').length,identical:true,invalidBase:true,invalidResult:true,browserCORS:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
