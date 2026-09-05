(() => {
  'use strict';

  const stage = document.getElementById('journeyStage');
  const sourceCanvas = document.getElementById('journeyCanvas');
  const replay = document.getElementById('journeyReplay');
  const phase = document.getElementById('journeyPhase');
  if (!stage || !sourceCanvas || !replay || !phase) return;

  sourceCanvas.style.opacity = '0';
  sourceCanvas.style.pointerEvents = 'none';
  stage.querySelectorAll('.j-milestone').forEach(el => el.style.display = 'none');

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Animated world globe, India location lock, and milestone route');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '1', pointerEvents: 'none' });
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const cards = document.createElement('div');
  Object.assign(cards.style, { position: 'absolute', inset: '0', zIndex: '2', pointerEvents: 'none' });
  stage.appendChild(cards);

  const milestones = [
    ['JUL 2024', 'SRMIST · B.Tech CSE', 'Started the cybersecurity-focused undergraduate journey.', .08, .78],
    ['MAR 2025', 'Agnirva Space', 'AICTE-recognised space-tech internship.', .22, .42],
    ['APR 2025', 'Palo Alto Networks', 'Threat scenarios + NGFW practice.', .36, .66],
    ['JUL 2025', 'Fortinet FNSA', 'Firewall, VPN and IPS workflows.', .50, .28],
    ['OCT 2025', 'Oracle Triple Crown', 'Three professional certifications in one quarter.', .64, .56],
    ['OCT–DEC 2025', 'Web Exploit Hunting', '10+ OWASP Top 10 vulnerabilities disclosed responsibly.', .77, .34],
    ['JAN 2026 · PRESENT', 'Zscaler Zero Trust', '15+ policies reviewed · 30% simulated attack-surface reduction.', .90, .68]
  ];

  milestones.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'je-card';
    Object.assign(el.style, {
      position: 'absolute', left: (m[3] * 100) + '%', top: (m[4] * 100) + '%', width: '210px', maxWidth: '24vw',
      transform: 'translate(-50%, -50%) scale(.86)', opacity: '0', transition: 'opacity .45s ease, transform .45s ease',
      padding: '11px 13px', border: '1px solid rgba(205,255,77,.9)', borderRadius: '7px',
      background: 'rgba(5,9,14,.92)', boxShadow: '0 0 24px rgba(0,0,0,.45), inset 0 0 16px rgba(205,255,77,.035)',
      color: '#fff', fontFamily: 'Space Grotesk, sans-serif'
    });
    el.innerHTML = `<div style="font:600 9px JetBrains Mono,monospace;letter-spacing:1.5px;color:#cdff4d">${m[0]}</div><div style="font:600 15px Space Grotesk,sans-serif;margin:4px 0 3px;line-height:1.15">${m[1]}</div><div style="font:12px Space Grotesk,sans-serif;color:rgba(255,255,255,.62);line-height:1.35">${m[2]}</div>`;
    cards.appendChild(el);
    m.push(el);
  });

  const stars = Array.from({length: 230}, () => ({ x: Math.random(), y: Math.random(), r: .25 + Math.random() * 1.35, p: Math.random() * Math.PI * 2 }));
  let world = null, india = null, worldReady = false, indiaReady = false;
  let W = 1, H = 1, dpr = 1, start = 0, raf = 0, playing = false;
  let globeRotation = -10;

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); window.addEventListener('resize', resize, { passive: true });

  function loadD3() {
    if (window.d3 && window.topojson) return Promise.resolve();
    return Promise.all([
      new Promise((resolve, reject) => { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); }),
      new Promise((resolve, reject) => { const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); })
    ]);
  }

  Promise.all([
    loadD3(),
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json', { cache: 'force-cache' }).then(r => r.json()).then(d => { world = d; worldReady = true; }),
    fetch('https://raw.githubusercontent.com/AbhinavSwami28/india-official-geojson/main/india-states.topojson', { cache: 'force-cache' }).then(r => r.json()).then(d => { india = d; indiaReady = true; })
  ]).catch(() => {});

  function clear() { ctx.clearRect(0, 0, W, H); }
  function roundRect(x,y,w,h,r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  function drawStars(t, amount=1) {
    for (const s of stars) { const a=(.15+.85*Math.abs(Math.sin(s.p+t*.0009)))*amount; ctx.fillStyle=`rgba(255,255,255,${a*.68})`; ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2); ctx.fill(); }
  }

  function globe(t, zoom=1, lock=0) {
    const cx=W/2, cy=H/2, R=Math.min(W,H)*.265*zoom;
    ctx.save(); ctx.translate(cx,cy);
    const halo=ctx.createRadialGradient(0,0,R*.55,0,0,R*1.5); halo.addColorStop(0,'rgba(0,255,255,.08)'); halo.addColorStop(.68,'rgba(0,255,255,.12)'); halo.addColorStop(1,'rgba(0,255,255,0)'); ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(0,0,R*1.5,0,Math.PI*2); ctx.fill();
    const sphere=ctx.createRadialGradient(-R*.35,-R*.4,R*.06,0,0,R); sphere.addColorStop(0,'#123a49'); sphere.addColorStop(.42,'#071e2b'); sphere.addColorStop(1,'#01070b'); ctx.fillStyle=sphere; ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();
    if (worldReady && window.d3 && window.topojson) {
      const feat=topojson.feature(world, world.objects.countries).features;
      const p=d3.geoOrthographic().translate([0,0]).scale(R).rotate([globeRotation + t*.9,-10,0]).clipAngle(90);
      const path=d3.geoPath(p,ctx);
      for(const f of feat){ctx.beginPath();path(f);ctx.fillStyle='rgba(205,255,77,.12)';ctx.fill();ctx.strokeStyle='rgba(205,255,77,.60)';ctx.lineWidth=Math.max(.55,R/320);ctx.stroke();}
    } else {
      ctx.fillStyle='rgba(205,255,77,.35)';
      for(let la=-72;la<=72;la+=9) for(let lo=-180;lo<180;lo+=9){const a=la*Math.PI/180,o=(lo+t*.9)*Math.PI/180,x=R*Math.cos(a)*Math.sin(o),y=-R*Math.sin(a),z=Math.cos(a)*Math.cos(o);if(z>.05){ctx.beginPath();ctx.arc(x,y,1+z*1.1,0,Math.PI*2);ctx.fill();}}
    }
    ctx.strokeStyle='rgba(0,255,255,.14)';ctx.lineWidth=1;
    for(let la=-60;la<=60;la+=20){const y=R*Math.sin(la*Math.PI/180),rx=R*Math.cos(la*Math.PI/180);ctx.beginPath();ctx.ellipse(0,y,rx,rx*.16,0,0,Math.PI*2);ctx.stroke();}
    for(let lo=0;lo<180;lo+=20){const a=(lo+t*.9)*Math.PI/180;ctx.beginPath();ctx.ellipse(0,0,Math.abs(Math.cos(a))*R,R,0,0,Math.PI*2);ctx.stroke();}
    ctx.strokeStyle='rgba(0,255,255,.72)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(205,255,77,.25)';ctx.lineWidth=1;ctx.setLineDash([4,8]);ctx.beginPath();ctx.arc(0,0,R*1.16,-.95,.55);ctx.stroke();ctx.setLineDash([]);
    if(lock>0){const a=-.72, px=Math.cos(a)*R*.72, py=Math.sin(a)*R*.42, pulse=7+Math.sin(performance.now()/150)*2.5;ctx.fillStyle='#ff003c';ctx.shadowColor='#ff003c';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(px,py,4.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,0,60,.7)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px,py,pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#cdff4d';ctx.font='10px JetBrains Mono';ctx.fillText('INDIA // LOCK',px+13,py+4);}
    ctx.restore();
  }

  function indiaMap(t, progress=1) {
    const cx=W/2, cy=H/2+8, scale=Math.min(W,H)*.44;
    ctx.save(); ctx.fillStyle='rgba(4,9,12,.92)'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(0,255,255,.075)';ctx.lineWidth=1;for(let x=0;x<W;x+=38){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.fillStyle='rgba(205,255,77,.035)';ctx.beginPath();ctx.arc(cx,cy,scale*.93,0,Math.PI*2);ctx.fill();
    if(indiaReady&&window.d3&&window.topojson){
      const obj=Object.keys(india.objects||{})[0]; const features=obj?topojson.feature(india,india.objects[obj]).features:[];
      const p=d3.geoMercator().translate([cx,cy]).center([79.2,22.5]).scale(scale*2.8);const path=d3.geoPath(p,ctx);
      for(const f of features){ctx.beginPath();path(f);ctx.fillStyle='rgba(205,255,77,.055)';ctx.fill();ctx.strokeStyle='rgba(205,255,77,.56)';ctx.lineWidth=1.05;ctx.stroke();}
      const [tx,ty]=p([78.48,11.10]); const pulse=7+Math.sin(performance.now()/150)*3;ctx.fillStyle='#ff003c';ctx.shadowColor='#ff003c';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(tx,ty,4.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,0,60,.62)';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(tx,ty,pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#cdff4d';ctx.font='10px JetBrains Mono';ctx.fillText('TAMIL NADU',tx+13,ty+4);
      if(progress>0){ctx.strokeStyle='rgba(0,255,255,.38)';ctx.setLineDash([5,8]);ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(tx,ty,42+18*Math.sin(t*.05),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    } else {
      const P=[[.49,.02],[.58,.07],[.66,.14],[.72,.25],[.79,.36],[.75,.47],[.68,.57],[.61,.69],[.56,.83],[.49,.98],[.44,.86],[.40,.73],[.33,.61],[.25,.48],[.29,.37],[.36,.28],[.42,.15]];const bw=scale*.9,bh=scale*1.18,ox=cx-bw/2,oy=cy-bh/2;ctx.beginPath();P.forEach((q,i)=>{const x=ox+q[0]*bw,y=oy+q[1]*bh;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle='rgba(205,255,77,.065)';ctx.fill();ctx.strokeStyle='rgba(205,255,77,.72)';ctx.lineWidth=2;ctx.shadowColor='#cdff4d';ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;const tx=cx,ty=oy+.84*bh;ctx.fillStyle='#ff003c';ctx.beginPath();ctx.arc(tx,ty,4.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#cdff4d';ctx.font='10px JetBrains Mono';ctx.fillText('TAMIL NADU',tx+13,ty+4);
    }
    ctx.fillStyle='rgba(0,255,255,.55)';ctx.font='8px JetBrains Mono';ctx.fillText('INDIA // STATE GRID',Math.max(15,cx-scale),Math.min(H-16,cy+scale));
    const scan=((t%1000)/1000)*(W+120)-60;ctx.fillStyle='rgba(205,255,77,.08)';ctx.fillRect(scan,0,2,H);ctx.restore();
  }

  const route=[
    {x:.08,y:.78},{x:.22,y:.42},{x:.36,y:.66},{x:.50,y:.28},{x:.64,y:.56},{x:.77,y:.34},{x:.90,y:.68}
  ];
  function routePt(u){const n=route.length-1,f=u*n,i=Math.min(n-1,Math.floor(f)),q=f-i,a=route[i],b=route[i+1];return{x:(a.x+(b.x-a.x)*q)*W,y:(a.y+(b.y-a.y)*q)*H};}
  function routeScene(progress,t){
    ctx.save();ctx.fillStyle='rgba(20,16,8,.50)';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(205,255,77,.055)';for(let x=0;x<W;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    ctx.beginPath();route.forEach((p,i)=>{const x=p.x*W,y=p.y*H;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=12;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.setLineDash([10,12]);ctx.strokeStyle='rgba(205,255,77,.48)';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();const steps=90;for(let s=0;s<=steps*progress;s++){const p=routePt(s/steps);s?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.strokeStyle='rgba(205,255,77,.95)';ctx.lineWidth=3;ctx.shadowColor='#cdff4d';ctx.shadowBlur=14;ctx.stroke();ctx.shadowBlur=0;
    route.forEach((p,i)=>{const x=p.x*W,y=p.y*H,reached=progress>=(i/(route.length-1))-.01;ctx.fillStyle=reached?'#cdff4d':'rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(x,y,reached?7:5,0,Math.PI*2);ctx.fill();if(reached){ctx.strokeStyle='rgba(205,255,77,.45)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();}ctx.strokeStyle=reached?'rgba(205,255,77,.7)':'rgba(255,255,255,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x,y-22);ctx.stroke();ctx.fillStyle=reached?'#ff003c':'rgba(255,255,255,.18)';ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x+10,y-18);ctx.lineTo(x,y-14);ctx.fill();});
    const p=routePt(Math.min(1,progress)),p2=routePt(Math.min(1,progress+.01)),ang=Math.atan2(p2.y-p.y,p2.x-p.x);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);ctx.fillStyle='rgba(205,255,77,.28)';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(48,-14);ctx.lineTo(48,14);ctx.closePath();ctx.fill();ctx.shadowColor='#cdff4d';ctx.shadowBlur=16;ctx.fillStyle='#cdff4d';ctx.fillRect(-15,-7,28,14);ctx.fillStyle='#00ffff';ctx.fillRect(-7,-12,14,7);ctx.shadowBlur=0;ctx.fillStyle='#111';ctx.beginPath();ctx.arc(-8,8,4,0,Math.PI*2);ctx.arc(8,8,4,0,Math.PI*2);ctx.fill();ctx.restore();ctx.restore();
    milestones.forEach((m,i)=>{const show=progress>=(i/(route.length-1))-.01;m[6].style.opacity=show?'1':'0';m[6].style.transform=show?'translate(-50%,-50%) scale(1)':'translate(-50%,-50%) scale(.86)';});
  }

  function staticRoute(){clear();routeScene(1,0);phase.textContent='PHASE: COMPLETE';}

  function loop(ts){
    if(!start)start=ts;const e=(ts-start)/1000;clear();drawStars(ts,1);
    if(e<5){phase.textContent='PHASE: GLOBAL RECON';globe(e,1+(e/5)*1.55,0);}
    else if(e<9){const k=(e-5)/4;phase.textContent='PHASE: INDIA // GEOGRAPHIC LOCK';ctx.save();ctx.globalAlpha=1-k;globe(e,2.55-k*.75,0);ctx.restore();indiaMap(ts,k);}
    else if(e<20){const k=Math.min(1,(e-9)/11);phase.textContent='PHASE: THE ASCENT · MILESTONE ROUTE';routeScene(k,ts);}
    else{staticRoute();playing=false;return;}
    raf=requestAnimationFrame(loop);
  }

  function start(){ if(playing)return; playing=true;start=0;milestones.forEach(m=>{m[6].style.opacity='0';});cancelAnimationFrame(raf);raf=requestAnimationFrame(loop); }
  replay.addEventListener('click',start);
  const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){start();obs.disconnect();}}),{threshold:.3});obs.observe(stage);

  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){cancelAnimationFrame(raf);staticRoute();}
})();
