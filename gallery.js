(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const decks = window.PPT_DECKS || [];
  const space = $('#space'), overview = $('#overviewWorld'), deckWorld = $('#deckWorld');
  const viewer = $('#imageViewer'), viewerImage = $('#viewerImage'), viewport = $('#viewerViewport');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width:760px)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const pageIndex = (value, count) => clamp(Number.isFinite(Number(value))?Math.trunc(Number(value)):0,0,count-1);
  const state = {mode:'overview', deck:0, page:0, position:0, target:0,
    x:0, y:0, z:0, tx:0, ty:0, tz:0, vx:0, vy:0, px:0, py:0, ptx:0, pty:0};
  let frame = 0, lastTime = 0, drag = null, activeCards = [], fieldMoving=false, restoringFocus=false;
  let savedCamera = {x:0,y:0,z:0}, savedOverviewFocus = null, savedViewerFocus = null, zoom = 1, pan = null;
  let transition = null, pinch = null, wheel = {last:0, total:0, used:false, direction:0};
  const pointers = new Map();
  let sceneWidth = space.clientWidth, sceneHeight = space.clientHeight;
  const camera=()=>({x:-state.x,y:-state.y,z:state.z});

  function makeCard(item, title, index, isPage) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `artwork${isPage?' is-page':''}`;
    button.dataset[isPage?'page':'deck'] = index;
    button.setAttribute('aria-label', isPage?`${title}，第 ${index+1} 页，点击放大阅读`:`进入${title}，${decks[index].pages.length} 页`);
    const media = document.createElement('span'); media.className='artwork-media';
    const img=document.createElement('img'); img.src=item.src; img.width=item.width; img.height=item.height;
    img.alt=isPage?`${title}，第 ${index+1} 页`:title; img.draggable=false;
    img.decoding='async'; img.loading=isPage&&index>3?'lazy':'eager';
    media.append(img);
    img.addEventListener('error',()=>{
      button.classList.add('is-unavailable');img.hidden=true;
      const message=document.createElement('span');message.className='media-error';message.textContent='图片未能载入，点击重试';media.append(message);
    },{once:true});
    const caption=document.createElement('span');caption.className='artwork-caption';
    const label=document.createElement('span');label.textContent=isPage?String(index+1).padStart(2,'0'):title;caption.append(label);
    if(!isPage){const count=document.createElement('small');count.textContent=`${decks[index].pages.length} 页`;caption.append(count);}
    button.append(media,caption);
    button.addEventListener('click',e=>{if(e.detail===0) activate(button);});
    button.addEventListener('focus',()=>{
      if(drag||transition||restoringFocus||!button.matches(':focus-visible'))return;
      if(isPage){selectPage(index,false);}else{centerInstance(button);}
    });
    return button;
  }

  const field=new window.PPTSpatialField({decks,container:overview,makeCard,mobile,reduced});
  decks.forEach(deck=>{
    const option=document.createElement('option');option.value=deck.id;option.textContent=deck.title;$('#deckPicker').append(option);
  });

  function setTransform(card,x,y,z,w,ry=0,rz=0,opacity=1) {
    card.style.width=`${w.toFixed(2)}px`;
    card.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    card.style.opacity=opacity.toFixed(3);
    card.style.pointerEvents=opacity<.1?'none':'';
  }

  function render(dt=16,now=performance.now()) {
    if(state.mode==='overview') {
      fieldMoving=field.render(camera(),sceneWidth,sceneHeight,dt,now);
      return;
    }
    fieldMoving=false;
    // One cylindrical group. Every real page keeps its original index; off-axis
    // pages are culled, not duplicated into another row or chapter.
    const fit=Math.min(sceneWidth*(mobile.matches?.8:.52),sceneHeight*1.4,920);
    const radius=fit*1.18, step=50*Math.PI/180;
    activeCards.forEach((card,i)=>{
      const diff=i-state.position, angle=clamp(diff*step,-Math.PI,Math.PI);
      const opacity=clamp((2.2-Math.abs(diff))/.7,0,1);
      setTransform(card,Math.sin(angle)*radius,0,(Math.cos(angle)-1)*radius,fit,angle*180/Math.PI,0,opacity);
      card.style.visibility=opacity<.015?'hidden':'';
      card.tabIndex=i===state.page?0:-1;
      card.setAttribute('aria-hidden',String(opacity<.1));
      card.classList.toggle('is-current',i===state.page);
      if(Math.abs(diff)<3)card.querySelector('img').loading='eager';
    });
  }

  function tick(now) {
    frame=0;
    const dt=Math.min(120,now-(lastTime||now-16));lastTime=now;
    const ease=reduced.matches?1:1-Math.exp(-dt/(state.mode==='deck'?115:95));
    if(!drag&&!pinch&&state.mode==='overview'&&!transition){
      state.tx+=state.vx*dt/16;state.ty+=state.vy*dt/16;
      state.vx*=Math.pow(.87,dt/16);state.vy*=Math.pow(.87,dt/16);
    }
    state.x=mix(state.x,state.tx,ease);state.y=mix(state.y,state.ty,ease);
    state.z=mix(state.z,state.tz,ease);
    state.px=mix(state.px,state.ptx,ease);state.py=mix(state.py,state.pty,ease);
    state.position=mix(state.position,state.target,ease);
    render(dt,now);
    const moving=Math.abs(state.x-state.tx)+Math.abs(state.y-state.ty)+Math.abs(state.z-state.tz)+Math.abs(state.px-state.ptx)+Math.abs(state.py-state.pty)+Math.abs(state.vx)+Math.abs(state.vy)+Math.abs(state.position-state.target)*100;
    if((moving>.025||fieldMoving)&&!document.hidden&&!viewer.open)queue();
  }
  function queue(){if(!frame&&!document.hidden&&!viewer.open)frame=requestAnimationFrame(tick);}
  function stopMomentum(){state.vx=0;state.vy=0;}
  function centerInstance(card){const item=field.getEntry(card);if(!item)return;const p=field.getPosition(item);stopMomentum();state.tx=-p.x;state.ty=-p.y;state.tz=p.z-(mobile.matches?900:1200);queue();}
  function resetCamera(){stopMomentum();state.x=state.y=state.z=state.tx=state.ty=state.tz=0;state.ptx=state.pty=0;field.pin(null);render();queue();}
  function advanceCamera(amount){if(transition)return;stopMomentum();state.tz+=amount;queue();}

  function updateControls() {
    const inDeck=state.mode==='deck';
    $('#homeLink').hidden=inDeck;$('#backToGallery').hidden=!inDeck;
    $('#overviewControls').hidden=inDeck;$('#deckControls').hidden=!inDeck;
    overview.hidden=inDeck;overview.inert=inDeck;deckWorld.hidden=!inDeck;deckWorld.inert=!inDeck;
    $('#galleryTitle').textContent=inDeck?decks[state.deck].title:'PPT 作品展厅';
    $('#collectionCount').textContent=inDeck?`${decks[state.deck].pages.length} 页`:`${decks.length} 套作品`;
    if(!inDeck)return;
    const n=decks[state.deck].pages.length;
    const focused=document.activeElement;
    $('#pageCount').textContent=`${state.page+1} / ${n}`;
    $('#previousPage').disabled=state.page===0;$('#nextPage').disabled=state.page===n-1;
    if(focused?.disabled)$('#focusPage').focus({preventScroll:true});
    $('#spaceStatus').textContent=`${decks[state.deck].title}，第 ${state.page+1} 页，共 ${n} 页`;
  }

  function routeHash(detail=false){return `#deck=${decks[state.deck].id}&page=${state.page+1}${detail?'&read=1':''}`;}
  function updateRoute(){if(state.mode==='deck')history.replaceState({...history.state,pptSpace:true},'',routeHash(viewer.open));}

  function finishTransition() {
    if(!transition)return;
    const current=transition;transition=null;
    clearTimeout(current.timer);current.animations.forEach(a=>a.cancel());current.layer.remove();
    space.inert=false;$('#deckControls').inert=false;space.removeAttribute('aria-busy');queue();
  }
  function transitionFrom(src,rect,destination) {
    finishTransition();
    if(reduced.matches||!rect||rect.width<1||!destination)return;
    const end=destination.getBoundingClientRect();
    if(end.width<1||rect.right<0||rect.left>innerWidth||rect.bottom<0||rect.top>innerHeight)return;
    const layer=document.createElement('div');layer.className='transition-layer';layer.setAttribute('aria-hidden','true');
    const current={layer,animations:[],timer:0};transition=current;
    space.inert=true;$('#deckControls').inert=true;space.setAttribute('aria-busy','true');
    // Codrops Repeating Image Transition, effect01: six FIXED intermediate
    // rectangles, staggered clipping, not six translating or fabricated pages.
    for(let i=0;i<6;i++){
      const t=(i+1)/7,image=new Image();image.src=src;image.alt='';image.className='transition-image';
      image.style.cssText=`left:${mix(rect.left,end.left,t)}px;top:${mix(rect.top,end.top,t)}px;width:${mix(rect.width,end.width,t)}px;height:${mix(rect.height,end.height,t)}px`;
      layer.append(image);
      current.animations.push(image.animate([
        {clipPath:'inset(100% 0 0 0)',offset:0,easing:'cubic-bezier(.47,0,.745,.715)'},
        {clipPath:'inset(0 0 0 0)',offset:350/840},
        {clipPath:'inset(0 0 0 0)',offset:490/840,easing:'cubic-bezier(.445,.05,.55,.95)'},
        {clipPath:'inset(0 0 100% 0)',offset:1}
      ],{duration:840,delay:i*50,fill:'both'}));
    }
    document.body.append(layer);
    // Reveal every real slide in the SAME carousel, not a single-image panel.
    activeCards.forEach(card=>{
      current.animations.push(card.querySelector('.artwork-media').animate([
        {clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0 0 0 0)'}
      ],{duration:700,delay:300,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}));
      current.animations.push(card.querySelector('.artwork-caption').animate([{opacity:0},{opacity:1}],{duration:300,delay:650,fill:'both'}));
    });
    current.timer=setTimeout(()=>{if(transition===current)finishTransition();},1140);
  }

  function buildPages() {
    activeCards=[];deckWorld.replaceChildren();
    const deck=decks[state.deck];
    deck.pages.forEach((page,i)=>{
      const card=makeCard(page,deck.title,i,true);activeCards.push(card);deckWorld.append(card);
    });
  }

  function enterDeck(index,options={}) {
    if(index<0||index>=decks.length)return;
    if(transition&&!options.fromRoute)return;
    finishTransition();resetGesture();wheel={last:0,total:0,used:false,direction:0};
    let sourceRect=null,sourceSrc='';
    if(state.mode==='overview'){
      savedCamera=camera();state.tx=state.x;state.ty=state.y;state.tz=state.z;
      savedOverviewFocus=options.instance||field.findDeck(index)||null;field.pin(savedOverviewFocus);
      const img=savedOverviewFocus?.querySelector('img');sourceRect=img?.getBoundingClientRect();sourceSrc=img?.src;
      if(!options.fromRoute)history.replaceState({pptSpace:true,view:'overview',camera:savedCamera,instance:savedOverviewFocus?.dataset.instance},'',location.pathname+location.search);
    }
    stopMomentum();
    const rebuild=state.mode!=='deck'||state.deck!==index;
    state.mode='deck';state.deck=index;state.page=pageIndex(options.page??0,decks[index].pages.length);
    state.position=state.target=state.page;
    state.px=state.py=state.ptx=state.pty=0;
    if(rebuild)buildPages();
    updateControls();render();
    if(!options.fromRoute){history.pushState({pptSpace:true,view:'deck'},'',routeHash());$('#backToGallery').focus({preventScroll:true});}
    if(sourceRect&&!options.fromRoute)transitionFrom(sourceSrc,sourceRect,activeCards[state.page].querySelector('img'));
    queue();
  }

  function showOverview(position=savedCamera) {
    finishTransition();resetGesture();
    if(viewer.open)viewer.close();
    state.mode='overview';state.x=state.tx=-(position?.x||0);state.y=state.ty=-(position?.y||0);state.z=state.tz=position?.z||0;
    state.px=state.py=state.ptx=state.pty=0;stopMomentum();updateControls();render();
    restoringFocus=true;
    (savedOverviewFocus?.isConnected?savedOverviewFocus:field.getCard(history.state?.instance)||$('#deckPicker')).focus({preventScroll:true});
    restoringFocus=false;
    $('#deckPicker').value='';queue();
  }

  function backToGallery(){
    finishTransition();
    if(history.state?.view==='deck')history.back();
    else{history.replaceState({pptSpace:true,view:'overview',camera:savedCamera},'',location.pathname+location.search);showOverview();}
  }
  function selectPage(index,writeHistory=true) {
    if(state.mode!=='deck'||transition)return;
    state.page=pageIndex(index,decks[state.deck].pages.length);state.target=state.page;
    updateControls();queue();if(writeHistory)updateRoute();
  }
  function activate(card) {
    if(!card||transition)return;
    if(card.classList.contains('is-unavailable')){
      const img=card.querySelector('img');card.querySelector('.media-error')?.remove();img.hidden=false;img.src=img.src;card.classList.remove('is-unavailable');return;
    }
    if(card.dataset.deck!==undefined){enterDeck(Number(card.dataset.deck),{page:Number(card.dataset.pageIndex)||0,instance:card});return;}
    const i=Number(card.dataset.page);
    if(i!==state.page)selectPage(i);else openViewer();
  }

  // The same captured gesture moves the depth field or turns the page corridor.
  function resetGesture(){
    const ids=[...pointers.keys()];drag=null;pinch=null;pointers.clear();
    space.classList.remove('is-dragging');
    ids.forEach(id=>{if(space.hasPointerCapture(id))space.releasePointerCapture(id);});stopMomentum();
  }
  function pointerPair(){const [a,b]=[...pointers.values()];return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  space.addEventListener('pointerdown',e=>{
    if((e.pointerType==='mouse'&&e.button!==0)||viewer.open||transition)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});space.setPointerCapture(e.pointerId);stopMomentum();
    if(pointers.size===2&&state.mode==='overview'){
      pinch={...pointerPair(),z:state.tz,x0:state.tx,y0:state.ty};drag=null;space.classList.add('is-dragging');return;
    }
    if(pointers.size>1)return;
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,time:e.timeStamp,moved:false,target:e.target.closest('.artwork'),tx:state.tx,ty:state.ty,page:state.target};
  });
  space.addEventListener('pointermove',e=>{
    if(viewer.open||transition)return;
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&pointers.size>=2){
      const pair=pointerPair(),scale=pair.distance/pinch.distance;
      state.tz=pinch.z+Math.log(scale)*1100;
      state.tx=pinch.x0+pair.x-pinch.x;state.ty=pinch.y0+pair.y-pinch.y;queue();return;
    }
    if(drag&&drag.id===e.pointerId){
      const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
      if(Math.hypot(dx,dy)>7)drag.moved=true;
      if(drag.moved){
        space.classList.add('is-dragging');
        if(state.mode==='overview'){
          state.tx=drag.tx+dx;state.ty=drag.ty+dy;
          const delta=Math.max(8,e.timeStamp-drag.time);state.vx=clamp((e.clientX-drag.x)*16/delta,-28,28);state.vy=clamp((e.clientY-drag.y)*16/delta,-28,28);
        }else{
          state.target=clamp(drag.page-dx/(mobile.matches?210:440),0,decks[state.deck].pages.length-1);
          state.page=Math.round(state.target);updateControls();
        }
      }
      drag.x=e.clientX;drag.y=e.clientY;drag.time=e.timeStamp;queue();return;
    }
    if(e.pointerType==='mouse'&&!reduced.matches){state.ptx=(e.clientX/innerWidth-.5)*22;state.pty=(e.clientY/innerHeight-.5)*14;queue();}
  });
  function endDrag(e,cancelled=false){
    pointers.delete(e.pointerId);
    if(pinch){if(pointers.size<2)pinch=null;drag=null;space.classList.remove('is-dragging');if(space.hasPointerCapture(e.pointerId))space.releasePointerCapture(e.pointerId);queue();return;}
    if(!drag||e.pointerId!==drag.id)return;
    const current=drag;drag=null;space.classList.remove('is-dragging');
    if(space.hasPointerCapture(e.pointerId))space.releasePointerCapture(e.pointerId);
    if(cancelled){stopMomentum();if(state.mode==='deck')selectPage(state.page);return;}
    if(!current.moved){stopMomentum();activate(current.target);}
    else if(state.mode==='deck'){selectPage(Math.round(state.target));}
    else if(reduced.matches||e.timeStamp-current.time>80){stopMomentum();}
    queue();
  }
  space.addEventListener('pointerup',e=>endDrag(e));space.addEventListener('pointercancel',e=>endDrag(e,true));
  space.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId||pointers.has(e.pointerId))endDrag(e,true);});
  space.addEventListener('pointerleave',()=>{if(!drag){state.ptx=state.pty=0;queue();}});
  space.addEventListener('wheel',e=>{
    if(viewer.open)return;e.preventDefault();if(transition||drag||pinch)return;stopMomentum();
    const factor=e.deltaMode===1?16:e.deltaMode===2?sceneHeight:1;
    if(state.mode==='overview'){
      if(e.shiftKey){state.tx-=(e.deltaX||e.deltaY)*factor;}
      else{state.tx-=e.deltaX*factor;advanceCamera((e.ctrlKey?-e.deltaY*4:e.deltaY)*factor*1.1);}
    }else{
      if(e.ctrlKey)return;
      const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*factor;
      const now=performance.now(),direction=Math.sign(delta),magnitude=Math.abs(delta);
      if(!direction)return;
      if(now-wheel.last>180||direction!==wheel.direction)wheel={last:now,total:0,used:false,direction,committed:0,peak:0};
      wheel.last=now;wheel.total+=magnitude;wheel.peak=Math.max(wheel.peak,magnitude);
      // Consume a touchpad burst once. Deliberate continuing wheel notches may
      // advance at a measured cadence; a decaying inertial tail cannot.
      const renewed=wheel.used&&now-wheel.committed>420&&magnitude>=60&&magnitude>=wheel.peak*.7;
      if((!wheel.used&&wheel.total>=30)||renewed){selectPage(state.page+direction);wheel.used=true;wheel.committed=now;wheel.total=0;}
    }queue();
  },{passive:false});

  $('#resetCamera').addEventListener('click',resetCamera);
  $('#cameraNear').addEventListener('click',()=>advanceCamera(200));
  $('#cameraFar').addEventListener('click',()=>advanceCamera(-200));
  $('#deckPicker').addEventListener('change',e=>{const i=decks.findIndex(d=>d.id===e.target.value);if(i>=0)enterDeck(i);});
  $('#backToGallery').addEventListener('click',backToGallery);
  $('#previousPage').addEventListener('click',()=>selectPage(state.page-1));
  $('#nextPage').addEventListener('click',()=>selectPage(state.page+1));
  $('#focusPage').addEventListener('click',()=>openViewer());

  function applyZoom(value) {
    zoom=clamp(value,1,3);
    const focused=document.activeElement;
    $('#zoomReset').textContent=`${Math.round(zoom*100)}%`;$('#zoomOut').disabled=zoom<=1;$('#zoomIn').disabled=zoom>=3;
    if(focused?.disabled)$('#zoomReset').focus({preventScroll:true});
    viewport.classList.toggle('is-zoomed',zoom>1);
    if(zoom===1){viewerImage.style.width='';viewerImage.style.height='';viewport.scrollTo(0,0);return;}
    const pad=mobile.matches?16:64,ratio=(viewerImage.naturalWidth||16)/(viewerImage.naturalHeight||9);
    const fit=Math.min(viewport.clientWidth-pad,(viewport.clientHeight-(mobile.matches?16:32))*ratio);
    viewerImage.style.width=`${fit*zoom}px`;viewerImage.style.height=`${fit*zoom/ratio}px`;
  }
  function syncViewer() {
    const deck=decks[state.deck],p=deck.pages[state.page],focused=document.activeElement;
    viewerImage.src=p.src;viewerImage.alt=`${deck.title}，第 ${state.page+1} 页`;viewerImage.width=p.width;viewerImage.height=p.height;
    $('#viewerTitle').textContent=deck.title;$('#viewerCount').textContent=`${state.page+1} / ${deck.pages.length}`;
    $('#viewerPrevious').disabled=state.page===0;$('#viewerNext').disabled=state.page===deck.pages.length-1;
    if(focused?.disabled)$('#viewerClose').focus({preventScroll:true});applyZoom(1);
  }
  function openViewer(fromRoute=false){
    if(state.mode!=='deck'||transition)return;
    if(typeof viewer.showModal!=='function'){location.href=decks[state.deck].pages[state.page].src;return;}
    if(!viewer.open){savedViewerFocus=document.activeElement;viewer.showModal();if(!fromRoute)history.pushState({pptSpace:true,view:'read'},'',routeHash(true));}
    syncViewer();$('#viewerClose').focus({preventScroll:true});
  }
  function closeViewer(){
    if(!viewer.open)return;viewer.close();pan=null;
    state.position=state.target=state.page;render();
    const focus=savedViewerFocus?.closest('#deckWorld')?activeCards[state.page]:
      savedViewerFocus?.isConnected&&!savedViewerFocus.closest('[hidden]')?savedViewerFocus:$('#focusPage');
    focus.focus({preventScroll:true});queue();
  }
  function requestClose(){if(history.state?.view==='read')history.back();else{closeViewer();updateRoute();}}
  $('#viewerClose').addEventListener('click',requestClose);viewer.addEventListener('cancel',e=>{e.preventDefault();requestClose();});
  $('#zoomOut').addEventListener('click',()=>applyZoom(zoom-.5));$('#zoomIn').addEventListener('click',()=>applyZoom(zoom+.5));$('#zoomReset').addEventListener('click',()=>applyZoom(1));
  $('#viewerPrevious').addEventListener('click',()=>{selectPage(state.page-1);syncViewer();});
  $('#viewerNext').addEventListener('click',()=>{selectPage(state.page+1);syncViewer();});
  viewerImage.addEventListener('load',()=>applyZoom(zoom));
  viewerImage.addEventListener('error',()=>{viewerImage.alt='图片未能载入，请返回页廊重试';});
  viewport.addEventListener('dblclick',()=>applyZoom(zoom>1?1:2));
  viewport.addEventListener('pointerdown',e=>{if(zoom<=1||e.pointerType!=='mouse')return;pan={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);e.preventDefault();});
  viewport.addEventListener('pointermove',e=>{if(pan){viewport.scrollLeft=pan.left-e.clientX+pan.x;viewport.scrollTop=pan.top-e.clientY+pan.y;}});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>viewport.addEventListener(name,()=>{pan=null;}));

  document.addEventListener('keydown',e=>{
    if(e.target.matches('select,input'))return;
    if(transition){if(e.key==='Escape'){e.preventDefault();backToGallery();}return;}
    if(viewer.open){
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();selectPage(state.page+(e.key==='ArrowRight'?1:-1));syncViewer();}
      if(e.key==='+'||e.key==='='){e.preventDefault();applyZoom(zoom+.5);}
      if(e.key==='-'){e.preventDefault();applyZoom(zoom-.5);}
      if(e.key==='Tab'){
        const buttons=[...viewer.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      return;
    }
    if(state.mode==='deck'){
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();selectPage(state.page+(e.key==='ArrowRight'?1:-1));}
      if(e.key==='Home'||e.key==='End'){e.preventDefault();selectPage(e.key==='Home'?0:decks[state.deck].pages.length-1);}
      if(e.key==='Escape'){e.preventDefault();backToGallery();}
    }else if(e.target===space||e.target.closest('.artwork')){
      const deltas={ArrowLeft:[170,0],ArrowRight:[-170,0],ArrowUp:[0,150],ArrowDown:[0,-150]};
      if(deltas[e.key]){e.preventDefault();stopMomentum();state.tx+=deltas[e.key][0];state.ty+=deltas[e.key][1];queue();}
      if(e.key==='Home'){e.preventDefault();resetCamera();}
      if(e.key==='+'||e.key==='='){e.preventDefault();advanceCamera(180);}
      if(e.key==='-'){e.preventDefault();advanceCamera(-180);}
    }
  });

  function syncRoute(){
    const params=new URLSearchParams(location.hash.slice(1));
    const legacy=location.hash.match(/^#film-(.+)$/);
    const id=params.get('deck')||legacy?.[1],index=decks.findIndex(d=>d.id===id);
    if(index<0){closeViewer();showOverview(history.state?.camera||savedCamera);return;}
    const returningFromReader=viewer.open&&!params.has('read')&&index===state.deck;
    const nextPage=returningFromReader?state.page:Number(params.get('page')||1)-1;
    if(!params.has('read'))closeViewer();
    enterDeck(index,{fromRoute:true,page:nextPage});
    if(returningFromReader)updateRoute();
    if(params.has('read'))openViewer(true);
  }
  addEventListener('popstate',syncRoute);addEventListener('hashchange',syncRoute);
  addEventListener('resize',()=>{finishTransition();resetGesture();sceneWidth=space.clientWidth;sceneHeight=space.clientHeight;queue();if(viewer.open)applyZoom(zoom);},{passive:true});
  reduced.addEventListener('change',()=>{finishTransition();stopMomentum();state.ptx=state.pty=0;queue();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){finishTransition();resetGesture();cancelAnimationFrame(frame);frame=0;stopMomentum();}else{lastTime=0;queue();}});
  window.__galleryDebug={getState:()=>({mode:state.mode,deck:decks[state.deck]?.id,page:state.page+1,total:state.mode==='deck'?decks[state.deck].pages.length:decks.length,camera:camera(),target:{x:-state.tx,y:-state.ty,z:state.tz},position:state.position,dragging:!!drag,pinching:!!pinch,transitioning:!!transition,viewer:viewer.open,reduced:reduced.matches}),getField:()=>field.stats,decks:decks.map(d=>({id:d.id,pages:d.pages.length}))};
  if(!location.hash)history.replaceState({pptSpace:true,view:'overview',camera:savedCamera},'',location.href);
  updateControls();render();if(location.hash)syncRoute();queue();
})();
