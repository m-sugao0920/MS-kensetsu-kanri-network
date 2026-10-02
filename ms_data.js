/* MS建設管理システム 共通データ基盤 Ver.1.0
   画面とデータを分離し、将来のSQLite/APIサーバーへ移行できる形を先に固定します。
   複数台共有版の保存先: MS共有サーバー（shared_data/storage.json）
   将来: API + DB に差し替えても、画面側の識別子・番号体系は維持します。
*/
(function(global){
  "use strict";
  const NS = "mscm:v1";
  const DATA_VERSION = 2;
  const APP_SCHEMA = "MSCM-COMMON-1";
  const keys = {
    meta: NS+":meta", seq: NS+":sequences",
    projects: NS+":projects", partners: NS+":partners", employees: NS+":employees", workers: NS+":workers", companySettings: NS+":companySettings",
    workTypes: NS+":workTypes", projectTypes: NS+":projectTypes", partnerTypes: NS+":partnerTypes",
    budgets: NS+":budgets", orders: NS+":orders", contracts: NS+":contracts",
    supplierInvoices: NS+":supplierInvoices", supplierPayments: NS+":supplierPayments",
    invoices: NS+":invoices", payments: NS+":payments",
    clientInvoices: NS+":invoices", clientReceipts: NS+":payments"
  };
  const defs = {
    projects:{prefix:"K",digits:6,seq:"project"},
    partners:{prefix:"T",digits:6,seq:"partner"},
    employees:{prefix:"S",digits:6,seq:"employee"},
    workers:{prefix:"A",digits:6,seq:"worker"},
    workTypes:{prefix:"W",digits:4,seq:"workType"},
    projectTypes:{prefix:"C",digits:4,seq:"projectType"},
    partnerTypes:{prefix:"R",digits:4,seq:"partnerType"},
    orders:{prefix:"H",digits:6,seq:"order"},
    invoices:{prefix:"Q",digits:6,seq:"invoice"},
    payments:{prefix:"P",digits:6,seq:"payment"},
    clientInvoices:{prefix:"Q",digits:6,seq:"invoice"}, clientReceipts:{prefix:"P",digits:6,seq:"payment"}
  };
  function parse(k,fallback){try{const v=MSShared.getItem(k);return v?JSON.parse(v):fallback}catch(e){return fallback}}
  function put(k,v){MSShared.setItem(k,JSON.stringify(v))}
  function now(){return new Date().toISOString()}
  function uuid(){
    if(global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
      const r=Math.random()*16|0,v=c==="x"?r:(r&3|8); return v.toString(16);
    });
  }
  function ensure(){
    if(!MSShared.getItem(keys.meta)) put(keys.meta,{schema:APP_SCHEMA,dataVersion:DATA_VERSION,mode:"trial",createdAt:now(),updatedAt:now()});
    else {
      const m=parse(keys.meta,{});
      if(!m.mode) m.mode="trial";
      if(!m.dataVersion || m.dataVersion<DATA_VERSION) m.dataVersion=DATA_VERSION;
      put(keys.meta,m);
    }
    if(!MSShared.getItem(keys.seq)) put(keys.seq,{project:0,partner:0,employee:0,worker:0,workType:0,projectType:0,partnerType:0,order:0,invoice:0,payment:0});
    Object.entries(keys).forEach(([name,k])=>{ if(!["meta","seq"].includes(name) && !MSShared.getItem(k)) put(k,[]) });
  }
  function all(entity){ensure(); return parse(keys[entity],[])}
  function nextNo(entity){
    ensure(); const d=defs[entity]; if(!d) throw new Error("採番対象外です: "+entity);
    const seq=parse(keys.seq,{}); seq[d.seq]=(Number(seq[d.seq])||0)+1; put(keys.seq,seq);
    return d.prefix+String(seq[d.seq]).padStart(d.digits,"0");
  }
  function peekNo(entity){
    ensure(); const d=defs[entity]; const seq=parse(keys.seq,{});
    return d.prefix+String((Number(seq[d.seq])||0)+1).padStart(d.digits,"0");
  }
  function audited(entity,base,obj,t){
    if(!['budgets','orders','supplierInvoices'].includes(entity))return obj;
    function clean(v){
      if(Array.isArray(v))return v.map(clean);
      if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['history','initialSnapshot','updatedAt','createdAt','orderedAmount'].includes(k)).map(([k,x])=>[k,clean(x)]));
      return v;
    }
    const before=clean(base),after=clean(obj);
    obj.initialSnapshot=base.initialSnapshot||(base.id?before:after);
    obj.history=Array.isArray(base.history)?base.history.slice():[];
    if(JSON.stringify(before)!==JSON.stringify(after))obj.history.push({at:t,action:base.id?'変更':'登録',before:base.id?before:null,after});
    return obj;
  }
  function contractValue(project){
    const oc=project.orderContract||{},f=project.legacyFinancials||{};
    return [oc.currentContractAmount,f.finalContractAmount,f.contractAmount,project.contractCurrent,project.currentContractAmount,project.finalContractAmount,project.contractAmount].find(v=>v!==undefined&&v!==null&&v!=='')??null;
  }
  function save(entity, rec){
    ensure(); const rows=all(entity), t=now(); let idx=-1;
    if(rec.id) idx=rows.findIndex(x=>x.id===rec.id);
    const base=idx>=0?rows[idx]:{};
    const obj=Object.assign({},base,rec);
    if(!obj.id) obj.id=uuid();
    if(!obj.no && defs[entity]) obj.no=nextNo(entity);
    if(!obj.createdAt) obj.createdAt=t;
    obj.updatedAt=t; if(!obj.status) obj.status="active";
    audited(entity,base,obj,t);
    if(idx>=0) rows[idx]=obj; else rows.push(obj);
    put(keys[entity],rows);
    const meta=parse(keys.meta,{}); meta.updatedAt=t; put(keys.meta,meta);
    return obj;
  }
  function saveMany(entity, records){
    ensure();
    if(!Array.isArray(records)) throw new Error("一括保存データが配列ではありません。");
    const rows=all(entity), t=now(), d=defs[entity];
    const seq=parse(keys.seq,{});
    let seqChanged=false;
    const saved=[];
    records.forEach(rec=>{
      let idx=-1;
      if(rec.id) idx=rows.findIndex(x=>x.id===rec.id);
      const base=idx>=0?rows[idx]:{};
      const obj=Object.assign({},base,rec);
      if(!obj.id) obj.id=uuid();
      if(!obj.no && d){
        seq[d.seq]=(Number(seq[d.seq])||0)+1;
        obj.no=d.prefix+String(seq[d.seq]).padStart(d.digits,"0");
        seqChanged=true;
      }
      if(!obj.createdAt) obj.createdAt=t;
      obj.updatedAt=t; if(!obj.status) obj.status="active";
      audited(entity,base,obj,t);
      if(idx>=0) rows[idx]=obj; else rows.push(obj);
      saved.push(obj);
    });
    put(keys[entity],rows);
    if(seqChanged) put(keys.seq,seq);
    const meta=parse(keys.meta,{}); meta.updatedAt=t; put(keys.meta,meta);
    return saved;
  }
  function get(entity,id){return all(entity).find(x=>x.id===id)||null}
  function deactivate(entity,id,status="inactive"){
    const x=get(entity,id); if(!x) return null; x.status=status; x.inactivatedAt=now(); return save(entity,x);
  }
  function exportData(){
    ensure(); const payload={schema:APP_SCHEMA,dataVersion:DATA_VERSION,exportedAt:now(),data:{}};
    Object.keys(keys).forEach(name=>payload.data[name]=parse(keys[name], name==="seq"?{}:(name==="meta"?{}:[])));
    return payload;
  }
  function downloadBackup(){
    const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="MS建設管理_backup_"+new Date().toISOString().slice(0,10).replaceAll("-","")+".json";
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function migrate(payload){
    if(!payload || payload.schema!==APP_SCHEMA) throw new Error("MS建設管理システムのバックアップ形式ではありません。");
    let v=Number(payload.dataVersion||1);
    // 将来の形式変更はここに v1→v2→v3 の順で追加し、旧データを継続利用する。
    if(v>DATA_VERSION) throw new Error("このバックアップは新しいデータ形式です。アプリを更新してください。");
    payload.dataVersion=DATA_VERSION; return payload;
  }
  function restoreData(payload){
    payload=migrate(payload);
    const d=payload.data||{};
    Object.keys(keys).forEach(name=>{
      if(d[name]!==undefined) put(keys[name],d[name]);
    });
    ensure();
  }
  function restoreFile(file){
    return file.text().then(t=>restoreData(JSON.parse(t)));
  }
  function getMode(){ensure(); return (parse(keys.meta,{}).mode||"trial")}
  function setMode(mode){
    ensure(); const m=parse(keys.meta,{});
    m.mode=(mode==="production"?"production":"trial"); m.updatedAt=now(); put(keys.meta,m); return m.mode;
  }
  function productionStartReset(options){
    ensure();
    const opt=Object.assign({keepWorkTypes:true},options||{});
    // 本番開始で消す業務データ・業務マスター
    ["projects","partners","employees","workers","budgets","orders","contracts","supplierInvoices","supplierPayments","invoices","payments"].forEach(name=>put(keys[name],[]));
    // 基本マスターは残す。工種は選択可能。将来の工事区分等も同じ基本マスター群に追加する。
    if(!opt.keepWorkTypes) put(keys.workTypes,[]);
    // 業務番号だけを1番から再スタート
    const oldSeq=parse(keys.seq,{});
    put(keys.seq,{project:0,partner:0,employee:0,worker:0,workType:oldSeq.workType||0,projectType:oldSeq.projectType||0,partnerType:oldSeq.partnerType||0,order:0,invoice:0,payment:0});
    const m=parse(keys.meta,{});
    m.mode="production"; m.dataVersion=DATA_VERSION; m.productionStartedAt=now(); m.updatedAt=now(); put(keys.meta,m);
    return true;
  }
  function resetAll(){
    Object.values(keys).forEach(k=>MSShared.removeItem(k)); ensure();
  }
  ensure();
  global.MSData={contractValue,DATA_VERSION,APP_SCHEMA,keys,defs,all,get,save,saveMany,nextNo,peekNo,deactivate,exportData,downloadBackup,restoreData,restoreFile,getMode,setMode,productionStartReset,resetAll,uuid};
})(window);
