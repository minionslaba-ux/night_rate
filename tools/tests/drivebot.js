// Бот-водитель: проходит все машинные главы (эпизоды 1–14) через тот же стик, что у игрока на телефоне.
// Едет по стрелке навигатора (NAV), тормозит перед поворотами, сдаёт назад, если упёрся, держит дистанцию в слежке,
// стреляет автоприцелом и таранит цели. Итог по главе: победа / провал (и почему) / машина разбита / не успел за лимит.
const { chromium } = require('playwright'); const fs = require('fs');
const SP = '/tmp/claude-0/-home-user-night-rate/f65b7893-f1fa-52cc-a7ad-13c3e445bd25/scratchpad', PK = SP + '/t147/package';
const PAGE = 'page-db.html';
if (!process.env.NOPAGE) fs.writeFileSync(SP + '/test/' + PAGE, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('/home/user/night-fare/index.html', 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.setDefaultTimeout(1800000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => { const u = new URL(r.request().url()); r.fulfill({ body: fs.readFileSync(PK + u.pathname.replace('/npm/three@0.147.0', '')), contentType: 'application/javascript' }); });
  await p.route('https://fonts.**', (r) => r.abort()); await p.route('https://*.supabase.co/**', (r) => r.abort()); await p.route('https://yandex.**', (r) => r.abort()); await p.route('https://*.yandex.**', (r) => r.abort());
  await p.addInitScript(() => localStorage.setItem('nf-installed', 'true'));
  if (process.env.TRACE) await p.addInitScript(() => { window.__TRACE = 1; });
  await p.goto('http://127.0.0.1:8766/' + PAGE);
  await p.waitForFunction(() => window.__nightFare && window.__nightFare.state.mode === 'preview', null, { timeout: 400000 });
  const A = +process.env.A || 0, Bn = +process.env.B || 999, TRIES = JSON.parse(process.env.TRIES || '[0]'), LIMIT = +process.env.LIMIT || 300;
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, SEED = JSON.parse(process.env.SEED || '{}');
  const res = await p.evaluate(([A, Bn, TRIES, LIMIT, ONLY, SEED]) => {
    const g = window.__nightFare, S = g.state, out = [];
    document.getElementById('gate').hidden = true;
    const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const list = [];
    for (const ep of Object.keys(g.EPS).map(Number).sort((a, b) => a - b)) {
      const n = ep === 1 ? 1 : ep === 2 ? 6 : g.EPS[ep].chapters.length;
      for (let c = 1; c <= n; c++) list.push([ep, c]);
    }
    if (!list.some((x) => x[0] === 1)) list.unshift([1, 1]);
    if (!list.some((x) => x[0] === 2)) for (let c = 6; c >= 1; c--) list.unshift([2, c]);
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const chType = (ep, ch) => (ep === 1 ? 'ep1' : ep === 2 ? 'ep2c' + ch : g.EPS[ep].chapters[ch - 1].type);
    // one frame of the bot's thumb on the stick
    const B = { stuck: 0, rev: 0, revS: 0, crumbs: [], pi: 0, joined: false };
    function drive(type) {
      const pc = g.pc, M = g.MIS, goal = S.ep === 1 ? g.GOAL : M.navGoal();
      const sp = Math.hypot(pc.vel.x, pc.vel.z), dG = Math.hypot(goal.x - pc.pos.x, goal.z - pc.pos.z);
      const ram = /stop|train|plane|ep2c5/.test(type), tail = /tail|ep2c1|escort/.test(type);
      let tgt = g.NAV.target || goal;
      if (dG < (ram ? 70 : 35) || !g.NAV.target) tgt = goal;
      // a moving scripted car: drive along its trail (breadcrumbs), not across blocks
      const sc = (tail || ram) && g.enemyCars.find((e) => e.script && !e.dead && !e.disabled && Math.hypot(e.pos.x - goal.x, e.pos.z - goal.z) < 1);
      if (sc) {
        const L = B.crumbs[B.crumbs.length - 1];
        if (!L || Math.hypot(L.x - sc.pos.x, L.z - sc.pos.z) > 3) B.crumbs.push({ x: sc.pos.x, z: sc.pos.z });
        while (B.crumbs.length > 1 && Math.hypot(B.crumbs[0].x - pc.pos.x, B.crumbs[0].z - pc.pos.z) < 7) B.crumbs.shift();
        // skip crumbs behind us if a later one is closer
        let bi = 0, bd = 1e9; for (let i = 0; i < Math.min(B.crumbs.length, 12); i++) { const d = Math.hypot(B.crumbs[i].x - pc.pos.x, B.crumbs[i].z - pc.pos.z); if (d < bd) { bd = d; bi = i; } }
        if (bi > 0) B.crumbs.splice(0, bi);
        const c0 = B.crumbs[0];
        if (ram && dG < 22) tgt = goal; else if (c0 && Math.hypot(c0.x - pc.pos.x, c0.z - pc.pos.z) < 60) tgt = new g.GOAL.constructor(c0.x, 0, c0.z);
        else if (sc.path && g.NAV.pts.length <= 1 && pc.pos.x > 398) {   // no street grid here: ride along the target's own route
          const Pp = sc.path, n = Pp.length; let bi = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.hypot(Pp[i].x - pc.pos.x, Pp[i].z - pc.pos.z); if (d < bd) { bd = d; bi = i; } }
          if (B.rp === undefined || B.rp === null) B.rp = bi;
          if (Math.hypot(Pp[B.rp].x - pc.pos.x, Pp[B.rp].z - pc.pos.z) < 9) B.rp = (B.rp + 1) % n;
          tgt = Pp[B.rp];
        }
      }
      // on the race track: steer round a slower car right ahead instead of ramming it
      if (g.TRK.on && /circuit|overtake/.test(type)) {
        const T = g.TRK, i0 = g.TR.me.idx, nr = T.nrm[i0], fx = Math.sin(pc.h), fz = Math.cos(pc.h);
        const mySide = (pc.pos.x - T.pts[i0].x) * nr.x + (pc.pos.z - T.pts[i0].z) * nr.z;
        for (const e of g.enemyCars) {
          if (!e.racer || e.dead) continue;
          const dx = e.pos.x - pc.pos.x, dz = e.pos.z - pc.pos.z, f = dx * fx + dz * fz, lat = dx * nr.x + dz * nr.z;
          if (f > 0 && f < 22 && Math.abs(lat) < 3.6) { const side = Math.abs(mySide + lat) > 5 ? -Math.sign(mySide + lat) : (lat > 0 ? -1 : 1); tgt = new g.GOAL.constructor(tgt.x + nr.x * side * 5, 0, tgt.z + nr.z * side * 5); break; }
        }
      }
      // herding: get round behind the flock (on the side away from the gate) and walk it slowly towards the gate
      if (type === 'herd' && M.geese) {
        const free = M.geese.filter((q) => !q.pen);
        if (free.length) {
          let fx = 0, fz = 0; for (const q of free) { fx += q.pos.x; fz += q.pos.z; } fx /= free.length; fz /= free.length;
          const gx = M.gate.x, gz = M.gate.z, dl = Math.hypot(fx - gx, fz - gz) || 1, bx = fx + (fx - gx) / dl * 10, bz = fz + (fz - gz) / dl * 10;
          const behind = Math.hypot(pc.pos.x - bx, pc.pos.z - bz) < 6;
          tgt = behind ? new g.GOAL.constructor(gx, 0, gz) : new g.GOAL.constructor(bx, 0, bz);
          B.herdV = behind ? 3.2 : 7;
        }
      }
      // a fight: patrol the blocks in the centre and let the autoaim shoot the pursuers
      let hold = false; if (type === 'escape') { try { hold = M.carStyle === 'police' && /Продержись/.test((M.hud() || {}).timer || ''); } catch (e) {} }
      const fight = type === 'hunt' || (type === 'ep2c3' && M.leg === 2) || hold;
      if (fight && Math.abs(pc.pos.x) < 200 && Math.abs(pc.pos.z) < 200) {
        // while holding out in an escape the loop runs through the tunnel on the southern road (it shakes off the police)
        const LOOP = hold ? [[80, -160], [-80, -160], [-80, -80], [80, -80]] : [[80, -80], [80, 80], [-80, 80], [-80, -80]];
        let q = LOOP[B.pi % 4]; if (Math.hypot(q[0] - pc.pos.x, q[1] - pc.pos.z) < 9) { B.pi++; q = LOOP[B.pi % 4]; }
        if (B.pi === 0 && !B.joined) { B.joined = true; let bi = 0, bd = 1e9; LOOP.forEach((p, i) => { const d = Math.hypot(p[0] - pc.pos.x, p[1] - pc.pos.z); if (d < bd) { bd = d; bi = i; } }); B.pi = bi; q = LOOP[bi]; }
        g.updNav(pc.pos, new g.GOAL.constructor(q[0], 0, q[1]));
        tgt = Math.hypot(q[0] - pc.pos.x, q[1] - pc.pos.z) < 30 ? new g.GOAL.constructor(q[0], 0, q[1]) : g.NAV.target;
      }
      else if (fight) {   // airport / station: no street grid — roam between random points near the start
        if (!B.home) B.home = { x: pc.pos.x, z: pc.pos.z };
        if (!B.wp || Math.hypot(B.wp.x - pc.pos.x, B.wp.z - pc.pos.z) < 10 || B.hard) { const a = Math.random() * 6.283, r = 40 + Math.random() * 80; B.wp = { x: B.home.x + Math.sin(a) * r, z: B.home.z + Math.cos(a) * r }; B.hard = 0; }
        tgt = new g.GOAL.constructor(B.wp.x, 0, B.wp.z);
      }
      // aim a little ahead of a moving target when ramming
      const want = Math.atan2(tgt.x - pc.pos.x, tgt.z - pc.pos.z), diff = wrapA(want - pc.h);
      const s = clamp(-diff * 2.2, -1, 1);
      // speed: slow for sharp turns and before intersections where the route turns
      let vWant = 40;
      if (Math.abs(diff) > 1.1) vWant = 9; else if (Math.abs(diff) > 0.45) vWant = 16;
      const P0 = g.NAV.pts[0], P1 = g.NAV.pts[1];
      if (P0 && P1 && tgt === g.NAV.target) {
        const dTurn = Math.hypot(P0.x - pc.pos.x, P0.z - pc.pos.z), a1 = Math.atan2(P0.x - pc.pos.x, P0.z - pc.pos.z), a2 = Math.atan2(P1.x - P0.x, P1.z - P0.z);
        if (Math.abs(wrapA(a2 - a1)) > 0.6 && dTurn < 10 + sp * 0.9) vWant = Math.min(vWant, 15);
      }
      if (tail) {
        const t = g.enemyCars.find((e) => e.script && !e.dead), d = t ? t.pos.distanceTo(pc.pos) : 99, tv = t ? Math.hypot(t.vel.x, t.vel.z) : 0;
        if (d < 22) vWant = 0; else if (d < 35) vWant = Math.min(vWant, tv); else if (d < 55) vWant = Math.min(vWant, tv + 6);
      }
      if (/deliver|escape|ep2c3/.test(type) && dG < 30) vWant = Math.min(vWant, 14);
      if (type === 'pacecar') vWant = clamp(vWant, 19, 25);
      if (type === 'photo' && dG < 11) vWant = 0;
      if (type === 'paperboy') vWant = Math.min(vWant, 10.5);
      if (type === 'herd') vWant = Math.min(vWant, B.herdV || 6);
      if (type === 'comfort') vWant = Math.min(vWant, dG < 14 ? 2 : 11);
      if (type === 'shuttle' && dG < 8) vWant = 0;
      if (type === 'sneak') vWant = Math.min(vWant, 9);
      if (type === 'parking') vWant = Math.min(vWant, dG < 3 ? 0 : dG < 16 ? 3 : 12);
      if (type === 'fuel') { const P0b = g.NAV.pts[1]; vWant = Math.min(vWant, 33); }
      if (type === 'slalom') vWant = Math.min(vWant, 15);
      if (type === 'push' && pc.pos.distanceTo(goal) < 12) vWant = Math.min(vWant, 9);
      // stuck → back up with the wheel turned the other way
      if (B.rev > 0) { B.rev -= 1 / 30; g.keys.KeyS = false; g.joy.x = -B.revS * 0.75; g.joy.y = 0.75; return; }
      if (vWant > 3 && sp < 1.8) B.stuck += 1 / 30; else B.stuck = Math.max(0, B.stuck - 2 / 30);
      // no progress for 4 s (bouncing off a wall) also counts as stuck
      B.fr = (B.fr || 0) + 1; if (B.fr % 120 === 0) { if (B.lp && Math.hypot(pc.pos.x - B.lp.x, pc.pos.z - B.lp.z) < 10 && vWant > 3) { B.stuck = 9; B.hard = (B.hard || 0) + 1; } else B.hard = 0; B.lp = { x: pc.pos.x, z: pc.pos.z }; }
      if (B.stuck > 1.3) {
        B.stuck = 0; B.rev = B.hard ? 1.8 : 1.1; B.revS = B.hard ? -Math.sign(s || 1) : s;
        // then head for the nearest crossroads centre to get back on the road
        const R = [-160, -80, 0, 80, 160], nx = R.reduce((a, b) => (Math.abs(b - pc.pos.x) < Math.abs(a - pc.pos.x) ? b : a)), nz = R.reduce((a, b) => (Math.abs(b - pc.pos.z) < Math.abs(a - pc.pos.z) ? b : a));
        if (B.hard && Math.abs(pc.pos.x) < 200 && Math.abs(pc.pos.z) < 200) { B.rec = 3; B.recP = { x: nx, z: nz }; }
      }
      if (B.rec > 0) { B.rec -= 1 / 30; tgt = new g.GOAL.constructor(B.recP.x, 0, B.recP.z); if (Math.hypot(B.recP.x - pc.pos.x, B.recP.z - pc.pos.z) < 6) B.rec = 0; }
      const s2 = B.rec > 0 ? clamp(-wrapA(Math.atan2(tgt.x - pc.pos.x, tgt.z - pc.pos.z) - pc.h) * 2.2, -1, 1) : s;
      const k = Math.sign(s2) * Math.pow(Math.abs(s2), 1 / 1.35), a = 1.15 * k;
      let mag = 1; g.keys.KeyS = false;
      if (sp > vWant + 4) { mag = 0.17; g.keys.KeyS = true; } else if (sp > vWant) mag = 0.17;
      g.joy.x = Math.sin(a) * mag; g.joy.y = -Math.cos(a) * mag;
    }
    function run(ep, ch, tries) {
      document.getElementById('modal').hidden = true;
      g.DIFF.last = null;
      if (ep === 1) g.startMission(); else g.startEpisode(ep, ch);
      for (let k = 0; k < 80 && S.mode === 'dialog'; k++) g.advanceDialog();
      if (S.act !== 1 || S.mode !== 'drive') return null;  // on-foot chapter: tested by the shooter bot
      localStorage.setItem('nf-tries', JSON.stringify({ [g.diffKey()]: tries }));
      const type = chType(ep, ch), m0 = Math.round(g.diffMult() * 100) / 100;
      const noFire = () => (g.MIS && g.MIS.noFire) || /tail|ep2c1/.test(type);
      S.invuln = 0; S.fireLock = false; B.stuck = 0; B.rev = 0; B.crumbs = []; B.pi = 0; B.joined = false; B.fr = 0; B.lp = null; B.hard = 0; B.rec = 0; B.home = null; B.wp = null; B.rp = null;
      let t = 0, end = 'limit', minHp = 100, dlg = 0;
      const ch0 = S.ch, act0 = S.act, tr = [];
      for (; t < LIMIT * 30; t++) {
        if (S.mode === 'dialog') {   // a talk in the middle of the chapter (pickups, waypoints): read on
          if (g.DIFF.last && g.DIFF.last.result === 'win') { end = 'win'; break; }
          for (let k = 0; k < 80 && S.mode === 'dialog'; k++) g.advanceDialog(); dlg++;
          if (g.DIFF.last && g.DIFF.last.result === 'win') { end = 'win'; break; }
        }
        if (ep === 1 && S.act === 2) { end = 'win'; break; }
        if (S.ch !== ch0 || S.act !== act0) { end = g.DIFF.last && g.DIFF.last.result === 'win' ? 'win' : 'left'; break; }
        if (S.mode === 'dying') { end = 'death'; break; }
        if (S.mode === 'dead') { end = g.DIFF.last && g.DIFF.last.result === 'fail' ? 'fail' : 'death'; break; }
        if (S.mode !== 'drive') { end = 'mode:' + S.mode; break; }
        if (g.PROF.inv.ammo < 40 && t % 30 === 0) { g.PROF.coins = Math.max(g.PROF.coins, 200); g.buyAmmo(); }   // like a player: buy a new set when the gun runs dry
        drive(type);
        g.keys.Space = !noFire();
        g.sim(1, 1 / 30);
        minHp = Math.min(minHp, g.pc.hp);
        if (window.__TRACE && t % 30 === 0) tr.push([t / 30, Math.round(g.pc.pos.x), Math.round(g.pc.pos.z), Math.round(g.pc.hp), Math.round(Math.hypot(g.pc.vel.x, g.pc.vel.z)), g.enemyCars.filter((e) => !e.dead && !e.script).length, ...(g.enemyCars.filter((e) => e.script).slice(0, 1).map((e) => Math.round(e.pos.x) + "," + Math.round(e.pos.z) + (e.disabled ? "D" : ""))) ]);
        if (g.DIFF.last && g.DIFF.last.result === 'win') { end = 'win'; break; }
      }
      g.keys.Space = false; g.keys.KeyS = false; g.joy.x = 0; g.joy.y = 0;
      let hudT = ''; try { hudT = (g.MIS && g.MIS.hud && g.MIS.hud().timer) || ''; } catch (e) {}
      let goalD = null; try { const q = S.ep === 1 ? g.GOAL : g.MIS.navGoal(); goalD = Math.round(Math.hypot(q.x - g.pc.pos.x, q.z - g.pc.pos.z)); } catch (e) {}
      const r = { tries, m0, end, why: end === 'fail' ? g.DIFF.last.reason : '', sec: Math.round(t / 30), hp: Math.round(g.pc.hp), minHp: Math.round(minHp), goalD, kills: S.carKills, tr, hudT };
      document.getElementById('modal').hidden = true; S.mode = 'preview';
      return r;
    }
    let idx = -1;
    for (const [ep, ch] of list) {
      idx++; if (idx < A || idx >= Bn) continue;
      if (ONLY && !ONLY.includes(ep + ':' + ch)) continue;
      try {
        if (SEED[ep + ':' + ch]) g.DIFF.srv[ep + ':c' + ch] = SEED[ep + ':' + ch];
        const rs = []; for (const tr of TRIES) { const r = run(ep, ch, tr); if (!r) break; rs.push(r); }
        if (!rs.length) continue;
        const c = ep >= 3 ? g.EPS[ep].chapters[ch - 1] : null;
        out.push({ k: ep + ':' + ch, i: idx, type: chType(ep, ch), title: c ? c.t : '', rs });
      } catch (e) { out.push({ k: ep + ':' + ch, i: idx, err: String(e && e.stack || e).slice(0, 200) }); }
    }
    localStorage.removeItem('nf-tries');
    return out;
  }, [A, Bn, TRIES, LIMIT, ONLY, SEED]);
  fs.writeFileSync(SP + '/drive-' + (process.env.TAG || A) + '.json', JSON.stringify(res, null, 1));
  for (const r of res) console.log(r.err ? `${r.k} ERR ${r.err}` : `${r.k.padEnd(6)} ${r.type.padEnd(9)} ${String(r.title).slice(0, 20).padEnd(20)} ` + r.rs.map((x) => `x${x.m0}:${x.end}${x.why ? '(' + x.why + ')' : ''} ${x.sec}s hp${x.minHp} d${x.goalD}${process.env.HUD ? ' [' + x.hudT + ']' : ''}`).join(' | '));
  console.log('errors', errs.slice(0, 5)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
