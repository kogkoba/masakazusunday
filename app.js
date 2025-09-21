console.log('[quiz-app] boot');

/***** 設定：あなたの最新 /exec URL をセット *****/
const GAS_URL = "https://script.google.com/macros/s/AKfycbxw1_oqKmaY1plPI0fz8e-_9Fd-WgL8smWSTNpq2-qwWBDTNSbvKP0ymsOfex7dRsgmWg/exec";
console.log('[quiz-app] GAS_URL =', GAS_URL);

/***** タブごとの gid *****/
const SUBJECTS = {
  "算数": { gid: 0 },
  "国語": { gid: 162988483 },
  "理科": { gid: 1839969673 },
  "社会": { gid: 2143649641 },
};

/***** JSONP *****/
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "__cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const sep = url.includes('?') ? '&' : '?';
    s.src = url + sep + 'callback=' + cb;
    s.async = true;

    window[cb] = (data) => {
      try { resolve(data); }
      finally {
        delete window[cb];
        document.body.removeChild(s);
      }
    };
    s.onerror = () => {
      delete window[cb];
      document.body.removeChild(s);
      reject(new Error('jsonp_error'));
    };
    document.body.appendChild(s);
  });
}

/***** 状態 *****/
const state = {
  subject: "国語",
  pool: "all",           // all | wrong_blank（FALSE + 空白のみ）
  order: "random",       // random | sequential
  scope: "all",          // all | byweek
  week: null,
  rows: [],
  i: 0,
  todayCount: 0,
  phase: "answer",       // "answer"（判定待ち）/ "next"（次へ待機）
  busy: false            // 二重操作防止
};

/***** ユーティリティ *****/
const norm = s => String(s ?? '').trim().replace(/\s+/g, '');
function parseAlts(s){
  return String(s ?? '')
    .split(/[|｜,，；;／/・\s]+/)
    .map(x => norm(x))
    .filter(Boolean);
}
function shuffle(a){
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `point_${d.getFullYear()}-${m}-${day}`;
};
function loadTodayPoint(){
  const v = Number(localStorage.getItem(todayKey()) || 0);
  state.todayCount = Number.isFinite(v) ? v : 0;
  [document.querySelector('#pointTodayTop'), document.querySelector('#pointToday')]
    .forEach(el => { if (el) el.textContent = String(state.todayCount); });
}
function saveTodayPoint(){
  localStorage.setItem(todayKey(), String(state.todayCount));
}

/***** 画面ヘルパ *****/
function showPanel(panelId) {
  document.querySelector('#subjectPanel').classList.add('hidden');
  document.querySelector('#quizPanel').classList.add('hidden');
  document.querySelector(panelId).classList.remove('hidden');
}
function setStatus(txt){
  const st = document.querySelector('#status');
  if (st) st.textContent = txt || '';
}
function setNextVisible(v){
  const nextBtn = document.querySelector('#nextBtn');
  if (!nextBtn) return;
  nextBtn.classList.toggle('hidden', !v);
}

/***** 授業回の選択肢を生成 *****/
async function loadWeeks() {
  const gid = SUBJECTS[state.subject].gid;
  const url = `${GAS_URL}?action=get&gid=${gid}&pool=all`;
  try {
    const json = await jsonp(url);
    if (!json.ok) throw new Error(json.error || 'fetch_error');

    const rows = Array.isArray(json.rows) ? json.rows : [];
    const weeks = [...new Set(rows.map(row => row.week).filter(Boolean))].sort();

    const weekSelect = document.querySelector('#weekSelect');
    if (weekSelect) {
      weekSelect.innerHTML = '<option value="">- 授業回を選択 -</option>';
      weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = week;
        weekSelect.appendChild(option);
      });
    }
  } catch(e) {
    console.error('Failed to load weeks', e);
  }
}

/***** 出題の取得 *****/
async function loadQuestions(){
  const gid = SUBJECTS[state.subject].gid;
  const url = `${GAS_URL}?action=get&gid=${gid}&pool=${encodeURIComponent(state.pool)}`;

  setStatus(`読み込み中…（科目：${state.subject}）`);
  try{
    const json = await jsonp(url);
    if (!json.ok) throw new Error(json.error || 'fetch_error');

    let rows = Array.isArray(json.rows) ? json.rows : [];
    if (state.scope === 'byweek' && state.week) {
      rows = rows.filter(row => String(row.week) === String(state.week));
    }
    if (state.order === 'random') shuffle(rows);
    state.rows = rows;
    state.i = 0;

    const totalEl = document.querySelector('#qTotal');
    if (totalEl) totalEl.textContent = `${state.rows.length}`;

    if (state.rows.length === 0){
      setStatus(`「${state.subject}」に該当の問題がありません（フィルタを見直してね）`);
      return;
    }
    setStatus('');
    showPanel('#quizPanel');
    renderQuestion(state.rows[state.i]);
  }catch(e){
    console.error(e);
    setStatus('読み込みに失敗しました');
  }
}

/***** 1問描画 *****/
function renderQuestion(row){
  const qEl = document.querySelector('#qText');
  const imgWrap = document.querySelector('#qImageWrap');
  const imgEl = document.querySelector('#qImage');
  const ansEl = document.querySelector('#answerInput');
  const idxEl = document.querySelector('#qIndex');
  const feedbackEl = document.querySelector('#feedback');
  const weekEl = document.querySelector('#qWeek');

  if (!row){
    if (qEl) qEl.textContent = '問題がありません';
    if (imgEl){ imgEl.removeAttribute('src'); }
    if (imgWrap){ imgWrap.classList.add('hidden'); }
    if (ansEl) ansEl.value = '';
    if (idxEl) idxEl.textContent = '0';
    if (feedbackEl) feedbackEl.textContent = '';
    if (weekEl) weekEl.textContent = '';
    return;
  }

  if (qEl) qEl.textContent = row.question || '';
  if (imgEl && imgWrap){
    if (row.image_url) {
      imgEl.src = row.image_url;
      imgWrap.classList.remove('hidden');
    } else {
      imgEl.removeAttribute('src');
      imgWrap.classList.add('hidden');
    }
  }
  if (ansEl){ ansEl.value=''; ansEl.focus(); }
  if (idxEl) idxEl.textContent = `${state.i+1}`;
  if (feedbackEl){ feedbackEl.textContent = ''; feedbackEl.classList.remove('ok','ng'); }
  if (weekEl) weekEl.textContent = row.week ? String(row.week) : '';

  state.phase = "answer";
  setNextVisible(false); // 判定前は次へボタンを隠す
}

/***** ログ書き込み（result: correct|wrong|skip）*****/
async function logResult(row, result){
  const gid = SUBJECTS[state.subject].gid;
  const url = `${GAS_URL}?action=log&gid=${gid}&id=${encodeURIComponent(row.id)}&result=${encodeURIComponent(result)}`;
  try{
    const res = await jsonp(url);
    console.log('[logResult]', result, res);
    return res && res.ok;
  }catch(e){
    console.error('log failed', e);
    return false;
  }
}

/***** 答えの判定＆保存 → 次へ待機 *****/
async function submitAnswer(kind = 'answer'){ // 'answer' | 'skip'
  if (state.busy) return;
  if (state.i >= state.rows.length) return;
  if (state.phase !== "answer") return; // 二重Enter防止

  const row = state.rows[state.i];
  const feedbackEl = document.querySelector('#feedback');
  const ansEl = document.querySelector('#answerInput');

  state.busy = true;

  let result = 'skip';
  if (kind === 'answer') {
    const user = norm(ansEl ? ansEl.value : '');

    // 入力が空白の場合は「スキップ扱い」で正解を表示
    if (user === '') {
      result = 'skip';
      if (feedbackEl) {
        feedbackEl.textContent = `スキップ… 正解は：${row.answer}`;
        feedbackEl.classList.remove('ok','ng');
      }
    } else {
      const corrects = new Set([norm(row.answer), ...parseAlts(row.alt_answers)]);
      const isCorrect = corrects.has(user);
      result = isCorrect ? 'correct' : 'wrong';

      if (feedbackEl) {
        feedbackEl.textContent = isCorrect ? '正解！' : `不正解… 正：${row.answer}`;
        feedbackEl.classList.toggle('ok', isCorrect);
        feedbackEl.classList.toggle('ng', !isCorrect);
      }

      // 正解ならポイント加算
      if (isCorrect){
        state.todayCount += 1;
        saveTodayPoint();
        [document.querySelector('#pointTodayTop'), document.querySelector('#pointToday')]
          .forEach(el => { if (el) el.textContent = String(state.todayCount); });
      }
    }
  } else {
    // スキップボタン
    result = 'skip';
    if (feedbackEl) {
      feedbackEl.textContent = `スキップ… 正解は：${row.answer}`;
      feedbackEl.classList.remove('ok','ng');
    }
  }

  logResult(row, result); // awaitしない

  // 次へ待機モード（Enter 連打してもここで止まる）
  state.phase = "next";
  setNextVisible(true);
  state.busy = false;
}

/***** 次の問題へ（1回だけ進む）*****/
function goNext(){
  if (state.busy) return;
  if (state.phase !== "next") return;

  state.busy = true;

  state.i += 1;
  if (state.i >= state.rows.length) {
    finishSet();
  } else {
    renderQuestion(state.rows[state.i]);
  }

  state.busy = false;
}

/***** セット終了 *****/
function finishSet(){
  const qEl = document.querySelector('#qText');
  const imgWrap = document.querySelector('#qImageWrap');
  const idxEl = document.querySelector('#qIndex');
  const ansEl = document.querySelector('#answerInput');
  if (qEl) qEl.textContent = 'おしまい！おつかれさま 🙌';
  if (imgWrap) imgWrap.classList.add('hidden');
  if (idxEl) idxEl.textContent = `${state.rows.length}`;
  if (ansEl) ansEl.value = '';
  state.phase = "answer";
  setNextVisible(false);
}

/***** イベント結線 *****/
function bindEvents(){
  // 科目切替
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-subject]');
    if (!btn) return;

    const cand = btn.dataset.subject;
    const changed = (state.subject !== cand);
    state.subject = cand;

    document.querySelectorAll('[data-subject]').forEach(b=>{
      b.classList.toggle('primary', b.dataset.subject === cand);
    });

    const subjectTitle = document.querySelector('#subjectTitle');
    if (subjectTitle) subjectTitle.textContent = cand;
    showPanel('#subjectPanel');

    state.scope = 'all';
    state.week = null;
    document.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.scope === 'all');
    });
    const weekSelect = document.querySelector('#weekSelect');
    if (weekSelect) { weekSelect.classList.add('hidden'); weekSelect.value = ''; }

    if (changed || (weekSelect && weekSelect.options.length <= 1)) loadWeeks();
  });

  // pool / order
  document.addEventListener('change', (e)=>{
    const p = e.target.closest('input[name="pool"]');
    if (p) state.pool = p.value; // 'all' | 'wrong_blank'
    const o = e.target.closest('input[name="order"]');
    if (o) state.order = o.value; // 'random' | 'sequential'
  });

  // スコープ切替
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn[data-scope]');
    if (!btn) return;
    state.scope = btn.dataset.scope;
    document.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.scope === state.scope);
    });
    const weekSelect = document.querySelector('#weekSelect');
    if (state.scope === 'byweek') {
      weekSelect.classList.remove('hidden');
      if (!weekSelect.options.length || weekSelect.options.length <= 1) loadWeeks();
    } else {
      weekSelect.classList.add('hidden');
      state.week = null;
      weekSelect.value = '';
    }
  });

  // 授業回選択
  const weekSelect = document.querySelector('#weekSelect');
  if (weekSelect) {
    weekSelect.addEventListener('change', (e) => {
      state.week = e.target.value || null;
    });
  }

  // クイズ開始
  document.querySelector('#startBtn')?.addEventListener('click', loadQuestions);

  // メニューへ戻る
  document.querySelector('#backBtn')?.addEventListener('click', ()=>{ showPanel('#subjectPanel'); });

  // Enter挙動：判定 → 次へ
  const input = document.querySelector('#answerInput');
  if (input) {
    input.addEventListener('keydown', e=>{
      if (e.key === 'Enter') {
        if (state.phase === 'answer') submitAnswer('answer'); // 空白なら「スキップして正答表示」
        else if (state.phase === 'next') goNext();            // もう一度Enterで次へ
      }
    });
  }
  document.querySelector('#submitBtn')?.addEventListener('click', () => submitAnswer('answer'));

  // スキップ（空白保存し、正解を表示）
  document.querySelector('#skipBtn')?.addEventListener('click', () => submitAnswer('skip'));

  // 次へ（▶アイコン）
  document.querySelector('#nextBtn')?.addEventListener('click', () => goNext());

  // 本日ポイントリセット
  document.querySelector('#resetTodayTop')?.addEventListener('click', resetTodayPoint);
  document.querySelector('#resetToday')?.addEventListener('click', resetTodayPoint);
}

function resetTodayPoint(){
  state.todayCount = 0;
  saveTodayPoint();
  [document.querySelector('#pointTodayTop'), document.querySelector('#pointToday')]
    .forEach(el => { if (el) el.textContent = '0'; });
}

/***** 初期化 *****/
window.addEventListener('DOMContentLoaded', ()=>{
  bindEvents();
  loadTodayPoint();
  showPanel('#subjectPanel');

  const initialSubjectBtn = document.querySelector(`[data-subject="${state.subject}"]`);
  if (initialSubjectBtn) initialSubjectBtn.classList.add('primary');
  const subjectTitle = document.querySelector('#subjectTitle');
  if (subjectTitle) subjectTitle.textContent = state.subject;

  loadWeeks();
});
