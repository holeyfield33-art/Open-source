const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function app(html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8')) {
  const elements = new Map();
  const values = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', textContent: '', style: {}, addEventListener() {}, focus() {}, scrollIntoView() {} });
    return elements.get(id);
  };
  const context = vm.createContext({ crypto: webcrypto, TextEncoder, URL, Blob, AbortSignal, TypeError, console,
    location: { hostname: 'localhost', pathname: '/' }, navigator: {},
    setTimeout: () => 0, clearTimeout() {},
    fetch: async () => { throw Error('offline'); },
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k), key: i => [...values.keys()][i], get length() { return values.size; } },
    document: { getElementById: element, querySelectorAll: () => [], body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, removeChild() {} }, createElement: () => ({ click() {} }) },
    window: { scrollTo() {} },
  });
  let script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  script = script.slice(0, script.indexOf('/* ---------------- boot'));
  const names = ['state','canonicalBody','contentHash','chainHash','verifyRecord','appendDirective','publishProject','loadOrCreateKeypair','newProject','loadLocal','loadFeed','saveLocal','buildBrief','renderPane','renderAll','forkPlan','forkProject','OS','promptDiff','renderPromptDiff','compareCommits','renderComparison','comparisonKey','validateAnchors','buildBackup'];
  script += '\n globalThis.api = {' + names.map(n => `${n}: typeof ${n} === "undefined" ? undefined : ${n}`).join(',') + '}; })();';
  vm.runInContext(script, context);
  return { ...context.api, context, element, values };
}
module.exports = { app };
