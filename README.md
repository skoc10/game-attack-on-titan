# Sur Ötesi

Tarayıcıda çalışan, üçüncü şahıs 3D dev avı oyunu. İnsanlık iç içe üç surun ardına sığınmış; sen kanca teçhizatınla surların dışına çıkıp devleri ensesinden avlıyorsun. Özgün bir dünya: tüm isimler, karakterler ve modeller bu proje için yapıldı. Modeller ve dokular kodla üretilir, harici asset yok: karakterler çizgi film gölgelendirmeli ve konturlu, eklemli (dirsek/diz) anime tarzı figürlerdir; ortamda güneş gölgeleri, taş ve cephe dokuları, çatılı evler, çimen, bulutlu gökyüzü ve ufukta dağlar bulunur.

## Çalıştırma

```bash
npm install
```

```bash
npm run dev
```

Açılan adresi (varsayılan `http://localhost:5173`) tarayıcıda aç. Diğer komutlar: `npm run build` (tip kontrolü + derleme), `npm test` (birim testleri).

## Oynanış

1. **Taç Suru**'nun kapısından çık. Surlar birbirinden çok uzak (yarıçap 300 m / 1100 m / 2000 m); **atınla** yol al.
2. **Kanca Teçhizatı** ile ağaçlara, binalara, surlara ve devlere tutun.
3. Devler yalnızca **enseden** ölür ve keskin kılıçla **tek temiz kesik yeter**: dev sendeler, devrilir, yere çarpar ve buharlaşır. Bacağına vurursan yere düşer; yerdeki deve de tek ense kesiği yeter. Zırhlı devin ensesi yalnızca yerdeyken kesilir (bacağına iki kesik); bölüm sonu devi üç ense kesiği ister. Kılıç körelmişse kesmez.
4. **Gaz kendiliğinden dolmaz.** Mavi bayraklı **ikmal noktalarının** yanında durunca dolar (şehirde, sur kapılarında ve köylerde var); gaz kutuları da doldurur.
5. Renkli ışıklı **kutulardan dev iğnesi** çıkar. Dört tür iğne var, her biri başka bir deve dönüştürür; ışığın rengi türü gösterir. Gaz kutuları beyaz, kılıç kutuları gri ışıklıdır.
6. Dev öldürdükçe **dev barı** dolar. Bar **en az yarıya** gelmişse ve iğnen varsa `T` ile dönüşürsün; birden fazla türün varsa `Tab` ile seçersin. Dev formunda bar güç kaynağındır: zamanla azalır, her güç kendi bedeli kadar bar harcar, bar bitince insana dönersin. Erken çıkarsan (`T`) artan bar sende kalır.

| Dev | İğne (ışık) | Özelliği | Sol tık | `Q` | `E` | `Space` |
|---|---|---|---|---|---|---|
| **Öfke Devi** 15 m | Kor (turuncu) | Dengeli | Yumruk −3 | Kükreme −15: sersemletir | Taş Yumruk −25: zırh kırar | Ezme −10 |
| **Fırtına Devi** 11 m | Rüzgâr (mavi) | Çok hızlı, yüksek sıçrar; barı çabuk yakar, darbeye dayanıksız | Pençe −2 | Atılım −10: ileri fırlar | Girdap −16: çevresini biçer | Dalış −8 |
| **Kaya Devi** 17 m | Taş (yeşil) | Yavaş, darbelere çok dayanıklı; her vuruşu zırh kırar | Ağır Yumruk −5 | Koç Hücumu −18: yolundakini ezer | Deprem −22: geniş alanı sarsar | Ezme −10 |
| **Zirve Devi** 26 m | Doruk (mor) | En büyüğü; çok yavaş, zıplayamaz, ağaçları ezip geçer | Süpürme −6 | Kaya Fırlat −14: nişana kaya atar | Sarsıntı −25: çok geniş alanı sersemletir | Tepinme −10 |

7. Büyük devler (7 m ve üzeri) seni **eliyle yakalayıp ağzına götürür**. Ağza varmadan kurtulma barını doldur: sol tıkla seri basıp parmakları kes, `Space` ile gaz patlaması yap (12 gaz) ya da barın ve iğnen yetiyorsa `T` ile elinin içinde deve dönüş. Dev ne kadar büyükse kurtulmak o kadar zor; kurtulamazsan ağır bir ısırık yersin.
8. Demir Sur kapısındaki **Kapı Kıran**'ı yen, Kalkan Suru'nu aş.

Karakter fareyle yönlendirilir. Tarayıcı izin verirse fare kilitlenir ve fareyi hareket ettirmek bakışı çevirir (nişan ekranın ortasıdır). Fare kilitlenemezse imleç serbest kalır: imleci ekranın sağına ya da soluna götürmek kamerayı o yöne döndürür, nişan imlecin olduğu yerdir.

| Girdi | İnsan | Dev formu |
|---|---|---|
| Fareyi hareket ettir | Yönünü ve bakışını çevir | Aynı |
| Sağ tık | Basılı tut: baktığın yöne koş, bırakınca dur. Kısa tık: nişan alınan yere git | Aynı |
| Sol tık | Nişana kanca at (basılı tut: çekil); dev yakınken kılıç savur; yakalanınca parmakları kes | Formun vuruşu |
| Fare tekerleği | Sağa/sola bak (`Shift` ile yukarı/aşağı) | Aynı |
| `Shift` | Koş · havada gaz itişi | Koş |
| `Space` | Zıpla · kancadan fırla · yakalanınca gaz patlaması | Sıçra, inişte ez |
| `E` | Kutu aç · ata bin/in | Formun ikinci gücü |
| `Q` | — | Formun birinci gücü |
| `F` | Atı çağır | — |
| `R` | Sınıf yeteneği | — |
| `Tab` | Dönüşülecek devi seç | — |
| `T` | Seçili deve dönüş | İnsan formuna dön |
| `Esc` / `P` | Duraklat, menü | |

İsteğe bağlı: `W A S D` ile de yürünür, ok tuşları ya da orta tuşla sürükleme de kamerayı çevirir.

**Sınıflar:** Nefer (dengeli), As (hız, Sv 2), Muhafız (güç, Sv 4), Taktisyen (destek, Sv 6).
**Devler:** sıradan, Koşucu, Sıçrayan, Zırhlı (önce düşürülmeli) ve bölüm sonu Kapı Kıran.
İlerleme (seviye, yükseltmeler, sınıf, görev) tarayıcıda `localStorage`'a kaydedilir.

## Hikâye modu

Menüden **Hikâye Modu** ya da **Serbest Av** seçilir; seviye, sınıf ve yükseltmeler iki modda ortaktır.

Hikâye modunda Öncü Birliği'nin çaylağını oynarsın: başlangıçta **Aras**, başka bir karakter seçtiysen o karakter (konuşmalarda adı geçer). Hikâye bu oyuna özgüdür ve beş sezona bölünmüş 20 görevden oluşur:

| Sezon | Başlık | Konu |
| --- | --- | --- |
| 1 | Kapı | İlk çıkış, ikmal, ilk av, ilk iğne ve ilk dönüşüm; kapıya yürüyen sürü |
| 2 | Demir Sur | Koşucular, sıçrayanlar, zırhlılar ve Kapı Kıran |
| 3 | Dört Miras | Fırtına ve Kaya iğneleri; Demir Sur ötesindeki karakolun kuşatması |
| 4 | Kalkan Suru | Doruk iğnesi, son düzlük ve Sur Bekçisi |
| Final | Sur Ötesi | Çağrı Kulesi ve Kadim Dev |

- Görev adımları sol üstte sırayla listelenir; hedef haritada sarı elmasla, dünyada sarı ışık sütunuyla gösterilir.
- Komutan Sare, Usta Behram ve Yel telsizden konuşur; satırlar kendiliğinden ilerler, `Enter` ile geçilir. Oyun konuşma sırasında durmaz.
- Görev devleri görevle birlikte doğar; ölürsen ya da uzaklaşırsan görev kaldığı adımdan sürer.
- Bir adım iğne istiyorsa ve elinde yoksa en yakın sandık yeniden doldurulup işaretlenir.
- Ulaştığın sezonlar menüden yeniden oynanabilir (ilerleme o sezonun başına döner).

## Av puanı ve karakterler

Her dev, XP'sinin yanında **av puanı** (◆) düşürür (XP'nin yarısı kadar); hikâye görevleri ve sezon sonları da av puanı verir. Av puanıyla menüden karakter alınır. Karakterler bu oyuna özgüdür; her biri sınıfın değerlerini kendi çarpanlarıyla değiştirir ve kendi görünümüne sahiptir. Sınıf (yetenek) ve karakter birbirinden bağımsız seçilir.

| Karakter | Unvan | ◆ | Özellik | Kendi dev formu |
| --- | --- | --- | --- | --- |
| Aras | Çaylak | 0 | Dev barı %10 hızlı dolar | — |
| Defne | Hat Öncüsü | 150 | Hız +%8, kanca çekişi +%12 | — |
| Bora | Kalkan | 300 | Can +%35 | — |
| İlkim | Tüpçü | 450 | Gaz +%40 | — |
| Kuzey | Kılıç Ustası | 650 | Kılıç erişimi +%15, dayanımı +%50 | — |
| Zeren | Gölge | 900 | Hız +%5 | Gölge Devi (9 m): en hızlı form, seri atılım ve sersemleten sis |
| Tuğrul | Demirci | 1300 | Can +%20 | Örs Devi (19 m): zırh kıran çekiç, güçlenme ve alan darbesi |
| Ece | Gök Gözcüsü | 1700 | Bar %20 hızlı dolar | Şimşek Devi (13 m): kısa aralıklı yıldırım, geniş sersemletme |
| Mete | Mancınıkçı | 2200 | Gaz +%15 | Mancınık Devi (21 m): seri kaya atışı, zırh kıran yer darbesi |
| Aybüke | Son Simyacı | 3200 | Bar %15 hızlı dolar, formda %15 yavaş biter | Şafak Devi (22 m): büyük, hızlı, barı en yavaş yakan form |

Kendi dev formu olan karakterler **iğne harcamadan** dönüşür, ama bunun için dev barının **tamamen dolması** gerekir (iğneyle dönüşüm yarım barda olur). İğne de taşıyorsan `Tab` ile iğne formları ve kendi formun arasında geçersin; HUD'da kendi formun ★ ile gösterilir.

## Efektler ve sesler

- **Kesip geçme:** öldürücü ense kesiğinde çapraz iki kılıç izi parlar, kan gidiş yönüne fışkırır ve zaman kısa süre yavaşlar. Ne kadar hızlı geçersen iz o kadar büyür; yüksek hızda yol boyunca beyaz bir iz ve kısa bir parlama eklenir. Dev formundaki öldürmelerde formun renginde tek büyük darbe izi çıkar.
- **Yerde ölüm:** yere düşmüş dev ensesinden vurulunca gövdesi kasılıp yaylanır, kolları bacakları çırpınır, sonra yığılır; ensesinden buhar sütunu fışkırır.
- **Dev sesleri:** her devin kendi sesi vardır ve boyu büyüdükçe kalınlaşır. Çoğu iniltiyle ya da hırıltıyla seslenir; yaklaşık üçte biri tuhaf sesler çıkarır (kıkırtı, gurultu, üç notalı mırıltı). Seni fark edince, saldırmadan önce, bacağı kesilince ve ölürken ayrı sesler duyulur; büyük devlerin adımları yaklaştıkça işitilir. Sesler uzaklığa göre kısılır ve geldikleri yandan duyulur.
- **Müzik ve ortam:** devler kovalamaya başlayınca savaş davulu girer, yoğunluk arttıkça üst davul ve bas eklenir; bölüm sonu devinde ve yakalandığında en üst düzeye çıkar. Rüzgâr sesi hızınla birlikte yükselir. Art arda öldürmelerde zafer akoru her seferinde yarım ses tizleşir.
- Tüm sesler tarayıcıda sentezlenir; ses dosyası yoktur.

## Geliştirme

- `src/data/config.ts` — denge sayıları; `src/data/titans.ts` — dev formları (boy, hız, güçler, bar bedelleri).
- `src/enemies/humanoid.ts` — eklemli karakter modeli ve kontur kurucu (`Rig`); `src/core/textures.ts` — kodla çizilen dokular.
- `src/world/` arazi, surlar, orman, harabeler, kutular, ikmal noktaları, dev üretici · `src/player/` oyuncu, kanca, at, dev formu · `src/enemies/` devler · `src/systems/` saf oyun mantığı (testli) · `src/ui/` HUD, menü, mini harita.
- `?debug` parametresi: `1` barı doldur, `2` her türden iğne ver, `3` Demir Sur'a ışınlan, `4` dev üret, `5` XP ver; `window.__game` konsoldan erişilir.
