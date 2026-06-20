if(!navigator.onLine){ location.replace('./offline.html'); }
window.addEventListener('offline', () => location.replace('./offline.html'));

const _ep = atob('aHR0cHM6Ly9qamRtZ3luam5iYnh4Z3RjZGVybC5zdXBhYmFzZS5jbw==');
const _ak = atob('c2JfcHVibGlzaGFibGVfOEVFYnJ6THVRY19ncGdqZU5BVXJFd19RRm1uWVZBYw==');

let CFG = {
  app_name:          'TreinoLog',
  trial_days:        '14',
  free_history_days: '7',
  free_cal_days:     '7',
  free_max_grupos:   '3',
};
let CATEGORIAS = []; // carregadas do banco por usuÃ¡rio

const appName      = () => CFG.app_name;
const trialDays    = () => parseInt(CFG.trial_days);
const freeHistDays = () => parseInt(CFG.free_history_days);
const freeCalDays  = () => parseInt(CFG.free_cal_days);
const freeMaxGrp   = () => parseInt(CFG.free_max_grupos);

const DOW   = ['Dom','Seg','Ter','Qua','Qui','Sex','SÃ¡b'];
const MESES = ['Janeiro','Fevereiro','MarÃ§o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem('_tl_theme',t);}catch(e){}
  const icon=document.getElementById('theme-icon');if(!icon)return;
  icon.className=t==='dark'?'fa-solid fa-moon':'fa-solid fa-sun';
}
function toggleTheme(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');}
try{applyTheme(localStorage.getItem('_tl_theme')||'light');}catch(e){}

let _session = null; // { access_token, user }

async function _req(path, opts={}, useSession=true, _retry=false){
  const headers = {
    'apikey': _ak,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    'Authorization': `Bearer ${useSession && _session ? _session.access_token : _ak}`,
    ...(opts.headers||{})
  };
  const res = await fetch(`${_ep}/rest/v1/${path}`, {...opts, headers});
  if(!res.ok){
    if(res.status===401 && useSession && _session && _session.refresh_token && !_retry){
      const ok=await _refreshSession();
      if(ok) return _req(path, opts, useSession, true);
    }
    const e=await res.text(); throw new Error(e);
  }
  const t=await res.text(); return t?JSON.parse(t):null;
}

async function _refreshSession(){
  try{
    const res=await fetch(`${_ep}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{apikey:_ak,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:_session.refresh_token})
    });
    if(!res.ok)return false;
    const data=await res.json();
    _session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user};
    try{localStorage.setItem('_tl_session',JSON.stringify(_session));}catch(e){}
    return true;
  }catch(e){ return false; }
}

async function _authReq(path, body){
  const res = await fetch(`${_ep}/auth/v1/${path}`, {
    method:'POST',
    headers:{'apikey':_ak,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const data=await res.json();
  if(!res.ok) throw new Error(data.error_description||data.msg||'Erro');
  return data;
}

async function loadConfig(){
  try{
    const rows = await _req('app_config?select=chave,valor', {}, false);
    if(rows) rows.forEach(r=>{ CFG[r.chave]=r.valor; });
    applyAppName();
  }catch(e){ }
}

function applyAppName(){
  const name = appName();
  const parts = name.match(/^(.+?)(Log|Pro|Fit|App)?$/i);
  const base  = parts?.[1]||name;
  const suffix= parts?.[2]||'';
  const html  = suffix ? `${base}<span>${suffix}</span>` : name;
  const el1 = document.getElementById('auth-app-name');
  const el2 = document.getElementById('header-app-name');
  const tit = document.getElementById('tutorial-title');
  if(el1) el1.innerHTML=html;
  if(el2) el2.innerHTML=html;
  if(tit) tit.textContent=`Como usar o ${name}`;
  document.title=name;
}

const CATEGORIAS_PADRAO=['Peito','Costas','Ombro','BÃ­ceps','TrÃ­ceps','Perna','AbdÃ´men'];
async function loadCategorias(){
  try{
    let rows = await _req('treinos_categorias?order=posicao.asc');
    if(!rows || !rows.length){
      const criadas=[];
      for(let i=0;i<CATEGORIAS_PADRAO.length;i++){
        const novo={id:uid(),user_id:uid_(),nome:CATEGORIAS_PADRAO[i],posicao:i};
        try{
          await _req('treinos_categorias',{method:'POST',body:JSON.stringify(novo)});
          criadas.push(novo);
        }catch(e){ criadas.push(novo); }
      }
      rows = criadas;
    }
    CATEGORIAS = rows.map(r=>({id:r.id,nome:r.nome}));
  }catch(e){
    CATEGORIAS = CATEGORIAS_PADRAO.map((nome,i)=>({id:'tmp'+i,nome}));
  }
  if(!CATEGORIAS.length) CATEGORIAS = CATEGORIAS_PADRAO.map((nome,i)=>({id:'tmp'+i,nome}));
}

let currentAuthTab='login';
function switchAuthTab(tab){
  currentAuthTab=tab;
  document.getElementById('tab-login').classList.toggle('active',tab==='login');
  document.getElementById('tab-signup').classList.toggle('active',tab==='signup');
  const trialBox=document.getElementById('auth-trial-box');
  trialBox.style.display=tab==='signup'?'block':'none';
  if(tab==='signup'){
    const msg=document.getElementById('auth-trial-msg');
    if(msg) msg.innerHTML=`<i class="fa-solid fa-gift" style="margin-right:6px"></i>${trialDays()} dias de acesso completo, grÃ¡tis`;
  }
  document.getElementById('auth-name-wrap').style.display=tab==='signup'?'block':'none';
  document.getElementById('auth-submit').textContent=tab==='login'?'Entrar':'Criar conta';
  document.getElementById('auth-switch-btn').textContent=tab==='login'?'NÃ£o tem conta? Criar agora':'JÃ¡ tenho conta. Entrar';
  document.getElementById('auth-error').textContent='';
}

let _pendingSignup=null; // {email, password, name}

async function submitAuth(){
  const email=document.getElementById('auth-email').value.trim();
  const password=document.getElementById('auth-password').value;
  const name=document.getElementById('auth-name').value.trim();
  const btn=document.getElementById('auth-submit');
  const errEl=document.getElementById('auth-error');
  if(!email||!password){errEl.textContent='Preencha e-mail e senha.';return;}
  if(password.length<6){errEl.textContent='A senha precisa ter pelo menos 6 caracteres.';return;}
  if(currentAuthTab==='signup'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){errEl.textContent='Digite um e-mail vÃ¡lido.';return;}
  btn.disabled=true;btn.textContent='Aguarde...';errEl.textContent='';
  try{
    if(currentAuthTab==='signup'){
      const data=await _authReq('signup',{email,password,data:{display_name:name||null}});
      if(data.access_token){
        _session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user};
      }else{
        const login=await _authReq('token?grant_type=password',{email,password});
        _session={access_token:login.access_token,refresh_token:login.refresh_token,user:login.user};
      }
      await startApp();
      showToast(`Bem-vindo(a)! VocÃª tem ${trialDays()} dias Pro grÃ¡tis.`,'success');
    } else {
      const data=await _authReq('token?grant_type=password',{email,password});
      _session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user};
      await startApp();
    }
  }catch(e){
    const m=e.message||'';
    if(m.includes('Invalid login credentials'))errEl.textContent='E-mail ou senha incorretos.';
    else if(m.includes('already registered')||m.includes('already been registered'))errEl.textContent='Este e-mail jÃ¡ tem conta. Tente entrar.';
    else if(m.includes('rate limit'))errEl.textContent='Muitas tentativas. Aguarde alguns minutos.';
    else if(m.includes('Email not confirmed'))errEl.textContent='Confirme seu e-mail antes de entrar.';
    else errEl.textContent=m;
    btn.disabled=false;btn.textContent=currentAuthTab==='login'?'Entrar':'Criar conta';
  }
}

function abrirOtp(email){
  document.getElementById('auth-submit').disabled=false;
  document.getElementById('auth-submit').textContent='Criar conta';
  document.getElementById('otp-email-label').textContent=email;
  document.getElementById('otp-code').value='';
  document.getElementById('otp-error').textContent='';
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('otp-screen').style.display='flex';
  setTimeout(()=>document.getElementById('otp-code').focus(),200);
}
function backToAuth(){
  document.getElementById('otp-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
}

async function submitOtp(){
  const code=document.getElementById('otp-code').value.trim();
  const errEl=document.getElementById('otp-error');
  const btn=document.getElementById('otp-submit');
  if(code.length!==6){errEl.textContent='Digite os 6 dÃ­gitos.';return;}
  if(!_pendingSignup){errEl.textContent='SessÃ£o expirada. Volte e cadastre de novo.';return;}
  btn.disabled=true;btn.textContent='Confirmando...';errEl.textContent='';
  try{
    const data=await _authReq('verify',{type:'signup',email:_pendingSignup.email,token:code});
    _session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user};
    document.getElementById('otp-screen').style.display='none';
    await startApp();
    showToast(`Bem-vindo(a)! VocÃª tem ${trialDays()} dias Pro grÃ¡tis.`,'success');
    _pendingSignup=null;
  }catch(e){
    const m=e.message||'';
    errEl.textContent=m.includes('expired')?'CÃ³digo expirado. Reenvie.':m.includes('invalid')||m.includes('Token')?'CÃ³digo invÃ¡lido.':m;
    btn.disabled=false;btn.textContent='Confirmar';
  }
}

async function resendOtp(){
  if(!_pendingSignup){showToast('Cadastre-se novamente.','error');return;}
  const btn=document.getElementById('otp-resend');btn.disabled=true;btn.textContent='Enviando...';
  try{
    await _authReq('resend',{type:'signup',email:_pendingSignup.email});
    showToast('CÃ³digo reenviado!','success');
  }catch(e){
    showToast(e.message.includes('rate')?'Aguarde antes de reenviar.':'Erro ao reenviar.','error');
  }
  setTimeout(()=>{btn.disabled=false;btn.textContent='Reenviar cÃ³digo';},3000);
}

function confirmLogout(){
  openModal(`<div class="modal-title">Sair da conta</div><div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:20px">Tem certeza que deseja sair? Seus dados ficam salvos e voltam quando vocÃª entrar de novo.</div><button class="btn-primary" style="background:var(--red)" onclick="doLogout()">Sair</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);
}
async function doLogout(){
  try{ if(_session) await fetch(`${_ep}/auth/v1/logout`,{method:'POST',headers:{apikey:_ak,Authorization:`Bearer ${_session.access_token}`}}); }catch(e){}
  _session=null;_sub=null;_isPro=false;_pendingSignup=null;
  try{localStorage.removeItem('_tl_session');}catch(e){}
  _closeModal();hideAll();
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('auth-email').value='';
  document.getElementById('auth-password').value='';
  switchAuthTab('login');
}

let _sub=null,_isPro=false,_trialDaysLeft=0;

async function loadSubscription(){
  if(!_session) return;
  try{
    const rows=await _req(`subscriptions?user_id=eq.${_session.user.id}`);
    _sub=rows&&rows.length?rows[0]:null;
    _isPro=computeIsPro(_sub);
    _trialDaysLeft=computeTrialDaysLeft(_sub);
  }catch(e){_sub=null;_isPro=false;}
}
function computeIsPro(sub){
  if(!sub)return false;
  const now=Date.now();
  if(sub.billing_cycle==='lifetime')return true;
  if(sub.subscription_status==='active'&&sub.current_period_end&&new Date(sub.current_period_end).getTime()>now)return true;
  if(sub.subscription_status==='trialing'&&sub.trial_ends_at&&new Date(sub.trial_ends_at).getTime()>now)return true;
  return false;
}
function computeTrialDaysLeft(sub){
  if(!sub||sub.subscription_status!=='trialing')return 0;
  return Math.max(0,Math.ceil((new Date(sub.trial_ends_at).getTime()-Date.now())/86400000));
}
function updateStatusBadge(){
  const el=document.getElementById('header-status-badge');if(!el)return;
  if(!_sub){el.className='status-badge free';el.textContent='Free';return;}
  if(_isPro&&_sub.subscription_status==='trialing'){el.className='status-badge trial';el.textContent=`Trial Â· ${_trialDaysLeft}d`;}
  else if(_isPro){el.className='status-badge pro';el.textContent='Pro';}
  else{el.className='status-badge free';el.textContent='Free';}
}
function showUpsell(title,sub){
  openModal(`<div class="paywall-hero"><div class="paywall-icon"><i class="fa-solid fa-bolt"></i></div><div class="paywall-title">${title||'Recurso Pro'}</div><div class="paywall-sub">${sub||'DisponÃ­vel no plano Pro.'}</div></div><div class="pro-features-list"><div class="pro-feature-item">HistÃ³rico completo</div><div class="pro-feature-item">CalendÃ¡rio ilimitado</div><div class="pro-feature-item">ReferÃªncia da Ãºltima carga</div><div class="pro-feature-item">Stats e grÃ¡ficos</div><div class="pro-feature-item">Acervo de recordes pessoais</div><div class="pro-feature-item">Modo foco</div><div class="pro-feature-item">Exportar stats</div></div><button class="plan-btn" onclick="_closeModal();showPaywall()">Ver planos</button><button class="btn-secondary" onclick="_closeModal()">Agora nÃ£o</button>`);
}
function showPaywall(){
  openModal(`<div class="paywall-hero"><div class="paywall-icon"><i class="fa-solid fa-trophy"></i></div><div class="paywall-title">Upgrade para Pro</div><div class="paywall-sub">Desbloqueie todo o potencial do ${appName()}</div></div>
  <div class="plan-cards">
    <div class="plan-card featured"><div class="plan-tag"><i class="fa-solid fa-star"></i> Mais popular</div><div class="plan-name">Anual</div><div class="plan-price">R$ --,--<span>/ano</span></div><div class="plan-desc">2 meses grÃ¡tis Â· cancele quando quiser</div><button class="plan-btn" style="margin-top:14px" disabled>Em breve na Play Store</button></div>
    <div class="plan-card"><div class="plan-name">Mensal</div><div class="plan-price">R$ --,--<span>/mÃªs</span></div><button class="plan-btn secondary" style="margin-top:12px" disabled>Em breve na Play Store</button></div>
    <div class="plan-card"><div class="plan-name">VitalÃ­cio</div><div class="plan-price">R$ ---,--<span> Ãºnico</span></div><button class="plan-btn secondary" style="margin-top:12px" disabled>Em breve na Play Store</button></div>
  </div>
  <div class="paywall-note">Pagamento via Google Play Store.<br>Seus dados nunca sÃ£o apagados.</div>
  <button class="btn-secondary" onclick="_closeModal()">Continuar no plano bÃ¡sico</button>`);
}

const uid=()=>Math.random().toString(36).slice(2,9);
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateKey=iso=>{const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const uid_=()=>_session.user.id;

const db={
  getCategorias:  ()=>_req('treinos_categorias?order=posicao.asc'),
  getCatModelos:  ()=>_req('catalogo_modelos?ativo=eq.true&order=ordem.asc',{},false),
  getCatModeloDias:(mid)=>_req(`catalogo_modelo_dias?modelo_id=eq.${mid}&order=ordem.asc`,{},false),
  getCatDiaExercicios:(did)=>_req(`catalogo_dia_exercicios?modelo_dia_id=eq.${did}&order=ordem.asc&select=*,catalogo_exercicios(nome,categoria)`,{},false),
  getCatExercicios:()=>_req('catalogo_exercicios?order=categoria.asc,nome.asc',{},false),
  insertCategoria:(d)=>_req('treinos_categorias',{method:'POST',body:JSON.stringify({...d,user_id:uid_()})}),
  deleteCategoria:(id)=>_req(`treinos_categorias?id=eq.${id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}),
  getGrupos:      ()=>_req('treinos_grupos?order=nome.asc'),
  insertGrupo:    (d)=>_req('treinos_grupos',{method:'POST',body:JSON.stringify({...d,user_id:uid_()})}),
  updateGrupo:    (id,d)=>_req(`treinos_grupos?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(d)}),
  deleteGrupo:    (id)=>_req(`treinos_grupos?id=eq.${id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}),
  getTreinos:     (gid)=>_req(`treinos_treinos?grupo_id=eq.${gid}&order=nome.asc`),
  insertTreino:   (d)=>_req('treinos_treinos',{method:'POST',body:JSON.stringify({...d,user_id:uid_()})}),
  updateTreino:   (id,d)=>_req(`treinos_treinos?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(d)}),
  deleteTreino:   (id)=>_req(`treinos_treinos?id=eq.${id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}),
  getExercicios:  (tid)=>_req(`treinos_exercicios?treino_id=eq.${tid}&order=posicao.asc`),
  insertExercicio:(d)=>_req('treinos_exercicios',{method:'POST',body:JSON.stringify({...d,user_id:uid_()})}),
  updateExercicio:(id,d)=>_req(`treinos_exercicios?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(d)}),
  deleteExercicio:(id)=>_req(`treinos_exercicios?id=eq.${id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}),
  getSessoes:     ()=>_req('treinos_sessoes?order=iniciado_em.desc&limit=400'),
  getSessoesAbertasHoje:()=>{const d=new Date();d.setHours(0,0,0,0);return _req(`treinos_sessoes?finalizado_em=is.null&iniciado_em=gte.${d.toISOString()}&order=iniciado_em.desc`);},
  getSessoesAbertas:()=>_req('treinos_sessoes?finalizado_em=is.null&order=iniciado_em.desc'),
  getUltimaSessaoTreino:(tid)=>_req(`treinos_sessoes?treino_id=eq.${tid}&finalizado_em=not.is.null&order=iniciado_em.desc&limit=1`),
  getSessoesFinalizadasTreino:(tid)=>_req(`treinos_sessoes?treino_id=eq.${tid}&finalizado_em=not.is.null&select=id`),
  insertSessao:   (d)=>_req('treinos_sessoes',{method:'POST',body:JSON.stringify({...d,user_id:uid_()})}),
  updateSessao:   (id,d)=>_req(`treinos_sessoes?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(d)}),
  deleteSessao:   (id)=>_req(`treinos_sessoes?id=eq.${id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}),
  getSessaoExs:   (sid)=>_req(`treinos_sessao_exercicios?sessao_id=eq.${sid}&order=id.asc`),
  insertSessaoEx: (d)=>_req('treinos_sessao_exercicios',{method:'POST',body:JSON.stringify({...d,user_id:uid_()})}),
  updateSessaoEx: (id,d)=>_req(`treinos_sessao_exercicios?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(d)}),
  deleteSessaoExsBySessao:(sid)=>_req(`treinos_sessao_exercicios?sessao_id=eq.${sid}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}),
  getCargaHistory:()=>_req('treinos_sessao_exercicios?select=exercicio_id,carga_usada,status,sessao_id,treinos_sessoes(iniciado_em,finalizado_em)&carga_usada=not.is.null'),
  getAllSessaoExs:()=>_req('treinos_sessao_exercicios?select=exercicio_id,nome_snapshot,status,carga_usada,sessao_id,treinos_sessoes(iniciado_em,finalizado_em)'),
};

let grupos=[],grupoAtivo=null,treinos=[],currentTab='home',selectedTreinoId=null;
let sessaoAtiva=null,sessaoExs=[],sessaoTimer=null,sessaoSecs=0;
let exAtualId=null;
let globalTimer={secs:0,def:60,running:false,interval:null,fresh:true,endsAt:null};
let cargaHist={},prAntes={},prsDaSessao=[],prAvisado={};
let calAno=new Date().getFullYear(),calMes=new Date().getMonth();
let calSessoesCache=null,statsExSelecionado=null;
let soundEnabled=true,focoAberto=false;

function showApp(){const a=document.getElementById('app');a.style.display='flex';a.style.flexDirection='column';}
function hideAll(){['app','sessao-screen','resultado-screen','gerenciar-screen','tutorial-screen','wizard-screen'].forEach(id=>{document.getElementById(id).style.display='none';});document.getElementById('foco-screen').style.display='none';}
function hideOverlayScreen(){hideAll();showApp();init();}

async function startApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('otp-screen').style.display='none';
  try{localStorage.setItem('_tl_session',JSON.stringify(_session));}catch(e){}
  showApp();
  await Promise.all([loadConfig(), loadSubscription(), loadCategorias()]);
  applyAppName();
  updateStatusBadge();
  const gruposIniciais = await db.getGrupos();
  if(!gruposIniciais || !gruposIniciais.length){
    startWizard();
    return;
  }
  await init();
  checkTrialBanner();
}

function checkTrialBanner(){
  if(!_sub||_sub.subscription_status!=='trialing')return;
  if(_trialDaysLeft<=3&&_trialDaysLeft>0){
    const el=document.getElementById('content');if(!el)return;
    if(el.querySelector('.trial-banner'))return;
    const b=document.createElement('div');
    b.className='trial-banner';
    b.innerHTML=`<i class="fa-solid fa-circle-info"></i>Faltam ${_trialDaysLeft} dias do seu acesso completo.`;
    b.onclick=showPaywall;
    el.insertBefore(b,el.firstChild);
  }
}

async function init(){
  const el=document.getElementById('content');
  el.innerHTML='<div class="loading"><div class="spinner"></div>Carregando...</div>';
  try{
    grupos=await db.getGrupos();
    grupoAtivo=grupos.find(g=>g.ativo)||null;
    treinos=grupoAtivo?await db.getTreinos(grupoAtivo.id):[];
    for(const t of treinos){
      const s=await db.getUltimaSessaoTreino(t.id);
      t.ultima_vez=s&&s.length?s[0].iniciado_em:null;
      const fs=await db.getSessoesFinalizadasTreino(t.id);
      t.vezes_feito=fs?fs.length:0;
    }
    if(treinos.length){
      const sorted=[...treinos].sort((a,b)=>!a.ultima_vez?-1:!b.ultima_vez?1:new Date(a.ultima_vez)-new Date(b.ultima_vez));
      selectedTreinoId=sorted[0].id;
    }
    await fecharSessoesAntigas();
    calSessoesCache=null;
    render();
    checkTrialBanner();
  }catch(e){
    el.innerHTML=`<div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="empty-text">Erro ao conectar.<br><small>${e.message}</small></div></div>`;
  }
}

async function fecharSessoesAntigas(){
  const abertas=await db.getSessoesAbertas();if(!abertas||!abertas.length)return;
  const hoje=todayStr();
  for(const s of abertas){
    if(dateKey(s.iniciado_em)!==hoje){
      const fim=new Date(new Date(s.iniciado_em).getTime()+3600000).toISOString();
      await db.updateSessao(s.id,{finalizado_em:fim,duracao_segundos:3600});
    }
  }
}

document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    currentTab=t.dataset.tab;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    render();
  });
});
function render(){
  const el=document.getElementById('content');
  if(currentTab==='home')renderHome(el);
  else if(currentTab==='calendario')renderCalendario(el);
  else renderStats(el);
}

async function renderHome(el){
  if(!grupoAtivo){el.innerHTML=`<div class="empty"><div class="empty-icon"><i class="fa-solid fa-dumbbell"></i></div><div class="empty-text">Vamos comeÃ§ar!<br>Crie sua primeira rotina de treino.</div><button class="upsell-btn" style="margin-top:16px" onclick="showGerenciar()">Criar rotina</button></div>`;return;}
  if(!treinos.length){el.innerHTML=`<div class="empty"><div class="empty-icon"><i class="fa-solid fa-clipboard-list"></i></div><div class="empty-text">A rotina <strong>${grupoAtivo.nome}</strong> ainda nÃ£o tem dias de treino.</div><button class="upsell-btn" style="margin-top:16px" onclick="showGerenciar()">Adicionar dia de treino</button></div>`;return;}
  const abertasHoje=await db.getSessoesAbertasHoje();
  const sessaoHoje=abertasHoje&&abertasHoje.length?abertasHoje[0]:null;
  if(sessaoHoje)selectedTreinoId=sessaoHoje.treino_id;
  const sorted=[...treinos].sort((a,b)=>!a.ultima_vez?-1:!b.ultima_vez?1:new Date(a.ultima_vez)-new Date(b.ultima_vez));
  const hero=treinos.find(t=>t.id===selectedTreinoId)||sorted[0];
  const isSugerido=hero.id===sorted[0].id;
  const ulv=hero.ultima_vez?new Date(hero.ultima_vez).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Nunca';
  const heroBtn=sessaoHoje&&sessaoHoje.treino_id===hero.id?'Continuar Treino â–¸':'Iniciar Treino â–¸';
  let html=`<div class="grupo-badge" onclick="showGerenciar()">Rotina: <strong>${grupoAtivo.nome}</strong></div>`;
  if(sessaoHoje)html+=`<div class="continuar-banner"><i class="fa-solid fa-clock-rotate-left"></i>Treino de hoje em andamento</div>`;
  html+=`<div class="hero-card" onclick="iniciarTreino()">
    <div class="hero-tag">${sessaoHoje&&sessaoHoje.treino_id===hero.id?'<i class="fa-solid fa-clock"></i> EM ANDAMENTO':isSugerido?'<i class="fa-solid fa-star"></i> SUGERIDO':'SELECIONADO'}</div>
    <div class="hero-nome">${hero.nome}</div>
    <div class="hero-meta">Ãšltimo: <strong>${ulv}</strong> Â· Feito <strong>${hero.vezes_feito||0}x</strong></div>
    <button class="hero-btn">${heroBtn}</button>
  </div>`;
  const outros=treinos.filter(t=>t.id!==hero.id);
  if(outros.length){
    html+=`<div class="outros-title">Outros treinos</div>`;
    outros.forEach(t=>{
      const u=t.ultima_vez?new Date(t.ultima_vez).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Nunca';
      html+=`<div class="treino-mini" onclick="selecionarHero('${t.id}')"><div><div class="treino-mini-nome">${t.nome}</div><div class="treino-mini-meta">Ãšltimo: <strong>${u}</strong> Â· <strong>${t.vezes_feito||0}x</strong></div></div><div style="color:var(--text3);font-size:18px">â€º</div></div>`;
    });
  }
  el.innerHTML=html;
  checkTrialBanner();
  maybeStartCoach();
}
function selecionarHero(id){selectedTreinoId=id;render();}

async function iniciarTreino(){
  if(!selectedTreinoId)return;
  const heroBtn=document.querySelector('.hero-btn');
  if(heroBtn){heroBtn.disabled=true;heroBtn.dataset.orig=heroBtn.textContent;heroBtn.textContent='Preparando...';}
  try{
    const abertasHoje=await db.getSessoesAbertasHoje();
    const sessaoHoje=abertasHoje&&abertasHoje.length?abertasHoje[0]:null;
    if(sessaoHoje){
      if(sessaoHoje.treino_id===selectedTreinoId){await continuarSessao(sessaoHoje);return;}
      await db.deleteSessaoExsBySessao(sessaoHoje.id);await db.deleteSessao(sessaoHoje.id);
    }
    const treino=treinos.find(t=>t.id===selectedTreinoId);
    const exercicios=await db.getExercicios(selectedTreinoId);
    if(!exercicios||!exercicios.length){showToast('Adicione exercÃ­cios a este treino.','error');if(heroBtn){heroBtn.disabled=false;heroBtn.textContent=heroBtn.dataset.orig;}return;}
    await carregarCargaHist();
    const sessaoId=uid();const agora=new Date().toISOString();
    await db.insertSessao({id:sessaoId,treino_id:selectedTreinoId,iniciado_em:agora});
    sessaoExs=[];
    for(const ex of exercicios){
      const seid=uid();const hist=cargaHist[ex.id]||[];
      const carga=hist.length?hist[0].carga:(ex.carga_atual||null);
      await db.insertSessaoEx({id:seid,sessao_id:sessaoId,exercicio_id:ex.id,nome_snapshot:ex.nome,status:'pendente',series_feitas:0,carga_usada:carga});
      sessaoExs.push({id:seid,exercicio_id:ex.id,nome_snapshot:ex.nome,status:'pendente',series_feitas:0,carga_usada:carga,_ex:ex});
    }
    sessaoAtiva={id:sessaoId,treino_id:selectedTreinoId,treino_nome:treino.nome,iniciado_em:agora};
    sessaoSecs=0;prsDaSessao=[];prAvisado={};
    exAtualId=null;globalTimer={secs:0,def:60,running:false,interval:null,fresh:true,endsAt:null};soundEnabled=true;
    abrirTelaSessao();
  }catch(e){
    showToast('Erro ao iniciar treino.','error');
    if(heroBtn){heroBtn.disabled=false;heroBtn.textContent=heroBtn.dataset.orig||'Iniciar Treino â–¸';}
  }
}

async function continuarSessao(s){
  const treino=treinos.find(t=>t.id===s.treino_id);
  const exercicios=await db.getExercicios(s.treino_id);
  const exsDB=await db.getSessaoExs(s.id);
  await carregarCargaHist(s.id);
  sessaoExs=exsDB.map(se=>{
    const ex=exercicios.find(e=>e.id===se.exercicio_id)||{nome:se.nome_snapshot,categoria:'',series:null,repeticoes:null,descanso_segundos:60};
    return {...se,_ex:ex};
  });
  sessaoSecs=Math.floor((Date.now()-new Date(s.iniciado_em).getTime())/1000);
  sessaoAtiva={id:s.id,treino_id:s.treino_id,treino_nome:treino?.nome||'Treino',iniciado_em:s.iniciado_em};
  prsDaSessao=[];prAvisado=[];exAtualId=null;
  globalTimer={secs:0,def:60,running:false,interval:null,fresh:true,endsAt:null};soundEnabled=true;
  abrirTelaSessao();
}

async function carregarCargaHist(excluirSessaoId){
  cargaHist={};prAntes={};
  try{
    const rows=await db.getCargaHistory();
    const fin=(rows||[]).filter(r=>r.treinos_sessoes&&r.treinos_sessoes.finalizado_em&&r.sessao_id!==excluirSessaoId);
    fin.sort((a,b)=>new Date(b.treinos_sessoes.iniciado_em)-new Date(a.treinos_sessoes.iniciado_em));
    fin.forEach(r=>{
      if(!cargaHist[r.exercicio_id])cargaHist[r.exercicio_id]=[];
      if(cargaHist[r.exercicio_id].length<3)cargaHist[r.exercicio_id].push({carga:parseFloat(r.carga_usada),data:r.treinos_sessoes.iniciado_em});
      const c=parseFloat(r.carga_usada);
      if(!prAntes[r.exercicio_id]||c>prAntes[r.exercicio_id])prAntes[r.exercicio_id]=c;
    });
  }catch(e){}
}

function abrirTelaSessao(){
  document.getElementById('sessao-nome').textContent=sessaoAtiva.treino_nome;
  document.getElementById('sessao-timer-top').textContent=formatDur(sessaoSecs);
  document.getElementById('foco-btn-header').style.display=_isPro?'flex':'none';
  syncSoundIcon();
  hideAll();
  const ss=document.getElementById('sessao-screen');ss.style.display='flex';ss.style.flexDirection='column';
  const firstPending=sessaoExs.find(se=>se.status==='pendente');
  exAtualId=firstPending?firstPending.id:(sessaoExs.length?sessaoExs[0].id:null);
  if(exAtualId){const se=getAtual();globalTimer.def=se._ex.descanso_segundos||60;globalTimer.secs=globalTimer.def;globalTimer.fresh=true;}
  renderSessao();
  sessaoTimer=setInterval(()=>{sessaoSecs=Math.floor((Date.now()-new Date(sessaoAtiva.iniciado_em).getTime())/1000);const el=document.getElementById('sessao-timer-top');if(el){const total=sessaoExs.length;const cn=sessaoExs.filter(se=>se.status!=='pendente').length;el.innerHTML=`${formatDur(sessaoSecs)} Â· <span style="color:var(--accent)">${cn}/${total}</span> exercÃ­cios`;}},1000);
}

function getAtual(){return sessaoExs.find(se=>se.id===exAtualId)||null;}
function orderedSessaoExs(){
  const pendentes=sessaoExs.filter(se=>se.status==='pendente');
  const concluidos=sessaoExs.filter(se=>se.status!=='pendente');
  const catNomes=CATEGORIAS.map(c=>c.nome);
  const groups=[];
  catNomes.forEach(cat=>{const items=pendentes.filter(se=>(se._ex.categoria||'')===cat);if(items.length)groups.push({titulo:cat,items});});
  const outras=pendentes.filter(se=>!catNomes.includes(se._ex.categoria||''));
  if(outras.length)groups.push({titulo:'Outros',items:outras});
  return{groups,concluidos};
}

function renderSessao(){
  const {groups,concluidos}=orderedSessaoExs();
  let html='';
  groups.forEach(g=>{html+=`<div class="ex-group-title">${g.titulo}</div>`;html+=g.items.map(se=>buildExCard(se)).join('');});
  if(concluidos.length){html+=`<div class="ex-group-title" style="margin-top:18px">ConcluÃ­dos</div>`;html+=concluidos.map(se=>buildExCard(se)).join('');}
  if(!html)html='<div class="empty"><div class="empty-text">Nenhum exercÃ­cio.</div></div>';
  document.getElementById('sessao-content').innerHTML=html;
  const total=sessaoExs.length;
  const concluidosN=sessaoExs.filter(se=>se.status!=='pendente').length;
  const topEl=document.getElementById('sessao-timer-top');
  if(topEl)topEl.innerHTML=`${formatDur(sessaoSecs)} Â· <span style="color:var(--accent)">${concluidosN}/${total}</span> exercÃ­cios`;
  setupSwipeCards();updateTimerUI();
}

function buildExCard(se){
  const ex=se._ex;const labels={pendente:'Marcar',feito:'âœ“ Feito',pulei:'â­ Pulei'};
  const isAtual=exAtualId===se.id;
  const hist=cargaHist[se.exercicio_id]||[];
  let ultimasHtml='';
  if(_isPro&&hist.length){
    const ultimas=[...hist].reverse().map(h=>h.carga+'kg').join(' â†’ ');
    ultimasHtml=`<div class="ex-ultimas">Ãšltimas: <strong>${ultimas}</strong>${prAntes[se.exercicio_id]?` Â· Recorde: <strong>${prAntes[se.exercicio_id]}kg</strong>`:''}</div>`;
  }else if(!_isPro&&hist.length){
    ultimasHtml=`<div class="ex-carga-locked"><i class="fa-solid fa-lock" style="font-size:11px"></i> ReferÃªncia da Ãºltima carga <span onclick="event.stopPropagation();showUpsell('ReferÃªncia de carga','Veja a carga anterior para treinar com mais precisÃ£o.')">Desbloquear</span></div>`;
  }
  return `<div class="exercicio-swipe-wrap" id="exwrap-${se.id}">
    <div class="swipe-bg swipe-bg-left">â­ Pular</div>
    <div class="swipe-bg swipe-bg-right">âœ“ Feito</div>
    <div class="exercicio-card ${se.status}${isAtual?' atual':''}" id="excard-${se.id}" data-id="${se.id}">
      <div class="ex-top">
        <div><div class="ex-name">${se.nome_snapshot}</div><div class="ex-cat">${ex.categoria||''}${isAtual?' Â· <span style="color:var(--accent)">atual</span>':''}</div></div>
        <button class="ex-status-btn ${se.status}" onclick="event.stopPropagation();cycleStatusById('${se.id}')">${labels[se.status]}</button>
      </div>
      <div class="ex-details">
        ${ex.series?`<div class="ex-detail"><div class="ex-detail-label">SÃ©ries</div><div class="ex-detail-val">${ex.series}</div></div>`:''}
        ${ex.repeticoes?`<div class="ex-detail"><div class="ex-detail-label">Reps</div><div class="ex-detail-val">${ex.repeticoes}</div></div>`:''}
        <div class="ex-detail"><div class="ex-detail-label">Descanso</div><div class="ex-detail-val">${ex.descanso_segundos||60}s</div></div>
      </div>
      ${ex.series?`<div class="ex-series-row"><div class="ex-series-label">SÃ©ries feitas</div><div class="series-counter"><button class="series-btn" onclick="event.stopPropagation();changeSeriesById('${se.id}',-1)">âˆ’</button><div class="series-count" id="sc-${se.id}">${se.series_feitas} / ${ex.series}</div><button class="series-btn" onclick="event.stopPropagation();changeSeriesById('${se.id}',1)">+</button></div></div>`:''}
      <div class="ex-carga-row" onclick="event.stopPropagation()">
        <span style="font-size:12px;color:var(--text2);white-space:nowrap">Carga (kg)</span>
        <input class="form-input" type="number" inputmode="decimal" placeholder="opcional" value="${se.carga_usada||''}" oninput="updateCargaById('${se.id}',this.value)" style="padding:8px 12px;font-size:14px"/>
      </div>
      ${ultimasHtml}
    </div>
  </div>`;
}

function setupSwipeCards(){
  document.querySelectorAll('.exercicio-card').forEach(card=>{
    let startX=0,startY=0,dx=0,locked=false,moved=false;
    card.addEventListener('touchstart',e=>{if(e.target.closest('button,input'))return;startX=e.touches[0].clientX;startY=e.touches[0].clientY;dx=0;locked=false;moved=false;card.style.transition='none';},{passive:true});
    card.addEventListener('touchmove',e=>{if(e.target.closest('button,input'))return;dx=e.touches[0].clientX-startX;const dy=e.touches[0].clientY-startY;if(!locked){if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy))locked='h';else if(Math.abs(dy)>12)locked='v';}if(locked==='h'){e.preventDefault();moved=true;card.style.transform=`translateX(${dx}px)`;const wrap=card.parentElement;wrap.classList.toggle('show-right',dx>30);wrap.classList.toggle('show-left',dx<-30);}},{passive:false});
    card.addEventListener('touchend',e=>{if(e.target.closest('button,input')){locked=false;moved=false;return;}card.style.transition='transform .25s ease';const wrap=card.parentElement;if(locked==='h'&&Math.abs(dx)>80){const id=card.dataset.id;const dir=dx>0?'feito':'pulei';card.style.transform=`translateX(${dx>0?'110%':'-110%'})`;setTimeout(()=>setStatusById(id,dir),200);}else{card.style.transform='translateX(0)';wrap.classList.remove('show-left','show-right');if(!moved&&locked!=='v')setExAtualById(card.dataset.id);}});
    card.addEventListener('click',e=>{if(e.target.closest('button,input'))return;if('ontouchstart' in window)return;setExAtualById(card.dataset.id);});
  });
}

function setExAtualById(id){if(globalTimer.running){showToast('Pause o timer antes.','error');return;}if(exAtualId===id)return;exAtualId=id;const se=getAtual();if(!se)return;globalTimer.def=se._ex.descanso_segundos||60;globalTimer.secs=globalTimer.def;globalTimer.fresh=true;renderSessao();syncFoco();}
function setStatusById(id,status){const se=sessaoExs.find(s=>s.id===id);if(!se)return;se.status=status;db.updateSessaoEx(se.id,{status}).catch(()=>{});if(status==='feito')showToast(`${se.nome_snapshot} concluÃ­do! ðŸ’ª`,'success');else if(status==='pulei')showToast(`${se.nome_snapshot} pulado.`,'');if(exAtualId===id&&status!=='pendente'){const next=sessaoExs.find(s=>s.status==='pendente');exAtualId=next?next.id:null;if(next){globalTimer.def=next._ex.descanso_segundos||60;globalTimer.secs=globalTimer.def;globalTimer.fresh=true;}}renderSessao();syncFoco();}
function cycleStatusById(id){const se=sessaoExs.find(s=>s.id===id);if(!se)return;const cycle={pendente:'feito',feito:'pulei',pulei:'pendente'};setStatusById(id,cycle[se.status]);}
function changeSeriesById(id,delta){const se=sessaoExs.find(s=>s.id===id);if(!se)return;const max=se._ex.series||99;se.series_feitas=Math.max(0,Math.min(max,se.series_feitas+delta));db.updateSessaoEx(se.id,{series_feitas:se.series_feitas}).catch(()=>{});const el=document.getElementById(`sc-${se.id}`);if(el)el.textContent=`${se.series_feitas} / ${se._ex.series||'?'}`;if(se._ex.series&&se.series_feitas>=se._ex.series&&se.status!=='feito')setStatusById(id,'feito');syncFoco();}
function updateCargaById(id,val){const se=sessaoExs.find(s=>s.id===id);if(!se)return;se.carga_usada=val?parseFloat(val):null;db.updateSessaoEx(se.id,{carga_usada:se.carga_usada}).catch(()=>{});const max=prAntes[se.exercicio_id];if(se.carga_usada&&max&&se.carga_usada>max&&!prAvisado[se.exercicio_id]){prAvisado[se.exercicio_id]=true;showToast(`ðŸ† Novo recorde em ${se.nome_snapshot}!`,'pr');}}

function ringOffset(circ,pct){return circ*(1-pct);}
function isUltimaSerie(se){
  if(!se||!se._ex.series)return false;
  return se.series_feitas>=se._ex.series-1 && se.status!=='feito';
}
function updateTimerUI(){
  const se=getAtual();
  const nameEl=document.getElementById('footer-ex-name');const dispEl=document.getElementById('footer-timer-display');const btnEl=document.getElementById('footer-timer-btn');const ring=document.getElementById('footer-ring');
  const timerRow=document.getElementById('footer-timer-row');const finBtn=document.getElementById('finalizar-ex-btn');
  if(!se){nameEl.textContent='Selecione um exercÃ­cio';dispEl.textContent='--:--';btnEl.disabled=true;btnEl.classList.remove('running');if(ring)ring.style.strokeDashoffset=157;timerRow.style.display='flex';finBtn.style.display='none';return;}
  if(isUltimaSerie(se)&&!globalTimer.running){
    timerRow.style.display='none';
    finBtn.style.display='flex';
    syncFoco();return;
  }
  timerRow.style.display='flex';finBtn.style.display='none';
  nameEl.textContent=se.nome_snapshot;dispEl.textContent=formatDur(globalTimer.secs);btnEl.disabled=false;btnEl.textContent=globalTimer.running?'â¸':'â–¶';btnEl.classList.toggle('running',globalTimer.running);
  if(ring){const pct=globalTimer.def>0?globalTimer.secs/globalTimer.def:0;ring.style.strokeDashoffset=ringOffset(157,pct);}syncFoco();
}
function finalizarExercicioAtual(){
  const se=getAtual();if(!se)return;
  if(se._ex.series)se.series_feitas=se._ex.series;
  db.updateSessaoEx(se.id,{series_feitas:se.series_feitas}).catch(()=>{});
  const el=document.getElementById(`sc-${se.id}`);if(el)el.textContent=`${se.series_feitas} / ${se._ex.series}`;
  setStatusById(se.id,'feito');
}
function toggleGlobalTimer(){
  const se=getAtual();if(!se)return;
  if(globalTimer.running){clearInterval(globalTimer.interval);globalTimer.running=false;globalTimer.secs=Math.max(0,Math.ceil((globalTimer.endsAt-Date.now())/1000));globalTimer.endsAt=null;releaseWakeLock();updateTimerUI();return;}
  if(globalTimer.fresh){incrementSerieAtual();globalTimer.fresh=false;}
  if(Notification&&Notification.permission==='default'){try{Notification.requestPermission();}catch(e){}}
  globalTimer.running=true;globalTimer.endsAt=Date.now()+globalTimer.secs*1000;
  requestWakeLock();updateTimerUI();globalTimer.interval=setInterval(timerTick,250);
}
function timerTick(){if(!globalTimer.running)return;const restante=Math.ceil((globalTimer.endsAt-Date.now())/1000);if(restante<=0){clearInterval(globalTimer.interval);globalTimer.running=false;globalTimer.endsAt=null;playBeep();notifyRestDone();showRestSplash();globalTimer.secs=globalTimer.def;globalTimer.fresh=true;}else{globalTimer.secs=restante;}updateTimerUI();}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(globalTimer.running)timerTick();if(sessaoAtiva){sessaoSecs=Math.floor((Date.now()-new Date(sessaoAtiva.iniciado_em).getTime())/1000);const el=document.getElementById('sessao-timer-top');if(el)el.textContent=formatDur(sessaoSecs);}}});
function incrementSerieAtual(){const se=getAtual();if(!se||!se._ex.series)return;const max=se._ex.series;if(se.series_feitas<max){se.series_feitas++;db.updateSessaoEx(se.id,{series_feitas:se.series_feitas}).catch(()=>{});const el=document.getElementById(`sc-${se.id}`);if(el)el.textContent=`${se.series_feitas} / ${max}`;if(se.series_feitas>=max&&se.status!=='feito')setStatusById(se.id,'feito');}syncFoco();}

function abrirFoco(){if(!_isPro){showUpsell('Modo Foco','Treine sem distraÃ§Ãµes, com o timer em tela cheia.');return;}focoAberto=true;const tot=sessaoExs.length;const cn=sessaoExs.filter(se=>se.status!=='pendente').length;document.getElementById('foco-treino-nome').innerHTML=`${sessaoAtiva?.treino_nome||''} <span style="color:var(--accent);font-size:13px">${cn}/${tot}</span>`;document.getElementById('foco-screen').style.display='flex';syncFoco();}
function fecharFoco(){focoAberto=false;document.getElementById('foco-screen').style.display='none';renderSessao();}
function syncFoco(){if(!focoAberto)return;const se=getAtual();
  const ftn=document.getElementById('foco-treino-nome');if(ftn){const tot=sessaoExs.length;const cn=sessaoExs.filter(s=>s.status!=='pendente').length;ftn.innerHTML=`${sessaoAtiva?.treino_nome||''} <span style="color:var(--accent);font-size:13px">${cn}/${tot}</span>`;}
  const nome=document.getElementById('foco-nome');const cat=document.getElementById('foco-cat');const serie=document.getElementById('foco-serie');const carga=document.getElementById('foco-carga');const timeVal=document.getElementById('foco-time-val');const playBtn=document.getElementById('foco-play');const ring=document.getElementById('foco-ring');const hint=document.getElementById('foco-hint');if(!se){nome.textContent='Treino concluÃ­do!';cat.textContent='';serie.textContent='';carga.textContent='';timeVal.textContent='âœ“';hint.textContent='Feche e conclua o treino.';playBtn.style.display='none';return;}playBtn.style.display='flex';nome.textContent=se.nome_snapshot;cat.textContent=se._ex.categoria||'';serie.innerHTML=se._ex.series?`SÃ©rie <strong>${Math.min(se.series_feitas+1,se._ex.series)}</strong> de ${se._ex.series}${se._ex.repeticoes?` Â· ${se._ex.repeticoes} reps`:''}`:'';carga.textContent=se.carga_usada?`Carga: ${se.carga_usada}kg`:'';
  if(isUltimaSerie(se)&&!globalTimer.running){
    timeVal.style.fontSize='30px';timeVal.textContent='Ãšltima sÃ©rie';
    playBtn.innerHTML='<i class="fa-solid fa-circle-check"></i>';playBtn.classList.remove('running');
    playBtn.onclick=finalizarExercicioAtual;
    ring.style.strokeDashoffset=0;
    hint.textContent='Toque para concluir o exercÃ­cio';
    return;
  }
  timeVal.style.fontSize='';playBtn.onclick=toggleGlobalTimer;
  timeVal.textContent=formatDur(globalTimer.secs);playBtn.textContent=globalTimer.running?'â¸':'â–¶';playBtn.classList.toggle('running',globalTimer.running);const pct=globalTimer.def>0?globalTimer.secs/globalTimer.def:0;ring.style.strokeDashoffset=ringOffset(653.5,pct);hint.textContent=globalTimer.running?'Descansando...':'Toque em â–¶ ao terminar a sÃ©rie';}
function focoProximoEx(){if(globalTimer.running){showToast('Pause o timer antes.','error');return;}const p=sessaoExs.filter(se=>se.status==='pendente');if(!p.length)return;const idx=p.findIndex(se=>se.id===exAtualId);setExAtualById(p[(idx+1)%p.length].id);}
function focoExAnterior(){if(globalTimer.running){showToast('Pause o timer antes.','error');return;}const p=sessaoExs.filter(se=>se.status==='pendente');if(!p.length)return;const idx=p.findIndex(se=>se.id===exAtualId);setExAtualById(p[(idx-1+p.length)%p.length].id);}

let audioCtx=null;
function getAudioCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}
document.addEventListener('touchstart',()=>{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();},{passive:true});
const SOUND_PROFILES={
  classico:{nome:'ClÃ¡ssico',tipo:'sine',freqs:[880,880,880],dur:0.25,gap:150},
  sino:    {nome:'Sino',    tipo:'triangle',freqs:[1318,1046],dur:0.5,gap:120},
  digital: {nome:'Digital', tipo:'square',freqs:[660,880,1100],dur:0.12,gap:90},
  suave:   {nome:'Suave',   tipo:'sine',freqs:[523,659],dur:0.4,gap:180},
  alarme:  {nome:'Alarme',  tipo:'sawtooth',freqs:[440,440,440,440],dur:0.15,gap:110},
  none:    {nome:'Silencioso',tipo:null,freqs:[],dur:0,gap:0},
};
let soundProfile='classico';
try{soundProfile=localStorage.getItem('_tl_sound')||'classico';}catch(e){}

function syncSoundIcon(){
  const btn=document.getElementById('sound-btn');const icon=document.getElementById('sound-icon');
  if(!btn||!icon)return;
  if(soundProfile==='none'){btn.classList.add('muted');icon.className='fa-solid fa-volume-xmark';}
  else{btn.classList.remove('muted');icon.className='fa-solid fa-volume-high';}
}
function openSoundPicker(){
  const opts=Object.entries(SOUND_PROFILES).map(([k,v])=>{
    const right = k===soundProfile
      ? '<i class="fa-solid fa-check" style="color:var(--accent)"></i>'
      : `<i class="fa-solid fa-play" style="color:var(--text3);font-size:12px" onclick="event.stopPropagation();previewSound(&quot;${k}&quot;)"></i>`;
    return `<div class="sound-opt${k===soundProfile?' active':''}" onclick="selectSound(&quot;${k}&quot;)"><span>${v.nome}</span>${right}</div>`;
  }).join('');
  openModal(`<div class="modal-title">Som do alerta</div><div style="font-size:13px;color:var(--text2);margin-bottom:16px">Tocado quando o descanso termina. Toque para ouvir.</div><div class="sound-list">${opts}</div><button class="btn-secondary" onclick="_closeModal()">Fechar</button>`);
}
function selectSound(k){soundProfile=k;try{localStorage.setItem('_tl_sound',k);}catch(e){}syncSoundIcon();if(k!=='none')previewSound(k);openSoundPicker();}
function previewSound(k){playProfile(SOUND_PROFILES[k]);}

async function playProfile(prof){
  if(!prof||!prof.tipo||!prof.freqs.length){return;}
  try{
    const ctx=getAudioCtx();await ctx.resume();
    prof.freqs.forEach((f,i)=>{
      const delay=i*prof.gap/1000;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=f;o.type=prof.tipo;
      g.gain.setValueAtTime(0.3,ctx.currentTime+delay);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+prof.dur);
      o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+prof.dur);
    });
  }catch(e){}
}
let wakeLock=null;
async function requestWakeLock(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch(e){}}
async function releaseWakeLock(){try{if(wakeLock){await wakeLock.release();wakeLock=null;}}catch(e){}}
async function playBeep(){if(soundProfile==='none'){releaseWakeLock();return;}try{await playProfile(SOUND_PROFILES[soundProfile]);setTimeout(releaseWakeLock,800);}catch(e){releaseWakeLock();}}
function notifyRestDone(){try{if('Notification' in window&&Notification.permission==='granted'&&document.hidden)new Notification(appName(),{body:'Descanso concluÃ­do! Hora da prÃ³xima sÃ©rie ðŸ’ª'});}catch(e){}}
function showRestSplash(){const ex=document.getElementById('rest-splash');if(ex)ex.remove();const el=document.createElement('div');el.id='rest-splash';el.style.cssText='position:fixed;inset:0;z-index:1250;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:splashIn .2s ease forwards;';el.innerHTML=`<div style="font-size:52px;margin-bottom:20px">ðŸ’ª</div><div style="font-family:'Outfit',sans-serif;font-size:26px;color:var(--text);text-align:center;line-height:1.3;margin-bottom:10px">Descanso<br>concluÃ­do</div><div style="font-size:15px;color:var(--accent);font-weight:500">Toque para continuar</div>`;el.onclick=()=>el.remove();document.body.appendChild(el);setTimeout(()=>{if(el.parentNode)el.remove();},2000);}

async function sairSessao(){clearInterval(sessaoTimer);if(globalTimer.interval)clearInterval(globalTimer.interval);globalTimer.running=false;releaseWakeLock();await db.updateSessao(sessaoAtiva.id,{duracao_segundos:sessaoSecs}).catch(()=>{});sessaoTimer=null;focoAberto=false;document.getElementById('foco-screen').style.display='none';hideAll();await init();}
async function concluirTreino(){
  clearInterval(sessaoTimer);if(globalTimer.interval)clearInterval(globalTimer.interval);globalTimer.running=false;releaseWakeLock();document.getElementById('foco-screen').style.display='none';focoAberto=false;
  const fim=new Date().toISOString();
  await db.updateSessao(sessaoAtiva.id,{finalizado_em:fim,duracao_segundos:sessaoSecs});
  await db.updateTreino(sessaoAtiva.treino_id,{ultima_vez:todayStr()});
  prsDaSessao=[];
  for(const se of sessaoExs){if(se.carga_usada){await db.updateExercicio(se.exercicio_id,{carga_atual:se.carga_usada}).catch(()=>{});const max=prAntes[se.exercicio_id];if(se.status==='feito'&&(!max||se.carga_usada>max)&&max)prsDaSessao.push({nome:se.nome_snapshot,carga:se.carga_usada,anterior:max});}}
  mostrarResultado(fim);
}
function mostrarResultado(fim){
  const feitos=sessaoExs.filter(e=>e.status==='feito').length;const pulados=sessaoExs.filter(e=>e.status==='pulei').length;const dur=formatDur(sessaoSecs);
  const inicio=new Date(sessaoAtiva.iniciado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const fimStr=new Date(fim).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const prHtml=prsDaSessao.length?`<div class="pr-banner"><i class="fa-solid fa-trophy" style="margin-right:5px"></i><strong>Novos recordes!</strong><br>${prsDaSessao.map(p=>`${p.nome}: <strong>${p.carga}kg</strong> (antes ${p.anterior}kg)`).join('<br>')}</div>`:'';
  let proxHtml='';
  const concluidoId=sessaoAtiva.treino_id;
  const candidatos=treinos.filter(t=>t.id!==concluidoId);
  if(candidatos.length){
    const prox=[...candidatos].sort((a,b)=>{if(!a.ultima_vez)return -1;if(!b.ultima_vez)return 1;return new Date(a.ultima_vez)-new Date(b.ultima_vez);})[0];
    proxHtml=`<div class="prox-treino"><div class="prox-treino-label"><i class="fa-solid fa-forward-step"></i> PrÃ³ximo sugerido</div><div class="prox-treino-nome">${prox.nome}</div></div>`;
  }
  const exHtml=sessaoExs.map(se=>{const icons={feito:'<i class="fa-solid fa-circle-check" style="color:var(--green)"></i>',pulei:'<i class="fa-solid fa-forward" style="color:var(--orange)"></i>',pendente:'<i class="fa-regular fa-circle" style="color:var(--text3)"></i>'};const labels={feito:'Feito',pulei:'Pulei',pendente:'NÃ£o marcado'};return `<div class="res-ex-item"><div class="res-ex-icon">${icons[se.status]}</div><div class="res-ex-info"><div class="res-ex-name">${se.nome_snapshot}</div><div class="res-ex-detail">${se.series_feitas>0?`${se.series_feitas} sÃ©ries`:''}${se.carga_usada?` Â· ${se.carga_usada}kg`:''}</div></div><div class="res-ex-status ${se.status}">${labels[se.status]}</div></div>`;}).join('');
  document.getElementById('resultado-content').innerHTML=`
    <div class="resultado-hero"><div class="resultado-icon"><i class="fa-solid ${feitos===sessaoExs.length?'fa-trophy':'fa-dumbbell'}"></i></div><div class="resultado-titulo">${sessaoAtiva.treino_nome}</div><div class="resultado-sub">${new Date(sessaoAtiva.iniciado_em).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</div></div>
    <div class="resultado-stats"><div class="res-stat"><div class="res-stat-val" style="color:var(--accent)">${dur}</div><div class="res-stat-label">DuraÃ§Ã£o</div></div><div class="res-stat"><div class="res-stat-val" style="color:var(--green)">${feitos}</div><div class="res-stat-label">Feitos</div></div><div class="res-stat"><div class="res-stat-val" style="color:var(--orange)">${pulados}</div><div class="res-stat-label">Pulados</div></div></div>
    ${prHtml}<div style="font-size:12px;color:var(--text3);margin-bottom:16px;text-align:center">${inicio} â†’ ${fimStr}</div>
    ${exHtml}
    ${proxHtml}
    <button class="export-btn" onclick="exportarTreino()"><i class="fa-solid fa-share-nodes"></i>Compartilhar treino</button>
    <button class="voltar-btn" onclick="voltarParaHome()" style="margin-top:8px">Voltar ao InÃ­cio</button>`;
  hideAll();const rs=document.getElementById('resultado-screen');rs.style.display='flex';rs.style.flexDirection='column';
  sessaoAtiva=null;sessaoExs=[];exAtualId=null;
}
async function voltarParaHome(){hideAll();await init();}

async function exportarTreino(){
  showToast('Gerando imagem...','');
  try{const container=document.getElementById('export-canvas-container');const source=document.getElementById('resultado-content');const card=document.createElement('div');card.style.cssText=`width:390px;background:var(--bg);padding:32px 28px 24px;font-family:'Inter',sans-serif;color:var(--text);`;card.innerHTML=source.innerHTML;const wm=document.createElement('div');wm.style.cssText=`margin-top:20px;text-align:center;font-size:12px;color:var(--text3);font-weight:500;letter-spacing:.5px;`;wm.textContent=`feito com ${appName()}`;card.appendChild(wm);card.querySelectorAll('button').forEach(b=>b.remove());container.innerHTML='';container.appendChild(card);const canvas=await html2canvas(card,{backgroundColor:null,scale:2,useCORS:true,logging:false});container.innerHTML='';canvas.toBlob(async(blob)=>{const file=new File([blob],`treino-${todayStr()}.png`,{type:'image/png'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:appName()});}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();showToast('Imagem salva!','success');}});}catch(e){showToast('Erro ao gerar imagem.','error');}
}
async function exportarStats(){
  if(!_isPro){showUpsell('Exportar Stats','Compartilhe sua evoluÃ§Ã£o. DisponÃ­vel no Pro.');return;}
  showToast('Gerando imagem...','');
  try{const container=document.getElementById('export-canvas-container');const source=document.getElementById('content');const card=document.createElement('div');card.style.cssText=`width:390px;background:var(--bg);padding:28px;font-family:'Inter',sans-serif;color:var(--text);`;card.innerHTML=source.innerHTML;const wm=document.createElement('div');wm.style.cssText=`margin-top:16px;text-align:center;font-size:12px;color:var(--text3);font-weight:500;letter-spacing:.5px;`;wm.textContent=`feito com ${appName()}`;card.appendChild(wm);card.querySelectorAll('button,select').forEach(b=>b.remove());container.innerHTML='';container.appendChild(card);const canvas=await html2canvas(card,{backgroundColor:null,scale:2,useCORS:true,logging:false});container.innerHTML='';canvas.toBlob(async(blob)=>{const file=new File([blob],`stats-${todayStr()}.png`,{type:'image/png'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:appName()});}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();showToast('Imagem salva!','success');}});}catch(e){showToast('Erro ao gerar imagem.','error');}
}

async function getCalCache(){
  if(calSessoesCache)return calSessoesCache;
  const sessoes=(await db.getSessoes()||[]).filter(s=>s.finalizado_em);
  const allTreinos=await db.getAllTreinos?.()|| treinos;
  const byDay={};
  sessoes.forEach(s=>{const k=dateKey(s.iniciado_em);if(!byDay[k])byDay[k]=[];const t=treinos.find(t=>t.id===s.treino_id);byDay[k].push({...s,treino_nome:t?.nome||'Treino'});});
  calSessoesCache={byDay,total:sessoes.length};return calSessoesCache;
}
async function renderCalendario(el){
  el.innerHTML='<div class="loading"><div class="spinner"></div>Carregando...</div>';
  const{byDay}=await getCalCache();
  const hoje=todayStr();const now=new Date();
  const freeMin=_isPro?null:(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()-freeCalDays()+1);d.setHours(0,0,0,0);return d;})();
  const first=new Date(calAno,calMes,1);const startDow=first.getDay();const daysInMonth=new Date(calAno,calMes+1,0).getDate();
  let cells='';DOW.forEach(d=>cells+=`<div class="cal-dow">${d}</div>`);
  for(let i=0;i<startDow;i++)cells+=`<div class="cal-day empty-day"></div>`;
  let treinosNoMes=0;
  for(let d=1;d<=daysInMonth;d++){
    const k=`${calAno}-${String(calMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayDate=new Date(k+'T12:00');const sess=byDay[k];
    const isHoje=k===hoje;const isLocked=!_isPro&&freeMin&&dayDate<freeMin;
    if(sess&&!isLocked)treinosNoMes++;
    cells+=`<div class="cal-day${sess&&!isLocked?' treinado':''}${isHoje?' hoje':''}${isLocked?' locked':''}"${sess&&!isLocked?` onclick="abrirDia('${k}')"`:''}>${d}${sess&&!isLocked?'<div class="cal-day-dot"></div>':''}</div>`;
  }
  const ws=new Date(now);ws.setDate(now.getDate()-now.getDay());ws.setHours(0,0,0,0);
  let semana=0;Object.keys(byDay).forEach(k=>{const d=new Date(k+'T12:00');if(d>=ws&&d<=now)semana++;});
  const canNavBack=_isPro||(calAno===now.getFullYear()&&calMes===now.getMonth());
  const canNavFwd=calAno<now.getFullYear()||(calAno===now.getFullYear()&&calMes<now.getMonth());
  let html=`<div class="cal-header"><button class="cal-nav-btn" onclick="${canNavBack?'calNav(-1)':'showUpsell(\"CalendÃ¡rio completo\",\"Acesse qualquer perÃ­odo no Pro.\")'}">â€¹</button><div class="cal-month-label">${MESES[calMes]} ${calAno}</div><button class="cal-nav-btn" onclick="${canNavFwd?'calNav(1)':''}">â€º</button></div>`;
  if(!_isPro)html+=`<div class="upsell-block" style="margin-bottom:14px;padding:14px"><div class="upsell-title"><i class="fa-solid fa-lock" style="margin-right:5px"></i>CalendÃ¡rio limitado</div><div class="upsell-sub" style="font-size:12px;margin-bottom:10px">Veja apenas os Ãºltimos ${freeCalDays()} dias no plano bÃ¡sico.</div><button class="upsell-btn" style="font-size:13px;padding:9px 18px" onclick="showUpsell('CalendÃ¡rio completo','')">Desbloquear</button></div>`;
  html+=`<div class="cal-grid">${cells}</div><div class="cal-legenda">Toque em um dia treinado para ver os detalhes</div><div class="cal-resumo"><div class="cal-resumo-item"><strong>${treinosNoMes}</strong><span>dias no mÃªs</span></div><div class="cal-resumo-item"><strong>${semana}</strong><span>esta semana</span></div></div>`;
  el.innerHTML=html;
}
function calNav(dir){calMes+=dir;if(calMes<0){calMes=11;calAno--;}if(calMes>11){calMes=0;calAno++;}render();}
async function abrirDia(k){
  const{byDay}=await getCalCache();const sess=byDay[k]||[];
  const dataLabel=new Date(k+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  let html=`<div class="modal-title" style="text-transform:capitalize">${dataLabel}</div>`;
  for(const s of sess){
    const exs=await db.getSessaoExs(s.id);const feitos=exs.filter(e=>e.status==='feito').length;
    const inicio=new Date(s.iniciado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const fimS=s.finalizado_em?new Date(s.finalizado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'â€“';
    html+=`<div class="modal-day-sessao"><div style="font-weight:600;margin-bottom:4px">${s.treino_nome}</div><div style="font-size:12px;color:var(--text3);margin-bottom:10px">${inicio} â†’ ${fimS} Â· ${s.duracao_segundos?formatDur(s.duracao_segundos):'â€“'} Â· âœ… ${feitos}/${exs.length}</div>${exs.map(e=>{const meta=[e.series_feitas>0?`${e.series_feitas} sÃ©ries`:'',e.carga_usada?`${e.carga_usada}kg`:''].filter(Boolean).join(' Â· ')||'â€“';return `<div class="hist-ex-row"><div class="hist-ex-dot ${e.status}"></div><div class="hist-ex-name">${e.nome_snapshot}</div><div class="hist-ex-meta">${meta}</div></div>`;}).join('')}<div class="hist-actions"><button class="hist-action-btn" onclick="abrirEditarSessao('${s.id}')">âœï¸ Editar</button><button class="hist-action-btn danger" onclick="excluirSessao('${s.id}')">ðŸ—‘ Excluir</button></div></div>`;
  }
  html+=`<button class="btn-secondary" onclick="_closeModal()">Fechar</button>`;openModal(html);
}
async function excluirSessao(sid){if(!confirm('Excluir este treino?'))return;try{await db.deleteSessaoExsBySessao(sid);await db.deleteSessao(sid);calSessoesCache=null;_closeModal();showToast('Treino excluÃ­do.','success');await init();}catch{showToast('Erro.','error');}}
async function abrirEditarSessao(sid){
  const exs=await db.getSessaoExs(sid);if(!exs||!exs.length){showToast('SessÃ£o sem exercÃ­cios.','error');return;}
  const statusOpts=[['feito','âœ“ Feito'],['pulei','â­ Pulei'],['pendente','â€“ NÃ£o marcado']];
  openModal(`<div class="modal-title">Editar Treino Realizado</div>${exs.map(e=>`<div class="modal-day-sessao"><div style="font-weight:500;font-size:14px;margin-bottom:10px">${e.nome_snapshot}</div><div class="form-row" style="margin-bottom:8px"><div><label class="form-label">Status</label><select class="form-input" id="edit-status-${e.id}">${statusOpts.map(([v,l])=>`<option value="${v}"${e.status===v?' selected':''}>${l}</option>`).join('')}</select></div><div><label class="form-label">SÃ©ries</label><input class="form-input" id="edit-series-${e.id}" type="number" inputmode="numeric" value="${e.series_feitas||0}" min="0"/></div></div><label class="form-label">Carga (kg)</label><input class="form-input" id="edit-carga-${e.id}" type="number" inputmode="decimal" value="${e.carga_usada||''}" placeholder="opcional"/></div>`).join('')}<button class="btn-primary" id="btn-save-edit" onclick="salvarEdicaoSessao('${sid}')">Salvar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);
  window._editandoExs=exs;
}
async function salvarEdicaoSessao(sid){const exs=window._editandoExs||[];const btn=document.getElementById('btn-save-edit');btn.disabled=true;btn.textContent='Salvando...';try{for(const e of exs){const status=document.getElementById(`edit-status-${e.id}`).value;const series=parseInt(document.getElementById(`edit-series-${e.id}`).value)||0;const cargaVal=document.getElementById(`edit-carga-${e.id}`).value;const carga=cargaVal?parseFloat(cargaVal):null;await db.updateSessaoEx(e.id,{status,series_feitas:series,carga_usada:carga});}window._editandoExs=null;calSessoesCache=null;_closeModal();showToast('Treino atualizado!','success');render();}catch{showToast('Erro.','error');btn.disabled=false;btn.textContent='Salvar';}}

async function renderStats(el){
  el.innerHTML='<div class="loading"><div class="spinner"></div>Calculando...</div>';
  if(!_isPro){el.innerHTML=`<div class="upsell-block"><div class="upsell-lock"><i class="fa-solid fa-chart-line"></i></div><div class="upsell-title">Stats â€” Plano Pro</div><div class="upsell-sub">Acompanhe evoluÃ§Ã£o de carga, frequÃªncia, recordes e muito mais.</div><button class="upsell-btn" onclick="showUpsell('Stats completo','')">Ver planos</button></div>`;return;}
  try{
    const sessoes=(await db.getSessoes()||[]).filter(s=>s.finalizado_em);
    const allExs=await db.getAllSessaoExs();const finExs=(allExs||[]).filter(r=>r.treinos_sessoes&&r.treinos_sessoes.finalizado_em);
    const agora=new Date();
    const mesAtual=sessoes.filter(s=>{const d=new Date(s.iniciado_em);return d.getMonth()===agora.getMonth()&&d.getFullYear()===agora.getFullYear();}).length;
    let freqSemanal='â€“';
    if(sessoes.length){const dias=new Set(sessoes.map(s=>dateKey(s.iniciado_em)));const oldest=new Date(Math.min(...sessoes.map(s=>new Date(s.iniciado_em))));const semanas=Math.max(1,Math.ceil((agora-oldest)/(7*86400000)));freqSemanal=(dias.size/semanas).toFixed(1)+'x';}
    let streak=0;if(sessoes.length){const weekKey=d=>{const dt=new Date(d);const ws=new Date(dt);ws.setDate(dt.getDate()-dt.getDay());return dateKey(ws.toISOString());};const weeks=new Set(sessoes.map(s=>weekKey(s.iniciado_em)));let cursor=new Date();for(let i=0;i<520;i++){const wk=weekKey(cursor.toISOString());if(weeks.has(wk)){streak++;cursor.setDate(cursor.getDate()-7);}else break;}}
    const durs=sessoes.filter(s=>s.duracao_segundos&&s.duracao_segundos<4*3600).map(s=>s.duracao_segundos);
    const tempoMedio=durs.length?formatDur(Math.round(durs.reduce((a,b)=>a+b,0)/durs.length)):'â€“';
    const puladosCount={};finExs.filter(r=>r.status==='pulei').forEach(r=>{puladosCount[r.nome_snapshot]=(puladosCount[r.nome_snapshot]||0)+1;});
    const maisPulado=Object.entries(puladosCount).sort((a,b)=>b[1]-a[1])[0];
    const dowCount={};sessoes.forEach(s=>{const d=new Date(s.iniciado_em).getDay();dowCount[d]=(dowCount[d]||0)+1;});
    const diaTop=Object.entries(dowCount).sort((a,b)=>b[1]-a[1])[0];
    const prs={};finExs.filter(r=>r.carga_usada&&r.status==='feito').forEach(r=>{const c=parseFloat(r.carga_usada);if(!prs[r.exercicio_id]||c>prs[r.exercicio_id].carga)prs[r.exercicio_id]={nome:r.nome_snapshot,carga:c};});
    const prList=Object.values(prs).sort((a,b)=>b.carga-a.carga);
    const chartData={};finExs.filter(r=>r.carga_usada&&r.status==='feito').forEach(r=>{if(!chartData[r.exercicio_id])chartData[r.exercicio_id]={nome:r.nome_snapshot,pontos:[]};chartData[r.exercicio_id].pontos.push({d:new Date(r.treinos_sessoes.iniciado_em),c:parseFloat(r.carga_usada)});});
    Object.values(chartData).forEach(cd=>cd.pontos.sort((a,b)=>a.d-b.d));
    const chartOpts=Object.entries(chartData).filter(([,v])=>v.pontos.length>=2);
    if(!statsExSelecionado&&chartOpts.length)statsExSelecionado=chartOpts[0][0];
    let html=`<div class="stat-grid"><div class="stat-card"><div class="stat-val">${mesAtual}</div><div class="stat-label">Treinos este mÃªs</div></div><div class="stat-card"><div class="stat-val">${freqSemanal}</div><div class="stat-label">Freq. semanal mÃ©dia</div></div><div class="stat-card"><div class="stat-val">${streak}</div><div class="stat-label">Semanas seguidas</div></div><div class="stat-card"><div class="stat-val">${tempoMedio}</div><div class="stat-label">Tempo mÃ©dio</div></div><div class="stat-card"><div class="stat-val" style="font-size:14px;line-height:1.3">${maisPulado?maisPulado[0]:'â€“'}</div><div class="stat-label">Mais pulado${maisPulado?` (${maisPulado[1]}x)`:''}</div></div><div class="stat-card"><div class="stat-val" style="font-size:16px">${diaTop?DOW[diaTop[0]]:'â€“'}</div><div class="stat-label">Dia preferido</div></div></div>`;
    html+=`<div class="stats-section-title"><i class="fa-solid fa-chart-line" style="color:var(--accent);margin-right:6px"></i>EvoluÃ§Ã£o de carga</div><div class="chart-card">`;
    if(chartOpts.length){html+=`<select class="form-input" style="margin-bottom:14px" onchange="statsExSelecionado=this.value;render()">${chartOpts.map(([id,v])=>`<option value="${id}"${id===statsExSelecionado?' selected':''}>${v.nome}</option>`).join('')}</select>${buildChart(chartData[statsExSelecionado])}`;}
    else{html+=`<div class="chart-empty">Registre cargas em pelo menos 2 treinos do mesmo exercÃ­cio.</div>`;}
    html+=`</div><div class="stats-section-title"><i class="fa-solid fa-trophy" style="color:var(--accent);margin-right:6px"></i>Recordes pessoais</div>`;
    if(prList.length){html+=prList.map(p=>`<div class="pr-item"><div class="pr-item-name">${p.nome}</div><div class="pr-item-val">${p.carga}kg</div></div>`).join('');}
    else{html+=`<div class="empty" style="padding:24px"><div class="empty-text">Registre cargas para acumular recordes.</div></div>`;}
    html+=`<button class="export-btn" onclick="exportarStats()"><i class="fa-solid fa-share-nodes"></i>Compartilhar meus stats</button>`;
    el.innerHTML=html;
  }catch(e){el.innerHTML=`<div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="empty-text">Erro ao calcular.<br><small>${e.message}</small></div></div>`;}
}
function buildChart(cd){if(!cd||cd.pontos.length<2)return '<div class="chart-empty">Sem dados suficientes.</div>';const W=320,H=160,P=28;const pts=cd.pontos;const cs=pts.map(p=>p.c);let min=Math.min(...cs),max=Math.max(...cs);if(min===max){min-=1;max+=1;}const pad=(max-min)*0.15;min-=pad;max+=pad;const x=i=>P+((W-2*P)*(pts.length===1?0.5:i/(pts.length-1)));const y=c=>H-P-((c-min)/(max-min))*(H-2*P);const line=pts.map((p,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ');const dots=pts.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.c).toFixed(1)}" r="4" fill="var(--accent)"/>`).join('');const labels=pts.map((p,i)=>{if(pts.length>6&&i!==0&&i!==pts.length-1&&i%Math.ceil(pts.length/4)!==0)return '';return `<text x="${x(i).toFixed(1)}" y="${(y(p.c)-9).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text2)">${p.c}</text>`;}).join('');const d1=pts[0].d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});const d2=pts[pts.length-1].d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto"><path d="${line}" stroke="var(--accent)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}<text x="${P}" y="${H-8}" font-size="10" fill="var(--text3)">${d1}</text><text x="${W-P}" y="${H-8}" text-anchor="end" font-size="10" fill="var(--text3)">${d2}</text></svg><div style="font-size:12px;color:var(--text3);text-align:center;margin-top:8px">${pts.length} registros Â· ${pts[0].c}kg â†’ ${pts[pts.length-1].c}kg</div>`;}

let CAT_MODELOS=[];      // catÃ¡logo carregado do banco
let CAT_EX_BY_CAT={};    // exercÃ­cios do catÃ¡logo agrupados por categoria (fallback p/ "do zero")
const OBJETIVOS=[
  {k:'hipertrofia',nome:'Hipertrofia',desc:'Ganhar massa muscular',icon:'fa-dumbbell'},
  {k:'forca',nome:'ForÃ§a',desc:'Levantar mais peso',icon:'fa-weight-hanging'},
  {k:'emagrecimento',nome:'Emagrecimento',desc:'Perder gordura',icon:'fa-fire-flame-curved'},
  {k:'condicionamento',nome:'Condicionamento',desc:'SaÃºde e resistÃªncia',icon:'fa-heart-pulse'},
];
const NIVEIS=[
  {k:'iniciante',nome:'Iniciante',desc:'ComeÃ§ando agora'},
  {k:'intermediario',nome:'IntermediÃ¡rio',desc:'JÃ¡ treino hÃ¡ meses'},
  {k:'avancado',nome:'AvanÃ§ado',desc:'Treino hÃ¡ anos'},
];

async function loadCatalogo(){
  try{
    CAT_MODELOS=await db.getCatModelos()||[];
    const exs=await db.getCatExercicios()||[];
    CAT_EX_BY_CAT={};
    exs.forEach(e=>{(CAT_EX_BY_CAT[e.categoria]=CAT_EX_BY_CAT[e.categoria]||[]).push(e);});
  }catch(e){CAT_MODELOS=[];CAT_EX_BY_CAT={};}
}

let wiz=null;
async function startWizard(){
  wiz={step:1,maxStep:5,categorias:JSON.parse(JSON.stringify(CATEGORIAS)),
       objetivo:null,nivel:null,modeloId:null,modeloDias:null,
       nomeRotina:'',freq:3,dias:[],diaAtual:0,exsTemp:[]};
  hideAll();
  const ws=document.getElementById('wizard-screen');ws.style.display='flex';ws.style.flexDirection='column';
  if(!CAT_MODELOS.length){
    document.getElementById('wiz-content').innerHTML='<div class="loading" style="padding-top:120px"><div class="spinner"></div>Carregando catÃ¡logo...</div>';
    await loadCatalogo();
  }
  renderWizard();
}
function setWizProgress(){
  const pct=Math.round((wiz.step/wiz.maxStep)*100);
  document.getElementById('wiz-progress-bar').style.width=pct+'%';
  document.getElementById('wiz-back').style.visibility=wiz.step>1?'visible':'hidden';
}
function wizBack(){
  if(wiz.step>1){
    if(wiz.step===5&&wiz.diaAtual>0){wiz.diaAtual--;wiz.exsTemp=wiz.dias[wiz.diaAtual]?.exercicios||[];renderWizard();return;}
    wiz.step--;renderWizard();
  }
}
function renderWizard(){
  setWizProgress();
  const c=document.getElementById('wiz-content');
  if(wiz.step===1)c.innerHTML=wizStepCategorias();
  else if(wiz.step===2)c.innerHTML=wizStepObjetivo();
  else if(wiz.step===3)c.innerHTML=wizStepModelo();
  else if(wiz.step===4)c.innerHTML=wizStepNome();
  else if(wiz.step===5)c.innerHTML=wizStepDias();
}

function wizStepCategorias(){
  return `<div class="wiz-step-tag">Passo 1 de 5</div>
  <div class="wiz-title">Suas categorias</div>
  <div class="wiz-sub">Categorias agrupam seus exercÃ­cios (ex: Peito, Perna). JÃ¡ deixamos as principais â€” ajuste como quiser.</div>
  <div id="wiz-cat-list">${wiz.categorias.map(c=>`<span class="wiz-cat-chip">${c.nome}<i class="fa-solid fa-xmark" onclick="wizDelCat('${c.id}')"></i></span>`).join('')}</div>
  <button class="wiz-add-ex" onclick="wizAddCat()" style="margin-top:14px"><i class="fa-solid fa-plus"></i> Adicionar categoria</button>
  <div class="wiz-footer"><button class="wiz-btn" onclick="wizGoObjetivo()">Continuar</button></div>`;
}
function wizDelCat(id){wiz.categorias=wiz.categorias.filter(c=>c.id!==id);renderWizard();}
function wizAddCat(){
  openModal(`<div class="modal-title">Nova categoria</div><div class="form-group"><input class="form-input" id="wiz-cat-nome" placeholder="Ex: GlÃºteo, Cardio" autocomplete="off"/></div><button class="btn-primary" onclick="wizSaveCat()">Adicionar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);
  setTimeout(()=>document.getElementById('wiz-cat-nome')?.focus(),200);
}
function wizSaveCat(){
  const nome=document.getElementById('wiz-cat-nome').value.trim();
  if(!nome)return;
  if(wiz.categorias.some(c=>c.nome.toLowerCase()===nome.toLowerCase())){showToast('JÃ¡ existe.','error');return;}
  wiz.categorias.push({id:uid(),nome,_novo:true});_closeModal();renderWizard();
}
function wizGoObjetivo(){wiz.step=2;renderWizard();}

function wizStepObjetivo(){
  return `<div class="wiz-step-tag">Passo 2 de 5</div>
  <div class="wiz-title">Qual seu objetivo?</div>
  <div class="wiz-sub">Usamos isso para sugerir os melhores modelos de treino para vocÃª.</div>
  ${OBJETIVOS.map(o=>`<div class="wiz-opt${wiz.objetivo===o.k?' selected':''}" onclick="wizSelObjetivo('${o.k}')"><div class="wiz-opt-icon"><i class="fa-solid ${o.icon}"></i></div><div class="wiz-opt-info"><div class="wiz-opt-nome">${o.nome}</div><div class="wiz-opt-desc">${o.desc}</div></div><div class="wiz-opt-check"><i class="fa-solid fa-check"></i></div></div>`).join('')}
  <div class="wiz-sub" style="margin-top:22px;margin-bottom:12px">E seu nÃ­vel de experiÃªncia?</div>
  <div class="wiz-toggle" style="flex-wrap:wrap">${NIVEIS.map(n=>`<button class="wiz-toggle-btn${wiz.nivel===n.k?' selected':''}" onclick="wizSelNivel('${n.k}')" style="flex:1 1 30%">${n.nome}</button>`).join('')}</div>
  <div class="wiz-footer"><button class="wiz-btn" onclick="wizGoModelo()">Continuar</button></div>`;
}
function wizSelObjetivo(k){wiz.objetivo=k;renderWizard();}
function wizSelNivel(k){wiz.nivel=k;renderWizard();}
function wizGoModelo(){
  if(!wiz.objetivo){showToast('Escolha um objetivo.','error');return;}
  if(!wiz.nivel){showToast('Escolha seu nÃ­vel.','error');return;}
  wiz.step=3;renderWizard();
}

function wizStepModelo(){
  const ranked=[...CAT_MODELOS].map(m=>{
    let score=0;
    if(m.objetivo===wiz.objetivo)score+=2;
    if(m.nivel===wiz.nivel)score+=1;
    if(m.nivel==='todos')score+=1;
    return {...m,_score:score};
  }).sort((a,b)=>b._score-a._score);
  let html=`<div class="wiz-step-tag">Passo 3 de 5</div>
  <div class="wiz-title">Escolha um modelo</div>
  <div class="wiz-sub">Modelos prontos com exercÃ­cios sugeridos. Os <strong>recomendados</strong> para seu perfil aparecem primeiro.</div>`;
  html+=`<div class="wiz-opt${wiz.modeloId==='zero'?' selected':''}" onclick="wizSelModelo('zero')"><div class="wiz-opt-icon"><i class="fa-solid fa-pen-ruler"></i></div><div class="wiz-opt-info"><div class="wiz-opt-nome">ComeÃ§ar do zero</div><div class="wiz-opt-desc">Monto minha rotina manualmente</div></div><div class="wiz-opt-check"><i class="fa-solid fa-check"></i></div></div>`;
  ranked.forEach(m=>{
    const rec=m._score>=2;
    html+=`<div class="wiz-opt${wiz.modeloId===m.id?' selected':''}" onclick="wizSelModelo('${m.id}')"><div class="wiz-opt-icon"><i class="fa-solid ${m.icon||'fa-layer-group'}"></i></div><div class="wiz-opt-info"><div class="wiz-opt-nome">${m.nome}${rec?' <span style="color:var(--accent);font-size:11px;font-weight:700">â˜… recomendado</span>':''}</div><div class="wiz-opt-desc">${m.descricao||''}</div></div><div class="wiz-opt-check"><i class="fa-solid fa-check"></i></div></div>`;
  });
  html+=`<div class="wiz-footer"><button class="wiz-btn" onclick="wizGoNome()">Continuar</button></div>`;
  return html;
}
function wizSelModelo(id){wiz.modeloId=id;renderWizard();}
async function wizGoNome(){
  if(!wiz.modeloId){showToast('Escolha um modelo ou "do zero".','error');return;}
  if(wiz.modeloId!=='zero'&&!sessionStorage.getItem('_tl_disc')){showDisclaimer();return;}
  wiz.step=4;renderWizard();
}
function showDisclaimer(){
  openModal(`<div class="modal-handle"></div><div class="modal-title">Uma observaÃ§Ã£o importante</div><div style="font-size:14px;color:var(--text2);line-height:1.65;margin-bottom:20px"><p style="margin-bottom:12px">Os treinos sugeridos neste aplicativo foram desenvolvidos com base em princÃ­pios gerais de musculaÃ§Ã£o e servem como ponto de partida para a sua rotina.</p><p style="margin-bottom:12px">O TreinoLog nÃ£o substitui a avaliaÃ§Ã£o de um profissional de EducaÃ§Ã£o FÃ­sica. Cada corpo Ã© Ãºnico â€” um personal trainer pode adaptar o treino Ã  sua condiÃ§Ã£o fÃ­sica, histÃ³rico de lesÃµes e objetivos reais.</p><p>Use os modelos como referÃªncia, ouÃ§a seu corpo e, sempre que possÃ­vel, busque orientaÃ§Ã£o profissional.</p></div><button class="btn-primary" onclick="aceitarDisclaimer()">Entendi, vamos treinar</button><button class="btn-secondary" onclick="_closeModal()">Escolher outro modelo</button>`);
}
function aceitarDisclaimer(){
  sessionStorage.setItem('_tl_disc','1');
  _closeModal();
  wiz.step=4;renderWizard();
}

function wizStepNome(){
  const modelo=wiz.modeloId==='zero'?null:CAT_MODELOS.find(m=>m.id===wiz.modeloId);
  const sugestaoNome=modelo?modelo.nome:'';
  const freqSug=modelo&&modelo.dias_sugeridos?modelo.dias_sugeridos:wiz.freq;
  if(modelo&&!wiz._freqTouched)wiz.freq=freqSug;
  return `<div class="wiz-step-tag">Passo 4 de 5</div>
  <div class="wiz-title">Nome da rotina</div>
  <div class="wiz-note"><i class="fa-solid fa-circle-info"></i><div>Este Ã© sÃ³ o <strong>nome do plano</strong> â€” ainda nÃ£o Ã© o treino em si. Ex: "Treino ABC", "Hipertrofia 2025".</div></div>
  <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="wiz-nome" value="${wiz.nomeRotina||sugestaoNome}" placeholder="Ex: Treino ABC" autocomplete="off"/></div>
  <div class="form-group" style="margin-top:18px"><label class="form-label">Quantos treinos por semana?</label>
    <div class="wiz-freq-grid">${[2,3,4,5].map(n=>`<button class="wiz-freq-btn${wiz.freq===n?' selected':''}" onclick="wizSelFreq(${n})">${n}<span>dias</span></button>`).join('')}</div>
    <div class="wiz-freq-grid" style="grid-template-columns:repeat(2,1fr)">${[6,7].map(n=>`<button class="wiz-freq-btn${wiz.freq===n?' selected':''}" onclick="wizSelFreq(${n})">${n}<span>dias</span></button>`).join('')}</div>
  </div>
  <div class="wiz-footer"><button class="wiz-btn" onclick="wizGoDias()">Continuar</button></div>`;
}
function wizSelFreq(n){wiz.freq=n;wiz._freqTouched=true;document.getElementById('wiz-nome')&&(wiz.nomeRotina=document.getElementById('wiz-nome').value);renderWizard();}
async function wizGoDias(){
  const nome=document.getElementById('wiz-nome').value.trim();
  if(!nome){showToast('DÃª um nome Ã  rotina.','error');return;}
  wiz.nomeRotina=nome;
  if(wiz.modeloId==='zero'){
    wiz.dias=[{nome:'',foco:[],exercicios:[]}];
  } else {
    const c=document.getElementById('wiz-content');
    c.innerHTML='<div class="loading" style="padding-top:120px"><div class="spinner"></div>Montando seu treino...</div>';
    try{
      const dias=await db.getCatModeloDias(wiz.modeloId)||[];
      wiz.dias=[];
      for(const d of dias){
        const diaExs=await db.getCatDiaExercicios(d.id)||[];
        const exercicios=diaExs.map(de=>({
          id:uid(),
          nome:de.catalogo_exercicios?.nome||de.nome||'ExercÃ­cio',
          categoria:de.catalogo_exercicios?.categoria||'Outros',
          series:de.series,repeticoes:de.reps,descanso_segundos:de.descanso
        }));
        wiz.dias.push({nome:d.nome,foco:d.foco?(Array.isArray(d.foco)?d.foco:String(d.foco).split(',')):[],exercicios,_temSugestao:exercicios.length>0});
      }
      if(!wiz.dias.length)wiz.dias=[{nome:'',foco:[],exercicios:[]}];
    }catch(e){wiz.dias=[{nome:'',foco:[],exercicios:[]}];}
  }
  wiz.diaAtual=0;
  wiz.exsTemp=wiz.dias[0].exercicios||[];
  wiz.step=5;renderWizard();
}

function wizStepDias(){
  const dia=wiz.dias[wiz.diaAtual];
  const ehModelo=wiz.modeloId!=='zero';
  const total=wiz.dias.length;
  const exs=wiz.exsTemp||[];
  let html=`<div class="wiz-step-tag">Passo 5 de 5 Â· Dia ${wiz.diaAtual+1}${ehModelo?` de ${total}`:''}</div>
  <div class="wiz-title">${ehModelo?dia.nome:'Novo dia de treino'}</div>`;
  if(!ehModelo){
    html+=`<div class="wiz-sub">DÃª um nome para este dia (ex: "Treino de Perna", "Peito e Ombro").</div>
    <div class="form-group"><label class="form-label">Nome do dia</label><input class="form-input" id="wiz-dia-nome" value="${dia.nome||''}" placeholder="Ex: Treino de Perna" autocomplete="off" oninput="wiz.dias[wiz.diaAtual].nome=this.value"/></div>`;
  } else if(dia.foco&&dia.foco.length){
    html+=`<div class="wiz-sub">Foco: <strong>${dia.foco.join(', ')}</strong></div>`;
  }
  const precisaPerguntar=!ehModelo && dia.exercicios===null;
  if(precisaPerguntar){
    html+=`<div class="wiz-note" style="background:color-mix(in srgb,var(--accent) 7%,transparent)"><i class="fa-solid fa-wand-magic-sparkles"></i><div>Quer um treino sugerido para este dia? Preenchemos exercÃ­cios com base nas suas categorias â€” vocÃª ajusta depois.</div></div>
    <div class="wiz-toggle"><button class="wiz-toggle-btn" onclick="wizSugestao(true)">Sim, sugerir</button><button class="wiz-toggle-btn" onclick="wizSugestao(false)">NÃ£o, eu monto</button></div>`;
  } else {
    html+=`<div class="wiz-day-card">`;
    if(exs.length){
      html+=exs.map((e,i)=>`<div class="wiz-ex-mini"><div class="wiz-ex-mini-info"><div class="wiz-ex-mini-nome">${e.nome}</div><div class="wiz-ex-mini-sub">${e.categoria} Â· ${e.series}Ã—${e.repeticoes} Â· ${e.descanso_segundos}s</div></div><i class="fa-solid fa-xmark wiz-ex-mini-del" onclick="wizDelEx(${i})"></i></div>`).join('');
    } else {
      html+=`<div style="text-align:center;color:var(--text3);font-size:13px;padding:14px">Nenhum exercÃ­cio ainda.</div>`;
    }
    html+=`<button class="wiz-add-ex" onclick="wizAddEx()"><i class="fa-solid fa-plus"></i> Adicionar exercÃ­cio</button></div>`;
  }
  const ehUltimo=ehModelo?(wiz.diaAtual>=total-1):false;
  html+=`<div class="wiz-footer">`;
  if(ehModelo){
    if(!ehUltimo)html+=`<button class="wiz-btn" onclick="wizProximoDia()">PrÃ³ximo dia â€º</button>`;
    else html+=`<button class="wiz-btn" onclick="wizFinalizar()">Finalizar e comeÃ§ar a treinar</button>`;
  } else {
    html+=`<button class="wiz-btn" onclick="wizSalvarDiaNovo(true)">Salvar e adicionar outro dia</button>`;
    html+=`<button class="wiz-btn-ghost" onclick="wizSalvarDiaNovo(false)">Salvar e finalizar</button>`;
  }
  html+=`</div>`;
  return html;
}
function wizSugestao(sim){
  const dia=wiz.dias[wiz.diaAtual];
  if(sim){
    const cats=wiz.categorias.map(c=>c.nome);
    const gerados=[];
    cats.forEach(cat=>{
      const lib=CAT_EX_BY_CAT[cat]||[];
      lib.slice(0,3).forEach(e=>gerados.push({id:uid(),nome:e.nome,categoria:cat,series:e.series_padrao||4,repeticoes:e.reps_padrao||12,descanso_segundos:e.descanso_padrao||60}));
    });
    wiz.exsTemp=gerados;dia.exercicios=gerados;
    if(!gerados.length)showToast('Sem sugestÃµes no catÃ¡logo. Adicione manualmente.','');
  } else {
    wiz.exsTemp=[];dia.exercicios=[];
  }
  renderWizard();
}
function wizDelEx(i){wiz.exsTemp.splice(i,1);wiz.dias[wiz.diaAtual].exercicios=wiz.exsTemp;renderWizard();}
function wizAddEx(){
  const cats=wiz.categorias.length?wiz.categorias:CATEGORIAS;
  openModal(`<div class="modal-title">Adicionar exercÃ­cio</div>
  <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="wz-en" placeholder="Ex: Supino Reto" autocomplete="off"/></div>
  <div class="form-group"><label class="form-label">Categoria</label><select class="form-input" id="wz-ec">${cats.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('')}</select></div>
  <div class="form-row"><div class="form-group"><label class="form-label">SÃ©ries</label><input class="form-input" id="wz-es" type="number" inputmode="numeric" value="4"/></div><div class="form-group"><label class="form-label">Reps</label><input class="form-input" id="wz-er" type="number" inputmode="numeric" value="12"/></div></div>
  <div class="form-group"><label class="form-label">Descanso (s)</label><input class="form-input" id="wz-ed" type="number" inputmode="numeric" value="60"/></div>
  <button class="btn-primary" onclick="wizSaveEx()">Adicionar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);
  setTimeout(()=>document.getElementById('wz-en')?.focus(),200);
}
function wizSaveEx(){
  const nome=document.getElementById('wz-en').value.trim();
  if(!nome){showToast('Digite um nome.','error');return;}
  const ex={id:uid(),nome,categoria:document.getElementById('wz-ec').value,series:parseInt(document.getElementById('wz-es').value)||null,repeticoes:parseInt(document.getElementById('wz-er').value)||null,descanso_segundos:parseInt(document.getElementById('wz-ed').value)||60};
  if(!wiz.exsTemp)wiz.exsTemp=[];
  wiz.exsTemp.push(ex);wiz.dias[wiz.diaAtual].exercicios=wiz.exsTemp;
  _closeModal();renderWizard();
}
function wizProximoDia(){
  wiz.dias[wiz.diaAtual].exercicios=wiz.exsTemp;
  wiz.diaAtual++;
  wiz.exsTemp=wiz.dias[wiz.diaAtual].exercicios||null;
  if(wiz.exsTemp===null)wiz.dias[wiz.diaAtual].exercicios=null;
  renderWizard();
}
function wizSalvarDiaNovo(adicionarOutro){
  const dia=wiz.dias[wiz.diaAtual];
  if(!dia.nome||!dia.nome.trim()){showToast('DÃª um nome ao dia.','error');return;}
  dia.exercicios=wiz.exsTemp||[];
  if(adicionarOutro){
    wiz.dias.push({nome:'',foco:[],exercicios:[]});
    wiz.diaAtual++;wiz.exsTemp=[];
    wiz.dias[wiz.diaAtual].exercicios=null; // forÃ§a a pergunta de sugestÃ£o de novo
    renderWizard();
  } else {
    wizFinalizar();
  }
}

async function wizFinalizar(){
  if(wiz.modeloId!=='zero')wiz.dias[wiz.diaAtual].exercicios=wiz.exsTemp;
  const c=document.getElementById('wiz-content');
  c.innerHTML=`<div class="loading" style="padding-top:120px"><div class="spinner"></div>Criando sua rotina...</div>`;
  document.getElementById('wiz-back').style.visibility='hidden';
  try{
    await wizSyncCategorias();
    const grupoId=uid();
    await db.insertGrupo({id:grupoId,nome:wiz.nomeRotina,ativo:true,freq_semanal:wiz.freq});
    for(const dia of wiz.dias){
      if(!dia.nome||!dia.nome.trim())continue;
      const treinoId=uid();
      await db.insertTreino({id:treinoId,grupo_id:grupoId,nome:dia.nome.trim()});
      const exs=dia.exercicios||[];
      for(let i=0;i<exs.length;i++){
        const e=exs[i];
        await db.insertExercicio({id:uid(),treino_id:treinoId,nome:e.nome,categoria:e.categoria,series:e.series,repeticoes:e.repeticoes,carga_atual:null,descanso_segundos:e.descanso_segundos,posicao:i});
      }
    }
    wiz=null;
    document.getElementById('wizard-screen').style.display='none';
    showApp();
    await loadCategorias();
    await init();
    showToast('Tudo pronto! Bora treinar ðŸ’ª','success');
  }catch(e){
    c.innerHTML=`<div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="empty-text">Erro ao criar a rotina.<br><small>${e.message}</small></div><button class="wiz-btn" style="margin-top:20px" onclick="renderWizard()">Tentar de novo</button></div>`;
  }
}
async function wizSyncCategorias(){
  const atuaisNomes=CATEGORIAS.map(c=>c.nome.toLowerCase());
  for(const c of wiz.categorias){
    if(!atuaisNomes.includes(c.nome.toLowerCase())){
      try{await db.insertCategoria({id:uid(),nome:c.nome,posicao:CATEGORIAS.length});}catch(e){}
    }
  }
  const wizNomes=wiz.categorias.map(c=>c.nome.toLowerCase());
  for(const c of CATEGORIAS){
    if(!wizNomes.includes(c.nome.toLowerCase())&&!String(c.id).startsWith('tmp')){
      try{await db.deleteCategoria(c.id);}catch(e){}
    }
  }
}


async function showGerenciar(){hideAll();const gs=document.getElementById('gerenciar-screen');gs.style.display='flex';gs.style.flexDirection='column';await renderGerenciar();}
async function renderGerenciar(){
  const el=document.getElementById('ger-content');el.innerHTML='<div class="loading"><div class="spinner"></div>Carregando...</div>';
  grupos=await db.getGrupos();grupoAtivo=grupos.find(g=>g.ativo)||null;
  await loadCategorias();
  const atLimit=!_isPro&&grupos.length>=freeMaxGrp();
  let html='';

  html+=`<div class="ger-explainer">
    <div class="ger-explainer-title"><i class="fa-solid fa-circle-info"></i> Como funciona</div>
    <div class="ger-explainer-row"><span class="ger-explainer-step">1</span><div><strong>Rotina</strong> Ã© o seu plano (ex: "Treino ABC"). VocÃª sÃ³ treina uma rotina por vez â€” a marcada como <span style="color:var(--accent)">Ativa</span>.</div></div>
    <div class="ger-explainer-row"><span class="ger-explainer-step">2</span><div>Dentro da rotina ficam os <strong>dias de treino</strong> (ex: "A â€” Peito e TrÃ­ceps").</div></div>
    <div class="ger-explainer-row"><span class="ger-explainer-step">3</span><div>Cada dia tem seus <strong>exercÃ­cios</strong>. Arraste pelo <i class="fa-solid fa-grip-vertical" style="font-size:11px"></i> para reordenar.</div></div>
  </div>`;

  html+=`<div class="ger-section-head"><span>Minhas rotinas</span>${!atLimit?`<button class="ger-section-add" onclick="openAddGrupo()"><i class="fa-solid fa-plus"></i> Nova rotina</button>`:''}</div>`;

  if(!grupos.length){
    html+=`<div class="ger-empty"><i class="fa-solid fa-dumbbell"></i><div>VocÃª ainda nÃ£o tem nenhuma rotina.<br>Crie a primeira para comeÃ§ar a treinar.</div><button class="upsell-btn" style="margin-top:14px" onclick="openAddGrupo()">+ Criar primeira rotina</button></div>`;
  }

  for(const g of grupos){
    const ts=await db.getTreinos(g.id);
    html+=`<div class="ger-rotina${g.ativo?' ativa':''}">
      <div class="ger-rotina-head">
        <div class="ger-rotina-info">
          <div class="ger-rotina-nome">${g.nome}${g.ativo?'<span class="grupo-ativo-badge">Ativa</span>':''}</div>
          <div class="ger-rotina-sub">${ts.length} ${ts.length===1?'dia de treino':'dias de treino'}</div>
        </div>
        <div class="ger-item-actions">
          ${!g.ativo?`<div class="ger-btn" onclick="ativarGrupo('${g.id}')" title="Tornar ativa"><i class="fa-solid fa-circle-check"></i></div>`:''}
          <div class="ger-btn" onclick="openEditGrupo('${g.id}',\`${g.nome.replace(/`/g,'')}\`)" title="Renomear"><i class="fa-solid fa-pen"></i></div>
          <div class="ger-btn danger" onclick="deleteGrupo('${g.id}')" title="Excluir"><i class="fa-solid fa-trash-can"></i></div>
        </div>
      </div>`;
    if(!g.ativo)html+=`<div class="ger-rotina-hint">Toque em <i class="fa-solid fa-circle-check" style="color:var(--accent)"></i> para treinar esta rotina</div>`;
    if(!ts.length){
      html+=`<div class="ger-day-empty">Nenhum dia de treino ainda. <span onclick="openAddTreino('${g.id}')">+ Adicionar dia</span></div>`;
    }
    for(const t of ts){
      const exs=await db.getExercicios(t.id);
      html+=`<div class="ger-day">
        <div class="ger-day-head">
          <div style="flex:1;min-width:0"><div class="ger-day-nome">${t.nome}</div><div class="ger-day-sub">${exs.length} ${exs.length===1?'exercÃ­cio':'exercÃ­cios'}</div></div>
          <div class="ger-item-actions">
            <div class="ger-btn" onclick="openEditTreino('${t.id}',\`${t.nome.replace(/`/g,'')}\`)" title="Renomear"><i class="fa-solid fa-pen"></i></div>
            <div class="ger-btn danger" onclick="deleteTreino('${t.id}')" title="Excluir"><i class="fa-solid fa-trash-can"></i></div>
          </div>
        </div>
        <div id="exlist-${t.id}">${exs.map(ex=>`<div class="ger-ex-item" data-exid="${ex.id}" data-tid="${t.id}"><div class="ger-ex-handle"><i class="fa-solid fa-grip-vertical"></i></div><div class="ger-ex-info"><div class="ger-ex-name">${ex.nome}</div><div class="ger-ex-sub">${ex.categoria||'sem categoria'}${ex.series?` Â· ${ex.series}Ã—${ex.repeticoes||'?'}`:''}${ex.carga_atual?` Â· ${ex.carga_atual}kg`:''} Â· descanso ${ex.descanso_segundos||60}s</div></div><div class="ger-item-actions"><div class="ger-btn" onclick="openEditExercicio('${ex.id}','${t.id}')"><i class="fa-solid fa-pen"></i></div><div class="ger-btn danger" onclick="deleteExercicio('${ex.id}')"><i class="fa-solid fa-trash-can"></i></div></div></div>`).join('')}</div>
        <button class="ger-add-inline" onclick="openAddExercicio('${t.id}')"><i class="fa-solid fa-plus"></i> Adicionar exercÃ­cio</button>
      </div>`;
    }
    html+=`<button class="ger-add-inline ger-add-day" onclick="openAddTreino('${g.id}')"><i class="fa-solid fa-plus"></i> Adicionar dia de treino</button>`;
    html+=`</div>`;
  }

  if(atLimit){html+=`<div class="upsell-block"><div class="upsell-lock"><i class="fa-solid fa-lock"></i></div><div class="upsell-title">Limite de ${freeMaxGrp()} rotinas</div><div class="upsell-sub">FaÃ§a upgrade para criar rotinas ilimitadas.</div><button class="upsell-btn" onclick="showUpsell('Rotinas ilimitadas','')">Ver planos</button></div>`;}

  html+=`<div class="ger-section-head" style="margin-top:28px"><span>Categorias de exercÃ­cio</span><button class="ger-section-add" onclick="openAddCategoria()"><i class="fa-solid fa-plus"></i> Nova</button></div>`;
  html+=`<div class="ger-cat-hint">Usadas para agrupar exercÃ­cios durante o treino.</div>`;
  html+=`<div class="ger-cat-wrap" id="ger-cat-wrap">`;
  html+=CATEGORIAS.map(c=>`<div class="ger-cat-chip">${c.nome}<i class="fa-solid fa-xmark" onclick="deleteCategoria('${c.id}')"></i></div>`).join('');
  html+=`</div>`;

  el.innerHTML=html;setupExDrag();
}
function setupExDrag(){
  document.querySelectorAll('.ger-ex-handle').forEach(handle=>{
    let item=null,clone=null,offY=0;
    handle.addEventListener('touchstart',e=>{item=handle.closest('.ger-ex-item');const r=item.getBoundingClientRect();offY=e.touches[0].clientY-r.top;clone=item.cloneNode(true);clone.style.cssText=`position:fixed;left:${r.left}px;width:${r.width}px;top:${r.top}px;z-index:1350;opacity:.9;pointer-events:none;background:var(--surface);border:1px solid var(--accent);border-radius:10px;`;document.body.appendChild(clone);item.classList.add('dragging');},{passive:true});
    handle.addEventListener('touchmove',e=>{if(!clone)return;e.preventDefault();clone.style.top=(e.touches[0].clientY-offY)+'px';const list=item.parentElement;list.querySelectorAll('.ger-ex-item').forEach(i=>i.classList.remove('drag-over'));const over=[...list.querySelectorAll('.ger-ex-item:not(.dragging)')].find(i=>{const r=i.getBoundingClientRect();return e.touches[0].clientY>r.top&&e.touches[0].clientY<r.bottom;});if(over)over.classList.add('drag-over');},{passive:false});
    handle.addEventListener('touchend',async()=>{if(!clone)return;clone.remove();clone=null;item.classList.remove('dragging');const list=item.parentElement;const over=list.querySelector('.ger-ex-item.drag-over');list.querySelectorAll('.ger-ex-item').forEach(i=>i.classList.remove('drag-over'));if(over&&over!==item){list.insertBefore(item,over);const ids=[...list.querySelectorAll('.ger-ex-item')].map(i=>i.dataset.exid);try{await Promise.all(ids.map((id,i)=>db.updateExercicio(id,{posicao:i})));showToast('Ordem salva!','success');}catch{showToast('Erro.','error');}}item=null;});
  });
}
async function ativarGrupo(id){for(const g of grupos)await db.updateGrupo(g.id,{ativo:g.id===id});await renderGerenciar();showToast('Rotina ativada!','success');}
async function deleteGrupo(id){if(!confirm('Excluir esta rotina e todos os seus dias de treino?'))return;await db.deleteGrupo(id);await renderGerenciar();showToast('Rotina excluÃ­da.','success');}
async function deleteTreino(id){if(!confirm('Excluir este dia de treino e seus exercÃ­cios?'))return;await db.deleteTreino(id);await renderGerenciar();showToast('Dia de treino excluÃ­do.','success');}
async function deleteExercicio(id){if(!confirm('Deletar este exercÃ­cio?'))return;await db.deleteExercicio(id);await renderGerenciar();showToast('ExercÃ­cio removido.','success');}
function renderCatChips(){
  const wrap=document.getElementById('ger-cat-wrap');
  if(!wrap)return;
  wrap.innerHTML=CATEGORIAS.map(c=>`<div class="ger-cat-chip">${c.nome}<i class="fa-solid fa-xmark" onclick="deleteCategoria('${c.id}')"></i></div>`).join('')||'<div style="font-size:13px;color:var(--text3)">Nenhuma categoria.</div>';
}
async function deleteCategoria(id){
  if(!confirm('Excluir esta categoria?'))return;
  CATEGORIAS=CATEGORIAS.filter(c=>c.id!==id);renderCatChips();
  try{await db.deleteCategoria(id);showToast('Categoria removida.','success');}
  catch{showToast('Erro ao remover.','error');await loadCategorias();renderCatChips();}
}
async function saveCategoria(){
  const nome=document.getElementById('f-catNome').value.trim();
  if(!nome){showToast('Digite um nome.','error');return;}
  if(CATEGORIAS.some(c=>c.nome.toLowerCase()===nome.toLowerCase())){showToast('Essa categoria jÃ¡ existe.','error');return;}
  const btn=document.getElementById('btn-sc');btn.disabled=true;btn.textContent='Salvando...';
  const novoId=uid();
  try{
    await db.insertCategoria({id:novoId,nome,posicao:CATEGORIAS.length});
    CATEGORIAS.push({id:novoId,nome});renderCatChips();
    _closeModal();showToast('Categoria criada!','success');
  }catch{showToast('Erro.','error');btn.disabled=false;btn.textContent='Salvar';}
}
function openAddCategoria(){openModal(`<div class="modal-title">Nova categoria</div><div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="f-catNome" placeholder="Ex: GlÃºteo, Panturrilha, Cardio" autocomplete="off"/></div><button class="btn-primary" id="btn-sc" onclick="saveCategoria()">Salvar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);setTimeout(()=>document.getElementById('f-catNome')?.focus(),200);}


function openModal(html){document.getElementById('modal-content').innerHTML=html;document.getElementById('modal-overlay').classList.add('open');}
function _closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
document.getElementById('modal-overlay').addEventListener('click',e=>{if(e.target.id==='modal-overlay')_closeModal();});
function openAddGrupo(){openModal(`<div class="modal-title">Nova rotina</div><div style="font-size:13px;color:var(--text2);margin-bottom:14px">Uma rotina Ã© o seu plano de treino (ex: "Treino ABC", "Push/Pull/Legs").</div><div class="form-group"><label class="form-label">Nome da rotina</label><input class="form-input" id="f-gnome" placeholder="Ex: Treino ABC" autocomplete="off"/></div><button class="btn-primary" id="btn-sg" onclick="saveGrupo(null)">Criar rotina</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);setTimeout(()=>document.getElementById('f-gnome')?.focus(),200);}
function openEditGrupo(id,nome){openModal(`<div class="modal-title">Renomear rotina</div><div class="form-group"><label class="form-label">Nome da rotina</label><input class="form-input" id="f-gnome" value="${nome}" autocomplete="off"/></div><button class="btn-primary" id="btn-sg" onclick="saveGrupo('${id}')">Salvar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);setTimeout(()=>document.getElementById('f-gnome')?.focus(),200);}
async function saveGrupo(id){const nome=document.getElementById('f-gnome').value.trim();if(!nome){showToast('Digite um nome.','error');return;}const btn=document.getElementById('btn-sg');btn.disabled=true;btn.textContent='Salvando...';try{if(id)await db.updateGrupo(id,{nome});else await db.insertGrupo({id:uid(),nome,ativo:grupos.length===0});_closeModal();await renderGerenciar();showToast(id?'Rotina renomeada!':'Rotina criada!','success');}catch{showToast('Erro.','error');btn.disabled=false;btn.textContent='Salvar';}}
function openAddTreino(gid){openModal(`<div class="modal-title">Novo dia de treino</div><div style="font-size:13px;color:var(--text2);margin-bottom:14px">Um dia de treino agrupa os exercÃ­cios de uma sessÃ£o (ex: "A â€” Peito e TrÃ­ceps").</div><div class="form-group"><label class="form-label">Nome do dia</label><input class="form-input" id="f-tnome" placeholder="Ex: A â€” Peito e TrÃ­ceps" autocomplete="off"/></div><button class="btn-primary" id="btn-st" onclick="saveTreino(null,'${gid}')">Criar dia</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);setTimeout(()=>document.getElementById('f-tnome')?.focus(),200);}
function openEditTreino(id,nome){openModal(`<div class="modal-title">Renomear dia de treino</div><div class="form-group"><label class="form-label">Nome do dia</label><input class="form-input" id="f-tnome" value="${nome}" autocomplete="off"/></div><button class="btn-primary" id="btn-st" onclick="saveTreino('${id}',null)">Salvar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);setTimeout(()=>document.getElementById('f-tnome')?.focus(),200);}
async function saveTreino(id,gid){const nome=document.getElementById('f-tnome').value.trim();if(!nome){showToast('Digite um nome.','error');return;}const btn=document.getElementById('btn-st');btn.disabled=true;btn.textContent='Salvando...';try{if(id)await db.updateTreino(id,{nome});else await db.insertTreino({id:uid(),grupo_id:gid,nome});_closeModal();await renderGerenciar();showToast(id?'Dia renomeado!':'Dia criado!','success');}catch{showToast('Erro.','error');btn.disabled=false;btn.textContent='Salvar';}}
function catSelect(sel){
  const lista = CATEGORIAS.length?CATEGORIAS:CATEGORIAS_PADRAO.map((nome,i)=>({id:'tmp'+i,nome}));
  return `<select class="form-input" id="f-ecat">${lista.map(c=>`<option value="${c.nome}"${sel===c.nome?' selected':''}>${c.nome}</option>`).join('')}</select>`;
}
function exercicioFormHtml(ex){return `<div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="f-enome" value="${ex?.nome||''}" placeholder="Ex: Supino Reto" autocomplete="off"/></div><div class="form-group"><label class="form-label">Categoria</label>${catSelect(ex?.categoria||'')}</div><div class="form-row"><div class="form-group"><label class="form-label">SÃ©ries</label><input class="form-input" id="f-eser" type="number" inputmode="numeric" value="${ex?.series||''}" placeholder="4"/></div><div class="form-group"><label class="form-label">Reps</label><input class="form-input" id="f-erep" type="number" inputmode="numeric" value="${ex?.repeticoes||''}" placeholder="12"/></div></div><div class="form-row"><div class="form-group"><label class="form-label">Carga (kg)</label><input class="form-input" id="f-ecarga" type="number" inputmode="decimal" value="${ex?.carga_atual||''}" placeholder="opcional"/></div><div class="form-group"><label class="form-label">Descanso (s)</label><input class="form-input" id="f-edes" type="number" inputmode="numeric" value="${ex?.descanso_segundos||''}" placeholder="60"/></div></div>`;}
async function openAddExercicio(tid){if(!CATEGORIAS.length)await loadCategorias();openModal(`<div class="modal-title">Novo ExercÃ­cio</div>${exercicioFormHtml(null)}<button class="btn-primary" id="btn-se" onclick="saveExercicio(null,'${tid}')">Salvar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);}
async function openEditExercicio(exId,tid){if(!CATEGORIAS.length)await loadCategorias();const exs=await db.getExercicios(tid);const ex=exs.find(e=>e.id===exId);if(!ex)return;openModal(`<div class="modal-title">Editar ExercÃ­cio</div>${exercicioFormHtml(ex)}<button class="btn-primary" id="btn-se" onclick="saveExercicio('${exId}','${tid}')">Salvar</button><button class="btn-secondary" onclick="_closeModal()">Cancelar</button>`);}
async function saveExercicio(id,tid){const nome=document.getElementById('f-enome').value.trim();const cat=document.getElementById('f-ecat').value;const series=parseInt(document.getElementById('f-eser').value)||null;const reps=parseInt(document.getElementById('f-erep').value)||null;const carga=parseFloat(document.getElementById('f-ecarga').value)||null;const desc=parseInt(document.getElementById('f-edes').value)||60;if(!nome){showToast('Digite um nome.','error');return;}const btn=document.getElementById('btn-se');btn.disabled=true;btn.textContent='Salvando...';try{const exs=await db.getExercicios(tid);if(id)await db.updateExercicio(id,{nome,categoria:cat,series,repeticoes:reps,carga_atual:carga,descanso_segundos:desc});else await db.insertExercicio({id:uid(),treino_id:tid,nome,categoria:cat,series,repeticoes:reps,carga_atual:carga,descanso_segundos:desc,posicao:exs.length});_closeModal();await renderGerenciar();showToast('ExercÃ­cio salvo!','success');}catch{showToast('Erro.','error');btn.disabled=false;btn.textContent='Salvar';}}

function showTutorial(){hideAll();const ts=document.getElementById('tutorial-screen');ts.style.display='flex';ts.style.flexDirection='column';renderTutorial();}
function renderTutorial(){
  document.getElementById('tutorial-content').innerHTML=`
  <div class="tut-section"><div class="tut-section-title"><i class="fa-solid fa-layer-group" style="color:var(--accent)"></i> A estrutura</div><div class="tut-text">O app se organiza em trÃªs nÃ­veis:</div><div class="tut-step"><div class="tut-step-num">1</div><div class="tut-step-text"><strong>Rotina</strong> â€” seu plano completo (ex: "Treino ABC"). VocÃª treina uma rotina por vez.</div></div><div class="tut-step"><div class="tut-step-num">2</div><div class="tut-step-text"><strong>Dia de treino</strong> â€” cada sessÃ£o da rotina (ex: "A â€” Peito e TrÃ­ceps").</div></div><div class="tut-step"><div class="tut-step-num">3</div><div class="tut-step-text"><strong>ExercÃ­cios</strong> â€” o que vocÃª faz em cada dia.</div></div></div>
  <div class="tut-section"><div class="tut-section-title"><i class="fa-solid fa-house" style="color:var(--accent)"></i> Tela Hoje</div><div class="tut-text">O <strong>card grande</strong> mostra o dia de treino sugerido â€” o que hÃ¡ mais tempo sem fazer. Toque para iniciar.</div><div class="tut-text">Toque em outro dia abaixo para colocÃ¡-lo em destaque.</div></div>
  <div class="tut-section"><div class="tut-section-title"><i class="fa-solid fa-dumbbell" style="color:var(--accent)"></i> Durante o treino</div><div class="tut-step"><div class="tut-step-num">1</div><div class="tut-step-text">Toque num exercÃ­cio para tornÃ¡-lo o <strong>atual</strong> (borda roxa).</div></div><div class="tut-step"><div class="tut-step-num">2</div><div class="tut-step-text">Terminou a sÃ©rie? Aperte <strong>â–¶</strong> â€” conta +1 sÃ©rie e comeÃ§a o descanso.</div></div><div class="tut-step"><div class="tut-step-num">3</div><div class="tut-step-text">Na <strong>Ãºltima sÃ©rie</strong>, o botÃ£o vira <span style="color:var(--accent);font-weight:600">Concluir exercÃ­cio</span> â€” sem descanso, jÃ¡ marca como feito.</div></div><div class="tut-tip">ðŸ”” Toque no Ã­cone de som no topo para escolher o alerta de fim de descanso. A tela fica acesa durante o descanso.</div></div>
  <div class="tut-section"><div class="tut-section-title"><i class="fa-solid fa-hand-pointer" style="color:var(--accent)"></i> Gestos</div><div class="tut-text">âž¡ï¸ Arraste o exercÃ­cio para a <span style="color:var(--green);font-weight:500">direita</span>: <strong>Feito</strong>.</div><div class="tut-text">â¬…ï¸ Arraste para a <span style="color:var(--orange);font-weight:500">esquerda</span>: <strong>Pular</strong>.</div><div class="tut-text">Deslize da <strong>borda esquerda da tela</strong> para voltar de qualquer lugar.</div></div>
  <div class="tut-section"><div class="tut-section-title"><i class="fa-solid fa-sliders" style="color:var(--accent)"></i> Gerenciar</div><div class="tut-text">Toque na engrenagem no topo para criar e organizar suas rotinas, dias de treino e exercÃ­cios.</div><div class="tut-text">Arraste os exercÃ­cios pelo <i class="fa-solid fa-grip-vertical" style="font-size:12px;color:var(--text3)"></i> para reordenar. Crie suas prÃ³prias <strong>categorias</strong> (GlÃºteo, Cardio, etc).</div></div>
  <div class="tut-section"><div class="tut-section-title"><i class="fa-solid fa-bolt" style="color:var(--accent)"></i> Recursos Pro</div><div class="tut-text"><strong>Modo Foco</strong> (timer em tela cheia) Â· <strong>ReferÃªncia de carga</strong> (Ãºltimas cargas de cada exercÃ­cio) Â· <strong>Stats e grÃ¡ficos</strong> Â· <strong>CalendÃ¡rio completo</strong> Â· <strong>Acervo de recordes</strong>.</div><div class="tut-text">Durante seu perÃ­odo de teste vocÃª tem acesso a tudo. Aproveite! ðŸ’ª</div></div>
  <button class="btn-primary" onclick="hideOverlayScreen()" style="margin-top:4px">Entendi, voltar ao app</button><div style="height:20px"></div>`;
}

const COACH_STEPS=[
  {sel:'.hero-card',text:'Este Ã© o seu <strong>treino sugerido</strong> â€” o que estÃ¡ hÃ¡ mais tempo sem fazer. Toque nele para comeÃ§ar a treinar.',pos:'bottom'},
  {sel:'.tabs',text:'Navegue entre <strong>Hoje</strong> (seu treino), <strong>CalendÃ¡rio</strong> (histÃ³rico) e <strong>Stats</strong> (sua evoluÃ§Ã£o).',pos:'bottom'},
  {sel:'#header-status-badge',text:'Aqui aparece seu plano. Durante o <strong>perÃ­odo de teste</strong> vocÃª tem acesso a tudo.',pos:'bottom'},
  {sel:'.header-actions',text:'Tema claro/escuro, este tutorial, <strong>gerenciar</strong> suas rotinas e sair da conta.',pos:'bottom'},
  {sel:null,text:'Pronto! Toque no treino sugerido para comeÃ§ar. Bons treinos! ðŸ’ª',pos:'center'},
];
let coachIdx=0;
function maybeStartCoach(){
  try{ if(localStorage.getItem('_tl_coach_done'))return; }catch(e){}
  if(!grupoAtivo||!treinos.length)return; // sÃ³ com home preenchida
  coachIdx=0;
  setTimeout(()=>{document.getElementById('coach-overlay').classList.add('active');renderCoach();},400);
}
function renderCoach(){
  const step=COACH_STEPS[coachIdx];
  const hole=document.getElementById('coach-hole');
  const tip=document.getElementById('coach-tip');
  const txt=document.getElementById('coach-tip-text');
  txt.innerHTML=step.text;
  document.getElementById('coach-dots').innerHTML=COACH_STEPS.map((_,i)=>`<div class="coach-dot${i===coachIdx?' active':''}"></div>`).join('');
  document.getElementById('coach-next').textContent=coachIdx>=COACH_STEPS.length-1?'Concluir':'PrÃ³ximo';
  const vw=window.innerWidth,vh=window.innerHeight;
  if(!step.sel){
    hole.style.opacity='0';hole.style.width='0';hole.style.height='0';
    hole.style.left=(vw/2)+'px';hole.style.top=(vh/2)+'px';
    tip.style.left=Math.max(20,(vw-Math.min(320,vw-40))/2)+'px';
    tip.style.top=(vh/2-80)+'px';
    return;
  }
  const el=document.querySelector(step.sel);
  if(!el){coachNext();return;}
  const r=el.getBoundingClientRect();
  const pad=8;
  hole.style.opacity='1';
  hole.style.left=(r.left-pad)+'px';hole.style.top=(r.top-pad)+'px';
  hole.style.width=(r.width+pad*2)+'px';hole.style.height=(r.height+pad*2)+'px';
  const tipW=Math.min(320,vw-40);
  let tipLeft=Math.min(Math.max(20,r.left),vw-tipW-20);
  let tipTop=r.bottom+16;
  if(tipTop+180>vh)tipTop=Math.max(20,r.top-180);
  tip.style.left=tipLeft+'px';tip.style.top=tipTop+'px';
}
function coachNext(){
  if(coachIdx>=COACH_STEPS.length-1){coachFinish();return;}
  coachIdx++;renderCoach();
}
function coachSkip(){coachFinish();}
function coachFinish(){
  document.getElementById('coach-overlay').classList.remove('active');
  try{localStorage.setItem('_tl_coach_done','1');}catch(e){}
}
window.addEventListener('resize',()=>{if(document.getElementById('coach-overlay').classList.contains('active'))renderCoach();});

function formatDur(s){const m=Math.floor(Math.abs(s)/60),sec=Math.abs(s)%60;return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;}
function showToast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),2500);}

document.addEventListener('touchstart',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
let lastTap=0;document.addEventListener('touchend',e=>{if(e.target.closest('button,input,select,textarea'))return;const now=Date.now();if(now-lastTap<300)e.preventDefault();lastTap=now;},{passive:false});

let edgeSwipe=null;
document.addEventListener('touchstart',e=>{if(e.touches.length===1&&e.touches[0].clientX<=28)edgeSwipe={x:e.touches[0].clientX,y:e.touches[0].clientY};else edgeSwipe=null;},{passive:true});
document.addEventListener('touchend',e=>{if(!edgeSwipe)return;const dx=e.changedTouches[0].clientX-edgeSwipe.x;const dy=Math.abs(e.changedTouches[0].clientY-edgeSwipe.y);edgeSwipe=null;if(dx>70&&dy<70)goBack();},{passive:true});
function isVisible(id){const el=document.getElementById(id);return el&&el.style.display&&el.style.display!=='none';}
function goBack(){const splash=document.getElementById('rest-splash');if(splash){splash.remove();return;}if(document.getElementById('modal-overlay').classList.contains('open')){_closeModal();return;}if(focoAberto){fecharFoco();return;}if(isVisible('wizard-screen')){if(wiz&&wiz.step>1)wizBack();return;}if(isVisible('tutorial-screen')||isVisible('gerenciar-screen')){hideOverlayScreen();return;}if(isVisible('resultado-screen')){voltarParaHome();return;}if(isVisible('sessao-screen')){sairSessao();return;}}

loadConfig().then(()=>{applyAppName();});
(function restoreSession(){
  try{
    const raw=localStorage.getItem('_tl_session');
    if(raw){
      const s=JSON.parse(raw);
      if(s&&s.access_token&&s.user){
        _session=s;
        startApp().catch(()=>{
          _session=null;
          try{localStorage.removeItem('_tl_session');}catch(e){}
          document.getElementById('auth-screen').style.display='flex';
        });
      }
    }
  }catch(e){}
})();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('message', e => {
    if(e.data?.type !== 'SW_UPDATED') return;
    const t = document.getElementById('toast');
    if(!t) return;
    t.innerHTML = 'Nova versão disponível. <span style="text-decoration:underline;cursor:pointer" onclick="location.reload()">Atualizar</span>';
    t.className = 'toast show';
  });
}