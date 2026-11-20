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
   - **Göz kesiği:** devin yüzünün önündeyken gözlerine kılıç savurursan gözlerini kesersin. Dev 9 saniye **kör** kalır (gözleri kızarır, buhar tüter) ve 1,6 saniye sersemleyip ellerini yüzüne kapatır; elindeki av kurtulur. Körken seni ancak 12 m'den (artı boyunun üçte biri) yakındayken sezer, el yordamıyla sendeleyerek yürür, savurduğu darbelerin çoğu boşa gider. Kör devin önünden de enseye uzanabilirsin. Zırhlıların yüzü kapalıdır, dönüşümcüler ve bölüm sonu devleri yarı süre kör kalır.
4. **Gaz kendiliğinden dolmaz.** Mavi bayraklı **ikmal noktalarının** yanında durunca dolar (şehirde, sur kapılarında, her kapı kasabasında ve köylerde var); gaz kutuları da doldurur.
5. Renkli ışıklı **kutulardan dev iğnesi** çıkar. Dört tür iğne var, her biri başka bir deve dönüştürür; ışığın rengi türü gösterir. Gaz kutuları beyaz, kılıç kutuları gri ışıklıdır.
6. Dev öldürdükçe **dev barı** dolar. Bar **en az yarıya** gelmişse ve iğnen varsa `T` ile dönüşürsün; birden fazla türün varsa `Tab` ile seçersin. Dev formunda bar güç kaynağındır: **yalnızca hareket ederken** azalır (yerinde durursan dev dinlenir, bar yanmaz), her güç kendi bedeli kadar bar harcar, bar bitince insana dönersin. Erken çıkarsan (`T`) artan bar sende kalır.

| Dev | İğne (ışık) | Özelliği | Sol tık | `Q` | `E` | `Space` |
|---|---|---|---|---|---|---|
| **Öfke Devi** 15 m | Kor (turuncu) | Dengeli | Yumruk −1,5 | Kükreme −15: sersemletir | Taş Yumruk −25: zırh kırar | Ezme −10 |
| **Fırtına Devi** 11 m | Rüzgâr (mavi) | Çok hızlı, yüksek sıçrar; barı çabuk yakar, darbeye dayanıksız | Pençe −1 | Atılım −10: ileri fırlar | Girdap −16: çevresini biçer | Dalış −8 |
| **Kaya Devi** 17 m | Taş (yeşil) | Yavaş, darbelere çok dayanıklı; her vuruşu zırh kırar | Ağır Yumruk −2,5 | Koç Hücumu −18: yolundakini ezer | Deprem −22: geniş alanı sarsar | Ezme −10 |
| **Zirve Devi** 26 m | Doruk (mor) | En büyüğü; çok yavaş, zıplayamaz, ağaçları ezip geçer | Süpürme −3 | Kaya Fırlat −14: nişana kaya atar | Sarsıntı −25: çok geniş alanı sersemletir | Tepinme −10 |
| **Haykıran Dev** 15 m | Haykırış (deniz yeşili) | Uzun saçlı, sırım gibi kaslı, çevik dövüşçü | Yumruk −1,5 | Sertleşme −22: yumruk taşlaşır, zırh kırar | Kükreme −5 (60 sn'de bir): 80 m içini sersemletir, **dev barını sonuna kadar doldurur**, 450 m içindeki devler sesini duyup gelir | Ezme −9 |

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
| `R` | Sınıf yeteneği | Buhar: çevrendeki devleri haşla |
| `G` | — | Gard (basılı tut): önden gelen darbeleri karşıla; gardda sol tık basılı tutulursa yumruklar seri çıkar |
| `V` | — | Tekme: devi iter, sersemletir, gardını kırar |
| `I` | Çanta | Çanta |
| `H` | Sargı sar | — |
| `Tab` | Dönüşülecek devi seç | — |
| `T` | Seçili deve dönüş | İnsan formuna dön |
| `M` | Büyük harita: kaydır, yakınlaş, tıklayıp işaret koy | Aynı |
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

## Büyük harita ve işaret

**Büyük harita (`M`, dokunmatikte küçük haritaya dokun):** tüm dünya tam ekranda açılır, oyun bu sırada durur. Sürükleyerek (ya da `W A S D` / ok tuşlarıyla) kaydırılır, tekerlekle, `+`/`-` ile ya da iki parmakla yakınlaştırılır. Surlar, kapılar, kasabalar, köyler, yollar, gaz ikmal noktaları, yakındaki devler, atın, görev hedefi ve sürmekte olan baskın görünür. `Bana dön` haritayı sana ortalar.

**İşaret:** haritada bir yere tıkla (dokun), oraya mavi bir iğne düşer; senden işarete kesikli bir çizgi ve uzaklık çıkar. Oyunda o noktanın üstünde dönen mavi bir ok ve ince bir ışık sütunu durur (uzaklaştıkça büyür, ufukta da seçilir). Küçük haritanın altında işaretin yönünü gösteren ok ve uzaklık yazar; küçük haritada da mavi iğne görünür. İşarete varınca kendiliğinden kalkar. Sağ tık, işaretin üstüne tıklamak ya da `İşareti kaldır` onu siler; başka bir yere tıklamak taşır.

## Baskınlar

Menüde (oyunun başında ya da `Esc` ile) **BASKINLAR** düğmesi üç baskını listeler. Birini seçince savunacağın yere götürülürsün; atın da yanına gelir. Baskın sürerken ekranın üstünde adı, aşaması ve savunulan yerin **sağlamlığı** görünür. Haritada ve ışık sütununda hedef baskın yeridir, olağan devler bu sırada doğmaz. Ölürsen baskın yerinde yeniden doğarsın. Savunulan yerden 760 m'den fazla uzaklaşırsan 10 saniye içinde dönmezsen baskın kaybedilir; menüden **Baskından çekil** de denebilir.

| Baskın | Yer | Akış | Ödül |
|---|---|---|---|
| **Değirmen Baskını** | Demir Ova'da bir köy | 3 dalga: 7 → 9 → 12 dev (koşucular, çığlıkçılar; son dalgada üç iri dev) | ◆ 450 · 400 XP |
| **Kuzgun Ormanı Baskını** | Kalkan Ormanları'nda bir köy | 3 dalga: 9 → 12 → 14 dev (zırhlılar, sıçrayanlar, taşçılar); son dalgada bir Öfke dönüşümcüsü | ◆ 800 · 700 XP |
| **Sur Yıkan** | Kalkan Suru | 64 m'lik tek bir yıkıcı; 22 sn'de bir beşer eşlikçi gelir | ◆ 1400 · 1200 XP |

**Köy savunması:** devler köyle aynı sur bölgesinde, köyden 200–280 m uzakta doğar ve köye yürür. Varınca iki kolunu başının üstünde birleştirip evleri yumruklar: çatılardan toz ve tahta parçaları savrulur, köyün sağlamlığı düşer (iri devler daha çok yıkar). Sağlamlık her %12 düştüğünde bir ev alev alır. Yakınlarındaysan sana saldırırlar, uzaklaşınca köye dönerler. Dalga temizlenince birkaç saniye nefes alırsın; üçüncü dalga da düşerse baskın püskürtülür.

**Sur savunması:** Sur Yıkan surdan uzundur, gövdesinden buhar tüter. Surun dışından ağır adımlarla gelir ve suru yumruklarıyla döver: her darbede taşlar kopup düşer, surun yüzünde çatlaklar açılır, sağlamlık %4,5 azalır. Ensesi açıktır ama **beş temiz kesik** ister. Bacaklarına dört kesik onu yere serer; o sırada suru dövemez. Surun üstündeki **toplar** (`E`) ona kilitlenir, enseye yakın isabet iki kesik sayılır. Sağlamlık biterse sur yıkılır: dev bir toz bulutu, düşen taşlar ve yarık.

Kazanınca av puanı, XP ve dev barına +40 gelir; püskürtülen baskınlar menüde ✓ ile işaretlenir ve yeniden oynanabilir.

## Büyük dünya ve dev ağaçlar ormanı

Dünya 12,4 km'ye büyüdü: Sur Ötesi artık Kalkan Suru'nun 3 km dışına uzanır, daha çok köy, ağaç ve sandık var. Dört ana yol, güneyde ormanın ortasına dek uzanır. Ufuktaki dağlar dünyanın her yerinden aynı uzaklıkta görünür.

**Dev Ağaçlar Ormanı:** dünyanın güney ucunda, 900 m yarıçaplı bir orman. Yaklaşık 470 dev ağacın gövdesi 90–140 m boyunda ve 11–17 m kalınlığında. Kök payandaları, dışa açılan kalın dalları ve iri yaprak kümeleri var. Gövdelere ve dallara kanca atılır, gövdelerin arası atla geçilecek kadar geniştir. Ortasından orman yolu geçer. Orman tabanı koyu ve yosunludur. Girişte, ortada ve iki yanda birer gaz ikmal noktası var. Haritada koyu yeşil bir daire olarak görünür.

**Ağaçların üstü:** dev ağaçların dallarında ve yaprak kümelerinin üstünde durabilirsin. Kancayla çık, yaprak kümesinin tepesine ya da ağacın tepesindeki taca (90–140 m) in. Dalların üst yüzünde yürünür; kenardan yürürsen düşersin.

**Avcı Dev:** ormana girince derinlikten biri seni fark eder.
- **Doğuşu ve görünüşü:** yıldırım düşer, buharın içinden 22 m'lik bir dişi dev yükselir. Gövdesi derisizdir, kasları dışarıdadır: koyu kızıl kas lifleri, belirgin kas kütleleri (omuz, pazı, ön kol, uyluk, baldır, karın, sırt) ve aralarında açık renkli kirişler. Yüzü ve elleri ten rengidir, koyu kısa at kuyruğu vardır, gözleri yeşil yanar.
- **Kovalaması:** ormanın her yerinden seni görür ve öne eğilip kolları geride koşar. Yayanken kaçamazsın. Attayken dörtnala neredeyse yetişir: aradaki mesafe saniyede ancak bir metre açılır.
- **Saldırıları:** **Av Atılımı** ile ileri fırlayıp çarpar, **Kök Sarsıntısı** ile yeri döver, tekme atar.
- **Öldürmek:** ensesine üç temiz kesik gerekir. Bacaklarına üç kesik onu yere serer. Ağaçlara kanca atıp tepesine çıkmak en iyi yol.
- **Ödülü ve yeniden doğuşu:** öldürünce +800 puan ve dolu dev barı. Beş dakika sonra yeniden doğar. Ormandan çok uzaklaşırsan peşini bırakır.

## Çoban Dev

Kalkan Suru'nun dışında (orman dışında) dolaşırken bir süre sonra 300–420 m uzakta, beş devlik sürüsüyle birlikte belirir.

- **Görünüşü:** 24 m'lik, uzun kollu bir dev. Omuzlarını, sırtını, göğsünü, kollarını ve uyluklarını sarkık, iki tonlu kalın bir kürk örter. Başının arkasında yele, çenesinde uzun bir sakal var; başının iki yanından geriye ve aşağı kıvrılan koç boynuzları çıkar.
- **Dev kaya:** 45–280 m'deki avına yerinde durup kaya atar. Önce çömelip yerden kocaman bir kaya kaldırır, başının üstüne çıkarır, geriye gerilip fırlatır. Kaya yüksek bir yayla ve dönerek uçar; düşeceği yer kırmızı bir halkayla görünür. Düştüğü yerde geniş bir alanı ezer, toz bulutu kaldırır, etrafa taş saçar.
- **Parça yağmuru:** kayayı göğsünün önünde iki eliyle sıkar; kolları titrer, avucundan toz dökülür. Sonra kaya ezilir ve 26 parça senin çevrene, her biri kendi yayıyla yağar. Tek parça az vurur ama yerinde durursan birkaçı birden isabet eder: yana koş.
- **Sürüyü yönetmek:** başını geriye atıp kollarını iki yana açarak kükrer. 320 m içindeki devler 22 saniye onun buyruğuna girer; başlarının üstünde kızıl kıvılcımlar çıkar. Buyruktaki dev %30 hızlı koşar, kapşonu ve uzaklığı umursamadan sana gelir, kolay vazgeçmez. 26–34 saniyede bir yeniden kükrer.
- **Öldürmek:** zırhsızdır; bacaklarına dört kesik onu yere serer, ensesine üç temiz kesik gerekir. Öldürünce dev barın dolar. Sürüsü sıradan devler gibi dağılır. 7 dakika sonra yeniden doğar.

**Duman ve toz:** duman parçacıkları artık düzensiz kenarlı yumuşak bulutlar. Kameranın dibine gelip ekranı kaplayacak kadar büyüyen bir parçacık söner, boyutu da sınırlıdır.

## Demir Koç ve surdaki gedik

**Demir Koç:** sur ötesinde (Kalkan Suru'nun dışında) dolaşan 19 m'lik zırhlı bir dev.
- **Doğuşu:** oyuncu Demir Sur'un dışına çıkınca bir süre sonra, oyuncunun yönünde bir yerde belirir.
- **Görünüşü:** baştan aşağı metal plakalarla kaplıdır:
  - Gövde: göğüs ve sırt plakaları, bölümlü karın bantları, boyunluk ve kalça plakası.
  - Kollar ve bacaklar: iki katlı omuzluklar, pazı ve önkol zırhı, dizlik, baldırlık ve ayak zırhı.
  - Baş: tepesi sırtlı miğfer ve yüzü kapatan siper.
  - Plakalar ortamı yansıtan parlak metaldir, kenarları pirinç süslüdür. Göz yarıkları ve plaka araları kor rengi parlar.
- **Toslayışı:** oyuncu 700 m yakınındayken bir süre sonra surdan 260 m geri çekilip koşu yolu alır. Sonra kollarını yüzünün önünde çaprazlayıp başını eğer ve saniyede 44 m hızla Kalkan Suru'na toslar. Yolundakini savurur; önünden çekil.
- **Gedik:** sura çarptığı yerde 34 m'lik bir gedik açılır. Taşlar savrulur, toz bulutu yükselir, gediğin iki yanına moloz yığılır, oradaki toplar yıkılır. Gediğin hizasında sur ne engeldir ne kalkan: devler de sen de geçebilirsin, üstü yürünmez. Gedik kapılardan ve kasabalardan uzakta açılır.
- **İçeri dolanlar:** gediğin dışında dokuz dev (sıradan, koşucu, zırhlı, sıçrayan, toslayan) belirir. Önce gediğin ortasından geçer, sonra surun içine dağılırlar. Demir Koç da gedikten içeri girip surun içinde dolaşır.
- **Öldürmek:** zırhlıdır, ensesi ancak yere düşünce kesilir. Bacaklarına dört kesik, patlar mızrak ya da sur topu onu yere serer; yerdeyken ensesine üç temiz kesik gerekir.
- **Onarım:** Demir Koç düşünce gedik 45 saniye sonra onarılır, toplar yerine gelir. Kendisi 8 dakika sonra yeniden doğar. Büyük haritada gedik kırmızı bir işaretle görünür.

### Oyuncunun Demir Koç formu surları yıkar

Demir Koç formundayken `Q` (**Sur Delen**) hücumuyla herhangi bir halka sura toslarsan orada 26 m'lik bir gedik açılır; gövden gedikten geçip koşusunu sürdürür. Kapı kasabalarının hizasında ve zaten gedik olan yerde açılmaz. Gedik 90 saniye sonra onarılır; o arada devler de geçebilir. Büyük haritada kırmızıyla görünür.

## Sur içi ve sur ötesi yapılar

Özgün yapılar ovalara dağılmıştır. Hepsinin üstünde durulur, kanca atılır; büyük haritada işaretlidir.

- **Gözcü kuleleri:** 29 taş kule, tepeleri dişli ve sancaklıdır. Sur ötesindekilerin çoğu yıkıktır.
- **Yel değirmenleri:** köylerin yanında, kanatları döner. Sur ötesindekiler çoğunlukla yıkıktır.
- **Çan kuleli şapeller:** şehirde iki tane, sur içindeki köylerin yanında ayrıca var.
- **Ahşap karakollar:** yedi tane, Kalkan Suru'nun ötesinde ve Demir–Kalkan arasında. Kazık çitlidir, köşelerinde gözetleme kuleleri, içinde kışla, çadırlar ve erzak bulunur.
- **Eski Kale:** Dev Ağaçlar Ormanı yolunun kenarında yıkık bir kale. Burcu ve kuleleri durur, perde surları yer yer gediklidir.
- **Su Kemeri:** Taç ile Demir Sur arasındaki ovada kemerli, uzun bir köprü. Altından geçilir, üstünde yürünür.
- **Sur asansörleri:** her surun her kapısının iç yanında ahşap iskele, vinç ve yük kafesi. Tepesi sur hizasındadır.
- **Talim alanları:** Taç Suru kasabalarının dışında çitli alanlar. İçlerinde ensesi kırmızı işaretli ahşap dev kuklaları vardır.

### Doğuş noktaları

Her yapının yanında gri bir sancak durur. Yapıya yaklaşınca (kale 70 m, karakol 45 m, diğerleri 26–32 m) sancak sararır ve orası **doğuş noktan** olur. Ölünce en son uğradığın yapının yanında doğarsın; baskın sürerken baskın yerinde doğarsın. Uğradığın yapılar kaydedilir ve büyük haritada sarı sancakla gösterilir, seçili olan **DOĞUŞ** yazısıyla işaretlenir.

## Ses ve görüntü

- **Rüzgâr:** alçak bir uğultu ve ıslıklı bir esinti sürekli çalar, esinti dalga dalga sertleşir. Ormanın içinde rüzgâr gürleşir; iki yandan yaprak hışırtısı, sert esintide gıcırdayan gövdeler duyulur. Sakin anlarda kuşlar öter.
- **Yankı:** iki kanalda ayrı, erken yansımalı ve tizleri sönümlenen bir açık hava yankısı.
- **Savaş müziği:** davul ve basın üstüne her ölçüde yaylı bir akor çalar.
- **Ağaçlar ve otlar** rüzgârda sallanır; sallanış rüzgâr sesiyle aynı esintiyi izler.
- **Renk:** ton eşlemeden sonra hafif keskinleştirme, yumuşak kontrast eğrisi ve sıcak–serin renk dengesi uygulanır.

## Sınır Ormanı

Haritanın dış kenarını baştan sona sık bir orman sarar. Kuşak dünyanın sınırından yaklaşık 480 m içeride seyrek başlar, sınıra yaklaştıkça sıklaşır. Sınırda uzun çamlar ve geniş yapraklılar gövde gövdeye durur, dışarısı görünmez. Orman yalnızca yakındayken çizilir.

## Yeni dev türleri

| Tür | Boy | Özelliği | Nerede |
|---|---|---|---|
| **Tırmanıcı** | 3,5–5,5 m | Küçük ve çevik, kolları uzun. Dalda ya da yaprakların üstündeysen dev ağacın gövdesine koşar, sarılıp saniyede 8 m tırmanır; yetişince sana atılır, vurursa seni ağaçtan düşürür. Sersemlerse ya da bacağı kesilirse tutunamayıp düşer. İndiğinde ya da uzaklaştığında gövdeyi bırakır. | En çok Dev Ağaçlar Ormanı'nda (doğanların üçte biri) |
| **Toslayan** | 11–16 m | Kalın, kısa boyunlu, iri omuzlu. 25–90 m'deki avına başını eğip toprağı eşeler, sonra hızla toslar; yolundakini savurur. Ağaca ya da binaya çarparsa sersemler: kaçarken arana ağaç al. | Demir Sur dışı ve ötesi, orman |
| **Sürü Devi** | 4–6 m | Tek başına zayıf ama dörder dörder gelir. | Her yerde |
| **Uzunkol** | 13–18 m | Sırık gibi uzun, kolları dizlerini geçer: eli sıradan bir devin ~1,5 katı uzağa yetişir. Kancayla yaklaşanı havada kapar. | Her yerde |

Tırmanıcı ve Sürü Devi iri doğmaz; diğerleri bazen türünün 1,35–1,8 katı iri doğar.

## Surlar ve çarpışma

- **Sur üstü:** yürüme yolu iç ve dış korkuluğun arasındadır; korkulukların içinden geçilmez. Dış korkuluğun (1,3 m) üstüne zıplayan aşıp aşağı atlayabilir.
- **Devler sura gömülmez:** omuzları ve kollarıyla birlikte gövdelerinin genişliği kadar surdan uzak durur. Kapı kemerinden (24 m) uzun devler kapıdan geçemez.
- **Sur kalkandır:** surun ardındaki (içindeki) oyuncuya devlerin yumruğu, tekmesi, ısırığı, eli, atılımı, sarsıntısı ve ışını ulaşmaz. Kapı geçidinden ya da surun üstünden geçen hatta ulaşır; surun üstündeysen yalnızca surdan uzun devlerin eli yetişir. Atılan kayalar surun üstünden aşıp düştüğü yere vurur.

## Gard, seri yumruk ve tekme

**Gard (dev formunda `G` basılı, dokunmatikte GARD):** kollar çenenin önüne kalkar, gövde nişan yönüne döner, yavaş yürürsün. Önden (yaklaşık 100° içinden) gelen darbelerin %75'i engellenir; bar çok daha az düşer. Arkadan ya da yandan gelen darbeye gard işlemez. Tekme gardı yarı yarıya deler.

**Seri yumruk:** gardda atılan yumruklar daha kısa sürer ve birbirine bağlanır. Sol tık basılı tutulursa kendiliğinden sağlı sollu çıkar. Serideki her yumruk bir öncekinden %15 sert vurur; her dördüncüsü bir **aparkattır**: yukarı doğru savrulur, ek ×1,4 vurur, gardı kırar ve devi sersemletir. Bir darbeyi gardla karşıladıktan sonraki 1,5 saniyede yumruklar ×1,5 vurur (karşı saldırı). Seri, yumruklar arasında 0,9 saniyeden fazla ara verirsen sıfırlanır.

**Tekme (dev formunda `V`):** diz göğse çekilir, bacak ileri açılır. Yumruktan uzağa uzanır, yumruğun 1,5 katı vurur, devi geri iter, sersemletir ve gardını kırar. 2 bar harcar, 1,3 saniyede bir atılır.

**Devlerin gardı ve tekmesi:** dev formundayken önüne yumruk savurduğunda devler gardını alabilir: ağır devler ve dönüşümcüler en sık, zırhlılar sık, çevik devler seyrek, sürünenler hiç. Gardlı dev önden gelen yumruğun %75'ini engeller (taş yumruk gardı kısmen deler), gardı indirince hemen karşılık verir. Gardı tekme ya da aparkat kırar. Devler de tekme atar: diz göğse çekilir, sonra bacak ileri açılır. Yerdeki insanı fırlatır, dev formunu iter ve gardını yarı yarıya deler.

## Dönüşüm, buhar ve dönüşümcüler

**Dönüşüm:** `T`'ye basınca gökten zikzaklı bir yıldırım düşer, gök bir an aydınlanır. Dev buharın içinden yaklaşık bir saniyede büyüyerek yükselir, ardından göğsünü şişirip kükrer; bu sırada hareket edemez ve güç kullanamazsın. Ses katmanlıdır: çakma, gök gürültüsü, kabaran buhar, kalp atışı gibi gümbürtüler, çatırdayan et ve kemik, en sonda kükreyiş. Dönüştükten sonra devin ağzından sürekli duman sızar; her soluk verişte bir bulut çıkar, dinlenirken soluğu da duyulur.

**Buhar (dev formunda `R`, dokunmatikte üst tuş):** gövdenin her yerinden 3,5 saniye kaynar buhar fışkırır. Dev boyunun 1,5 katı + 8 m içindeki devler haşlanır (merkeze yakın olan daha çok), geri itilir ve sersemler. 12 bar harcar, 9 saniyede bir kullanılır.

**Dönüşümcüler:** oyuncunun girebildiği dev formlarına giren düşmanlar. Oyuncu şehir dışındayken ilki yaklaşık 75 saniye sonra, sonrakiler 2–4 dakika arayla, 220–370 m uzakta doğar; aynı anda yalnızca biri dolaşır. Doğdukları yere yıldırım düşer, buharın içinden büyüyüp kükrerler. Hangi sur bölgesinde olduğuna göre farklı formlar çıkar: Demir Sur içinde Öfke, Fırtına ve Buz; Kalkan Suru içinde Kaya, Işın, Buz ve Öfke; sur ötesinde Zirve, Kaya, Işın ve Fırtına. Kendi formlarının güçlerini sana karşı kullanırlar: kükreyip savurur, atılır, çevresini sarsar, ağzından ışın atar, kaya fırlatır, kollarını taşlaştırır. Her gücün öncesinde duruşları değişir, kıvılcım saçarlar; ışından önce ağızlarında ışık toplanır. Ekranın üstünde can barları görünür. Ensede iki temiz kesik ya da dev gücüyle düşerler; düşen dönüşümcünün **iğnesi senin olur** ve dev barın dolar.

## Devler, at ve görüntü

- **Daha güçlü devler:** canları %40, vuruşları %30 arttı. Devlerin yaklaşık altıda biri türünün boyundan 1,35–1,8 kat iri doğar (canları da 1,6 kat); 20 m'yi aşan taşçılar ve zırhlılar görülebilir.
- **Daha gerçekçi devler:** deri artık yumuşak, fiziksel gölgeyle çizilir: lekeli ve damarlı deri dokusu, ince kabartma, gökten yansıyan hafif parıltı, deri altından sızan sıcak kenar ışığı; konturlar inceldi. Her devin ten rengi biraz farklı; bazıları şişman ve göbekli, bazıları sıska, kol boyları değişir. Yürürken her adımda gövdeleri iner kalkar ve yükü taşıyan bacağa doğru yana yatar, başları avlarına döner.
- **At:** yeniden yapıldı. Derin göğüslü, dolgun sağrılı, kavisli boyunlu bir doru at: yele, dökülen kuyruk, alında beyaz akıtma, iki bacakta beyaz çorap, yular, dizgin, eyer ve üzengiler. Adım, tırıs ve dörtnalda bacaklar gerçek sırasıyla basar; ön bacakta diz geriye, arka bacakta sıçrama eklemi öne kırılır. Dururken ara sıra otlanır, kuyruğunu sallar.
- **Sur tepeleri:** yürüme yolunda üst üste binen taşların titreşmesi giderildi; dış kenarda kesintisiz mazgallı korkuluk, iç kenarda alçak bir korkuluk var.
- **Görüntü:** masaüstünde güneş, yıldırım ve parlak ışıklar hafifçe parıldar; renkler biraz daha doygun, gölgeler serin, ışıklar sıcak; ekran kenarları hafifçe kararır. Dokunmatik cihazlarda bu işlem kapalıdır; masaüstünde adrese `?nopost` eklenerek kapatılabilir.

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

| Karakter | Unvan | ◆ / seviye | Özellik | Kendi dev formu |
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
| Nehir | Boğa Güreşçisi | 4000 · Sv 6 | Can +%15, kanca çekişi +%10 | Toslayan Devi (15 m): kalın omuzlu; zırh delen uzun tos, yer tepip sersemletme |
| Kaan | Uzak Nişancı | 5200 · Sv 8 | Kılıç erişimi +%20, gaz +%10 | Uzunkol Devi (20 m): kolları dizini geçer; uzaktan savuruş, kapan (sersemletme), taş fırlatma |
| Sena | İz Sürücü | 6800 · Sv 10 | Hız +%12, gaz +%15 | Avcı Devi (22 m): derisiz, kasları dışarıda; en hızlı büyük form, av atılımı, kök sarsıntısı |
| Alp | Sur Demircisi | 8800 · Sv 12 | Can +%40, kılıç dayanımı +%30 | Demir Koç (19 m): metal plakalı, darbelere en dayanıklı form; zırh delen yumruk, sur delen tos, kızgın plaka |
| Oğuz | Dağ Çobanı | 11500 · Sv 14 | Bar %25 hızlı dolar, formda %10 yavaş biter | Çoban Devi (24 m): kürklü, boynuzlu; dev kaya fırlatma, geniş buyruk kükreyişi |

Son beş karakter, sur ötesinde karşılaştığın yeni devlerin formlarına sahiptir ve almak için **hem av puanı hem seviye** gerekir: seviye XP ile yükselir, menüde eksik kalan şart kırmızı görünür. Yalnızca av puanı harcanır; seviye düşmez.

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
