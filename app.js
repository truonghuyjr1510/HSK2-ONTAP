const $=id=>document.getElementById(id),STORE='hsk-study-v2',today=()=>new Date().toISOString().slice(0,10);
let words=window.INITIAL_WORDS.map(x=>({...x})),state=loadState(),tab='Trang chính',mode='Nghe',topic='Tất cả',index=0,flipped=false,answered=false,quiz=[],qpos=0,quizAnswered=[],quizCorrect=[];
function loadState(){try{let s=JSON.parse(localStorage.getItem(STORE));if(s?.records&&s.days)return s}catch{}return{goal:10,records:{},days:{}}}function save(){localStorage.setItem(STORE,JSON.stringify(state))}function log(w,ok){let old=state.records[w.hanzi]||{level:0},level=ok?Math.min(6,old.level+1):0;state.records[w.hanzi]={level,due:Date.now()+(ok?[0,1,3,7,14,30,60][level]*86400000:60000)};state.days[today()]=[...new Set([...(state.days[today()]||[]),w.hanzi])];save();stats()}
function stats(){let a=words.filter(w=>state.records[w.hanzi]).length,b=words.filter(w=>state.records[w.hanzi]?.due<=Date.now()).length;$('stats').innerHTML=`<div><strong>${a}/${words.length}</strong>Từ đã học</div><div><strong>${b}</strong>Từ cần ôn</div><div><strong>${(state.days[today()]||[]).length}</strong>Đã luyện hôm nay</div>`}
const AUDIO_BASE=new URL('audio/',document.currentScript.src);
const AUDIO_REV='1';
const AUDIO_PATHS=new Map();
words.forEach((word,i)=>{
  const number=String(i+1).padStart(3,'0');
  AUDIO_PATHS.set(word.hanzi,`w-${number}.mp3`);
  AUDIO_PATHS.set(word.exZh,`e-${number}.mp3`);
});
let playingAudio=null,playingButton=null,playingLabel='';
function resetPlayingButton(){
  if(playingButton){
    if(playingButton.classList.contains('audio-icon'))delete playingButton.dataset.playing;
    else playingButton.textContent=playingLabel;
  }
  playingButton=null;playingLabel='';
}
function stopSpeech(){
  if(playingAudio){playingAudio.pause();playingAudio=null}
  resetPlayingButton();
}
function finishAudio(audio){
  if(playingAudio!==audio)return;
  playingAudio=null;
  resetPlayingButton();
}
function speak(text,slow=false,button=null){
  const file=AUDIO_PATHS.get(text);
  if(!file)return msg('Chưa có âm thanh cho từ này. Hãy cập nhật bộ âm thanh.');
  stopSpeech();
  const audio=new Audio(new URL(`${file}?v=${AUDIO_REV}`,AUDIO_BASE).href);
  audio.playbackRate=slow?.75:.9;
  audio.preservesPitch=true;
  playingAudio=audio;
  if(button){
    playingButton=button;playingLabel=button.textContent;
    if(button.classList.contains('audio-icon'))button.dataset.playing='true';
    else button.textContent='Đang tải…';
  }
  audio.onplaying=()=>{if(playingAudio===audio&&playingButton&&!playingButton.classList.contains('audio-icon'))playingButton.textContent='Đang phát…'};
  audio.onended=()=>finishAudio(audio);
  audio.onerror=()=>{if(playingAudio===audio){finishAudio(audio);msg('Không tải được âm thanh. Hãy thử tải lại trang.')}};
  audio.play().catch(()=>{if(playingAudio===audio){finishAudio(audio);msg('Không phát được âm thanh. Hãy nhấn lại nút loa.')}});
}
function msg(t){$('notice').textContent=t}function btn(t,fn,p){let b=document.createElement('button');b.textContent=t;b.onclick=fn;p.append(b);return b}
function meaningOptions(text){
  const source=text.replace(/\s+hoặc\s+/gi,';'),options=[];
  let current='',depth=0;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='('||char==='（'){depth++;continue}
    if(char===')'||char==='）'){depth=Math.max(0,depth-1);continue}
    if(depth)continue;
    const decimalComma=char===','&&/\d/.test(source[i-1]||'')&&/\d/.test(source[i+1]||'');
    if(/[;；\/、，,]/.test(char)&&!decimalComma){if(current.trim())options.push(current.trim());current=''}
    else current+=char;
  }
  if(current.trim())options.push(current.trim());
  return options;
}
function cleanMeaning(text){return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]/g,'')}
function editDistance(a,b){
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let previous=row[0];row[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));
      previous=old;
    }
  }
  return row[b.length];
}
function matchesMeaning(guess,answer){
  const typoAllowance=answer.length>=11?2:answer.length>=4?1:0;
  return Math.abs(guess.length-answer.length)<=typoAllowance&&editDistance(guess,answer)<=typoAllowance;
}
function isMeaningCorrect(input,word){
  const guesses=meaningOptions(input).map(cleanMeaning).filter(Boolean);
  const aliases=window.HSK_ANSWER_ALIASES?.[`${word.hanzi}|${word.meaning}`]||window.HSK_ANSWER_ALIASES?.[word.hanzi]||[];
  const answers=[...new Set([...meaningOptions(word.meaning),...aliases].map(cleanMeaning).filter(Boolean))];
  if(guesses.some(guess=>answers.some(answer=>matchesMeaning(guess,answer))))return true;
  if(answers.length<2)return false;
  const combinedGuess=cleanMeaning(input);
  function checkCombination(text,used,count){
    if(count>=2&&matchesMeaning(combinedGuess,text))return true;
    if(count===3||text.length>combinedGuess.length+2)return false;
    for(let i=0;i<answers.length;i++){
      if(!(used&(1<<i))&&checkCombination(text+answers[i],used|(1<<i),count+1))return true;
    }
    return false;
  }
  return checkCombination('',0,0);
}
function example(w){return w.exPin}function reveal(w,ok){return `<b class="feedback ${ok?'correct':'wrong'}">${ok?'✓ Chính xác!':'✗ Chưa chính xác'}</b><p>${w.hanzi} · ${w.pinyin} · ${w.meaning}</p><p>Ví dụ: ${w.exZh}<br>Pinyin: ${w.exPin}<br>Nghĩa: ${w.exVi}</p>`}
function showAnswer(el,w,ok){el.innerHTML=reveal(w,ok);let p=el.querySelector('p');if(p){let b=document.createElement('button');b.type='button';b.className='answer-audio';b.textContent='🔊 Nghe từ';b.onclick=e=>speak(w.hanzi,false,e.currentTarget);p.append(' ',b)}let sentence=el.querySelectorAll('p')[1];if(sentence){let b=document.createElement('button');b.type='button';b.className='answer-audio';b.textContent='🔊 Nghe ví dụ';b.onclick=()=>speak(w.exZh,false,b);sentence.append(' ',b)}}
function activeWords(){let a=topic==='Tất cả'?words:words.filter(w=>w.topic===topic);return a.length?a:words}function selectTopic(parent,withRandom=false){let row=document.createElement('div');row.className='toolbar';let label=document.createElement('label');label.textContent='Chủ đề ';let s=document.createElement('select');s.innerHTML='<option>Tất cả</option>'+[...new Set(words.map(w=>w.topic).filter(Boolean))].sort().map(x=>`<option>${x}</option>`).join('');s.value=topic;s.onchange=()=>{topic=s.value;index=0;answered=false;flipped=false;render()};label.append(s);row.append(label);if(withRandom){let l=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=randomFlash;l.append(cb,' Ngẫu nhiên');cb.onchange=()=>{randomFlash=cb.checked};row.append(l)}parent.append(row)}let randomFlash=false;
function render(){stopSpeech();stats();$('page-title').textContent=tab==='Trang chính'?'Chào mừng trở lại':tab;$('page-subtitle').textContent=tab==='Trang chính'?'Chọn một cách học phù hợp để bắt đầu.':tab==='Kiểm tra'?'20 câu: 10 câu nghe và 10 câu pinyin.':tab==='Ôn tập'?'Ôn lại những từ bạn cần nhớ lâu hơn.':'Học theo nhịp của bạn, từng từ một.';$('tabs').replaceChildren();const icons={'Trang chính':'⌂','Học từ mới':'✎','Flashcard':'▣','Luyện tập':'◎','Ôn tập':'↻','Kiểm tra':'✓'};['Trang chính','Học từ mới','Flashcard','Luyện tập','Ôn tập','Kiểm tra'].forEach(t=>{let b=btn(t,()=>{tab=t;answered=false;flipped=false;render()},$('tabs'));b.dataset.icon=icons[t];b.setAttribute('aria-label',t);b.classList.toggle('active',tab===t);b.setAttribute('aria-current',tab===t?'page':'false')});let c=$('content');c.className='panel';c.replaceChildren();if(tab==='Trang chính')return dashboard(c);if(tab==='Kiểm tra')return exam(c);if(tab==='Luyện tập')return practice(c);let pool=activeWords(),reviewEarly=false;if(tab==='Ôn tập'){let due=words.filter(w=>state.records[w.hanzi]?.due<=Date.now());reviewEarly=!due.length;pool=due.length?due:words.filter(w=>state.records[w.hanzi]);if(!pool.length){c.innerHTML='<h2>Chưa có từ để ôn</h2><p>Học một vài từ trước, sau đó chúng sẽ xuất hiện ở mục Ôn tập.</p>';btn('Đi tới Học từ mới',()=>{tab='Học từ mới';render()},c);return}if(topic!=='Tất cả')pool=pool.filter(w=>w.topic===topic);if(!pool.length){c.innerHTML='<h2>Chủ đề này chưa có từ cần ôn</h2><p>Chọn chủ đề khác hoặc xem tất cả từ cần ôn.</p>';btn('Xem tất cả chủ đề',()=>{topic='Tất cả';render()},c);return}}if(!pool.length)return;c.append(topicControls(tab==='Flashcard'));if(tab==='Ôn tập'&&reviewEarly){let note=document.createElement('p');note.className='review-note';note.textContent='Chưa có từ đến hạn. Bạn có thể ôn trước các từ đã học.';c.append(note)}index=Math.max(0,Math.min(index,pool.length-1));let w=pool[index];if(tab==='Flashcard'){if(!flipped){c.insertAdjacentHTML('beforeend',`<div class="pinyin flash-pinyin">${w.pinyin}</div><p>Nhớ nghĩa tiếng Việt rồi lật thẻ.</p>`);btn('▶ Nghe',e=>speak(w.hanzi,false,e.currentTarget),c);btn('▷ Nghe chậm',e=>speak(w.hanzi,true,e.currentTarget),c);btn('Lật thẻ',()=>{flipped=true;render()},c)}else{c.insertAdjacentHTML('beforeend',`<div class="pinyin flash-pinyin">${w.pinyin}</div><h2>${w.meaning}</h2><p>Ví dụ pinyin: ${w.exPin}<br>Nghĩa: ${w.exVi}</p>`);btn('▶ Nghe',e=>speak(w.hanzi,false,e.currentTarget),c);btn('▷ Nghe chậm',e=>speak(w.hanzi,true,e.currentTarget),c);let audio=btn('🔊 Nghe ví dụ',()=>speak(w.exZh,false,audio),c);btn('Ẩn nghĩa',()=>{flipped=false;render()},c)}}else{c.insertAdjacentHTML('beforeend',`<div class="hanzi">${w.hanzi}</div><div class="pinyin">${w.pinyin}</div><h2>${w.meaning}</h2><p>Ví dụ: ${w.exZh}<br>Pinyin: ${w.exPin}<br>Nghĩa: ${w.exVi}</p>`);btn('▶ Nghe',e=>speak(w.hanzi,false,e.currentTarget),c);btn('▷ Nghe chậm',e=>speak(w.hanzi,true,e.currentTarget),c);let audio=btn('🔊 Nghe ví dụ',()=>speak(w.exZh,false,audio),c);if(tab==='Học từ mới'||tab==='Ôn tập'){let row=document.createElement('div');row.className='actions';c.append(row);btn('Cần ôn lại',()=>log(w,false),row);btn('Đã nhớ',()=>log(w,true),row)}}navButtons(c,pool.length)}
function topicControls(random=false){let d=document.createElement('div');selectTopic(d,random);return d}function navButtons(c,len){let r=document.createElement('div');r.className='actions nav-actions';c.append(r);btn('← Trước',()=>{index=Math.max(0,index-1);flipped=false;render()},r);btn('Tiếp theo →',()=>{index=tab==='Flashcard'&&randomFlash?Math.floor(Math.random()*len):(index+1)%len;flipped=false;render()},r)}
function dashboard(c){c.innerHTML=`<section class="hero"><small>HÀNH TRÌNH HSK 2</small><h1>Hôm nay học gì?</h1><p>Tiến bộ từng từ, mỗi ngày.</p></section><section class="tiles"></section>`;let t=c.querySelector('.tiles');[['Ôn tập','Từ cần ôn','Ôn tập'],['Học từ mới','Chữ Hán · pinyin · nghĩa','Học từ mới'],['Luyện nghe','Nghe rồi viết nghĩa tiếng Việt','Nghe'],['Nhận biết pinyin','Đọc pinyin rồi viết nghĩa','Pinyin'],['Kiểm tra','20 câu · 10 nghe + 10 pinyin','Kiểm tra'],['Flashcard','Lật thẻ để tự kiểm tra','Flashcard']].forEach(([a,b,d])=>{let x=btn('',()=>{tab=d==='Nghe'||d==='Pinyin'?'Luyện tập':d;mode=d==='Pinyin'?'Pinyin':'Nghe';answered=false;render()},t);x.className='tile';x.innerHTML=`<b>${a}</b><span>${b}</span>`})}
function practice(c){let pool=activeWords();index%=pool.length;let w=pool[index];c.append(topicControls());let modes=document.createElement('div');modes.className='actions mode-buttons';c.append(modes);['Nghe','Pinyin'].forEach(m=>{let b=btn(m,()=>{mode=m;answered=false;render()},modes);b.setAttribute('aria-pressed',mode===m?'true':'false')});c.insertAdjacentHTML('beforeend',`<div class="step-label">Từ ${index+1} / ${pool.length}</div><div class="progress-track"><i style="width:${Math.round((index+1)/pool.length*100)}%"></i></div><div class="prompt">${mode==='Nghe'?'<button class="audio-icon" type="button" aria-label="Nghe từ">🔊</button>':'<span class="pinyin">'+w.pinyin+'</span>'}</div><p>${mode==='Nghe'?'Nghe âm thanh rồi viết nghĩa tiếng Việt.':'Đọc pinyin rồi viết nghĩa tiếng Việt.'}</p><input id="answer" placeholder="Nhập một nghĩa tiếng Việt" autocomplete="off"><div id="feedback"></div>`);if(mode==='Nghe')c.querySelector('.audio-icon').onclick=e=>speak(w.hanzi,false,e.currentTarget);let input=$('answer');btn('Trả lời ↵',()=>submitPractice(w),c);navButtonsPractice(c,pool.length);if(answered){input.disabled=true;showAnswer($('feedback'),w,isMeaningCorrect(input.dataset.answer||'',w))}}
function submitPractice(w){if(answered)return;let input=$('answer');if(!input.value.trim())return msg('Hãy nhập nghĩa trước khi trả lời.');let ok=isMeaningCorrect(input.value,w);input.dataset.answer=input.value;input.disabled=true;answered=true;log(w,ok);showAnswer($('feedback'),w,ok);let next=[...$('content').querySelectorAll('button')].find(b=>b.textContent.includes('Tiếp theo'));if(next)next.disabled=false;msg(ok?'Chính xác!':'Chưa chính xác. Hãy xem đáp án.')}function navButtonsPractice(c,n){let r=document.createElement('div');r.className='actions nav-actions';c.append(r);btn('← Trước',()=>{index=(index+n-1)%n;answered=false;render()},r);let b=btn('Tiếp theo →',()=>{if(!answered)return msg('Hãy trả lời câu này trước khi tiếp tục.');index=(index+1)%n;answered=false;render()},r);b.disabled=!answered}
function exam(c){if(!quiz.length){let a=[...words].sort(()=>Math.random()-.5);quiz=[...a.slice(0,10).map(w=>({w,type:'Nghe'})),...a.slice(10,20).map(w=>({w,type:'Pinyin'}))];qpos=0;quizAnswered=Array(20).fill(false);quizCorrect=Array(20).fill(false)}if(qpos>=20){c.innerHTML=`<h2>Hoàn thành bài kiểm tra</h2><p>Đúng ${quizCorrect.filter(Boolean).length}/20 câu.</p><p>Nghe: ${quizCorrect.slice(0,10).filter(Boolean).length}/10 · Pinyin: ${quizCorrect.slice(10).filter(Boolean).length}/10</p>`;btn('Bài kiểm tra mới',()=>{quiz=[];render()},c);return}let {w,type}=quiz[qpos];c.innerHTML=`<div class="step-label">Câu ${qpos+1} / 20</div><div class="progress-track"><i style="width:${(qpos+1)*5}%"></i></div><small>CÂU ${qpos+1}/20 · ${type==='Nghe'?'NGHE':'NHẬN BIẾT PINYIN'}</small><h2>${type==='Nghe'?'Nghe và viết nghĩa':`Pinyin: ${w.pinyin}`}</h2>${type==='Nghe'?'<button class="audio-icon" type="button" aria-label="Nghe từ">🔊</button>':''}<input id="answer" placeholder="Nhập một nghĩa tiếng Việt"><div id="feedback"></div>`;let input=$('answer');if(type==='Nghe')c.querySelector('.audio-icon').onclick=e=>speak(w.hanzi,false,e.currentTarget);let submit=()=>{if(quizAnswered[qpos])return;if(!input.value.trim())return msg('Hãy nhập nghĩa trước khi trả lời.');let ok=isMeaningCorrect(input.value,w);quizAnswered[qpos]=true;quizCorrect[qpos]=ok;log(w,ok);showAnswer($('feedback'),w,ok);msg(ok?'Chính xác!':'Chưa chính xác.');input.disabled=true;let next=[...$('content').querySelectorAll('button')].find(b=>b.textContent.includes('Câu tiếp theo'));if(next)next.disabled=false;};btn('Trả lời ↵',submit,c);let r=document.createElement('div');r.className='actions nav-actions';c.append(r);btn('← Câu trước',()=>{qpos=Math.max(0,qpos-1);render()},r);let next=btn('Câu tiếp theo →',()=>{if(!quizAnswered[qpos])return msg('Hãy trả lời trước khi chuyển câu.');qpos++;render()},r);next.disabled=!quizAnswered[qpos];if(quizAnswered[qpos]){input.disabled=true;showAnswer($('feedback'),w,quizCorrect[qpos])}}
document.addEventListener('keydown',e=>{if(tab==='Kiểm tra'&&e.key==='Enter'){e.preventDefault();if(!quizAnswered[qpos])[...$('content').querySelectorAll('button')].find(b=>b.textContent.includes('Trả lời'))?.click();else if(qpos<19){qpos++;render()}return}if(tab==='Luyện tập'&&e.key==='Enter'){e.preventDefault();if(!answered)submitPractice(activeWords()[index%activeWords().length]);return}if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&e.target instanceof HTMLInputElement&&!e.target.disabled)return;if(e.key==='ArrowRight'){let b=[...$('content').querySelectorAll('button')].find(x=>x.textContent.includes('Tiếp theo'));if(b&&!b.disabled)b.click()}if(e.key==='ArrowLeft'){let b=[...$('content').querySelectorAll('button')].find(x=>x.textContent.includes('←'));if(b)b.click()}});
$('export-progress').onclick=()=>download('hsk-tien-do.json',state);$('import-progress').onchange=async e=>{try{let s=JSON.parse(await e.target.files[0].text());if(s?.records&&s.days){state=s;save();render();msg('Đã nhập tiến độ.')}else throw Error()}catch{msg('Tệp tiến độ không hợp lệ.')}};function download(n,d){let a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'application/json'}));a.href=u;a.download=n;a.click();URL.revokeObjectURL(u)}let theme=localStorage.getItem('hsk-theme')||'light';document.body.dataset.theme=theme;let toggle=document.createElement('button');toggle.textContent=theme==='light'?'☾':'☀';toggle.className='theme';toggle.setAttribute('aria-label',theme==='light'?'Bật giao diện tối':'Bật giao diện sáng');toggle.onclick=()=>{theme=theme==='light'?'dark':'light';document.body.dataset.theme=theme;toggle.textContent=theme==='light'?'☾':'☀';toggle.setAttribute('aria-label',theme==='light'?'Bật giao diện tối':'Bật giao diện sáng');localStorage.setItem('hsk-theme',theme)};document.querySelector('header').append(toggle);render();
