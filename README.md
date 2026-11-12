# dsh-plugins

Profil **DeepSeek Harness (DSH)** `web` sebagai kode: manifest profil, patch konfigurasi, dan tiga plugin lokal yang dipakai sehari-hari.

Repo ini adalah sumber kebenaran untuk komposisi profil Web. `git clone` lalu `pnpm install` cukup untuk membangun kembali profil yang sama di mesin lain — tidak ada langkah build.

| | |
| --- | --- |
| Remote | `git@github.com:nyxsr/dsh-plugins.git` (branch `master`) |
| Profil tujuan | `$DSH_HOME/profiles/web` (default `~/.dsh/profiles/web`) |
| Versi DSH | `0.2.2-rc.2` |
| Node | >= 20 (lihat `engines.node` setiap plugin) |
| pnpm | 11.x, `nodeLinker: hoisted` |

## Isi repo

```
.
├── package.json            # dependensi + dsh.profile.bundles (urutan layer)
├── pnpm-lock.yaml          # versi terkunci seluruh dependensi
├── pnpm-workspace.yaml     # nodeLinker: hoisted, izin build script
├── cordis.patch.yml        # patch pengguna, diterapkan setelah semua layer bundle
├── .gitignore
└── plugins/
    ├── ai-diagram-studio/   # 6 tool diagram: ERD, flowchart, UML, sequence, arsitektur
    ├── ai-pdf-studio/       # 10 tool PDF: generate, preview, inspect, edit, redesign, ...
    └── storage-insights/    # pemindai 10 file/folder terbesar
```

Tiga plugin lokal di-link lewat path relatif, bukan disalin:

```json
"@local/ai-diagram-studio": "link:./plugins/ai-diagram-studio"
```

Path relatif inilah yang membuat repo portabel. Jangan diganti menjadi `link:/home/...`.

## Prasyarat

| Kebutuhan | Dipakai oleh |
| --- | --- |
| Node.js >= 20, pnpm 11 | semua |
| DSH `0.2.2-rc.2` terpasang | semua |
| Chromium/Chrome | render PNG/PDF (`ai-diagram-studio`, `ai-pdf-studio`) |
| Poppler (`pdfinfo`, `pdftoppm`, `pdftotext`) + `python3` dengan Pillow | inspeksi & metrik halaman PDF |
| Opsional: browser Playwright | bundle `playwright-browser` |

Deteksi Chromium: `DIAGRAM_CHROMIUM` / `CHROMIUM_PATH` → Playwright `chromium-*/chrome-linux64/chrome` → `/usr/bin/chromium` → `/usr/bin/chromium-browser` → `/usr/bin/google-chrome`. Tanpa Chromium, SVG dan seluruh validasi semantik tetap berjalan; permintaan PNG/PDF gagal dengan `renderer_unavailable`.

Poppler biasanya tersedia lewat paket distro `poppler-utils`; Pillow lewat `python3-pil` atau `pip` bila tersedia.

## Pasang di mesin baru

```bash
git clone git@github.com:nyxsr/dsh-plugins.git "${DSH_HOME:-$HOME/.dsh}/profiles/web"
cd "${DSH_HOME:-$HOME/.dsh}/profiles/web"
pnpm install
dsh web
```

`pnpm install` mengambil enam bundle pihak ketiga dari npm/GitHub dan me-link tiga plugin dari `plugins/`. Lockfile menjamin versi yang sama dengan mesin asal.

Verifikasi komposisi tanpa boot:

```bash
dsh --profile web --dump-config | grep '^# =='
```

Setiap bundle muncul sebagai komentar layer, dengan urutan yang sama seperti `dsh.profile.bundles`.

## Bundle yang aktif

Urutan array di `dsh.profile.bundles` adalah urutan layer: bundle berikutnya boleh meng-override baris dari bundle sebelumnya.

| # | Bundle | Sumber |
| --- | --- | --- |
| 1 | `@deepseek-ai/dsh-base` | instalasi DSH |
| 2 | `@deepseek-ai/dsh-web-app` | instalasi DSH |
| 3 | `@local/storage-insights` | `plugins/storage-insights` |
| 4 | `dsh-plugin` | npm `^2.3.6` |
| 5 | `billion-context` | npm `^0.1.213` |
| 6 | `dsh-better-sidebar` | npm `0.30.1` |
| 7 | `dsh-plugin-wallpaper-engine` | npm `1.4.2` |
| 8 | `@local/ai-pdf-studio` | `plugins/ai-pdf-studio` |
| 9 | `dsh-ops` | npm `0.5.2` |
| 10 | `playwright-browser` | `github:whklwhkl/dsh-playwright` |
| 11 | `@local/ai-diagram-studio` | `plugins/ai-diagram-studio` |

Dua entri pertama milik instalasi DSH, bukan isi repo ini. Jangan mengubah urutan tanpa alasan: ia menentukan layer mana yang menang saat ada baris yang sama.

## Konfigurasi

`cordis.patch.yml` adalah layer terakhir dan milik pengguna, bukan milik bundle.

| Row | Efek |
| --- | --- |
| `ui-settings-general` | `welcomeNoticeVersion: 2026-09-28.1` |
| `agent-default-model` | provider `deepseek-account`, model `deepseek-flash` |
| `llm-pi-ai` | provider `zai` dengan `apiKeyEnv: ZAI_API_KEY` |
| `ui-theme` | `preference: dark` |
| `better-sidebar` | `agentOpenTools: true` |
| `codex-subscription` | `quickQuotaMode: percent` |

`apiKeyEnv` hanya menyimpan **nama** variabel environment; nilainya tidak pernah masuk repo. Kredensial DSH berada di `~/.dsh/.credentials.yaml` dan tidak ikut di-commit.

## Yang tidak di-commit

| Path | Alasan |
| --- | --- |
| `node_modules/` | hasil `pnpm install`, ~515 MB di profil lengkap |
| `plugins/*/outputs/` | artefak generate, dibuat ulang oleh tiap plugin |
| `plugins/*/tests/.tmp/` | scratch test (~54 MB di `ai-pdf-studio`) |
| `*.log`, `coverage/`, `.env*` | log, laporan, dan rahasia |

Di luar repo dan tidak perlu di-backup sebagai kode: `~/.dsh/sessions`, `~/.dsh/storages`, `~/.dsh/.credentials.yaml`, `~/.dsh-wallpaper-engine` (state plugin wallpaper), dan `.diagram-studio/` (registry diagram).

Commit pertama berisi ~155 file, pack ~780 KiB. Kalau `git status` tiba-tiba menampilkan puluhan MB, `.gitignore` sedang tidak berlaku — periksa sebelum `git add`.

## Alur kerja

### Mengubah plugin

```bash
cd ~/dsh-config
# sunting plugins/<nama>/...
cd plugins/ai-pdf-studio && node --test        # atau: pnpm test
cd ~/dsh-config
git add -A && git commit -m "pdf: perbaiki X"
git push
```

Perubahan langsung terpakai oleh DSH karena profil menunjuk ke direktori ini lewat link; boot ulang hanya perlu bila plugin menambah baris Host baru.

### Menambah plugin pihak ketiga

```bash
cd "${DSH_HOME:-$HOME/.dsh}/profiles/web"
dsh plugin --profile web add <nama-paket>
```

Perintah itu memperbarui `package.json` (dependensi + `dsh.profile.bundles`) dan lockfile. Di mesin ini, salin perubahan itu ke repo atau jalankan profil langsung dari repo (lihat bagian berikut), lalu commit.

### Menambah plugin lokal

1. Taruh paketnya di `plugins/<nama>/` dan pastikan `package.json`-nya mendeklarasikan `dsh.bundle.patch`.
2. Tambahkan dependensi `"@local/<nama>": "link:./plugins/<nama>"`.
3. Tambahkan `@local/<nama>` ke `dsh.profile.bundles` pada posisi yang diinginkan.
4. `pnpm install`.

### Menjalankan tes

```bash
cd plugins/ai-diagram-studio && node --test tests/*.test.js
cd plugins/ai-pdf-studio && node --test
```

Tes yang merender atau mengukur PDF membutuhkan Chromium dan Poppler.

## Memakai repo ini di mesin ini

Repo berada di `~/dsh-config`, sedangkan DSH membaca profil di `~/.dsh/profiles/web`. Keduanya harus saling menunjuk. Dua pilihan:

**A. Profil menunjuk ke repo (path absolut).** Sederhana, tetapi `package.json` profil berbeda dari repo sehingga perlu disalin setiap kali plugin berubah:

```bash
cd ~/.dsh/profiles/web
pnpm remove @local/ai-diagram-studio @local/ai-pdf-studio @local/storage-insights
pnpm add "link:$HOME/dsh-config/plugins/ai-diagram-studio" \
         "link:$HOME/dsh-config/plugins/ai-pdf-studio" \
         "link:$HOME/dsh-config/plugins/storage-insights"
```

**B. Repo menjadi direktori profil.** Tidak ada salinan kedua: `dsh plugin add` dan editor konfigurasi menulis langsung ke file repo.

```bash
mv ~/.dsh/profiles/web ~/.dsh/profiles/web.backup
ln -s ~/dsh-config ~/.dsh/profiles/web
cd ~/.dsh/profiles/web && pnpm install
```

Opsi B paling dekat dengan "satu sumber kebenaran", tetapi belum diuji pada instalasi ini: pastikan DSH mengikuti symlink direktori, lalu periksa `dsh --profile web --dump-config`. Opsi A paling aman karena hanya mengubah satu dependensi.

Pada kedua opsi, symlink `node_modules/@local/*` harus menunjuk ke `~/dsh-config/plugins/*`:

```bash
readlink -f ~/.dsh/profiles/web/node_modules/@local/ai-pdf-studio
```

Sebelum salah satu opsi dijalankan, profil lama masih menunjuk ke path workspace yang sudah tidak ada, sehingga ketiga plugin lokal tidak termuat.

## Troubleshooting

| Gejala | Penyebab & tindakan |
| --- | --- |
| Plugin lokal tidak muncul setelah direktori dipindah | symlink `node_modules/@local/*` dangling. Jalankan `pnpm install` di direktori profil, lalu cek dengan `readlink -f`. |
| `ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND` | nilai `link:` menunjuk path yang tidak ada. Perbaiki menjadi `link:./plugins/<nama>`. |
| Perubahan `package.json` tidak berpengaruh | layer belum dikomposisi ulang. Boot ulang DSH; cek dengan `dsh --profile web --dump-config`. |
| `renderer_unavailable` saat PNG/PDF | Chromium tidak ditemukan. Set `CHROMIUM_PATH` ke binary yang valid. |
| Metrik PDF kosong / inspeksi dangkal | `pdfinfo`/`pdftoppm` atau Pillow tidak terpasang. |
| `git status` menampilkan `node_modules` | `.gitignore` tidak terbaca (mis. file terhapus). Kembalikan sebelum commit. |

Untuk melihat kenapa sebuah baris menang, bandingkan seluruh layer:

```bash
dsh --profile web --dump-config | less
```
