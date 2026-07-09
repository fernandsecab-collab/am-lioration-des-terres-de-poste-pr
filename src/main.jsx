import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const today = () => new Date().toISOString().slice(0, 10);
const emptyMeasure = {
  id: '', affaire: '', poste: '', codeGdo: '', commune: 'Saint-Denis', typeOuvrage: 'Poste HTA/BT au sol - masses HTA / neutre BT séparés', zone: 'Rurale', regime: '150 A', typeCouplage: 'Séparé',
  date: today(), technicien: '', responsable: '', appareil: '', etalonnage: '', rapport: '', marche: '',
  rm: '4.28', rng: '247', rni: '', rmn: '', rcDirect: '5.09', mode: 'direct', distance: '', resistivite: '98.6',
  gpsLat: '', gpsLng: '', gpsAccuracy: '', observations: '', diagnosticTerrain: '', solutionRetenue: '', materielReprise: '', commentaireBureau: '', reprise: '', cout: '', nextControl: '', visa: '', photos: [], photoType: 'Vue générale de l’ouvrage', photoChecklist: { vuePoste:false, priseTerre:false, raccordements:false, mesureTerca:false, environnement:false },
  quality: { piquets: true, tension: true, shunt: true, distance: false, photo: false, appareil: false, meteo: true, registre: false },
  doe: { fiches: false, essais: false, plan: false, photos: false, rapport: false },
  signatures: { technicien: '', responsable: '', client: '' },
  repriseDone: false, priorityManual: '', client: '', contact: '', ordreTravail: '', echeance: '', statut: 'À contrôler', verrouClient: false
};

const COMMUNES_REUNION = [
  'Bras-Panon','Cilaos','Entre-Deux','L’Étang-Salé','La Plaine-des-Palmistes','La Possession','Le Port','Le Tampon','Les Avirons','Petite-Île','Saint-André','Saint-Benoît','Saint-Denis','Saint-Joseph','Saint-Leu','Saint-Louis','Saint-Paul','Saint-Philippe','Saint-Pierre','Sainte-Marie','Sainte-Rose','Sainte-Suzanne','Salazie','Trois-Bassins'
];

const TYPES_OUVRAGES = [
  'Poste HTA/BT au sol - masses HTA / neutre BT séparés',
  'Poste HTA/BT au sol - masses HTA / neutre BT interconnectés',
  'Poste H61 sur support',
  'Poste cabine maçonné',
  'Poste préfabriqué',
  'Armoire de coupure HTA',
  'IACM / interrupteur aérien HTA',
  'IA2T / IA3T',
  'Remontée aéro-souterraine HTA',
  'Support HTA avec parafoudre',
  'Poteau métallique HTA',
  'Écrans de câbles aériens',
  'Autotransformateur HTA/HTA',
  'Terre du neutre BT individuelle',
  'Terre globale du neutre BT',
  'Terre des masses HTA',
  'Coffret réseau BT / CCPC',
  'Armoire ou coffret EP proche réseau BT',
  'Ouvrage client à proximité réseau EDF',
  'Autre ouvrage à vérifier'
];

const PHOTOS_OBLIGATOIRES = [
  ['vuePoste','Vue générale de l’ouvrage'],
  ['priseTerre','Prise de terre / regard / départ câblette'],
  ['raccordements','Raccordements / barrette / liaisons'],
  ['mesureTerca','Écran TERCA ou valeur de mesure'],
  ['environnement','Environnement et distances RM/RN']
];

const SOLUTIONS_TERRE = [
  'Reprise de continuité et serrage des liaisons de terre',
  'Ajout serpentin cuivre nu en tranchée',
  'Ajout patte d’oie 3 x 10 m',
  'Ajout piquets de terre verticaux',
  'Création / renforcement boucle fond de fouille',
  'Déplacement / éloignement de la terre du neutre si conception non conforme',
  'Ajout terre végétale / amélioration locale du contact sol',
  'Reprise câblette cuivre, raccords C sertis ou soudure aluminothermique',
  'Recontrôle contradictoire RM / RNi / RMN avant travaux',
  'Étude spécifique si résistivité élevée ou configuration atypique'
];

function n(v){ const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; }
function fmt(v, d=3){ return Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—'; }
function uid(){ return 'SEC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase(); }
function daysUntil(date){ if(!date) return null; return Math.ceil((new Date(date) - new Date(today())) / 86400000); }

function distanceRule(rho){
  if (!rho) return {min:0,label:'à renseigner',study:false};
  if (rho < 300) return {min:8,label:'8 m minimum',study:false};
  if (rho < 500) return {min:16,label:'16 m minimum',study:false};
  if (rho < 1000) return {min:24,label:'24 m minimum',study:false};
  return {min:24,label:'à étudier au cas par cas',study:true};
}

function reliabilityScore(m, incoherences=[]){
  let score=100;
  if (!m.appareil) score-=10;
  if (!m.etalonnage) score-=10;
  if (!m.technicien) score-=8;
  if (!m.gpsLat || !m.gpsLng) score-=8;
  if (!m.photos?.length) score-=18;
  const miss = PHOTOS_OBLIGATOIRES.filter(([k])=>!m.photoChecklist?.[k]).length;
  score -= miss * 5;
  if (!m.resistivite) score-=6;
  if (!m.distance) score-=6;
  score-=Math.min(30, incoherences.length*10);
  return Math.max(0, Math.min(100, score));
}

function compute(m){
  const rm=n(m.rm), rni=n(m.rni), rmn=n(m.rmn), rcDirect=n(m.rcDirect), rng=n(m.rng);
  const rcEdf = (rm && rni && rmn) ? (rm + rni - rmn) / 2 : NaN;
  const rc = m.mode === 'edf' ? rcEdf : rcDirect;
  const c = rm ? rc / rm : NaN;
  const ok = Number.isFinite(c) && c < 0.15 && rc >= 0;
  const rcRn = rng ? rc / rng : NaN;
  const incoherences = [];
  if (m.mode === 'edf') {
    if (!rni || !rmn) incoherences.push('RNi et RMN obligatoires pour le calcul EDF complet.');
    if (rni && rng && rni <= rng) incoherences.push('Contrôle B13-23 : vérifier RNi > RNg.');
    if (rm && rni && rmn && rm + rni < rmn) incoherences.push('Contrôle B13-23 : RM + RNi doit être ≥ RMN.');
    if (Number.isFinite(rcEdf) && rcEdf < 0) incoherences.push('Rc EDF négative : mesure incohérente ou branchement à revoir.');
  }
  if (rm <= 0) incoherences.push('RM doit être strictement supérieure à 0.');
  if (rcDirect && m.mode === 'direct' && rcDirect / Math.max(rm, 0.001) >= 0.15) incoherences.push('Couplage non conforme : c ≥ 0,15.');
  const rcMax = rm ? 0.15 * rm : NaN;
  const rcToReduce = Number.isFinite(rc) && Number.isFinite(rcMax) ? Math.max(0, rc - rcMax) : NaN;
  const distanceMin = distanceRule(n(m.resistivite));
  const distanceOk = !n(m.distance) || distanceMin.study || n(m.distance) >= distanceMin.min;
  if (n(m.distance) && !distanceOk) incoherences.push(`Distance RM/RN insuffisante : ${n(m.distance)} m mesuré, ${distanceMin.label} recommandé.`);
  const reliability = reliabilityScore(m, incoherences);
  const due = daysUntil(m.echeance || m.nextControl);
  const priority = m.priorityManual || (!Number.isFinite(c) ? 'À compléter' : ok ? 'Conforme' : c < 0.25 ? 'À reprendre' : 'Urgent');
  const missingPhotos = PHOTOS_OBLIGATOIRES.filter(([k])=>!m.photoChecklist?.[k]);
  if (missingPhotos.length) incoherences.push('Photos obligatoires manquantes : ' + missingPhotos.map(x=>x[1]).join(', ') + '.');
  const diagnosticText = !Number.isFinite(c) ? 'Diagnostic incomplet : valeurs à compléter.' : ok ? 'Couplage conforme : aucune amélioration de terre obligatoire, conserver les justificatifs.' : c < 0.25 ? 'Couplage non conforme : amélioration de terre à planifier et recontrôle obligatoire.' : 'Couplage très défavorable : reprise prioritaire, contrôle contradictoire et solution renforcée.';
  const solutionSuggestions = ok ? ['Archiver les mesures au registre EDF / DOE','Programmer le contrôle périodique suivant','Conserver les photos obligatoires'] : [
    'Vérifier continuité, barrette, raccords et absence de tension permanente',
    'Refaire une mesure contradictoire RM / RNi / RMN avant travaux',
    rcToReduce > 5 ? 'Prévoir solution renforcée : patte d’oie ou serpentin long selon terrain' : 'Prévoir amélioration légère : reprise liaison, piquets ou serpentin court',
    'Après travaux : refaire le calcul c = Rc / RM et joindre les photos TERCA'
  ];
  const risk = !Number.isFinite(c) ? 50 : Math.min(100, Math.round((c / 0.15) * 70 + (100 - reliability) * 0.3 + missingPhotos.length*4));
  return { rm, rni, rmn, rng, rc, rcEdf, c, ok, rcRn, incoherences, priority, rcMax, rcToReduce, distanceMin, distanceOk, reliability, due, risk, missingPhotos, diagnosticText, solutionSuggestions };
}

const seed = [{...emptyMeasure, id: uid(), affaire:'POKOLBIN', poste:'Poste au sol', codeGdo:'97420P7733', commune:'Saint-Denis', rapport:'R-2026-001', marche:'Lot BT', technicien:'Terrain', appareil:'TERCA 3', mode:'direct', client:'MOA / MOE', statut:'Contrôlé'}];

function useLocal(key, initial){
  const [v,setV]=useState(()=>{ try{return JSON.parse(localStorage.getItem(key))||initial}catch{return initial} });
  useEffect(()=>localStorage.setItem(key, JSON.stringify(v)),[key,v]);
  return [v,setV];
}

function App(){
  const [tab,setTab]=useState('dashboard');
  const [records,setRecords]=useLocal('secab-premium-records-v20', seed);
  const [current,setCurrent]=useState(records[0]?.id || '');
  const active=records.find(r=>r.id===current) || records[0] || {...emptyMeasure, id:uid()};
  const stats=useMemo(()=>{
    const cs=records.map(compute); const total=records.length;
    return { total, ok: cs.filter(x=>x.ok).length, ko: cs.filter(x=>!x.ok).length, urgent: cs.filter(x=>x.priority==='Urgent').length, avgReliability: total ? Math.round(cs.reduce((a,b)=>a+b.reliability,0)/total) : 0 };
  },[records]);
  const update=(patch)=>setRecords(rs=>rs.map(r=>r.id===active.id?{...r,...patch}:r));
  const add=()=>{ const rec={...emptyMeasure,id:uid(), rapport:`R-${new Date().getFullYear()}-${String(records.length+1).padStart(3,'0')}`}; setRecords([rec,...records]); setCurrent(rec.id); setTab('mesures'); };
  const duplicate=()=>{ const rec={...active,id:uid(), rapport:`${active.rapport||'R'}-COPIE`, date:today(), statut:'Copie'}; setRecords([rec,...records]); setCurrent(rec.id); };
  const del=()=>{ if(records.length<=1) return; const rest=records.filter(r=>r.id!==active.id); setRecords(rest); setCurrent(rest[0].id); };
  return <div className="app"><Sidebar tab={tab} setTab={setTab} add={add}/><main><Topbar active={active} records={records} setCurrent={setCurrent} add={add} duplicate={duplicate} del={del}/>{tab==='dashboard'&&<Dashboard stats={stats} records={records} setTab={setTab} setCurrent={setCurrent}/>} {tab==='mesures'&&<Mesures m={active} update={update}/>} {tab==='terrain'&&<Terrain m={active} update={update}/>} {tab==='qualite'&&<Qualite m={active} update={update}/>} {tab==='solutions'&&<SolutionsPage m={active} update={update}/>} {tab==='planning'&&<Planning records={records} setCurrent={setCurrent} setTab={setTab}/>} {tab==='client'&&<ClientMode m={active}/>} {tab==='audit'&&<Audit m={active}/>} {tab==='registre'&&<Registre records={records} setRecords={setRecords} active={active}/>} {tab==='rapport'&&<Rapport m={active}/>} {tab==='bureau'&&<Bureau records={records} setCurrent={setCurrent} setTab={setTab}/>}</main></div>;
}

function Sidebar({tab,setTab,add}){
  const items=[['dashboard','Accueil'],['mesures','Mesures EDF'],['terrain','Terrain Android'],['qualite','Qualité'],['solutions','Solutions & reprise'],['planning','Planning reprises'],['client','Présentation client'],['audit','Audit mesure'],['registre','Registre EDF / DOE'],['rapport','Rapport client'],['bureau','Bureau']];
  return <aside><div className="brand"><span>⚡</span><div><b>SECAB</b><small>Couplage Expert Premium</small></div></div>{items.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={tab===id?'on':''}>{label}</button>)}<button className="new" onClick={add}>+ Nouveau contrôle</button><div className="standard">Référentiel verrouillé<br/><b>EDF B13-23</b><br/>c = Rc / RM &lt; 0,15</div></aside>;
}
function Topbar({active,records,setCurrent,add,duplicate,del}){return <header><div><h1>{active.affaire||'Affaire'} <span>{active.poste||'Poste HTA/BT'}</span></h1><p>Application métier terrain + bureau · Android / Windows · rapports, audit et registre EDF</p></div><select value={active.id} onChange={e=>setCurrent(e.target.value)}>{records.map(r=><option key={r.id} value={r.id}>{r.rapport||r.id} · {r.affaire||'Sans affaire'} · {r.poste||'Poste'}</option>)}</select><button onClick={add}>Nouveau</button><button onClick={duplicate}>Copier</button><button className="danger" onClick={del}>Supprimer</button></header>}
function Hero(){return <div className="hero"><div><small>SECAB COUPLAGE EXPERT</small><h2>Contrôle intelligent des mises à la terre HTA/BT</h2><p>V19 passe au niveau supérieur : chaque affaire devient un package autonome avec UUID, mesures, diagnostics, photos et traçabilité complète.</p></div><div className="formula"><b>Formule officielle</b><span>Rc = (RM + RNi - RMN) / 2</span><span>c = Rc / RM</span><em>Conforme si c &lt; 0,15</em></div></div>}
function Kpi({label,value,good,bad}){return <div className={`kpi ${good?'good':''} ${bad?'bad':''}`}><span>{label}</span><b>{value}</b></div>}
function Dashboard({stats,records,setTab,setCurrent}){return <section className="grid"><Hero/><Kpi label="Postes contrôlés" value={stats.total}/><Kpi label="Conformes" value={stats.ok} good/><Kpi label="Non conformes" value={stats.ko} bad/><Kpi label="Fiabilité moyenne" value={`${stats.avgReliability}%`}/><div className="card wide"><h2>Vue décisionnelle</h2><div className="table">{records.map(r=>{const c=compute(r);return <div className="row" key={r.id} onClick={()=>{setCurrent(r.id);setTab('mesures')}}><b>{r.affaire||'—'}</b><span>{r.poste||'—'}</span><span>c {fmt(c.c,4)}</span><span>Risque {c.risk}%</span><span className={c.ok?'pill ok':'pill ko'}>{c.ok?'Conforme':'Non conforme'}</span></div>})}</div></div><div className="card"><h2>Mode waouh client</h2><p>Une page claire, propre et imprimable pour présenter l’état d’un poste sans exposer toutes les données internes.</p><button onClick={()=>setTab('client')}>Voir présentation</button></div></section>}

function Field({label,value,onChange,type='text',children}){return <label>{label}{children || <input type={type} value={value||''} onChange={e=>onChange(e.target.value)}/>}</label>}
function SelectField({label,value,onChange,options}){return <label>{label}<select value={value||''} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>}
function Form({m,update}){const fields=[['Affaire','affaire'],['Poste','poste'],['Code GDO','codeGdo'],['Client','client'],['Contact','contact'],['N° rapport','rapport'],['Marché','marche'],['Technicien','technicien'],['Responsable','responsable'],['Appareil TERCA','appareil'],['Étalonnage','etalonnage'],['RM masses','rm'],['RNg neutre global','rng'],['RNi neutre individuel','rni'],['RMN mesuré','rmn'],['Rc direct TERCA','rcDirect'],['Résistivité Ω.m','resistivite'],['Distance RM/RN m','distance'],['Échéance','echeance']];return <div className="form"><SelectField label="Commune" value={m.commune} onChange={v=>update({commune:v})} options={COMMUNES_REUNION}/><SelectField label="Type d’ouvrage à vérifier" value={m.typeOuvrage} onChange={v=>update({typeOuvrage:v})} options={TYPES_OUVRAGES}/>{fields.map(([l,k])=><Field key={k} label={l} value={m[k]} onChange={v=>update({[k]:v})}/>)}</div>}
function Mesures({m,update}){const c=compute(m);return <section className="grid two"><div className="card"><h2>Mesures initiales</h2><Form m={m} update={update}/><div className="switch"><button className={m.mode==='direct'?'sel':''} onClick={()=>update({mode:'direct'})}>RC direct TERCA</button><button className={m.mode==='edf'?'sel':''} onClick={()=>update({mode:'edf'})}>Calcul EDF complet</button></div></div><div className="card result"><h2>Diagnostic EDF B13-23</h2><div className={c.ok?'status ok':'status ko'}>{c.ok?'CONFORME':'NON CONFORME'}</div><p><b>Rc retenue :</b> {fmt(c.rc)} Ω</p><p><b>Coefficient c :</b> {fmt(c.c,4)}</p><p><b>Seuil :</b> c &lt; 0,15</p><p><b>Rc max autorisée :</b> {fmt(c.rcMax)} Ω</p><p><b>Rc à réduire :</b> {fmt(c.rcToReduce)} Ω</p><p><b>Risque métier :</b> {c.risk}%</p><p><b>Distance indicative :</b> {c.distanceMin.label}</p><p><b>Fiabilité mesure :</b> {c.reliability}%</p><p className="muted">Le ratio Rc/RN est affichable comme information, mais il n’est jamais utilisé pour la conformité.</p>{c.incoherences.length>0&&<div className="alerts">{c.incoherences.map((a,i)=><p key={i}>⚠️ {a}</p>)}</div>}</div></section>}
function Terrain({m,update}){function gps(){ if(!navigator.geolocation) return alert('GPS non disponible.'); navigator.geolocation.getCurrentPosition(p=>update({gpsLat:p.coords.latitude.toFixed(6),gpsLng:p.coords.longitude.toFixed(6),gpsAccuracy:Math.round(p.coords.accuracy)}),()=>alert('GPS refusé ou impossible.'))} async function files(e){const type=m.photoType||PHOTOS_OBLIGATOIRES[0][1]; const key=(PHOTOS_OBLIGATOIRES.find(x=>x[1]===type)||[])[0]; const arr=await Promise.all([...e.target.files].slice(0,8).map(file=>new Promise(res=>{const r=new FileReader();r.onload=()=>res({name:file.name,data:r.result,caption:type,type});r.readAsDataURL(file)}))); update({photos:[...(m.photos||[]),...arr], photoChecklist:{...m.photoChecklist,...(key?{[key]:true}:{})}, quality:{...m.quality, photo:true}})}return <section className="grid two"><div className="card"><h2>Application terrain · photos obligatoires</h2><button className="big" onClick={gps}>📍 Capturer GPS</button><p>Lat : {m.gpsLat||'—'} · Lng : {m.gpsLng||'—'} · précision : {m.gpsAccuracy||'—'} m</p>{m.gpsLat&&<a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${m.gpsLat},${m.gpsLng}`}>Ouvrir dans Google Maps</a>}<SelectField label="Type de photo à ajouter" value={m.photoType} onChange={v=>update({photoType:v})} options={PHOTOS_OBLIGATOIRES.map(x=>x[1])}/><label className="upload">📷 Ajouter photo obligatoire<input type="file" accept="image/*" multiple onChange={files}/></label><div className="alerts"><b>Photos attendues avant clôture :</b>{PHOTOS_OBLIGATOIRES.map(([k,l])=><p key={k}>{m.photoChecklist?.[k]?'✅':'⬜'} {l}</p>)}</div><textarea placeholder="Observations chantier, météo, état du sol, contraintes d’accès..." value={m.observations||''} onChange={e=>update({observations:e.target.value})}/></div><div className="card"><h2>Photos terrain</h2><div className="photos">{(m.photos||[]).map((p,i)=><div key={i} className="photoCard"><img src={p.data}/><small>{p.type||'Photo terrain'}</small><input placeholder="Légende / commentaire photo" value={p.caption||''} onChange={e=>{const ps=[...m.photos];ps[i]={...ps[i],caption:e.target.value};update({photos:ps})}}/><button className="danger mini" onClick={()=>update({photos:m.photos.filter((_,x)=>x!==i)})}>Retirer</button></div>)}</div></div></section>}
function Qualite({m,update}){const set=(k,v)=>update({quality:{...m.quality,[k]:v}});const score=Object.values(m.quality||{}).filter(Boolean).length;const total=Object.keys(m.quality||{}).length;return <section className="grid two"><div className="card"><h2>Contrôle qualité terrain</h2>{Object.entries({piquets:'Piquets alignés et distances conformes',tension:'Absence de tension permanente vérifiée',shunt:'Shunt / terre auxiliaire avant ouverture',distance:'Distance RM/RN contrôlée',photo:'Photos jointes',appareil:'Appareil et étalonnage renseignés',meteo:'Pas d’intervention par temps d’orage',registre:'Prêt pour registre EDF'}).map(([k,l])=><label className="check" key={k}><input type="checkbox" checked={!!m.quality?.[k]} onChange={e=>set(k,e.target.checked)}/>{l}</label>)}</div><div className="card"><h2>Score qualité</h2><div className="score">{Math.round(score/total*100)}%</div><p>{score}/{total} points validés avant émission client.</p><div className="alerts"><b>Photos obligatoires :</b>{PHOTOS_OBLIGATOIRES.map(([k,l])=><p key={k}>{m.photoChecklist?.[k]?'✅':'❌'} {l}</p>)}</div><textarea placeholder="Reprise / action corrective" value={m.reprise||''} onChange={e=>update({reprise:e.target.value})}/><input placeholder="Coût estimatif reprise (€)" value={m.cout||''} onChange={e=>update({cout:e.target.value})}/><div className="signFields"><input placeholder="Signature technicien / nom" value={m.signatures?.technicien||''} onChange={e=>update({signatures:{...m.signatures,technicien:e.target.value}})}/><input placeholder="Visa responsable / nom" value={m.signatures?.responsable||''} onChange={e=>update({signatures:{...m.signatures,responsable:e.target.value}})}/></div></div></section>}
function SolutionsPage({m,update}){const c=compute(m); const target=Number.isFinite(c.rcMax)?fmt(c.rcMax):'—';return <section className="grid two"><div className="card"><h2>Diagnostic & amélioration des terres</h2><div className={c.ok?'status ok':'status ko'}>{c.ok?'Terre conforme':'Amélioration nécessaire'}</div><p><b>Diagnostic :</b> {c.diagnosticText}</p><p><b>Objectif technique :</b> Rc ≤ {target} Ω pour respecter c &lt; 0,15.</p><p><b>Écart à réduire :</b> {fmt(c.rcToReduce)} Ω.</p><p><b>Type d’ouvrage :</b> {m.typeOuvrage||'—'}</p><h3>Solutions proposées</h3>{c.solutionSuggestions.map((x,i)=><div className="step" key={i}>{i+1}. {x}</div>)}<h3>Catalogue solutions terrain</h3><SelectField label="Solution retenue" value={m.solutionRetenue} onChange={v=>update({solutionRetenue:v})} options={['',...SOLUTIONS_TERRE]}/><textarea placeholder="Diagnostic détaillé : cause probable, contraintes, accès, état sol, distance, anomalies visibles..." value={m.diagnosticTerrain||''} onChange={e=>update({diagnosticTerrain:e.target.value})}/></div><div className="card"><h2>Préparation intervention de reprise</h2><textarea placeholder="Plan de reprise : longueur serpentin, nombre de piquets, raccordements, sécurité, recontrôle prévu..." value={m.reprise||''} onChange={e=>update({reprise:e.target.value})}/><textarea placeholder="Matériel prévu : cuivre nu, piquets, raccords C, regard, terre végétale, gaine, outillage..." value={m.materielReprise||''} onChange={e=>update({materielReprise:e.target.value})}/><input placeholder="Coût estimatif (€)" value={m.cout||''} onChange={e=>update({cout:e.target.value})}/><input placeholder="Prochain contrôle prévu" value={m.nextControl||''} onChange={e=>update({nextControl:e.target.value})}/><select value={m.statut||''} onChange={e=>update({statut:e.target.value})}><option>À contrôler</option><option>Contrôlé conforme</option><option>Amélioration nécessaire</option><option>Reprise planifiée</option><option>Reprise réalisée</option><option>Recontrôle à faire</option><option>Clôturé DOE</option></select><label className="check"><input type="checkbox" checked={!!m.repriseDone} onChange={e=>update({repriseDone:e.target.checked})}/> Reprise réalisée et recontrôle à programmer</label></div></section>}
function Planning({records,setCurrent,setTab}){const rows=[...records].sort((a,b)=>(a.echeance||a.nextControl||'9999').localeCompare(b.echeance||b.nextControl||'9999'));return <section className="card"><h2>Planning reprises & relances</h2><div className="table">{rows.map(r=>{const c=compute(r);const due=c.due;return <div className="row planning" key={r.id} onClick={()=>{setCurrent(r.id);setTab('solutions')}}><b>{r.echeance||r.nextControl||'Sans date'}</b><span>{r.affaire} · {r.poste}</span><span>{r.statut}</span><span>{due===null?'—':due<0?`${Math.abs(due)} j retard`:due===0?'Aujourd’hui':`${due} j`}</span><span className={c.ok?'pill ok':'pill ko'}>{c.priority}</span></div>})}</div></section>}
function ClientMode({m}){const c=compute(m);return <section className="clientShow"><div className="clientHero"><small>PRÉSENTATION CLIENT</small><h2>{m.affaire||'Affaire'} · {m.poste||'Poste HTA/BT'}</h2><p>Contrôle des mises à la terre HTA/BT avec méthode EDF B13-23.</p><div className={c.ok?'mega ok':'mega ko'}>{c.ok?'Ouvrage conforme':'Reprise nécessaire'}</div></div><div className="clientCards"><div><b>Coefficient c</b><span>{fmt(c.c,4)}</span></div><div><b>Seuil</b><span>&lt; 0,15</span></div><div><b>Rc retenue</b><span>{fmt(c.rc)} Ω</span></div><div><b>Fiabilité</b><span>{c.reliability}%</span></div></div><div className="card"><h2>Conclusion présentable</h2><p>{c.ok?'Les mesures réalisées indiquent un couplage conforme au seuil retenu. Les résultats peuvent être intégrés au DOE après validation documentaire.':'Les mesures indiquent un dépassement du seuil de couplage. Une action corrective est à planifier, puis un recontrôle devra être réalisé avant clôture.'}</p><button onClick={()=>window.print()}>Imprimer cette présentation</button></div></section>}
function Audit({m}){const c=compute(m); const checks=[['Formule utilisée', 'c = Rc / RM', true],['Ancienne erreur interdite','Rc / RN non utilisé pour le diagnostic', true],['RNi > RNg', m.mode!=='edf'?'Non applicable':(c.rni>c.rng?'OK':'À vérifier'), m.mode!=='edf'||c.rni>c.rng],['RM + RNi ≥ RMN', m.mode!=='edf'?'Non applicable':(c.rm+c.rni>=c.rmn?'OK':'KO'), m.mode!=='edf'||c.rm+c.rni>=c.rmn],['Distance RM/RN', c.distanceMin.label, c.distanceOk],['Fiabilité globale', c.reliability+'%', c.reliability>=80]];return <section className="grid two"><div className="card"><h2>Matrice anti-erreur</h2>{checks.map((x,i)=><div className="audit" key={i}><b>{x[0]}</b><span>{x[1]}</span><em className={x[2]?'okText':'koText'}>{x[2]?'OK':'KO'}</em></div>)}</div><div className="card"><h2>PV interne avant émission client</h2><p>Cette page sert de verrou avant diffusion du rapport. Si un point est KO, le rapport doit rester en interne jusqu’à correction ou justification.</p><div className="score">{c.reliability}%</div><p>Score de fiabilité de la mesure.</p></div></section>}
function Registre({records,setRecords,active}){
  const csv=toCsv(records);
  const syncAudit=useMemo(()=>makeSyncAudit(records),[records]);
  const [importInfo,setImportInfo]=useState('');
  async function saveCsv(){ if(window.secabDesktop) await window.secabDesktop.saveCsv(csv); else download('registre-secab-toutes-affaires.csv',csv)}
  async function saveJson(){ const payload={exportedAt:new Date().toISOString(),records}; if(window.secabDesktop) await window.secabDesktop.saveJson(payload); else download('secab-export-complet-photos.json',JSON.stringify(payload,null,2))}
  function saveAudit(){ download(`SECAB_audit_sync_${today()}.json`, JSON.stringify(syncAudit,null,2)); }
  function saveBackup(){ const payload=stampPackage({type:'SECAB_BACKUP_BUREAU',version:'20.3.0',exportedAt:new Date().toISOString(),records:records.map(normalizeImportedRecord),total:records.length}); download(`SECAB_sauvegarde_bureau_${today()}.secabbackup`, JSON.stringify(payload,null,2)); }
  function mergeImported(arr,source='import'){
    let added=0,updated=0;
    setRecords(prev=>{
      const map=new Map(prev.map(r=>[recordKey(r),r]));
      arr.forEach(raw=>{
        const rec=normalizeImportedRecord(raw);
        const key=recordKey(rec);
        if(map.has(key)){updated++;map.set(key,{...map.get(key),...rec,importSource:source,updatedAt:new Date().toISOString()});}
        else{added++;map.set(key,{...rec,importSource:source,createdAt:new Date().toISOString()});}
      });
      return Array.from(map.values()).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    });
    setImportInfo(`Import terminé : ${added} ajoutée(s), ${updated} mise(s) à jour depuis ${source}.`)
  }
  function importJson(e){const file=e.target.files?.[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{try{const data=JSON.parse(r.result); const arr=Array.isArray(data)?data:data.records; if(!Array.isArray(arr)) throw new Error('format'); mergeImported(arr,'JSON '+file.name);}catch{alert('Import impossible : fichier JSON non compatible.')}}; r.readAsText(file)}
  function importCsv(e){const file=e.target.files?.[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{try{const arr=csvToRecords(String(r.result)); if(!arr.length) throw new Error('vide'); mergeImported(arr,'CSV '+file.name);}catch(err){console.error(err);alert('Import CSV impossible : vérifie le fichier exporté par l’application terrain.')}}; r.readAsText(file,'utf-8')}
  function exportActivePackage(){ if(!active) return; const pkg=makeAffairePackage(active); download(`${safeName(pkg.metadata.packageId)}.secabpkg`, JSON.stringify(pkg,null,2)); }
  function exportDayPackages(){ const day=today(); const payload={type:'SECAB_DAILY_PACKAGE_BATCH',version:'20.3.0',exportedAt:new Date().toISOString(),count:records.length,recordsSummary:records.map(r=>({id:r.id,rapport:r.rapport,affaire:r.affaire,poste:r.poste,date:r.date,photos:(r.photos||[]).length,conformite:compute(r).ok?'OK':'KO'})),packages:records.map(makeAffairePackage)}; download(`SECAB_packages_journee_${day}.secabday`, JSON.stringify(payload,null,2)); }
  function importPackage(e){
    const files=[...(e.target.files||[])]; if(!files.length) return;
    let loaded=0, packages=[];
    files.forEach(file=>{const r=new FileReader(); r.onload=()=>{try{const data=JSON.parse(r.result); if(data.type==='SECAB_AFFAIRE_PACKAGE') packages.push(packageToRecord(data)); else if(data.type==='SECAB_DAILY_PACKAGE_BATCH') packages.push(...(data.packages||[]).map(packageToRecord)); else if(data.type==='SECAB_BACKUP_BUREAU') packages.push(...(data.records||[]).map(normalizeImportedRecord)); else if(data.affaire||data.mesures) packages.push(packageToRecord(data)); else throw new Error('format');}catch(err){console.error(err); alert(`Package non compatible : ${file.name}`)} finally{loaded++; if(loaded===files.length && packages.length) mergeImported(packages,'PACKAGE SECAB')}}; r.readAsText(file,'utf-8')});
  }
  return <section className="card"><h2>Registre EDF / DOE & synchronisation packages</h2>
    <p className="muted">Le CSV reste disponible pour Excel, mais les échanges terrain/bureau doivent passer par les packages SECAB : un UUID par affaire, photos intégrées, diagnostic, solutions, GPS et traçabilité complète. Le bureau importe le package et retrouve immédiatement l’affaire avec ses photos exploitables dans le rapport.</p>
    <div className="syncPanel"><div><b>Format recommandé</b><span>.secabpkg = 1 affaire complète</span><span>.secabday = journée complète technicien</span></div><div><b>Clé de mise à jour</b><span>UUID affaire prioritaire</span><span>sinon rapport + affaire + poste + date</span></div><div><b>Photos</b><span>Base64 intégrées au package</span><span>visibles directement dans le rapport</span></div><div><b>Sécurité V20</b><span>checksum package</span><span>sauvegarde bureau avant archivage</span></div></div>
    <div className="actions"><button onClick={exportActivePackage}>Exporter package affaire active</button><button onClick={exportDayPackages}>Exporter packages journée</button><label className="importBtn">Importer package terrain<input type="file" accept=".secabpkg,.secabday,application/json" multiple onChange={importPackage}/></label><button onClick={saveCsv}>Exporter CSV global Excel</button><button onClick={saveAudit}>Exporter audit sync</button><button onClick={saveBackup}>Sauvegarde bureau</button><button onClick={saveJson}>Exporter JSON complet</button><label className="importBtn">Importer CSV ancien format<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><label className="importBtn">Importer JSON ancien format<input type="file" accept="application/json" onChange={importJson}/></label><button onClick={()=>window.print()}>Imprimer registre</button></div>
    {importInfo&&<p className="notice">{importInfo}</p>}
    <div className="packageExample"><b>Journal de synchronisation</b><pre>{`Affaires en mémoire : ${records.length}\nPackages conformes : vérification checksum à l'import\nAudit actuel : ${syncAudit.checksum}\nRègle verrouillée : c = Rc / RM`}</pre></div><div className="packageExample"><b>Structure logique d’un package affaire</b><pre>{`Affaire_UUID.secabpkg\n├── metadata : UUID, dates, technicien, source\n├── affaire : identité poste, commune, type d’ouvrage\n├── mesures : RM, RNi, RMN, Rc, c = Rc/RM\n├── diagnostic : conformité, incohérences, solutions\n├── photos[] : image + légende + type obligatoire\n└── rapport : données prêtes pour édition PDF`}</pre></div>
    <div className="table print">{records.map(r=>{const c=compute(r);return <div className="row" key={r.id}><span>{r.date}</span><b>{r.rapport}</b><span>{r.affaire}</span><span>{r.commune}</span><span>{(r.photos||[]).length} photo(s)</span><span className={c.ok?'pill ok':'pill ko'}>{c.ok?'OK':'KO'}</span></div>})}</div>
  </section>}
function Rapport({m}){const c=compute(m);return <section className="report card"><div className="report-head"><div><h2>Rapport de contrôle des prises de terre</h2><p>SECAB · Contrôle couplage HTA/BT · Référentiel EDF B13-23</p></div><button onClick={()=>window.print()}>Imprimer / PDF</button></div><div className="report-grid"><p><b>Affaire :</b> {m.affaire}</p><p><b>Poste :</b> {m.poste}</p><p><b>Code GDO :</b> {m.codeGdo}</p><p><b>Commune :</b> {m.commune}</p><p><b>Type ouvrage :</b> {m.typeOuvrage}</p><p><b>Date :</b> {m.date}</p><p><b>Appareil :</b> {m.appareil}</p><p><b>Technicien :</b> {m.technicien}</p></div><h3>Résultats</h3><table><tbody><tr><td>RM</td><td>{m.rm} Ω</td></tr><tr><td>RNi</td><td>{m.rni||'—'} Ω</td></tr><tr><td>RMN</td><td>{m.rmn||'—'} Ω</td></tr><tr><td>Rc retenue</td><td>{fmt(c.rc)} Ω</td></tr><tr><td>Coefficient c = Rc / RM</td><td>{fmt(c.c,4)}</td></tr><tr><td>Conclusion</td><td><b>{c.ok?'CONFORME':'NON CONFORME'}</b></td></tr></tbody></table><h3>Diagnostic / solutions</h3><p><b>Diagnostic :</b> {m.diagnosticTerrain||c.diagnosticText}</p><p><b>Solution retenue :</b> {m.solutionRetenue||'—'}</p><p><b>Matériel / reprise :</b> {m.materielReprise||m.reprise||'—'}</p><h3>Observations</h3><p>{m.observations||'—'}</p><div className="photos reportphotos">{(m.photos||[]).map((p,i)=><figure key={i}><img src={p.data}/><figcaption>{p.caption||`Photo ${i+1}`}</figcaption></figure>)}</div><div className="sign"><span>Technicien<br/><b>{m.signatures?.technicien||'—'}</b></span><span>Responsable / Visa<br/><b>{m.signatures?.responsable||m.visa||'—'}</b></span><span>Client / MOE<br/><b>{m.signatures?.client||'—'}</b></span></div></section>}
function Bureau({records,setCurrent,setTab}){const [q,setQ]=useState(''); const rows=records.filter(r=>JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));return <section className="card"><h2>Logiciel bureau</h2><input className="search" placeholder="Recherche affaire, poste, GDO, commune..." value={q} onChange={e=>setQ(e.target.value)}/><div className="table">{rows.map(r=>{const c=compute(r);return <div className="row" key={r.id} onClick={()=>{setCurrent(r.id);setTab('rapport')}}><b>{r.rapport||'—'}</b><span>{r.affaire}</span><span>{r.poste}</span><span>Risque {c.risk}%</span><span className={c.ok?'pill ok':'pill ko'}>{c.ok?'OK':'KO'}</span></div>})}</div></section>}
function toCsv(records){const header=['id','date','rapport','affaire','poste','type_ouvrage','code_gdo','commune','client','contact','marche','technicien','responsable','appareil','etalonnage','mode_mesure','rm_ohm','rng_ohm','rni_ohm','rmn_ohm','rc_direct_ohm','rc_retenue_ohm','c_rc_sur_rm','rc_max_ohm','ecart_a_reduire_ohm','conformite','fiabilite_pct','risque_pct','distance_rm_rn_m','resistivite_ohm_m','gps_lat','gps_lng','gps_precision_m','photos_nombre','photos_obligatoires_ok','diagnostic','solution_retenue','plan_reprise','materiel_reprise','cout_estime','statut','echeance','prochain_controle','observations','commentaire_bureau','visa','signature_technicien','signature_responsable','signature_client','photo_checklist_json','photos_json'];return ['\ufeff'+header.join(';'),...records.map(r=>{const c=compute(r); const photosOk=PHOTOS_OBLIGATOIRES.every(([k])=>r.photoChecklist?.[k]);return [r.id,r.date,r.rapport,r.affaire,r.poste,r.typeOuvrage,r.codeGdo,r.commune,r.client,r.contact,r.marche,r.technicien,r.responsable,r.appareil,r.etalonnage,r.mode,r.rm,r.rng,r.rni,r.rmn,r.rcDirect,fmt(c.rc),fmt(c.c,4),fmt(c.rcMax),fmt(c.rcToReduce),c.ok?'CONFORME':'NON CONFORME',c.reliability,c.risk,r.distance,r.resistivite,r.gpsLat,r.gpsLng,r.gpsAccuracy,(r.photos||[]).length,photosOk?'OUI':'NON',r.diagnosticTerrain||c.diagnosticText,r.solutionRetenue,r.reprise,r.materielReprise,r.cout,r.statut,r.echeance,r.nextControl,r.observations,r.commentaireBureau,r.visa,r.signatures?.technicien,r.signatures?.responsable,r.signatures?.client,JSON.stringify(r.photoChecklist||{}),JSON.stringify(r.photos||[])].map(csvCell).join(';')})].join('\n')}
function csvCell(v){return `"${String(v??'').replaceAll('\r',' ').replaceAll('\n',' ').replaceAll('\"','\"\"')}"`}
function parseCsv(text){const clean=String(text||'').replace(/^\ufeff/,'');const rows=[];let row=[],cell='',q=false;for(let i=0;i<clean.length;i++){const ch=clean[i],nx=clean[i+1];if(q){if(ch==='"'&&nx==='"'){cell+='"';i++;}else if(ch==='"'){q=false;}else cell+=ch;}else{if(ch==='"')q=true;else if(ch===';'){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;}}if(cell||row.length){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(x=>String(x).trim()!==''));}
function csvToRecords(text){const rows=parseCsv(text);if(rows.length<2)return[];const header=rows[0].map(h=>String(h).trim());return rows.slice(1).map(cols=>Object.fromEntries(header.map((h,i)=>[h,cols[i]??'']))).map(rowToRecord)}
function safeJson(v,fallback){try{return JSON.parse(v||'')}catch{return fallback}}
function rowToRecord(row){const photos=safeJson(row.photos_json,[]);const photoChecklist=safeJson(row.photo_checklist_json,{...emptyMeasure.photoChecklist});return {...emptyMeasure,id:row.id||uid(),date:row.date||today(),rapport:row.rapport||'',affaire:row.affaire||'',poste:row.poste||'',typeOuvrage:row.type_ouvrage||row.typeOuvrage||emptyMeasure.typeOuvrage,codeGdo:row.code_gdo||row.codeGdo||'',commune:row.commune||'Saint-Denis',client:row.client||'',contact:row.contact||'',marche:row.marche||'',technicien:row.technicien||'',responsable:row.responsable||'',appareil:row.appareil||'',etalonnage:row.etalonnage||'',mode:row.mode_mesure||row.mode||'direct',rm:row.rm_ohm||row.rm||'',rng:row.rng_ohm||row.rng||'',rni:row.rni_ohm||row.rni||'',rmn:row.rmn_ohm||row.rmn||'',rcDirect:row.rc_direct_ohm||row.rcDirect||'',distance:row.distance_rm_rn_m||row.distance||'',resistivite:row.resistivite_ohm_m||row.resistivite||'',gpsLat:row.gps_lat||row.gpsLat||'',gpsLng:row.gps_lng||row.gpsLng||'',gpsAccuracy:row.gps_precision_m||row.gpsAccuracy||'',diagnosticTerrain:row.diagnostic||row.diagnosticTerrain||'',solutionRetenue:row.solution_retenue||row.solutionRetenue||'',reprise:row.plan_reprise||row.reprise||'',materielReprise:row.materiel_reprise||row.materielReprise||'',cout:row.cout_estime||row.cout||'',statut:row.statut||'Importé terrain',echeance:row.echeance||'',nextControl:row.prochain_controle||row.nextControl||'',observations:row.observations||'',commentaireBureau:row.commentaire_bureau||row.commentaireBureau||'',visa:row.visa||'',photoChecklist:{...emptyMeasure.photoChecklist,...photoChecklist},photos:Array.isArray(photos)?photos:[],signatures:{technicien:row.signature_technicien||'',responsable:row.signature_responsable||'',client:row.signature_client||''}}}
function recordKey(r){return r.id || [r.rapport,r.affaire,r.poste,r.date].filter(Boolean).join('|') || uid()}
function normalizeImportedRecord(raw){return {...emptyMeasure,...raw,id:raw.id||uid(),photoChecklist:{...emptyMeasure.photoChecklist,...(raw.photoChecklist||{})},photos:Array.isArray(raw.photos)?raw.photos:[],signatures:{...emptyMeasure.signatures,...(raw.signatures||{})}}}
function download(name,content){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}


function packageChecksum(payload){
  const clone = JSON.parse(JSON.stringify(payload||{}));
  delete clone.integrity;
  const str = JSON.stringify(clone);
  let h = 2166136261;
  for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ('00000000' + (h>>>0).toString(16).toUpperCase()).slice(-8);
}
function stampPackage(pkg){
  return {...pkg, integrity:{ algorithm:'FNV1a-32', checksum:packageChecksum(pkg), lockedFormula:'c = Rc / RM', generatedAt:new Date().toISOString() }};
}
function validatePackage(pkg){
  if(!pkg || !pkg.type) return {ok:false,msg:'package vide'};
  if(pkg.integrity?.checksum){ const expected=packageChecksum(pkg); return {ok:expected===pkg.integrity.checksum,msg:expected===pkg.integrity.checksum?'checksum OK':`checksum différent (${expected} / ${pkg.integrity.checksum})`}; }
  return {ok:true,msg:'ancien package sans checksum'};
}
function makeSyncAudit(records){
  const now=new Date().toISOString();
  const rows=records.map(r=>{const c=compute(r);return {uuid:r.id,rapport:r.rapport,affaire:r.affaire,poste:r.poste,commune:r.commune,date:r.date,statut:r.statut,photos:(r.photos||[]).length,conforme:c.ok,coefficient:Number.isFinite(c.c)?Number(c.c.toFixed(5)):null,fiabilite:c.reliability,risque:c.risk,manquants:c.incoherences.length};});
  return {type:'SECAB_SYNC_AUDIT',version:'20.3.0',exportedAt:now,total:records.length,rows,checksum:packageChecksum({rows})};
}

function safeName(v){return String(v||'SECAB_PACKAGE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'') || 'SECAB_PACKAGE'}
function makeAffairePackage(r){
  const c=compute(r); const packageId=r.id||uid();
  return stampPackage({
    type:'SECAB_AFFAIRE_PACKAGE', version:'20.3.0', exportedAt:new Date().toISOString(),
    metadata:{ packageId, uuid:packageId, source:'SECAB Couplage Expert Terrain', schema:'secab.affaire.package.v1', date:r.date, rapport:r.rapport, technicien:r.technicien, commune:r.commune, photosCount:(r.photos||[]).length },
    affaire:{ id:packageId, affaire:r.affaire, poste:r.poste, codeGdo:r.codeGdo, commune:r.commune, typeOuvrage:r.typeOuvrage, zone:r.zone, regime:r.regime, client:r.client, contact:r.contact, marche:r.marche, ordreTravail:r.ordreTravail, statut:r.statut },
    mesures:{ mode:r.mode, rm:r.rm, rng:r.rng, rni:r.rni, rmn:r.rmn, rcDirect:r.rcDirect, rcRetenue:Number.isFinite(c.rc)?c.rc:null, coefficient:Number.isFinite(c.c)?c.c:null, rcMax:Number.isFinite(c.rcMax)?c.rcMax:null, conforme:!!c.ok, formule:'Rc=(RM+RNi-RMN)/2 puis c=Rc/RM ; jamais Rc/RN pour la conformité', resistivite:r.resistivite, distance:r.distance },
    diagnostic:{ texte:r.diagnosticTerrain||c.diagnosticText, incoherences:c.incoherences, fiabilite:c.reliability, risque:c.risk, priorite:c.priority, solutions:c.solutionSuggestions, solutionRetenue:r.solutionRetenue, materielReprise:r.materielReprise, reprise:r.reprise, cout:r.cout, commentaireBureau:r.commentaireBureau },
    terrain:{ date:r.date, gps:{lat:r.gpsLat,lng:r.gpsLng,accuracy:r.gpsAccuracy}, appareil:r.appareil, etalonnage:r.etalonnage, observations:r.observations, photoChecklist:r.photoChecklist, quality:r.quality, doe:r.doe, signatures:r.signatures, nextControl:r.nextControl, echeance:r.echeance, visa:r.visa },
    photos:(r.photos||[]).map((p,i)=>({ id:p.id||`P${String(i+1).padStart(3,'0')}`, name:p.name||`photo_${i+1}.jpg`, type:p.type||p.caption||`Photo ${i+1}`, caption:p.caption||'', data:p.data, takenAt:p.takenAt||r.date })),
    rapport:{ title:'Rapport de contrôle des prises de terre', conclusion:c.ok?'CONFORME':'NON CONFORME', htmlHint:'Le logiciel bureau reconstruit le rapport PDF à partir de ce package.' }
  });
}
function packageToRecord(pkg){
  const validation=validatePackage(pkg);
  const a=pkg.affaire||{}; const me=pkg.mesures||{}; const d=pkg.diagnostic||{}; const t=pkg.terrain||{}; const meta=pkg.metadata||{};
  return normalizeImportedRecord({...emptyMeasure,
    id:meta.uuid||meta.packageId||a.id||uid(), date:t.date||meta.date||today(), rapport:meta.rapport||a.rapport||'', affaire:a.affaire||'', poste:a.poste||'', codeGdo:a.codeGdo||'', commune:a.commune||'Saint-Denis', typeOuvrage:a.typeOuvrage||emptyMeasure.typeOuvrage, zone:a.zone||'Rurale', regime:a.regime||'150 A', client:a.client||'', contact:a.contact||'', marche:a.marche||'', ordreTravail:a.ordreTravail||'', statut:a.statut||'Importé package terrain',
    mode:me.mode||'direct', rm:me.rm??'', rng:me.rng??'', rni:me.rni??'', rmn:me.rmn??'', rcDirect:me.rcDirect??me.rcRetenue??'', resistivite:me.resistivite??'', distance:me.distance??'',
    diagnosticTerrain:d.texte||'', solutionRetenue:d.solutionRetenue||'', materielReprise:d.materielReprise||'', reprise:d.reprise||'', cout:d.cout||'', commentaireBureau:[d.commentaireBureau||'', `Import package : ${validation.msg}`].filter(Boolean).join(' | '),
    gpsLat:t.gps?.lat||'', gpsLng:t.gps?.lng||'', gpsAccuracy:t.gps?.accuracy||'', appareil:t.appareil||'', etalonnage:t.etalonnage||'', observations:t.observations||'', photoChecklist:t.photoChecklist||{}, quality:t.quality||emptyMeasure.quality, doe:t.doe||emptyMeasure.doe, signatures:t.signatures||emptyMeasure.signatures, nextControl:t.nextControl||'', echeance:t.echeance||'', visa:t.visa||'', photos:Array.isArray(pkg.photos)?pkg.photos:[]
  });
}

createRoot(document.getElementById('root')).render(<App/>);
