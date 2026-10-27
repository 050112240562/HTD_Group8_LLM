(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HTDProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const sectors = {
    Banking: 'Ngân hàng', Energy: 'Năng lượng', Utilities: 'Tiện ích',
    Telecom: 'Viễn thông', Insurance: 'Bảo hiểm', Consumer: 'Tiêu dùng',
    Technology: 'Công nghệ', Logistics: 'Logistics', Materials: 'Vật liệu',
    Retail: 'Bán lẻ', Agriculture: 'Nông nghiệp', RealEstate: 'Bất động sản',
    Infrastructure: 'Hạ tầng', Securities: 'Chứng khoán', Industrial: 'Công nghiệp',
    Conglomerate: 'Đa ngành', Aviation: 'Hàng không', Media: 'Truyền thông', Finance: 'Tài chính'
  };
  const fields = {
    capital: 'Vốn dành riêng cho cổ phiếu', goal: 'Mục tiêu đầu tư',
    horizonMonths: 'Thời hạn đầu tư', risk: 'Mức chịu rủi ro',
    liquidity: 'Nhu cầu rút tiền sớm', experience: 'Kinh nghiệm đầu tư',
    preferredSectors: 'Ngành ưu tiên', excludedSectors: 'Ngành muốn tránh'
  };
  const labels = {
    risk: { low: 'Thấp', medium: 'Trung bình', high: 'Cao' },
    liquidity: { low: 'Thấp', medium: 'Trung bình', high: 'Cao' },
    experience: { beginner: 'Mới bắt đầu', intermediate: 'Có kinh nghiệm cơ bản', experienced: 'Có nhiều kinh nghiệm' },
    goal: { preserve: 'Ưu tiên bảo toàn vốn', income: 'Ưu tiên thu nhập', growth: 'Ưu tiên tăng trưởng' }
  };
  const definitions = [
    {
      id: 'careful', title: '01 · Thận trọng', subtitle: 'Vốn 10 triệu · 3 năm',
      statements: [
        ['capital', 10000000, 'Tôi dành riêng 10 triệu đồng cho cổ phiếu, tách khỏi quỹ dự phòng.'],
        ['goal', 'preserve', 'Mục tiêu là ưu tiên bảo toàn vốn.'],
        ['horizonMonths', 36, 'Tôi dự kiến đầu tư trong 3 năm.'],
        ['risk', 'low', 'Mức chịu rủi ro của tôi là thấp.'],
        ['liquidity', 'low', 'Nhu cầu rút tiền sớm của tôi là thấp.'],
        ['experience', 'beginner', 'Tôi mới bắt đầu đầu tư.'],
        ['preferredSectors', ['Consumer', 'Utilities'], 'Tôi ưu tiên ngành tiêu dùng và tiện ích.'],
        ['excludedSectors', ['RealEstate'], 'Tôi muốn tránh ngành bất động sản.']
      ]
    },
    {
      id: 'balanced', title: '02 · Cân bằng', subtitle: 'Vốn 100 triệu · 2 năm',
      statements: [
        ['capital', 100000000, 'Tôi có 100 triệu đồng dành riêng để đầu tư cổ phiếu.'],
        ['goal', 'growth', 'Mục tiêu của tôi là tăng trưởng vốn.'],
        ['horizonMonths', 24, 'Thời hạn đầu tư là 2 năm.'],
        ['risk', 'medium', 'Tôi chấp nhận mức rủi ro trung bình.'],
        ['liquidity', 'medium', 'Nhu cầu rút tiền sớm của tôi là trung bình.'],
        ['experience', 'intermediate', 'Tôi có kinh nghiệm đầu tư cơ bản.'],
        ['preferredSectors', ['Technology', 'Logistics'], 'Tôi ưu tiên công nghệ và logistics.'],
        ['excludedSectors', ['RealEstate'], 'Tôi muốn tránh bất động sản.']
      ]
    },
    {
      id: 'active', title: '03 · Chấp nhận biến động', subtitle: 'Vốn 200 triệu · 12 tháng',
      statements: [
        ['capital', 200000000, 'Tôi dành riêng 200 triệu đồng cho cổ phiếu.'],
        ['goal', 'growth', 'Tôi ưu tiên tăng trưởng vốn.'],
        ['horizonMonths', 12, 'Tôi dự kiến đầu tư trong 12 tháng.'],
        ['risk', 'high', 'Tôi chấp nhận rủi ro cao.'],
        ['liquidity', 'low', 'Nhu cầu rút tiền sớm của tôi là thấp.'],
        ['experience', 'experienced', 'Tôi có nhiều kinh nghiệm đầu tư.'],
        ['preferredSectors', ['Securities', 'Technology'], 'Tôi ưu tiên chứng khoán và công nghệ.'],
        ['excludedSectors', ['RealEstate'], 'Tôi muốn tránh bất động sản.']
      ]
    },
    {
      id: 'missing', title: '04 · Cần bổ sung', subtitle: 'Chưa rõ thời hạn và rủi ro',
      statements: [
        ['capital', 50000000, 'Tôi có 50 triệu đồng dành riêng cho cổ phiếu.'],
        ['goal', 'growth', 'Tôi muốn tăng trưởng vốn.'],
        ['liquidity', 'medium', 'Nhu cầu rút tiền sớm của tôi là trung bình.'],
        ['experience', 'beginner', 'Tôi mới bắt đầu đầu tư.'],
        ['preferredSectors', ['Technology'], 'Tôi ưu tiên ngành công nghệ.'],
        ['excludedSectors', [], 'Tôi không loại trừ ngành nào.']
      ],
      extra: 'Tôi chưa xác định thời hạn đầu tư và mức chịu rủi ro.'
    }
  ];
  const fixtures = definitions.map(item => {
    const profile = Object.fromEntries(Object.keys(fields).map(k => [k, k.endsWith('Sectors') ? [] : null]));
    const evidence = {};
    for (const [key, value, quote] of item.statements) { profile[key] = value; evidence[key] = quote; }
    return { id: item.id, title: item.title, subtitle: item.subtitle, profile, evidence,
      text: item.statements.map(s => s[2]).concat(item.extra || []).join(' ') };
  });
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function normalize(text) { return String(text).trim().replace(/\s+/g, ' '); }
  function extractDemo(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Hãy chọn tình huống và nhập mô tả.');
    const fixture = fixtures.find(f => normalize(f.text) === normalize(text));
    if (!fixture) throw new Error('Nội dung đã khác tình huống mẫu. Bản demo không tự đọc văn bản mới; hãy khôi phục mẫu hoặc chọn “Tự điền hồ sơ”.');
    return { profile: copy(fixture.profile), evidence: copy(fixture.evidence),
      uncertainFields: Object.keys(fields).filter(k => fixture.profile[k] === null), mode: 'demo_fixture', fixtureId: fixture.id };
  }
  function validate(profile) {
    const errors = [], warnings = [];
    const questions = {
      capital: 'Bạn dành riêng bao nhiêu VND cho cổ phiếu, sau khi giữ lại tiền dự phòng?',
      goal: 'Bạn ưu tiên bảo toàn vốn, thu nhập hay tăng trưởng?',
      horizonMonths: 'Bạn dự kiến giữ khoản đầu tư trong bao nhiêu tháng?',
      risk: 'Bạn xác nhận mức chịu rủi ro thấp, trung bình hay cao?',
      liquidity: 'Nhu cầu rút tiền trước hạn của bạn thấp, trung bình hay cao?',
      experience: 'Bạn mới bắt đầu, có kinh nghiệm cơ bản hay có nhiều kinh nghiệm?'
    };
    for (const key of Object.keys(questions)) {
      const value = profile[key];
      if (value === null || value === undefined || value === '') errors.push({ field: key, message: questions[key] });
      else if (key === 'capital' && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER))
        errors.push({ field: key, message: 'Vốn cổ phiếu phải là số VND hữu hạn, lớn hơn 0 và không vượt giới hạn số chính xác.' });
      else if (key === 'horizonMonths' && (!Number.isInteger(value) || value < 1 || value > 600))
        errors.push({ field: key, message: 'Thời hạn phải là số tháng nguyên từ 1 đến 600.' });
      else if (labels[key] && !Object.hasOwn(labels[key], value)) errors.push({ field: key, message: 'Hãy chọn giá trị hợp lệ cho ' + fields[key].toLowerCase() + '.' });
    }
    for (const key of ['preferredSectors', 'excludedSectors']) {
      if (!Array.isArray(profile[key]) || profile[key].some(s => !Object.hasOwn(sectors, s)))
        errors.push({ field: key, message: 'Danh sách ngành không hợp lệ.' });
    }
    if (Array.isArray(profile.preferredSectors) && Array.isArray(profile.excludedSectors) && profile.preferredSectors.some(s => profile.excludedSectors.includes(s)))
      errors.push({ field: 'preferredSectors', message: 'Một ngành đang được chọn cả ưu tiên và muốn tránh. Hãy bỏ lựa chọn mâu thuẫn.' });
    if (profile.goal === 'preserve') warnings.push('Ưu tiên bảo toàn vốn không có nghĩa cổ phiếu bảo đảm giữ nguyên vốn.');
    if (profile.experience === 'beginner' && profile.risk === 'high') warnings.push('Bạn mới bắt đầu nhưng chấp nhận rủi ro cao. Demo sẽ giới hạn ứng viên ở nhóm biến động thấp và trung bình.');
    if (profile.goal === 'income') warnings.push('Bộ dữ liệu demo chưa có lịch sử cổ tức; chưa đủ căn cứ đánh giá khả năng tạo thu nhập.');
    return { valid: errors.length === 0, errors, warnings };
  }
  function rankStocks(profile, pool, confirmed) {
    const validation = validate(profile);
    if (!validation.valid || confirmed !== true) return { status: 'needs_review', stocks: [], candidateCount: 0, validation,
      message: validation.valid ? 'Hãy xác nhận hồ sơ trước khi lọc.' : 'Hãy bổ sung hoặc sửa hồ sơ trước khi lọc.' };
    if (profile.horizonMonths <= 6 || profile.liquidity === 'high') return {
      status: 'unsuitable', stocks: [], candidateCount: 0, validation,
      message: 'Demo chưa đề xuất cổ phiếu khi thời hạn từ 6 tháng trở xuống hoặc nhu cầu rút tiền sớm cao. Cần làm rõ khả năng giữ khoản đầu tư trước.'
    };
    if (profile.goal === 'income') return { status: 'insufficient_data', stocks: [], candidateCount: 0, validation,
      message: 'Chưa lọc theo mục tiêu thu nhập vì dữ liệu hiện có chưa chứa cổ tức. Hệ thống không tự đổi mục tiêu của bạn.' };
    const riskRank = { Conservative: 1, Balanced: 2, Aggressive: 3 };
    let ceiling = { low: 1, medium: 2, high: 3 }[profile.risk];
    if (profile.experience === 'beginner' || profile.liquidity === 'medium') ceiling = Math.min(ceiling, 2);
    if (profile.goal === 'preserve') ceiling = 1;
    const horizon = profile.horizonMonths >= 36 ? 'Long-term' : profile.horizonMonths >= 18 ? 'Medium-term' : 'Short-term';
    const seen = new Set();
    const candidates = pool.filter(stock => {
      const risk = riskRank[stock.type];
      if (!risk || risk > ceiling || !Object.hasOwn(sectors, stock.sector) || profile.excludedSectors.includes(stock.sector) || !/^[A-Z0-9]{2,8}$/.test(stock.code) || seen.has(stock.code)) return false;
      seen.add(stock.code); return true;
    }).map(stock => {
      const risk = riskRank[stock.type], reasons = [];
      let score = 50;
      if (risk === ceiling) { score += 20; reasons.push('Thuộc nhóm rủi ro ưu tiên trong giới hạn hồ sơ.'); }
      else reasons.push('Thuộc nhóm rủi ro thấp hơn giới hạn hồ sơ.');
      if (profile.preferredSectors.includes(stock.sector)) { score += 20; reasons.push('Nằm trong ngành bạn ưu tiên: ' + sectors[stock.sector] + '.'); }
      if (stock.horizon === horizon) { score += 10; reasons.push('Khớp nhãn thời hạn trong bộ dữ liệu demo.'); }
      if (profile.goal === 'preserve') reasons.push('Được giữ lại theo tiêu chí nhóm thận trọng của demo.');
      return { ...stock, suitabilityScore: score, reasons,
        caution: 'Phân nhóm có sẵn trong demo; chưa kiểm chứng biến động, thanh khoản hay định giá hiện tại.' };
    }).sort((a, b) => b.suitabilityScore - a.suitabilityScore || a.code.localeCompare(b.code));
    const stocks = [], counts = {};
    for (const stock of candidates) {
      if ((counts[stock.sector] || 0) >= 2) continue;
      stocks.push(stock); counts[stock.sector] = (counts[stock.sector] || 0) + 1;
      if (stocks.length === 5) break;
    }
    return { status: stocks.length ? 'ready' : 'no_match', stocks, candidateCount: candidates.length, validation,
      message: stocks.length ? 'Đã chọn ' + stocks.length + ' mã từ ' + candidates.length + ' ứng viên đủ điều kiện. Mỗi ngành tối đa 2 mã; không nới tiêu chí để đủ 5.' : 'Không có mã đáp ứng các giới hạn hiện tại. Hệ thống không tự nới tiêu chí.' };
  }
  function formatValue(key, value) {
    if (value === null || value === undefined || value === '') return 'Chưa cung cấp';
    if (key === 'capital') return value.toLocaleString('vi-VN') + ' VND';
    if (key === 'horizonMonths') return value + ' tháng';
    if (Array.isArray(value)) return value.length ? value.map(s => sectors[s] || s).join(', ') : 'Không chọn';
    return labels[key]?.[value] || String(value);
  }
  return { fixtures, fields, sectors, labels, extractDemo, validate, rankStocks, formatValue, copy };
});
