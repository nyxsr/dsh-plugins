# Batasan dan kemampuan yang tidak didukung

Batasan berikut berasal dari pengamatan, bukan peringatan teoretis. Semuanya tercermin di kode, laporan, dan asersi tes.

## Batasan karena lingkungan

- **Tanpa OCR.** `tesseract` tidak terpasang. `redesign_pdf` memunculkan `ocr_not_supported` kalau PDF tidak punya lapisan teks yang bisa dipakai. Dokumen hasil pindai tidak bisa didesain ulang otomatis.
- **Tanpa model visi di dalam mesin.** Kritikus visual memakai geometri kata dan metrik halaman Pillow yang deterministik. Tinjauan subjektif atau VLM hanya dipakai kalau pemanggil memberi `visual_review`. Kalau tidak, respons mencatat `subjective_review_performed: false`.
- **Tanpa tumpukan PDF Python.** Tidak ada pip, PyMuPDF, WeasyPrint, reportlab, atau Jinja2. Rendering memakai Chromium CDP, inspeksi memakai Poppler, penyuntingan memakai pdf-lib.
- **Tanpa pembuatan gambar eksternal.** Ilustrasi produk dan tanda merek adalah SVG orisinal. Pembuatan gambar tidak dibutuhkan untuk operasi dan tidak disambungkan.

## Batasan rendering

- **Bookmark tidak dibuat.** Outline dokumen dari Chromium hilang saat sampul dan badan digabung dengan pdf-lib.
- **Struktur PDF bertag hilang setelah penggabungan.** File hasil gabungan tetap valid dan bisa dicari, tetapi `pdfinfo` melaporkan `Tagged: no`. Struktur untuk pembaca layar jadi lebih lemah. Ini dilaporkan sebagai temuan teknis minor.
- **Judul bagian berjalan tidak dinamis.** Template header/footer Chromium hanya mendukung satu header berulang. Header menampilkan organisasi, judul dokumen, dan kategori, bukan judul bagian di tiap halaman.
- **Sampul full-bleed dirender terpisah.** Gate cakupan teks dan geometri mengecualikan sampul dari pemeriksaan tepi badan. Teks sampul yang keluar halaman tetap dilaporkan sebagai clipping.
- **Tanpa impor CSS/HTML sembarang.** Dokumen yang diimpor tidak bisa membawa HTML atau CSS. Renderer hanya menerima Document IR bertipe dan aset lokal.
- **Sebagian fitur CSS bergantung pada Chromium.** `color-mix()`, `text-wrap: balance`, dan `-webkit-text-stroke` dipakai. Semuanya jalan di Chrome 156, tetapi bisa tampil berbeda di mesin lain.
- **Tabel panjang terpecah antar halaman dengan header berulang**, tetapi tabel yang sangat lebar tidak otomatis ditransposisi atau dipecah menjadi beberapa tabel. Perencana perbaikan bisa memadatkan tabel, bukan menyusun ulang maknanya.

## Batasan desain berbasis referensi

- Nilai palet diambil dari halaman hasil render, bukan dari token sumber.
- Tipografi dan ukuran grid persis hanya perkiraan. Referensi berupa gambar tidak punya lapisan teks, jadi tidak ada pengukuran kolom, margin, atau skala huruf yang bisa diandalkan.
- Klasifikasi gaya bersifat heuristik. Pada referensi yang didemonstrasikan, sampul korporat navy gelap beraksen teal ditebak `luxury_elegant` dengan keyakinan 57%. Keyakinan dan peringatannya ikut diterbitkan. Profil buatan pengguna adalah fallback yang tepat.
- Mode fidelity referensi yang didukung: `inspired`, `brand_matched`, `layout_guided`. `layout_guided` sengaja melewatkan transfer warna dan hanya memakai tata letak serta kepadatan.
- Tidak ada karya seni terlindungi atau komposisi halaman khas yang disalin. Analisator mengeluarkan prinsip dan ukuran, bukan template halaman.

## Batasan penyuntingan PDF

- Penyuntingan tidak lossless. Content stream ditulis ulang. Anotasi rumit, field formulir, outline, dan sebagian struktur tautan bisa terpengaruh.
- Overlay teks (watermark, nomor halaman, header/footer) digambar di atas konten yang ada. API memperingatkan soal penutupan konten.
- `extract_images` memakai `pdfimages`, jadi hasilnya objek gambar raster terenkode, bukan karya vektor atau aset desain asli.
- `page_numbers` tidak mendeteksi nomor halaman yang sudah ada. Penomoran kedua akan menduplikasinya.
- Penanganan metadata pada `merge`/`reorder`/`remove_pages` bersifat best-effort.

## Batasan desain ulang

- Hanya ekstraksi lapisan teks. Tabel, grafik, gambar, catatan kaki, dan tata letak persisnya tidak dipulihkan.
- Deteksi heading bersifat heuristik. Bagian hasil rekonstruksi sebaiknya ditinjau dulu.
- Urutan baca multi-kolom bisa tidak sempurna.
- Teks hasil rekonstruksi dipertahankan, tetapi desain dan strukturnya baru.
- Referensi nyata hanya dipertahankan kalau ada di teks yang diekstrak. Mesin tidak mengarang sitasi.

## Batasan model kualitas

- Skor hanya alat diagnosis, bukan sertifikasi kualitas profesional.
- Dimensi konten memakai kelengkapan, jumlah kata, jumlah bagian, dan temuan editorial deterministik. Ia tidak memahami kualitas argumen.
- Dimensi visual bersifat heuristik kecuali tinjauan visual eksplisit diberikan. Ia tidak bisa menangkap setiap komposisi canggung yang akan terlihat oleh art director manusia.
- Konsistensi merek tidak dievaluasi kalau tidak ada brand kit. Bobotnya dikeluarkan, bukan diisi skor karangan.
- Perbaikan dibatasi tiga iterasi (empat percobaan termasuk render awal). Kalau gate masih gagal, artefak terverifikasi terbaik dikembalikan dengan `quality_failed` dan rincian gate yang gagal. Statusnya tidak pernah approved.
- Laporan kualitas menandai `needs_review` kalau masih ada temuan besar, meskipun skor aritmetiknya melewati target.

## Batasan data demo

Semua enam PDF demo dan dokumen berbasis referensi bersifat sintetis. Organisasi, orang, kutipan, angka, dan temuan di dalamnya fiktif. Tiga referensi di e-book dan makalah akademik adalah sumber terbitan nyata yang diberi label jelas sebagai referensi. Ketiganya bukan bukti untuk hasil sintetis.
