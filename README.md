# Sur Ötesi

Tarayıcıda çalışan, üçüncü şahıs 3D dev avı oyunu. İnsanlık iç içe üç surun ardına sığınmış; sen kanca teçhizatınla surların dışına çıkıp devleri ensesinden avlıyorsun. Özgün bir dünya: tüm isimler, karakterler ve modeller bu proje için yapıldı. Modeller ve dokular kodla üretilir, harici asset yok: karakterler çizgi film gölgelendirmeli ve konturlu, eklemli (dirsek/diz) anime tarzı figürlerdir; ortamda güneş gölgeleri, taş ve cephe dokuları, çatılı evler, çimen, bulutlu gökyüzü ve ufukta dağlar bulunur.

**Tarayıcıda oyna:** <https://skoc10.github.io/game-attack-on-titan/>

## Çalıştırma

```bash
npm install
```

```bash
npm run dev
```

Açılan adresi (varsayılan `http://localhost:5173`) tarayıcıda aç. Diğer komutlar: `npm run build` (tip kontrolü + derleme), `npm test` (birim testleri).

`main` dalına giden her değişiklik [`.github/workflows/pages.yml`](.github/workflows/pages.yml) ile derlenip GitHub Pages'te yayınlanır.

## Oynanış

1. **Taç Suru**'nun kapısından çık. Surlar birbirinden çok uzak (yarıçap 300 m / 1600 m / 3000 m); **atınla** yol al. Haritanın düzeni aşağıda, [Dünya haritası](#dünya-haritası) bölümünde.
2. **Kanca Teçhizatı** ile ağaçlara, binalara, surlara ve devlere tutun.
3. Devler yalnızca **enseden** ölür ve keskin kılıçla **tek temiz kesik yeter**: dev sendeler, devrilir, yere çarpar ve buharlaşır. Bacağına vurursan yere düşer; yerdeki deve de tek ense kesiği yeter. Zırhlı devin ensesi yalnızca yerdeyken kesilir (bacağına iki kesik); bölüm sonu devi üç ense kesiği ister. Kılıç körelmişse kesmez.
4. **Gaz kendiliğinden dolmaz.** Mavi bayraklı **ikmal noktalarının** yanında durunca dolar (şehirde, sur kapılarında, her kapı kasabasında ve köylerde var); gaz kutuları da doldurur.
5. Renkli ışıklı **kutulardan dev iğnesi** çıkar. Dört tür iğne var, her biri başka bir deve dönüştürür; ışığın rengi türü gösterir. Gaz kutuları beyaz, kılıç kutuları gri ışıklıdır.
6. Dev öldürdükçe **dev barı** dolar. Bar **en az yarıya** gelmişse ve iğnen varsa `T` ile dönüşürsün; birden fazla türün varsa `Tab` ile seçersin. Dev formunda bar güç kaynağındır: **yalnızca hareket ederken** azalır (yerinde durursan dev dinlenir, bar yanmaz), her güç kendi bedeli kadar bar harcar, bar bitince insana dönersin. Erken çıkarsan (`T`) artan bar sende kalır.

| Dev | İğne (ışık) | Özelliği | Sol tık | `Q` | `E` | `Space` |
|---|---|---|---|---|---|---|
| **Öfke Devi** 15 m | Kor (turuncu) | Dengeli | Yumruk −1,5 | Kükreme −15: sersemletir | Taş Yumruk −25: zırh kırar | Ezme −10 |
| **Fırtına Devi** 11 m | Rüzgâr (mavi) | Çok hızlı, yüksek sıçrar; barı çabuk yakar, darbeye dayanıksız | Pençe −1 | Atılım −10: ileri fırlar | Girdap −16: çevresini biçer | Dalış −8 |
| **Kaya Devi** 17 m | Taş (yeşil) | Yavaş, darbelere çok dayanıklı; her vuruşu zırh kırar | Ağır Yumruk −2,5 | Koç Hücumu −18: yolundakini ezer | Deprem −22: geniş alanı sarsar | Ezme −10 |
| **Zirve Devi** 26 m | Doruk (mor) | En büyüğü; çok yavaş, zıplayamaz, ağaçları ezip geçer | Süpürme −3 | Kaya Fırlat −14: nişana kaya atar | Sarsıntı −25: çok geniş alanı sersemletir | Tepinme −10 |

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
| `F` | Atı çağır | Isırık: önündeki devi dişle |
| `R` | Sınıf yeteneği | — |
| `I` | Çanta | Çanta |
| `H` | Sargı sar | — |
| `Tab` | Dönüşülecek devi seç | — |
| `T` | Seçili deve dönüş | İnsan formuna dön |
| `M` | Haritayı genişlet / daralt | Haritayı genişlet / daralt |
| `Esc` / `P` | Duraklat, menü | |

İsteğe bağlı: `W A S D` ile de yürünür, ok tuşları ya da orta tuşla sürükleme de kamerayı çevirir.

**Sınıflar:** Nefer (dengeli), As (hız, Sv 2), Muhafız (güç, Sv 4), Taktisyen (destek, Sv 6).
**Devler:** sıradan, Koşucu, Sıçrayan, Zırhlı (önce düşürülmeli) ve bölüm sonu Kapı Kıran.
İlerleme (seviye, yükseltmeler, sınıf, görev) tarayıcıda `localStorage`'a kaydedilir.

## Dünya haritası

İç içe üç halka sur var; oyun ortadaki şehirde başlar:

| Sur | Yarıçap | İçindeki bölge | Kapı kasabaları (+Z, +X, −Z, −X) |
| --- | --- | --- | --- |
| Taç Suru | 300 m | Şehir — güvenli bölge | Mühürhane, Çanlıkapı, Kandilli, Sancaktepe |
| Demir Sur | 1600 m | Demir Ova | Örsköy, Karakule, Değirmenli, Taşhan |
| Kalkan Suru | 3000 m | Kalkan Ormanları | Sınırboyu, Kuzgunkapı, Yelkovan, Sonkale |
| — | 3000 m ötesi | Sur Ötesi | — |

- Her surun dört yönünde (ön, arka, sağ, sol) birer **kapı**, her kapının önünde de surdan dışarı taşan, yarım daire biçimli, kendi suruyla çevrili bir **kapı kasabası** vardır. Kasabaya surun iç kapısından girilir, dış kapısından ovaya çıkılır. Her kasabanın caddesinde bir ikmal noktası bulunur.
- Taç Suru'nun dört kasabası da şehir gibi **güvenli bölgedir**: devler giremez, orada can ve kılıç dolar. Dış surların kasabalarına devler kapıdan girebilir.
- Dört **ana yol** kapılardan geçip şehirde kesişir ve Kalkan Suru'nun ötesine kadar uzanır.
- Surların arasındaki ovalara **köyler** dağılmıştır: Demir Ova'da 12, Kalkan Ormanları'nda 18, Sur Ötesi'nde 10 (oradakiler çoğunlukla yıkık). Her köyde bir ikmal noktası ve bir sandık vardır.
- Dünyanın kenarı yaklaşık 4100 m'dedir. Mini harita `M` ile (dokunmatikte haritaya dokunarak) yakın ve geniş görünüm arasında geçer; geniş görünümde surlar, kasabalar, yollar ve köyler (kahverengi kareler) görünür.

## Sur topları

Surların tepesinde, yürüme yolunun dış kenarında aralıklarla **toplar** durur (halka surlarda yaklaşık 110 m, kasaba surlarında 70 m arayla; kapıların önü boş). Mini haritanın yakın görünümünde gri noktalarla görünürler. Sura kancayla çık, topun yanına gel ve `E` ile (dokunmatikte **TOP**) başına geç.

- **Nişan:** İmleci (fare kilitliyken ya da dokunmatikte ekranın ortasındaki nişangâhı) bir deve doğrult. Top deve **kilitlenir**: devin üstünde kırmızı bir işaret çıkar, namlu açısını kendi ayarlar ve devin gidişini hesaba katar. Güllenin düşeceği yer halkayla, yolu kesikli çizgiyle gösterilir. Dev yoksa top imlecin gösterdiği yere atar.
- **Ateş:** Tıkla (dokunmatikte **ATEŞ**). Gülle kilitli deve doğru yönünü düzeltir. Yaklaşık 10 m yarıçaplı patlamanın içinde kalan **sıradan devler ölür** (zırhlılar dahil). Bölüm sonu devi ölmez: ensesine yakın isabet ense kesiği sayılır, gövdeye isabet onu sendeletir. Top 1,6 saniyede yeniden dolar.
- **Menzil:** yaklaşık 550 m. Top dışa bakan yönünden en çok 83° döner; daha yandaki hedef için yandaki topa geç.
- **Ayrılmak:** `E` ya da `Space` (dokunmatikte **İN**).

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

## Patlar mızrak, sandıklar ve yeni devler

**Patlar mızrak** teçhizata takılı patlayıcı bir kargıdır; `Q` ile nişan alınan yere fırlatılır (en çok 6 tane taşınır, 2 taneyle başlanır).

- Patlama **enseye yakınsa** devi öldürür; zırhı da deler, bölüm sonu devlerinde iki kesik sayılır.
- **Gövdeye yakınsa** devi yere serer (bölüm sonu devlerini sendeletir).
- Patlamaya 6,5 metreden yakınsan sen de hasar alırsın; fırlatırken hafif bir geri tepme olur.
- Mızrak **sarı ışıklı sandıklardan** çıkar; köylerdeki sandıkların yarıya yakını mızrak sandığıdır.

**Sandık renkleri:** her içeriğin kendi ışığı vardır. Sandığa yaklaşınca ne olduğu yazıyla da görünür.

| Işık | İçerik |
| --- | --- |
| Turuncu, açık mavi, yeşil, mor, pembe-mor, koyu mavi | Dev iğneleri: Kor, Rüzgâr, Taş, Doruk, Işık, Kırağı |
| Sarı | Patlar mızrak (+2) |
| Beyaz | Gaz |
| Gri | Kılıç |
| Gül pembesi | Sargı (çantaya girer) |
| Koyu yeşil | Orman Kapşonu |
| Zümrüt yeşili | Ganimet (60 av puanı) |

**Yeni iğne formları:** Işın Devi (16 m; ağzından çıkan ışın 120 metrelik hattaki her şeyi deler, zırh kırar) ve Buz Devi (14 m, buz zırhlı; geniş alanı 7 saniye dondurur, koçbaşı hücumu zırh kırar).

**Yeni düşman devler:**

| Tür | Davranış |
| --- | --- |
| Sürüngen | Dört ayak üstünde, çok hızlı koşar. Ensesi alçaktadır; yerden bile vurulabilir. |
| Taşçı | Menzile girince durur ve kaya fırlatır. Kayanın düşeceği yer kırmızı halkayla önceden görünür. |
| Çığırtkan | Seni görünce çığlık atar: yakındaki devler üstüne yürür, çevrede üç yeni dev belirir. Önce onu sustur. |

**Öldürme serisi:** 9 saniye içinde gelen her yeni öldürme seriyi uzatır; seri uzadıkça av puanı çarpanı artar (her öldürmede +0,25, en çok ×3).

**Görünüm:** insan ve dev modellerine yüz ayrıntıları (göz kapağı, kirpik, burun, dudak, dişler), el parmakları, eklemler, giysi dikişleri ve çizme eklendi. Devlerin göğüs, karın ve sırt kasları belirgin; dört ayrı yüz tipi var. Gölgelendirme altı basamaklı.

## Sur içindeki kişiler, sözleşmeler ve koza

**Sur içindeki kişiler** kapıya giden yolun kenarında, tezgâhlarının başında durur; yanlarına gidip `E` ile konuşulur. Pencere açıkken rakam tuşları seçim yapar, `E` ya da `Esc` kapatır. Haritada satıcı yeşil, görev verenler sarı kareyle görünür.

| Kişi | Ne yapar |
| --- | --- |
| Levazımcı Nuran | Av puanına eşya satar: patlar mızrak ×2 (45), sargı (25), kılıç takımı (15), gaz (10), Kor İğnesi (120), rastgele mühürlü iğne (160) |
| Avcıbaşı Kağan | Av sözleşmeleri: belirli sayıda ya da türde dev, dalış kesiği, kesip geçme, öldürme serisi |
| Usta Behram | Teçhizat denemeleri: mızrakla öldürme, sandık açma, dev formunda av |

- Her görev verenden aynı anda bir sözleşme alınır; etkin sözleşmeler sol üstte ilerlemeleriyle listelenir.
- Sözleşme tamamlanınca ödül (av puanı, mızrak ya da iğne) kendiliğinden verilir; geri dönmek gerekmez. Sıradaki sözleşme için kişiyle yeniden konuşulur, liste bitince baştan döner.

**Billur koza** (`C`): kendini 6 saniyeliğine sert bir kabuğa kapatırsın. İçindeyken hasar almaz, yakalanmaz, devler seni görmez ve yavaşça iyileşirsin; kıpırdayamazsın. Devin elindeyken kurarsan parmaklarını açtırır. Süre dolunca ya da `C` ile erken kırınca kabuk parçalanır ve 16 metre içindeki devleri sersemletir. Sonra 25 saniye yeniden kurulamaz.

**Vuruş biçimleri:** ekranda kısa bir yazıyla bildirilir ve kendi efekti vardır.

| Biçim | Ne zaman | Efekt |
| --- | --- | --- |
| Kesip geçtin | Yatayda hızla geçerken ense kesiği | Çapraz iki iz (X), yol boyunca beyaz iz |
| Dalış kesiği | Ensenin üstünden hızla alçalırken | Dikey ve yatay iz (artı), aşağı fışkıran kan, yerde toz halkası |
| Son darbe | Yerdeki devin ensesine | Kasılma, buhar sütunu |
| Bacak kesiği | Ayak bileğine | Yere paralel iz, yana saçılan kan ve toz; dev düşerse "Diz çöktü" |

**Yıkılış:** ayakta ölen dev önce sendeler, dizlerinin üstüne çöker, sonra gövdesi öne devrilir; yerde seker, kolları ve bacakları dağınık kalır, hafifçe yana yatar. Önden yumruk yiyen dev sırtüstü düşer. Dev formundan çıktığında terk ettiğin gövde de aynı biçimde yıkılıp buharlaşır.

**Karakter hareketleri:** koşarken dirsekler kırılır, gövde öne eğilir ve her adımda omuzdan döner; dururken nefes alıp ağırlık aktarır; havada dönüşlere yatar, inişte dizleri çöker; baş nişan alınan yere bakar.

## Çanta ve Orman Kapşonu

`I` ile **çanta** açılır. Ekranın sağında durur ve açıkken oyun sürer, yürümeye devam edebilirsin. İçinde kullanılabilen eşyalar rakamla seçilir; altında mızrak, gaz, kılıç, iğneler ve av puanı görünür. Çanta kayda yazılır.

| Tuş | Eşya | Ne yapar |
| --- | --- | --- |
| `1` | **Orman Kapşonu** | Giy / çıkar. Giyiliyken devler seni %55 daha yakından fark eder (sıradan bir dev 130 m yerine 58 m'den), kovalayan dev de seni daha çabuk kaybeder. Bir deve kılıç savurursan ya da mızrak atarsan 4 saniye görünür olursun. Dev formunda işe yaramaz. |
| `2` ya da `H` | **Sargı** | Canın %60'ını doldurur. En çok 3 tane taşınır; `H` çanta kapalıyken de çalışır. |

- **Kapşon** koyu yeşil ışıklı **Kapşon sandığından** çıkar. İlki kapının ötesindeki ilk ormanın kenarındadır; başka sandıklardan da nadiren çıkar. İkinci bir kapşon bulursan av puanına çevrilir. Giyince pelerinin rengi koyu yeşile döner ve başına kapşon gelir; armasızdır.
- **Sargılar** artık hemen sarılmaz, çantaya girer. Sargı sandıkları ve Nuran'ın tezgâhındaki sargı çantaya ekler; çanta doluysa sargı hemen sarılır.
- HUD'da yetenek satırında sargı sayısı ve kapşon durumu (GİZLİ ya da GÖRÜNÜRSÜN) yazar.

## Isırık, dinlenen dev ve görsel yenilemeler

**Dev formunda bar:** bar artık zamanla değil **hareketle** yanar. Yerinde duran dev dinlenir: nefes alır, ensesinden buhar sızar, HUD'da "DİNLENİYOR" yazar ve bar azalmaz. Yürümek, koşmak, sıçramak ve atılmak barı eskisi gibi yakar; darbe almak da barı düşürür. Yumrukların bedeli yarıya indi (Öfke Devi'nde 3 yerine 1,5).

**Isırık (dev formunda `F`):** önündeki en yakın deve atılıp dişlerini geçirirsin. Tek hedefe yumruğun 2,6 katı, zırh delen hasar verir; 4 bar harcar, 2,5 saniyede bir kullanılır. Hedef ölürse 8 bar geri kazanırsın.

**Devlerin ısırığı:** düşman devler artık yalnızca vurup yakalamaz, ısırır da. Başını geri çekip çenesini sonuna kadar açar, sonra gövdesiyle ava atılır; çenenin açıldığını görünce yana kaç. Isırık yumruktan %40 sert vurur. Sürüngenler hep ısırır; diğer devler yerdeki avı üçte bir, dev formundaki oyuncuyu beşte iki olasılıkla ısırır. Beline göre yukarıdaysan ısıramaz.

**Karakter görünümü:**

- Pelerin tek parça değil, omuzdan menteşeli üç parça: hızlandıkça kalkar, dalga omuzdan uca doğru ilerler, dönüşlerde yana savrulur. Astarı koyu, eteğinde açık renk bir şerit var; göğüste pirinç tokayla tutturulur.
- Teçhizat: kalçalarda kınlar, bel hizasında kanca fırlatıcısı, uyluk kayışları, dizlikler, eldivenler, kemer tokası; kılıçların keskin ağzı parlar.
- İki yeni saç biçimi: at kuyruğu (Defne, Ece; koşarken savrulur) ve küt kesim (İlkim). Kaşlar saç renginde, yanaklarda hafif pembelik var.
- Tüm figürlerde (insanlar, devler, dev formları) **kenar ışığı**: siluetin kenarında ince bir parlama figürü arka plandan ayırır.
- Dev formları ısırırken ve dinlenirken başını ve çenesini oynatır.

**Efektler:**

- **Şok dalgaları:** ezme, tepinme, kükreme, patlama, kaya çarpması, kozanın kırılması, dönüşüm ve devrilen gövdelerin yere çarpışı zeminde genişleyip sönen bir halka bırakır.
- **Parçacıklar:** her parçacığın kendi boyutu var. Buhar ve toz yayıldıkça büyür, kıvılcım ve kan damlaları küçülerek söner.
- **Darbe parlaması:** vurulan dev bir an parlar.
- **Kılıç izi:** her savuruş havada soluk bir hilal bırakır; ağır darbede iz altın rengidir. Dev formunun yumruğu hedefe değince formun renginde bir darbe izi çıkar.
- **Isırık:** üstten ve alttan kapanan iki diş izi, kıvılcım ve kan; kendine özgü bir çene sesi.

## Tablette oynamak

Oyun dokunmatik ekranı kendiliğinden tanır: tablette ya da telefonda açınca ekran kontrolleri çıkar. Masaüstünde dokunmatik ekrana dokununca da açılırlar, fare hareket edince gizlenirler. Cihazı **yatay** tut; dik tutarken oyun durur ve "yatay çevir" uyarısı çıkar. Başlayınca tarayıcı izin veriyorsa tam ekrana geçilir.

| Dokunuş | Ne yapar |
| --- | --- |
| Ekranın sol tarafı | Parmağını koyduğun yerde sanal çubuk açılır: sürükleyerek yürü, sonuna kadar itince koşarsın (atlıyken dörtnala). |
| Ekranın sağ tarafı | Kaydırarak yönünü ve bakışını çevir. Nişangâh ekranın ortasındadır. |
| **KANCA / KILIÇ** (büyük tuş) | Nişangâh tutunacak bir yerdeyse "KANCA" yazar: basılı tuttukça çekilirsin, bırakınca kanca kopar. Değilse kılıç savurur. Yakalanınca "KES" olur, seri bas. |
| **ZIPLA** | Zıpla; kancadayken "FIRLA", atlıyken "İN", yakalanınca "GAZ" olur. |
| **MIZRAK**, sınıf yeteneği, **KOZA** | Patlar mızrak, sınıf yeteneği, billur koza. Bekleme süresi tuşun üstünde sayılır. |
| **AÇ / KONUŞ / BİN / İN** | Yalnızca bir kutunun, kişinin ya da atın yanındayken çıkar. |
| **DÖNÜŞ**, **İĞNE**, **SARGI**, **AT** | Dönüşme, iğne seçme, sargı sarma, atı çağırma; işe yaradıklarında görünürler. |
| Dev formunda | Tuşlar formun güçlerine (yumruk, iki güç, ezme), **ISIRIK** ve **ÇIK** tuşlarına döner; bar yetmeyen güç soluk görünür. |
| **ÇANTA**, **❚❚** | Sağ üstte: çantayı aç, duraklat. |
| Harita | Sağ üstteki haritaya dokununca geniş görünüme geçer, tekrar dokununca yakına döner. |
| Pencereler | Telsiz satırına dokununca sonraki satıra geçilir; Nuran'ın tezgâhında ve çantada satırlara dokunarak seçilir, **KAPAT** ile kapanır. |

Dokunmatikte görev ve bildirim yazılarındaki klavye tuşları ekran tuşlarının adlarıyla yazılır ("Q ile fırlat" yerine "MIZRAK tuşuyla fırlat"). Tablette çözünürlük ve gölge kalitesi biraz düşürülür; oyun uygulama değiştirilince ya da ekran kilitlenince duraklar. Dokunmatik düzeni masaüstünde denemek için adrese `?touch` ekle.

## Efektler ve sesler

- **Kesip geçme:** öldürücü ense kesiğinde çapraz iki kılıç izi parlar, kan gidiş yönüne fışkırır ve zaman kısa süre yavaşlar. Ne kadar hızlı geçersen iz o kadar büyür; yüksek hızda yol boyunca beyaz bir iz ve kısa bir parlama eklenir. Dev formundaki öldürmelerde formun renginde tek büyük darbe izi çıkar.
- **Yerde ölüm:** yere düşmüş dev ensesinden vurulunca gövdesi kasılıp yaylanır, kolları bacakları çırpınır, sonra yığılır; ensesinden buhar sütunu fışkırır.
- **Dev sesleri:** her devin kendi sesi vardır ve boyu büyüdükçe kalınlaşır. Çoğu iniltiyle ya da hırıltıyla seslenir; yaklaşık üçte biri tuhaf sesler çıkarır (kıkırtı, gurultu, üç notalı mırıltı). Seni fark edince, saldırmadan önce, bacağı kesilince ve ölürken ayrı sesler duyulur; büyük devlerin adımları yaklaştıkça işitilir. Sesler uzaklığa göre kısılır ve geldikleri yandan duyulur.
- **Müzik ve ortam:** devler kovalamaya başlayınca savaş davulu girer, yoğunluk arttıkça üst davul ve bas eklenir; bölüm sonu devinde ve yakalandığında en üst düzeye çıkar. Rüzgâr sesi hızınla birlikte yükselir. Art arda öldürmelerde zafer akoru her seferinde yarım ses tizleşir.
- Tüm sesler tarayıcıda sentezlenir; ses dosyası yoktur.

## Geliştirme

- `src/data/config.ts` — denge sayıları; `src/data/titans.ts` — dev formları (boy, hız, güçler, bar bedelleri).
- `src/enemies/humanoid.ts` — eklemli karakter modeli ve kontur kurucu (`Rig`); `src/core/textures.ts` — kodla çizilen dokular.
- `src/world/` arazi, surlar, orman, harabeler, kutular, ikmal noktaları, dev üretici; dünyanın yerleşimi (sur yayları, kapılar, kasabalar, köyler, çarpışma) saf ve testli olarak `src/world/layout.ts` içinde · `src/player/` oyuncu, kanca, at, dev formu · `src/enemies/` devler · `src/systems/` saf oyun mantığı (testli) · `src/ui/` HUD, menü, mini harita, dokunmatik kontroller (`touch.ts`; düzen kuralları `src/systems/touchLayout.ts`).
- `?debug` parametresi: `1` barı doldur, `2` her türden iğne ver, `3` Demir Sur'a ışınlan, `4` dev üret, `5` XP ver; `window.__game` konsoldan erişilir.
