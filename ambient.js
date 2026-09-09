/* Shared, dependency-free atmospheric field. RG/BA store current/previous
   signed 16-bit height. Ping-pong integration preserves every prior impulse. */
(() => {
  "use strict";
  if (window.__ambientField) return;
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  let ambient = document.querySelector(".ambient");
  if (!ambient) {
    ambient = document.createElement("div");
    ambient.className = "ambient";
    ambient.setAttribute("aria-hidden", "true");
    document.body.prepend(ambient);
  }
  let canvas = document.getElementById("tideCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "tideCanvas";
    ambient.prepend(canvas);
  }
  for (const className of ["ambient-fallback", "ambient-vignette"]) {
    if (!ambient.querySelector(`.${className}`)) {
      const layer = document.createElement("div");
      layer.className = className;
      ambient.append(layer);
    }
  }
  let control = document.getElementById("motionControl");
  if (!control) {
    control = document.createElement("button");
    control.id = "motionControl";
    control.className = "ambient-motion-control";
    control.type = "button";
    document.body.append(control);
  }
  control.classList.add("ambient-motion-control");
  root.classList.add("ambient-field-enabled");
  const state = {
    paused: false, reduced: reduced.matches, visible: !document.hidden,
    fallback: null, time: 0, renderCount: 0, simulationSteps: 0,
    impulseCount: 0, clickCount: 0, moveCount: 0, frame: 0,
    pointer: { x: .5, y: .5 }, lastInput: -10000, lastPointerTime: 0,
    lastFrame: 0, accumulator: 0, lastDraw: 0, frameInterval: 1000 / 30,
    resized: true, simulationWidth: 0, simulationHeight: 0,
    pending: [], contextLost: false
  };
  let gl = null, simulationProgram, displayProgram, vertices, front = 0, targets = [];
  const simUniforms = {}, displayUniforms = {};
  const allowed = () => !state.paused && !state.reduced && state.visible && !state.fallback;
  const updateControl = () => {
    control.disabled = Boolean(state.fallback || state.reduced);
    control.textContent = control.disabled ? "静态背景" : state.paused ? "恢复背景" : "暂停背景";
    control.setAttribute("aria-pressed", String(state.paused));
    canvas.dataset.paused = String(state.paused);
    canvas.dataset.rendering = String(Boolean(state.frame));
    canvas.dataset.calm = "0";
  };
  const stop = () => {
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    canvas.dataset.rendering = "false";
  };
  const fail = reason => {
    state.fallback = reason;
    stop();
    root.classList.remove("ambient-webgl-ready", "webgl-ready");
    canvas.dataset.fallback = reason;
    updateControl();
  };
  const vertexSource = `attribute vec2 position; varying vec2 vUv;
    void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const codec = `
    float decode(vec2 c){return (dot(floor(c*255.+.5),vec2(256.,1.))-32768.)/32768.;}
    vec2 encode(float h){float n=floor(clamp(h,-.9999,.9999)*32768.+32768.+.5);
      float high=floor(n/256.);return vec2(high,n-high*256.)/255.;}
  `;
  const simulationSource = `precision highp float;varying vec2 vUv;
    uniform sampler2D previous;uniform vec2 pixel;uniform float aspect;
    uniform vec4 impulses[8];uniform int impulseSize;
    ${codec}
    float heightAt(vec2 p){return decode(texture2D(previous,p).rg);}
    void main(){
      vec4 history=texture2D(previous,vUv);
      float h=decode(history.rg),old=decode(history.ba);
      float lap=heightAt(vUv+vec2(pixel.x,0.))+heightAt(vUv-vec2(pixel.x,0.))
        +heightAt(vUv+vec2(0.,pixel.y))+heightAt(vUv-vec2(0.,pixel.y))-4.*h;
      float next=(2.*h-old+.46*lap)*.995;
      for(int i=0;i<8;i++){
        if(i>=impulseSize)break;
        vec2 d=(vUv-impulses[i].xy)*vec2(aspect,1.);
        float r=dot(d,d)/(impulses[i].z*impulses[i].z);
        // A zero-mean impulse excites crests and troughs without DC inflation.
        next+=impulses[i].w*(1.-r)*exp(-r*1.5);
      }
      float boundary=min(min(vUv.x/pixel.x,(1.-vUv.x)/pixel.x),min(vUv.y/pixel.y,(1.-vUv.y)/pixel.y));
      next*=mix(.83,1.,smoothstep(0.,12.,boundary));
      gl_FragColor=vec4(encode(next),encode(h));
    }`;
  const displaySource = `precision highp float;varying vec2 vUv;
    uniform sampler2D wave;uniform vec2 resolution;uniform vec2 fieldSize;uniform float time;
    ${codec}
    float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.57;mat2 m=mat2(.8,.6,-.6,.8);
      for(int i=0;i<3;i++){v+=a*noise(p);p=m*p*2.04+vec2(4.7,8.3);a*=.48;}return v;}
    float heightAt(vec2 uv){
      vec2 p=uv*fieldSize-.5,cell=floor(p),f=fract(p),s=1./fieldSize;
      float a=decode(texture2D(wave,(cell+.5)*s).rg);
      float b=decode(texture2D(wave,(cell+vec2(1.5,.5))*s).rg);
      float c=decode(texture2D(wave,(cell+vec2(.5,1.5))*s).rg);
      float d=decode(texture2D(wave,(cell+1.5)*s).rg);
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
    }
    vec3 material(vec2 uv){
      float t=time*.13;
      vec2 q=uv*vec2(2.65,1.85)+vec2(-1.24,-.48);
      vec2 warp=vec2(fbm(q+vec2(t*.19,-t*.12)),fbm(q+vec2(5.2,8.1)+t*.11));
      float n=fbm(q+warp*1.35+vec2(t*.08,-t*.09));
      float vapor=fbm(q*1.22+warp*1.45+vec2(3.1,-2.4)-t*.06);
      float bend=sin(uv.x*5.7+warp.y*2.1+t*.23)*.13+(n-.5)*.24;
      float center=.62+bend;
      float cloud=exp(-pow((uv.y-center)/(.10+vapor*.10),2.));
      cloud*=smoothstep(.11,.52,uv.x);
      cloud*=.65+vapor*.65;
      float leftMist=exp(-dot((uv-vec2(.12,.64))*vec2(2.2,3.8),(uv-vec2(.12,.64))*vec2(2.2,3.8)))*.25;
      vec3 blue=mix(vec3(.102,.220,.439),vec3(.125,.290,.494),clamp(n*.83+vapor*.25,0.,1.));
      blue*=.81+vapor*.25;
      vec3 grayGold=mix(vec3(.933,.847,.667),vec3(.47,.57,.65),.48);
      vec3 col=mix(blue,grayGold,clamp(cloud*.60+leftMist,0.,.72));
      // Keep the reference's deep bottom, with a visible blue floor throughout.
      float depth=.10+.90*smoothstep(.04,.78,uv.y);
      col*=depth;
      float vignette=1.-smoothstep(.30,.80,length((uv-.53)*vec2(.92,.75)));
      return col*mix(.78,1.,vignette);
    }
    void main(){
      vec2 uv=vUv,pixel=1./fieldSize;
      float h=heightAt(uv);
      vec2 normal=vec2(heightAt(uv+vec2(pixel.x,0.))-heightAt(uv-vec2(pixel.x,0.)),
        heightAt(uv+vec2(0.,pixel.y))-heightAt(uv-vec2(0.,pixel.y)));
      vec2 refraction=normal*3.3+vec2(h*.10,-h*.13);
      float magnitude=length(refraction);
      refraction*=min(1.,.24/max(magnitude,.0001));
      vec3 color=material(uv+refraction);
      // Shading is derived from the shared surface normal, not cursor proximity.
      float relief=clamp(length(normal)*5.8,0.,1.);
      float light=dot(normal,vec2(-1.5,2.0));
      color*=1.+clamp(light,-.22,.24);
      color=mix(color,vec3(.32,.39,.43),relief*.13);
      color+=(hash(floor(gl_FragCoord.xy*.65))-0.5)*.005;
      gl_FragColor=vec4(clamp(color,vec3(.018,.025,.035),vec3(.75,.76,.73)),1.);
    }`;

  function program(fragmentSource) {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const result = gl.createProgram();
    gl.attachShader(result, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(result, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(result);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
    return result;
  }
  function use(programObject) {
    gl.useProgram(programObject);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    const position = gl.getAttribLocation(programObject, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }
  function target(width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const zero = new Uint8Array(width * height * 4);
    for (let i = 0; i < zero.length; i += 4) { zero[i] = 128; zero[i + 2] = 128; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, zero);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Wave framebuffer unavailable");
    return { texture, framebuffer };
  }
  function resize() {
    state.resized = true;
    if (!allowed()) return;
    const mobile = innerWidth < 700;
    const dpr = Math.min(devicePixelRatio || 1, mobile ? .78 : .95);
    const width = Math.max(1, Math.round(innerWidth * dpr));
    const height = Math.max(1, Math.round(innerHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    // Render resolution may change; persistent simulation textures never reset.
    state.resized = false;
  }
  function step() {
    use(simulationProgram);
    const next = 1 - front;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[next].framebuffer);
    gl.viewport(0, 0, state.simulationWidth, state.simulationHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[front].texture);
    gl.uniform1i(simUniforms.previous, 0);
    gl.uniform2f(simUniforms.pixel, 1 / state.simulationWidth, 1 / state.simulationHeight);
    gl.uniform1f(simUniforms.aspect, innerWidth / innerHeight);
    const batch = state.pending.splice(0, 8), packed = new Float32Array(32);
    batch.forEach((entry, i) => packed.set(entry, i * 4));
    gl.uniform4fv(simUniforms.impulses, packed);
    gl.uniform1i(simUniforms.impulseSize, batch.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    front = next;
    state.simulationSteps += 1;
  }
  function draw() {
    use(displayProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[front].texture);
    gl.uniform1i(displayUniforms.wave, 0);
    gl.uniform2f(displayUniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(displayUniforms.fieldSize, state.simulationWidth, state.simulationHeight);
    gl.uniform1f(displayUniforms.time, state.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    state.renderCount += 1;
  }
  function tick(now) {
    state.frame = 0;
    if (!allowed()) return;
    state.frameInterval = innerWidth < 700 || now - state.lastInput > 2600 ? 1000 / 30 : 1000 / 60;
    if (now - state.lastDraw < state.frameInterval - .5) { schedule(); return; }
    const delta = Math.min(.075, Math.max(0, (now - state.lastFrame) / 1000));
    state.lastFrame = now; state.lastDraw = now;
    state.time += delta; state.accumulator += delta;
    if (state.resized) resize();
    let iterations = 0;
    while (state.accumulator >= 1 / 60 && iterations < 5) {
      step(); state.accumulator -= 1 / 60; iterations += 1;
    }
    draw(); schedule();
  }
  function schedule() {
    if (!allowed() || state.frame) return;
    state.frame = requestAnimationFrame(tick);
    canvas.dataset.rendering = "true";
  }
  function wake() {
    state.lastFrame = performance.now();
    state.lastDraw = 0;
    state.accumulator = 0;
    resize(); schedule(); updateControl();
  }
  function addImpulse(x, y, radius, strength, kind) {
    if (!allowed()) return;
    // Queue only new input; no old simulation buffer is cleared or replaced.
    if (state.pending.length < 96) {
      state.pending.push([clamp(x), clamp(y), radius, strength]);
      state.impulseCount += 1;
      if (kind === "click") state.clickCount += 1;
      else state.moveCount += 1;
    }
    state.lastInput = performance.now();
    schedule();
  }
  function pointerMove(event) {
    if (!allowed()) return;
    const now = performance.now();
    const x = clamp(event.clientX / innerWidth), y = clamp(1 - event.clientY / innerHeight);
    const dx = x - state.pointer.x, dy = y - state.pointer.y;
    const distance = Math.hypot(dx * innerWidth / innerHeight, dy);
    if (now - state.lastPointerTime < 13 && distance < .02) return;
    const pieces = state.lastPointerTime && now - state.lastPointerTime < 180 ? Math.min(5, Math.max(1, Math.ceil(distance / .026))) : 1;
    for (let i = 1; i <= pieces; i++) {
      const fraction = i / pieces;
      addImpulse(state.pointer.x + dx * fraction, state.pointer.y + dy * fraction, .025, .032, "move");
    }
    state.pointer = { x, y }; state.lastPointerTime = now;
  }
  function pointerDown(event) {
    if (!allowed() || event.target.closest?.("#motionControl")) return;
    const x = event.clientX / innerWidth, y = 1 - event.clientY / innerHeight;
    addImpulse(x, y, event.pointerType === "touch" ? .045 : .036, .29, "click");
    state.pointer = { x, y };
  }
  function fieldStats() {
    if (!gl || !targets.length || state.contextLost) return { waveEnergy: 0, maxHeight: 0, activeCells: 0 };
    const pixels = new Uint8Array(state.simulationWidth * state.simulationHeight * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[front].framebuffer);
    gl.readPixels(0, 0, state.simulationWidth, state.simulationHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let energy = 0, peak = 0, active = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const h = (pixels[i] * 256 + pixels[i + 1] - 32768) / 32768;
      energy += h * h; peak = Math.max(peak, Math.abs(h)); if (Math.abs(h) > .001) active += 1;
    }
    return { waveEnergy: Math.sqrt(energy / (pixels.length / 4)), maxHeight: peak, activeCells: active };
  }
  const api = {
    getState: () => ({
      engine: "rgba8-ping-pong-wave", paused: state.paused, reduced: state.reduced,
      visible: state.visible, fallback: state.fallback, rendering: Boolean(state.frame), running: Boolean(state.frame),
      renderCount: state.renderCount, time: state.time, simulationSteps: state.simulationSteps,
      impulseCount: state.impulseCount, clickCount: state.clickCount, moveCount: state.moveCount,
      pendingImpulses: state.pending.length, pointer: { ...state.pointer }, targetPointer: { ...state.pointer },
      calm: 0, targetCalm: 0, interaction: 1, frameInterval: state.frameInterval,
      simulationSize: [state.simulationWidth, state.simulationHeight], ...fieldStats()
    }),
    pause: () => { state.paused = true; stop(); updateControl(); },
    resume: () => { state.paused = false; wake(); },
    addImpulse: (x, y, strength = .29, radius = .036) => addImpulse(x, y, radius, clamp(strength, -.6, .6), "click"),
    snapshot: () => { if (!gl || state.fallback) return null; draw(); return canvas.toDataURL("image/webp", .92); }
  };
  window.__ambientField = api;
  window.__tideDebug = api;
  try {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL unavailable");
    simulationProgram = program(simulationSource); displayProgram = program(displaySource);
    vertices = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const name of ["previous", "pixel", "aspect", "impulses", "impulseSize"]) simUniforms[name] = gl.getUniformLocation(simulationProgram, name === "impulses" ? "impulses[0]" : name);
    for (const name of ["wave", "resolution", "fieldSize", "time"]) displayUniforms[name] = gl.getUniformLocation(displayProgram, name);
    state.simulationWidth = innerWidth < 700 ? 160 : 320;
    state.simulationHeight = Math.round(clamp(state.simulationWidth * innerHeight / innerWidth, 96, 512));
    targets = [target(state.simulationWidth, state.simulationHeight), target(state.simulationWidth, state.simulationHeight)];
    if (!state.reduced) root.classList.add("ambient-webgl-ready");
    wake();
  } catch (error) {
    console.warn("Atmospheric field uses its static fallback:", error.message);
    fail("webgl-unavailable");
  }
  control.addEventListener("click", () => state.paused ? api.resume() : api.pause());
  addEventListener("pointermove", pointerMove, { passive: true });
  addEventListener("pointerdown", pointerDown, { passive: true });
  addEventListener("resize", () => { state.resized = true; if (allowed()) resize(); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    state.visible = !document.hidden;
    if (!state.visible) stop(); else wake();
  });
  reduced.addEventListener("change", event => {
    state.reduced = event.matches;
    root.classList.toggle("ambient-webgl-ready", !state.reduced && !state.fallback);
    if (state.reduced) stop(); else wake();
    updateControl();
  });
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault(); state.contextLost = true; fail("context-lost");
  });
  updateControl();
})();
