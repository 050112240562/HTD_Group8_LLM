const {test}=require('node:test');
const assert=require('node:assert/strict');
const view=require('../js/plan-presentation.js');
function fixture(){
  return {scenarios:{base:{calculation_result:{goal_horizon_months:12,fv_total:120000000,adjusted_goal_amount:125000000,goal_gap:5000000,goal_reached_by_horizon:false,initial_available_amount:10000000,monthly_contribution:8000000,required_monthly_contribution:8500000,required_contribution_gap:500000,annual_return_rate:.06}}},
    guidance:{headline:'Chưa đủ tiền cho mục tiêu đúng hạn',positive:false,feasible:true,budget:{shortfall:0,remaining:0},principal:106000000,investment_gain:14000000,actions:[{title:'Nếu giữ khoản góp hiện tại',text:'Chạm mục tiêu ở tháng 13.'}]},
    stress_config:{income_reduction_rate:0},stress_by_scenario:{base:{comparison:{unfunded_cashflow_deficit:0}}}};
}
const profile={goal_name:'Mua xe',goal_amount:100000000,current_savings:15000000,emergency_fund_reserved:5000000,liquidity_need:'medium'};
test('display rounds large amounts but retains exact Vietnamese money separately',()=>{
  assert.equal(view.compact(129437953),'129,44 triệu ₫');
  assert.equal(view.exact(129437953),'129.437.953 ₫');
  assert.equal(view.compact(-1400000000),'-1,4 tỷ ₫');
});
test('missing income and reserve stay unknown in the review digest',()=>{
  const s=view.profileSummary({...profile,emergency_fund_reserved:null,monthly_primary_income:8000000,monthly_other_income:null});
  assert.equal(s.items.find(x=>x.label==='Thu nhập / tháng').value,null);
  assert.equal(s.items.find(x=>x.label==='Vốn ban đầu cho mục tiêu').value,null);
  assert.equal(view.compact(null),'Chưa cung cấp');
});
test('conclusion and actions use the engine inflation-adjusted target and contribution',()=>{
  const f=fixture(),before=JSON.stringify(f),a=view.analysis(f,profile);
  assert.match(a.summary,/125 triệu/);assert.match(a.summary,/Còn thiếu 5 triệu/);
  assert.match(a.actions[0].text,/8,5 triệu/);assert.match(a.actions[0].text,/500\.000/);
  assert.equal(a.actions[1].text,'Chạm mục tiêu ở tháng 13.');
  assert.equal(JSON.stringify(f),before);
});
test('reaching the numeric target does not hide an unaffordable contribution',()=>{
  const f=fixture();Object.assign(f.scenarios.base.calculation_result,{goal_reached_by_horizon:true,goal_gap:-5000000});
  Object.assign(f.guidance,{positive:false,feasible:false,headline:'Kế hoạch đang vượt khả năng dòng tiền',reason:'Khoản góp vượt tiền có thể dành 1.000.000 ₫/tháng.'});
  f.guidance.budget.shortfall=1000000;f.guidance.actions=[{title:'Giảm khoản góp',text:'Về mức có nguồn tiền.'}];
  const a=view.analysis(f,profile);assert.equal(a.positive,false);assert.equal(a.attention[0].level,'critical');assert.match(a.attention[0].text,/1\.000\.000/);assert.equal(a.actions[0].title,'Giảm khoản góp');
});
test('early withdrawal and reserve shortfalls remain visible',()=>{
  const a=view.analysis(fixture(),{...profile,liquidity_need:'high',emergency_fund_reserved:20000000});
  assert.ok(a.attention.some(x=>x.title==='Chưa đủ tiền giữ quỹ dự phòng'));
  assert.ok(a.attention.some(x=>x.title==='Chưa tính các lần rút tiền sớm'));
});
test('only an active income shock adds its unfunded-deficit warning',()=>{
  const f=fixture();f.stress_by_scenario.base.comparison.unfunded_cashflow_deficit=2000000;
  assert.ok(!view.analysis(f,profile).attention.some(x=>x.title.includes('Phép thử')));
  f.stress_config.income_reduction_rate=.2;
  assert.match(view.analysis(f,profile).attention.find(x=>x.title.includes('Phép thử')).text,/2 triệu/);
});
test('AI provenance requires a live response and excludes transport metadata',()=>{
  const t='KẾT LUẬN\nSố liệu\nBÌNH LUẬN AI (ĐỊNH TÍNH)\nHãy kiểm tra ngân sách.\nChế độ: live_llm';
  assert.equal(view.commentary(t,'offline'),'');assert.equal(view.commentary(t,'fallback'),'');
  assert.equal(view.commentary(t,'live_llm'),'Hãy kiểm tra ngân sách.');
});
