/* picsedit prototype app.js */
const state = {
  project: null,
  objects: [],
  selected: null,
  lang: 'ru',
  sceneScale: 1
};
let addToLibraryNext = false;
// persistence keys and GitHub URL
const SETTINGS_KEY = 'picsedit_settings';
const GITHUB_URL = 'https://github.com/vaniachessofficial/PicsEdit';
const MUSIC_TRACKS = ['music1.mp3','music2.mp3','music3.mp3','music4.mp3','music5.mp3'];

function saveSettings(obj){ try{ const cur = loadSettings() || {}; const merged = Object.assign({}, cur, obj); localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged)); }catch(e){} }
function loadSettings(){ try{ const raw = localStorage.getItem(SETTINGS_KEY); if(!raw) return null; return JSON.parse(raw); }catch(e){ return null } }

// migrate old localStorage keys (photocat_*) -> picsedit_* to preserve user data
function migrateOldStorageKeys(){
  const pairs = [
    ['photocat_settings','picsedit_settings'],
    ['photocat_library','picsedit_library'],
    ['photocat_projects','picsedit_projects'],
    ['photocat_music_volume','picsedit_music_volume']
  ];
  for(const [oldKey,newKey] of pairs){
    try{
      const hasNew = localStorage.getItem(newKey);
      const hasOld = localStorage.getItem(oldKey);
      if((hasNew === null || hasNew === undefined) && hasOld !== null && hasOld !== undefined){
        localStorage.setItem(newKey, hasOld);
      }
    }catch(e){}
  }
}

function markDirty(){ try{ if(state.project) state.project.dirty = true }catch(e){} }
function markSaved(){ try{ if(state.project) state.project.dirty = false }catch(e){} }

// --- Utilities ---
function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

// --- Menu & stars animation ---
function makeStars(){
  const c = qs('#stars'); if(!c) return; const ctx = c.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let width = window.innerWidth, height = window.innerHeight;
  function resize(){
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth; height = window.innerHeight;
    c.style.width = width + 'px'; c.style.height = height + 'px';
    c.width = Math.max(1, Math.floor(width * dpr)); c.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); window.addEventListener('resize', ()=>{ // debounce resize to avoid layout thrash
    clearTimeout(window._picsedit_resize_timeout);
    window._picsedit_resize_timeout = setTimeout(resize, 120);
  });

  // create stars with deterministic twinkle (phase) to avoid frame-to-frame random jitter
  const STAR_COUNT = Math.min(160, Math.max(40, Math.floor((width*height)/50000)) );
  const stars = Array.from({length:STAR_COUNT}).map(()=>({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.6 + Math.random()*1.8,
    dx: (Math.random()-0.5) * 0.25,
    phase: Math.random()*Math.PI*2,
    speed: 0.002 + Math.random()*0.008
  }));

  // extract RGB from CSS var once per frame
  function parseStarBase(){ const val = getComputedStyle(document.documentElement).getPropertyValue('--star-color') || 'rgba(255,255,255,0.9)'; const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9\.]+))?\)/); if(!m) return {r:255,g:255,b:255}; return {r:parseInt(m[1]), g:parseInt(m[2]), b:parseInt(m[3])}; }

  function frame(ts){
    ctx.clearRect(0,0,width, height);
    const base = parseStarBase();
    for(const s of stars){
      s.x += s.dx; if(s.x < -10) s.x = width + 10; if(s.x > width + 10) s.x = -10;
      s.phase += s.speed;
      const alpha = 0.25 + 0.55 * (0.5 + 0.5*Math.sin(s.phase));
      ctx.fillStyle = `rgba(${base.r},${base.g},${base.b},${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(Math.round(s.x), Math.round(s.y), s.r, 0, Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// --- UI translation ---
function _setLabelTextPreservingInput(labelEl, text){ if(!labelEl) return; const inp = labelEl.querySelector('input'); labelEl.textContent = text; if(inp) labelEl.appendChild(inp); }
function translateUI(lang){
  if(!lang) return;
  const maps = {
    en: {
      '#menu-content h1': 'PicsEdit',
      '.tagline': 'Simple, free photo editor',
      '#btn-new': 'New Project',
      '#btn-open': 'Open Project',
      '#btn-settings': 'Settings',
      '#btn-support': 'Support',
      '#btn-samples-main': 'Samples',
      '#btn-library-main': 'Library',
      '#btn-tutorial': 'Tutorial',
      '#btn-demos': 'Demos',
      '#btn-github-main': 'GitHub',
      '#btn-save': 'Save (local)',
      '#btn-export-project': 'Export Project (JSON)',
      '.import-label': 'Import',
      '#btn-export-library': 'Export Library',
      '#file-image-label': 'Add Image',
      '#btn-pipette': 'Pipette (pick color)',
      '#btn-remove-color': 'Remove Selected Color',
      '#btn-add-text': 'Add Text',
      '#btn-remove-green': 'Remove Green Background',
      '#btn-add-to-library': 'Add to Library',
      '#btn-hotkeys': 'Hotkeys',
      '#btn-back': 'Main Menu',
      '#modal-new h2': 'New Project',
      '#modal-settings h2': 'Settings',
      '#modal-hotkeys h2': 'Hotkeys',
      '#modal-tutorial h2': 'Tutorial'
    },
    ru: {
      '#menu-content h1': 'PicsEdit',
      '.tagline': 'Простой, бесплатный фоторедактор',
      '#btn-new': 'Новый проект',
      '#btn-open': 'Открыть проект',
      '#btn-settings': 'Настройки',
      '#btn-support': 'Поддержать',
      '#btn-samples-main': 'Образцы',
      '#btn-library-main': 'Библиотека',
      '#btn-tutorial': 'Как пользоваться',
      '#btn-demos': 'Демо-проекты',
      '#btn-github-main': 'GitHub',
      '#btn-save': 'Сохранить как PNG',
      '#btn-export-project': 'Сохранить как JSON',
      '.import-label': 'Импорт',
      '#btn-export-library': 'Экспорт библиотеки',
      '#file-image-label': 'Добавить изображение',
      '#btn-pipette': 'Пипетка (выбрать цвет)',
      '#btn-remove-color': 'Убрать выбранный цвет',
      '#btn-add-text': 'Добавить текст',
      '#btn-remove-green': 'Убрать зелёный фон',
      '#btn-add-to-library': 'Добавить в библиотеку',
      '#btn-hotkeys': 'Горячие клавиши',
      '#btn-back': 'Главное меню',
      '#modal-new h2': 'Новый проект',
      '#modal-settings h2': 'Настройки',
      '#modal-hotkeys h2': 'Горячие клавиши',
      '#modal-tutorial h2': 'Как пользоваться'
    }
  };

  const map = maps[lang] || {};
  try{
      // apply mapped elements
    for(const sel in map){
      if(!Object.prototype.hasOwnProperty.call(map, sel)) continue;
      const txt = map[sel];
      if(sel === '.import-label'){
        const importLabels = qsa('.import-label'); importLabels.forEach(l=> _setLabelTextPreservingInput(l, txt));
        continue;
      }
      if(sel === '#file-image-label'){
        const f = qs('#file-image'); if(f && f.parentElement) _setLabelTextPreservingInput(f.parentElement, txt); continue;
      }
      const el = qs(sel);
      if(el) el.textContent = txt;
    }

    // effects select options
    const eff = qs('#effects-select');
    if(eff){
      const optMap = (lang==='en') ? {
        'none':'None','blur':'Blur','grayscale':'Grayscale','invert':'Invert','pixelate':'Pixelate','brightness':'Brightness','fisheye':'Fisheye','swirl':'Swirl','selective-sat':'Selective Saturation','selective-remove':'Remove Selected Color'
      } : {
        'none':'Нет','blur':'Размытие','grayscale':'Серый цвет','invert':'Инверсия','pixelate':'Пикселизация','brightness':'Яркость','fisheye':'Рыбий глаз','swirl':'Завихрение','selective-sat':'Выборочная насыщенность','selective-remove':'Удалить выбранный цвет'
      };
      Array.from(eff.options).forEach(o=>{ if(optMap[o.value]) o.textContent = optMap[o.value]; });
    }

    // hotkeys list
    const hk = qs('#modal-hotkeys ul'); if(hk){ if(lang==='en') hk.innerHTML = '<li><b>Ctrl+O</b>: Open project</li><li><b>Ctrl+S</b>: Save (export PNG)</li><li><b>Del</b>: Delete selected object</li><li><b>Ctrl+Z</b>: Undo</li>'; else hk.innerHTML = '<li><b>Ctrl+O</b>: Открыть проект</li><li><b>Ctrl+S</b>: Сохранить (экспорт PNG)</li><li><b>Del</b>: Удалить выбранный объект</li><li><b>Ctrl+Z</b>: Отменить</li>'; }

      // additional label-preserving translations for form controls
      // Font label
      const fs = qs('#font-select'); if(fs && fs.parentElement) _setLabelTextPreservingInput(fs.parentElement, (lang==='en') ? 'Font' : 'Шрифт');
      const fc = qs('#font-custom'); if(fc && fc.parentElement) _setLabelTextPreservingInput(fc.parentElement, (lang==='en') ? 'Custom font' : 'Другой шрифт');
      const fsize = qs('#font-size'); if(fsize && fsize.parentElement) _setLabelTextPreservingInput(fsize.parentElement, (lang==='en') ? 'Size' : 'Размер');
      const fcolor = qs('#font-color'); if(fcolor && fcolor.parentElement) _setLabelTextPreservingInput(fcolor.parentElement, (lang==='en') ? 'Color' : 'Цвет');
      const pip = qs('#btn-pipette'); if(pip) pip.textContent = (lang==='en') ? 'Pipette (pick color)' : 'Пипетка (выбрать цвет)';

      // scene toolbar titles and labels
      const tb = id => { const b = qs(id); return b; };
      if(tb('#tb-zoom-in')){ tb('#tb-zoom-in').title = (lang==='en') ? 'Zoom in' : 'Увеличить'; }
      if(tb('#tb-zoom-out')){ tb('#tb-zoom-out').title = (lang==='en') ? 'Zoom out' : 'Уменьшить'; }
      if(tb('#tb-zoom-reset')){ tb('#tb-zoom-reset').title = (lang==='en') ? 'Reset zoom' : 'Сброс масштаба'; }
      if(tb('#tb-add-image')){ tb('#tb-add-image').title = (lang==='en') ? 'Add image' : 'Добавить изображение'; tb('#tb-add-image').textContent = (lang==='en') ? 'Add' : 'Добавить'; }
      if(tb('#tb-export')){ tb('#tb-export').title = (lang==='en') ? 'Export (Ctrl+S)' : 'Экспорт (Ctrl+S)'; tb('#tb-export').textContent = (lang==='en') ? 'Export as png' : 'Экспорт как png'; }
      if(tb('#tb-delete')){ tb('#tb-delete').title = (lang==='en') ? 'Delete (Del)' : 'Удалить (Del)'; tb('#tb-delete').textContent = (lang==='en') ? 'Delete' : 'Удалить'; }
      if(tb('#tb-duplicate')){ tb('#tb-duplicate').title = (lang==='en') ? 'Duplicate' : 'Дублировать'; tb('#tb-duplicate').textContent = (lang==='en') ? 'Duplicate' : 'Дублировать'; }
      if(tb('#tb-rotate-left')){ tb('#tb-rotate-left').title = (lang==='en') ? 'Rotate left' : 'Повернуть влево'; }
      if(tb('#tb-rotate-right')){ tb('#tb-rotate-right').title = (lang==='en') ? 'Rotate right' : 'Повернуть вправо'; }
      if(tb('#tb-flip')){ tb('#tb-flip').title = (lang==='en') ? 'Flip horizontally' : 'Отразить по горизонтали'; tb('#tb-flip').textContent = (lang==='en') ? 'Flip' : 'Перевернуть'; }
      if(tb('#tb-front')){ tb('#tb-front').title = (lang==='en') ? 'Bring forward' : 'Вперёд'; tb('#tb-front').textContent = (lang==='en') ? 'Forward' : 'Вперёд'; }
      if(tb('#tb-back')){ tb('#tb-back').title = (lang==='en') ? 'Send backward' : 'Назад'; tb('#tb-back').textContent = (lang==='en') ? 'Back' : 'Назад'; }

      // right panel / library
      const libh = qs('#right-panel h3'); if(libh) libh.textContent = (lang==='en') ? 'Library' : 'Библиотека';
      const lf = qs('#library-filter'); if(lf) lf.placeholder = (lang==='en') ? 'Filter...' : 'Фильтр...';

      // modal new labels (preserve inputs)
      const newName = qs('#new-name'); if(newName && newName.parentElement) _setLabelTextPreservingInput(newName.parentElement, (lang==='en') ? 'Name' : 'Название');
      const newW = qs('#new-width'); if(newW && newW.parentElement) _setLabelTextPreservingInput(newW.parentElement, (lang==='en') ? 'Width' : 'Ширина');
      const newH = qs('#new-height'); if(newH && newH.parentElement) _setLabelTextPreservingInput(newH.parentElement, (lang==='en') ? 'Height' : 'Высота');
      const createBtn = qs('#create-project'); if(createBtn) createBtn.textContent = (lang==='en') ? 'Create' : 'Создать';
      // modal settings option labels
      const themeSel = qs('#theme-select'); if(themeSel){ const optD = themeSel.querySelector('option[value="dark"]'); const optL = themeSel.querySelector('option[value="light"]'); if(optD) optD.textContent = (lang==='en') ? 'Dark' : 'Тёмная'; if(optL) optL.textContent = (lang==='en') ? 'Light' : 'Светлая'; }
      const langSel = qs('#lang-select'); if(langSel){ const optRu = langSel.querySelector('option[value="ru"]'); const optEn = langSel.querySelector('option[value="en"]'); if(optRu) optRu.textContent = (lang==='en') ? 'Russian' : 'Русский'; if(optEn) optEn.textContent = (lang==='en') ? 'English' : 'English'; }

      // menu music label
      const mmLabel = qs('.menu-music label'); if(mmLabel) mmLabel.textContent = (lang==='en') ? 'Music:' : 'Музыка:';

      // tutorial modal content
      const tutP = qs('#modal-tutorial .modal-inner p'); if(tutP) tutP.textContent = (lang==='en') ? 'Welcome to PicsEdit — a simple photo editor prototype. Use the Add Image button or the library, drag objects, tweak effects and export your image.' : 'Добро пожаловать в PicsEdit — простой прототип фоторедактора. Используйте кнопку "Добавить изображение" или библиотеку, перетаскивайте объекты, изменяйте эффекты и экспортируйте изображение.';

  }catch(e){ console.error('translateUI failed', e); }
}

// Simple ambient synth (WebAudio) — gentle drone
let audioCtx, droneGain;
function startAmbient(){ if(audioCtx) return; audioCtx = new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(); droneGain=audioCtx.createGain(); o.type='sine'; o.frequency.value=110; o.connect(droneGain); droneGain.connect(audioCtx.destination); droneGain.gain.value=0.02; o.start(); }
function stopAmbient(){ if(audioCtx){ audioCtx.close(); audioCtx=null; droneGain=null } }

// --- Project creation & workspace ---
function showModal(id,show=true){ qs(id).classList.toggle('show',show) }

function createProject(name,w,h){ state.project={name,w,h}; qs('#proj-name').textContent = name; qs('#proj-res').textContent = `${w}×${h}`; showModal('#modal-new',false); setupScene(w,h); showWorkspace(); }

function setSceneScale(s){ state.sceneScale = s; const scene = qs('#scene'); if(scene){ scene.style.transformOrigin = '50% 50%'; scene.style.transform = `scale(${s})`; qs('#tb-zoom-reset') && (qs('#tb-zoom-reset').textContent = Math.round(s*100)+'%'); } }
function zoomScene(factor){ const next = Math.max(0.01, state.sceneScale * factor); setSceneScale(next); }

// initial simple showMainMenu/showWorkspace removed in favor of enhanced versions later

function setupScene(w,h){ const scene = qs('#scene'); scene.innerHTML=''; scene.style.width = w+'px'; scene.style.height = h+'px'; state.objects=[]; state.selected=null; updateSelection(); }

// --- Objects: add image / text ---
function addImageFromFile(file){ const reader=new FileReader(); reader.onload=e=>{ addImageElement(e.target.result) }; reader.readAsDataURL(file) }
function addImageElement(src){ const scene=qs('#scene'); const el = document.createElement('div'); el.className='scene-object'; el.style.left='10px'; el.style.top='10px'; el.style.width='200px'; el.style.height='150px'; const img = document.createElement('img'); img.src=src; img.draggable=false; // preserve original source so effects are non-destructive
  try{ img.dataset.originalSrc = src }catch(e){}
  el.appendChild(img); scene.appendChild(el); _initObjectTransforms(el); makeInteractive(el); state.objects.push(el); selectObject(el);
  try{ markDirty(); }catch(e){}
}
// ensure new objects have transform metadata
function _initObjectTransforms(el){ if(!el) return; if(!el.dataset) el.dataset = {}; if(!el.dataset.rotation) el.dataset.rotation='0'; if(!el.dataset.scaleX) el.dataset.scaleX='1'; if(!el.dataset.scaleY) el.dataset.scaleY='1'; applyTransformToElement(el); }

function applyTransformToElement(el){ const r = parseFloat(el.dataset.rotation||'0'); const sx = parseFloat(el.dataset.scaleX||'1'); const sy = parseFloat(el.dataset.scaleY||'1'); el.style.transform = `rotate(${r}deg) scaleX(${sx}) scaleY(${sy})`; }

function addText(){ const scene=qs('#scene'); const el=document.createElement('div'); el.className='scene-object'; el.contentEditable=true; el.textContent='Новый текст'; el.style.left='50px'; el.style.top='50px'; el.style.color = qs('#font-color').value; el.style.fontSize = qs('#font-size').value+'px'; const custom = qs('#font-custom') && qs('#font-custom').value.trim(); const font = custom || qs('#font-select').value; el.style.fontFamily = font.indexOf(' ')>=0 ? '"'+font+'"' : font; scene.appendChild(el); _initObjectTransforms(el); makeInteractive(el); state.objects.push(el); selectObject(el);
  try{ markDirty(); }catch(e){}
}



// make DOM element draggable/resizable/rotatable (basic)
function makeInteractive(el){
  let dragging=false, resizing=false, startX=0, startY=0, origX=0, origY=0, startW=0, startH=0;
  el.addEventListener('pointerdown', (ev)=>{
    // don't start drag when clicking on resize handle
    if(ev.target.classList && ev.target.classList.contains('resize-handle')) return;
    // allow clicking to select but avoid preventing text editing
    if(el.isContentEditable && ev.detail>1) return;
    ev.preventDefault();
    startX=ev.clientX; startY=ev.clientY; origX=parseFloat(el.style.left)||0; origY=parseFloat(el.style.top)||0; dragging=true; try{ el.setPointerCapture(ev.pointerId); }catch(e){}
    selectObject(el);
  });

  // resize handle - create if missing
  if(!el.querySelector('.resize-handle')){
    const handle = document.createElement('div'); handle.className='resize-handle'; el.appendChild(handle);
    handle.addEventListener('pointerdown',(ev)=>{ ev.stopPropagation(); ev.preventDefault(); resizing=true; startX=ev.clientX; startY=ev.clientY; startW = parseFloat(el.style.width)||el.offsetWidth; startH = parseFloat(el.style.height)||el.offsetHeight; try{ handle.setPointerCapture(ev.pointerId); }catch(e){} });
  }

  window.addEventListener('pointermove', (ev)=>{
    if(dragging){ const dx=(ev.clientX-startX)/state.sceneScale, dy=(ev.clientY-startY)/state.sceneScale; el.style.left = (origX+dx)+'px'; el.style.top = (origY+dy)+'px'; }
    if(resizing){ const dx=(ev.clientX-startX)/state.sceneScale, dy=(ev.clientY-startY)/state.sceneScale; const nw = Math.max(20, startW + dx); const nh = Math.max(20, startH + dy); el.style.width = nw+'px'; el.style.height = nh+'px'; }
  });

  window.addEventListener('pointerup',(ev)=>{ if(dragging){ dragging=false; try{ ev.target.releasePointerCapture(ev.pointerId) }catch(e){} } if(resizing){ resizing=false; try{ ev.target.releasePointerCapture(ev.pointerId) }catch(e){} } });

  // simple double-click to enter edit if text
  el.addEventListener('dblclick', ()=>{ if(el.isContentEditable) el.focus() });
}

function selectObject(el){ if(state.selected) state.selected.classList.remove('selected'); state.selected = el; if(el) el.classList.add('selected'); updateInspector(); }
function updateSelection(){ qsa('.scene-object').forEach(o=>o.classList.remove('selected')); state.selected=null; updateInspector(); }

function updateInspector(){ const sel = state.selected; if(!sel) return; const style = window.getComputedStyle(sel); if(sel.isContentEditable || sel.querySelector){ try{ const color = style.color; qs('#font-color').value = rgbToHex(color); }catch(e){} try{ qs('#font-size').value = parseInt(style.fontSize)||32 }catch(e){} try{ const ff = style.fontFamily || ''; const custom = qs('#font-custom'); if(custom) custom.value = ff.replace(/['"]/g,''); const selOpt = qs('#font-select'); if(selOpt){ // try to match known list
    for(const opt of selOpt.options){ if(ff.toLowerCase().includes(opt.value.toLowerCase())){ selOpt.value = opt.value; break } }
    }
    // bold / italic
    try{ const boldEl = qs('#font-bold'); if(boldEl) boldEl.checked = (style.fontWeight=='700' || parseInt(style.fontWeight)>=700); const it = qs('#font-italic'); if(it) it.checked = (style.fontStyle==='italic'); }catch(e){}
    // stroke
    try{ const st = style.webkitTextStroke || ''; if(st && qs('#font-stroke-width')){ const m = st.match(/([0-9\.]+)px\s*(.*)/); if(m){ qs('#font-stroke-width').value = parseFloat(m[1])||0; try{ qs('#font-stroke-color').value = m[2].trim() }catch(e){} } else { qs('#font-stroke-width').value = 0 } } }catch(e){}
    // shadow
    try{ const ts = style.textShadow || ''; if(ts && ts!=='none'){ const parts = ts.split(/\s+/); if(parts.length>=4){ qs('#font-shadow-x').value = parseFloat(parts[0])||0; qs('#font-shadow-y').value = parseFloat(parts[1])||0; qs('#font-shadow-blur').value = parseFloat(parts[2])||0; qs('#font-shadow-color').value = parts.slice(3).join(' '); } } else { if(qs('#font-shadow-x')) qs('#font-shadow-x').value = 0; if(qs('#font-shadow-y')) qs('#font-shadow-y').value = 0; if(qs('#font-shadow-blur')) qs('#font-shadow-blur').value = 0; } }catch(e){}
  }catch(e){} }
}

function rgbToHex(rgb){ const m=rgb.match(/(\d+),\s*(\d+),\s*(\d+)/); if(!m) return '#ffffff'; return '#'+((1<<24)+(parseInt(m[1])<<16)+(parseInt(m[2])<<8)+parseInt(m[3])).toString(16).slice(1) }

// --- Effects and chroma key ---
function applyEffectToSelected(effect, strength=50){
  if(!state.selected) return; const el = state.selected; const img = el.querySelector && el.querySelector('img'); const s = Number(strength) || 50;
  if(img){ // image targets
    if(!img.dataset.originalSrc) try{ img.dataset.originalSrc = img.src }catch(e){}
    const orig = img.dataset.originalSrc || img.src;
    if(effect==='none'){ img.src = orig; img.style.filter = 'none'; el.style.boxShadow = ''; return }
    if(effect==='blur'){ img.src = orig; img.style.filter = `blur(${(s/100)*20}px)`; return }
    if(effect==='grayscale'){ img.src = orig; img.style.filter = `grayscale(${s/100})`; return }
    if(effect==='invert'){ img.src = orig; img.style.filter = `invert(${s/100})`; return }
    if(effect==='pixelate'){ pixelate(img, Math.max(1, Math.round(1 + (s/100)*50)), orig); return }
    if(effect==='brightness'){ img.src = orig; try{ img.style.filter = `brightness(${1 + (s-50)/50})`; }catch(e){ img.style.filter = 'none' } return }
    if(effect==='fisheye'){ img.src = orig; applyFisheye(img, Math.max(0, (s/100))); return }
    if(effect==='swirl'){ img.src = orig; applySwirl(img, (s/100)*3.14 /* max ~pi radians */); return }
    if(effect==='selective-sat'){ img.src = orig; applySelectiveSaturation(img, qs('#selective-color') ? qs('#selective-color').value : '#ff0000', s-50 /* -50..+50 */, Number(qs('#selective-tolerance')?qs('#selective-tolerance').value:30)); return }
    if(effect==='selective-remove'){ img.src = orig; applySelectiveSaturation(img, qs('#selective-color') ? qs('#selective-color').value : '#00ff00', -100 /* remove */ , Number(qs('#selective-tolerance')?qs('#selective-tolerance').value:40)); return }
  } else {
    // apply to text or generic element
    if(effect==='none'){ el.style.filter = 'none'; return }
    if(effect==='blur'){ el.style.filter = `blur(${(s/100)*8}px)`; return }
    if(effect==='grayscale'){ el.style.filter = `grayscale(${s/100})`; return }
    if(effect==='invert'){ el.style.filter = `invert(${s/100})`; return }
  }
}

// --- Advanced image effects (canvas-based) ---
function applyBrightnessToCanvasImage(img, amount){ // amount: multiplier e.g. 1.2
  const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{
    const w = tmp.naturalWidth, h = tmp.naturalHeight; const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.drawImage(tmp,0,0);
    try{ const data = ctx.getImageData(0,0,w,h); const d = data.data; for(let i=0;i<d.length;i+=4){ d[i] = clamp(d[i]*amount); d[i+1] = clamp(d[i+1]*amount); d[i+2] = clamp(d[i+2]*amount); } ctx.putImageData(data,0,0); img.src = c.toDataURL(); }catch(e){ img.style.filter = `brightness(${amount})` }
  }; tmp.onerror = ()=>{}; tmp.src = img.dataset.originalSrc || img.src;
}

function applyFisheye(img, strength){ // strength 0..1
  const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{
    const w=tmp.naturalWidth, h=tmp.naturalHeight; const cx=w/2, cy=h/2; const radius = Math.min(cx,cy);
    const src = document.createElement('canvas'); src.width=w; src.height=h; const sctx = src.getContext('2d'); sctx.drawImage(tmp,0,0);
    const dst = document.createElement('canvas'); dst.width=w; dst.height=h; const dctx = dst.getContext('2d'); const srcData = sctx.getImageData(0,0,w,h); const dstData = dctx.createImageData(w,h);
    const sd = srcData.data, dd = dstData.data;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const nx = (x - cx)/radius; const ny = (y - cy)/radius; const r = Math.sqrt(nx*nx + ny*ny);
        let theta = Math.atan2(ny,nx);
        let rn = r;
        if(r>0 && r<=1){ rn = Math.pow(r, 1 - strength*0.8); }
        const sx = Math.round(cx + rn*radius*Math.cos(theta)); const sy = Math.round(cy + rn*radius*Math.sin(theta));
        const di = (y*w + x)*4; const si = (Math.max(0, Math.min(h-1, sy))*w + Math.max(0, Math.min(w-1, sx)))*4;
        dd[di]=sd[si]; dd[di+1]=sd[si+1]; dd[di+2]=sd[si+2]; dd[di+3]=sd[si+3];
      }
    }
    dctx.putImageData(dstData,0,0); img.src = dst.toDataURL();
  }; tmp.onerror = ()=>{}; tmp.src = img.dataset.originalSrc || img.src;
}

function applySwirl(img, angleMax){ // angleMax in radians, swirl amount around center
  const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{
    const w=tmp.naturalWidth, h=tmp.naturalHeight; const cx=w/2, cy=h/2; const radius = Math.min(cx,cy);
    const src = document.createElement('canvas'); src.width=w; src.height=h; const sctx = src.getContext('2d'); sctx.drawImage(tmp,0,0);
    const dst = document.createElement('canvas'); dst.width=w; dst.height=h; const dctx = dst.getContext('2d'); const srcData = sctx.getImageData(0,0,w,h); const dstData = dctx.createImageData(w,h);
    const sd = srcData.data, dd = dstData.data;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const dx = x - cx, dy = y - cy; const r = Math.sqrt(dx*dx + dy*dy);
        const rn = r / radius; let theta = Math.atan2(dy, dx);
        const twist = angleMax * (1 - rn); // stronger near center
        const sth = theta + twist;
        const sx = Math.round(cx + r * Math.cos(sth)); const sy = Math.round(cy + r * Math.sin(sth));
        const di = (y*w + x)*4; const si = (Math.max(0, Math.min(h-1, sy))*w + Math.max(0, Math.min(w-1, sx)))*4;
        dd[di]=sd[si]; dd[di+1]=sd[si+1]; dd[di+2]=sd[si+2]; dd[di+3]=sd[si+3];
      }
    }
    dctx.putImageData(dstData,0,0); img.src = dst.toDataURL();
  }; tmp.onerror = ()=>{}; tmp.src = img.dataset.originalSrc || img.src;
}

function applySelectiveSaturation(img, targetHex, deltaPercent, tolerance=30){
  const target = hexToRgb(targetHex);
  if(!target) return;
  const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{
    const w=tmp.naturalWidth, h=tmp.naturalHeight; const c = document.createElement('canvas'); c.width=w; c.height=h; const ctx = c.getContext('2d'); ctx.drawImage(tmp,0,0);
    try{
      const imgd = ctx.getImageData(0,0,w,h); const d = imgd.data;
      for(let i=0;i<d.length;i+=4){ const r=d[i], g=d[i+1], b=d[i+2]; const dist = colorDist(r,g,b,target.r,target.g,target.b); if(dist <= tolerance){ // convert to HSL, adjust saturation
          const hsl = rgbToHsl(r,g,b);
          if(deltaPercent <= -99){ // remove color -> set alpha 0
            d[i+3] = 0;
          } else {
            let s = hsl.s * 100; s = clampPercent((s + deltaPercent), 0, 100); const rgb2 = hslToRgb(hsl.h, s/100, hsl.l); d[i]=rgb2.r; d[i+1]=rgb2.g; d[i+2]=rgb2.b;
          }
        }
      }
      ctx.putImageData(imgd,0,0); img.src = c.toDataURL();
    }catch(e){ }
  }; tmp.onerror = ()=>{}; tmp.src = img.dataset.originalSrc || img.src;
}

function clamp(v){ return Math.max(0, Math.min(255, Math.round(v))) }
function clampPercent(v,min,max){ return Math.max(min, Math.min(max, v)); }

function rgbToHsl(r,g,b){ r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0,s=0,l=(max+min)/2; if(max!==min){ const d=max-min; s = l>0.5? d/(2-max-min) : d/(max+min); switch(max){ case r: h = (g-b)/d + (g<b?6:0); break; case g: h = (b-r)/d + 2; break; case b: h = (r-g)/d + 4; break; } h/=6 } return {h:h, s:s, l:l} }

function hslToRgb(h,s,l){ let r,g,b; if(s===0){ r=g=b=l; } else { const hue2rgb = (p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p }; const q = l<0.5 ? l*(1+s) : l + s - l*s; const p = 2*l - q; r = hue2rgb(p,q,h + 1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h - 1/3); } return {r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255)} }

function pixelate(img, pixelSize, src){ // draw from original src to temporary canvas and replace src
  const tmpImg = new Image(); tmpImg.crossOrigin = 'anonymous'; tmpImg.onload = ()=>{
    const w = tmpImg.naturalWidth, h = tmpImg.naturalHeight;
    if(!w || !h){ return }
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmpImg,0,0);
    const temp = document.createElement('canvas'); temp.width = Math.max(1, Math.ceil(w/pixelSize)); temp.height = Math.max(1, Math.ceil(h/pixelSize)); const tctx = temp.getContext('2d'); tctx.imageSmoothingEnabled = false; tctx.drawImage(canvas, 0, 0, temp.width, temp.height);
    ctx.clearRect(0,0,w,h); ctx.imageSmoothingEnabled = false; ctx.drawImage(temp,0,0,w,h);
    try{ img.src = canvas.toDataURL(); }catch(e){}
  };
  tmpImg.onerror = ()=>{};
  tmpImg.src = src || img.src;
}

// Promise-based helpers for chaining effects (operate on arbitrary src -> return dataURL)
function pixelatePromise(src, pixelSize){ return new Promise(res=>{ const tmpImg = new Image(); tmpImg.crossOrigin='anonymous'; tmpImg.onload = ()=>{ const w=tmpImg.naturalWidth, h=tmpImg.naturalHeight; if(!w||!h) return res(src); const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmpImg,0,0); const temp = document.createElement('canvas'); temp.width = Math.max(1, Math.ceil(w/pixelSize)); temp.height = Math.max(1, Math.ceil(h/pixelSize)); const tctx = temp.getContext('2d'); tctx.imageSmoothingEnabled = false; tctx.drawImage(canvas, 0, 0, temp.width, temp.height); ctx.clearRect(0,0,w,h); ctx.imageSmoothingEnabled = false; ctx.drawImage(temp,0,0,w,h); try{ res(canvas.toDataURL()); }catch(e){ res(src); } }; tmpImg.onerror = ()=> res(src); tmpImg.src = src; }); }

function fisheyePromise(src, strength){ return new Promise(res=>{ const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{ const w=tmp.naturalWidth, h=tmp.naturalHeight; const cx=w/2, cy=h/2; const radius = Math.min(cx,cy); const sCanvas = document.createElement('canvas'); sCanvas.width=w; sCanvas.height=h; const sctx = sCanvas.getContext('2d'); sctx.drawImage(tmp,0,0); const dst = document.createElement('canvas'); dst.width=w; dst.height=h; const dctx = dst.getContext('2d'); const srcData = sctx.getImageData(0,0,w,h); const dstData = dctx.createImageData(w,h); const sd = srcData.data, dd = dstData.data; for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const nx = (x - cx)/radius; const ny = (y - cy)/radius; const r = Math.sqrt(nx*nx + ny*ny); let theta = Math.atan2(ny,nx); let rn = r; if(r>0 && r<=1){ rn = Math.pow(r, 1 - strength*0.8); } const sx = Math.round(cx + rn*radius*Math.cos(theta)); const sy = Math.round(cy + rn*radius*Math.sin(theta)); const di = (y*w + x)*4; const si = (Math.max(0, Math.min(h-1, sy))*w + Math.max(0, Math.min(w-1, sx)))*4; dd[di]=sd[si]; dd[di+1]=sd[si+1]; dd[di+2]=sd[si+2]; dd[di+3]=sd[si+3]; } } dctx.putImageData(dstData,0,0); try{ res(dst.toDataURL()); }catch(e){ res(src); } }; tmp.onerror = ()=> res(src); tmp.src = src; }); }

function swirlPromise(src, angleMax){ return new Promise(res=>{ const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{ const w=tmp.naturalWidth, h=tmp.naturalHeight; const cx=w/2, cy=h/2; const radius = Math.min(cx,cy); const sCanvas = document.createElement('canvas'); sCanvas.width=w; sCanvas.height=h; const sctx = sCanvas.getContext('2d'); sctx.drawImage(tmp,0,0); const dst = document.createElement('canvas'); dst.width=w; dst.height=h; const dctx = dst.getContext('2d'); const srcData = sctx.getImageData(0,0,w,h); const dstData = dctx.createImageData(w,h); const sd = srcData.data, dd = dstData.data; for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const dx = x - cx, dy = y - cy; const r = Math.sqrt(dx*dx + dy*dy); const rn = r / radius; let theta = Math.atan2(dy, dx); const twist = angleMax * (1 - rn); const sth = theta + twist; const sx = Math.round(cx + r * Math.cos(sth)); const sy = Math.round(cy + r * Math.sin(sth)); const di = (y*w + x)*4; const si = (Math.max(0, Math.min(h-1, sy))*w + Math.max(0, Math.min(w-1, sx)))*4; dd[di]=sd[si]; dd[di+1]=sd[si+1]; dd[di+2]=sd[si+2]; dd[di+3]=sd[si+3]; } } dctx.putImageData(dstData,0,0); try{ res(dst.toDataURL()); }catch(e){ res(src); } }; tmp.onerror = ()=> res(src); tmp.src = src; }); }

function selectivePromise(src, targetHex, deltaPercent, tolerance=30){ return new Promise(res=>{ const target = hexToRgb(targetHex); if(!target) return res(src); const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{ const w=tmp.naturalWidth, h=tmp.naturalHeight; const c = document.createElement('canvas'); c.width=w; c.height=h; const ctx = c.getContext('2d'); ctx.drawImage(tmp,0,0); try{ const imgd = ctx.getImageData(0,0,w,h); const d = imgd.data; for(let i=0;i<d.length;i+=4){ const r=d[i], g=d[i+1], b=d[i+2]; const dist = colorDist(r,g,b,target.r,target.g,target.b); if(dist <= tolerance){ const hsl = rgbToHsl(r,g,b); if(deltaPercent <= -99){ d[i+3] = 0; } else { let s = hsl.s * 100; s = clampPercent((s + deltaPercent), 0, 100); const rgb2 = hslToRgb(hsl.h, s/100, hsl.l); d[i]=rgb2.r; d[i+1]=rgb2.g; d[i+2]=rgb2.b; } } } ctx.putImageData(imgd,0,0); try{ res(c.toDataURL()); }catch(e){ res(src); } }catch(e){ res(src); } }; tmp.onerror = ()=> res(src); tmp.src = src; }); }

function bakeCssFiltersToDataUrl(src, cssFilters){ // draw image and apply ctx.filter then return dataURL
  return new Promise(res=>{ const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{ const w=tmp.naturalWidth, h=tmp.naturalHeight; const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d'); try{ ctx.filter = cssFilters.join(' '); ctx.drawImage(tmp,0,0); ctx.filter = 'none'; res(c.toDataURL()); }catch(e){ // fallback
        const c2=document.createElement('canvas'); c2.width=w; c2.height=h; c2.getContext('2d').drawImage(tmp,0,0); try{ res(c2.toDataURL()); }catch(e){ res(src); } }
  }; tmp.onerror = ()=> res(src); tmp.src = src; }); }

function removeGreenFromSelected(){ if(!state.selected) return; const el=state.selected; const img = el.querySelector('img'); if(!img) return; const canvas = document.createElement('canvas'); const w=img.naturalWidth, h=img.naturalHeight; canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0); const data=ctx.getImageData(0,0,w,h); for(let i=0;i<data.data.length;i+=4){ const r=data.data[i], g=data.data[i+1], b=data.data[i+2]; if(g>100 && g>r*1.2 && g>b*1.2){ data.data[i+3]=0 } } ctx.putImageData(data,0,0); img.src = canvas.toDataURL(); }

function removeColorFromSelectedHex(hex, tol=30){ if(!state.selected) return; const el=state.selected; const img = el.querySelector && el.querySelector('img'); if(!img) return; const rgb = hexToRgb(hex); if(!rgb) return; const canvas = document.createElement('canvas'); const w=img.naturalWidth, h=img.naturalHeight; canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0); const data=ctx.getImageData(0,0,w,h); for(let i=0;i<data.data.length;i+=4){ const r=data.data[i], g=data.data[i+1], b=data.data[i+2]; const d = colorDist(r,g,b,rgb.r,rgb.g,rgb.b); if(d <= tol){ data.data[i+3]=0 } } ctx.putImageData(data,0,0); img.src = canvas.toDataURL(); }

function hexToRgb(hex){ if(!hex) return null; const h = hex.replace('#',''); if(h.length===3){ return {r:parseInt(h[0]+h[0],16), g:parseInt(h[1]+h[1],16), b:parseInt(h[2]+h[2],16)} } if(h.length===6){ return {r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16)} } return null }
function colorDist(r1,g1,b1,r2,g2,b2){ return Math.sqrt((r1-r2)*(r1-r2) + (g1-g2)*(g1-g2) + (b1-b2)*(b1-b2)) }

// --- Library ---
const samples = [
  {name:'Star', src:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><polygon points="128,10 158,98 250,98 174,150 200,238 128,186 56,238 82,150 6,98 98,98" fill="%23ffd54a"/></svg>'},
  {name:'Check', src:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="120" fill="%2307a"/><path d="M80 135l30 30 70-100" stroke="white" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'},
  {name:'Heart', src:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M128 220s-86-54-86-110c0-30 24-54 54-54 20 0 38 11 44 27 6-16 24-27 44-27 30 0 54 24 54 54 0 56-86 110-86 110z" fill="%23ff6b6b"/></svg>'},
  {name:'Play', src:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><polygon points="90,64 200,128 90,192" fill="%2307a"/></svg>'}
];

function _loadLibrary(){
  try{
    const raw = localStorage.getItem('picsedit_library');
    if(raw){
      const arr = JSON.parse(raw);
      if(Array.isArray(arr) && arr.length){
        samples.length = 0;
        arr.forEach(s=> samples.push(s));
      }
    }
  }catch(e){}
}

function _saveLibrary(){
  try{ localStorage.setItem('picsedit_library', JSON.stringify(samples)); }catch(e){}
}

function renderLibrary(filter){ const lib = qs('#library'); lib.innerHTML=''; const q = (filter||'').toLowerCase(); for(const s of samples){ if(q && s.name.toLowerCase().indexOf(q)===-1) continue; const img = document.createElement('img'); img.src = s.src; img.title = s.name; img.addEventListener('click', ()=> addImageElement(s.src)); lib.appendChild(img) } }

// --- Events wiring ---
document.addEventListener('DOMContentLoaded', ()=>{
  makeStars(); _loadLibrary(); renderLibrary();
  // migrate any old storage keys from previous PhotoCat naming
  try{ migrateOldStorageKeys(); }catch(e){}
  // load saved settings (theme, lang)
  const saved = loadSettings();
  if(saved && saved.theme){ document.body.classList.toggle('theme-light', saved.theme === 'light'); const ts = qs('#theme-select'); if(ts) ts.value = saved.theme; }
  if(saved && saved.lang){ state.lang = saved.lang; const ls = qs('#lang-select'); if(ls) ls.value = saved.lang; }
  if(saved && saved.lang){ if(typeof translateUI === 'function') try{ translateUI(saved.lang); }catch(e){} }
  // restore preferred menu music
  if(saved && saved.menuMusic){ const sel = qs('#menu-music-select'); if(sel) sel.value = saved.menuMusic; }
  // ensure main menu is shown on load and workspace hidden
  showMainMenu();
  // menu
  qs('#btn-new').addEventListener('click', ()=> showModal('#modal-new',true));
  qs('#btn-settings').addEventListener('click', ()=> showModal('#modal-settings',true));
  // immediate language switch in settings select
  const langSelect = qs('#lang-select'); if(langSelect){ langSelect.addEventListener('change', (e)=>{ const v = e.target.value; if(v === 'en') translateUI('en'); else if(v === 'ru') translateUI('ru'); }); }
  qs('#btn-support').addEventListener('click', ()=> window.open('https://www.donationalerts.com/r/vaniachess','_blank'));
  // main menu extra buttons
  const btnSamplesMain = qs('#btn-samples-main'); if(btnSamplesMain){ btnSamplesMain.addEventListener('click', ()=>{ showWorkspace(); qs('#right-panel').classList.remove('hidden'); setTimeout(()=>{ const lib = qs('#library'); if(lib) lib.scrollIntoView({behavior:'smooth', block:'start'}); }, 120); }); }
  const btnLibraryMain = qs('#btn-library-main'); if(btnLibraryMain){ btnLibraryMain.addEventListener('click', ()=>{ showWorkspace(); qs('#right-panel').classList.remove('hidden'); }); }
  const btnTutorial = qs('#btn-tutorial'); if(btnTutorial){ btnTutorial.addEventListener('click', ()=>{ showModal('#modal-tutorial', true); }); }
  const btnDemos = qs('#btn-demos'); if(btnDemos){ btnDemos.addEventListener('click', ()=>{ alert('Демо-проекты временно недоступны'); }); }

  // menu music controls
  const menuMusicSelect = qs('#menu-music-select'); const menuMusicToggle = qs('#menu-music-toggle');
  const bg = qs('#bg-music');
  function setBgToSelectedTrack(){ if(!bg) return; const sel = qs('#menu-music-select'); const v = sel ? sel.value : (bg.src || ''); if(v) { try{ if(bg.src.indexOf(v)===-1) bg.src = v; }catch(e){} } }
  if(menuMusicSelect){ menuMusicSelect.addEventListener('change', (e)=>{ const v=e.target.value; saveSettings({menuMusic:v}); setBgToSelectedTrack(); if(bg && !bg.paused){ bg.play().catch(()=>{}); } }); }
  if(menuMusicToggle){ menuMusicToggle.addEventListener('click', ()=>{ if(!bg) return; if(bg.paused){ setBgToSelectedTrack(); startMusic(); menuMusicToggle.textContent='⏸'; } else { stopMusic(); menuMusicToggle.textContent='▶'; } }); }
  // advance to next track when current ends
  if(bg){ bg.addEventListener('ended', ()=>{
    try{
      const selEl = qs('#menu-music-select');
      let tracks = [];
      if(selEl){ tracks = Array.from(selEl.options).map(o=>o.value); }
      if(!tracks.length) tracks = MUSIC_TRACKS.slice();
      if(!tracks.length) return;
      const curSrc = (bg.getAttribute('src')||bg.src||'').toString();
      // find current index by matching filename or option value
      const curName = curSrc.split('/').pop();
      let idx = tracks.findIndex(t => curSrc.indexOf(t) !== -1 || t === curName);
      if(idx === -1) idx = 0;
      const next = (idx + 1) % tracks.length;
      const nextTrack = tracks[next];
      if(selEl) selEl.value = nextTrack;
      saveSettings({menuMusic: nextTrack});
      try{ bg.src = nextTrack; bg.play().catch(()=>{}); }catch(e){}
    }catch(e){ console.error('music ended handler failed', e) }
  }); }
  qs('#create-project').addEventListener('click', ()=>{
    const name = (qs('#new-name').value || '').trim() || 'Без имени';
    let w = parseInt(qs('#new-width').value);
    let h = parseInt(qs('#new-height').value);
    if(!Number.isFinite(w) || w <= 0) w = 1024;
    if(!Number.isFinite(h) || h <= 0) h = 768;
    createProject(name, w, h);
    startAmbient();
  });
  qsa('.modal-close').forEach(b=>b.addEventListener('click', ()=>{ qsa('.modal').forEach(m=>m.classList.remove('show')) }));
  // workspace
  qs('#file-image').addEventListener('change', (ev)=>{ const f=ev.target.files[0]; if(!f){ ev.target.value=''; return } const reader=new FileReader(); reader.onload = e=>{ addImageElement(e.target.result); if(addToLibraryNext){ samples.push({name: f.name || 'Custom', src: e.target.result}); _saveLibrary(); renderLibrary(); addToLibraryNext = false } }; reader.readAsDataURL(f); ev.target.value=''; });
  // samples button: focus library panel
  const samplesBtn = qs('#btn-samples'); if(samplesBtn){ samplesBtn.addEventListener('click', ()=>{ const lib = qs('#library'); if(lib){ lib.scrollIntoView({behavior:'smooth', block:'start'}); qs('#right-panel').classList.remove('hidden'); } }); }
  // GitHub links (main menu and workspace)
  const gh1 = qs('#btn-github'); const gh2 = qs('#btn-github-main');
  [gh1, gh2].forEach(b => { if(b) b.addEventListener('click', ()=>{ window.open(GITHUB_URL, '_blank'); }) });
  // add-to-library button: open file picker and mark next file to be added to library
  const addToLibBtn = qs('#btn-add-to-library'); if(addToLibBtn){ addToLibBtn.addEventListener('click', ()=>{ addToLibraryNext = true; const f = qs('#file-image'); if(f) f.click(); }) }
  qs('#btn-add-text').addEventListener('click', addText);
  const effectsSel = qs('#effects-select'); const effectsStrength = qs('#effect-strength');
  // support multiple selected effects
  async function applyEffectsToSelected(){
    if(!state.selected) return; const el = state.selected; const img = el.querySelector && el.querySelector('img'); const s = Number(effectsStrength?effectsStrength.value:50) || 50;
    if(!img) return;
    const opts = Array.from(effectsSel.selectedOptions).map(o=>o.value).filter(v=>v && v!=='none');
    // build CSS-filter part
    const cssFilters = [];
    if(opts.includes('blur')) cssFilters.push(`blur(${(s/100)*20}px)`);
    if(opts.includes('grayscale')) cssFilters.push(`grayscale(${s/100})`);
    if(opts.includes('invert')) cssFilters.push(`invert(${s/100})`);
    if(opts.includes('brightness')) cssFilters.push(`brightness(${1 + (s-50)/50})`);

    // canvas-based effects sequence
    const canvasEffects = opts.filter(v=> ['pixelate','fisheye','swirl','selective-sat','selective-remove'].includes(v));

    try{
      if(canvasEffects.length===0){ // only css filters
        img.style.filter = cssFilters.join(' ') || 'none';
        // ensure non-destructive src reset to original if no canvas ops
        if(img.dataset.originalSrc) img.src = img.dataset.originalSrc;
        try{ markDirty(); }catch(e){}
        return;
      }
      // when there are canvas effects, start from original source
      let currentSrc = img.dataset.originalSrc || img.src;
      // clear CSS filters - we will bake them if selected: apply cssFilters first by drawing onto canvas
      if(cssFilters.length>0){ // bake css filters into an initial canvas
        currentSrc = await bakeCssFiltersToDataUrl(currentSrc, cssFilters);
      }
      // apply canvas effects sequentially
      for(const ce of canvasEffects){
        if(ce==='pixelate'){
          const px = Math.max(1, Math.round(1 + (s/100)*50)); currentSrc = await pixelatePromise(currentSrc, px);
        } else if(ce==='fisheye'){
          const str = Math.max(0, (s/100)); currentSrc = await fisheyePromise(currentSrc, str);
        } else if(ce==='swirl'){
          const ang = (s/100)*3.14; currentSrc = await swirlPromise(currentSrc, ang);
        } else if(ce==='selective-sat'){
          const hex = qs('#selective-color') ? qs('#selective-color').value : '#ff0000'; const tol = Number(qs('#selective-tolerance')?qs('#selective-tolerance').value:30); currentSrc = await selectivePromise(currentSrc, hex, s-50, tol);
        } else if(ce==='selective-remove'){
          const hex = qs('#selective-color') ? qs('#selective-color').value : '#00ff00'; const tol = Number(qs('#selective-tolerance')?qs('#selective-tolerance').value:40); currentSrc = await selectivePromise(currentSrc, hex, -100, tol);
        }
      }
      img.style.filter = 'none'; img.src = currentSrc;
      try{ markDirty(); }catch(e){}
    }catch(e){ console.error('Error applying effects', e); }
  }
  if(effectsSel){ effectsSel.addEventListener('change', applyEffectsToSelected); }
  if(effectsStrength){ effectsStrength.addEventListener('input', ()=>{ applyEffectsToSelected(); }); }
  // reapply selective color changes when user changes color/tolerance
  const selColor = qs('#selective-color'); const selTol = qs('#selective-tolerance');
  if(selColor){ selColor.addEventListener('input', ()=> applyEffectsToSelected()); }
  if(selTol){ selTol.addEventListener('change', ()=> applyEffectsToSelected()); }
  qs('#btn-remove-green').addEventListener('click', removeGreenFromSelected);
  // wire pipette/remove color controls (if added in DOM)
  const pipBtn = qs('#btn-pipette'); if(pipBtn){ pipBtn.addEventListener('click', ()=> startPickColorMode()) }
  const removeColorInput = qs('#remove-color'); const removeTol = qs('#remove-tolerance');
  const removeColorBtn = qs('#btn-remove-color'); if(removeColorBtn){ removeColorBtn.addEventListener('click', ()=>{ const hex = removeColorInput ? removeColorInput.value : '#00ff00'; const tol = removeTol ? Number(removeTol.value)||30 : 30; removeColorFromSelectedHex(hex, tol); }) }
  qs('#btn-hotkeys').addEventListener('click', ()=> showModal('#modal-hotkeys',true));
  // back to main menu with unsaved-project check
  const attemptShowMainMenu = ()=>{
    if(state.project && state.project.dirty){
      const doSave = confirm('Проект не сохранён. Сохранить в локальные сохранения сейчас? Нажмите "Отмена" чтобы выйти без сохранения.');
      if(doSave){ saveProject(state.project.name || ('project-'+Date.now())); alert('Проект сохранён'); }
    }
    stopAmbient(); qs('#workspace').classList.add('hidden'); qs('#main-menu').classList.remove('hidden');
  };
  qs('#btn-back').addEventListener('click', attemptShowMainMenu);
  // main menu 'Открыть проект' should prompt for a .json file selection
  const mainOpen = qs('#main-open-file');
  if(mainOpen){ mainOpen.addEventListener('change', (ev)=>{ const f = ev.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = e=>{ try{ const data = JSON.parse(e.target.result); loadProjectFromObject(data); showWorkspace(); }catch(err){ alert('Неверный файл проекта'); } }; reader.readAsText(f); mainOpen.value=''; }); }
  qs('#btn-open').addEventListener('click', ()=>{ const m = qs('#main-open-file'); if(m) m.click(); else { renderOpenList(); showModal('#modal-open', true); } });
  // settings
  qs('#save-settings').addEventListener('click', ()=>{
    const theme = qs('#theme-select').value; const lang = qs('#lang-select') ? qs('#lang-select').value : 'ru';
    document.body.classList.toggle('theme-light', theme==='light');
    // persist settings
    saveSettings({ theme: theme, lang: lang });
    // update state
    state.lang = lang;
    qs('#modal-settings').classList.remove('show');
    // if there's a translate function, call it
    if(typeof translateUI === 'function') try{ translateUI(lang); }catch(e){}
  });
  // library export/import handlers
  const exportLib = qs('#btn-export-library'); if(exportLib){ exportLib.addEventListener('click', ()=>{ try{ const data = JSON.stringify(samples, null, 2); const blob = new Blob([data], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'picsedit_library.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 10000); }catch(e){ alert('Не удалось экспортировать библиотеку') } }); }
  const importLib = qs('#import-library'); if(importLib){ importLib.addEventListener('change', (ev)=>{ const f = ev.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = e=>{ try{ const arr = JSON.parse(e.target.result); if(!Array.isArray(arr)){ alert('Неверный файл библиотеки'); return } samples.length = 0; arr.forEach(s=> samples.push(s)); _saveLibrary(); renderLibrary(); alert('Библиотека импортирована'); }catch(err){ alert('Неверный файл библиотеки') } }; reader.readAsText(f); importLib.value=''; }); }

  // background music element and toggle
  const bgMusic = qs('#bg-music'); const musicBtn = qs('#btn-music');
  function updateMusicButtonLabel(isPlaying){ try{ const mt = qs('#menu-music-toggle'); if(state.lang === 'en'){ if(musicBtn) musicBtn.textContent = isPlaying ? 'Music ⏸' : 'Music ▶'; if(mt) mt.textContent = isPlaying ? '⏸' : '▶'; } else { if(musicBtn) musicBtn.textContent = isPlaying ? 'Музыка ⏸' : 'Музыка ▶'; if(mt) mt.textContent = isPlaying ? '⏸' : '▶'; } }catch(e){}
  }
  function stopMusic(){ if(!bgMusic) return; try{ bgMusic.pause(); }catch(e){} try{ bgMusic.muted = true; }catch(e){} updateMusicButtonLabel(false); }
  if(musicBtn){ musicBtn.addEventListener('click', ()=>{ if(!bgMusic) return; if(bgMusic.paused){ startMusic(); } else { stopMusic(); } }); }

  // volume control and persist volume
  const volSlider = qs('#music-volume');
  const MUSIC_VOL_KEY = 'picsedit_music_volume';
  function getSavedVolume(){ try{ const v = Number(localStorage.getItem(MUSIC_VOL_KEY)); if(Number.isFinite(v)) return Math.max(0, Math.min(1, v)); }catch(e){} return 0.8 }
  function saveVolume(v){ try{ localStorage.setItem(MUSIC_VOL_KEY, String(v)); }catch(e){} }
  // initialize volume
  const initVol = getSavedVolume(); if(bgMusic) { bgMusic.volume = initVol; bgMusic.muted = true; }
  if(volSlider){ volSlider.value = Math.round(initVol*100); volSlider.addEventListener('input', (e)=>{ const v = Math.max(0, Math.min(100, Number(e.target.value||80)))/100; if(bgMusic){ bgMusic.volume = v; bgMusic.muted = false } saveVolume(v); }); }
  // adjust start/stop to mute when stopped to avoid residual noise
  function startMusic(){ if(!bgMusic) return; bgMusic.muted = false; const vol = getSavedVolume(); bgMusic.volume = vol; bgMusic.play().then(()=>{ updateMusicButtonLabel(true); }).catch(()=>{ updateMusicButtonLabel(false); }); }
  function stopMusic(){ if(!bgMusic) return; try{ bgMusic.pause(); }catch(e){} try{ bgMusic.muted = true; }catch(e){} updateMusicButtonLabel(false); }
  // save button
  const saveBtn = qs('#btn-save'); if(saveBtn){ saveBtn.addEventListener('click', ()=>{ if(!state.project){ alert('Нет открытого проекта'); return } saveProject(state.project.name || ('project-'+Date.now())); alert('Проект сохранён'); }) }
  // scene toolbar bindings
  const tb = (id,fn)=>{ const b=qs(id); if(b) b.addEventListener('click',fn) };
  // zoom controls
  tb('#tb-zoom-in', ()=> zoomScene(1.15));
  tb('#tb-zoom-out', ()=> zoomScene(1/1.15));
  tb('#tb-zoom-reset', ()=> setSceneScale(1));
  // toolbar add image should open file picker
  tb('#tb-add-image', ()=>{ const f = qs('#file-image'); if(f) f.click(); });
  // zoom initial
  setSceneScale(1);
  tb('#tb-export', exportPNG);
  tb('#tb-delete', ()=>{ deleteSelected() });
  tb('#tb-duplicate', ()=>{ duplicateSelected() });
  tb('#tb-rotate-left', ()=>{ rotateSelected(-15) });
  tb('#tb-rotate-right', ()=>{ rotateSelected(15) });
  tb('#tb-flip', ()=>{ flipSelected() });
  tb('#tb-front', ()=>{ bringForward() });
  tb('#tb-back', ()=>{ sendBackward() });
  // font controls apply to selected object (bold/italic/stroke/shadow + image box-shadow)
  const applyFontToSelected = ()=>{
    const sel = state.selected; if(!sel) return;
    const custom = qs('#font-custom') && qs('#font-custom').value.trim(); const font = custom || qs('#font-select').value || 'Arial';
    sel.style.fontFamily = (font && font.indexOf(' ')>=0) ? '"'+font+'"' : font;
    sel.style.fontSize = (qs('#font-size')? qs('#font-size').value : 32)+'px';
    sel.style.color = qs('#font-color') ? qs('#font-color').value : '#ffffff';
    // bold / italic
    const bold = qs('#font-bold') && qs('#font-bold').checked; const italic = qs('#font-italic') && qs('#font-italic').checked;
    sel.style.fontWeight = bold ? '700' : '400'; sel.style.fontStyle = italic ? 'italic' : 'normal';
    // stroke
    const strokeColor = qs('#font-stroke-color') ? qs('#font-stroke-color').value : '#000000';
    const strokeWidth = qs('#font-stroke-width') ? Number(qs('#font-stroke-width').value)||0 : 0;
    if(strokeWidth>0){ sel.style.webkitTextStroke = strokeWidth+'px '+strokeColor; } else { sel.style.webkitTextStroke = '0px transparent'; }
    // shadow
    const shColor = qs('#font-shadow-color') ? qs('#font-shadow-color').value : 'rgba(0,0,0,0)';
    const shX = qs('#font-shadow-x') ? Number(qs('#font-shadow-x').value)||0 : 0;
    const shY = qs('#font-shadow-y') ? Number(qs('#font-shadow-y').value)||0 : 0;
    const shBlur = qs('#font-shadow-blur') ? Number(qs('#font-shadow-blur').value)||0 : 0;
    sel.style.textShadow = `${shX}px ${shY}px ${shBlur}px ${shColor}`;
    // also allow images to have box-shadow via same controls
    const img = sel.querySelector && sel.querySelector('img');
    if(img){ sel.style.boxShadow = `${shX}px ${shY}px ${shBlur}px ${shColor}`; }
    try{ markDirty(); }catch(e){}
  }
  const fontInputs = ['#font-select','#font-size','#font-color','#font-custom','#font-bold','#font-italic','#font-stroke-color','#font-stroke-width','#font-shadow-color','#font-shadow-x','#font-shadow-y','#font-shadow-blur']; fontInputs.forEach(id=>{ const el=qs(id); if(el) el.addEventListener('change', applyFontToSelected) });
  // selection click outside
  qs('#scene').addEventListener('pointerdown',(ev)=>{ if(ev.target===qs('#scene')) updateSelection(); if(ev.target.closest('.scene-object')){ selectObject(ev.target.closest('.scene-object')) } });
  // import/export project file handlers
  const exportProjBtn = qs('#btn-export-project'); if(exportProjBtn){ exportProjBtn.addEventListener('click', ()=> exportProjectToFile()) }
  const importInput = qs('#import-project'); if(importInput){ importInput.addEventListener('change', (ev)=>{ const f=ev.target.files[0]; if(!f) return; const reader=new FileReader(); reader.onload = e=>{ try{ const data = JSON.parse(e.target.result); loadProjectFromObject(data); showModal('#modal-open', false); }catch(err){ alert('Неверный файл проекта') } }; reader.readAsText(f); importInput.value=''; }); }
  // wire second library button
  const samplesBtn2 = qs('#btn-samples-2'); if(samplesBtn2){ samplesBtn2.addEventListener('click', ()=>{ const lib = qs('#library'); if(lib){ lib.scrollIntoView({behavior:'smooth', block:'start'}); qs('#right-panel').classList.remove('hidden'); } }); }
  // library filter input
  const libFilter = qs('#library-filter'); if(libFilter){ libFilter.addEventListener('input', (e)=> renderLibrary(e.target.value)); }
  // keyboard
  window.addEventListener('keydown',(e)=>{ if(e.key==='Delete' && state.selected){ state.selected.remove(); state.selected=null } if(e.ctrlKey && e.key.toLowerCase()==='s'){ e.preventDefault(); exportPNG() } });
});

// ensure music plays/stops when switching menus
function showWorkspace(){ const mm = qs('#main-menu'); const ws = qs('#workspace'); if(mm) mm.classList.add('hidden'); if(ws) ws.classList.remove('hidden'); startAmbient(); // ambient synth
  // try to start track too
  const bg = qs('#bg-music'); if(bg){ bg.play().catch(()=>{}); const btn = qs('#btn-music'); if(btn) { if(state.lang === 'en') btn.textContent = bg.paused ? 'Music ▶' : 'Music ⏸'; else btn.textContent = bg.paused ? 'Музыка ▶' : 'Музыка ⏸'; } }
}

function showMainMenu(){
  // ensure the main menu is visible and workspace hidden
  const mm = qs('#main-menu'); const ws = qs('#workspace');
  if(mm) mm.classList.remove('hidden');
  if(ws) ws.classList.add('hidden');
  stopAmbient(); // stop ambient synth
  const bg = qs('#bg-music');
  if(!bg) return;
  try{
    const sel = qs('#menu-music-select');
    const track = sel ? sel.value : '';
    if(track){ if(!bg.src || bg.src.indexOf(track) === -1) bg.src = track; }
    bg.muted = false;
    bg.play().then(()=>{
      const mt = qs('#menu-music-toggle'); if(mt) mt.textContent = '⏸';
      const btn = qs('#btn-music'); if(btn) { if(state.lang === 'en') btn.textContent = 'Music ⏸'; else btn.textContent = 'Музыка ⏸'; }
    }).catch(()=>{
      const mt = qs('#menu-music-toggle'); if(mt) mt.textContent = '▶';
      const btn = qs('#btn-music'); if(btn) { if(state.lang === 'en') btn.textContent = 'Music ▶'; else btn.textContent = 'Музыка ▶'; }
    });
  }catch(e){
    try{ bg.pause(); bg.muted = true; }catch(e){}
  }
}

// --- Scene toolbar actions ---
function rotateSelected(delta){ if(!state.selected) return; const el=state.selected; const cur = parseFloat(el.dataset.rotation||'0'); el.dataset.rotation = (cur+delta).toString(); applyTransformToElement(el); try{ markDirty(); }catch(e){} }
function flipSelected(){ if(!state.selected) return; const el=state.selected; const cur = parseFloat(el.dataset.scaleX||'1'); el.dataset.scaleX = (cur * -1).toString(); applyTransformToElement(el); try{ markDirty(); }catch(e){} }
function duplicateSelected(){ if(!state.selected) return; const orig = state.selected; const clone = orig.cloneNode(true); clone.style.left = (parseFloat(orig.style.left||0)+20)+'px'; clone.style.top = (parseFloat(orig.style.top||0)+20)+'px'; orig.parentNode.appendChild(clone); _initObjectTransforms(clone); makeInteractive(clone); selectObject(clone); try{ markDirty(); }catch(e){} }
function bringForward(){ if(!state.selected) return; const el=state.selected; const parent = el.parentNode; parent.appendChild(el); try{ markDirty(); }catch(e){} }
function sendBackward(){ if(!state.selected) return; const el=state.selected; const parent = el.parentNode; const prev = el.previousElementSibling; if(prev) parent.insertBefore(el, prev); try{ markDirty(); }catch(e){} }
function deleteSelected(){ if(!state.selected) return; state.selected.remove(); state.selected=null; try{ markDirty(); }catch(e){} }

// --- Export ---
function exportPNG(){
  const scene = qs('#scene');
  if(!state.project){ alert('Нет проекта для экспорта'); return }
  const w = parseInt(state.project.w) || 1024;
  const h = parseInt(state.project.h) || 768;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // draw background
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);

  const objs = Array.from(qsa('.scene-object'));
  const drawPromises = objs.map(o => {
    return new Promise(resolve => {
      const style = window.getComputedStyle(o);
      const x = parseFloat(o.style.left) || 0;
      const y = parseFloat(o.style.top) || 0;
      const rw = parseFloat(o.style.width) || o.offsetWidth || 100;
      const rh = parseFloat(o.style.height) || o.offsetHeight || 100;
      const rotationRad = (parseFloat(o.dataset.rotation||'0') || 0) * Math.PI/180;
      const scaleX = parseFloat(o.dataset.scaleX||'1') || 1;

      const img = o.querySelector('img');
      if(img){
        const tmp = new Image(); tmp.crossOrigin = 'anonymous';
        tmp.onload = ()=>{
          try{
            ctx.save();
            // opacity
            const imgStyle = window.getComputedStyle(img);
            ctx.globalAlpha = parseFloat(imgStyle.opacity || style.opacity || 1);
            // transform around center
            const cx = x + rw/2;
            const cy = y + rh/2;
            ctx.translate(cx, cy);
            ctx.rotate(rotationRad);
            ctx.scale(scaleX, 1);
            // try to apply CSS filter string to canvas if supported
            const filterStr = (img.style.filter || imgStyle.filter || '').trim();
            try{ ctx.filter = filterStr || 'none'; }catch(e){ ctx.filter = 'none'; }
            // draw image centered
            const drawW = rw, drawH = rh;
            // prefer original unmodified source when possible
            const srcToUse = img.dataset.originalSrc || img.src;
            // if the image element is already a dataURL (pixelated/chroma-keyed), using img.src is fine
            ctx.drawImage(tmp, -drawW/2, -drawH/2, drawW, drawH);
            // reset
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            ctx.restore();
          }catch(e){}
          resolve();
        };
        tmp.onerror = ()=> resolve();
        // load appropriate source (use originalSrc to avoid double-processing where possible)
        tmp.src = img.dataset.originalSrc || img.src;
      } else {
        // text drawing
        const text = o.textContent || '';
        const cx = x + rw/2;
        const cy = y + rh/2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotationRad);
        ctx.scale(scaleX, 1);
        // text style
        const color = style.color || '#fff';
        const fontSize = style.fontSize || '32px';
        // build font string
        let fontParts = [];
        if(style.fontStyle && style.fontStyle !== 'normal') fontParts.push(style.fontStyle);
        if(style.fontWeight && style.fontWeight !== '400' && style.fontWeight !== 'normal') fontParts.push(style.fontWeight);
        fontParts.push(fontSize);
        fontParts.push(style.fontFamily || 'Arial');
        ctx.font = fontParts.join(' ');
        ctx.textBaseline = 'top';
        ctx.fillStyle = color;
        // shadow (try to parse computed textShadow)
        const textShadow = style.textShadow || '';
        if(textShadow && textShadow !== 'none'){
          const parts = textShadow.split(/\s+/);
          if(parts.length >= 4){
            ctx.shadowOffsetX = parseFloat(parts[0])||0;
            ctx.shadowOffsetY = parseFloat(parts[1])||0;
            ctx.shadowBlur = parseFloat(parts[2])||0;
            ctx.shadowColor = parts.slice(3).join(' ');
          }
        }
        // stroke (try vendor property)
        let strokeWidth = 0;
        try{ strokeWidth = parseFloat(style.webkitTextStrokeWidth || '0') || 0 }catch(e){ strokeWidth = 0 }
        if(strokeWidth > 0){ ctx.lineWidth = strokeWidth; ctx.strokeStyle = style.webkitTextStrokeColor || '#000'; ctx.strokeText(text, -rw/2, -rh/2); }
        // multi-line support
        const lines = text.split('\n');
        const sizePx = parseFloat(fontSize)||32;
        const lineHeight = sizePx * 1.2;
        for(let i=0;i<lines.length;i++){
          ctx.fillText(lines[i], -rw/2, -rh/2 + i*lineHeight);
        }
        ctx.restore();
        resolve();
      }
    })
  });

  Promise.all(drawPromises).then(()=>{
      const a = document.createElement('a'); a.download = (state.project.name||'picsedit')+'.png'; a.href = canvas.toDataURL(); a.click();
  });
}

// --- Projects storage (localStorage) ---
function _getSavedProjects(){ try{ return JSON.parse(localStorage.getItem('picsedit_projects')||'{}') }catch(e){ return {} } }
function _saveProjectsMap(map){ localStorage.setItem('picsedit_projects', JSON.stringify(map)) }

function serializeProject(){ if(!state.project) return null; const p = { name: state.project.name, w: state.project.w, h: state.project.h, created: Date.now(), objects: [] };
  qsa('.scene-object').forEach(o=>{
    const img = o.querySelector('img'); if(img){ p.objects.push({type:'image', src:img.src, left:o.style.left, top:o.style.top, width:o.style.width, height:o.style.height, rotation:o.dataset.rotation||'0', scaleX:o.dataset.scaleX||'1', boxShadow: o.style.boxShadow || ''}) } else {
      const st = window.getComputedStyle(o);
      p.objects.push({type:'text', text:o.textContent, left:o.style.left, top:o.style.top, fontSize: st.fontSize, fontFamily: st.fontFamily, color: st.color, fontWeight: st.fontWeight, fontStyle: st.fontStyle, textShadow: st.textShadow || '', webkitTextStroke: st.webkitTextStroke || '', rotation:o.dataset.rotation||'0', scaleX:o.dataset.scaleX||'1'}) }
  });
  return p;
}

function saveProject(name){ const map = _getSavedProjects(); const ser = serializeProject(); if(!ser) return; ser.name = name; ser.savedAt = Date.now(); map[name] = ser; _saveProjectsMap(map); try{ markSaved(); }catch(e){} }

function renderOpenList(){ const map = _getSavedProjects(); const container = qs('#open-list'); container.innerHTML=''; const keys = Object.keys(map).sort((a,b)=>map[b].savedAt - map[a].savedAt);
  if(keys.length===0){ container.innerHTML = '<p>Нет сохранённых проектов</p>'; return }
  for(const k of keys){ const item = map[k]; const row = document.createElement('div'); row.className='open-row'; row.style.padding='8px 0'; row.innerHTML = `<b>${k}</b> <small style="color:rgba(255,255,255,0.6)">(${new Date(item.savedAt).toLocaleString()})</small>`; const btnLoad = document.createElement('button'); btnLoad.textContent='Загрузить'; btnLoad.style.marginLeft='8px'; btnLoad.addEventListener('click', ()=>{ loadProject(k); showModal('#modal-open', false); }); const btnDelete = document.createElement('button'); btnDelete.textContent='Удалить'; btnDelete.style.marginLeft='6px'; btnDelete.addEventListener('click', ()=>{ const m=_getSavedProjects(); delete m[k]; _saveProjectsMap(m); renderOpenList(); }); row.appendChild(btnLoad); row.appendChild(btnDelete); container.appendChild(row) }
  // clear all
  const clearBtn = qs('#clear-projects'); if(clearBtn){ clearBtn.onclick = ()=>{ if(confirm('Очистить все сохранённые проекты?')){ localStorage.removeItem('picsedit_projects'); renderOpenList(); } } }
}

function loadProject(name){
  const map = _getSavedProjects();
  const p = map[name];
  if(!p){ alert('Проект не найден'); return }
  createProject(p.name, p.w, p.h);
  const scene = qs('#scene');
  scene.innerHTML = '';
  for(const o of p.objects){
    if(o.type === 'image'){
      const el = document.createElement('div'); el.className='scene-object'; el.style.left = o.left; el.style.top = o.top;
      if(o.width) el.style.width = o.width; if(o.height) el.style.height = o.height;
      const img = document.createElement('img'); img.src = o.src; img.draggable = false;
      try{ img.dataset.originalSrc = o.src }catch(e){}
      el.appendChild(img);
      if(o.boxShadow) el.style.boxShadow = o.boxShadow;
      scene.appendChild(el);
      el.dataset.rotation = o.rotation||'0'; el.dataset.scaleX = o.scaleX||'1'; _initObjectTransforms(el); makeInteractive(el);
    } else if(o.type === 'text'){
      const el = document.createElement('div'); el.className='scene-object'; el.contentEditable = true; el.textContent = o.text;
      el.style.left = o.left; el.style.top = o.top; if(o.fontSize) el.style.fontSize = o.fontSize; if(o.fontFamily) el.style.fontFamily = o.fontFamily; if(o.color) el.style.color = o.color;
      el.dataset.rotation = o.rotation||'0'; el.dataset.scaleX = o.scaleX||'1'; scene.appendChild(el); _initObjectTransforms(el); makeInteractive(el);
    }
  }
  state.project = {name:p.name, w:p.w, h:p.h}; qs('#proj-name').textContent = p.name; qs('#proj-res').textContent = `${p.w}×${p.h}`;
  try{ markSaved(); }catch(e){}
}

function exportProjectToFile(){ const ser = serializeProject(); if(!ser){ alert('Нет проекта для экспорта'); return } const blob = new Blob([JSON.stringify(ser, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (ser.name || 'picsedit') + '.json'; a.click(); setTimeout(()=> URL.revokeObjectURL(a.href), 10000); }

function loadProjectFromObject(p){
  if(!p || !p.objects){ alert('Неверный проект'); return }
  createProject(p.name||'Imported', p.w||1024, p.h||768);
  const scene = qs('#scene'); scene.innerHTML = '';
  for(const o of p.objects){
    if(o.type === 'image'){
      const el = document.createElement('div'); el.className='scene-object'; el.style.left = o.left; el.style.top = o.top; if(o.width) el.style.width = o.width; if(o.height) el.style.height = o.height;
      const img = document.createElement('img'); img.src = o.src; img.draggable = false; try{ img.dataset.originalSrc = o.src }catch(e){}
      el.appendChild(img); if(o.boxShadow) el.style.boxShadow = o.boxShadow; scene.appendChild(el); el.dataset.rotation = o.rotation||'0'; el.dataset.scaleX = o.scaleX||'1'; _initObjectTransforms(el); makeInteractive(el);
    } else if(o.type === 'text'){
      const el = document.createElement('div'); el.className='scene-object'; el.contentEditable=true; el.textContent = o.text; el.style.left = o.left; el.style.top = o.top; if(o.fontSize) el.style.fontSize = o.fontSize; if(o.fontFamily) el.style.fontFamily = o.fontFamily; if(o.color) el.style.color = o.color; if(o.fontWeight) el.style.fontWeight = o.fontWeight; if(o.fontStyle) el.style.fontStyle = o.fontStyle; if(o.textShadow) el.style.textShadow = o.textShadow; if(o.webkitTextStroke) el.style.webkitTextStroke = o.webkitTextStroke; el.dataset.rotation = o.rotation||'0'; el.dataset.scaleX = o.scaleX||'1'; scene.appendChild(el); _initObjectTransforms(el); makeInteractive(el);
    }
  }
  state.project = {name:p.name, w:p.w, h:p.h}; qs('#proj-name').textContent = p.name; qs('#proj-res').textContent = `${p.w}×${p.h}`;
  try{ markSaved(); }catch(e){}
}

// --- Context menu & clipboard support ---
let _pc_clipboard = null;
function createContextMenu(){ let cm = qs('.pc-context-menu'); if(cm) return cm; cm = document.createElement('div'); cm.className='pc-context-menu'; document.body.appendChild(cm); return cm }
function hideContextMenu(){ const cm = qs('.pc-context-menu'); if(cm) cm.remove(); }
function showContextMenu(ev, target){ ev.preventDefault(); hideContextMenu(); const cm = createContextMenu(); cm.innerHTML = ''; const addBtn = (txt,fn)=>{ const b=document.createElement('button'); b.textContent = txt; b.addEventListener('click', ()=>{ fn(); hideContextMenu(); }); cm.appendChild(b); };
  addBtn('Удалить', ()=>{ if(target){ target.remove(); if(state.selected===target) state.selected=null; } });
  addBtn('Повернуть влево', ()=>{ if(target){ const cur = parseFloat(target.dataset.rotation||'0'); target.dataset.rotation = (cur-15).toString(); applyTransformToElement(target); }});
  addBtn('Повернуть вправо', ()=>{ if(target){ const cur = parseFloat(target.dataset.rotation||'0'); target.dataset.rotation = (cur+15).toString(); applyTransformToElement(target); }});
  addBtn('Отразить по горизонтали', ()=>{ if(target){ const cur = parseFloat(target.dataset.scaleX||'1'); target.dataset.scaleX = (cur * -1).toString(); applyTransformToElement(target); }});
  addBtn('Отразить по вертикали', ()=>{ if(target){ const curY = parseFloat(target.dataset.scaleY||'1'); target.dataset.scaleY = (curY * -1).toString(); // store scaleY but applyTransformToElement must handle it
      // apply via style transform manually
      const r = parseFloat(target.dataset.rotation||'0'); const sx = parseFloat(target.dataset.scaleX||'1'); const sy = parseFloat(target.dataset.scaleY||'1'); target.style.transform = `rotate(${r}deg) scaleX(${sx}) scaleY(${sy})`; }});
  addBtn('Изменить размер...', ()=>{ if(target){ const w = prompt('Новая ширина (px)', parseInt(target.style.width)||target.offsetWidth); const h = prompt('Новая высота (px)', parseInt(target.style.height)||target.offsetHeight); if(w) target.style.width = parseInt(w) + 'px'; if(h) target.style.height = parseInt(h) + 'px'; }});
  addBtn('Копировать', ()=>{ if(target) copyObjectToClipboard(target); });
  addBtn('Вырезать', ()=>{ if(target){ copyObjectToClipboard(target); target.remove(); if(state.selected===target) state.selected=null; }});
  addBtn('Вставить', ()=>{ pasteClipboardAt(target); });
  // position
  cm.style.left = (ev.clientX+4)+'px'; cm.style.top = (ev.clientY+4)+'px';
}

function copyObjectToClipboard(el){ if(!el) return; const img = el.querySelector && el.querySelector('img'); if(img){ _pc_clipboard = {type:'image', src: img.dataset.originalSrc || img.src, width: el.style.width, height: el.style.height, left: el.style.left, top: el.style.top, rotation: el.dataset.rotation||'0', scaleX: el.dataset.scaleX||'1'} } else { const st = window.getComputedStyle(el); _pc_clipboard = {type:'text', text: el.textContent, left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height, fontSize: st.fontSize, fontFamily: st.fontFamily, color: st.color, fontWeight: st.fontWeight, fontStyle: st.fontStyle, textShadow: st.textShadow, webkitTextStroke: st.webkitTextStroke, rotation: el.dataset.rotation||'0', scaleX: el.dataset.scaleX||'1'} } }

function pasteClipboardAt(target, pos){ if(!_pc_clipboard) return; const scene = qs('#scene'); const data = JSON.parse(JSON.stringify(_pc_clipboard)); // clone
  const el = document.createElement('div'); el.className = 'scene-object';
  if(data.type==='image'){
    if(pos){ el.style.left = (pos.x)+'px'; el.style.top = (pos.y)+'px'; } else { el.style.left = (parseFloat(data.left||'10')+20)+'px'; el.style.top = (parseFloat(data.top||'10')+20)+'px'; }
    if(data.width) el.style.width = data.width; if(data.height) el.style.height = data.height; const img = document.createElement('img'); img.src = data.src; img.draggable = false; try{ img.dataset.originalSrc = data.src }catch(e){} el.appendChild(img);
  } else {
    el.contentEditable = true; el.textContent = data.text || 'Текст'; if(pos){ el.style.left = (pos.x)+'px'; el.style.top = (pos.y)+'px'; } else { el.style.left = (parseFloat(data.left||'30')+20)+'px'; el.style.top = (parseFloat(data.top||'30')+20)+'px'; }
    if(data.fontSize) el.style.fontSize = data.fontSize; if(data.fontFamily) el.style.fontFamily = data.fontFamily; if(data.color) el.style.color = data.color; if(data.fontWeight) el.style.fontWeight = data.fontWeight; if(data.fontStyle) el.style.fontStyle = data.fontStyle; if(data.textShadow) el.style.textShadow = data.textShadow; if(data.webkitTextStroke) el.style.webkitTextStroke = data.webkitTextStroke;
  }
  scene.appendChild(el); _initObjectTransforms(el); makeInteractive(el); selectObject(el);
  try{ markDirty(); }catch(e){}
}

// global contextmenu handler for scene objects and scene background
qs('#scene') && qs('#scene').addEventListener('contextmenu',(ev)=>{
  const obj = ev.target.closest && ev.target.closest('.scene-object');
  if(obj){ showContextMenu(ev, obj); }
  else { showSceneContextMenu(ev); }
});

function showSceneContextMenu(ev){ ev.preventDefault(); hideContextMenu(); const cm = createContextMenu(); cm.innerHTML=''; const addBtn = (txt,fn)=>{ const b=document.createElement('button'); b.textContent = txt; b.addEventListener('click', ()=>{ fn(); hideContextMenu(); }); cm.appendChild(b); };
  addBtn('Вставить', ()=>{ const scene = qs('#scene'); const rect = scene.getBoundingClientRect(); const scale = state.sceneScale||1; const x = Math.round((ev.clientX-rect.left)/scale); const y = Math.round((ev.clientY-rect.top)/scale); pasteClipboardAt(scene, {x,y}); });
  addBtn('Добавить изображение', ()=>{ const f = qs('#file-image'); if(f) f.click(); });
  addBtn('Добавить текст', ()=>{ const scene = qs('#scene'); const el = document.createElement('div'); el.className='scene-object'; el.contentEditable = true; el.textContent = 'Новый текст'; const rect = scene.getBoundingClientRect(); const scale = state.sceneScale||1; el.style.left = ((ev.clientX - rect.left)/scale) + 'px'; el.style.top = ((ev.clientY - rect.top)/scale) + 'px'; scene.appendChild(el); _initObjectTransforms(el); makeInteractive(el); selectObject(el); });
  addBtn('Изменить размер сцены', ()=>{ const w = prompt('Новая ширина сцены (px)', (state.project&&state.project.w)||qs('#scene').offsetWidth); const h = prompt('Новая высота сцены (px)', (state.project&&state.project.h)||qs('#scene').offsetHeight); if(w && h){ const scene = qs('#scene'); scene.style.width = parseInt(w)+'px'; scene.style.height = parseInt(h)+'px'; if(!state.project) state.project = {}; state.project.w = parseInt(w); state.project.h = parseInt(h); qs('#proj-res') && (qs('#proj-res').textContent = `${w}×${h}`); } });
  cm.style.left = (ev.clientX+4)+'px'; cm.style.top = (ev.clientY+4)+'px';
}

// --- Pick color mode: render scene to offscreen canvas and sample pixel ---
function getRenderedSceneCanvas(){ return new Promise(resolve=>{
  const scene = qs('#scene'); if(!scene) return resolve(null);
  const w = parseInt(state.project && state.project.w) || scene.offsetWidth;
  const h = parseInt(state.project && state.project.h) || scene.offsetHeight;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
  const objs = Array.from(qsa('.scene-object'));
  const draws = objs.map(o=> new Promise(res=>{
    const x = parseFloat(o.style.left)||0; const y = parseFloat(o.style.top)||0; const rw = parseFloat(o.style.width)||o.offsetWidth; const rh = parseFloat(o.style.height)||o.offsetHeight;
    const img = o.querySelector && o.querySelector('img'); if(img){ const tmp = new Image(); tmp.crossOrigin='anonymous'; tmp.onload = ()=>{ try{ ctx.drawImage(tmp, x, y, rw, rh); }catch(e){} res(); }; tmp.onerror = ()=> res(); tmp.src = img.dataset.originalSrc || img.src; } else { // text: draw simple filled text
      const style = window.getComputedStyle(o); ctx.fillStyle = style.color || '#fff'; const fs = parseInt(style.fontSize) || 32; ctx.font = (style.fontWeight && style.fontWeight!=='400' ? style.fontWeight+' ' : '') + (style.fontStyle && style.fontStyle!=='normal' ? style.fontStyle+' ' : '') + (fs+'px ') + (style.fontFamily || 'Arial'); const lines = (o.textContent||'').split('\n'); for(let i=0;i<lines.length;i++){ ctx.fillText(lines[i], x, y + i*(fs*1.2)); } res(); }
  }));
  Promise.all(draws).then(()=> resolve(canvas));
}) }

function startPickColorMode(){ const scene = qs('#scene'); if(!scene) return; alert('Кликните по изображению на сцене, чтобы выбрать цвет (пипетка)'); getRenderedSceneCanvas().then(canvas=>{
    if(!canvas) return; const onClick=(ev)=>{ const rect = scene.getBoundingClientRect(); const sx = ev.clientX - rect.left; const sy = ev.clientY - rect.top; // account for scene scale relative size
      const scale = state.sceneScale || 1; const cx = Math.round(sx/scale); const cy = Math.round(sy/scale);
      try{ const ctx = canvas.getContext('2d'); const d = ctx.getImageData(cx, cy, 1,1).data; const hex = '#'+((1<<24)+(d[0]<<16)+(d[1]<<8)+d[2]).toString(16).slice(1); const colorInput = qs('#remove-color'); if(colorInput) colorInput.value = hex; alert('Выбран цвет: '+hex); }catch(e){ alert('Не удалось выбрать цвет') }
      scene.removeEventListener('pointerdown', onClick);
    };
    scene.addEventListener('pointerdown', onClick);
  }); }


// Expose tiny helpers for dev
// expose tiny helpers for dev (assign properties explicitly)
window._pc = window._pc || {};
window._pc.state = state;
window._pc.addImageElement = addImageElement;
window._pc.addText = addText;
window._pc.createProject = createProject;
window._pc.saveProject = saveProject;
window._pc.loadProject = loadProject;
