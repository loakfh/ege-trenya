/* «ЕГЭ-треня» · общий сценарий для дизайнов (второй заход; после отбора — четыре).
   Здесь вся логика и все тексты. Дизайн подключает файл, вызывает Trenya.create(render, {id})
   и рисует состояние S как хочет. Кнопки помечаются data-act="…", поле ввода — id="inp". */
(function () {
  const MAXP = [1,1,1,1,1,1,1,1,1,1,1,1,2,3,2,2,3,4,4];              // 19 заданий, 32 первичных балла
  const DESIGNS = [['01-tetrad','Тетрадь'],['04-skalodrom','Скалодром'],['07-cifra','Цифра'],['08-komiks','Комикс']];
  const HARD = [{b:2,a:9,k:10},{b:3,a:7,k:6}];                         // «Задача сложнее»: тот же тип, числа крупнее
  const TASKS = [{b:2,a:4,k:7},{b:3,a:5,k:4},{b:4,a:3,k:3},{b:5,a:6,k:3}];
  const TOPIC = 'Логарифмическое уравнение';
  const STAGES = ['Область допустимых значений','Определение логарифма','Корень'];
  const PROFILES = {
    back:  {scores:{1:'self',2:'help',3:'self',4:'self',6:'self'}, started:[7], first:1},
    fresh: {scores:{}, started:[], first:0}
  };
  const SYMS = ['^','√','log_','(',')','<','>'];
  const $ = id => document.getElementById(id);
  const K = t => window.katex ? katex.renderToString(t, {throwOnError:false}) : t;
  /* текст с вставками \( … \) → HTML с формулами */
  const rich = s => String(s == null ? '' : s).split(/\\\((.+?)\\\)/).map((p,i) => i%2 ? K(p) : p.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('');
  /* то, что напечатал ученик, → TeX */
  function tex(s) {
    s = s.replace(/[−–—]/g,'-').replace(/[\\{}$#%&~]/g,'').replace(/⁷/g,'^7').replace(/(^|[^А-Яа-яЁё])х(?![А-Яа-яЁё])/g,'$1x');
    return s.split(/([А-Яа-яЁё][А-Яа-яЁё\s:,.]*)/).map((p,i) => i%2 ? '\\text{'+p.replace(/_/g,' ')+'}' :
      p.replace(/log_?(\d+)/gi,'\\log_{$1}').replace(/\^\(([^)]*)\)/g,'^{$1}').replace(/\^(-?\d+|[a-z])/gi,'^{$1}')
       .replace(/<=|≤/g,'\\le ').replace(/>=|≥/g,'\\ge ').replace(/≠/g,'\\ne ').replace(/√\(([^)]*)\)/g,'\\sqrt{$1}').replace(/√(\w+)/g,'\\sqrt{$1}')
       .replace(/\*/g,'\\cdot ').replace(/^\s*-/,'{-}').replace(/([.,;])\s+/g,'$1\\ ').replace(/_(?!\{)/g,'')).join('');
  }
  const norm = s => s.toLowerCase().replace(/[−–—]/g,'-').replace(/х/g,'x').replace(/⁷/g,'^7').replace(/\s+/g,'').replace(/,/g,'.');
  const mk = t => { t = {...t}; t.N = Math.pow(t.b,t.k); t.ans = t.a - t.N; t.tex = `\\log_{${t.b}}(${t.a} - x) = ${t.k}`; return t; };

  function create(render, opts) {
    opts = opts || {};
    const T = {}; let S, P = 'back', ti = 0, hi = 0, toastT, lastAct = null;

    /* ───── состояние ───── */
    T.total = () => Object.keys(S.scores).reduce((a,n) => a + MAXP[n-1], 0);
    T.init = () => { const p = PROFILES[P]; ti = p.first;
      S = T.S = {profile:P, scores:{...p.scores}, started:[...p.started], screen:'home', panel:null, gained:0, solved:0, toast:'', log:[]}; hi = 0;
      clearWork(); S.blitz = null; draw('init'); };
    function clearWork() { Object.assign(S, {task:null, stage:0, rows:[], helped:false, miss:[0,0,0], hint:[0,0,0], seen:[0,0,0], done:false, busy:false, res:null}); }
    function draw(ev) {
      const i = $('inp'), keep = i && {v:i.value, f:document.activeElement === i, a:i.selectionStart, b:i.selectionEnd};
      render(S, ev, T); bar();
      const n = $('inp'); if (n && keep && ev !== 'task') { n.value = keep.v; if (keep.f) { n.focus({preventScroll:true}); try { n.setSelectionRange(keep.a, keep.b); } catch (e) {} } }
      preview(); document.documentElement.classList.toggle('tr-lock', !!S.panel);
      if (['sent','reply','aid','pick-ok','pick-miss','blitz','blitz-end','win','done','full'].includes(ev))
        requestAnimationFrame(() => { const l = document.querySelector('[data-last]'); if (l) l.scrollIntoView({block:'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); });
    }

    /* ───── тексты экранов (дизайн только раскладывает) ───── */
    T.home = () => S.profile === 'back'
      ? {title:'С возвращением', text:'Два дня назад мы разобрали уравнение из №7. Вспомним ход решения: три коротких вопроса с вариантами ответа.',
         badge:'новое', kicker:'Разминка', primary:{label:'Начать разминку', act:'blitz'}, secondary:{label:'Сразу к задаче', act:'start'}, own:{label:'Своя задача', act:'own'},
         recall: mk(TASKS[0]).tex}
      : {title:'Начнём с одной задачи', text:'№7, логарифмическое уравнение. Пишешь решение по строчке, тренер отвечает на каждую в своём поле.',
         badge:'', kicker:'Первая задача', primary:{label:'Начать', act:'start'}, secondary:null, own:{label:'Своя задача', act:'own'}, recall:null};
    T.helpItems = () => [
      {act:'hint', label:'Подсказка', sub:'Намёк на следующий шаг'},
      {act:'re', label:'Спросить иначе', sub:'Тот же вопрос другими словами'},
      {act:'theory', label:'Теория', sub:'Определение логарифма в одну строку'},
      {act:'full', label:'Показать решение', sub:'Целиком. Балл за разбор не начисляется'}];
    T.helpNote = 'Подсказка балл не уменьшает.';
    T.points = () => { const tot = T.total(), items = MAXP.map((max,i) => { const n = i+1;
        return {n, max, part: n <= 12 ? 1 : 2, state: S.scores[n] || (S.started.includes(n) ? 'started' : 'none')}; });
      const sum = part => items.filter(x => x.part === part && (x.state === 'self' || x.state === 'help')).reduce((a,x) => a + x.max, 0);
      const nx = items.find(x => x.state === 'started') || items.find(x => x.state === 'none');
      return {total:tot, max:32, items, part1:{got:sum(1), max:12}, part2:{got:sum(2), max:20}, today:S.gained, badge:'новое',
        title:'Твои баллы', legend:{self:'сам(а)', help:'с подсказкой', started:'начато', none:'впереди'},
        next: nx ? {n:nx.n, text: nx.state === 'started' ? `Ближайший балл — №${nx.n}: решение уже разбирали.` : `Ближайший балл — №${nx.n}.`} : null,
        note:'Первая часть — задания 1–12, по одному баллу. Вторая — 13–19, от двух до четырёх.'}; };
    const MORE = [{label:'Задача сложнее', act:'harder'}, {label:'Своя задача', act:'own'}];
    T.topic = '№7 · ' + TOPIC;
    T.result = () => { const r = S.res; if (!r) return null;
      if (r.full) return {title:'Решение целиком', plus:'', text:'Балл за разбор не начисляется. Реши похожее уравнение — и он твой.', total:T.total(),
        primary:{label:'Решить похожую', act:'next'}, secondary:{label:'На сегодня хватит', act:'bye'}, skills:[], skillsTitle:'', more:MORE};
      return {title:'Верно', plus: r.plus ? '+1' : '', total:T.total(), skills:r.skills, skillsTitle:'Разбор по шагам', more:MORE,
        text: !r.plus ? 'Балл за №7 уже был. Сейчас закрепили.' : r.how === 'self' ? '№7 закрыт без подсказок.' : '№7 закрыт. Подсказка балл не уменьшила.',
        primary:{label:'Следующая задача', act:'next'}, secondary:{label:'На сегодня хватит', act:'bye'}}; };
    T.bye = () => ({title:'На сегодня всё', text: S.gained ? `Сегодня: +${S.gained} к баллам, теперь ${T.total()} из 32.` : S.solved ? 'Сегодня закрепили №7.' : 'Баллы на месте, ничего не сгорает.',
      sub:'Когда вернёшься, начнём с короткой разминки по этой задаче.', primary:{label:'Вернуться к задачам', act:'home'}});
    T.ownPanel = {title:'Своя задача', text:'Напиши условие или сфотографируй его.', placeholder:'Например: log₂(4 − x) = 7', send:'Разобрать', photo:'Сфотографировать',
      solLabel:'Решение уже есть? Вставь его сюда, каждая строка с новой — тренер проверит по строкам.', solPlaceholder:'4 − x > 0, значит x < 4'};
    /* меню: история задач и всё редкое. В шапке — одна тихая кнопка data-act="menu" */
    T.menu = () => ({title:'Меню', label:'Меню', historyTitle:'Мои задачи',
      history: [...S.log].reverse().concat(S.profile === 'back' ? [
        {n:7, tex:mk(TASKS[0]).tex, when:'2 дня назад', status:'разобрали вместе', open:true},
        {n:6, tex:'\\sqrt{15 - 2x} = 3', when:'5 дней назад', status:'решено без подсказок', open:false}] : []),
      empty:'Здесь появятся задачи, которые вы разберёте.',
      items:[{act:'own', label:'Новая задача', sub:'Своя — текстом или фото'}, {act:'bug', label:'Сообщить о проблеме', sub:'Если тренер ответил странно или что-то сломалось'}, {act:'logout', label:'Выйти', sub:''}]});

    /* ───── разминка ───── */
    function blitzFor(t) { return [
      {q:'С чего начинаем?', ok:1, opts:[
        {tex:'x > 0', t:'Сам икс больше нуля', why:`Близко. Положительным должен быть весь аргумент логарифма, то есть \\(${t.a} - x\\), а не только \\(x\\).`},
        {tex:`${t.a} - x > 0`, t:'Аргумент логарифма больше нуля', why:`Да. Логарифм определён только для положительных чисел, значит \\(x < ${t.a}\\).`},
        {tex:`${t.a} - x = ${t.k}`, t:'Сразу убрать логарифм', why:'К этому вернёмся следующим шагом. Сначала стоит проверить, где логарифм вообще определён.'}]},
      {q:'Как убрать логарифм?', ok:2, opts:[
        {tex:`${t.a} - x = ${t.b} \\cdot ${t.k}`, t:'Основание умножить на число справа', why:'Логарифм отвечает на вопрос «в какую степень возвести основание». Поэтому здесь степень, а не произведение.'},
        {tex:`${t.a} - x = ${t.k}^{${t.b}}`, t:'Число справа в степени основания', why:`Наоборот: основание здесь \\(${t.b}\\), и в степень возводится оно.`},
        {tex:`${t.a} - x = ${t.b}^{${t.k}}`, t:'Основание в степени числа справа', why:`Да. По определению: \\(\\log_{${t.b}} t = ${t.k}\\) значит \\(t = ${t.b}^{${t.k}} = ${t.N}\\).`}]},
      {q:`Чему равен икс, если \\(${t.a} - x = ${t.N}\\)?`, ok:0, opts:[
        {tex:`x = ${t.ans}`, t:'', why:`Да. И \\(${t.ans} < ${t.a}\\), корень подходит.`},
        {tex:`x = ${-t.ans}`, t:'', why:`Проверь знак: \\(x = ${t.a} - ${t.N}\\).`},
        {tex:`x = ${t.a + t.N}`, t:'', why:`Здесь \\(${t.N}\\) переносится со сменой знака: \\(x = ${t.a} - ${t.N}\\).`}]}]; }
    T.blitzStart = () => { const t = mk(TASKS[0]);
      S.blitz = {task:t, steps:blitzFor(t), i:0, tried:[[],[],[]], ok:false, note:null, end:false,
        endText:'Ход решения на месте: область допустимых значений, определение логарифма, корень. Теперь похожее уравнение — пишешь уже ты.',
        skip:{label:'Пропустить разминку', act:'start'}, next:{label:'Дальше', act:'blitz-next'}, go:{label:'К задаче', act:'start'}};
      S.screen = 'blitz'; S.panel = null; draw('blitz'); scrollTo(0,0); };
    T.pick = j => { const B = S.blitz; if (!B || B.ok || B.end) return; const st = B.steps[B.i], o = st.opts[j]; if (!o || B.tried[B.i].includes(j)) return;
      B.note = o.why; if (j === st.ok) { B.ok = true; draw('pick-ok'); } else { B.tried[B.i].push(j); draw('pick-miss'); } };
    T.blitzNext = () => { const B = S.blitz; if (!B || !B.ok) return; if (B.i === B.steps.length-1) { B.end = true; draw('blitz-end'); } else { B.i++; B.ok = false; B.note = null; draw('blitz'); } };

    /* ───── решение задачи ───── */
    T.start = fixed => { clearWork(); S.blitz = null; S.screen = 'work'; S.panel = null;
      if (fixed) S.task = mk(fixed); else { S.task = mk(TASKS[ti % TASKS.length]); ti++; }
      if (!S.scores[7] && !S.started.includes(7)) S.started.push(7);
      S.rows.push({type:'coach', kind:'q', st:0, label:'', note:'Начнём с области допустимых значений: каким должен быть аргумент логарифма?'});
      draw('task'); scrollTo(0,0); focus(); };
    function judge(raw) {
      const t = S.task, n = norm(raw), st = S.stage;
      const hasAns = n.includes('x='+t.ans) || n.includes('ответ:'+t.ans) || n === String(t.ans);
      const hasN = n.includes(String(t.N)) || n.includes(t.b+'^'+t.k);
      const odz = n.includes('x<'+t.a) || n.includes(t.a+'-x>0') || n.includes(t.a+'>x');
      if (hasAns) { S.seen[2] = 1; if (hasN || st === 1) S.seen[1] = 1; if (odz) S.seen[0] = 1; S.stage = 3; return {mark:'final', note:`Верно. Корень входит в область допустимых значений: \\(${t.ans} < ${t.a}\\).`}; }
      if (hasN) { S.seen[1] = 1; S.stage = 2; return {mark:'ok', note:'Верно. Осталось найти \\(x\\).'}; }
      if (st === 0 && odz) { S.seen[0] = 1; S.stage = 1; return {mark:'ok', note:'Да, так. Теперь убери логарифм.'}; }
      if (st <= 1 && n.includes(String(t.b*t.k))) { S.miss[1]++; S.stage = 1; return {mark:'retry', note:'У меня вышло иначе. По определению логарифма основание возводится в степень, а не умножается. Как тогда запишешь равенство?'}; }
      if (st === 2 && /x=/.test(n)) { S.miss[2]++; return {mark:'retry', note:`Равенство \\(${t.a} - x = ${t.N}\\) верное. Проверь знак при переносе.`}; }
      S.miss[Math.min(st,2)]++;
      return {mark:'retry', note:'Эту строку я не разобрал. Запиши её иначе или возьми подсказку — это нормально.'};
    }
    function aidRow(kind) { const t = S.task, st = Math.min(S.stage,2);
      if (kind === 'theory') return {type:'coach', kind, st, label:'Теория', note:'\\(\\log_a b = c\\) значит \\(a^c = b\\). При этом \\(a > 0,\\ a \\ne 1,\\ b > 0\\).'};
      const H = [`Логарифм определён только для положительных чисел. Запиши это неравенством для \\(${t.a} - x\\).`,
                 `Если \\(\\log_b t = k\\), то \\(t = b^k\\). Что здесь \\(t\\), \\(b\\) и \\(k\\)?`, `Перенеси: \\(x = ${t.a} - ${t.N}\\).`];
      const R = [`Спрошу иначе: при каких \\(x\\) выражение \\(${t.a} - x\\) можно поставить под логарифм?`,
                 'Спрошу иначе: как избавиться от логарифма, если известно, чему он равен?', `Спрошу иначе: чему равен \\(x\\), если \\(${t.a} - x = ${t.N}\\)?`];
      if (kind === 'hint') { S.helped = true; S.hint[st] = 1; return {type:'coach', kind, st, label:'Подсказка', note:H[st]}; }
      return {type:'coach', kind:'re', st, label:'', note:R[st]}; }
    T.aid = kind => { if (S.busy || !S.task || S.done) return; S.panel = null; if (kind === 'full') return full(); S.rows.push(aidRow(kind)); draw('aid'); focus(); };
    T.send = raw => { raw = (raw || '').replace(/\s*\n+\s*/g, ', ').trim(); if (!raw || S.busy || S.done || !S.task) return;
      const row = {type:'line', raw, tex:tex(raw), note:null, mark:null, st:Math.min(S.stage,2), snap:{stage:S.stage, miss:[...S.miss], seen:[...S.seen]}};
      S.rows.push(row); S.busy = true; draw('sent');
      setTimeout(() => { const j = judge(raw); row.note = j.note; row.mark = j.mark; S.busy = false;
        if (j.mark !== 'retry') for (let i = S.rows.length-2; i >= 0; i--) { const r = S.rows[i]; if (r.type !== 'line') continue; if (r.mark === 'retry' && !r.old) r.old = true; else break; }
        if (j.mark === 'final') finish(); else { draw('reply'); focus(); } }, 700); };
    T.canUndo = () => { const r = S.rows[S.rows.length-1]; return !!(r && r.type === 'line' && r.snap && !S.done && !S.busy); };
    T.undo = () => { if (!T.canUndo()) return; const r = S.rows.pop(); Object.assign(S, r.snap); draw('undo'); const el = $('inp'); if (el) { el.value = r.raw; preview(); } focus(); };
    function finish() { S.done = true; S.solved++;
      const had = S.scores[7], how = S.helped ? 'help' : 'self';
      if (!had) { S.scores[7] = how; S.gained++; S.started = S.started.filter(n => n !== 7); }
      S.res = {plus:!had, how, skills:STAGES.map((name,i) => ({name, how:S.hint[i] ? 'с подсказкой' : S.miss[i] ? 'со второй попытки' : S.seen[i] ? 'с первого раза' : 'в решении не записано'}))};
      S.log.push({n:7, tex:S.task.tex, when:'сегодня', status: how === 'self' ? 'решено без подсказок' : 'решено с подсказкой', open:false});
      draw(had ? 'done' : 'win'); }
    function feed(lines) { (function step() { if (S.done || !S.task) return; if (S.busy) return setTimeout(step, 200); if (!lines.length) return; T.send(lines.shift()); setTimeout(step, 950); })(); }
    function full() { const t = S.task;
      S.rows = [{type:'solution', st:0, tex:`${t.a} - x > 0,\\ \\text{значит } x < ${t.a}`, note:'Сначала область допустимых значений.'},
                {type:'solution', st:1, tex:`${t.a} - x = ${t.b}^{${t.k}} = ${t.N}`, note:'По определению логарифма: основание в степени.'},
                {type:'solution', st:2, tex:`x = ${t.a} - ${t.N} = ${t.ans}`, note:`Корень подходит: \\(${t.ans} < ${t.a}\\).`, final:true}];
      S.done = true; S.stage = 3; S.res = {full:true}; S.log.push({n:7, tex:t.tex, when:'сегодня', status:'смотрели решение', open:false}); draw('full'); }
    T.next = () => T.start();
    T.panel = p => { S.panel = p; draw('panel');
      if (p) requestAnimationFrame(() => { const r = document.querySelector('[data-panel-root]'); const f = r && r.querySelector('input,button,[tabindex]'); if (f) f.focus({preventScroll:true}); });
      else if (lastAct) { const o = document.querySelector(`[data-act="${lastAct}"]`); if (o) o.focus({preventScroll:true}); } };
    T.toast = m => { S.toast = m; let t = $('tr-toast'); if (!t) { t = document.createElement('div'); t.id = 'tr-toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
      t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); };

    function focus() { const el = $('inp'); if (!el) return; if (innerWidth > 820) el.focus({preventScroll:true}); }
    function preview() { const p = document.querySelector('[data-prev]'), i = $('inp'); if (!p || !i) return; const v = i.value.trim();
      p.innerHTML = v ? '<span>Будет так:</span> ' + K(tex(v)) : ''; p.toggleAttribute('data-empty', !v); }

    /* ───── служебная полоса прототипа (не часть дизайна) ───── */
    function bar() { let b = $('tr-bar');
      if (!b) { b = document.createElement('div'); b.id = 'tr-bar'; document.body.insertBefore(b, document.body.firstChild);
        const st = document.createElement('style');
        st.textContent = '#tr-bar{background:#000;color:#b9bcc6;font:12px/1.4 system-ui,sans-serif;padding:5px 12px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;position:relative;z-index:90}' +
          '#tr-bar button,#tr-bar a{background:none;border:1px solid #555a66;color:#e8e9ed;border-radius:3px;padding:1px 7px;font:inherit;cursor:pointer;text-decoration:none}#tr-bar .on{background:#fff;color:#000;border-color:#fff}#tr-bar b{color:#fff;font-weight:600}' +
          '[hidden]{display:none!important}html.tr-lock{overflow:hidden}' +
          ':where(#tr-toast){position:fixed;left:50%;top:6px;transform:translateX(-50%);background:#fff;color:#000;border:2px solid #000;padding:10px 16px;border-radius:8px;z-index:99;max-width:min(520px,92vw);font:14px/1.4 system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .2s}:where(#tr-toast.on){opacity:1}';
        document.head.appendChild(st); }
      const ix = DESIGNS.findIndex(d => d[0] === opts.id), prev = DESIGNS[(ix + DESIGNS.length - 1) % DESIGNS.length], next = DESIGNS[(ix + 1) % DESIGNS.length];
      const t = S.task; let mv = '';
      if (S.screen === 'work' && t && !S.done) { const M = [[['верный', `${t.a} - x > 0, значит x < ${t.a}`]], [['с ошибкой', `${t.a} - x = ${t.b*t.k}`], ['верный', `${t.a} - x = ${t.b}^${t.k} = ${t.N}`]], [['верный', `x = ${t.ans}`]]][Math.min(S.stage,2)];
        mv = '<span>подставить ход:</span>' + M.map(m => `<button data-trmove="${m[1]}">${m[0]}</button>`).join(''); }
      b.innerHTML = `<b>Прототип</b>` + (ix >= 0 ? `<a href="${prev[0]}.html" aria-label="Предыдущий дизайн">←</a><span>${ix+1}/${DESIGNS.length} · ${DESIGNS[ix][1]}</span><a href="${next[0]}.html" aria-label="Следующий дизайн">→</a><a href="index.html">все</a>` : '') + mv +
        `<span style="flex:1"></span><button data-trprof="back" class="${P === 'back' ? 'on' : ''}">вернулись через 2 дня</button><button data-trprof="fresh" class="${P === 'fresh' ? 'on' : ''}">первый вход</button><button data-trreset>заново</button>`; }

    /* ───── события ───── */
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-act],[data-trmove],[data-trprof],[data-trreset],[data-sym]');
      if (!b) { if (S.panel && e.target.closest('[data-panel-backdrop]') && !e.target.closest('[data-panel-root]')) T.panel(null); return; }
      const d = b.dataset, a = d.act;
      if (d.trmove) { const i = $('inp'); if (i) { i.value = d.trmove; preview(); i.focus(); } return; }
      if (d.trprof) { P = d.trprof; T.init(); scrollTo(0,0); return; }
      if ('trreset' in d) { T.init(); scrollTo(0,0); return; }
      if (d.sym) { const i = $('inp'); if (i) { i.setRangeText(d.sym, i.selectionStart, i.selectionEnd, 'end'); i.focus(); preview(); } return; }
      if (a === 'points' || a === 'help' || a === 'own' || a === 'menu') { lastAct = a; T.panel(S.panel === a ? null : a); }
      else if (a === 'close') T.panel(null);
      else if (a === 'blitz') T.blitzStart();
      else if (a === 'blitz-next') T.blitzNext();
      else if (a === 'pick') T.pick(+d.i);
      else if (a === 'start' || a === 'next') T.start();
      else if (a === 'harder') { T.start(HARD[hi++ % HARD.length]); T.toast('В прототипе «сложнее» — то же уравнение с числами покрупнее.'); }
      else if (a === 'hist') { const h = T.menu().history[+d.i]; if (h && h.open) T.start(TASKS[0]); else T.toast('В прототипе из истории открывается только уравнение, которое разбирали вместе.'); }
      else if (a === 'bug') { T.panel(null); T.toast('В продукте здесь откроется короткая форма для команды.'); }
      else if (a === 'logout') { T.panel(null); T.toast('В прототипе выхода нет: аккаунт условный.'); }
      else if (a === 'hint' || a === 're' || a === 'theory' || a === 'full') T.aid(a);
      else if (a === 'undo') T.undo();
      else if (a === 'send') { const el = $('inp'); if (!el || S.busy) return; const v = el.value; el.value = ''; T.send(v); }
      else if (a === 'own-send' || a === 'photo') { const o = $('own'); const sol = $('ownsol'), lines = sol ? sol.value.split(/\n|;/).map(x => x.trim()).filter(Boolean) : [];
        if (a === 'own-send' && o && !o.value.trim()) { o.focus(); return; } T.start();
        T.toast(lines.length ? 'В прототипе задача подменяется примером про логарифм, а твои строки тренер проверяет по одной.' : 'В прототипе своя задача и фото подменяются примером про логарифм.');
        if (lines.length) setTimeout(() => feed(lines), 500); }
      else if (a === 'bye') { S.screen = 'bye'; S.panel = null; draw('bye'); scrollTo(0,0); }
      else if (a === 'home') { clearWork(); S.blitz = null; S.screen = 'home'; S.panel = null; draw('home'); scrollTo(0,0); }
    });
    document.addEventListener('input', e => { if (e.target.id === 'inp') preview(); });
    document.addEventListener('paste', e => { if (e.target.id !== 'inp') return; const tx = (e.clipboardData || window.clipboardData).getData('text'); if (!/\n/.test(tx)) return;
      e.preventDefault(); e.target.setRangeText(tx.trim().replace(/\s*\n+\s*/g, ', '), e.target.selectionStart, e.target.selectionEnd, 'end'); preview(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && S.panel) { T.panel(null); return; }
      if (e.key !== 'Enter') return; const id = e.target.id;
      if (id === 'inp') { e.preventDefault(); if (S.busy) return; const v = e.target.value; e.target.value = ''; T.send(v); }
      else if (id === 'own') { e.preventDefault(); const s = document.querySelector('[data-act="own-send"]'); if (s) s.click(); }
    });
    T.init(); return T;
  }
  window.Trenya = {create, MAXP, DESIGNS, TOPIC, STAGES, SYMS, K, rich, tex};
})();
