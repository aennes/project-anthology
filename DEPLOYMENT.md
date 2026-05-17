# Production Deployment Guide

Bu dokümantasyon, Project Anthology'yi production ortamına deploy etmek için gereken adımları açıklar.

## Ön Gereksinimler

1. **Vercel Hesabı**: [Vercel](https://vercel.com) hesabı oluşturun
2. **GitHub Repository**: Projenin GitHub'da bir repository'si olmalı
3. **Environment Variables**: Production için gerekli environment variable'ları hazırlayın

## Environment Variables

Production deploy öncesi aşağıdaki environment variable'ları Vercel dashboard'unda ayarlayın:

### Zorunlu Değişkenler

Yok - Tüm değişkenler opsiyonel.

### Opsiyonel Değişkenler

- `VITE_CLOUDINARY_CLOUD_NAME`: Cloudinary CDN için cloud name (opsiyonel)
- `VITE_SENTRY_DSN`: Sentry error tracking için DSN (opsiyonel)
- `VITE_DEBUG`: Debug mode için `true` veya `false` (default: `false`)

## Pre-deploy: Test ve build doğrulama

Deploy öncesi yerelde testlerin ve build'in geçtiğinden emin olun:

1. **Birim testleri (Vitest):**
   ```bash
   npm run test:run
   ```

2. **Build kontrolü:**
   ```bash
   npm run build:check
   ```
   Build ve bundle size kontrolü yapılır.

## Deployment Adımları

### 1. Vercel'e Bağlama

1. [Vercel Dashboard](https://vercel.com/dashboard) üzerinden "New Project" seçin
2. GitHub repository'nizi seçin
3. Vercel otomatik olarak projeyi algılayacak (Vite + React)

### 2. Build Ayarları

Vercel otomatik olarak şu ayarları kullanır:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Environment Variables Ayarlama

Vercel Dashboard > Project Settings > Environment Variables:

```
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name (opsiyonel)
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id (opsiyonel)
VITE_DEBUG=false (opsiyonel)
```

### 4. Deploy

1. "Deploy" butonuna tıklayın
2. Vercel otomatik olarak build ve deploy işlemini başlatır
3. Deploy tamamlandığında production URL'iniz hazır olur

## Post-Deployment Checklist

- [ ] Site production URL'de açılıyor mu?
- [ ] API endpoint'leri çalışıyor mu? (`/api/news`, `/api/health`)
- [ ] Images yükleniyor mu?
- [ ] Error tracking çalışıyor mu? (Sentry varsa)
- [ ] Performance monitoring aktif mi? (Vercel Analytics)
- [ ] Security headers doğru mu? (SecurityHeaders.com kontrol edin)
- [ ] HTTPS aktif mi?

## Monitoring

### Health Check

Health check endpoint'i: `https://your-domain.vercel.app/api/health`

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "environment": "production",
  "version": "abc1234"
}
```

### Error Tracking

Sentry entegrasyonu aktifse, tüm error'lar otomatik olarak Sentry'ye gönderilir.

### Performance Monitoring

Vercel Analytics ve Speed Insights otomatik olarak aktif edilir.

## Troubleshooting

### Build Hataları

1. **Build fails**: `npm run build` komutunu lokal olarak çalıştırın ve hataları kontrol edin
2. **Environment variables**: Tüm gerekli environment variable'ların ayarlandığından emin olun
3. **Dependencies**: `package.json`'daki tüm dependency'lerin doğru versiyonlarda olduğundan emin olun

### Runtime Hataları

1. **API errors**: `/api/news` endpoint'inin çalıştığını kontrol edin
2. **Image loading**: Cloudinary CDN kullanıyorsanız, görsellerin Cloudinary'de yüklü olduğundan emin olun
3. **CORS errors**: `vercel.json`'daki CORS ayarlarını kontrol edin

### Performance Sorunları

1. **Slow load times**: Bundle size'ı kontrol edin (`npm run build` sonrası)
2. **Image optimization**: Cloudinary CDN kullanmayı düşünün
3. **Caching**: Browser cache ve CDN cache ayarlarını kontrol edin

### F1 data (season-tracker / tracks)

**Storage:** committed JSON under `public/data/f1/` (not Supabase). The browser loads historical seasons from `/data/f1/…` immediately; `/api/f1-season` is used for stale-while-revalidate on the current season and as a fallback. Live timing uses `/api/f1-live` only.

**Before deploy** (or after a race weekend), refresh snapshots locally and commit:

```bash
npm run sync:f1:seasons   # fast: standings + calendar + circuit rows (no per-round tree)
npm run sync:f1           # full: includes every completed round JSON under rounds/
```

Commit `public/data/f1/` after either command. Browser caches (`localStorage` / `sessionStorage`) still apply on top for repeat visits.

## Rollback

Vercel Dashboard > Deployments > Previous deployment > "..." > "Promote to Production"

## CI/CD

Vercel projesi: **project-anthology** (GitHub `ugurshelby/project-anthology` → `main` push).

Aynı repoya ikinci bir Vercel projesi bağlamayın; her push çift deploy üretir.

Vercel otomatik olarak GitHub push'larından sonra deploy yapar. Manuel deploy için:

```bash
npm run vercel:link    # yerelde doğru projeye bağlan
npm run vercel:deploy  # production
```

## Domain Ayarlama

1. Vercel Dashboard > Project Settings > Domains
2. Custom domain ekleyin
3. DNS kayıtlarını güncelleyin (Vercel talimatları takip edin)

## Security Checklist

- [ ] HTTPS aktif
- [ ] Security headers doğru (`vercel.json`)
- [ ] CORS whitelist ayarlı (`api/news.ts`)
- [ ] API rate limiting aktif
- [ ] Environment variables güvenli (Vercel secrets)

## Performance Optimization

- [ ] Bundle size optimize edilmiş
- [ ] Images optimize edilmiş (CDN veya local)
- [ ] Code splitting aktif
- [ ] Caching stratejisi ayarlı
- [ ] Service Worker aktif (PWA)

## Support

Sorun yaşarsanız:
1. Vercel logs kontrol edin (Dashboard > Deployments > Logs)
2. Browser console'u kontrol edin
3. Network tab'ı kontrol edin (API istekleri)
