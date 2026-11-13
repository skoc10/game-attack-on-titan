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

## Geliştirme

- `src/data/config.ts` — denge sayıları; `src/data/titans.ts` — dev formları (boy, hız, güçler, bar bedelleri).
- `src/enemies/humanoid.ts` — eklemli karakter modeli ve kontur kurucu (`Rig`); `src/core/textures.ts` — kodla çizilen dokular.
- `src/world/` arazi, surlar, orman, harabeler, kutular, ikmal noktaları, dev üretici · `src/player/` oyuncu, kanca, at, dev formu · `src/enemies/` devler · `src/systems/` saf oyun mantığı (testli) · `src/ui/` HUD, menü, mini harita.
- `?debug` parametresi: `1` barı doldur, `2` her türden iğne ver, `3` Demir Sur'a ışınlan, `4` dev üret, `5` XP ver; `window.__game` konsoldan erişilir.
