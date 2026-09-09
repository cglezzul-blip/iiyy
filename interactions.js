(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = matchMedia('(min-width: 821px)');
  const clamp = (x,min,max) => Math.min(max,Math.max(min,x));
  const damp = (x,y,k,dt) => x+(y-x)*(1-Math.exp(-k*dt));

  function setupImageCursor() {
    const links=$$('[data-follow-card] > a');
    if(!links.length)return;
    const portal=document.createElement('span');portal.className='image-cursor';portal.setAttribute('aria-hidden','true');
    const image=document.createElement('img');image.alt='';image.decoding='async';portal.append(image);document.body.append(portal);
    const state={link:null,token:0,loaded:false,x:0,y:0,targetX:0,targetY:0,width:270,height:180,angle:4,targetAngle:4,frame:0,time:0,lastMove:0,lastX:0};
    const allowed=()=>pointer.matches&&desktop.matches&&!motion.matches&&!document.hidden;
    function stop(){
      state.token++;state.loaded=false;state.link?.classList.remove('has-image-cursor');state.link=null;
      portal.classList.remove('is-visible');if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;
    }
    function updateTarget(event) {
      const halfW=state.width*.5,halfH=state.height*.5;
      // Keep the image centre at the pointer. Only protect the outer viewport edge.
      state.targetX=clamp(event.clientX,halfW+9,innerWidth-halfW-9);
      state.targetY=clamp(event.clientY,halfH+9,innerHeight-halfH-9);
      state.targetAngle=4+clamp((event.clientX-state.lastX)*.075,-2.3,2.3);
      state.lastX=event.clientX;state.lastMove=performance.now();
    }
    function paint(now) {
      const dt=Math.min(.04,Math.max(.001,(now-state.time)/1000));state.time=now;
      if(now-state.lastMove>90)state.targetAngle=4;
      state.x=damp(state.x,state.targetX,40,dt);state.y=damp(state.y,state.targetY,40,dt);
      state.angle=damp(state.angle,state.targetAngle,15,dt);
      portal.style.transform=`translate3d(${state.x.toFixed(2)}px,${state.y.toFixed(2)}px,0) translate(-50%,-50%) rotate(${state.angle.toFixed(2)}deg)`;
      const unsettled=Math.abs(state.x-state.targetX)+Math.abs(state.y-state.targetY)+Math.abs(state.angle-state.targetAngle)>.08;
      state.frame=unsettled||now-state.lastMove<110?requestAnimationFrame(paint):0;
    }
    function schedule(){if(!state.frame){state.time=performance.now();state.frame=requestAnimationFrame(paint);}}
    links.forEach(link=>{
      const source=$('.work-follow-media img',link);if(!source)return;
      link.addEventListener('pointerenter',async event=>{
        if(!allowed()||event.pointerType==='touch')return;
        stop();state.link=link;const token=state.token;
        state.width=clamp(innerWidth*.2,250,320);portal.style.width=`${state.width}px`;
        state.height=state.width*(Number(source.height)||9)/(Number(source.width)||16);
        state.lastX=event.clientX;updateTarget(event);state.x=state.targetX;state.y=state.targetY;state.angle=4;
        image.src=source.currentSrc||source.src;
        try{await image.decode();}catch{if(token===state.token)stop();return;}
        if(token!==state.token||state.link!==link||!allowed()||!link.matches(':hover'))return;
        state.height=state.width*image.naturalHeight/image.naturalWidth;
        portal.style.aspectRatio=`${image.naturalWidth} / ${image.naturalHeight}`;
        state.loaded=true;paint(performance.now());portal.classList.add('is-visible');link.classList.add('has-image-cursor');
      });
      link.addEventListener('pointermove',event=>{if(state.link!==link)return;updateTarget(event);if(state.loaded)schedule();},{passive:true});
      link.addEventListener('pointerleave',()=>{if(state.link===link)stop();});
      link.addEventListener('pointercancel',stop);link.addEventListener('click',stop);
    });
    image.addEventListener('error',stop);
    addEventListener('blur',stop);addEventListener('resize',stop);
    document.documentElement.addEventListener('pointerleave',stop);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    document.addEventListener('keydown',event=>{if(event.key==='Tab'||event.key==='Escape')stop();});
    [pointer,motion,desktop].forEach(query=>query.addEventListener('change',()=>{if(!allowed())stop();}));
  }

  function setupThinking() {
    const section=$('#thinking');if(!section)return;
    const scrollArea=$('.thinking-scroll',section),consoleArea=$('.thinking-console',section);
    const panels=$$('.principle',section),nav=$$('.principle-nav a',section);
    const enabled=()=>desktop.matches&&!motion.matches;
    let active=-1,frame=0;
    function select(index) {
      index=clamp(index,0,panels.length-1);if(index===active)return;active=index;
      panels.forEach((panel,i)=>{panel.hidden=enabled()&&i!==index;panel.classList.toggle('is-current',i===index);});
      nav.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
      section.style.setProperty('--principle-progress',String((index+1)/panels.length));
    }
    function geometry(){const rect=scrollArea.getBoundingClientRect();const inset=parseFloat(getComputedStyle(consoleArea).top)||100;return{start:scrollY+rect.top-inset,travel:Math.max(1,scrollArea.offsetHeight-consoleArea.offsetHeight)};}
    function render(){frame=0;if(!enabled())return;const g=geometry();select(Math.round(clamp((scrollY-g.start)/g.travel,0,1)*(panels.length-1)));}
    function queue(){if(!frame&&enabled())frame=requestAnimationFrame(render);}
    function sync(){section.classList.toggle('thinking-enhanced',enabled());active=-1;select(0);queue();}
    nav.forEach((link,i)=>link.addEventListener('click',event=>{
      if(!enabled())return;event.preventDefault();const g=geometry();
      select(i);scrollTo({top:g.start+g.travel*i/(panels.length-1),behavior:'instant'});
      history.replaceState(null,'',`#${panels[i].id}`);
    }));
    function route(){const i=panels.findIndex(panel=>`#${panel.id}`===location.hash);if(i<0||!enabled())return;const g=geometry();select(i);scrollTo({top:g.start+g.travel*i/(panels.length-1),behavior:'instant'});}
    addEventListener('scroll',queue,{passive:true});addEventListener('resize',()=>{sync();},{passive:true});
    addEventListener('hashchange',route);desktop.addEventListener('change',sync);motion.addEventListener('change',sync);
    sync();Promise.resolve(document.fonts?.ready).then(route);
  }

  function setupContentReveals() {
    const selectors=['.identity-statement','.identity-aside','.capability-heading h2','.capability-heading p','.capability-shortcut','.capability-card','.works-heading h2','.works-heading > p','.thinking-intro','.principle-nav','.certificates-heading','.evidence-heading','.education-record','.contact > p:first-child','.contact > h2','.contact-email','.contact-directory','.contact-actions','.workflow-steps li'];
    const candidates=new Set($$('[data-reveal]'));
    selectors.forEach(selector=>$$(selector).forEach(node=>candidates.add(node)));
    const nodes=[...candidates].filter(node=>!node.closest('.principle'));
    const stages=$$('.thinking--stage .principle');
    const records=[...nodes.map(node=>({node,stage:false})),...stages.map(node=>({node,stage:true}))];
    const byNode=new Map(records.map(record=>[record.node,record]));
    let observer;
    // Test both axes, including the actual clipped rail. A card outside a
    // horizontal viewport must keep its first entrance until it is discovered.
    function visible(node){
      if(node.closest('[hidden]')||!node.getClientRects().length)return false;
      const rect=node.getBoundingClientRect();
      let left=0,top=0,right=innerWidth,bottom=innerHeight;
      const rail=node.closest('.capability-rail,.work-grid,.certificate-grid');
      if(rail&&rail!==node){
        const clip=rail.getBoundingClientRect();
        left=Math.max(left,clip.left);top=Math.max(top,clip.top);
        right=Math.min(right,clip.right);bottom=Math.min(bottom,clip.bottom);
      }
      return rect.width>0&&rect.height>0&&rect.right>left&&rect.left<right&&rect.bottom>top&&rect.top<bottom;
    }
    function enter(record,instant=false){
      const {node,stage}=record;
      if(instant)node.classList.add(stage?'content-stage-instant':'content-instant');
      node.classList.add(stage?'content-stage-entered':'content-entered','is-visible');
      if(!stage)observer?.unobserve(node);
    }
    function showAll(){observer?.disconnect();records.forEach(record=>enter(record,true));}
    function refresh(){
      if(!observer||motion.matches){showAll();return;}
      records.forEach(record=>{
        const {node,stage}=record;
        if(stage&&node.hidden)node.classList.remove('content-stage-entered','content-stage-instant');
        if(visible(node))enter(record,true);
        if(stage||!node.classList.contains('content-entered'))observer.observe(node);
      });
    }
    function revealTarget(target,stageInstant=true){
      if(!target)return;
      records.forEach(record=>{
        const node=record.node;
        if(node===target||node.contains(target)||(target.contains(node)&&visible(node)))enter(record,!record.stage||stageInstant);
      });
    }
    function hashTarget(hash=location.hash){
      try{return document.getElementById(decodeURIComponent(hash.slice(1)));}catch{return null;}
    }
    function route(){revealTarget(hashTarget());}
    try{
      if(!('IntersectionObserver' in window)){showAll();return;}
      // One observer owns ordinary entrances, clipped rails, and stage switches.
      observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        const record=byNode.get(entry.target);if(!record)return;
        if(record.stage&&record.node.hidden){
          record.node.classList.remove('content-stage-entered','content-stage-instant');return;
        }
        if(entry.isIntersecting&&entry.intersectionRect.width>0&&entry.intersectionRect.height>0)enter(record);
      }),{threshold:0,rootMargin:'0px'});
      // Measure before enabling displacement; visible initial content never
      // fades out while the observer waits for its first asynchronous delivery.
      const initiallyVisible=new Set(records.filter(record=>visible(record.node)));
      records.forEach(record=>{
        record.node.classList.add(record.stage?'content-stage':'content-reveal','is-visible');
        if(initiallyVisible.has(record))enter(record,true);
        if(record.stage||!record.node.classList.contains('content-entered'))observer.observe(record.node);
      });
      if(motion.matches)showAll();
    }catch{showAll();return;}
    motion.addEventListener('change',refresh);
    desktop.addEventListener('change',refresh);
    addEventListener('hashchange',route);
    addEventListener('pageshow',event=>{if(event.persisted)refresh();route();});
    // Existing workflow and principle links use history.push/replaceState,
    // which do not emit hashchange. Listen without taking over their navigation.
    document.addEventListener('click',event=>{
      const link=event.target.closest('a[href]');if(!link)return;
      const url=new URL(link.href,location.href);
      if(!url.hash||url.origin!==location.origin||url.pathname!==location.pathname)return;
      const target=hashTarget(url.hash);revealTarget(target,false);
      requestAnimationFrame(()=>revealTarget(target,false));
    },true);
    document.addEventListener('focusin',event=>revealTarget(event.target));
    route();Promise.resolve(document.fonts?.ready).then(route);
  }
  setupImageCursor();setupThinking();setupContentReveals();
})();
