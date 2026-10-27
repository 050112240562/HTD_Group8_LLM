/* Display models only. Calculated balances and decisions come from Python. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HTDPlanPresentation=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const number=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(value);
  const exact=value=>value==null?'Chưa cung cấp':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(value)+' ₫';
  function compact(value){
    if(value==null)return 'Chưa cung cấp';
    if(Math.abs(value)>=1e9)return number(value/1e9)+' tỷ ₫';
    if(Math.abs(value)>=1e6)return number(value/1e6)+' triệu ₫';
    return exact(value);
  }
  function total(values){return values.every(x=>typeof x==='number'&&Number.isFinite(x))?values.reduce((a,b)=>a+b,0):null;}
  function profileSummary(p){
    const income=total([p.monthly_primary_income,p.monthly_other_income]);
    const outflow=total([p.monthly_essential_expense,p.monthly_discretionary_expense,p.monthly_debt_payment]);
    const available=p.current_savings==null||p.emergency_fund_reserved==null?null:Math.max(p.current_savings-p.emergency_fund_reserved,0);
    return {goal:p.goal_name||'Mục tiêu của bạn',items:[
      {label:'Mục tiêu theo giá hôm nay',value:p.goal_amount},
      {label:'Thu nhập / tháng',value:income},
      {label:'Chi tiêu và trả nợ / tháng',value:outflow},
      {label:'Tiết kiệm hiện có',value:p.current_savings},
      {label:'Quỹ dự phòng giữ riêng',value:p.emergency_fund_reserved},
      {label:'Vốn ban đầu cho mục tiêu',value:available}
    ],horizon:p.goal_horizon_months};
  }
  function analysis(plan,p){
    const m=plan.scenarios.base.calculation_result,g=plan.guidance,b=g.budget;
    const reached=m.goal_reached_by_horizon;
    const summary='Sau '+m.goal_horizon_months+' tháng, số dư dự kiến là '+compact(m.fv_total)+
      ', so với mục tiêu đã tính lạm phát '+compact(m.adjusted_goal_amount)+'. '+
      (m.goal_gap>0?'Còn thiếu ':'Khoảng vượt dự kiến là ')+compact(Math.abs(m.goal_gap))+'.';
    const attention=[];
    if(b.shortfall>.01)attention.push({level:'critical',title:'Khoản góp hoặc chi tiêu chưa đủ nguồn tiền',text:g.reason});
    if(p.emergency_fund_reserved>p.current_savings)attention.push({level:'critical',title:'Chưa đủ tiền giữ quỹ dự phòng',text:'Quỹ dự phòng đã nhập lớn hơn tổng tiết kiệm. Vốn cho mục tiêu đang được tính bằng không.'});
    if(p.liquidity_need==='high')attention.push({level:'warning',title:'Chưa tính các lần rút tiền sớm',text:'Bạn đã chọn nhu cầu rút tiền cao. Số dư trên chưa trừ khoản rút tiền trong tương lai.'});
    if(b.shortfall<=.01&&b.remaining<=.01&&m.monthly_contribution>0)attention.push({level:'warning',title:'Bạn đang dành hết dòng tiền dư',text:'Sau chi tiêu, trả nợ và góp cho mục tiêu, ngân sách tháng không còn phần chưa phân bổ. Chi phí phát sinh sẽ cần nguồn bù riêng.'});
    const stress=plan.stress_by_scenario?.base?.comparison;
    if(plan.stress_config?.income_reduction_rate>0&&stress?.unfunded_cashflow_deficit>0)attention.push({level:'critical',title:'Phép thử giảm thu nhập có thiếu hụt sinh hoạt',text:'Thiếu '+compact(stress.unfunded_cashflow_deficit)+' chưa có nguồn bù. Mô hình chưa tự trừ khoản này vào quỹ dự phòng hoặc vốn mục tiêu.'});
    const actions=[];
    if(!g.feasible)actions.push(g.actions[0]);
    if(!reached){
      actions.push({title:'Giữ thời hạn hiện tại',text:'Cần góp '+compact(m.required_monthly_contribution)+'/tháng. '+
        (m.required_contribution_gap>0?'Mức này vượt dòng tiền hiện tại '+compact(m.required_contribution_gap)+'/tháng.':'Mức này nằm trong dòng tiền hiện tại; tiền còn lại cho nhu cầu khác sẽ giảm.')});
      const extension=g.actions.find(a=>a.title==='Nếu giữ khoản góp hiện tại');if(extension)actions.push(extension);
    }else if(g.feasible){
      actions.push({title:'Theo dõi khoản góp thực tế',text:'Duy trì mức góp '+compact(m.monthly_contribution)+'/tháng theo kế hoạch và cập nhật khi thu nhập, chi tiêu hoặc mục tiêu thay đổi.'});
      if(b.remaining>0)actions.push({title:'Phần ngân sách còn lại',text:'Còn '+compact(b.remaining)+'/tháng chưa phân bổ sau khoản góp đang mô phỏng.'});
    }
    return {headline:g.headline,positive:g.positive,summary,attention,actions,
      evidence:[
        {label:'Vốn ban đầu',value:m.initial_available_amount,note:'Sau khi giữ riêng quỹ dự phòng'},
        {label:'Tiền góp mỗi tháng',value:m.monthly_contribution,note:'Trong '+m.goal_horizon_months+' tháng, góp vào cuối tháng'},
        {label:'Tăng / giảm theo lợi suất',value:g.investment_gain,note:'Theo lợi suất cố định '+number(m.annual_return_rate*100)+'%/năm'}
      ],principal:g.principal,investmentGain:g.investment_gain};
  }
  function commentary(text,mode){
    if(mode!=='live_llm')return '';
    return String(text).split('BÌNH LUẬN AI (ĐỊNH TÍNH)')[1]?.split(/\nChế độ:/)[0]?.trim()||'';
  }
  return {compact,exact,profileSummary,analysis,commentary};
});
