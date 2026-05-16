# Project Anthology — Yayına Alma Rehberi

Bu rehber, sitende yaptığın değişiklikleri **canlıya almak için** baştan sona izleyeceğin adımları anlatır.
Komutlar **PowerShell** içindir (Windows). Sırasıyla uygula; her adımı açıkladım.

> Kısa özet: `git pull → düzenle → test et → git commit → git push` →
> Vercel kendiliğinden yeni sürümü yayına alır.

---

## Bilmen gereken üç şey

| Şey | Değer |
| --- | --- |
| Proje klasörü | `c:\Users\ts\Desktop\Coding\Anthology` |
| GitHub deposu | `https://github.com/ugurshelby/project-anthology` |
| **Vercel projesi (tek)** | **project-anthology** — başka isimle (`anthology` vb.) ikinci proje oluşturma |
| Canlı URL | `https://project-anthology-ugurshelbys-projects-56bd68c2.vercel.app` |
| Yayına alma yöntemi | GitHub `main` branch'ına push → Vercel otomatik deploy |

Tüm komutları aşağıdaki klasörde, **PowerShell** açıkken çalıştırırsın:

```powershell
cd "c:\Users\ts\Desktop\Coding\Anthology"
```

---

## 1) İşe başlamadan önce — temiz bir başlangıç

Yeni bir değişiklik yapmaya başlarken **önce** depoyla senkron ol:

```powershell
git status                       # her şey temiz mi diye bak
git pull --rebase origin main    # GitHub'daki son sürümü çek
```

- `git status` "nothing to commit, working tree clean" diyorsa hazırsın.
- Yarım kalmış (kırmızı/yeşil) dosyalar varsa ya bitir ya da `git stash` ile bir kenara koy.

---

## 2) Geliştirme sunucusunu aç

```powershell
npm run dev
```

- Vite + dev API birlikte ayağa kalkar.
- Tarayıcıda aç: <http://localhost:3000>
- Düzenleme yapınca sayfa otomatik yenilenir (HMR).
- Bitirince PowerShell penceresinde **Ctrl + C** ile durdur.

---

## 3) Değişikliklerden memnunsan — kısa kontrol

Bu adım **zorunlu değil** ama push'tan önce hızlı bir güven testidir.

```powershell
npm run test:run                 # birim testler (~15 sn)
```

Hepsi yeşil olmalı. Tek tek test sonuçlarını görmek istersen:

```powershell
npm run test:ui
```

> Daha kapsamlı uçtan uca test (yavaştır, opsiyonel):
> ```powershell
> npm run test:e2e
> ```

İstersen prod sürümünü lokal'de bir kez de gerçekten görmek için:

```powershell
npm run build
npm run preview                  # http://localhost:3000 üzerinden dist/'i serve eder
```

---

## 4) Değişiklikleri commit'le

```powershell
git status                       # neyi commit edeceğini gör
git add .                        # tümünü ekle (ya da seçici: git add path\to\file)
git commit -m "feat: kısa açıklama"
```

Commit mesajını **kısa ve anlamlı** yaz. Önek olarak şunları kullan:

| Önek | Ne zaman? | Örnek |
| --- | --- | --- |
| `feat:` | Yeni özellik | `feat(news): doğru kronoloji ve sade UI` |
| `fix:` | Hata düzeltme | `fix(loader): bekleme süresi fazlaydı` |
| `style:` | Sadece görsel/tema | `style(menu): glow buton aktif rengi` |
| `refactor:` | Davranış aynı, kod temizlendi | `refactor(news): cluster mantığı sade` |
| `docs:` | Sadece dokümantasyon | `docs: deploy rehberi eklendi` |
| `chore:` | Yapılandırma / paket | `chore: vercel.json güncellendi` |

---

## 5) GitHub'a push et — Vercel otomatik deploy

```powershell
git push origin main
```

- Bu komutla beraber Vercel **otomatik** olarak yeni production deploy'u başlatır.
- Başka komut çalıştırmana gerek yok.

İlerlemeyi şuradan canlı izle:

- <https://vercel.com/dashboard> → **project-anthology** → **Deployments**

Yeni deploy yeşillenip "Ready" olduğunda canlıdadır. Genelde **1-3 dakika** sürer.

---

## 6) Yayında doğrulama

Deploy "Ready" olduktan sonra şunlarla son kontrol yap:

### A) Tarayıcı
- Canlı URL'i aç ve değiştirdiğin sayfa(ları) gez.
- Yeni sürümü görmüyorsan **Ctrl + Shift + R** (hard reload) yap. (PWA service worker eski sürümü cache'lemiş olabilir.)

### B) API endpoint'leri (PowerShell)

```powershell
# Sağlık kontrolü
Invoke-RestMethod "https://<senin-site>.vercel.app/api/health"

# Haberler güncel ve doğru sıralı mı?
$r = Invoke-RestMethod "https://<senin-site>.vercel.app/api/news"
"items=" + $r.Count
$r | Select-Object -First 5 | ForEach-Object { "[$($_.dateLabel)] $($_.title)" }
```

Beklenen: ~60 öğe, en yeni tarih en üstte, başlıklar makul.

> `<senin-site>` yerine kendi Vercel URL'ini koy (ör. `project-anthology`).

---

## 7) Bir şey ters giderse — geri alma

### Henüz `git push` yapmadıysan
```powershell
git reset --soft HEAD~1          # son commit'i geri al, dosyalar kalır
```

### Push ettin ama canlıda hata var (en hızlı yol)
1. <https://vercel.com/dashboard> → projeni aç → **Deployments**
2. Sorunsuz çalışan eski bir deploy'u bul.
3. Sağındaki üç noktaya tıkla → **Promote to Production**.
4. Tek tıkla bir önceki sağlam sürüme döner.

### Git'te de geri almak istiyorsan
```powershell
git revert HEAD                  # bozuk commit'i ters çeviren yeni commit oluşturur
git push origin main             # Vercel otomatik yeniden deploy eder
```

> ⚠️ `git push --force` **kullanma**. Hem Vercel deploy geçmişini hem ekipteki diğer kişilerin işini bozar.

---

## Hızlı referans (her güncellemede sırayla bunları yap)

```powershell
cd "c:\Users\ts\Desktop\Coding\Anthology"
git pull --rebase origin main

npm run dev                      # geliştir, beğen, Ctrl+C ile kapat
npm run test:run                 # yeşil mi?

git status
git add .
git commit -m "feat: <kısa açıklama>"
git push origin main             # Vercel otomatik deploy
```

Sonra Vercel dashboard'dan deploy'un yeşillendiğini izle ve canlı URL'de
`Invoke-RestMethod .../api/news` ile doğrula. Hepsi bu.

---

## Sık karşılaşılan durumlar

### "Vercel'de yeni özellik görünmüyor"
- Tarayıcıda **Ctrl + Shift + R** (hard reload) dene.
- Sorun devam ederse Chrome DevTools → **Application → Service Workers → Unregister** → sayfayı yenile.

### "Yeni env değişkeni ekledim, çalışmıyor"
- Lokal'deki `.env` dosyaları **Vercel'e otomatik gitmez**.
- Vercel dashboard → **Settings → Environment Variables** üzerinden ekle.
- Ekledikten sonra **Deployments** sekmesinden son deploy'u **Redeploy** et.

### "git pull çakışma (conflict) verdi"
- Çakışan dosyaları aç, `<<<<<<<` ve `>>>>>>>` işaretli yerleri elle düzelt.
- Sonra:
  ```powershell
  git add .
  git rebase --continue
  ```
- Vazgeçmek istersen: `git rebase --abort`

### "npm install hatası" / "node_modules bozuk"
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### "Build çok uzun sürüyor"
- `npm run build` görsel optimizasyonu da yapar (~2-3 dk).
- Sadece bundle kontrolü için: `npx vite build` (görsel adımları atlar).
- Hızlı doğrulama için bu yeterlidir; **gerçek deploy zaten Vercel'de** yapılır.

---

## Vercel: tek proje kuralı

Bu depo yalnızca Vercel'deki **project-anthology** projesine bağlı olmalıdır.

- Dashboard: [project-anthology → Deployments](https://vercel.com/dashboard)
- Aynı GitHub reposuna ikinci bir Vercel projesi bağlarsan her `git push` **çift deploy** üretir.
- Yerelde CLI kullanmadan önce (veya yanlış projeye linklendiyse):

```powershell
npm run vercel:link
```

Bu komut `.vercel/repo.json` içinde yalnızca `project-anthology` kaydını tutar. **Yeni proje adı öneren** etkileşimli `vercel link` akışından kaçın.

---

## (Opsiyonel) Vercel CLI ile manuel deploy

GitHub push'a gerek kalmadan production deploy istersen:

```powershell
vercel login                     # bir defa giriş
npm run vercel:deploy            # project-anthology'ye prod deploy
```

> Normal akışta bu gerekli değildir — `git push origin main` yeterlidir.  
> Ham `vercel --prod` kullanma; önce `npm run vercel:link` ile doğru projeye bağlandığından emin ol.
