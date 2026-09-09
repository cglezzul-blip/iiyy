/* Seeded, recyclable picture regions. Images and deck order remain source data. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
  const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return h>>>0;};
  const random=seed=>()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
  let seed;
  try{seed=sessionStorage.getItem('yyb-ppt-space-seed');if(!seed){seed=String(crypto.getRandomValues(new Uint32Array(1))[0]);sessionStorage.setItem('yyb-ppt-space-seed',seed);}}
  catch{seed=String(Math.floor(Math.random()*4294967296));}

  window.PPTSpatialField=class {
    constructor({decks,container,makeCard,mobile,reduced}){
      this.decks=decks;this.container=container;this.makeCard=makeCard;this.mobile=mobile;this.reduced=reduced;
      this.cache=new Map();this.instances=new Map();this.pinned=null;this.seed=seed;
      this.cell={x:1600,y:1100,z:1300};this.maxCache=256;
      const seen=new Set();this.pool=decks.map((deck,di)=>deck.pages.map((page,pi)=>({deck:di,deckId:deck.id,page:pi,src:page.src,width:page.width,height:page.height})).filter(item=>{if(seen.has(item.src))return false;seen.add(item.src);return true;}));
    }
    region(x,y,z){
      const key=`${x}:${y}:${z}`;
      if(this.cache.has(key)){const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);return value;}
      const rng=random(hash(`${this.seed}/${key}`));
      // A weighted theme choice keeps the seventeen-page work present without
      // letting its length erase the five other visual themes.
      const ticket=rng(),longDeck=this.pool.findIndex(p=>p.length>9);
      const deck=ticket<.38&&longDeck>=0?longDeck:Math.floor(rng()*this.pool.length);
      const pages=this.pool[deck],item=pages[Math.floor(rng()*pages.length)];
      const value={...item,id:`${key}/0`,cellX:x,cellY:y,cellZ:z,
        x:(rng()-.5)*this.cell.x*.68,y:(rng()-.5)*this.cell.y*.68,
        z:(.28+rng()*.66)*this.cell.z,w:410+rng()*300};
      this.cache.set(key,value);
      while(this.cache.size>this.maxCache)this.cache.delete(this.cache.keys().next().value);
      return value;
    }
    getEntry(card){return this.instances.get(card?.dataset.instance)?.item;}
    getCard(id){return this.instances.get(id)?.card;}
    getPosition(item){return{x:item.cellX*this.cell.x+item.x,y:item.cellY*this.cell.y+item.y,z:item.cellZ*this.cell.z+item.z};}
    findDeck(index){return [...this.instances.values()].filter(v=>v.item.deck===index&&v.alpha>.2).sort((a,b)=>b.area-a.area)[0]?.card;}
    pin(card){this.pinned=card?.dataset.instance||null;}
    render(camera,width,height,dt,now){
      const p=this.mobile.matches?900:1200,far=5700,limit=this.mobile.matches?42:72;
      const origin={x:Math.round(camera.x/this.cell.x),y:Math.round(camera.y/this.cell.y),z:Math.floor(camera.z/this.cell.z)};
      const local={x:camera.x-origin.x*this.cell.x,y:camera.y-origin.y*this.cell.y,z:camera.z-origin.z*this.cell.z};
      // Projection uses nearby integer region differences + local offsets, not
      // ever-growing world transforms. No perspective singularity is crossed.
      const candidates=[];
      const start=Math.floor((local.z+230)/this.cell.z),end=Math.floor((local.z+far)/this.cell.z);
      for(let dz=start;dz<=end;dz++){
        const reach=Math.max(800,(dz+1)*this.cell.z-local.z),rx=Math.ceil(width*.58*reach/p/this.cell.x)+1,ry=Math.ceil(height*.58*reach/p/this.cell.y)+1;
        for(let dx=-rx;dx<=rx;dx++)for(let dy=-ry;dy<=ry;dy++){
          const item=this.region(origin.x+dx,origin.y+dy,origin.z+dz);
          const distance=dz*this.cell.z+item.z-local.z;
          if(distance<230||distance>far)continue;
          const scale=p/distance,w=item.w*(this.mobile.matches?.7:1),h=w*item.height/item.width;
          const x=dx*this.cell.x+item.x-local.x,y=dy*this.cell.y+item.y-local.y;
          const sx=width/2+x*scale,sy=height/2+y*scale,sw=w*scale,sh=h*scale,margin=90;
          if(sx+sw/2<-margin||sx-sw/2>width+margin||sy+sh/2<-margin||sy-sh/2>height+margin)continue;
          const edge=Math.min(smooth(-margin,20,sx+sw/2),smooth(-margin,20,width-sx+sw/2),smooth(-margin,20,sy+sh/2),smooth(-margin,20,height-sy+sh/2));
          const alpha=smooth(230,760,distance)*(1-smooth(3650,far,distance))*edge;
          if(alpha<.008)continue;
          candidates.push({item,x,y,z:p-distance,w,alpha,distance,sx,sy,sw,sh,area:sw*sh});
        }
      }
      candidates.sort((a,b)=>a.distance-b.distance||a.item.id.localeCompare(b.item.id));
      const selected=[];
      for(const v of candidates){
        const overlapping=selected.some(a=>{
          const intersection=Math.max(0,Math.min(a.sx+a.sw/2,v.sx+v.sw/2)-Math.max(a.sx-a.sw/2,v.sx-v.sw/2))*Math.max(0,Math.min(a.sy+a.sh/2,v.sy+v.sh/2)-Math.max(a.sy-a.sh/2,v.sy-v.sh/2));
          return intersection/Math.min(a.area,v.area)>.62||(a.item.src===v.item.src&&Math.hypot(a.sx-v.sx,a.sy-v.sy)<(a.sw+v.sw)*.7);
        });
        if(!overlapping||v.item.id===this.pinned)selected.push(v);
        if(selected.length>=limit)break;
      }
      const active=new Set(selected.map(v=>v.item.id));let moving=false;
      for(const v of selected){
        let record=this.instances.get(v.item.id);
        if(!record){
          const card=this.makeCard(v.item,this.decks[v.item.deck].title,v.item.deck,false);
          card.dataset.instance=v.item.id;card.dataset.deckId=v.item.deckId;card.dataset.pageIndex=v.item.page;
          card.setAttribute('aria-label',`${this.decks[v.item.deck].title}，第 ${v.item.page+1} 页，进入整套作品`);
          card.querySelector('.artwork-caption small').textContent=`${v.item.page+1} / ${this.decks[v.item.deck].pages.length}`;
          record={item:v.item,card,alpha:0,born:now,area:v.area};this.instances.set(v.item.id,record);this.container.append(card);
        }
        record.area=v.area;
        const enter=this.reduced.matches?1:smooth(0,450,now-record.born);
        const target=v.alpha*enter,ease=this.reduced.matches?1:1-Math.exp(-dt/110);
        record.alpha+=(target-record.alpha)*ease;moving ||=Math.abs(target-record.alpha)>.004||enter<1;
        record.card.style.width=`${v.w.toFixed(2)}px`;
        record.card.style.transform=`translate(-50%,-50%) translate3d(${v.x.toFixed(2)}px,${(v.y+(1-enter)*14/(p/v.distance)).toFixed(2)}px,${v.z.toFixed(2)}px)`;
        record.card.style.opacity=record.alpha.toFixed(3);
        const reachable=record.alpha>.18&&v.sx>0&&v.sx<width&&v.sy>0&&v.sy<height;
        record.card.tabIndex=reachable?0:-1;record.card.style.pointerEvents=record.alpha>.13?'auto':'none';
        record.card.setAttribute('aria-hidden',String(record.alpha<.04));
      }
      for(const[id,record]of this.instances){
        if(active.has(id))continue;
        const retain=id===this.pinned||record.card.contains(document.activeElement);
        const item=record.item,distance=(item.cellZ-origin.z)*this.cell.z+item.z-local.z;
        if(distance>230){
          const x=(item.cellX-origin.x)*this.cell.x+item.x-local.x,y=(item.cellY-origin.y)*this.cell.y+item.y-local.y;
          record.card.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${(p-distance).toFixed(2)}px)`;
        }else record.alpha=0;
        record.alpha*=this.reduced.matches?0:Math.exp(-dt/80);record.card.style.opacity=record.alpha.toFixed(3);record.card.style.pointerEvents='none';record.card.tabIndex=-1;record.card.setAttribute('aria-hidden','true');
        if(record.alpha<.008||this.instances.size>limit+12){if(!retain){record.card.remove();this.instances.delete(id);}}
        else moving=true;
      }
      this.stats={seed:this.seed,camera,regions:this.cache.size,nodes:this.instances.size,selected:selected.length,pool:this.pool.flat().length,origin,local,visible:selected.map(v=>({id:v.item.id,deckId:v.item.deckId,pageIndex:v.item.page,src:v.item.src,x:v.x,y:v.y,z:v.z,width:v.w,alpha:v.alpha}))};
      return moving;
    }
  };
})();
