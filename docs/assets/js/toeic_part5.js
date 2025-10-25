// ＊題庫位置（相對 docs/ 根目錄）
const JSON_PATHS = [
  './assets/data/TOEIC_PART5.json',
  'assets/data/TOEIC_PART5.json',
  '/assets/data/TOEIC_PART5.json',
];

// 抓不到外部 JSON 才會 fallback（避免頁面壞）
const SAMPLE = [
  { q: 'The manager ____ the proposal to reduce costs.', options: ['approved','discovered','explained','prevented'], answer: 0, explain: 'manager 對 proposal 最合理動作為 approve（批准）。' },
  { q: 'Applicants must submit their forms ____ Friday.', options: ['on','by','in','at'], answer: 1, explain: '截止時間用 by（不晚於）。' },
  { q: 'The new policy has been ____ effective across departments.', options: ['widely','wide','widen','width'], answer: 0, explain: 'has been + Adj. 需副詞修飾整體：widely effective。' },
];

// 狀態
let data = [...SAMPLE];
let order = data.map((_, i) => i);
let idx = 0;
let selected = null;
let answered = Number(localStorage.getItem('kh_toeic_ans') || 0);
let correct  = Number(localStorage.getItem('kh_toeic_ok')  || 0);
let wrongSet = new Set(JSON.parse(localStorage.getItem('kh_toeic_wrong') || '[]'));
let wrongMode = false;

// DOM
const $ = (id) => document.getElementById(id);
const elQno=$('qno'), elQ=$('question'), elOpts=$('options'), elExplain=$('explain');
const barCorrect=$('bar-correct'), barWrong=$('bar-wrong');
const accText=$('accText'), errText=$('errText');
const btnPrev=$('prev'), btnNext=$('next'), btnSubmit=$('submit'), btnReveal=$('reveal');
const btnShuffle=$('shuffle'), btnWrongMode=$('wrongMode'), btnReset=$('reset');

// 工具
function saveStats(){
  localStorage.setItem('kh_toeic_ans', String(answered));
  localStorage.setItem('kh_toeic_ok',  String(correct));
  localStorage.setItem('kh_toeic_wrong', JSON.stringify([...wrongSet]));
}
const pct = (n) => (n*100).toFixed(1) + '%';
function updateBar(){
  const acc = answered ? correct/answered : 0;
  const err = 1 - acc;
  barCorrect.style.width = pct(acc);
  barWrong.style.width   = pct(err);
  accText.textContent = `正確 ${pct(acc)}`;
  errText.textContent = `錯誤 ${pct(err)}`;
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
const currentId = () => order[idx];

function render(){
  const id = currentId();
  const item = data[id];
  elQno.textContent = `第 ${idx+1} 題 / 共 ${order.length} 題`;
  elQ.textContent = item.q;
  elOpts.innerHTML = '';
  elExplain.classList.remove('show');
  elExplain.textContent = '';
  selected = null;

  item.options.forEach((opt, i) => {
    const label = document.createElement('label');
    label.className = 'opt';
    label.innerHTML = `<input type="radio" name="opt">
      <div class="opt-content">
        <span class="mark">${String.fromCharCode(65+i)}</span>
        <div>${opt}</div>
      </div>`;
    label.addEventListener('click', () => {
      [...elOpts.children].forEach(c=>c.classList.remove('selected'));
      label.classList.add('selected');
      selected = i;
    });
    elOpts.appendChild(label);
  });
}

function judge(){
  if (selected===null){ alert('先選一個選項～'); return; }
  const id = currentId();
  const item = data[id];
  [...elOpts.children].forEach((c, i) => {
    c.classList.remove('correct','wrong');
    if (i===item.answer) c.classList.add('correct');
    if (i===selected && i!==item.answer) c.classList.add('wrong');
  });

  answered += 1;
  if (selected===item.answer){ correct += 1; wrongSet.delete(id); }
  else { wrongSet.add(id); }
  saveStats();
  updateBar();

  elExplain.textContent = item.explain || '本題無詳解。';
  elExplain.classList.add('show');
}

function next(){ if (idx < order.length-1){ idx++; render(); } else alert('已到最後一題'); }
function prev(){ if (idx>0){ idx--; render(); } }
function doShuffle(){ shuffle(order); idx=0; render(); }
function toggleWrongMode(){
  wrongMode = !wrongMode;
  btnWrongMode.textContent = `重作錯題：${wrongMode ? '開' : '關'}`;
  if (wrongMode){
    const arr = [...wrongSet];
    if (arr.length===0){
      alert('目前沒有錯題，先做幾題吧！');
      wrongMode=false; btnWrongMode.textContent='重作錯題：關';
      return;
    }
    order = arr; shuffle(order); idx=0; render();
  } else {
    order = data.map((_,i)=>i); idx=0; render();
  }
}
function resetAll(){
  if (!confirm('確定重置？這會清除已作題數、正確數與錯題清單。')) return;
  answered=0; correct=0; wrongSet=new Set();
  saveStats(); updateBar();
  order=data.map((_,i)=>i); idx=0; render();
}

async function tryFetch(paths){
  for (const p of paths){
    try{
      const res = await fetch(p, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const arr = await res.json();
      if(Array.isArray(arr) && arr.length>0){
        data = arr; order = data.map((_,i)=>i); idx=0; wrongSet=new Set();
        updateBar(); render();
        return true;
      }
    }catch(e){ /* ignore and try next */ }
  }
  return false;
}

// 綁定事件
btnSubmit.addEventListener('click', judge);
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);
btnShuffle.addEventListener('click', doShuffle);
btnWrongMode.addEventListener('click', toggleWrongMode);
btnReset.addEventListener('click', resetAll);
btnReveal.addEventListener('click', ()=>{
  elExplain.classList.add('show');
  elExplain.textContent = data[currentId()].explain || '本題無詳解。';
});

// 初始化
updateBar();
tryFetch(JSON_PATHS).then(ok => { if(!ok) render(); });
