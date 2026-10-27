(function () {
  'use strict';
  const core = window.HTDProfile;
  const root = document.getElementById('htdDemo');
  if (!core || !root) return;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sameValue = (a, b) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
  let selected = core.fixtures[0], draft = null, result = null;
  let mode = 'demo';

  function resetResult() {
    result = null;
    $('htdConfirmed').checked = false;
    $('htdResults').hidden = true;
    $('htdResultContent').replaceChildren();
    $('htdDownload').hidden = true;
    $('htdRank').disabled = true;
  }
  function resetDraft() {
    draft = null; resetResult();
    $('htdReview').hidden = true;
    $('htdInputStatus').textContent = '';
    $('htdInputStatus').classList.remove('error');
    setProgress(1);
  }
  function setProgress(step) {
    root.querySelectorAll('.htd-flow li').forEach((el, i) => el.classList.toggle('current', i < step));
    if (typeof setStep === 'function') setStep(step);
  }
  function choose(fixture) {
    selected = fixture; resetDraft();
    $('htdNarrative').value = fixture.text;
    root.querySelectorAll('.htd-sample').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.case === fixture.id)));
  }
  function readProfile() {
    const profile = {};
    for (const key of ['capital', 'horizonMonths']) {
      const raw = $('htd_' + key).value.trim();
      profile[key] = raw === '' ? null : Number(raw);
    }
    for (const key of ['goal', 'risk', 'liquidity', 'experience']) profile[key] = $('htd_' + key).value || null;
    for (const key of ['preferredSectors', 'excludedSectors']) profile[key] = Array.from(root.querySelectorAll('input[name="' + key + '"]:checked'), el => el.value);
    return profile;
  }
  function updateReview() {
    if (!draft) return;
    const profile = readProfile(), validation = core.validate(profile);
    const status = $('htdReviewStatus');
    status.classList.toggle('error', !validation.valid);
    const messages = validation.errors.map(x => x.message).concat(validation.warnings);
    status.innerHTML = '<strong>' + (validation.valid ? 'Hồ sơ đã đủ thông tin để xem xét.' : 'Cần bổ sung hoặc sửa thông tin:') + '</strong>' +
      (messages.length ? '<ul>' + messages.map(m => '<li>' + escape(m) + '</li>').join('') + '</ul>' : ' Hãy kiểm tra rồi xác nhận bên dưới.');
    $('htdConfirmed').disabled = !validation.valid;
    $('htdRank').disabled = !validation.valid || !$('htdConfirmed').checked;
    $('htdEvidence').innerHTML = Object.keys(core.fields).map(key => {
      const edited = !sameValue(profile[key], draft.profile[key]);
      const quote = draft.evidence[key];
      const source = edited ? 'Bạn đã sửa hoặc bổ sung; câu gốc chỉ phản ánh bản nháp ban đầu.' : draft.mode === 'manual' ? 'Bạn tự điền; chưa có câu gốc.' : quote ? 'Bản nháp mẫu, có câu gốc để đối chiếu.' : 'Chưa có bằng chứng trong mô tả.';
      return '<div class="htd-evidence"><strong>' + escape(core.fields[key]) + '</strong> · ' + escape(core.formatValue(key, profile[key])) +
        '<div class="htd-muted">' + escape(source) + '</div>' + (quote ? '<blockquote>“' + escape(quote) + '”</blockquote>' : '') + '</div>';
    }).join('');
  }
  function buildReview(bundle) {
    resetResult(); draft = bundle;
    $('htdReview').hidden = false;
    $('htdDraftSource').textContent = bundle.mode === 'manual' ? 'Nguồn hồ sơ: bạn tự điền.' : 'Nguồn hồ sơ: bản nháp tình huống mẫu, mô phỏng đầu ra LLM.';
    const numeric = key => '<div><label for="htd_' + key + '">' + escape(core.fields[key]) + (key === 'capital' ? ' (VND)' : ' (tháng)') + '</label><input id="htd_' + key + '" name="' + key + '" type="number" min="1" step="1" ' + (key === 'horizonMonths' ? 'max="600"' : '') + ' value="' + escape(bundle.profile[key]) + '" placeholder="Chưa cung cấp"></div>';
    const select = key => '<div><label for="htd_' + key + '">' + escape(core.fields[key]) + '</label><select id="htd_' + key + '"><option value="">Chưa cung cấp</option>' +
      Object.entries(core.labels[key]).map(([value, label]) => '<option value="' + value + '"' + (bundle.profile[key] === value ? ' selected' : '') + '>' + escape(label) + '</option>').join('') + '</select></div>';
    $('htdProfileFields').innerHTML = numeric('capital') + select('goal') + numeric('horizonMonths') + select('risk') + select('liquidity') + select('experience');
    for (const key of ['preferredSectors', 'excludedSectors']) {
      $('htd_' + key).innerHTML = Object.entries(core.sectors).map(([code, label]) => '<label class="htd-check"><input type="checkbox" name="' + key + '" value="' + code + '"' + (bundle.profile[key].includes(code) ? ' checked' : '') + '>' + escape(label) + '</label>').join('');
    }
    updateReview(); setProgress(2);
  }
  function showResult() {
    if (!draft) return;
    const profile = readProfile();
    result = core.rankStocks(profile, EXPANDED_STOCK_POOL, $('htdConfirmed').checked);
    if (result.status === 'needs_review') { updateReview(); return; }
    result.profile = profile;
    $('htdResults').hidden = false;
    $('htdResultContent').innerHTML = '<div class="htd-summary">' + ['capital', 'goal', 'horizonMonths', 'risk', 'liquidity', 'experience'].map(key =>
      '<div><span>' + escape(core.fields[key]) + '</span>' + escape(core.formatValue(key, profile[key])) + '</div>').join('') + '</div>' +
      '<div class="htd-status" role="status">' + escape(result.message) + '</div>' +
      (result.stocks.length ? '<p class="htd-muted" style="margin-top:14px">Điểm phù hợp là điểm quy tắc nội bộ của demo, không phải xác suất sinh lời. Vốn được ghi nhận riêng; chưa phân bổ tiền hoặc tính số cổ phiếu mua.</p>' : '') +
      '<div class="htd-stock-grid">' + result.stocks.map((stock, i) => '<article class="htd-stock"><div class="htd-stock-top"><img src="' + escape(stock.logo) + '" alt="Logo ' + escape(stock.code) + '" loading="lazy"><div><strong>' + (i + 1) + '. ' + escape(stock.code) + '</strong><span>' + escape(core.sectors[stock.sector]) + '</span></div><div class="htd-score">' + stock.suitabilityScore + '/100</div></div>' +
        '<p>' + escape(stock.name) + '</p><span class="htd-tag">Biến động trong demo: ' + escape({ Low: 'Thấp', Medium: 'Trung bình', High: 'Cao', 'Very High': 'Rất cao' }[stock.volatility] || stock.volatility) + '</span><ul>' + stock.reasons.map(reason => '<li>' + escape(reason) + '</li>').join('') + '</ul>' +
        '<p>' + escape(stock.caution) + '</p><a href="png/' + stock.code.replace(/^BID$/, 'BIDV') + '.png" target="_blank" rel="noopener">Mở báo cáo có sẵn ↗</a></article>').join('') + '</div>';
    $('htdDownload').hidden = false;
    setProgress(3);
    $('htdResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('htdSamples').innerHTML = core.fixtures.map(f => '<button type="button" class="htd-sample" data-case="' + f.id + '" aria-pressed="false"><strong>' + escape(f.title) + '</strong><span>' + escape(f.subtitle) + '</span></button>').join('');
  $('htdSamples').addEventListener('click', event => {
    const button = event.target.closest('[data-case]');
    if (button) choose(core.fixtures.find(f => f.id === button.dataset.case));
  });
  $('htdNarrative').addEventListener('input', resetDraft);
  $('htdRestore').addEventListener('click', () => choose(selected));
  $('htdExtract').addEventListener('click', () => {
    resetDraft();
    try { buildReview(core.extractDemo($('htdNarrative').value)); }
    catch (error) { $('htdInputStatus').textContent = error.message; $('htdInputStatus').classList.add('error'); }
  });
  $('htdManualProfile').addEventListener('click', () => {
    resetDraft();
    const profile = Object.fromEntries(Object.keys(core.fields).map(k => [k, k.endsWith('Sectors') ? [] : null]));
    buildReview({ profile, evidence: {}, mode: 'manual' });
  });
  $('htdReviewForm').addEventListener('input', event => {
    if (event.target.id === 'htdConfirmed') {
      if (!$('htdConfirmed').checked) { resetResult(); setProgress(2); }
      updateReview(); return;
    }
    resetResult(); updateReview(); setProgress(2);
  });
  $('htdReviewForm').addEventListener('change', event => {
    if (event.target.id !== 'htdConfirmed' || !$('htdConfirmed').checked) resetResult();
    updateReview();
  });
  $('htdReviewForm').addEventListener('submit', event => { event.preventDefault(); showResult(); });
  $('htdDownload').addEventListener('click', () => {
    if (!result || !$('htdConfirmed').checked) return;
    const data = { version: 1, profileSource: draft.mode, selectionSource: 'offline_rules', marketDataSource: 'existing_demo_pool',
      editedFields: Object.keys(core.fields).filter(key => !sameValue(result.profile[key], draft.profile[key])),
      draftProfile: draft.profile, evidence: draft.evidence,
      profileConfirmed: true, profile: result.profile, status: result.status, message: result.message,
      candidates: result.candidateCount, stocks: result.stocks.map(s => ({ code: s.code, sector: s.sector, suitabilityScore: s.suitabilityScore, reasons: s.reasons, caution: s.caution })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'HTD_Demo_HoSo_KetQua.json';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  function switchMode(next) {
    mode = next;
    root.hidden = next !== 'demo';
    $('financialForm').hidden = next !== 'manual';
    $('htdTabDemo').setAttribute('aria-selected', String(next === 'demo'));
    $('htdTabManual').setAttribute('aria-selected', String(next === 'manual'));
    $('pdfPage1').classList.add('hidden'); $('pdfPage2').classList.add('hidden');
    $('downloadBtnContainer').classList.remove('show');
  }
  $('htdTabDemo').addEventListener('click', () => switchMode('demo'));
  $('htdTabManual').addEventListener('click', () => switchMode('manual'));
  // Cancel an old manual report when its input changes, rather than exporting stale values.
  $('financialForm').addEventListener('input', () => {
    $('pdfPage1').classList.add('hidden'); $('pdfPage2').classList.add('hidden'); $('downloadBtnContainer').classList.remove('show');
  });
  choose(selected); switchMode(mode);
})();
