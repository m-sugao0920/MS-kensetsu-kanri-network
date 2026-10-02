/* MS建設管理システム 複数台共有ストレージ Ver.1.1
   1画面内では共有データをメモリキャッシュし、同じJSONを何度も読み込まない。
   画面を移動・再読込するとサーバーから最新状態を取り直す。
*/
(function(global){
  'use strict';
  let cache=null, versions={};
  const DEFAULT_API='http://192.168.1.5:8766';
  function apiBase(){
    try{return localStorage.getItem('mscm:networkApi')||DEFAULT_API;}
    catch(e){return DEFAULT_API;}
  }
  function apiUrl(path){return apiBase()+path;}
  function setApiBase(value){
    const u=new URL(String(value).trim());
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!='/')
      throw Error('http://192.168.1.5:8766 のように、親PCのアドレスを入力してください。');
    localStorage.setItem('mscm:networkApi',u.origin); cache=null; versions={}; return u.origin;
  }


  function request(method, path, body){
    const x=new XMLHttpRequest();
    x.open(method,apiUrl(path),false);
    if(body!==undefined) x.setRequestHeader('Content-Type','application/json;charset=UTF-8');
    try{x.send(body===undefined?null:JSON.stringify(body));}
    catch(e){throw new Error('共有データサーバーに接続できません。起動用バッチから開始してください。');}
    if(x.status<200||x.status>=300){let msg='共有データ通信エラー ('+x.status+')';try{msg=JSON.parse(x.responseText).error||msg}catch(e){}if(x.status===409)alert(msg);throw new Error(msg);}
    try{return x.responseText?JSON.parse(x.responseText):null;}catch(e){throw Error('データではなくWebページが返りました。共有データ接続設定で親PCのアドレスを確認してください。');}
  }

  function loadAll(){
    if(cache!==null) return cache;
    const r=request('GET','/api/storage/all');
    cache=(r&&r.data&&typeof r.data==='object')?r.data:{};
    versions=(r&&r.versions)||{};
    return cache;
  }

  global.MSShared={
    apiBase, apiUrl, setApiBase,
    getItem(key){
      const d=loadAll();
      return Object.prototype.hasOwnProperty.call(d,key)?d[key]:null;
    },
    setItem(key,value){
      const v=String(value);
      loadAll();
      const r=request('POST','/api/storage/set',{key,value:v,expectedVersion:versions[key]||null});
      versions[key]=r.version;
      if(cache===null) cache={};
      cache[key]=v;
    },
    removeItem(key){
      loadAll();
      const r=request('POST','/api/storage/remove',{key,expectedVersion:versions[key]||null});
      versions[key]=r.version;
      if(cache!==null) delete cache[key];
    },
    refresh(){ cache=null; return loadAll(); },
    ping(){return request('GET','/api/ping');}
  };
})(window);
