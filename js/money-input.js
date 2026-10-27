/* Vietnamese whole-dong inputs. Display grouping never reaches the API. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HTDMoneyInput=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function parse(value){
    const text=String(value??'').trim();if(text==='')return null;
    const valid=/^\d+$/.test(text)||/^\d{1,3}(?:\.\d{3})+$/.test(text)||/^\d{1,3}(?:,\d{3})+$/.test(text)||/^\d{1,3}(?:[ \u00a0\u202f]\d{3})+$/.test(text);
    if(!valid)throw new Error('Nhập số tiền nguyên đồng, ví dụ 8.000.000.');
    const number=Number(text.replace(/[., \u00a0\u202f]/g,''));
    if(!Number.isSafeInteger(number)||number<0)throw new Error('Số tiền vượt phạm vi hỗ trợ.');
    return number;
  }
  function format(value){if(value===null||value===undefined||value==='')return '';const number=typeof value==='number'?value:parse(value);if(!Number.isSafeInteger(number)||number<0)throw new Error('Số tiền cần là số nguyên đồng.');return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(number);}
  function bind(input,onValidity){
    input.dataset.money='true';input.type='text';input.inputMode='numeric';input.autocomplete='off';
    const message=error=>{input.setCustomValidity(error||'');if(error)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');if(onValidity)onValidity(error);};
    input.addEventListener('input',event=>{
      const raw=input.value,pos=input.selectionStart??raw.length;
      const digitsBefore=(raw.slice(0,pos).match(/\d/g)||[]).length;
      try{
        let value;
        // Browser edits within an already grouped number temporarily disturb
        // group lengths. A digit insertion/deletion is safely regrouped.
        if((event.inputType?.startsWith('delete')||event.inputType==='insertText'&&/^\d+$/.test(event.data||''))&&/^[\d., \u00a0\u202f]*$/.test(raw))value=parse(raw.replace(/[., \u00a0\u202f]/g,''));
        else value=parse(raw);
        input.value=format(value);message('');
        let caret=0,count=0;while(caret<input.value.length&&count<digitsBefore){if(/\d/.test(input.value[caret]))count++;caret++;}
        input.setSelectionRange(caret,caret);
      }catch(error){message(error.message);}
    });
    input.addEventListener('paste',event=>{
      const pasted=event.clipboardData?.getData('text');if(pasted==null)return;
      event.preventDefault();
      const from=input.selectionStart??0,to=input.selectionEnd??input.value.length;
      const proposed=input.value.slice(0,from)+pasted+input.value.slice(to);
      try{input.value=format(parse(proposed));message('');}catch(error){input.value=proposed;message(error.message);}
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }
  return {parse,format,bind};
});
