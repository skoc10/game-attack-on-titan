import type { Game } from '../game';
import { CLASSES } from '../player/classes';
import { buyUpgrade, classUnlocked, CLASS_UNLOCK, MAX_UPGRADE, UPGRADES, type ClassId, type UpgradeId } from '../systems/progression';

const CONTROLS: [string, string][] = [
  ['Fareyi hareket ettir', 'Yönünü ve bakışını çevir'],
  ['Sağ tık (basılı)', 'Baktığın yöne koş'],
  ['Sol tık (basılı)', 'Nişana kanca at, çekil'],
  ['Sol tık', 'Dev yakınken kılıç — enseye vur'],
  ['Yakalanınca', 'Sol tık seri: kes · Space: gazla sıyrıl'],
  ['Shift', 'Koş · havada gaz itişi'],
  ['Space', 'Zıpla · kancadan fırla'],
  ['E', 'Kutu aç · ata bin/in'],
  ['F', 'Atı çağır'],
  ['R', 'Sınıf yeteneği'],
  ['Tab', 'Dönüşülecek devi seç (iğne türü)'],
  ['T', 'Deve dönüş (bar yarı + iğne)'],
  ['W A S D', 'Klavyeyle hareket (isteğe bağlı)'],
  ['Esc', 'Duraklat'],
];

export class Menu {
  private readonly root: HTMLElement;
  private resetArmed = false;

  constructor(private readonly game: Game) {
    this.root = document.getElementById('menu')!;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  show() {
    this.resetArmed = false;
    this.render();
    this.root.style.display = 'flex';
  }
  hide() {
    this.root.style.display = 'none';
  }

  private onClick(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    const g = this.game;
    const act = t.dataset.act!;
    const arg = t.dataset.arg ?? '';
    if (act === 'start') {
      g.start();
      return;
    }
    if (act === 'class' && classUnlocked(g.save, arg as ClassId)) g.setClass(arg as ClassId);
    if (act === 'upgrade' && buyUpgrade(g.save, arg as UpgradeId)) g.loadoutChanged();
    if (act === 'reset') {
      if (this.resetArmed) g.resetProgress();
      this.resetArmed = !this.resetArmed;
    }
    this.render();
  }

  render() {
    const s = this.game.save;
    const classes = (Object.keys(CLASSES) as ClassId[])
      .map((id) => {
        const c = CLASSES[id];
        const open = classUnlocked(s, id);
        return `<button class="card ${s.cls === id ? 'sel' : ''} ${open ? '' : 'locked'}" data-act="class" data-arg="${id}">
          <div class="cardHead"><b>${c.name}</b><span>${open ? c.role : `Sv ${CLASS_UNLOCK[id]}`}</span></div>
          <p>${c.desc}</p>
          <p class="abil"><kbd>R</kbd> ${c.ability}: ${c.abilityDesc}</p>
        </button>`;
      })
      .join('');
    const upgrades = (Object.keys(UPGRADES) as UpgradeId[])
      .map((id) => {
        const u = UPGRADES[id];
        const lv = s.upgrades[id];
        const pips = Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
        const can = s.points > 0 && lv < MAX_UPGRADE;
        return `<div class="up"><div><b>${u.name}</b><small>${u.desc}</small></div><div class="pips">${pips}</div>
          <button data-act="upgrade" data-arg="${id}" ${can ? '' : 'disabled'}>+</button></div>`;
      })
      .join('');
    const controls = CONTROLS.map(([k, v]) => `<li><kbd>${k}</kbd><span>${v}</span></li>`).join('');
    this.root.innerHTML = `
      <div class="panel">
        <header>
          <h1>SUR ÖTESİ</h1>
          <p>İnsanlık üç surun ardına sığındı. Devler dışarıda. Sen de.</p>
        </header>
        <div class="cols">
          <section><h2>Sınıf <span>Seviye ${s.level}</span></h2><div class="cards">${classes}</div></section>
          <section><h2>Yükseltmeler <span>Puan: ${s.points}</span></h2>${upgrades}
            <h2 class="mt">Nasıl oynanır</h2>
            <ol class="how">
              <li>Kapıdan çık; atınla uzak surlara doğru yol al.</li>
              <li>Kancayla ağaçlara ve devlere tutun, hızlanıp <b>enseden</b> vur.</li>
              <li>Gaz kendiliğinden dolmaz: <b>mavi bayraklı ikmal noktalarında</b> doldur.</li>
              <li>Büyük devler seni <b>yakalayıp ağzına götürür</b>: sol tıkla kes ya da Space ile sıyrıl.</li>
              <li>Enseye <b>tek temiz kesik</b> devi devirir.</li>
              <li>Renkli ışıklı kutulardan <b>dev iğnesi</b> topla: her renk başka bir dev.</li>
              <li>Dev barı yarıyı geçince <kbd>T</kbd> ile deve dönüş; her güç bar harcar.</li>
            </ol>
          </section>
          <section><h2>Kontroller</h2><ul class="keys">${controls}</ul></section>
        </div>
        <footer>
          <button class="primary" data-act="start">${this.game.started ? 'DEVAM ET' : 'SURLARIN DIŞINA ÇIK'}</button>
          <button class="ghost" data-act="reset">${this.resetArmed ? 'Emin misin? Tekrar tıkla' : 'İlerlemeyi sıfırla'}</button>
        </footer>
      </div>`;
  }
}
