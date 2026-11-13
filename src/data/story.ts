import { CFG } from './config';
import type { TitanId } from './titans';
import type { BossId, GiantKind } from '../enemies/giantTypes';

/** Hikâye metinlerinde baş kahramanın adının yerini tutar; oynanan karakterin adıyla değiştirilir. */
export const HERO = '{kahraman}';

export function withHero(text: string, name: string) {
  return text.split(HERO).join(name);
}

export type Speaker = 'aras' | 'sare' | 'behram' | 'yel' | 'anlatici';

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
  aras: { name: HERO, color: '#e8c36a' },
  sare: { name: 'Komutan Sare', color: '#e0735f' },
  behram: { name: 'Usta Behram', color: '#7fc8f0' },
  yel: { name: 'Yel', color: '#8fd18a' },
  anlatici: { name: '', color: '#cfc8b8' },
};

export type Line = [who: Speaker, text: string];

/** Görev adımları sırayla yapılır; her adımın ilerlemesi olaylarla ya da konumla ölçülür. */
export type Objective =
  /** Bir noktaya var. */
  | { kind: 'reach'; text: string; at: [number, number]; radius: number }
  /** Merkezden belirli bir uzaklığın ötesine geç (sur dışına çık). */
  | { kind: 'beyond'; text: string; r: number }
  /** Bir gaz ikmal noktasına var. */
  | { kind: 'station'; text: string }
  /** Ata bin. */
  | { kind: 'mount'; text: string }
  /** Belirli türde bir dev iğnesi bul. */
  | { kind: 'needle'; text: string; form: TitanId }
  /** Deve dönüş (form verilmişse o forma). */
  | { kind: 'transform'; text: string; form?: TitanId }
  /**
   * Dev öldür. `tag` verilmişse yalnızca görevin kendi doğurduğu devler sayılır;
   * `by: 'blade'` insan hâlinde kılıçla, `by: 'titan'` dev formunda, `form` belirli bir formda öldürmeyi ister.
   */
  | { kind: 'kill'; text: string; count: number; tag?: string; giant?: GiantKind; by?: 'blade' | 'titan'; form?: TitanId };

/** Bir adım etkinleşince doğacak devler. */
export interface SpawnGroup {
  /** Hangi adım (sıra numarası) başlayınca doğar. */
  on: number;
  tag: string;
  kinds?: GiantKind[];
  boss?: BossId;
  /** Verilmezse oyuncunun çevresinde doğar. */
  at?: [number, number];
}

export interface Mission {
  id: string;
  title: string;
  intro: Line[];
  outro?: Line[];
  objectives: Objective[];
  spawns?: SpawnGroup[];
  xp: number;
}

export interface Chapter {
  id: string;
  /** "SEZON 1" */
  label: string;
  title: string;
  tagline: string;
  /** Sezon bitince verilen ek XP. */
  bonus: number;
  missions: Mission[];
}

const W = CFG.world.walls;
const IN = W[0].r;
const MID = W[1].r;
const OUT = W[2].r;

/** Sur ötesindeki son hedef: simyacıların çağrı kulesi. */
export const BEACON: [number, number] = [0, OUT + 300];

const rep = (kind: GiantKind, n: number): GiantKind[] => Array.from({ length: n }, () => kind);

export const CHAPTERS: Chapter[] = [
  {
    id: 's1',
    label: 'SEZON 1',
    title: 'KAPI',
    tagline: 'Otuz yıldır kapıdan çıkanların yarısı geri dönmedi.',
    bonus: 120,
    missions: [
      {
        id: 's1m1',
        title: 'İlk Çıkış',
        intro: [
          ['anlatici', 'Taç Suru. İnsanlığın elinde kalan son halka.'],
          ['sare', `${HERO}. Öncü Birliği’ne bugün katıldın, bugün de kapıdan çıkıyorsun.`],
          ['sare', 'Atın seni bekliyor. Yanına git, bin ve kapıdan çık.'],
          ['aras', 'Otuz yıldır içeride bekledik. Yeter.'],
        ],
        objectives: [
          { kind: 'mount', text: 'Atına bin (F ile çağır, E ile bin)' },
          { kind: 'beyond', text: 'Taç Suru kapısından dışarı çık', r: IN + 25 },
        ],
        xp: 40,
      },
      {
        id: 's1m2',
        title: 'Mavi Bayrak',
        intro: [
          ['behram', 'Beni duyuyor musun evlat? Ben Behram. O sırtındaki teçhizatı ben yaptım.'],
          ['behram', 'Gaz kendiliğinden dolmaz. Mavi bayraklı ikmal noktalarını eski seferler bıraktı; yerlerini öğren.'],
        ],
        objectives: [{ kind: 'station', text: 'Mavi bayraklı ikmal noktasına git' }],
        outro: [['behram', 'İşte böyle. Gazın biterse bıçağın da bir işe yaramaz, unutma.']],
        xp: 40,
      },
      {
        id: 's1m3',
        title: 'İlk Kan',
        intro: [
          ['yel', 'Ben Yel, bu hattın öncüsüyüm. Seni izleyeceğim, çaylak.'],
          ['yel', 'Kancayı ağaca ya da devin kendisine at, hızlan, arkasına geç. Enseye tek temiz kesik yeter.'],
          ['yel', 'Büyükleri seni eliyle yakalamaya çalışır. Yakalanırsan kes ya da gazla sıyrıl.'],
        ],
        objectives: [{ kind: 'kill', text: 'Kılıçla ensesinden dev öldür', count: 2, by: 'blade' }],
        outro: [
          ['yel', 'Fena değil. İlk seferinde çoğumuz ağaca çarpıyoruz.'],
          ['aras', 'Düşüyorlar. Demek ki düşebiliyorlar.'],
        ],
        xp: 70,
      },
      {
        id: 's1m4',
        title: 'Simyacının Sandığı',
        intro: [
          ['behram', 'Yolun kenarında turuncu bir ışık sütunu görüyor musun? Surları kuran simyacılardan kalma bir sandık.'],
          ['behram', 'İçinde ne varsa bana getirme. Kendin kullan.'],
        ],
        objectives: [{ kind: 'needle', text: 'Turuncu ışıklı sandıktan Kor İğnesi’ni al', form: 'ofke' }],
        outro: [
          ['aras', 'Bir iğne. İçinde kor gibi bir şey yanıyor.'],
          ['behram', 'Simyacılar devlerle bıçakla savaşmadı evlat. Onlar gibi bir bedene girdiler. O iğne, o bedenin anahtarı.'],
        ],
        xp: 60,
      },
      {
        id: 's1m5',
        title: 'Öfke',
        intro: [
          ['behram', 'İğne tek başına yetmez; içindeki öfke yetecek kadar kabarmalı. Dev öldürdükçe kabarır.'],
          ['behram', 'Bar yarıyı geçince dönüşebilirsin. Unutma: bar bitince beden seni geri bırakır. Simyacılar bunu bilerek böyle yaptı.'],
        ],
        objectives: [
          { kind: 'transform', text: 'Dev barını yarıya getir ve deve dönüş (T)' },
          { kind: 'kill', text: 'Dev formunda dev öldür', count: 3, by: 'titan' },
        ],
        outro: [
          ['yel', 'O... o sen miydin?'],
          ['aras', 'Sanırım evet. Her şey çok küçük görünüyordu.'],
          ['sare', 'Bunu gören herkes sussun. Şimdilik bu, Birliğin sırrı.'],
        ],
        xp: 120,
      },
      {
        id: 's1m6',
        title: 'Kapıdaki Sürü',
        intro: [
          ['sare', `${HERO}! Dönüşümün ışığını görmüş olmalılar; kapıya doğru bir sürü geliyor.`],
          ['sare', 'Kapı düşerse içeride kılıç tutabilecek kimse kalmaz. Hemen dön.'],
        ],
        objectives: [
          { kind: 'reach', text: 'Taç Suru kapısının önüne dön', at: [0, IN + 90], radius: 55 },
          { kind: 'kill', text: 'Kapıya yürüyen sürüyü durdur', count: 6, tag: 's1-suru' },
        ],
        spawns: [{ on: 1, tag: 's1-suru', kinds: rep('normal', 6), at: [0, IN + 170] }],
        outro: [
          ['sare', 'Kapı ayakta. Otuz yıldır ilk kez saldırıyı surun dışında karşıladık.'],
          ['aras', 'Dışarıda iki sur daha var. İkisi de bizimdi.'],
          ['sare', 'Öyleyse geri alacağız. Önce Demir Sur.'],
        ],
        xp: 150,
      },
    ],
  },
  {
    id: 's2',
    label: 'SEZON 2',
    title: 'DEMİR SUR',
    tagline: 'Yol uzun. Yolun sonunda bir kapı, kapıda da onu tutan bir şey var.',
    bonus: 200,
    missions: [
      {
        id: 's2m1',
        title: 'Uzun Yol',
        intro: [
          ['sare', 'Demir Sur buradan sekiz yüz adım ötede. Yürüyerek varamazsın; atını kullan.'],
          ['yel', 'Yol boyunca ikmal noktaları var. Gazını doldurmadan sıradakine geçme.'],
        ],
        objectives: [{ kind: 'reach', text: 'Yolu izle: yarı yoldaki eski karakola var', at: [0, 620], radius: 60 }],
        xp: 60,
      },
      {
        id: 's2m2',
        title: 'Koşucular',
        intro: [
          ['yel', 'Dikkat! Bunlar sıradan değil. Koşuyorlar.'],
          ['yel', 'Attan hızlılar. Kaçamazsın; kancayla üstlerine çık.'],
        ],
        objectives: [{ kind: 'kill', text: 'Koşucuları öldür', count: 3, tag: 's2-kosucu' }],
        spawns: [{ on: 0, tag: 's2-kosucu', kinds: rep('runner', 3) }],
        xp: 110,
      },
      {
        id: 's2m3',
        title: 'Gökten Düşenler',
        intro: [
          ['behram', 'Eski kayıtlarda sıçrayan bir türden söz ediliyor. Gölgesi üstüne düşerse yerinde durma.'],
        ],
        objectives: [{ kind: 'kill', text: 'Sıçrayanları öldür', count: 2, tag: 's2-sicrayan' }],
        spawns: [{ on: 0, tag: 's2-sicrayan', kinds: rep('leaper', 2) }],
        xp: 110,
      },
      {
        id: 's2m4',
        title: 'Zırh',
        intro: [
          ['yel', 'Şunun ensesine bak. Kabuk bağlamış.'],
          ['behram', 'Zırhlı ayaktayken ensesi kesilmez. Önce bacaklarına iki kesik at; yere düşünce ensesi açılır.'],
          ['behram', 'Ya da deve dönüş; Taş Yumruk zırhı kırar.'],
        ],
        objectives: [{ kind: 'kill', text: 'Zırhlı devi devir ve öldür', count: 1, tag: 's2-zirhli' }],
        spawns: [{ on: 0, tag: 's2-zirhli', kinds: ['armored'] }],
        xp: 130,
      },
      {
        id: 's2m5',
        title: 'Kapı Kıran',
        intro: [
          ['sare', 'Demir Sur’un kapısı otuz yıl önce içeriden değil, dışarıdan kırıldı. Kıran şey hâlâ orada.'],
          ['aras', 'Otuz metre. Ensesini buradan görüyorum.'],
          ['sare', 'Zırhını düşürmeden ensesine ulaşamazsın. Elinde ne varsa kullan.'],
        ],
        objectives: [
          { kind: 'reach', text: 'Demir Sur kapısına yaklaş', at: [0, MID - 250], radius: 70 },
          { kind: 'kill', text: 'Kapı Kıran’ı yok et — bacaklarını kes, ensesine üç kez vur', count: 1, tag: 'gate' },
        ],
        spawns: [{ on: 0, tag: 'gate', boss: 'gate' }],
        outro: [
          ['sare', 'Demir Sur yeniden bizim. Bu cümleyi kuracağımı hiç düşünmemiştim.'],
          ['behram', 'Evlat, kapının dibinde başka sandıklar da olmalı. Simyacılar tek bir iğne yapmadı.'],
        ],
        xp: 200,
      },
    ],
  },
  {
    id: 's3',
    label: 'SEZON 3',
    title: 'DÖRT MİRAS',
    tagline: 'Simyacılar dört iğne bıraktı. Her biri başka bir beden.',
    bonus: 260,
    missions: [
      {
        id: 's3m1',
        title: 'Fırtına',
        intro: [
          ['behram', 'Defterlerde dört iğne geçiyor: Kor, Fırtına, Kaya ve Doruk. İlkini buldun.'],
          ['behram', 'Fırtına İğnesi hafif ve hızlı bir beden verir. Açık mavi ışığı ara.'],
        ],
        objectives: [
          { kind: 'needle', text: 'Fırtına İğnesi’ni bul', form: 'firtina' },
          { kind: 'transform', text: 'Tab ile Fırtına’yı seç ve dönüş (T)', form: 'firtina' },
          { kind: 'kill', text: 'Fırtına Devi olarak dev öldür', count: 3, form: 'firtina' },
        ],
        outro: [['aras', 'Bu beden koşmak istiyor. Durduğumda bile.']],
        xp: 160,
      },
      {
        id: 's3m2',
        title: 'Kaya',
        intro: [
          ['behram', 'Sıradaki Kaya İğnesi. Ağırdır, yavaştır; ama zırhı zırhla karşılar.'],
          ['yel', 'Tam zamanı. İki zırhlı bu tarafa yürüyor.'],
        ],
        objectives: [
          { kind: 'needle', text: 'Kaya İğnesi’ni bul', form: 'kaya' },
          { kind: 'transform', text: 'Tab ile Kaya’yı seç ve dönüş (T)', form: 'kaya' },
          { kind: 'kill', text: 'Kaya Devi olarak zırhlıları ez', count: 2, tag: 's3-zirhli', form: 'kaya' },
        ],
        spawns: [{ on: 2, tag: 's3-zirhli', kinds: rep('armored', 2) }],
        outro: [['yel', 'Bıçakla yarım saat uğraştığım şeyi iki yumrukta bitirdin. Kıskandım.']],
        xp: 180,
      },
      {
        id: 's3m3',
        title: 'Kuşatma',
        intro: [
          ['sare', 'Demir Sur’un ötesinde bir karakol kuruyoruz. Kurduğumuz yere doğru bir sürü toplanıyor.'],
          ['sare', 'Bu kez karışık geliyorlar. Hangi bedeni seçeceğine sen karar ver.'],
        ],
        objectives: [
          { kind: 'beyond', text: 'Demir Sur’un ötesine geç', r: MID + 60 },
          { kind: 'reach', text: 'Karakol yerine var', at: [0, MID + 210], radius: 70 },
          { kind: 'kill', text: 'Karakolu kuşatan sürüyü dağıt', count: 8, tag: 's3-kusatma' },
        ],
        spawns: [
          { on: 2, tag: 's3-kusatma', kinds: [...rep('normal', 4), ...rep('runner', 2), ...rep('leaper', 2)], at: [0, MID + 290] },
        ],
        outro: [
          ['sare', 'Karakol ayakta. Artık iki surumuz var.'],
          ['behram', `${HERO}, defterlerde beni rahatsız eden bir satır buldum. “Çan çatlarsa, hepsi içeri yürür.”`],
          ['aras', 'Hangi çan?'],
          ['behram', 'Bilmiyorum. Ama Kalkan Suru’nun ötesinde olduğu yazıyor.'],
        ],
        xp: 220,
      },
    ],
  },
  {
    id: 's4',
    label: 'SEZON 4',
    title: 'KALKAN SURU',
    tagline: 'Son sur. Onun ötesini gören kimse kalmadı.',
    bonus: 320,
    missions: [
      {
        id: 's4m1',
        title: 'Doruk',
        intro: [
          ['behram', 'Dördüncü iğne: Doruk. Defterde yanına tek kelime yazılmış: “Dikkat.”'],
          ['behram', 'Mor ışığı ara. Demir Sur’un ötesinde olmalı.'],
        ],
        objectives: [
          { kind: 'needle', text: 'Doruk İğnesi’ni bul', form: 'zirve' },
          { kind: 'transform', text: 'Tab ile Zirve’yi seç ve dönüş (T)', form: 'zirve' },
          { kind: 'kill', text: 'Zirve Devi olarak dev öldür', count: 4, form: 'zirve' },
        ],
        outro: [
          ['aras', 'Ağaçlar dizimde kalıyordu. Geri dönmek istemedim.'],
          ['behram', 'İşte “dikkat” bu demek. Bar bitmeden çıkamazsan, hiç çıkamazsın.'],
        ],
        xp: 220,
      },
      {
        id: 's4m2',
        title: 'Son Düzlük',
        intro: [
          ['yel', 'Kalkan Suru ufukta. Aradaki düzlükte saklanacak ağaç bile az.'],
          ['yel', 'Gazını doldur. Burada hata yapanı at da kurtaramaz.'],
        ],
        objectives: [
          { kind: 'reach', text: 'Düzlüğü geç', at: [0, OUT - 330], radius: 70 },
          { kind: 'kill', text: 'Düzlüğü tutan seçkin devleri öldür', count: 6, tag: 's4-duzluk' },
        ],
        spawns: [{ on: 1, tag: 's4-duzluk', kinds: [...rep('armored', 2), ...rep('runner', 2), ...rep('leaper', 2)] }],
        xp: 240,
      },
      {
        id: 's4m3',
        title: 'Sur Bekçisi',
        intro: [
          ['sare', 'Kalkan Suru’nun kapısında bir şey duruyor. Otuz yıldır kıpırdamamış.'],
          ['aras', 'Kapıyı kırmamış. Kapının önünde bekliyor. Neyi bekliyor?'],
          ['sare', 'Sorma. Devir.'],
        ],
        objectives: [
          { kind: 'reach', text: 'Kalkan Suru kapısına yaklaş', at: [0, OUT - 240], radius: 70 },
          { kind: 'kill', text: 'Sur Bekçisi’ni yok et', count: 1, tag: 'bekci' },
        ],
        spawns: [{ on: 0, tag: 'bekci', boss: 'bekci', at: [0, OUT - 90] }],
        outro: [
          ['sare', 'Üç sur. Üçü de yeniden bizim.'],
          ['behram', 'Evlat... rüzgâr dışarıdan esince bir ses geliyor. Duyuyor musun? Uzun, kırık bir ses.'],
          ['aras', 'Duyuyorum. Çan.'],
        ],
        xp: 300,
      },
    ],
  },
  {
    id: 's5',
    label: 'FİNAL SEZONU',
    title: 'SUR ÖTESİ',
    tagline: 'Devler surlara yürümüyordu. Bir çağrıya yürüyordu.',
    bonus: 500,
    missions: [
      {
        id: 's5m1',
        title: 'Eşik',
        intro: [
          ['sare', 'Buradan sonrası için emir veremem. Haritamız burada bitiyor.'],
          ['aras', 'Öyleyse haritayı ben çizerim.'],
        ],
        objectives: [{ kind: 'beyond', text: 'Kalkan Suru’nun ötesine çık', r: OUT + 60 }],
        xp: 150,
      },
      {
        id: 's5m2',
        title: 'Çatlak Çan',
        intro: [
          ['behram', 'Buldum. Simyacılar surlardan önce bir kule dikmiş: Çağrı Kulesi. Sesi devleri kendine çekermiş, şehirden uzağa.'],
          ['behram', 'Otuz yıl önce çatlamış. O günden beri ses dışarı değil, içeri, surlara doğru yayılıyor.'],
          ['aras', 'Yani otuz yıldır onları biz çağırıyoruz.'],
        ],
        objectives: [
          { kind: 'reach', text: 'Çağrı Kulesi’ne var', at: BEACON, radius: 80 },
          { kind: 'kill', text: 'Kuleyi saran sürüyü dev formunda dağıt', count: 8, tag: 's5-kule', by: 'titan' },
        ],
        spawns: [
          { on: 1, tag: 's5-kule', kinds: [...rep('normal', 3), ...rep('armored', 2), ...rep('runner', 2), 'leaper'], at: BEACON },
        ],
        outro: [
          ['yel', 'Kulenin dibinde bir şey kıpırdıyor. Tepe sandığım şey... tepe değil.'],
        ],
        xp: 320,
      },
      {
        id: 's5m3',
        title: 'Kadim Dev',
        intro: [
          ['behram', 'Defterin son sayfası. “İlk iğneyi kendime vurdum. Barı ben koymadım; geri dönemedim.”'],
          ['behram', 'O bir dev değil evlat. İlk simyacı. Kuleyi o çatlattı.'],
          ['aras', 'Otuz yıldır geri dönmeyi bekliyor. Onu ben döndüreceğim.'],
        ],
        objectives: [{ kind: 'kill', text: 'Kadim Dev’i durdur — zırhını kır, ensesine vur', count: 1, tag: 'kadim' }],
        spawns: [{ on: 0, tag: 'kadim', boss: 'kadim', at: [BEACON[0], BEACON[1] + 60] }],
        outro: [
          ['anlatici', 'Kadim Dev devrildiğinde kule son kez çaldı. Sonra sustu.'],
          ['behram', 'Ses kesildi. Otuz yıldır ilk kez.'],
          ['sare', `Kapıları açın. ${HERO} dönüyor.`],
          ['aras', 'Hayır. Kapıları açık bırakın. Artık dışarısı da bizim.'],
        ],
        xp: 600,
      },
    ],
  },
];

export const STORY_DONE = 'Hikâye tamamlandı — sur ötesinde özgürce avlan';

export function missionCount() {
  return CHAPTERS.reduce((n, c) => n + c.missions.length, 0);
}
