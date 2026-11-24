// Sora's two 3D scenes: [data-scene="table"] (hero) and [data-scene="flow"] (demo).
// Phones, reduced motion, data-saver and no-WebGL keep the photograph already in the frame: three.js is never downloaded there.
// shortcut: scenes are built from primitives and canvas-drawn screens, upgrade to modelled assets (glTF) if a designer supplies them.
const still = matchMedia('(max-width: 639px), (prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
const hosts = [...document.querySelectorAll('[data-scene]')];
if (!still && hosts.length) start().catch(() => document.querySelectorAll('.scene3d').forEach((c) => c.remove()));

async function start() {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
  await document.fonts.ready;
  const INK = '#29251e', PAPER = '#f4efe5', GOLD = '#d9952b', GREEN = '#3f7d4e', F = '"IBM Plex Sans", sans-serif';
  const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

  const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const pill = (g, x, y, w, h, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); };
  const text = (g, s, x, y, size, color = INK, weight = 500, align = 'left') => { g.font = `${weight} ${size}px ${F}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };

  // the guest's phone: menu, sent, ready
  const phoneTex = (state) => tex(420, 860, (g, w, h) => {
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    text(g, 'sora.', 36, 70, 34); text(g, 'Table 7', w - 36, 70, 26, '#675e51', 400, 'right');
    if (state === 'menu') {
      [['Boerewors roll', 'R85', 2], ['Chips, large', 'R45', 1], ['Malva pudding', 'R60', 0], ['Rooibos iced tea', 'R35', 0]].forEach(([n, p, q], i) => {
        const y = 150 + i * 132;
        g.fillStyle = '#e7dfcf'; g.beginPath(); g.roundRect(28, y, w - 56, 112, 18); g.fill();
        text(g, n, 52, y + 48, 28); text(g, p, 52, y + 88, 24, '#675e51', 400);
        if (q) { pill(g, w - 116, y + 34, 64, 44, INK); text(g, String(q), w - 84, y + 66, 26, PAPER, 500, 'center'); }
      });
      pill(g, 28, h - 130, w - 56, 84, '#8c6418'); text(g, 'Send order · R215', w / 2, h - 77, 30, '#fff', 500, 'center');
    } else {
      const ready = state === 'ready';
      g.fillStyle = ready ? GREEN : INK; g.beginPath(); g.arc(w / 2, 330, 84, 0, 7); g.fill();
      g.strokeStyle = PAPER; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2 - 34, 332); g.lineTo(w / 2 - 8, 358); g.lineTo(w / 2 + 38, 306); g.stroke();
      text(g, ready ? 'Your order is ready' : 'Order sent', w / 2, 490, 38, INK, 500, 'center');
      text(g, ready ? 'A waiter is bringing it over' : 'The kitchen has it', w / 2, 540, 26, '#675e51', 400, 'center');
      ['Sent', 'Cooking', 'Ready'].forEach((s, i) => {
        const on = ready || i === 0; pill(g, 44 + i * 114, 620, 104, 44, on ? INK : '#e7dfcf'); text(g, s, 96 + i * 114, 650, 20, on ? PAPER : '#675e51', 500, 'center');
      });
    }
  });

  // the kitchen tablet: table 7 absent, then New, Cooking, Ready
  const kitchenTex = (st) => tex(1000, 700, (g, w, h) => {
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h); g.fillStyle = '#e7dfcf'; g.fillRect(0, 0, w, 96);
    text(g, 'Sora  /  Kitchen', 40, 62, 34);
    const rows = [['12', 'Table 12', 'Lamb chops, pap, 2 salads', 'Cooking'], ['3', 'Table 3', 'Bunny chow, 2 lagers', 'Cooking'], ['5', 'Table 5', 'Malva pudding, 2 coffees', 'Ready']];
    if (st) rows.unshift(['7', 'Table 7', '2 boerewors rolls, chips', st]);
    rows.forEach(([n, who, sub, s], i) => {
      const y = 96 + i * 148, mine = n === '7';
      if (mine) { g.fillStyle = '#fbf3df'; g.fillRect(0, y, w, 148); }
      g.fillStyle = '#d8cfbd'; g.fillRect(0, y + 147, w, 1);
      g.fillStyle = mine ? GOLD : '#d8cfbd'; g.beginPath(); g.arc(84, y + 74, 38, 0, 7); g.fill(); text(g, n, 84, y + 86, 32, INK, 500, 'center');
      text(g, who, 150, y + 66, 36); text(g, sub, 150, y + 108, 28, '#675e51', 400);
      pill(g, w - 250, y + 44, 210, 60, s === 'Ready' ? GREEN : s === 'New' ? GOLD : INK); text(g, s, w - 145, y + 85, 30, s === 'New' ? INK : PAPER, 500, 'center');
    });
  });

  const qrTex = () => tex(500, 650, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, 650); text(g, 'Scan to order', w / 2, 80, 44, INK, 500, 'center');
    const n = 21, s = 16, ox = (w - n * s) / 2, oy = 130; let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = INK;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rnd() > 0.52) g.fillRect(ox + x * s, oy + y * s, s, s);
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => {
      g.fillStyle = '#fff'; g.fillRect(ox + (x - 1) * s, oy + (y - 1) * s, 9 * s, 9 * s);
      g.fillStyle = INK; g.fillRect(ox + x * s, oy + y * s, 7 * s, 7 * s);
      g.fillStyle = '#fff'; g.fillRect(ox + (x + 1) * s, oy + (y + 1) * s, 5 * s, 5 * s);
      g.fillStyle = INK; g.fillRect(ox + (x + 2) * s, oy + (y + 2) * s, 3 * s, 3 * s);
    });
    text(g, 'Table 7', w / 2, 560, 40, INK, 500, 'center'); text(g, 'sora.', w / 2, 615, 30, '#8c6418', 500, 'center');
  });

  const ticketTex = () => tex(560, 340, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = GOLD; g.fillRect(0, 0, w, 14);
    text(g, 'Table 7', 36, 90, 52); text(g, '2 × Boerewors roll', 36, 170, 36, INK, 400); text(g, '1 × Chips, large', 36, 224, 36, INK, 400); text(g, 'R215', 36, 300, 36, '#8c6418');
  });

  // a rounded slab in the XY plane with a self-lit screen on its +Z face
  const device = (w, h, r, map) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 12 }), new THREE.MeshStandardMaterial({ color: '#15130f', roughness: 0.35, metalness: 0.6 }));
    body.position.z = -0.025;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), new THREE.MeshBasicMaterial({ map }));
    screen.position.z = 0.04;
    const grp = new THREE.Group(); grp.add(body, screen); grp.screen = screen; return grp;
  };
  const bokeh = (scene, n, z) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.14, 12, 12), new THREE.MeshBasicMaterial({ color: i % 3 ? '#ffc56b' : '#ffe9c2', transparent: true, opacity: 0.15 + Math.random() * 0.45 }));
      m.position.set((Math.random() - 0.5) * 16, 0.6 + Math.random() * 4, z - Math.random() * 5); scene.add(m);
    }
  };
  const lights = (scene) => {
    scene.add(new THREE.AmbientLight('#ffe2b8', 0.9));
    const key = new THREE.PointLight('#ffd08a', 32, 20); key.position.set(0.5, 4, 2); scene.add(key);
    const rim = new THREE.DirectionalLight('#9db7ff', 0.7); rim.position.set(-4, 3, -3); scene.add(rim);
  };

  // one renderer per host; renders only while something moves
  const mount = (host, build) => {
    const canvas = document.createElement('canvas'); canvas.className = 'scene3d'; canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .6s';
    (host.querySelector('img') || host.firstElementChild).after(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // a GPU that rejects a shader or drops the context gets the photograph back
    let dead = false; const fail = () => { dead = true; canvas.remove(); };
    renderer.debug.onShaderError = fail; canvas.addEventListener('webglcontextlost', fail);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#17130e'); scene.fog = new THREE.Fog('#17130e', 7, 16);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    const api = build(scene, camera, host);
    const size = () => {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      if (api.shift && w > 900) camera.setViewOffset(w, h, -w * api.shift, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix(); api.dirty = true;
    };
    new ResizeObserver(size).observe(host); size();
    let seen = false; new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) api.enter?.(); }).observe(host);
    const t0 = performance.now();
    const loop = (now) => {
      if (dead) return; requestAnimationFrame(loop); if (!seen) return;
      const busy = api.tick((now - t0) / 1000);
      if (busy || api.dirty) { renderer.render(scene, camera); api.dirty = false; if (!dead) canvas.style.opacity = 1; }
    };
    requestAnimationFrame(loop);
  };

  // HERO: a restaurant table, the QR stand on it, a phone held over it; settles in 3 s, then follows the pointer
  const table = (scene, camera, host) => {
    lights(scene); bokeh(scene, 46, -3);
    const wood = tex(512, 512, (g) => { g.fillStyle = '#7a4a26'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${i % 2 ? '40,20,8' : '190,130,80'},${0.05 + Math.random() * 0.1})`; g.fillRect(0, Math.random() * 512, 512, 1 + Math.random() * 5); } });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.14, 72), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 })); top.position.y = -0.07; scene.add(top);
    const china = new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: 0.25 });
    [[-1.5, 0.6], [1.9, -0.9]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.05, 48), china); p.position.set(x, 0.025, z); scene.add(p);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 12, 48), china); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.05, z); scene.add(rim);
    });
    [[-0.9, -0.9], [2.3, 0.3]].forEach(([x, z]) => { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.5, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#dfeaf0', transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide })); gl.position.set(x, 0.25, z); scene.add(gl); });
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.03), [0, 0, 0, 0, 1, 0].map((f) => new THREE.MeshStandardMaterial(f ? { map: qrTex(), roughness: 0.6 } : { color: '#f4efe5' })));
    card.position.set(0.1, 0.42, -0.35); card.rotation.x = -0.22; scene.add(card);
    const glow = new THREE.PointLight(GOLD, 0, 3); glow.position.set(0.1, 0.6, 0.3); scene.add(glow);
    const phone = device(0.62, 1.27, 0.08, phoneTex('menu')); scene.add(phone);
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); ptr.tx = (e.clientX - r.left) / r.width - 0.5; ptr.ty = (e.clientY - r.top) / r.height - 0.5; });
    host.addEventListener('pointerleave', () => { ptr.tx = ptr.ty = 0; });
    const api = { shift: 0.2, dirty: true };
    api.tick = (t) => {
      const k = ease(t / 3), moving = t < 3.1 || Math.abs(ptr.tx - ptr.x) + Math.abs(ptr.ty - ptr.y) > 0.0008;
      ptr.x += (ptr.tx - ptr.x) * 0.06; ptr.y += (ptr.ty - ptr.y) * 0.06;
      camera.position.set(0.4 + ptr.x * 1.6, 2.5 - k * 0.5 - ptr.y * 0.8, 6.4 - k * 1.6); camera.lookAt(0.3, 0.55, 0);
      phone.position.set(1.15 - ptr.x * 0.3, 1.9 - k * 0.75, 1.0); phone.rotation.set(-0.5 + ptr.y * 0.25, -0.38 + ptr.x * 0.4, 0.08);
      glow.intensity = k * 1.2;
      return moving;
    };
    return api;
  };

  // DEMO: the order leaves the phone, lands on the kitchen tablet, turns Cooking, then Ready. Plays once each time it comes into view; a click replays it.
  const flow = (scene, camera, host) => {
    lights(scene); bokeh(scene, 30, -4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ color: '#241d15', roughness: 0.35, metalness: 0.3 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const P = { menu: phoneTex('menu'), sent: phoneTex('sent'), ready: phoneTex('ready') };
    const K = { none: kitchenTex(''), New: kitchenTex('New'), Cooking: kitchenTex('Cooking'), Ready: kitchenTex('Ready') };
    const phone = device(0.78, 1.6, 0.1, P.menu); phone.position.set(-2.0, 0.86, 0.2); phone.rotation.set(-0.12, 0.42, 0); scene.add(phone);
    const tablet = device(2.3, 1.61, 0.1, K.none); tablet.position.set(1.35, 0.9, 0); tablet.rotation.set(-0.1, -0.3, 0); scene.add(tablet);
    const ticket = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.486), new THREE.MeshBasicMaterial({ map: ticketTex(), side: THREE.DoubleSide })); ticket.visible = false; scene.add(ticket);
    const a = new THREE.Vector3(-1.9, 1.0, 0.5), b = new THREE.Vector3(-0.2, 2.5, 1.4), c = new THREE.Vector3(1.3, 0.95, 0.25);
    camera.position.set(0, 1.25, 4.5); camera.lookAt(0, 0.9, 0);
    let from = -1, now = 0, last = '';
    const set = (p, k) => { if (last === p + k) return; last = p + k; phone.screen.material.map = P[p]; tablet.screen.material.map = K[k]; };
    const api = { dirty: true, enter: () => { from = null; } };
    host.addEventListener('click', () => { from = null; }); host.style.cursor = 'pointer';
    api.tick = (t) => {
      now = t; if (from === null) from = t; if (from < 0) return false;
      const s = t - from; if (s > 7.2) { set('ready', 'Ready'); return false; }
      set(s < 0.9 ? 'menu' : s < 5.8 ? 'sent' : 'ready', s < 2.9 ? 'none' : s < 4.3 ? 'New' : s < 5.8 ? 'Cooking' : 'Ready');
      const f = ease((s - 0.9) / 2); ticket.visible = s > 0.9 && s < 2.9;
      ticket.position.set((1 - f) ** 2 * a.x + 2 * (1 - f) * f * b.x + f * f * c.x, (1 - f) ** 2 * a.y + 2 * (1 - f) * f * b.y + f * f * c.y, (1 - f) ** 2 * a.z + 2 * (1 - f) * f * b.z + f * f * c.z);
      ticket.rotation.set(-0.2 + f * 0.1, 0.42 - f * 0.72 + Math.sin(f * Math.PI) * 0.5, Math.sin(f * Math.PI) * 0.25); ticket.scale.setScalar(f > 0.8 ? 1 - (f - 0.8) * 4 : 1);
      phone.position.y = 0.86 + Math.sin(Math.min(1, s / 0.9) * Math.PI) * -0.04;
      camera.position.x = Math.sin(s / 7.2 * Math.PI) * 0.5; camera.lookAt(0, 0.9, 0);
      return true;
    };
    return api;
  };

  hosts.forEach((h) => mount(h, h.dataset.scene === 'flow' ? flow : table));
}
