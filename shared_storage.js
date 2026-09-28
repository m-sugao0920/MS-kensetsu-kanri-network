/* MS建設管理システム GitHub Pages + 社内共有データ Ver.2.0
   画面本体はGitHub Pages、データは社内PCの server.py に保存する。
*/
(function(global){
  'use strict';
  let cache=null;
  const DEFAULT_API='http://192.168.1.5:8766';
  const GITHUB_HOST=/\.github\.io$/i.test(location.hostname);

  function normalize(v){ return String(v||'').trim().replace(/\/$/,''); }
  function apiBase(){
    try{return normalize(localStorage.getItem('mscm:networkApi'))||DEFAULT_API;}
    catch(e){return DEFAULT_API;}
  }
  function apiUrl(path){ return apiBase()+path; }

  function connectionHelp(){
    if(GITHUB_HOST && /^http:\/\//i.test(apiBase())){
      return 'GitHub Pages(HTTPS) から親PC(HTTP)への接続がブラウザに遮断される場合があります。親PC API を HTTPS 化するか、このサイトのローカルネットワーク/安全でないコンテンツを許可してください。';
    }
    return '親PCの共有データサーバーが起動しているか、APIアドレスを確認してください。';
  }

  function request(method, path, body){
    const x=new XMLHttpRequest();
    x.open(method,apiUrl(path),false);
    if(body!==undefined) x.setRequestHeader('Content-Type','application/json;charset=UTF-8');
    try{x.send(body===undefined?null:JSON.stringify(body));}
    catch(e){
      throw new Error('社内共有データサーバーに接続できません。'+connectionHelp());
    }
    if(x.status<200||x.status>=300) throw new Error('共有データ通信エラー ('+x.status+')');
    return x.responseText?JSON.parse(x.responseText):null;
  }

  function loadAll(){
    if(cache!==null) return cache;
    const r=request('GET','/api/storage/all');
    cache=(r&&r.data&&typeof r.data==='object')?r.data:{};
    return cache;
  }

  global.MSShared={
    getItem(key){const d=loadAll();return Object.prototype.hasOwnProperty.call(d,key)?d[key]:null;},
    setItem(key,value){const v=String(value);request('POST','/api/storage/set',{key,value:v});if(cache===null)cache={};cache[key]=v;},
    removeItem(key){request('POST','/api/storage/remove',{key});if(cache!==null)delete cache[key];},
    refresh(){cache=null;return loadAll();},
    ping(){return request('GET','/api/ping');},
    apiBase,
    apiUrl,
    setApiBase(v){
      const n=normalize(v);
      if(!/^https?:\/\//i.test(n)) throw new Error('http:// または https:// から入力してください。');
      localStorage.setItem('mscm:networkApi',n);cache=null;return n;
    },
    resetApiBase(){localStorage.removeItem('mscm:networkApi');cache=null;return DEFAULT_API;},
    defaultApi:DEFAULT_API,
    connectionHelp
  };
})(window);
