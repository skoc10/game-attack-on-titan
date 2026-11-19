import type { Game } from '../game';
import { CFG } from '../data/config';
import { FORMS, hex, TITAN_IDS, TITANS } from '../data/titans';
import { streakMult, xpToNext } from '../systems/progression';
import { FREE_HUNT } from '../systems/quests';
import { SPEAKERS, withHero } from '../data/story';
import { touchText } from '../systems/touchLayout';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const $ = <T extends HTMLElement>(root: HTMLElement, sel: string) => root.querySelector(sel) as T;

export class Hud {
  private readonly root: HTMLElement;
  private readonly flashEl: HTMLElement;
  private readonly el: Record<string, HTMLElement> = {};
  private flashTimer = 0;
  private bannerTimer = 0;
  private cardTimer = 0;
  private calloutTimer = 0;
  private last: Record<string, string> = {};

  constructor(private readonly game: Game) {
    this.root = document.getElementById('hud')!;
    this.flashEl = document.getElementById('flash')!;
    this.root.innerHTML = `
      <div class="tl">
        <div class="quest"><span class="label">GÖREV</span><div data-id="quest"></div></div>
        <div class="lvl"><span data-id="lvl"></span><div class="bar xp"><i data-id="xp"></i></div></div>
        <div class="zone" data-id="zone"></div>
        <div class="contracts" data-id="contracts"></div>
      </div>
      <div class="tc" data-id="bossWrap">
        <div class="bossName" data-id="bossName"></div>
        <div class="bar boss"><i data-id="boss"></i></div>
        <div class="bossHint" data-id="bossHint"></div>
      </div>
      <div class="raidBox" data-id="raid">
        <div class="raidHead"><b data-id="raidName"></b><span data-id="raidLine"></span></div>
        <div class="raidRow"><span class="label" data-id="raidPlace"></span><div class="bar raid"><i data-id="raidBar"></i></div><em data-id="raidPct"></em></div>
      </div>
      <canvas class="minimap" width="180" height="180" data-key="KeyM"></canvas>
      <div class="markDir" data-id="markDir"><i data-id="markArrow">▲</i><span data-id="markDist"></span></div>
      <div class="crosshair" data-id="cross"></div>
      <div class="hint" data-id="hint"></div>
      <div class="toasts" data-id="toasts"></div>
      <div class="grab" data-id="grab">
        <div class="grabTitle">YAKALANDIN!</div>
        <div class="grabRow"><span class="label">KURTULMA</span><div class="bar esc"><i data-id="escape"></i></div></div>
        <div class="grabRow"><span class="label">AĞZA</span><div class="bar eat"><i data-id="eat"></i></div></div>
        <div class="grabKeys" data-id="grabKeys"></div>
      </div>
      <div class="callout" data-id="callout"></div>
      <div class="cocoon" data-id="cocoon"><span class="label">BİLLUR KOZA</span><b data-id="cocoonT"></b><div class="bar"><i data-id="cocoonBar"></i></div><small><kbd>C</kbd> erken kır</small></div>
      <div class="npc" data-id="npc"></div>
      <div class="inv" data-id="inv"></div>
      <div class="streak" data-id="streak"><b data-id="streakN"></b><small data-id="streakM"></small><div class="bar"><i data-id="streakT"></i></div></div>
      <div class="banner" data-id="banner"><div data-id="bannerTitle"></div><small data-id="bannerSub"></small></div>
      <div class="chapter" data-id="chapter"><small data-id="chapterLabel"></small><div data-id="chapterTitle"></div><p data-id="chapterSub"></p></div>
      <div class="dialog" data-id="dialog" data-key="Enter"><b data-id="dialogWho"></b><span data-id="dialogText"></span><kbd>Enter</kbd><em class="tapNext">dokun ›</em></div>
      <div class="bl">
        <div class="row"><span class="label">CAN</span><div class="bar hp"><i data-id="hp"></i></div></div>
        <div class="row"><span class="label">GAZ</span><div class="bar gas"><i data-id="gas"></i></div></div>
        <div class="row"><span class="label">KILIÇ</span><div class="bar blade"><i data-id="blade"></i></div></div>
        <div class="row"><span class="label">MIZRAK</span><div class="spears" data-id="spears"></div></div>
        <div class="ability" data-id="ability"></div>
      </div>
      <div class="bc">
        <div class="titanHead"><span class="label" data-id="titanLabel">DEV BARI</span><span class="needles" data-id="needles"></span></div>
        <div class="bar titan"><i data-id="titan"></i><span class="mark"></span></div>
        <div class="titanInfo" data-id="titanInfo"></div>
      </div>`;
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((e) => (this.el[e.dataset.id!] = e));
  }

  get minimapCanvas() {
    return $<HTMLCanvasElement>(this.root, '.minimap');
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? 'block' : 'none';
  }

  /** Dokunmatikte metindeki klavye tuşları ekran tuşlarının adlarına çevrilir. */
  private words(s: string) {
    return this.game.input.touch ? touchText(s) : s;
  }
  private text(id: string, value: string) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    this.el[id].textContent = this.words(value);
  }
  private html(id: string, value: string) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    this.el[id].innerHTML = this.words(value);
  }
  private width(id: string, ratio: number) {
    const v = `${Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 10}%`;
    if (this.last[`w:${id}`] === v) return;
    this.last[`w:${id}`] = v;
    this.el[id].style.width = v;
  }

  toast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = this.words(msg);
    const box = this.el.toasts;
    box.appendChild(t);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2800);
  }

  banner(title: string, sub = '') {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = this.words(sub);
    this.el.banner.classList.add('show');
    this.bannerTimer = 2.6;
  }

  /** Vuruş biçimini bildiren kısa yazı (nişangâhın altında parlayıp söner). */
  callout(text: string) {
    const el = this.el.callout;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // animasyonu baştan başlat
    el.classList.add('show');
    this.calloutTimer = 1.2;
  }

  /** Sezon açılış kartı: ekranı kısa süre karartıp büyük başlık gösterir. */
  chapterCard(label: string, title: string, sub: string) {
    this.el.chapterLabel.textContent = label;
    this.el.chapterTitle.textContent = title;
    this.el.chapterSub.textContent = sub;
    this.el.chapter.classList.add('show');
    this.cardTimer = 4.6;
  }

  flash(color: string, strength = 0.6, time = 0.35) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = String(strength);
    this.flashTimer = time;
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${time}s ease-out`;
      this.flashEl.style.opacity = '0';
    });
  }

  update(dt: number) {
    const g = this.game;
    const p = g.player;
    const m = g.meter;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.remove('show');
    }
    if (this.cardTimer > 0) {
      this.cardTimer -= dt;
      if (this.cardTimer <= 0) this.el.chapter.classList.remove('show');
    }
    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) this.el.callout.classList.remove('show');
    }
    // Koza: içindeyken kalan süre, dışındayken bekleme süresi yetenek satırında görünür.
    const co = g.cocoon;
    this.el.cocoon.classList.toggle('show', co.active);
    if (co.active) {
      this.text('cocoonT', `${co.t.toFixed(1)} sn`);
      this.width('cocoonBar', co.t / CFG.cocoon.dur);
    }
    // Sur içindeki kişilerle konuşma penceresi.
    const nv = g.npcs.view();
    this.el.npc.classList.toggle('show', nv !== null);
    if (nv) {
      const opts = nv.options
        .map((o) => `<li class="${o.off ? 'off' : ''}" data-key="Digit${o.key}"><kbd>${o.key}</kbd><div><b>${esc(o.text)}</b><small>${esc(o.sub)}</small></div></li>`)
        .join('');
      this.html('npc', `<div class="npcHead"><b>${esc(nv.name)}</b><span>${esc(nv.role)}</span></div><p>“${esc(nv.greet)}”</p><ul>${opts}</ul><div class="npcNote">${esc(nv.note)}</div><div class="npcKeys" data-key="Escape"><kbd>E</kbd> / <kbd>Esc</kbd> kapat<b class="tapClose">KAPAT ✕</b></div>`);
    }
    // Çanta
    const iv = g.inventory.view();
    this.el.inv.classList.toggle('show', iv !== null);
    if (iv) {
      const rows = iv.rows
        .map((r) => `<li class="${r.off ? 'off' : ''}" style="--c:${r.color}" data-key="Digit${r.key}"><kbd>${r.key}</kbd><div><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></div><em>${esc(r.tag)}</em></li>`)
        .join('');
      const gear = iv.gear.map((x) => `<span style="--c:${x.color}">${esc(x.name)} <b>${esc(x.value)}</b></span>`).join('');
      this.html('inv', `<div class="npcHead"><b>ÇANTA</b><span>yürürken de açık kalır</span></div><ul>${rows}</ul><div class="invGear">${gear}</div><div class="npcKeys" data-key="Escape"><kbd>I</kbd> / <kbd>Esc</kbd> kapat<b class="tapClose">KAPAT ✕</b></div>`);
    }
    this.html(
      'contracts',
      g.npcs
        .active()
        .map((c) => `<div>◇ ${esc(c.giver)} · ${esc(c.title)} <i>${c.progress}/${c.goal}</i></div>`)
        .join(''),
    );
    const story = g.save.mode === 'story';
    this.width('hp', p.hp / p.maxHp);
    this.width('gas', p.gas / p.maxGas);
    this.width('blade', p.blades / p.maxBlades);
    this.html('spears', Array.from({ length: p.maxSpears }, (_, i) => `<i class="${i < p.spears ? 'on' : ''}"></i>`).join('') + '<kbd>Q</kbd>');
    // Öldürme serisi: sayı, av puanı çarpanı ve kalan süre.
    const streakOn = g.streak >= 2 && g.streakT > 0;
    this.el.streak.classList.toggle('show', streakOn);
    if (streakOn) {
      this.text('streakN', `SERİ ×${g.streak}`);
      this.text('streakM', `av puanı ×${streakMult(g.streak, CFG.streak.step, CFG.streak.maxMult).toFixed(2).replace(/0$/, '')}`);
      this.width('streakT', g.streakT / CFG.streak.window);
    }
    this.width('xp', g.save.xp / xpToNext(g.save.level));
    this.text('lvl', `Sv ${g.save.level} · ${p.char.name} · ${p.cls.name} · ◆ ${g.save.coins}`);
    if (story) {
      const st = g.story;
      const steps = st.objectives
        .map((o) => {
          const n = o.goal > 1 ? ` <i>${o.count}/${o.goal}</i>` : '';
          return `<li class="${o.state}">${esc(o.text)}${n}</li>`;
        })
        .join('');
      this.html('quest', `<div class="qHead">${esc(st.heading)}</div><ul class="steps">${steps}</ul>${st.hint ? `<div class="qHint">${esc(st.hint)}</div>` : ''}`);
    } else {
      this.html('quest', esc(g.quests.current?.text ?? FREE_HUNT));
    }
    // Telsiz konuşması
    const line = story ? g.story.line : null;
    this.el.dialog.classList.toggle('show', line !== null);
    if (line) {
      const who = SPEAKERS[line[0]];
      this.text('dialogWho', withHero(who.name, p.char.name));
      this.el.dialogWho.style.color = who.color;
      this.el.dialog.classList.toggle('narr', who.name === '');
      this.text('dialogText', withHero(line[1], p.char.name));
    }
    this.text('zone', g.zone);
    this.text('hint', g.stations.filling ? 'Gaz doluyor…' : p.interactHint());
    this.el.gas.parentElement!.classList.toggle('low', p.gas / p.maxGas < CFG.gas.lowRatio);

    const titan = p.mode === 'titan';
    this.width('titan', m.ratio);
    // İğne envanteri: eldeki türler renkli çiplerle, seçili olan çerçeveli.
    const owned = TITAN_IDS.filter((id) => m.needles[id] > 0);
    const chips = owned.map(
      (id) => `<span class="nd ${id === m.selected ? 'sel' : ''}" style="--c:${hex(TITANS[id].color)}">${TITANS[id].name.replace(' Devi', '')} ×${m.needles[id]}</span>`,
    );
    // Karakterin kendi formu: iğne sayısı yerine yıldızla gösterilir.
    if (m.innate) chips.push(`<span class="nd ${m.usesInnate ? 'sel' : ''}" style="--c:${hex(FORMS[m.innate].color)}">${FORMS[m.innate].name.replace(' Devi', '')} ★</span>`);
    this.html('needles', chips.length === 0 ? 'İĞNE YOK' : chips.join('') + (chips.length > 1 && !titan ? '<kbd>Tab</kbd>' : ''));
    const sel = FORMS[m.selected];
    const formName = (titan ? p.titan.def.name : sel.name).toLocaleUpperCase('tr');
    this.text('titanLabel', titan ? `${formName} · kalan bar ${Math.max(0, Math.ceil(m.value))}${p.titanResting ? ' · DİNLENİYOR' : ''}` : `DEV BARI · ${Math.floor(m.value)}/${m.max}`);
    const bc = this.el.titan.parentElement!.parentElement!;
    bc.classList.toggle('ready', m.canTransform());
    bc.classList.toggle('active', titan);
    bc.classList.toggle('resting', titan && p.titanResting);
    const cd = (v: number) => (v > 0 ? ` <b>${Math.ceil(v)}</b>` : '');
    if (titan) {
      const t = p.titan;
      const d = t.def;
      // Her gücün yanında harcadığı bar; yetmiyorsa soluk görünür.
      const pw = (key: string, name: string, cost: number, extra = '') =>
        `<span class="${m.value >= cost ? '' : 'off'}"><kbd>${key}</kbd> ${name} <i>−${String(cost).replace('.', ',')}</i>${extra}</span>`;
      this.html(
        'titanInfo',
        pw('Sol tık', d.punch.name, d.punch.cost) +
          pw('Q', d.q.name, d.q.cost, d.q.kind === 'buff' && t.stone ? ' <b>AKTİF</b>' : cd(t.qCd)) +
          pw('E', d.e.name, d.e.cost, d.e.kind === 'buff' && t.stone ? ' <b>AKTİF</b>' : cd(t.eCd)) +
          pw('F', 'Isırık', CFG.titan.bite.cost, cd(t.biteCd)) +
          pw('R', CFG.titan.steam.name, CFG.titan.steam.cost, t.steamT > 0 ? ' <b>AKTİF</b>' : cd(t.steamCd)) +
          pw('V', 'Tekme', CFG.kick.cost, cd(t.kickCd)) +
          `<span><kbd>G</kbd> Gard${t.guarding ? (t.combo > 1 ? ` <b>SERİ ×${t.combo}</b>` : ' <b>AÇIK</b>') : ''}</span>` +
          pw('Space', d.slam.name, d.slam.cost) +
          '<span><kbd>T</kbd> Çık</span>',
      );
    } else if (m.canTransform()) {
      this.html('titanInfo', `<kbd>T</kbd> ${formName}’NE DÖNÜŞ — bar ne kadar doluysa o kadar güç`);
    } else if (m.usesInnate) {
      this.html('titanInfo', `Bar tamamen dolunca <kbd>T</kbd> ile iğnesiz ${formName}’NE dönüşürsün`);
    } else if (m.charged) {
      this.html('titanInfo', 'Bar yeterli — dönüşmek için renkli ışıklı bir kutudan iğne bul');
    } else {
      this.html('titanInfo', 'Dev öldürdükçe dolar · yarıya gelince dönüşebilirsin');
    }

    this.el.ability.style.display = titan ? 'none' : 'block';
    this.html(
      'ability',
      `<kbd>R</kbd> ${p.cls.ability}${p.abilityCd > 0 ? ` <b>${Math.ceil(p.abilityCd)}</b>` : p.heavyT > 0 ? ' <b>HAZIR</b>' : ''}` +
        ` &nbsp; <kbd>C</kbd> Koza${co.active ? ' <b>AÇIK</b>' : co.cd > 0 ? ` <b>${Math.ceil(co.cd)}</b>` : ''}` +
        ` &nbsp; <kbd>H</kbd> Sargı <b class="n">${g.save.inv.sargi}</b> &nbsp; <kbd>I</kbd> Çanta` +
        (g.save.inv.wear ? (p.revealT > 0 ? ` &nbsp; <span class="hoodTag seen">KAPŞON · GÖRÜNÜRSÜN ${Math.ceil(p.revealT)}</span>` : ' &nbsp; <span class="hoodTag">KAPŞON · GİZLİ</span>') : ''),
    );

    // Nişangâh imleci izler.
    const cross = this.el.cross;
    const cx = g.input.centerAim ? window.innerWidth / 2 : g.input.mouseX;
    const cy = g.input.centerAim ? window.innerHeight / 2 : g.input.mouseY;
    cross.style.transform = `translate(${cx - 9}px, ${cy - 9}px)`;
    cross.classList.toggle('titan', titan);
    cross.classList.toggle('ok', g.aim !== null);
    cross.classList.toggle('giant', g.aim?.giant != null);

    // Yakalanma göstergesi: kurtulma barı ve devin ağzına kalan mesafe.
    const by = p.grabbedBy;
    this.el.grab.style.display = by ? 'block' : 'none';
    if (by) {
      this.width('escape', p.escape / 100);
      this.width('eat', by.grabProgress);
      const canBurst = p.gas >= CFG.grab.burstGas;
      this.html(
        'grabKeys',
        `<span><kbd>Sol tık</kbd> seri bas: parmakları kes</span>` +
          `<span class="${canBurst ? '' : 'off'}"><kbd>Space</kbd> gaz patlaması <i>−${CFG.grab.burstGas} gaz</i></span>` +
          (m.canTransform() ? `<span><kbd>T</kbd> elinde deve dönüş</span>` : ''),
      );
    }

    const boss = g.bossInView();
    // Baskın paneli: adı, aşaması ve savunulan yerin sağlamlığı.
    const rv = g.raid.view();
    this.el.raid.classList.toggle('show', rv !== null);
    this.root.classList.toggle('raiding', rv !== null);
    if (rv) {
      this.text('raidName', rv.name.toLocaleUpperCase('tr'));
      this.text('raidLine', rv.line);
      this.text('raidPlace', rv.place);
      this.text('raidPct', `%${Math.round(rv.integrity * 100)}`);
      this.width('raidBar', rv.integrity);
      this.el.raid.classList.toggle('low', rv.integrity < 0.3);
      this.el.raid.classList.toggle('won', rv.won);
    }
    // Haritadaki işaretin yönü ve uzaklığı (kameraya göre).
    const mk = g.mark;
    this.el.markDir.classList.toggle('show', mk !== null);
    if (mk) {
      const dx = mk.x - p.pos.x;
      const dz = mk.z - p.pos.z;
      const sn = Math.sin(g.camYaw);
      const cs = Math.cos(g.camYaw);
      const ang = Math.atan2(-dx * cs + dz * sn, dx * sn + dz * cs);
      const deg = `rotate(${Math.round((ang * 180) / Math.PI)}deg)`;
      if (this.last.markRot !== deg) {
        this.last.markRot = deg;
        this.el.markArrow.style.transform = deg;
      }
      const d = Math.hypot(dx, dz);
      this.text('markDist', `İŞARET ${d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(d)} m`}`);
    }
    this.el.bossWrap.style.display = boss ? 'block' : 'none';
    if (boss) {
      this.text('bossName', boss.type.name.toLocaleUpperCase('tr'));
      this.width('boss', boss.hp / boss.maxHp);
      this.text('bossHint', boss.state === 'downed' ? 'YERDE — ENSESİNE VUR!' : boss.tag === 'huntress' ? 'Atla kaç, ağaçlara kanca at; bacaklarını kes ya da ensesine üç temiz kesik vur' : boss.form ? 'Dönüşümcü: ensesine iki temiz kesik ya da dev gücüyle vur — düşerse iğnesi senin' : 'Zırhlı: bacaklarını kes ya da Taş Yumruk kullan');
    }
  }
}
