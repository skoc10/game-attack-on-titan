import type { Game } from '../game';
import { CLASSES } from '../player/classes';
import { buyUpgrade, ownsChar, classUnlocked, CLASS_UNLOCK, MAX_UPGRADE, UPGRADES, type ClassId, type GameMode, type UpgradeId } from '../systems/progression';
import { CHAPTERS, missionCount } from '../data/story';
import { CHARACTERS, CHAR_IDS, type CharId } from '../data/characters';
import { FORMS, hex } from '../data/titans';
import { missionAt, missionsDone, storyDone } from '../systems/storyRules';

const CONTROLS: [string, string][] = [
  ['Fareyi hareket ettir', 'Yönünü ve bakışını çevir'],
  ['Sağ tık (basılı)', 'Baktığın yöne koş'],
  ['Sol tık (basılı)', 'Nişana kanca at, çekil'],
  ['Sol tık', 'Dev yakınken kılıç — enseye vur'],
  ['Yakalanınca', 'Sol tık seri: kes · Space: gazla sıyrıl'],
  ['Shift', 'Koş · havada gaz itişi'],
  ['Space', 'Zıpla · kancadan fırla'],
  ['E', 'Kutu aç · ata bin/in · konuş'],
  ['F', 'Atı çağır'],
  ['R', 'Sınıf yeteneği'],
  ['Q', 'Patlar mızrak fırlat (dev formunda: güç)'],
  ['C', 'Billur koza: 6 sn dokunulmaz ol'],
  ['Tab', 'Dönüşülecek devi seç (iğne türü)'],
  ['T', 'Deve dönüş (bar yarı + iğne)'],
  ['W A S D', 'Klavyeyle hareket (isteğe bağlı)'],
  ['Enter', 'Konuşma satırını geç'],
  ['Esc', 'Duraklat'],
];

export class Menu {
  private readonly root: HTMLElement;
  private resetArmed = false;
  private jumpArmed = -1;
  private buyArmed: CharId | null = null;

  constructor(private readonly game: Game) {
    this.root = document.getElementById('menu')!;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  show() {
    this.resetArmed = false;
    this.jumpArmed = -1;
    this.buyArmed = null;
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
    if (act === 'mode') g.setMode(arg as GameMode);
    if (act === 'char') {
      const id = arg as CharId;
      // Sahip olunan karakter tek tıkla seçilir; satın alma ikinci tıkla onaylanır.
      if (ownsChar(g.save, id) || this.buyArmed === id) {
        g.pickChar(id);
        this.buyArmed = null;
      } else this.buyArmed = g.save.coins >= CHARACTERS[id].price ? id : null;
    } else this.buyArmed = null;
    if (act === 'chapter') {
      const i = Number(arg);
      // Geriye dönmek ilerlemeyi o sezonun başına aldığı için iki tıkla onaylanır.
      if (i === g.save.story.chapter && g.save.mode === 'story') this.jumpArmed = -1;
      else if (this.jumpArmed === i) {
        g.playChapter(i);
        this.jumpArmed = -1;
      } else this.jumpArmed = i;
    } else this.jumpArmed = -1;
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
    const hero = CHARACTERS[s.char].name;
    const chars = CHAR_IDS.map((id) => {
      const c = CHARACTERS[id];
      const owned = ownsChar(s, id);
      const can = s.coins >= c.price;
      const form = c.titan ? FORMS[c.titan] : null;
      const state = s.char === id ? 'SEÇİLİ' : owned ? 'Seç' : this.buyArmed === id ? `Satın al? ◆ ${c.price}` : `◆ ${c.price}`;
      return `<button class="char ${s.char === id ? 'sel' : ''} ${owned ? 'owned' : can ? 'can' : 'poor'}" data-act="char" data-arg="${id}" style="--c:${hex(c.look.cloak)}">
        <div class="cardHead"><b>${c.name}</b><span>${c.title}</span></div>
        <p>${c.bio}</p>
        <p class="perk">${c.perk}</p>
        ${form ? `<p class="form" style="color:${hex(form.color)}">★ ${form.name} · ${form.height} m</p>` : '<p class="form none">Dev formu yok</p>'}
        <em>${state}</em></button>`;
    }).join('');
    const story = s.mode === 'story';
    const done = storyDone(s.story);
    const seasons = CHAPTERS.map((c, i) => {
      const state = i < s.story.chapter ? 'done' : i === s.story.chapter ? 'cur' : i <= s.storyMax ? 'open' : 'locked';
      const open = i <= s.storyMax;
      const info =
        this.jumpArmed === i
          ? 'Baştan oyna? Tekrar tıkla'
          : state === 'cur'
            ? `Bölüm ${s.story.mission + 1}/${c.missions.length}`
            : state === 'done'
              ? 'Tamamlandı'
              : state === 'open'
                ? 'Açık'
                : 'Kilitli';
      return `<button class="season ${state}" ${open ? `data-act="chapter" data-arg="${i}"` : 'disabled'}>
        <small>${c.label}</small><b>${c.title}</b><span>${info}</span></button>`;
    }).join('');
    const cur = missionAt(s.story);
    const storyBox = `
      <div class="story">
        <p class="storyLead">${
          done
            ? `Hikâye tamamlandı. ${hero} surların dışını geri aldı; istediğin sezonu yeniden oynayabilirsin.`
            : `<b>${hero}</b> olarak oyna: Öncü Birliği’nin çaylağından sur ötesine uzanan beş sezonluk hikâye. Sıradaki görev: <b>${cur?.title ?? ''}</b>`
        }<span>${missionsDone(s.story)}/${missionCount()} görev</span></p>
        <div class="seasons">${seasons}</div>
      </div>`;
    const freeBox = `<div class="story"><p class="storyLead">Hikâye yok, sıra yok: surların dışında dilediğin gibi avlan. Seviye, sınıf ve yükseltmeler iki modda ortaktır.</p></div>`;
    const startLabel = this.game.started ? 'DEVAM ET' : story ? (missionsDone(s.story) > 0 && !done ? 'HİKÂYEYE DEVAM ET' : 'HİKÂYEYE BAŞLA') : 'SURLARIN DIŞINA ÇIK';
    const controls = CONTROLS.map(([k, v]) => `<li><kbd>${k}</kbd><span>${v}</span></li>`).join('');
    this.root.innerHTML = `
      <div class="panel">
        <header>
          <h1>SUR ÖTESİ</h1>
          <p>İnsanlık üç surun ardına sığındı. Devler dışarıda. Sen de.</p>
        </header>
        <div class="modes">
          <button class="${story ? 'sel' : ''}" data-act="mode" data-arg="story">HİKÂYE MODU</button>
          <button class="${story ? '' : 'sel'}" data-act="mode" data-arg="free">SERBEST AV</button>
        </div>
        ${story ? storyBox : freeBox}
        <section class="roster">
          <h2>Karakterler <span>Av puanı: ◆ ${s.coins} · devleri öldürerek ve görev bitirerek kazanılır</span></h2>
          <div class="chars">${chars}</div>
        </section>
        <div class="cols">
          <section><h2>Sınıf <span>Seviye ${s.level}</span></h2><div class="cards">${classes}</div></section>
          <section><h2>Yükseltmeler <span>Yükseltme puanı: ${s.points}</span></h2>${upgrades}
            <h2 class="mt">Nasıl oynanır</h2>
            <ol class="how">
              <li>Kapıdan çık; atınla uzak surlara doğru yol al.</li>
              <li>Kancayla ağaçlara ve devlere tutun, hızlanıp <b>enseden</b> vur.</li>
              <li>Gaz kendiliğinden dolmaz: <b>mavi bayraklı ikmal noktalarında</b> doldur.</li>
              <li>Büyük devler seni <b>yakalayıp ağzına götürür</b>: sol tıkla kes ya da Space ile sıyrıl.</li>
              <li>Enseye <b>tek temiz kesik</b> devi devirir.</li>
              <li>Renkli ışıklı sandıklardan <b>dev iğnesi</b> topla: her renk başka bir dev. Sarı ışık <b>patlar mızrak</b>, pembe sargı, yeşil ganimet.</li>
              <li>Sur içinde <b>Levazımcı Nuran</b> av puanına eşya satar; <b>Kağan</b> ve <b>Behram</b> ödüllü sözleşme verir (<kbd>E</kbd> ile konuş).</li>
              <li>Sıkışınca <kbd>C</kbd> ile <b>billur kozaya</b> gir: devler sana dokunamaz, kırılınca çevreyi sersemletir.</li>
              <li><kbd>Q</kbd> ile <b>patlar mızrak</b> at: enseye yakın patlarsa zırhlıyı bile öldürür, gövdeye yakın patlarsa devi yere serer.</li>
              <li>Dev barı yarıyı geçince <kbd>T</kbd> ile deve dönüş; her güç bar harcar.</li>
              <li>Her dev <b>av puanı</b> düşürür; puanla yeni karakter al. ★ işaretli karakterler bar <b>dolunca iğnesiz</b> kendi devine dönüşür.</li>
            </ol>
          </section>
          <section><h2>Kontroller</h2><ul class="keys">${controls}</ul></section>
        </div>
        <footer>
          <button class="primary" data-act="start">${startLabel}</button>
          <button class="ghost" data-act="reset">${this.resetArmed ? 'Emin misin? Tekrar tıkla' : 'İlerlemeyi sıfırla'}</button>
        </footer>
      </div>`;
  }
}
