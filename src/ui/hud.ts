import type { Game } from '../game';
import { CFG } from '../data/config';
import { FORMS, hex, TITAN_IDS, TITANS } from '../data/titans';
import { xpToNext } from '../systems/progression';
import { FREE_HUNT } from '../systems/quests';
import { SPEAKERS, withHero } from '../data/story';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const $ = <T extends HTMLElement>(root: HTMLElement, sel: string) => root.querySelector(sel) as T;

export class Hud {
  private readonly root: HTMLElement;
  private readonly flashEl: HTMLElement;
  private readonly el: Record<string, HTMLElement> = {};
  private flashTimer = 0;
  private bannerTimer = 0;
  private cardTimer = 0;
  private last: Record<string, string> = {};

  constructor(private readonly game: Game) {
    this.root = document.getElementById('hud')!;
    this.flashEl = document.getElementById('flash')!;
    this.root.innerHTML = `
      <div class="tl">
        <div class="quest"><span class="label">GÖREV</span><div data-id="quest"></div></div>
        <div class="lvl"><span data-id="lvl"></span><div class="bar xp"><i data-id="xp"></i></div></div>
        <div class="zone" data-id="zone"></div>
      </div>
      <div class="tc" data-id="bossWrap">
        <div class="bossName" data-id="bossName"></div>
        <div class="bar boss"><i data-id="boss"></i></div>
        <div class="bossHint" data-id="bossHint"></div>
      </div>
      <canvas class="minimap" width="180" height="180"></canvas>
      <div class="crosshair" data-id="cross"></div>
      <div class="hint" data-id="hint"></div>
      <div class="toasts" data-id="toasts"></div>
      <div class="grab" data-id="grab">
        <div class="grabTitle">YAKALANDIN!</div>
        <div class="grabRow"><span class="label">KURTULMA</span><div class="bar esc"><i data-id="escape"></i></div></div>
        <div class="grabRow"><span class="label">AĞZA</span><div class="bar eat"><i data-id="eat"></i></div></div>
        <div class="grabKeys" data-id="grabKeys"></div>
      </div>
      <div class="banner" data-id="banner"><div data-id="bannerTitle"></div><small data-id="bannerSub"></small></div>
      <div class="chapter" data-id="chapter"><small data-id="chapterLabel"></small><div data-id="chapterTitle"></div><p data-id="chapterSub"></p></div>
      <div class="dialog" data-id="dialog"><b data-id="dialogWho"></b><span data-id="dialogText"></span><kbd>Enter</kbd></div>
      <div class="bl">
        <div class="row"><span class="label">CAN</span><div class="bar hp"><i data-id="hp"></i></div></div>
        <div class="row"><span class="label">GAZ</span><div class="bar gas"><i data-id="gas"></i></div></div>
        <div class="row"><span class="label">KILIÇ</span><div class="bar blade"><i data-id="blade"></i></div></div>
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

  private text(id: string, value: string) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    this.el[id].textContent = value;
  }
  private html(id: string, value: string) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    this.el[id].innerHTML = value;
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
    t.textContent = msg;
    const box = this.el.toasts;
    box.appendChild(t);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2800);
  }

  banner(title: string, sub = '') {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub;
    this.el.banner.classList.add('show');
    this.bannerTimer = 2.6;
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
    const story = g.save.mode === 'story';
    this.width('hp', p.hp / p.maxHp);
    this.width('gas', p.gas / p.maxGas);
    this.width('blade', p.blades / p.maxBlades);
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
    this.text('titanLabel', titan ? `${formName} · kalan bar ${Math.max(0, Math.ceil(m.value))}` : `DEV BARI · ${Math.floor(m.value)}/${m.max}`);
    const bc = this.el.titan.parentElement!.parentElement!;
    bc.classList.toggle('ready', m.canTransform());
    bc.classList.toggle('active', titan);
    const cd = (v: number) => (v > 0 ? ` <b>${Math.ceil(v)}</b>` : '');
    if (titan) {
      const t = p.titan;
      const d = t.def;
      // Her gücün yanında harcadığı bar; yetmiyorsa soluk görünür.
      const pw = (key: string, name: string, cost: number, extra = '') =>
        `<span class="${m.value >= cost ? '' : 'off'}"><kbd>${key}</kbd> ${name} <i>−${cost}</i>${extra}</span>`;
      this.html(
        'titanInfo',
        pw('Sol tık', d.punch.name, d.punch.cost) +
          pw('Q', d.q.name, d.q.cost, d.q.kind === 'buff' && t.stone ? ' <b>AKTİF</b>' : cd(t.qCd)) +
          pw('E', d.e.name, d.e.cost, d.e.kind === 'buff' && t.stone ? ' <b>AKTİF</b>' : cd(t.eCd)) +
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
      `<kbd>R</kbd> ${p.cls.ability}${p.abilityCd > 0 ? ` <b>${Math.ceil(p.abilityCd)}</b>` : p.heavyT > 0 ? ' <b>HAZIR</b>' : ''}`,
    );

    // Nişangâh imleci izler.
    const cross = this.el.cross;
    const cx = g.input.locked ? window.innerWidth / 2 : g.input.mouseX;
    const cy = g.input.locked ? window.innerHeight / 2 : g.input.mouseY;
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
    this.el.bossWrap.style.display = boss ? 'block' : 'none';
    if (boss) {
      this.text('bossName', boss.type.name.toLocaleUpperCase('tr'));
      this.width('boss', boss.hp / boss.maxHp);
      this.text('bossHint', boss.state === 'downed' ? 'YERDE — ENSESİNE VUR!' : 'Zırhlı: bacaklarını kes ya da Taş Yumruk kullan');
    }
  }
}
