/* ═══════════════════════════════════════════
   STARSHOP — three-scene.js (WebGL atmosphere)
   Graceful fallback: page works without WebGL.
   ═══════════════════════════════════════════ */
(() => {
const canvas = document.getElementById('webgl');
if (!canvas || !window.WebGLRenderingContext) { fail(); return; }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile  = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
let renderer = null, scene, camera, group, raf = 0, running = false;
let mouseTX = 0, mouseTY = 0, mouseRX = 0, mouseRY = 0, scrollP = 0;

function fail () { document.body.classList.add('no-webgl'); }

const VERT = `
uniform float uTime; uniform float uPR;
attribute float aSeed; attribute float aSize;
varying float vSeed;
void main(){
  vSeed = aSeed;
  vec3 p = position;
  p.x += sin(uTime * 0.12 + aSeed * 6.28) * 0.22;
  p.y += cos(uTime * 0.10 + aSeed * 6.28) * 0.22;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPR * (34.0 / -mv.z);
}`;
const FRAG = `
precision mediump float; varying float vSeed;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.06, d);
  vec3 blue = vec3(0.306, 0.549, 1.0);
  vec3 teal = vec3(0.0, 0.651, 0.651);
  vec3 col = mix(blue, teal, vSeed);
  gl_FragColor = vec4(col, a * (0.35 + 0.65 * vSeed));
}`;

async function boot () {
  let THREE;
  try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'); }
  catch (e) { fail(); return; }
  try { init(THREE); } catch (e) { fail(); }
}

function init (THREE) {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 60);
  camera.position.z = 9.5;
  group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dl = new THREE.DirectionalLight(0x4e8cff, 1.1); dl.position.set(3, 4, 6); scene.add(dl);

  /* ── particles ── */
  const N = mobile ? 420 : 1200;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 3.2 + Math.random() * 5.2;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.72;
    pos[i * 3 + 2] = r * Math.cos(ph) * 0.8;
    seed[i] = Math.random();
    size[i] = 0.5 + Math.random() * 1.7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(devicePixelRatio || 1, 2) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  /* ── constellation lines (precomputed neighbors) ── */
  const pairs = [];
  const LIMIT = mobile ? 60 : 200;
  const step = mobile ? 3 : 1;
  outer: for (let i = 0; i < N; i += step) {
    for (let j = i + 1; j < N; j += step) {
      const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1], dz = pos[i*3+2]-pos[j*3+2];
      if (dx*dx + dy*dy + dz*dz < 2.1) {
        pairs.push(pos[i*3],pos[i*3+1],pos[i*3+2], pos[j*3],pos[j*3+1],pos[j*3+2]);
        if (pairs.length / 6 >= LIMIT) break outer;
      }
    }
  }
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs), 3));
  const lmat = new THREE.LineBasicMaterial({ color: 0x4e8cff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(lgeo, lmat);
  group.add(lines);

  /* ── orbital rings ── */
  const mkRing = (r, tilt, col, op) => {
    const seg = 128, pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false });
    const l = new THREE.Line(g, m); l.rotation.x = tilt; return l;
  };
  const ring1 = mkRing(3.1, 1.12, 0x4e8cff, 0.20);
  const ring2 = mkRing(4.0, 1.32, 0x00a6a6, 0.14);
  const ring3 = mkRing(4.9, 1.02, 0x4e8cff, 0.08);
  group.add(ring1, ring2, ring3);

  /* ── core wireframe ── */
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 1),
    new THREE.MeshBasicMaterial({ color: 0x4e8cff, wireframe: true, transparent: true, opacity: 0.10 })
  );
  group.add(core);

  /* ── interaction ── */
  addEventListener('pointermove', e => {
    mouseTX = (e.clientX / innerWidth  - 0.5);
    mouseTY = (e.clientY / innerHeight - 0.5);
  }, { passive: true });
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollP = max > 0 ? window.scrollY / max : 0;
      ticking = false;
    });
  }, { passive: true });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
  });

  /* visibility / pause management: render only while dark theme is active */
  let vis = !document.hidden;
  const isActive = () => vis && !reduced && document.body.dataset.theme === 'dark';
  const sync = () => { isActive() ? start() : stop(); };
  document.addEventListener('visibilitychange', () => { vis = !document.hidden; sync(); });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

  const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const stop  = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  let t = 0;
  const loop = () => {
    raf = 0;
    if (!vis) return;
    t += 0.016;
    mat.uniforms.uTime.value = t;
    mouseRX += (mouseTX - mouseRX) * 0.03;
    mouseRY += (mouseTY - mouseRY) * 0.03;
    group.rotation.y = t * 0.05 + mouseRX * 0.55 + scrollP * 1.4;
    group.rotation.x = mouseRY * 0.32 + scrollP * 0.5;
    group.position.y = scrollP * 1.6;
    const pulse = 0.9 + Math.sin(t * 0.7) * 0.1;
    lmat.opacity = 0.13 + Math.min(scrollP * 0.25, 0.22);
    core.rotation.y = -t * 0.08; core.rotation.x = t * 0.03;
    core.scale.setScalar(pulse);
    ring1.rotation.z = t * 0.06; ring2.rotation.z = -t * 0.045; ring3.rotation.z = t * 0.03;
    camera.position.x = mouseRX * 0.6;
    camera.position.y = -mouseRY * 0.45;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (isActive()) start(); /* keep looping only while dark stage is visible */
  };
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); fail(); });
  addEventListener('pagehide', () => { stop(); renderer.dispose(); });

  if (reduced) { /* single static frame */ renderer.render(scene, camera); return; }
  start();
}

boot();
})();
