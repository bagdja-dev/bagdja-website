# Bagdja Website — public renderer (Next.js) — build image untuk deploy di Coolify.
# Moved off Vercel (Hobby tier ToS forbids commercial use, Pro not in budget yet)
# — see app/bagdja-website/plan.md Phase 8a. Custom domains are handled by
# middleware.ts + Coolify's own domain/cert management, not by this Dockerfile.
#
# CATATAN: base image node:22 (bukan node:20), konsisten dengan api/Dockerfile
# di ekosistem ini.
#
# Pola beda dari api/Dockerfile: Next.js `output: 'standalone'` (next.config.js)
# sudah menghasilkan node_modules yang di-prune otomatis di dalam
# `.next/standalone` — jadi tidak perlu `npm prune` manual seperti di api/.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY . .
# public/ ada di repo tapi kosong — git tidak melacak direktori kosong, jadi
# di beberapa checkout foldernya bisa benar-benar tidak ada. Pastikan selalu
# ada supaya COPY --from=builder di stage production tidak gagal.
RUN mkdir -p public
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Default; bisa dioverride lewat env var Coolify. Harus cocok dengan
# core/docs/port.md (bagdja-website-web = 5005).
ENV PORT=5005
EXPOSE 5005

# WAJIB: server.js hasil `output: standalone` default listen di localhost
# (127.0.0.1) kalau HOSTNAME tidak di-set eksplisit — jadi tidak reachable
# dari container lain (mis. Traefik) di network Docker yang sama, walau
# EXPOSE-nya benar. Tanpa ini muncul "Connection refused"/502 Bad Gateway
# dari proxy meski container-nya sendiri sehat.
ENV HOSTNAME="0.0.0.0"

# Next.js standalone server sudah termasuk middleware.ts (host-based tenant
# resolution untuk custom domain/subdomain) — tidak butuh proses terpisah.
CMD ["node", "server.js"]
