import { RAIDS, RAID_TIERS, TIERS, tierRaid, waveSize, type RaidId, type RaidTier } from '../data/raids';
import type { Game } from '../game';
import { storeSave } from '../core/save';
import { CLASSES } from '../player/classes';
import { buyUpgrade, canBuyChar, ownsChar, classUnlocked, CLASS_UNLOCK, MAX_UPGRADE, UPGRADES, type ClassId, type GameMode, type UpgradeId } from '../systems/progression';
import { CHAPTERS, missionCount } from '../data/story';
import { CHARACTERS, CHAR_IDS, type CharId } from '../data/characters';
import { FORMS, hex } from '../data/titans';
import { missionAt, missionsDone, storyDone } from '../systems/storyRules';

const CONTROLS: [string, string][] = [
  ['Fareyi kaydır', 'Bakışını çevir; nişangâh ortadaki alanda kayar, kenarını itince bakış döner'],
  ['Sağ tık (basılı)', 'Baktığın yöne koş'],
  ['Sol tık (basılı)', 'Nişana kanca at, çekil'],
  ['Sol tık', 'Dev yakınken kılıç — enseye vur'],
  ['Yakalanınca', 'Sol tık seri: kes · Space: gazla sıyrıl'],
  ['Shift', 'Koş · havada gaz itişi'],
  ['Space', 'Zıpla · kancadan fırla'],
  ['E', 'Kutu aç · ata bin/in · konuş'],
  ['F', 'Atı çağır (dev formunda: ısır)'],
  ['R', 'Sınıf yeteneği (dev formunda: buhar — çevredeki devleri haşlar)'],
  ['G (dev formunda)', 'Gard: önden gelen darbeleri karşıla · gardda sol tık basılı: seri yumruk'],
  ['V (dev formunda)', 'Tekme: iter, sersemletir, gardı kırar, evleri yıkar'],
  ['Q', 'Patlar mızrak fırlat (dev formunda: güç)'],
  ['C', 'Billur koza: 6 sn dokunulmaz ol'],
  ['I', 'Çanta: kapşonu giy/çıkar, sargı kullan'],
  ['H', 'Sargı sar (canın %60’ı)'],
  ['Tab', 'Dönüşülecek devi seç (iğne türü)'],
  ['T', 'Deve dönüş (bar yarı + iğne)'],
  ['W A S D', 'Klavyeyle hareket (isteğe bağlı)'],
  ['E (surda)', 'Sur topunun başına geç · tıkla: ateş · E: ayrıl'],
  ['M', 'Büyük harita: kaydır, yakınlaş, tıklayıp işaret koy (ok seni oraya götürür)'],
  ['Enter', 'Konuşma satırını geç'],
  ['Esc', 'Duraklat'],
];

/** Tablet ve telefonda ekran kontrolleri. */
const TOUCH_CONTROLS: [string, string][] = [
  ['Sol yarı', 'Parmağını koy ve sürükle: yürü · sonuna kadar it: koş'],
  ['Sağ yarı', 'Ekranı kaydır: yönünü ve bakışını çevir'],
  ['KANCA / KILIÇ', 'Nişangâh tutunacak yerdeyken basılı tut: kanca · dev yakınken: kılıç'],
  ['ZIPLA', 'Zıpla · kancadan fırla · attan in'],
  ['MIZRAK', 'Patlar mızrak fırlat'],
  ['Sınıf tuşu', 'Sınıf yeteneği'],
  ['AÇ / KONUŞ / BİN', 'Yanına gelince çıkar: kutu, kişi, at'],
  ['DÖNÜŞ', 'Bar yeterince dolunca çıkar: deve dönüş'],
  ['Dev formunda', 'Tuşlar formun güçlerine, ISIRIK ve ÇIK tuşlarına döner'],
  ['KOZA · SARGI · İĞNE · AT', 'Koza, sargı, iğne seçimi, atı çağır'],
  ['ÇANTA', 'Kapşonu giy/çıkar, sargı kullan (satırlara dokun)'],
  ['TOP · ATEŞ', 'Surdaki topun yanında TOP: başına geç · deve nişan al, ATEŞ · İN: ayrıl'],
  ['Harita', 'Dokun: büyük harita · sürükle, iki parmakla yakınlaş, dokunup işaret koy'],
  ['❚❚', 'Duraklat'],
  ['Konuşmalar', 'Telsiz satırına dokunarak geç · seçeneklere dokunarak seç'],
];

export class Menu {
  private readonly root: HTMLElement;
  private resetArmed = false;
  private jumpArmed = -1;
  private buyArmed: CharId | null = null;
  /** Baskın listesi açık mı (hikâye/serbest av kutusunun yerine). */
  private raidView = false;

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
    if (act === 'raid') {
      this.raidView = false;
      g.startRaid(arg as RaidId);
      return;
    }
    if (act === 'raidQuit') g.raid.abort();
    if (act === 'raidTier' && (RAID_TIERS as string[]).includes(arg)) {
      g.save.raidTier = arg as RaidTier;
      storeSave(g.save);
    }
    if (act === 'raids') this.raidView = !this.raidView;
    if (act === 'mode') {
      this.raidView = false;
      g.setMode(arg as GameMode);
    }
    if (act === 'char') {
      const id = arg as CharId;
      // Sahip olunan karakter tek tıkla seçilir; satın alma ikinci tıkla onaylanır.
      if (ownsChar(g.save, id) || this.buyArmed === id) {
        g.pickChar(id);
        this.buyArmed = null;
      } else this.buyArmed = canBuyChar(g.save, id) ? id : null;
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
      const can = canBuyChar(s, id);
      const lvlOk = s.level >= c.level;
      const form = c.titan ? FORMS[c.titan] : null;
      // Fiyat: av puanı; yüksek karakterler bir de seviye (XP) ister.
      const need = c.level > 1 ? `<span class="${lvlOk ? '' : 'short'}">Sv ${c.level}</span> · ` : '';
      const state =
        s.char === id ? 'SEÇİLİ' : owned ? 'Seç' : this.buyArmed === id ? `Satın al? ◆ ${c.price}` : `${need}<span class="${s.coins >= c.price ? '' : 'short'}">◆ ${c.price}</span>`;
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
    const g = this.game;
    // Zorluk: C kolay, B orta, A zor, S en zor. Seçilen zorluk kartlardaki dev sayısını ve ödülü değiştirir.
    const tier = s.raidTier;
    const tierRow = `<div class="tiers"><span>ZORLUK</span>${RAID_TIERS.map(
      (t) => `<button class="tier t${t} ${t === tier ? 'sel' : ''}" data-act="raidTier" data-arg="${t}"><b>${t}</b><i>${TIERS[t].name}</i></button>`,
    ).join('')}<em>${TIERS[tier].desc}</em></div>`;
    const raidCards = RAIDS.map((base, i) => {
      const r = tierRaid(base, tier);
      const best = s.raidBest[r.id];
      const won = best !== undefined;
      const live = g.raid.active && g.raid.id === r.id;
      const waves = r.kind === 'wall' ? `Tek dev · ${r.escortCount} eşlikçi dev` : `${r.waves.length} dalga · ${r.waves.reduce((n, w) => n + waveSize(w), 0)} dev`;
      return `<button class="raid ${won ? 'done' : ''} ${live ? 'live' : ''}" data-act="raid" data-arg="${r.id}">
        <small>BASKIN ${i + 1} · ${r.kind === 'wall' ? 'SUR SAVUNMASI' : 'KÖY SAVUNMASI'}${best ? ` · <b class="rank r${best}">${best}</b>` : ''}</small><b>${r.name}</b>
        <p>${r.desc}</p>
        <span>${r.place} · ${waves}</span>
        <em>${live ? `SÜRÜYOR (${g.raid.tier}) — yeniden başlat` : `${tier} ödülü: ◆ ${r.reward.coins} · ${r.reward.xp} XP${won ? ` · en iyi: ${best}` : ''}`}</em></button>`;
    }).join('');
    const raidBox = `<div class="story">
        <p class="storyLead">Devler bir köye ya da sura saldırıyor; savun. Baskını seçince oraya götürülürsün. Sağlamlık biterse ya da bölgeden çok uzaklaşırsan baskın kaybedilir.${
          g.raid.active ? ` <button class="ghost" data-act="raidQuit">Baskından çekil</button>` : ''
        }<span>${s.raids.length}/${RAIDS.length} püskürtüldü</span></p>
        ${tierRow}
        <div class="raids">${raidCards}</div>
      </div>`;
    const startLabel = this.game.started ? 'DEVAM ET' : story ? (missionsDone(s.story) > 0 && !done ? 'HİKÂYEYE DEVAM ET' : 'HİKÂYEYE BAŞLA') : 'SURLARIN DIŞINA ÇIK';
    const touch = this.game.input.touch;
    const controls = (touch ? TOUCH_CONTROLS : CONTROLS).map(([k, v]) => `<li><kbd>${k}</kbd><span>${v}</span></li>`).join('');
    this.root.innerHTML = `
      <div class="panel">
        <header>
          <h1>SUR ÖTESİ</h1>
          <p>İnsanlık üç surun ardına sığındı. Devler dışarıda. Sen de.</p>
        </header>
        <div class="modes">
          <button class="${story && !this.raidView ? 'sel' : ''}" data-act="mode" data-arg="story">HİKÂYE MODU</button>
          <button class="${story || this.raidView ? '' : 'sel'}" data-act="mode" data-arg="free">SERBEST AV</button>
          <button class="raidBtn ${this.raidView ? 'sel' : ''}" data-act="raids">BASKINLAR</button>
        </div>
        ${this.raidView ? raidBox : story ? storyBox : freeBox}
        <section class="roster">
          <h2>Karakterler <span>Av puanı: ◆ ${s.coins} · Seviye ${s.level} · güçlü karakterler hem av puanı hem seviye (XP) ister</span></h2>
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
              <li>Kulelere, değirmenlere, şapellere, karakollara ve kaleye uğra: yanındaki sancak sararır ve orası <b>doğuş noktan</b> olur, ölünce orada doğarsın.</li>
              <li>Büyük devler seni <b>yakalayıp ağzına götürür</b>: sol tıkla kes ya da Space ile sıyrıl.</li>
              <li>Enseye <b>tek temiz kesik</b> devi devirir.</li>
              <li>Devin yüzünün önündeyken <b>gözlerine</b> vur: dev bir süre <b>kör olur</b> ve sersemler, seni ancak dibindeyken sezer. Zırhlıların yüzü kapalıdır.</li>
              <li>Renkli ışıklı sandıklardan <b>dev iğnesi</b> topla: her renk başka bir dev. Sarı ışık <b>patlar mızrak</b>, pembe sargı, yeşil ganimet.</li>
              <li>Sur içinde <b>Levazımcı Nuran</b> av puanına eşya satar; <b>Kağan</b> ve <b>Behram</b> ödüllü sözleşme verir (<kbd>E</kbd> ile konuş).</li>
              <li>Koyu yeşil ışıklı sandıktan çıkan <b>Orman Kapşonu</b>nu giyersen devler seni ancak yakından fark eder (<kbd>I</kbd> ile çanta).</li>
              <li>Sıkışınca <kbd>C</kbd> ile <b>billur kozaya</b> gir: devler sana dokunamaz, kırılınca çevreyi sersemletir.</li>
              <li><kbd>Q</kbd> ile <b>patlar mızrak</b> at: enseye yakın patlarsa zırhlıyı bile öldürür, gövdeye yakın patlarsa devi yere serer.</li>
              <li>Dev barı yarıyı geçince <kbd>T</kbd> ile deve dönüş. Bar <b>hareket ettikçe</b> yanar, yerinde durursan azalmaz; her güç bar harcar, <kbd>F</kbd> ile ısırırsın.</li>
              <li><b>Zırhlı Dev</b> formundayken <kbd>Q</kbd> hücumuyla sura toslarsan <b>surda gedik açarsın</b>; gedik bir süre sonra onarılır, o arada devler de geçebilir.</li>
              <li>Devler de <b>ısırır</b>: başını geri çekip çenesini açtığını görünce yana kaç.</li>
              <li>Her dev <b>av puanı</b> düşürür; puanla yeni karakter al. ★ işaretli karakterler bar <b>dolunca iğnesiz</b> kendi devine dönüşür.</li>
            </ol>
          </section>
          <section><h2>Kontroller <span>${touch ? 'dokunmatik' : 'klavye ve fare'}</span></h2><ul class="keys">${controls}</ul></section>
        </div>
        <footer>
          <button class="primary" data-act="start">${startLabel}</button>
          <button class="ghost" data-act="reset">${this.resetArmed ? 'Emin misin? Tekrar tıkla' : 'İlerlemeyi sıfırla'}</button>
        </footer>
      </div>`;
  }
}
