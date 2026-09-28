(function(){
  'use strict';
  var KEY='mscm_demo_auth_v1';
  var TARGET='324c35c7';
  function h(s){var x=2166136261>>>0; s='MSK-2026:'+s; for(var i=0;i<s.length;i++){x^=s.charCodeAt(i); x=Math.imul(x,16777619)>>>0;} return ('00000000'+x.toString(16)).slice(-8);}
  if(sessionStorage.getItem(KEY)==='ok') return;
  document.documentElement.style.visibility='hidden';
  function show(){
    document.documentElement.style.visibility='visible';
    var cover=document.createElement('div');
    cover.id='ms-password-cover';
    cover.innerHTML='<div style="width:min(420px,88vw);background:#fff;border:1px solid #bbb;border-radius:12px;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:system-ui,sans-serif"><div style="font-size:22px;font-weight:700;margin-bottom:8px">MS建設管理システム</div><div style="margin-bottom:18px;color:#555">閲覧用パスワードを入力してください。</div><input id="ms-password-input" type="password" inputmode="numeric" autocomplete="current-password" style="box-sizing:border-box;width:100%;font-size:20px;padding:10px 12px;border:1px solid #999;border-radius:7px"><div id="ms-password-error" style="height:24px;color:#b00020;padding-top:5px"></div><button id="ms-password-button" style="width:100%;font-size:17px;padding:10px;border:0;border-radius:7px;background:#333;color:#fff;cursor:pointer">開く</button></div>';
    cover.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#f3f4f6;display:flex;align-items:center;justify-content:center';
    document.body.appendChild(cover);
    var inp=document.getElementById('ms-password-input'), btn=document.getElementById('ms-password-button'), err=document.getElementById('ms-password-error');
    function go(){if(h(inp.value)===TARGET){sessionStorage.setItem(KEY,'ok');cover.remove();}else{err.textContent='パスワードが違います。';inp.value='';inp.focus();}}
    btn.onclick=go; inp.addEventListener('keydown',function(e){if(e.key==='Enter')go();}); inp.focus();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',show); else show();
})();
