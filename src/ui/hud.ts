import type { Game } from '../game';
import { CFG } from '../data/config';
import { xpToNext } from '../systems/progression';
import { FREE_HUNT } from '../systems/quests';

const $ = <T extends HTMLElement>(root: HTMLElement, sel: string) => root.querySelector(sel) as T;

export class Hud {
  private readonly root: HTMLElement;
  private readonly flashEl: HTMLElement;
  private readonly el: Record<string, HTMLElement> = {};
  private flashTimer = 0;
  private bannerTimer = 0;
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
        <div class="bossName">KAPI KIRAN</div>
        <div class="bar boss"><i data-id="boss"></i></div>
        <div class="bossHint" data-id="bossHint"></div>
      </div>
      <canvas class="minimap" width="180" height="180"></canvas>
      <div class="crosshair" data-id="cross"></div>
      <div class="hint" data-id="hint"></div>
      <div class="toasts" data-id="toasts"></div>
      <div class="banner" data-id="banner"><div data-id="bannerTitle"></div><small data-id="bannerSub"></small></div>
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
    this.width('hp', p.hp / p.maxHp);
    this.width('gas', p.gas / p.maxGas);
    this.width('blade', p.blades / p.maxBlades);
    this.width('xp', g.save.xp / xpToNext(g.save.level));
    this.text('lvl', `Sv ${g.save.level} · ${p.cls.name}`);
    this.text('quest', g.quests.current?.text ?? FREE_HUNT);
    this.text('zone', g.zone);
    this.text('hint', g.stations.filling ? 'Gaz doluyor…' : p.interactHint());
    this.el.gas.parentElement!.classList.toggle('low', p.gas / p.maxGas < CFG.gas.lowRatio);

    const titan = p.mode === 'titan';
    this.width('titan', m.ratio);
    this.text('needles', `ÖZ İĞNESİ × ${m.needles}`);
    this.text('titanLabel', titan ? `ÖFKE DEVİ · kalan bar ${Math.max(0, Math.ceil(m.value))}` : `DEV BARI · ${Math.floor(m.value)}/${m.max}`);
    const bc = this.el.titan.parentElement!.parentElement!;
    bc.classList.toggle('ready', m.canTransform());
    bc.classList.toggle('active', titan);
    const cd = (v: number) => (v > 0 ? ` <b>${Math.ceil(v)}</b>` : '');
    if (titan) {
      const t = p.titan;
      const c = CFG.titan.cost;
      // Her gücün yanında harcadığı bar; yetmiyorsa soluk görünür.
      const pw = (key: string, name: string, cost: number, extra = '') =>
        `<span class="${m.value >= cost ? '' : 'off'}"><kbd>${key}</kbd> ${name} <i>−${cost}</i>${extra}</span>`;
      this.html(
        'titanInfo',
        pw('Sol tık', 'Yumruk', c.punch) +
          pw('Q', 'Kükreme', c.roar, cd(t.roarCd)) +
          pw('E', 'Taş Yumruk', c.stone, t.stone ? ' <b>AKTİF</b>' : cd(t.stoneCd)) +
          pw('Space', 'Ezme', c.slam) +
          '<span><kbd>T</kbd> Çık</span>',
      );
    } else if (m.canTransform()) {
      this.html('titanInfo', '<kbd>T</kbd> ÖFKE DEVİ’NE DÖNÜŞ — bar ne kadar doluysa o kadar güç');
    } else if (m.charged) {
      this.html('titanInfo', 'Bar yeterli — dönüşmek için bir Öz İğnesi bul');
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
    cross.style.transform = `translate(${g.input.mouseX - 9}px, ${g.input.mouseY - 9}px)`;
    cross.classList.toggle('titan', titan);
    cross.classList.toggle('ok', g.aim !== null);
    cross.classList.toggle('giant', g.aim?.giant != null);

    const boss = g.spawner.boss;
    const showBoss = !!boss && boss.alive && Math.hypot(boss.pos.x - p.pos.x, boss.pos.z - p.pos.z) < CFG.world.walls[1].r * 0.3;
    this.el.bossWrap.style.display = showBoss ? 'block' : 'none';
    if (showBoss && boss) {
      this.width('boss', boss.hp / boss.maxHp);
      this.text('bossHint', boss.state === 'downed' ? 'YERDE — ENSESİNE VUR!' : 'Zırhlı: bacaklarını kes ya da Taş Yumruk kullan');
    }
  }
}
