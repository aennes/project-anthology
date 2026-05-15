# Planned Changes → Repo File/Folder Mapping (Discovery Phase)

Bu doküman **sadece keşif/mapping** amaçlıdır. Henüz hiçbir dosyada değişiklik yapılmadı.

İstenen çıktı formatı:

`[CHANGE] → [FILE PATH] → [WHAT TO DO] → [RISK/NOTE]`

---

## Remove Light Mode

- Remove Light Mode → `contexts/ThemeContext.tsx` → `'light'` tema tipini kaldır; `toggleTheme` ve `STORAGE_KEY` + tüm `localStorage` okuma/yazmalarını kaldır; `applyDocumentTheme` içindeki `data-theme='light'` set etme/remove etme mantığını karanlığa sabitle (ya da tamamen kaldır). → Risk/Note: `App.tsx` içinde `theme === 'light'` dallanmaları var; ThemeContext sadeleşince bu dallar da temizlenmeli yoksa dead/çelişkili UI kalır.
- Remove Light Mode → `components/ui/ThemeToggle.tsx` → Tema toggle bileşenini kaldır (artık ihtiyaç yok) ve `useTheme()` kullanımını sil. → Risk/Note: `<ThemeToggle />` çağrı noktaları temizlenmezse runtime render hatası çıkar.
- Remove Light Mode → `components/ui/theme-toggle.css` → Toggle’a özel CSS’i sil (dosyayı kaldır veya boşalt). → Risk/Note: `ThemeToggle.tsx` import’u kalkmadan dosyayı silmek build’i kırar.
- Remove Light Mode → `index.html` → En baştaki inline boot script’i kaldır: `localStorage.getItem('anthology-theme') === 'light'` ise `data-theme` set eden blok. → Risk/Note: Bu script React’ten önce çalışıp “flash” önlüyordu; dark-only’de gereksiz.
- Remove Light Mode → `index.css` → Tüm `[data-theme='light'] { … }` bloklarını, light override’ları ve `color-scheme: light` mantığını sil. → Risk/Note: Bu override’lar Tailwind utility class adlarını target ediyor (örn. `.text-white`); silince dark-only tasarım beklenen hale gelir, ama attribute’a bağlı başka bir davranış kalmadığından emin olun.
- Remove Light Mode → `App.tsx` → `useTheme()` import/kullanımını kaldır; `theme === 'light' ? … : …` className/animate dallanmalarını sadeleştir; tüm nav shell’lerde `<ThemeToggle />`’ı kaldır. → Risk/Note: `Shell`, `TimelineShell`, `GalleryShell`, `NewsShell` içinde tekrar eden nav kodu var; her kopyada temizlemek gerekir.
- Remove Light Mode → `index.tsx` → `ThemeProvider` wrapper’ını kaldır (ThemeContext tamamen kaldırılacaksa). → Risk/Note: Başka yerde `useTheme()` kullanımı kalırsa app crash olur.
- Remove Light Mode → `ui-samples/dark-light-mode.css` (ve `ui-samples/` genel) → Light mode mantığını içeren örnekleri sil (veya “remove light mode” gereği bu klasörü tamamen kaldırmayı değerlendirin). → Risk/Note: Bu klasör prod’a dahil olmasa bile repo içinde “light mode logic” barındırır; gereksinim katıysa kaldırılmalı.

---

## News Auto-Refresh on Load

- News Auto-Refresh on Load → `App.tsx` → Site ilk yüklendiğinde background’da `/api/news` “network-first” ısındırma fetch’i tetikle (render’ı bloklamadan). → Risk/Note: Şu an News bileşeni lazy ve yalnızca hover/navigasyonla prefetch/fetch oluyor; bu gereksinimle çelişiyor.
- News Auto-Refresh on Load → `utils/newsService.ts` → “her load’da taze istek” için SWR/TTL mantığını bypass eden bir API tasarla (örn. `refreshFromNetwork()`’ü fire-and-forget çağıran `warmNewsOnLoad()` gibi); hataları swallow edip UI’yi bloklamasın. → Risk/Note: Mevcut `fetchNews()` 30 dk fresh TTL içinde **revalidate etmez**; “fresh on load” için doğrudan `refreshFromNetwork()` çağrısı gerekir.
- News Auto-Refresh on Load → `components/News.tsx` → Mount’ta “cache’i göster + hemen network fetch” yap; mevcut polling (`setInterval`) / focus revalidate / manual Retry davranışlarını gereksinime göre kaldır/yenile. → Risk/Note: Şu an:
  - polling: 5 dk interval
  - focus: `window.focus` ile refresh
  - manual: Retry butonu `refreshFromNetwork()`
  Global warm-up eklenirse fazla istek/rate-limit riski artabilir.
- News Auto-Refresh on Load → `vite.config.ts` (PWA Workbox) → `/api/news` runtimeCaching stratejisini gözden geçir (şu an `NetworkFirst`, 6 saat maxAge). → Risk/Note: Service worker offline/timeout koşullarında cache döndürebilir; “fresh on load” beklentisiyle çelişmesin.
- News Auto-Refresh on Load → `api/news.ts` → CDN cache header’ları (`s-maxage=1800, stale-while-revalidate=21600`) ile “fresh” beklentisini hizala (gerekirse süreleri kısalt). → Risk/Note: Edge cache tasarımı gereği 30 dk “fresh” servis edebilir; frontend daha sık fetch etse de yeni veri garanti değildir.
- News Auto-Refresh on Load → `server/dev-api-server.ts` + `vite.config.ts` proxy → Dev ortamda `/api/news` ilk yükte otomatik çağrılacağından, dev API server yoksa hata state’i iyi yönetilmeli. → Risk/Note: Auto-refresh load anında dev konfig sorunlarını görünür kılar (timeout, port çalışmıyor vs.).
- News Auto-Refresh on Load → `utils/newsService.test.ts` (ve ilgili testler) → TTL/SWR semantiği değişirse testleri güncelle. → Risk/Note: Testler localStorage cache ve stale davranışını assert ediyor.

---

## Remove Gallery Page

- Remove Gallery Page → `components/Gallery.tsx` → Gallery sayfa bileşenini sil. → Risk/Note: `utils/optimizedImages.ts` içindeki `getOriginalImagePathByNumber()` Gallery lightbox download için kullanılıyor; Gallery kalkınca bu export muhtemelen unused kalır.
- Remove Gallery Page → `App.tsx` → Gallery lazy import’unu kaldır (`lazyWithMinDisplay(() => import('./components/Gallery'))`); `GalleryShell`’i kaldır; `<Route path="/gallery" …>`’i kaldır; tüm nav menülerindeki `navigate('/gallery')` linklerini kaldır. → Risk/Note: Nav markup birden fazla shell’de kopyalı; hepsinden temizlemek gerekir.
- Remove Gallery Page → `vercel.json` → `{ "source": "/gallery", "destination": "/" }` rewrite’ını kaldır. → Risk/Note: Rewrite kalırsa `/gallery` hâlâ SPA’ye düşer (home açılır) ve “gallery yok” davranışı belirsiz olur.
- Remove Gallery Page → `vite.config.ts` → `manualChunks` içinde `components/Gallery` için `return 'gallery'` kuralını kaldır. → Risk/Note: Bırakmak build’i bozmaz ama dead config olur.
- Remove Gallery Page → `scripts/check-bundle-size.js` → `THRESHOLDS` içindeki `'gallery': 50` eşiğini kaldır (chunk kalkacağı için). → Risk/Note: Eşiği bırakmak zararsız ama yanıltıcı.
- Remove Gallery Page → `utils/galleryImages.ts` → Gallery’e özel helper’lar (şu an import eden görünmüyor) kaldırılabilir. → Risk/Note: “Gallery’e özel Cloudinary logic” yerine burada storyContent’tan image extract var; Gallery kalkınca muhtemelen gereksiz.
- Remove Gallery Page → `utils/imageCDN.ts` → Cloudinary entegrasyonunu koru (başka yerlerde kullanılabilir). → Risk/Note: Cloudinary CSP izinleri `vercel.json` içinde var; Gallery kalksa da genel image optimize akışı etkilenmemeli.

---

## Font Audit & Replacement

### Projede kullanılan fontlar (bulunan tüm kaynaklar)

- Font Audit & Replacement → `package.json` → `@fontsource/inter`, `@fontsource/playfair-display`, `@fontsource/ibm-plex-mono` kullanılıyor. → Risk/Note: Self-hosted font iyi; harici Google Fonts zorunlu değil.
- Font Audit & Replacement → `index.tsx` → Font import’ları:
  - Playfair Display: 400, 700, 400 italic
  - IBM Plex Mono: 400, 600
  - Inter: 300, 400, 600, 900 → Risk/Note: Çok weight/style import’u bundle ve render maliyetini artırabilir; azaltma düşünülmeli.
- Font Audit & Replacement → `tailwind.config.js` → `fontFamily` mapping:
  - sans: Inter
  - serif: Playfair Display
  - mono: IBM Plex Mono → Risk/Note: Sistem genelinde tutarlı.
- Font Audit & Replacement → `index.css` → `body` Inter; `.font-serif` Playfair; `.font-mono` IBM Plex Mono; ayrıca `@font-face { font-display: swap }` blokları var. → Risk/Note: Bu `@font-face` blokları `src` tanımlamadığı için yükleme yapmaz; Fontsource ile redundant/yanıltıcı olabilir.

### Tema uyumu ve olası değişim önerileri (cinematic/editorial F1)

- Font Audit & Replacement → (Genel) → Inter “product UI” hissi verebilir; Playfair güçlü editorial; IBM Plex Mono telemetry vibe için iyi. → Risk/Note: Değişiklikte layout shift/metric uyumu (LCP/CLS) ve weight sayısı kontrol edilmeli.
- Font Audit & Replacement → (Öneri) → Serif başlık: Fraunces veya Cormorant Garamond; Sans gövde: IBM Plex Sans / Space Grotesk / Manrope; Mono: IBM Plex Mono kalabilir. → Risk/Note: Yeni fontlar eklenirse `package.json` + `index.tsx` import + `tailwind.config.js` güncellenir.

---

## Architecture & Production Readiness Review

### Frontend

- Architecture & Production Readiness Review → `App.tsx` → Shell’lerde tekrar eden nav/menu kodu var; dead link/eksik temizleme riski yüksek. → Risk/Note: Gallery/light-mode kaldırma gibi değişikliklerde bir kopya kaçabilir.
- Architecture & Production Readiness Review → `components/ErrorBoundary.tsx` → Error boundary var ve `errorTracker` ile prod’da raporluyor. → Risk/Note: `console.error` prod’da da kalır (terser `pure_funcs` listesinde değil); istenmiyorsa ayrıca ele alınmalı.
- Architecture & Production Readiness Review → `utils/errorTracker.ts` → Sentry sadece `import.meta.env.PROD && VITE_SENTRY_DSN` iken init; dynamic import kullanıyor. → Risk/Note: CSP `vercel.json` içinde Sentry connect/script izinleri var; DSN’ye göre host farklıysa `index.html` preconnect yanlış olabilir.
- Architecture & Production Readiness Review → `index.html` → Hardcoded Sentry preconnect (`o4507000000000000…`). → Risk/Note: Gerçek DSN host’u farklıysa gereksiz/yanlış hint.
- Architecture & Production Readiness Review → `utils/newsProviders.ts` → Görünürde kullanılmıyor; client-side CORS proxy (`api.allorigins.win`, `corsproxy.io`) ve `console.log` içeriyor. → Risk/Note: İleride yanlışlıkla bağlanırsa güvenlik/kararlılık problemi yaratabilir; dead code olarak kaldırılabilir.
- Architecture & Production Readiness Review → `vite.config.ts` → Prod’da `drop_console` var ama `console.warn/error` kalabilir. → Risk/Note: Log politikası netleştirilmeli.

### Backend/API (`/api/news`, `/api/health`, Vite proxy)

- Architecture & Production Readiness Review → `api/news.ts` → Method/query validation var; timeoutlar, parse/sanitize, rate-limit var. → Risk/Note: `getAllowedOrigin()` adı “allowlist” gibi ama pratikte localhost dışındaki origin’leri de geri döndürüyor (CORS permissive); niyet kontrol edilmeli.
- Architecture & Production Readiness Review → `api/news.ts` → Rate limit store memory içi `Map`. → Risk/Note: Serverless’ta cold start/çoklu instance nedeniyle “best-effort” (global garanti değil).
- Architecture & Production Readiness Review → `api/health.ts` → Basit health endpoint. → Risk/Note: `environment` ve commit SHA expose ediyor; istenmiyorsa kısıtlanabilir.
- Architecture & Production Readiness Review → `server/dev-api-server.ts` + `vite.config.ts` proxy → Local dev’de `/api/*` proxy 127.0.0.1:3001’e gidiyor. → Risk/Note: Auto-refresh-on-load gibi değişiklikler dev API server’ı daha kritik hale getirir.

### Vercel config

- Architecture & Production Readiness Review → `vercel.json` → SPA rewrites `/news`, `/timeline`, `/gallery` içeriyor. → Risk/Note: Gallery kaldırılırsa rewrite kaldırılmalı.
- Architecture & Production Readiness Review → `vercel.json` → CSP’de `script-src` içinde `'unsafe-inline'` ve `'unsafe-eval'` var. → Risk/Note: Güvenlik açısından zayıf; mümkünse tighten edilmeli (ama tooling/Sentry etkileri olabilir).

### General

- Architecture & Production Readiness Review → `.env.example` → Var (iyi). → Risk/Note: News provider env’leri (örn. `VITE_NEWS_PROXY_URL` ve provider key’leri) dokümante değil; `utils/newsProviders.ts` kalacaksa eklenmeli, silinecekse dead code temizliği daha iyi.
- Architecture & Production Readiness Review → `vite.config.ts` (PWA) → `/api/news` Workbox runtimeCaching var (`NetworkFirst`). → Risk/Note: “Fresh on load” isteniyorsa SW caching davranışıyla uyumlu hale getirilmeli.

