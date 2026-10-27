'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const Money=window.HTDMoneyInput;
  const Presentation=window.HTDPlanPresentation;
  let currentStep=1, activeResult='overview';
  const keys = ['conservative','base','optimistic'];
  const names = {conservative:'Thận trọng',base:'Cơ sở',optimistic:'Tích cực'};
  const colors = {conservative:'#7c8b9b',base:'#173d62',optimistic:'#9a772e'};
  const fields = [
    ['goal_name','Tên mục tiêu','text','Ví dụ: Quỹ học cao học'],
    ['goal_amount','Số tiền mục tiêu theo giá hôm nay','number','Đồng · Ví dụ 100.000.000 = 100 triệu'],
    ['goal_horizon_months','Thời hạn mong muốn','months','Tháng · Số nguyên từ 1 đến 120'],
    ['monthly_primary_income','Thu nhập chính / tháng','number','Đồng/tháng · Ví dụ 18.000.000'],
    ['monthly_other_income','Thu nhập phụ / tháng','number','Đồng/tháng · Không có nhập 0'],
    ['monthly_essential_expense','Chi phí thiết yếu / tháng','number','Ăn, ở, điện nước · Đồng/tháng'],
    ['monthly_discretionary_expense','Chi phí linh hoạt / tháng','number','Mua sắm, giải trí · Đồng/tháng'],
    ['monthly_debt_payment','Trả nợ / tháng','number','Đồng/tháng · Không có nhập 0'],
    ['current_savings','Tổng tiết kiệm hiện có','number','Đồng · Đã bao gồm quỹ dự phòng'],
    ['emergency_fund_reserved','Giữ lại làm quỹ dự phòng','number','Đồng · Tách từ tổng tiết kiệm trên, không góp hằng tháng'],
    ['risk_tolerance','Mức chấp nhận biến động','level','Giới hạn lợi suất demo; chưa đánh giá sự phù hợp của sản phẩm đầu tư'],
    ['liquidity_need','Nhu cầu rút tiền sớm','level','Chỉ ghi nhận, chưa mô phỏng các lần rút tiền']
  ];
  let cfg, mode='sample', profile=null, plan=null, pending=false, pdfUrl=null, sequence=0, busy=false, explained=false;
  const esc = val => String(val ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const money = val => val == null ? 'Chưa xác định' : new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(val)+' ₫';
  const amount = val => `<span title="${esc(money(val))}" aria-label="${esc(money(val))}">${esc(Presentation.compact(val))}</span>`;
  const pct = val => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(val*100)+'%';
  const month = val => val == null ? 'Chưa xác định trong giới hạn mô phỏng' : val===0?'Đã đủ vốn ban đầu':'Tháng '+val;
  function stageAvailable(n){return n===1||n===2&&!!profile||n===3&&!!plan||n===4&&explained&&!pending;}
  function syncNavigation(){document.querySelectorAll('[data-go-step]').forEach(button=>button.disabled=busy||!stageAvailable(Number(button.dataset.goStep)));}
  function step(n){
    currentStep=n;
    document.querySelectorAll('[data-view]').forEach(el=>el.hidden=Number(el.dataset.view)!==n);
    document.querySelector('.p9-hero').hidden=n!==1;
    document.querySelectorAll('[data-step]').forEach(el=>{el.classList.toggle('active',+el.dataset.step===n);el.classList.toggle('done',+el.dataset.step<n);});
    document.querySelectorAll('.p9-steps [data-go-step]').forEach(button=>{if(+button.dataset.goStep===n)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    syncNavigation();
  }
  function navigate(n){if(busy||!stageAvailable(n))return;step(n);const panel=document.querySelector('[data-view="'+n+'"]');panel.scrollIntoView({behavior:'smooth',block:'start'});panel.querySelector('h2')?.focus({preventScroll:true});if(n===3&&!pending){balanceChart();scenarioChart();}}
  function resultPage(name){
    if(pending&&name!=='adjustments')return;
    activeResult=name;
    document.querySelectorAll('[data-result-view]').forEach(el=>el.hidden=el.dataset.resultView!==name);
    document.querySelectorAll('[data-result-page]').forEach(button=>{const selected=button.dataset.resultPage===name;button.setAttribute('aria-pressed',String(selected));button.disabled=busy||(pending&&button.dataset.resultPage!=='adjustments');});
    if(plan&&!pending){if(name==='timeline')balanceChart();if(name==='scenarios')scenarioChart();}
  }

  function error(msg){$('error').textContent=msg;$('error').hidden=!msg;if(msg)$('error').scrollIntoView({block:'center',behavior:'smooth'});}
  async function api(path,payload,binary=false){
    const response=await fetch('/api/'+path,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
    if(!response.ok){let obj;try{obj=await response.json();}catch{obj={};}throw new Error(obj.error||'Chưa kết nối được dịch vụ. Kiểm tra kết nối rồi thử lại.');}
    return binary?response.blob():response.json();
  }
  async function action(button,fn){
    if(busy)return;error('');busy=true;const text=button.textContent;button.textContent='Đang xử lý…';button.setAttribute('aria-busy','true');syncButtons();
    try{await fn();}catch(e){error(e.message);}finally{busy=false;button.textContent=text;button.removeAttribute('aria-busy');syncButtons();}
  }
  function syncButtons(){
    $('extract').disabled=busy||!cfg;$('makePlan').disabled=busy||!profile;
    $('recalculate').disabled=busy||!profile;
    $('explain').disabled=busy||!plan||pending;
    $('download').disabled=busy||!plan||pending||!explained||!$('assumptionsConfirmed').checked;
    $('aiExplain').disabled=busy||!cfg?.ai_configured||!$('aiCommentConsent').checked||!plan||pending||!explained;
    $('aiMode').disabled=busy||!cfg?.ai_configured;
    syncNavigation();
    document.querySelectorAll('[data-result-page]').forEach(button=>button.disabled=busy||(pending&&button.dataset.resultPage!=='adjustments'));
  }
  function clearReport(){explained=false;$('report').hidden=true;$('reportConfirmed').checked=false;$('assumptionsConfirmed').checked=false;$('pdfLink').hidden=true;if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl=null;}syncButtons();}
  function invalidate(){sequence++;plan=null;pending=false;$('results').hidden=true;clearReport();$('profileConfirmed').checked=false;clearValidation();renderProfileDigest();step(2);}
  function changedAssumptions(){sequence++;$('profileConfirmed').checked=false;updateReviewAssumptions();if(plan){pending=true;$('pending').hidden=false;document.querySelectorAll('.p9-result-data').forEach(el=>el.hidden=true);resultPage('adjustments');$('usedAssumptions').textContent='Đầu vào đã thay đổi. Cần tính lại trước khi xem giải thích.';clearReport();}}
  function number(id,label,optional=false){const input=$(id);if(input.value.trim()===''){if(optional)return null;throw new Error('Cần nhập '+label+'.');}const val=input.dataset.money==='true'?Money.parse(input.value):Number(input.value);if(!Number.isFinite(val))throw new Error(label+' phải là số hữu hạn.');return val;}
  function assumptions(){return {annual_return_rate:number('annualReturn','lợi suất')/100,annual_inflation_rate:number('inflation','lạm phát')/100,monthly_contribution:number('contribution','khoản góp',true)};}
  function updateReviewAssumptions(){if(!cfg)return;const rate=$('annualReturn').value,inflation=$('inflation').value,contribution=$('contribution').value;
    $('reviewAssumptions').textContent=`Giả định: lợi suất ${rate||'chưa nhập'}%/năm · lạm phát ${inflation||'chưa nhập'}%/năm · ${contribution===''?'dùng toàn bộ dòng tiền dư làm khoản góp':(()=>{try{return money(Money.parse(contribution))+'/tháng';}catch{return 'khoản góp chưa hợp lệ';}})()}. Góp cuối tháng; chưa tính thuế, phí. Bạn có thể chỉnh ở mục phía trên.`;}
  function readProfile(){const p={...profile};fields.forEach(([key,,type])=>{const value=$('p9_'+key).value;p[key]=value===''?null:type==='number'?Money.parse(value):type==='months'?Number(value):value.trim();});return p;}
  function renderProfileDigest(){
    const target=$('profileDigest');if(!profile||!$('p9_goal_name'))return;
    try{
      const data=Presentation.profileSummary(readProfile());
      target.innerHTML=`<div class="p9-digest-heading"><h3>${esc(data.goal)}</h3><span>${data.horizon==null?'Chưa có thời hạn':esc(data.horizon)+' tháng'}</span></div><div class="p9-digest-grid">`+data.items.map(item=>`<div><span>${esc(item.label)}</span><b>${amount(item.value)}</b></div>`).join('')+'</div>';
    }catch{target.innerHTML='<p class="p9-hint">Đang chỉnh sửa thông tin. Hãy kiểm tra ô tiền được đánh dấu trước khi tiếp tục.</p>';}
  }
  function blankProfile(){const p={user_id:null,expected_income_growth:null,notes:null};fields.forEach(([key])=>p[key]=null);return p;}
  function clearValidation(){ $('validation').replaceChildren();fields.forEach(([key])=>{const el=$('p9_'+key);if(el){el.removeAttribute('aria-invalid');$('help_'+key).classList.remove('p9-field-error');$('help_'+key).textContent=el.dataset.help;}});}
  function renderProfile(p,origin){
    invalidate();profile={...p};$('review').hidden=false;$('origin').textContent=origin;
    const groups={goal_name:'Mục tiêu',monthly_primary_income:'Thu nhập và chi tiêu mỗi tháng',current_savings:'Tiền hiện có và dự phòng',risk_tolerance:'Rủi ro và nhu cầu sử dụng tiền'};
    $('profileFields').innerHTML=fields.map(([key,label,type,help])=>(groups[key]?`<h3 class="p9-subheading">${groups[key]}</h3>`:'')+`<label for="p9_${key}">${esc(label)}${type==='level'?`<select id="p9_${key}" aria-describedby="help_${key}"><option value="">Chọn mức</option><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select>`:`<input id="p9_${key}" aria-describedby="help_${key}" type="${type==='months'?'number':'text'}" ${type==='number'?'inputmode="numeric" data-money="true"':type==='months'?'min="1" max="120" step="1"':'maxlength="200"'}>`}<small id="help_${key}" class="p9-field-help">${esc(help)}</small></label>`).join('');
    fields.forEach(([key,,type,help])=>{
      const input=$('p9_'+key);input.value=type==='number'?Money.format(p[key]):p[key]??'';input.dataset.help=help;
      input.addEventListener('input',()=>{invalidate();if(type==='months'&&input.value!=='')$('help_'+key).textContent=input.value+' tháng';});
      if(type==='number')Money.bind(input,error=>{const hint=$('help_'+key);hint.classList.toggle('p9-field-error',!!error);hint.textContent=error||help;});
    });
    $('profileEditor').open=mode==='manual';renderProfileDigest();
    updateReviewAssumptions();$('review').scrollIntoView({behavior:'smooth',block:'start'});step(2);syncButtons();
  }
  function table(headers,rows,extra=''){return `<div class="p9-table-wrap"><table class="p9-table ${extra}"><thead><tr>`+headers.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((val,i)=>`<${i?'td':'th'} ${i?'':'scope="row"'}>${esc(val)}</${i?'td':'th'}>`).join('')+'</tr>').join('')+'</tbody></table></div>';}
  function validation(r){clearValidation();const errors=r.errors||[],warnings=r.warnings||[];
    errors.forEach(item=>{const el=$('p9_'+item.field),help=$('help_'+item.field);if(el&&help){el.setAttribute('aria-invalid','true');help.classList.add('p9-field-error');help.textContent=item.message;}});
    const questions=r.clarification_questions||[];const messages=[...new Set([...errors,...warnings].filter(x=>x.code!=='income_growth_not_applied_in_mvp').map(x=>x.message).concat(questions))];
    $('validation').innerHTML=messages.length?'<div class="p9-note"><b>Kiểm tra hồ sơ cơ sở</b>'+messages.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>':'';
    if(errors.length){$('profileEditor').open=true;$('validation').scrollIntoView({block:'center',behavior:'smooth'});const first=$('p9_'+errors[0].field);first?.focus({preventScroll:true});}
  }
  function chartReadout(){if(!plan)return;const m=Number($('chartMonth').value),selected=$('compareScenarios').checked?keys:['base'];$('chartMonthLabel').textContent=m;
    const rows=selected.map(k=>{const r=plan.scenarios[k].monthly_projection[m];return `<span><b>${names[k]}:</b> ${esc(money(r.balance))} · ${r.balance<r.target_amount?'thiếu':'vượt'} ${esc(money(Math.abs(r.target_amount-r.balance)))}</span>`;});
    const base=plan.scenarios.base, r=base.monthly_projection[m];
    $('chartReadout').innerHTML=`<span><b>Mục tiêu tháng ${m}:</b> ${esc(money(r.target_amount))}</span>`+rows.join('')+`<span>Vốn ban đầu + tiền tự góp (cơ sở): ${esc(money(base.calculation_result.initial_available_amount+r.cumulative_contributions))}</span>`;
  }
  function balanceChart(){
    if(!plan)return;const scenarios=plan.scenarios,shown=$('compareScenarios').checked?keys:['base'];
    const mobile=window.innerWidth<700,w=mobile?420:940,h=mobile?360:360,pad={l:62,r:22,t:28,b:52};
    const max=Math.max(1,...shown.flatMap(k=>scenarios[k].monthly_projection.map(x=>Math.max(x.balance,x.target_amount))))*1.12,count=scenarios.base.calculation_result.goal_horizon_months;
    const X=m=>pad.l+m/count*(w-pad.l-pad.r),Y=v=>h-pad.b-v/max*(h-pad.t-pad.b);
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="balanceTitle balanceDesc"><title id="balanceTitle">Tiến độ tích lũy theo tháng</title><desc id="balanceDesc">Số dư và mục tiêu theo lạm phát. Kéo thanh chọn tháng bên dưới để đọc số tiền.</desc>`;
    for(let i=0;i<=4;i++){const v=max*i/4,y=Y(v);svg+=`<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#e0e6ec"/><text x="${pad.l-8}" y="${y+5}" text-anchor="end" font-size="14" fill="#54687a">${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(v/1e6)}</text>`;}
    svg+='<text x="5" y="17" font-size="14" fill="#54687a">Triệu ₫</text>';
    shown.forEach(k=>{const rows=scenarios[k].monthly_projection;svg+=`<polyline points="${rows.map(r=>`${X(r.month)},${Y(r.balance)}`).join(' ')}" fill="none" stroke="${colors[k]}" stroke-width="${k==='base'?4:2.5}" ${k==='conservative'?'stroke-dasharray="9 4"':''}/>`;const r=rows.at(-1);svg+=`<circle cx="${X(r.month)}" cy="${Y(r.balance)}" r="5" fill="${colors[k]}"><title>${names[k]}: ${esc(money(r.balance))}</title></circle>`;});
    svg+=`<polyline points="${scenarios.base.monthly_projection.map(r=>`${X(r.month)},${Y(r.target_amount)}`).join(' ')}" fill="none" stroke="#ad4343" stroke-width="2.5" stroke-dasharray="3 5"/>`;
    svg+=`<line x1="${X(count)}" y1="${pad.t}" x2="${X(count)}" y2="${h-pad.b}" stroke="#9baab8" stroke-dasharray="4 4"/>`;
    const b=scenarios.base.calculation_result,hit=b.estimated_month_to_goal;
    if(hit!=null&&hit<=count){const r=scenarios.base.monthly_projection[hit];svg+=`<circle cx="${X(hit)}" cy="${Y(r.balance)}" r="7" stroke="white" stroke-width="2" fill="#173d62"><title>Lần đầu chạm mục tiêu: tháng ${hit}</title></circle>`;}
    [...new Set([0,Math.round(count/2),count])].forEach(m=>svg+=`<text x="${X(m)}" y="${h-16}" text-anchor="${m===count?'end':m===0?'start':'middle'}" font-size="14" fill="#54687a">${m===count?'Hạn: ':''}Tháng ${m}</text>`);
    $('balanceChart').innerHTML=svg+'</svg>';
    $('legend').innerHTML=shown.map(k=>`<span><i style="background:${colors[k]}"></i>${names[k]}${k==='conservative'?' (nét đứt)':''}</span>`).join('')+'<span><i style="background:#ad4343"></i>Mục tiêu (nét chấm)</span>';
    $('chartSummary').textContent=`Hạn ${count} tháng: ${money(b.fv_total)} / ${money(b.adjusted_goal_amount)} · ${b.goal_gap>0?'Thiếu ':'Vượt '}${money(Math.abs(b.goal_gap))}${hit!=null&&hit<=count?' · Lần đầu chạm mục tiêu: tháng '+hit:''}`;
    chartReadout();
  }
  function scenarioChart(){
    const s=plan.scenarios,mobile=window.innerWidth<700,w=mobile?420:940,h=330,p={l:62,r:22,t:40,b:74};
    const target=s.base.calculation_result.adjusted_goal_amount,max=Math.max(1,target,...keys.map(k=>s[k].calculation_result.fv_total))*1.24,Y=v=>h-p.b-v/max*(h-p.t-p.b),width=(w-p.l-p.r)/3;
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Ba cột số dư cuối kỳ so với đường mục tiêu"><text x="5" y="17" font-size="14" fill="#54687a">Triệu ₫</text>`;
    for(let i=0;i<=3;i++){const v=max*i/3;svg+=`<line x1="${p.l}" y1="${Y(v)}" x2="${w-p.r}" y2="${Y(v)}" stroke="#e0e6ec"/><text x="${p.l-8}" y="${Y(v)+5}" text-anchor="end" font-size="14">${(v/1e6).toFixed(0)}</text>`;}
    keys.forEach((k,i)=>{const m=s[k].calculation_result,x=p.l+width*(i+.5),bw=width*.45;svg+=`<rect x="${x-bw/2}" y="${Y(m.fv_total)}" width="${bw}" height="${Math.max(0,Y(0)-Y(m.fv_total))}" rx="4" fill="${colors[k]}"><title>${names[k]}: ${esc(money(m.fv_total))}; ${m.goal_gap>0?'thiếu':'vượt'} ${esc(money(Math.abs(m.goal_gap)))}</title></rect><text x="${x}" y="${Y(m.fv_total)-12}" text-anchor="middle" font-size="15" font-weight="bold">${(m.fv_total/1e6).toFixed(1)}</text><text x="${x}" y="${h-46}" text-anchor="middle" font-size="15">${names[k]}</text><text x="${x}" y="${h-23}" text-anchor="middle" font-size="13">${pct(m.annual_return_rate)}/năm</text>`;});
    svg+=`<line x1="${p.l}" y1="${Y(target)}" x2="${w-p.r}" y2="${Y(target)}" stroke="#ad4343" stroke-width="2" stroke-dasharray="4 5"/><text x="${w-p.r}" y="${Math.max(22,Y(target)-8)}" text-anchor="end" font-size="13" fill="#a73535">Mục tiêu: ${(target/1e6).toFixed(1)} triệu</text></svg>`;
    $('scenarioChart').innerHTML=svg;
  }
  function budget(){const b=plan.guidance.budget;
    const rows=[['Thiết yếu',profile.monthly_essential_expense,'#758da3'],['Linh hoạt',profile.monthly_discretionary_expense,'#aebdca'],['Trả nợ',profile.monthly_debt_payment,'#9a772e'],['Góp cho mục tiêu',b.contribution,'#173d62'],['Còn lại',b.remaining,'#d5e1d8']];
    const total=rows.reduce((a,r)=>a+r[1],0);
    $('budgetSummary').innerHTML=`<p><b>Thu nhập ${esc(money(b.income))}/tháng</b> · Sau chi tiêu và trả nợ: ${esc(money(b.surplus))}/tháng.</p>`+(b.shortfall>.01?`<div class="p9-error">Tổng chi và khoản góp vượt thu nhập ${esc(money(b.shortfall))}/tháng. Phần thiếu này chưa có nguồn bù.</div>`:'');
    $('budgetChart').innerHTML=(total>0?'<div class="p9-budget-bar" role="img" aria-label="Phân bổ số tiền tháng, chi tiết trong bảng bên dưới">'+rows.filter(r=>r[1]>0).map(([label,v,color])=>`<span tabindex="0" class="p9-budget-segment" style="width:${v/total*100}%;background:${color}" title="${esc(label+': '+money(v))}"></span>`).join('')+'</div>':'<p>Không có dòng tiền để phân bổ.</p>')+'<div class="p9-budget-labels">'+rows.map(([label,v,color])=>`<span><i style="background:${color}"></i>${label}: ${esc(money(v))}</span>`).join('')+'</div>';
    $('budgetTable').innerHTML=table(['Kiểm tra nguồn tiền','Số tiền'],[['Thu nhập mỗi tháng',money(b.income)],['Chi tiêu và trả nợ',money(b.outflow)],['Góp cho mục tiêu',money(b.contribution)],['Tiền còn lại sau phân bổ',money(b.remaining)],['Thiếu nguồn tiền mỗi tháng',money(b.shortfall)],['Dự phòng giữ riêng từ tiết kiệm',money(b.reserve)],['Vốn ban đầu cho mục tiêu',money(b.initial_available)]],'p9-budget-table');
  }
  function renderPlan(result){
    if(result.blocked){validation(result.validation);throw new Error('Hồ sơ chưa đủ hoặc cần sửa. Xem các ô và lưu ý ở bước Kiểm tra.');}
    plan=result;pending=false;$('pending').hidden=true;$('results').hidden=false;clearReport();document.querySelectorAll('.p9-result-data').forEach(el=>el.hidden=false);
    const s=result.scenarios,b=s.base.calculation_result,g=result.guidance;
    $('outcome').classList.toggle('caution',!g.positive);$('outcome').innerHTML=`<span class="p9-outcome-label">KẾT LUẬN CƠ SỞ · ${b.goal_horizon_months} THÁNG</span><h3>${esc(g.headline)}</h3><p>${esc(g.reason)}</p>`;
    $('metrics').innerHTML=[['Mục tiêu đã tính lạm phát',b.adjusted_goal_amount],['Dự kiến cuối kỳ',b.fv_total],['Khoản góp mỗi tháng',b.monthly_contribution]].map(([label,val])=>`<div class="p9-metric"><span>${esc(label)}</span><b>${amount(val)}</b></div>`).join('');
    const overviewActions=Presentation.analysis(result,profile);
    $('nextActions').innerHTML=overviewActions.actions.slice(0,2).map(a=>`<article class="p9-action"><h4>${esc(a.title)}</h4><p>${esc(a.text)}</p></article>`).join('');
    if(!g.feasible)$('nextActions').insertAdjacentHTML('afterbegin',`<p class="p9-important-note">${esc(g.reason)}</p>`);
    $('principalSummary').innerHTML=`Vốn ban đầu + tổng tiền tự góp: <b>${esc(money(g.principal))}</b>. Phần tăng/giảm theo lợi suất giả định: <b>${esc(money(g.investment_gain))}</b>. Số dư cuối kỳ: <b>${esc(money(b.fv_total))}</b>.`;
    $('cards').innerHTML=keys.map(k=>{const i=s[k],m=i.calculation_result,sp=i.scenario_adjustments,extra=m.contribution_affordability_gap>0||m.monthly_surplus<0;return `<article class="p9-card" style="--color:${colors[k]}"><span class="name">${names[k]}${k==='base'?' · Kế hoạch chính':''}</span><h3>${amount(m.fv_total)}</h3><strong class="${m.goal_reached_by_horizon&&!extra?'':'missing'}">${m.goal_gap>0?'Thiếu '+esc(money(m.goal_gap)):'Vượt '+esc(money(-m.goal_gap))}</strong><p>${k==='base'?'Giữ nguyên đầu vào đã xác nhận.':`Thu nhập ${(sp.income_multiplier*100-100).toFixed(0)}%; chi linh hoạt ${(sp.discretionary_expense_multiplier*100-100).toFixed(0)}%.`}</p><dl><div><dt>Góp / tháng</dt><dd>${esc(money(m.monthly_contribution))}</dd></div><div><dt>Lợi suất thực dùng</dt><dd>${pct(m.annual_return_rate)}/năm</dd></div><div><dt>Lần đầu chạm mục tiêu</dt><dd>${esc(month(m.estimated_month_to_goal))}</dd></div></dl>${extra?`<p class="missing">${m.monthly_surplus<0?'Chi tiêu vượt thu nhập '+esc(money(-m.monthly_surplus)):'Khoản góp vượt dòng tiền '+esc(money(m.contribution_affordability_gap))}/tháng.</p>`:''}${i.warnings.includes('scenario_return_rate_clipped_to_demo_limit')?'<p>Lợi suất đã chạm giới hạn rủi ro demo.</p>':''}</article>`;}).join('');
    const metrics=[['Thu nhập / tháng',i=>money(i.calculation_result.total_monthly_income)],['Chi linh hoạt / tháng',i=>money(i.profile_used.monthly_discretionary_expense)],['Góp cho mục tiêu / tháng',i=>money(i.calculation_result.monthly_contribution)],['Cách xác định khoản góp',i=>result.assumptions.monthly_contribution==null?pct(Math.min(1,i.scenario_adjustments.contribution_multiplier))+' dòng tiền dư sau điều chỉnh':pct(i.scenario_adjustments.contribution_multiplier)+' khoản góp cố định'],['Điều chỉnh lợi suất yêu cầu',i=>(i.scenario_adjustments.annual_return_rate_offset*100).toFixed(1)+' điểm %'],['Lợi suất thực dùng (sau giới hạn)',i=>pct(i.calculation_result.annual_return_rate)+'/năm']];
    $('assumptionComparison').innerHTML=table(['Giả định',...keys.map(k=>names[k])],metrics.map(([label,fn])=>[label,...keys.map(k=>fn(s[k]))]));
    $('chartMonth').max=b.goal_horizon_months;$('chartMonth').value=b.goal_horizon_months;balanceChart();scenarioChart();budget();
    const sr=result.stress_by_scenario,shock=result.stress_config.income_reduction_rate;
    $('stressComparison').innerHTML=shock===0?'<p class="p9-hint">Chưa áp dụng giảm thu nhập (0%). Bạn có thể thử ở phần trên.</p>':'<h3 style="margin-top:24px">Khi thu nhập giảm '+pct(shock)+' trong '+result.stress_config.duration_months+' tháng</h3>'+table(['Kết quả',...keys.map(k=>names[k])],[['Số dư sau cú giảm',...keys.map(k=>money(sr[k].stressed.calculation_result.fv_total))],['Giảm so với trước',...keys.map(k=>money(sr[k].comparison.fv_total_reduction))],['Lần đầu chạm mục tiêu sau giảm',...keys.map(k=>month(sr[k].stressed.calculation_result.estimated_month_to_goal))],['Thiếu hụt sinh hoạt chưa bù',...keys.map(k=>money(sr[k].comparison.unfunded_cashflow_deficit))]])+'<p class="p9-hint">Thiếu hụt sinh hoạt chưa bị trừ vào quỹ dự phòng hoặc vốn mục tiêu. Báo cáo PDF dùng phép thử của kịch bản cơ sở.</p>';
    $('whatIfResult').hidden=!result.what_if;if(result.what_if){const m=result.what_if.modified.calculation_result;$('whatIfResult').innerHTML=`<div class="p9-note"><b>Phép thử riêng · Cơ sở vẫn giữ nguyên</b><p>${esc(money(m.fv_total))} sau ${m.goal_horizon_months} tháng · ${m.goal_gap>0?'thiếu':'vượt'} ${esc(money(Math.abs(m.goal_gap)))}.${result.what_if.comparison.horizons_differ?' Thời hạn khác nhau nên không so trực tiếp hai số dư cuối kỳ.':''}</p></div>`;}
    $('usedAssumptions').textContent=`Lợi suất cơ sở ${pct(b.annual_return_rate)}/năm · lạm phát ${pct(b.annual_inflation_rate)}/năm · thời hạn ${b.goal_horizon_months} tháng · giảm thu nhập ${pct(shock)} trong ${result.stress_config.duration_months} tháng. Góp cuối tháng; chưa tính thuế, phí, tăng thu nhập lũy tiến hay rút tiền sớm. Quỹ dự phòng được giữ riêng, chưa tự động dùng để bù chi tiêu.`;
    resultPage(activeResult);step(3);syncButtons();
  }
  function editProfile(){navigate(2);}
  function setMode(next){mode=next;sequence++;profile=null;plan=null;pending=false;$('planner').classList.remove('p9-step-compact');$('review').hidden=true;$('results').hidden=true;clearReport();$('sampleArea').hidden=next==='manual';$('sample').hidden=next==='ai';$('sample').previousElementSibling.hidden=next==='ai';$('description').readOnly=next!=='ai';$('aiConsent').hidden=next!=='ai';$('extract').textContent=next==='manual'?'Mở biểu mẫu →':'Tạo bản nháp →';$('sourceHint').textContent=next==='ai'?'AI tạo bản nháp; bạn kiểm tra các con số trước khi tính.':'Hồ sơ mẫu dựng sẵn; không gọi AI trực tuyến.';if(next==='sample')setSample();else if(next==='ai')$('description').value='';document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===next);b.setAttribute('aria-pressed',String(b.dataset.mode===next));});step(1);}
  function setSample(){const s=cfg?.samples.find(x=>x.id===$('sample').value);$('description').value=s?.text||'';}
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('startPlan').addEventListener('click',event=>{event.preventDefault();navigate(1);});
  document.querySelectorAll('[data-go-step]').forEach(button=>button.addEventListener('click',()=>navigate(Number(button.dataset.goStep))));
  document.querySelectorAll('[data-result-page]').forEach(button=>button.addEventListener('click',()=>resultPage(button.dataset.resultPage)));
  ['contribution','wiIncome','wiExpense'].forEach(id=>Money.bind($(id)));
  step(1);
  $('sample').addEventListener('change',()=>{setSample();$('review').hidden=true;invalidate();step(1);});
  $('description').addEventListener('input',()=>{$('review').hidden=true;invalidate();step(1);});
  $('extract').addEventListener('click',()=>action($('extract'),async()=>{const seq=sequence;if(mode==='manual'){renderProfile(blankProfile(),'Nhập thủ công · Không gửi dữ liệu tới AI.');return;}const result=await api(mode==='sample'?'sample':'extract',mode==='sample'?{id:$('sample').value,text:$('description').value}:{text:$('description').value,consent:$('consent').checked});if(seq!==sequence)return;renderProfile(result.profile,result.source==='sample'?'Hồ sơ mẫu giả lập · Bạn có thể sửa mọi ô.':'Bản nháp từ Gemini · Đối chiếu với mô tả gốc trước khi tính.');}));
  async function calculate(){
    if(!$('profileConfirmed').checked){editProfile();throw new Error('Kiểm tra thông tin và giả định rồi đánh dấu xác nhận trước khi tính.');}
    const p=readProfile(),a=assumptions(),seq=sequence;const v=await api('validate',{profile:p,assumptions:a});if(seq!==sequence)return;validation(v);if(!v.can_simulate){editProfile();throw new Error('Hồ sơ cần bổ sung hoặc sửa. Xem thông báo ở từng ô và phần Kiểm tra.');}
    const wi=$('whatIfEnabled').checked?{monthly_primary_income:number('wiIncome','thu nhập mới'),monthly_essential_expense:number('wiExpense','chi phí mới'),goal_horizon_months:number('wiHorizon','thời hạn mới')}:null;
    if(!plan)activeResult='overview';
    const result=await api('plan',{profile:p,profile_confirmed:true,assumptions:a,income_reduction_rate:Number($('reduction').value)/100,duration_months:Number($('duration').value),what_if:wi});if(seq!==sequence)return;profile=p;
    if(!wi){$('wiIncome').value=Money.format(p.monthly_primary_income);$('wiExpense').value=Money.format(p.monthly_essential_expense);$('wiHorizon').value=p.goal_horizon_months;}
    renderPlan(result);$('results').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('profileForm').addEventListener('submit',ev=>{ev.preventDefault();action($('makePlan'),calculate);});
  ['annualReturn','inflation','contribution'].forEach(id=>$(id).addEventListener('input',changedAssumptions));
  ['reduction','duration','whatIfEnabled','wiIncome','wiExpense','wiHorizon'].forEach(id=>$(id).addEventListener('input',()=>{const checked=$('profileConfirmed').checked;changedAssumptions();$('profileConfirmed').checked=checked;}));
  $('reduction').addEventListener('input',()=>{$('reductionText').textContent=$('reduction').value==='0'?'0% · Không giảm':$('reduction').value+'%';});
  $('recalculate').addEventListener('click',()=>action($('recalculate'),calculate));$('editProfile').addEventListener('click',editProfile);
  $('compareScenarios').addEventListener('change',balanceChart);$('chartMonth').addEventListener('input',chartReadout);window.addEventListener('resize',()=>{if(plan&&!pending){balanceChart();scenarioChart();}});
  $('aiCommentConsent').addEventListener('change',syncButtons);
  function renderExplanation(text,out){
    const data=Presentation.analysis(plan,profile);
    const conclusion=$('analysisConclusion');conclusion.classList.toggle('is-caution',!data.positive);
    conclusion.querySelectorAll('.p9-analysis-body').forEach(el=>el.remove());
    const body=document.createElement('div');body.className='p9-analysis-body'+(data.positive?'':' caution');
    body.innerHTML=`<h4>${esc(data.headline)}</h4><p>${esc(data.summary)}</p>`;conclusion.append(body);
    const causes=$('analysisCauses');causes.querySelectorAll('.p9-analysis-body').forEach(el=>el.remove());
    const evidence=document.createElement('div');evidence.className='p9-analysis-body';
    evidence.innerHTML='<div class="p9-evidence">'+data.evidence.map(item=>`<article><span>${esc(item.label)}</span><b>${amount(item.value)}</b><small>${esc(item.note)}</small></article>`).join('')+`</div><p class="p9-composition">Vốn ban đầu và tổng tiền tự góp: ${amount(data.principal)}. Phần tăng/giảm còn lại phụ thuộc lợi suất giả định.</p>`;causes.append(evidence);
    const next=$('analysisNext');next.querySelectorAll('.p9-analysis-body').forEach(el=>el.remove());
    const actions=document.createElement('div');actions.className='p9-analysis-body';
    actions.innerHTML=data.attention.map(item=>`<div class="p9-attention ${item.level==='critical'?'critical':''}"><h4>${esc(item.title)}</h4><p>${esc(item.text)}</p></div>`).join('')+'<div class="p9-analysis-actions">'+data.actions.map(item=>`<article class="p9-analysis-action"><h4>${esc(item.title)}</h4><p>${esc(item.text)}</p></article>`).join('')+'</div>';next.append(actions);
    const commentary=Presentation.commentary(text,out.mode);$('aiCommentary').hidden=!commentary;$('aiCommentaryText').textContent=commentary;
    const headings={'TÓM TẮT HỒ SƠ VÀ DÒNG TIỀN':'Hồ sơ và dòng tiền','BA KỊCH BẢN (THEO GIẢ ĐỊNH)':'So sánh kịch bản','WHAT-IF':'Thử thay đổi','STRESS TEST':'Giảm thu nhập','KẾT LUẬN VÀ LỰA CHỌN TIẾP THEO':'Các lựa chọn điều chỉnh','NGUỒN HÌNH THÀNH SỐ DƯ':'Nguồn hình thành số dư','GIẢ ĐỊNH VÀ CẢNH BÁO':'Giả định và giới hạn','BÌNH LUẬN AI (ĐỊNH TÍNH)':'Nhận xét Gemini'};
    const fragment=document.createDocumentFragment();let section=null,skip=false;
    text.split('\n').map(line=>line.trim()).filter(Boolean).forEach(line=>{
      if(headings[line]){skip=line==='STRESS TEST'&&plan.stress_config.income_reduction_rate===0||line==='BÌNH LUẬN AI (ĐỊNH TÍNH)';section=null;if(!skip){section=document.createElement('section');const h=document.createElement('h4');h.textContent=headings[line];section.append(h);fragment.append(section);}return;}
      if(skip||line.startsWith('Chế độ:'))return;if(!section){section=document.createElement('section');fragment.append(section);}const paragraph=document.createElement('p');paragraph.textContent=line;section.append(paragraph);
    });$('fullExplanation').replaceChildren(fragment);$('explanationDetails').open=false;
  }
  async function explain(useLLM){const seq=sequence;$('explanationMode').textContent=useLLM?'Đang tạo nhận xét Gemini…':'Đang chuẩn bị giải thích từ kết quả…';let out;try{out=await api('explain',{plan_id:plan?.plan_id,assumptions_confirmed:true,use_llm:useLLM,consent:$('aiCommentConsent').checked});}catch(e){$('explanationMode').textContent='Chưa tạo được giải thích mới. Bạn có thể thử lại hoặc dùng giải thích tiêu chuẩn.';throw e;}if(seq!==sequence||pending)return;
    explained=true;$('assumptionsConfirmed').checked=true;$('report').hidden=false;renderExplanation(out.text,out);
    $('explanationMode').textContent=out.mode==='live_llm'?'Phân tích từ số liệu · Có nhận xét bổ sung của Gemini':out.mode==='fallback'||out.failure_code?'Phân tích từ số liệu · Chưa nhận được nhận xét Gemini':'Phân tích từ số liệu · Chưa dùng Gemini';
    $('reportConfirmed').checked=false;$('pdfLink').hidden=true;step(4);$('report').scrollIntoView({behavior:'smooth',block:'start'});syncButtons();}
  $('explain').addEventListener('click',()=>action($('explain'),()=>explain(false)));$('aiExplain').addEventListener('click',()=>action($('aiExplain'),()=>explain(true)));
  $('download').addEventListener('click',()=>action($('download'),async()=>{const seq=sequence;const blob=await api('report',{plan_id:plan?.plan_id,assumptions_confirmed:true,report_confirmed:true},true);if(seq!==sequence||pending)return;$('reportConfirmed').checked=true;if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=URL.createObjectURL(blob);const a=document.createElement('a');a.href=pdfUrl;a.download='HTD_Project09_Plan.pdf';a.click();$('pdfLink').href=pdfUrl;$('pdfLink').hidden=false;}));
  api('config').then(config=>{cfg=config;$('sample').innerHTML=cfg.samples.map(s=>`<option value="${esc(s.id)}">${esc(s.id+' — '+(s.goal||'Hồ sơ cần bổ sung'))}</option>`).join('');setSample();$('annualReturn').value=Number((cfg.defaults.annual_return_rate*100).toFixed(4));$('inflation').value=Number(((cfg.defaults.annual_inflation_rate||0)*100).toFixed(4));$('assumptionNote').textContent='Giả định phục vụ mô phỏng, chưa được hiệu chỉnh bằng dữ liệu thực nghiệm. Lợi suất tối đa: thấp 6%, trung bình 8%, cao 10%/năm; đây là giới hạn demo.';updateReviewAssumptions();$('connection').textContent='Sẵn sàng lập kế hoạch';$('aiAvailability').textContent=cfg.ai_configured?'Chỉ gửi mục tiêu và kết quả khi bạn đồng ý.':'Gemini chưa được thiết lập trên phiên này. Bạn vẫn có thể đọc phân tích và tải PDF.';syncButtons();}).catch(()=>{$('connection').innerHTML='<b>Chưa kết nối được phần tính toán.</b> Mở trang bằng địa chỉ trong hướng dẫn sau khi chạy <code>python server.py</code>.';$('extract').disabled=true;document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=true);});
})();
