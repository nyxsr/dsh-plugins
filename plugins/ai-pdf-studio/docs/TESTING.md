# Pengujian

## Perintah

```bash
cd ai-pdf-studio
node --test --test-concurrency=1 tests/unit tests/integration tests/visual
```

## Hasil yang diamati

```
tests 41
pass 41
fail 0
cancelled 0
skipped 0
duration_ms ~111000
```

Angka ini bukti eksekusi, bukan prediksi. Suite merender PDF sungguhan dan memanggil subproses sungguhan.

## Cakupan

| Suite | Tes | Yang diverifikasi |
|---|---:|---|
| `tests/unit/models.test.js` | 7 | enam contoh valid, orientasi, error blok/grafik/tabel, ID unik yang stabil, kelengkapan drop cap, alias bahasa, registri |
| `tests/unit/design.test.js` | 5 | 8 tema resolve dengan kontras badan/muted ≥4.5:1, tidak ada `--accent2` yang tidak terdefinisi, pemetaan kategori ke keluarga, 6 template dan pratinjau, kontras merek, adaptasi referensi |
| `tests/unit/repair.test.js` | 4 | teks dekat tepi memicu perbaikan margin, riwayat mencegah osilasi, konten dipertahankan, PDF hasil perbaikan lolos gate |
| `tests/unit/review.test.js` | 4 | 10 peran agen, gate gagal mengalahkan skor tinggi, disclosure yang hilang bersifat kritis, laporan bukti lengkap |
| `tests/integration/editing.test.js` | 8 | rotate/watermark/nomor halaman/metadata, path tidak aman, ekstraksi teks/gambar, desain ulang, penolakan PDF hasil pindai, analisis referensi, 10 operasi service, error validasi |
| `tests/integration/generation.test.js` | 8 | bundel bukti penuh, request tidak valid, placeholder outline, pelestarian sumber, brand kit, dokumen stres, path traversal/aset jarak jauh, escaping skrip |
| `tests/visual/demonstrations.test.js` | 4 | keenam demo approved, disclosure sintetis, kejujuran evaluator kritik visual, perilaku tinjauan eksplisit |
| `tests/visual/regression.test.js` | 1 | sampul cocok dengan baseline piksel tersimpan (RMSE ≤ 0.5, piksel berubah ≤ 0.5%) |

## Fixture stres

`stressDocument()` di `tests/helpers.js` berisi:

- tabel 60 baris dengan header berulang antar halaman
- URL panjang tanpa jeda
- campuran bahasa Indonesia dan Inggris
- Ångström, 日本語, العربية
- tiga jenis grafik
- heading panjang dan daftar berurut 12 item
- target jumlah halaman ≥ 8

Tes memastikan PDF ada, semua gate wajib lolos, semua baris dan teks campuran bahasa tetap bisa diekstrak, dan IR tidak berubah setelah rendering.

## Fixture perbaikan

`scripts/repair_demo.js` menghasilkan `outputs/repair-loop/`:

- margin awal: 12 pt kiri dan kanan
- masalah terdeteksi: teks badan dekat tepi
- perbaikan yang diterapkan: +8 pt kiri dan kanan
- efek: delta gate **+1**, delta skor **+24.9**, delta kritis **−1**
- hasil: semua 11 gate lolos, blok konten tidak berubah

## Regresi visual

Baseline: `tests/visual/baseline/page-01.png` (sampul dokumen mini yang deterministik).

Perbandingan: `scripts/compare_images.py` memakai Pillow dan melaporkan RMSE serta rasio piksel berubah. Tes menuntut dimensi identik dan toleransi di bawah RMSE 0.5 / 0.5% piksel berubah.

Untuk menyegarkan baseline dengan sengaja setelah perubahan visual yang disetujui:

```bash
node scripts/make_visual_baseline.js
```
