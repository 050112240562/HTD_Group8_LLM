// State and event integration tests in a minimal DOM harness. No network or browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const rootPath = path.resolve(__dirname, '..');
const core = require('../js/htd-profile-core.js');
function harness() {
  const nodes = new Map(), inputs = [], samples = [], downloads = [];
  function element(id) {
    const classes = new Set();
    return {
      id, value: '', hidden: false, checked: false, disabled: false, dataset: {}, attributes: {}, handlers: {}, textContent: '',
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle(c, force) { if (force) classes.add(c); else classes.delete(c); } },
      setAttribute(k, v) { this.attributes[k] = v; },
      addEventListener(k, f) { (this.handlers[k] ||= []).push(f); },
      fire(k, target = this) { for (const f of this.handlers[k] || []) f({ target, preventDefault() {} }); },
      replaceChildren() { this.html = ''; }, scrollIntoView() {},
      querySelectorAll(selector) {
        if (selector === '.htd-flow li') return [element('step1'), element('step2'), element('step3')];
        if (selector === '.htd-sample') return samples;
        const match = selector.match(/input\[name="(\w+)"\]:checked/);
        return match ? inputs.filter(i => i.name === match[1] && i.checked) : [];
      },
      set innerHTML(html) {
        this.html = html;
        if (id === 'htdProfileFields') {
          for (const m of html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]*)"/g)) get(m[1]).value = m[2];
          for (const m of html.matchAll(/<select id="([^"]+)">([\s\S]*?)<\/select>/g)) {
            const selected = m[2].match(/<option value="([^"]*)" selected/); get(m[1]).value = selected ? selected[1] : '';
          }
        }
        if (id === 'htd_preferredSectors' || id === 'htd_excludedSectors') {
          const name = id.slice(4);
          for (let i = inputs.length - 1; i >= 0; i--) if (inputs[i].name === name) inputs.splice(i, 1);
          for (const m of html.matchAll(/<input type="checkbox" name="([^"]+)" value="([^"]+)"( checked)?/g)) inputs.push({ name: m[1], value: m[2], checked: !!m[3] });
        }
        if (id === 'htdSamples') {
          for (const m of html.matchAll(/data-case="([^"]+)"/g)) {
            const e = element('sample-' + m[1]); e.dataset.case = m[1]; e.closest = () => e; samples.push(e);
          }
        }
      }, get innerHTML() { return this.html || ''; }
    };
  }
  function get(id) { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); }
  const html = fs.readFileSync(path.join(rootPath, 'customer.html'), 'utf8');
  for (const m of html.matchAll(/id="([^"]+)"/g)) get(m[1]);
  const context = vm.createContext({ window: { HTDProfile: core }, document: { getElementById: get,
    body: { appendChild() {} }, createElement() { return { click() { downloads.push({ url: this.href, filename: this.download }); }, remove() {} }; } },
    console, setTimeout, URL, Blob });
  vm.runInContext(fs.readFileSync(path.join(rootPath, 'js/recommendation.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(rootPath, 'js/htd-profile-ui.js'), 'utf8'), context);
  const confirm = () => { get('htdConfirmed').checked = true; get('htdReviewForm').fire('change', get('htdConfirmed')); };
  const rank = () => get('htdReviewForm').fire('submit');
  const edit = (field, value) => { get('htd_' + field).value = value; get('htdReviewForm').fire('input', get('htd_' + field)); };
  return { get, confirm, rank, edit, downloads, choose(id) { get('htdSamples').fire('click', samples.find(s => s.dataset.case === id)); } };
}
test('UI starts in demo, extracts only on click and enables ranking after confirmation', () => {
  const h = harness();
  assert.equal(h.get('financialForm').hidden, true);
  assert.equal(h.get('htdDemo').hidden, false);
  assert.equal(h.get('htdReview').hidden, true);
  h.get('htdExtract').fire('click');
  assert.equal(h.get('htdReview').hidden, false);
  assert.equal(h.get('htdRank').disabled, true);
  assert.ok(h.get('htdEvidence').innerHTML.includes('10 triệu'));
  h.confirm(); assert.equal(h.get('htdRank').disabled, false);
  h.rank(); assert.equal(h.get('htdResults').hidden, false);
  assert.ok(h.get('htdResultContent').innerHTML.includes('htd-stock'));
});
test('Editing a profile or revoking confirmation clears results and download state', () => {
  const h = harness(); h.get('htdExtract').fire('click'); h.confirm(); h.rank();
  h.edit('capital', '20000000');
  assert.equal(h.get('htdResults').hidden, true);
  assert.equal(h.get('htdConfirmed').checked, false);
  assert.equal(h.get('htdDownload').hidden, true);
  assert.ok(h.get('htdEvidence').innerHTML.includes('Bạn đã sửa'));
  h.confirm(); h.rank();
  h.get('htdConfirmed').checked = false; h.get('htdReviewForm').fire('input', h.get('htdConfirmed'));
  assert.equal(h.get('htdResults').hidden, true);
});
test('Missing fields block confirmation until supplied; invalid edits re-lock it', () => {
  const h = harness(); h.choose('missing'); h.get('htdExtract').fire('click');
  assert.equal(h.get('htdConfirmed').disabled, true);
  assert.ok(h.get('htdReviewStatus').innerHTML.includes('bao nhiêu tháng'));
  h.edit('risk', 'medium'); h.edit('horizonMonths', '24');
  assert.equal(h.get('htdConfirmed').disabled, false);
  h.confirm(); h.rank(); assert.equal(h.get('htdResults').hidden, false);
  h.edit('capital', ''); assert.equal(h.get('htdConfirmed').disabled, true);
  assert.equal(h.get('htdResults').hidden, true);
});
test('Changing narrative invalidates profile and does not reuse the old fixture', () => {
  const h = harness(); h.get('htdExtract').fire('click'); h.confirm(); h.rank();
  h.get('htdNarrative').value = 'Nội dung mới'; h.get('htdNarrative').fire('input');
  assert.equal(h.get('htdReview').hidden, true); assert.equal(h.get('htdResults').hidden, true);
  h.get('htdExtract').fire('click'); assert.equal(h.get('htdReview').hidden, true);
  assert.ok(h.get('htdInputStatus').textContent.includes('khác tình huống mẫu'));
  h.get('htdRestore').fire('click'); h.get('htdExtract').fire('click');
  assert.equal(h.get('htdReview').hidden, false);
});
test('Manual profile preserves unknowns and switching tabs separates the two flows', () => {
  const h = harness(); h.get('htdManualProfile').fire('click');
  assert.equal(h.get('htd_capital').value, '');
  assert.equal(h.get('htdConfirmed').disabled, true);
  assert.ok(h.get('htdDraftSource').textContent.includes('tự điền'));
  h.get('htdTabManual').fire('click');
  assert.equal(h.get('financialForm').hidden, false); assert.equal(h.get('htdDemo').hidden, true);
  h.get('htdTabDemo').fire('click');
  assert.equal(h.get('financialForm').hidden, true); assert.equal(h.get('htdDemo').hidden, false);
});
test('Export states offline provenance and records edits; stale exports are blocked', async () => {
  const h = harness(); h.get('htdExtract').fire('click');
  h.edit('capital', '20000000'); h.confirm(); h.rank();
  h.get('htdDownload').fire('click');
  assert.equal(h.downloads.length, 1);
  const data = await fetch(h.downloads[0].url).then(r => r.json());
  assert.equal(data.profileSource, 'demo_fixture');
  assert.equal(data.selectionSource, 'offline_rules');
  assert.deepEqual(data.editedFields, ['capital']);
  assert.equal(data.draftProfile.capital, 10000000);
  assert.equal(data.profile.capital, 20000000);
  assert.ok(data.evidence.capital.includes('10 triệu'));
  h.edit('capital', ''); h.get('htdDownload').fire('click');
  assert.equal(h.downloads.length, 1);
});
