/* THEME FX — только визуальные эффекты. Логика подбора не затрагивается. */
(function(){
  var doc=document, body=doc.body, reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag,cls,html){var e=doc.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
  function $(s,r){return (r||doc).querySelector(s);} function $$(s,r){return Array.prototype.slice.call((r||doc).querySelectorAll(s));}

  /* ---------- decorative layers ---------- */
  body.appendChild(el('div','fx-grain')).setAttribute('aria-hidden','true');
  var bar=body.appendChild(el('div','fx-progress'));bar.setAttribute('aria-hidden','true');

  /* ---------- loader ---------- */
  var loader=null;
  if(!reduce){
    loader=el('div','fx-loader','<div class="fx-loader-word"><span>irikteu<em>.</em></span></div><div class="fx-loader-line"><i></i></div><div class="fx-loader-meta"><span>ПОДБОР</span><span class="fx-count">000</span></div>');
    loader.setAttribute('aria-hidden','true');body.appendChild(loader);
  }

  /* ---------- hero: split h1 into lines/words (text stays identical) ---------- */
  function wrapWords(text){
    return text.split(/(\s+)/).map(function(p){return /^\s+$/.test(p)||!p?p:'<span class="fx-w">'+p.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>';}).join('');
  }
  var h1=$('#page-title');
  if(h1){
    var t=h1.textContent.trim(), m=t.match(/^(.+?[.!?])\s+(.+)$/);
    h1.innerHTML=m?'<span class="fx-line">'+wrapWords(m[1])+'</span> <span class="fx-line gold">'+wrapWords(m[2])+'</span>':'<span class="fx-line">'+wrapWords(t)+'</span>';
    $$('.fx-w',h1).forEach(function(w,i){w.style.transitionDelay=(0.15+i*0.09)+'s';});
  }
  var intro=$('.intro');
  if(intro){
    var eb=$('.eyebrow',intro), cp=$('.intro-copy',intro), st=$('.catalog-stat',intro);
    [eb,cp,st].forEach(function(n,i){if(n){n.classList.add('fx-in');n.style.transitionDelay=[0.05,0.75,0.95][i]+'s';}});
    ['fx-f1','fx-f2','fx-f3','fx-f4'].forEach(function(c,i){var f=el('div','fx-float '+c,'<i></i>');f.setAttribute('aria-hidden','true');f.style.transitionDelay=(0.3+i*0.15)+'s';f.dataset.depth=[0.18,0.28,0.1,0.22][i];intro.appendChild(f);});
    var cue=el('div','fx-scroll-cue');cue.setAttribute('aria-hidden','true');intro.appendChild(cue);
  }

  /* ---------- marquee built from the catalog's own categories ---------- */
  var marquee=null;
  function buildMarquee(){
    var sel=$('#category');if(!sel||marquee)return;
    var names=$$('option',sel).map(function(o){return o.textContent.trim();}).filter(function(s){return s&&!/^(выбер|—|-)/i.test(s);});
    if(names.length<3)return;
    var half=names.map(function(n){return '<span>'+n.replace(/</g,'&lt;')+'</span>';}).join('');
    marquee=el('div','fx-marquee','<div class="fx-marquee-track">'+half+half+'</div>');
    marquee.setAttribute('aria-hidden','true');
    var demo=$('.demo-strip');if(demo)demo.parentNode.insertBefore(marquee,demo);
  }
  buildMarquee();
  var catSel=$('#category');
  if(catSel&&!marquee){var mo=new MutationObserver(function(){buildMarquee();if(marquee)mo.disconnect();});mo.observe(catSel,{childList:true});}

  /* ---------- photo band before method section ---------- */
  var method=$('#method');
  if(method){
    var band=el('div','fx-band','<figure><i></i></figure><figure><i></i></figure><figure><i></i></figure>');
    band.setAttribute('aria-hidden','true');method.parentNode.insertBefore(band,method);
    var mh=$('.method-intro h2',method);
    if(mh){
      mh.innerHTML=mh.textContent.split(/(\s+)/).map(function(p){return /^\s+$/.test(p)||!p?p:'<span class="fx-sw">'+p+'</span>';}).join('');
      var sw=$$('.fx-sw',mh);if(sw.length)sw[sw.length-1].classList.add('accent');
    }
  }

  /* ---------- scroll reveal ---------- */
  var revealSel=['.demo-strip','.search-panel','.results-panel','.method-grid>div','.transparency h2','.flag-legend p','.legend-summary','footer'];
  $$(revealSel.join(',')).forEach(function(n,i){n.classList.add('fx-reveal');});
  $$('.method-grid>div').forEach(function(n,i){n.style.transitionDelay=(i*0.12)+'s';});
  $$('.flag-legend p').forEach(function(n,i){n.style.transitionDelay=(i*0.1)+'s';});
  var io=('IntersectionObserver' in window)?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('fx-show');io.unobserve(e.target);}});},{threshold:.12,rootMargin:'0px 0px -6% 0px'}):null;
  $$('.fx-reveal,.fx-band figure,#method').forEach(function(n){io?io.observe(n):n.classList.add('fx-show');});

  /* ---------- animate result cards whenever the app re-renders them ---------- */
  var results=$('#results');
  function animateResults(){
    if(reduce||!results)return;
    $$('.pipeline,.result-summary,.profile-card,.diagnostics,.empty-state',results).forEach(function(n,i){
      if(n.dataset.fx)return;n.dataset.fx='1';n.classList.add('fx-card-in');n.style.animationDelay=(i*0.08)+'s';
    });
  }
  if(results){new MutationObserver(animateResults).observe(results,{childList:true,subtree:true});animateResults();}
  var cmp=$('#comparison-output');
  if(cmp&&!reduce){new MutationObserver(function(){cmp.classList.remove('fx-card-in');void cmp.offsetWidth;cmp.classList.add('fx-card-in');}).observe(cmp,{childList:true});}

  /* card spotlight */
  doc.addEventListener('pointermove',function(e){
    var c=e.target&&e.target.closest&&e.target.closest('.profile-card');if(!c)return;
    var r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px');
  },{passive:true});

  /* ---------- cursor ---------- */
  var fine=window.matchMedia&&matchMedia('(pointer:fine)').matches, dot, ring, mx=-100,my=-100,rx=-100,ry=-100;
  if(fine&&!reduce){
    dot=body.appendChild(el('div','fx-cursor'));ring=body.appendChild(el('div','fx-cursor-ring'));
    dot.setAttribute('aria-hidden','true');ring.setAttribute('aria-hidden','true');
    doc.addEventListener('pointermove',function(e){mx=e.clientX;my=e.clientY;body.classList.add('fx-has-cursor');},{passive:true});
    doc.addEventListener('pointerleave',function(){body.classList.remove('fx-has-cursor');});
    doc.addEventListener('pointerover',function(e){var h=e.target.closest&&e.target.closest('a,button,summary,select,input,label,.profile-card');ring.classList.toggle('hover',!!h);});
  }

  /* ---------- frame loop: parallax, progress, header ---------- */
  var topbar=$('.topbar'), floats=$$('.fx-float'), bandImgs=$$('.fx-band figure i'), pmx=0,pmy=0,cmx=0,cmy=0;
  window.addEventListener('pointermove',function(e){pmx=e.clientX/innerWidth-.5;pmy=e.clientY/innerHeight-.5;},{passive:true});
  var sw2=method?$$('.method-intro .fx-sw',method):[];
  function frame(){
    var y=window.scrollY||pageYOffset, H=doc.documentElement.scrollHeight-innerHeight;
    bar.style.transform='scaleX('+(H>0?Math.min(1,y/H):0)+')';
    if(topbar)topbar.classList.toggle('scrolled',y>20);
    if(!reduce){
      cmx+=(pmx-cmx)*.06;cmy+=(pmy-cmy)*.06;
      floats.forEach(function(f){var d=+f.dataset.depth;f.style.translate=(cmx*-60*d*3)+'px '+(y*-d+cmy*-60*d*3)+'px';});
      bandImgs.forEach(function(i){var r=i.parentNode.getBoundingClientRect();var p=(r.top+r.height/2-innerHeight/2)/innerHeight;i.style.translate='0 '+(p*-40)+'px';});
      if(method){var mr=method.getBoundingClientRect();method.style.setProperty('--py',((mr.top)*-0.15)+'px');
        if(sw2.length){var prog=Math.max(0,Math.min(1,(innerHeight*0.85-mr.top)/(innerHeight*0.55)));var n=Math.round(prog*sw2.length);sw2.forEach(function(w,i){w.classList.toggle('on',i<n);});}}
      if(ring){rx+=(mx-rx)*.18;ry+=(my-ry)*.18;dot.style.transform='translate('+mx+'px,'+my+'px)';ring.style.transform='translate('+rx+'px,'+ry+'px)';}
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if(reduce&&sw2.length)sw2.forEach(function(w){w.classList.add('on');});

  /* ---------- run loader, then reveal hero ---------- */
  function ready(){body.classList.add('fx-ready');}
  if(!loader){ready();return;}
  var cnt=$('.fx-count',loader), line=$('.fx-loader-line i',loader), t0=performance.now(), dur=1500;
  (function tick(now){
    var p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    cnt.textContent=String(Math.round(e*100)).padStart(3,'0');line.style.transform='scaleX('+e+')';
    if(p<1)return requestAnimationFrame(tick);
    setTimeout(function(){loader.classList.add('done');setTimeout(ready,350);setTimeout(function(){loader.remove();},1400);},180);
  })(t0);
})();
