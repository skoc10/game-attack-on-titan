# Sur Ötesi

Tarayıcıda çalışan, üçüncü şahıs 3D dev avı oyunu. İnsanlık iç içe üç surun ardına sığınmış; sen kanca teçhizatınla surların dışına çıkıp devleri ensesinden avlıyorsun. Özgün bir dünya: tüm isimler, karakterler ve modeller bu proje için yapıldı (modeller kod ile üretilir, harici asset yok).

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
2. **Kanca Teçhizatı** ile ağaçlara, binalara, surlara ve devlere tutun. Hızlandıkça kılıç hasarın artar.
3. Devler yalnızca **enseden** ölür. Bacaklarına vurursan yere düşerler.
4. **Gaz kendiliğinden dolmaz.** Mavi bayraklı **ikmal noktalarının** yanında durunca dolar (şehirde, sur kapılarında ve köylerde var); gaz kutuları da doldurur.
5. Sarı ışıklı **kutulardan** Öz İğnesi çıkar.
6. Dev öldürdükçe **dev barı** dolar. Bar **en az yarıya** gelmişse ve iğnen varsa `T` ile **Öfke Devi**'ne dönüşürsün. Dev formunda bar güç kaynağındır: zamanla azalır, her güç kendi bedeli kadar bar harcar, bar bitince insana dönersin. Erken çıkarsan (`T`) artan bar sende kalır.
7. Demir Sur kapısındaki **Kapı Kıran**'ı yen, Kalkan Suru'nu aş.

Oyun fare imleciyle oynanır; imleç kilitlenmez.

| Girdi | İnsan | Öfke Devi (bar bedeli) |
|---|---|---|
| Sağ tık (basılı tutulabilir) | İmlecin gösterdiği yere yürü | Aynı |
| Sol tık | İmlece kanca at (basılı tut: çekil); dev yakınken kılıç savur | Yumruk (−3) |
| Fare tekerleği | Sağa/sola bak (`Shift` ile yukarı/aşağı) | Aynı |
| `Shift` | Koş · havada gaz itişi | Koş |
| `Space` | Zıpla · kancadan fırla | Sıçra, inişte ezme (−10) |
| `E` | Kutu aç · ata bin/in | Taş Yumruk, zırh kırar (−25) |
| `Q` | — | Kükreme, sersemletir (−15) |
| `F` | Atı çağır | — |
| `R` | Sınıf yeteneği | — |
| `T` | Deve dönüş | İnsan formuna dön |
| `Esc` / `P` | Duraklat, menü | |

İsteğe bağlı: `W A S D` ile de yürünür, ok tuşları ya da orta tuşla sürükleme de kamerayı çevirir.

**Sınıflar:** Nefer (dengeli), As (hız, Sv 2), Muhafız (güç, Sv 4), Taktisyen (destek, Sv 6).
**Devler:** sıradan, Koşucu, Sıçrayan, Zırhlı (önce düşürülmeli) ve bölüm sonu Kapı Kıran.
İlerleme (seviye, yükseltmeler, sınıf, görev) tarayıcıda `localStorage`'a kaydedilir.

## Geliştirme

- `src/data/config.ts` — tüm denge sayıları.
- `src/world/` arazi, surlar, orman, harabeler, kutular, ikmal noktaları, dev üretici · `src/player/` oyuncu, kanca, at, dev formu · `src/enemies/` devler · `src/systems/` saf oyun mantığı (testli) · `src/ui/` HUD, menü, mini harita.
- `?debug` parametresi: `1` barı doldur, `2` iğne ver, `3` Demir Sur'a ışınlan, `4` dev üret, `5` XP ver; `window.__game` konsoldan erişilir.
