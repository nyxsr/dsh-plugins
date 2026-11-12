#!/usr/bin/env node
/**
 * Membangun enam berkas IR demonstrasi. Semua organisasi, angka, kutipan, dan
 * temuan bersifat fiktif dan ditandai sintetis secara eksplisit.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(ROOT, 'examples')
const created = '2026-11-10T08:00:00Z'

const p = (text, extra = {}) => ({ type: 'paragraph', text, ...extra })
const kpi = (items, title = '') => ({ type: 'kpi', items, title })
const chart = (chart_type, title, data, caption = 'Data demonstrasi sintetis.', extra = {}) => ({ type: 'chart', chart_type, title, data, caption, options: extra })
const table = (title, columns, rows, caption = 'Data demonstrasi sintetis.') => ({ type: 'table', title, columns, rows, caption })
const list = (items, ordered = false) => ({ type: 'list', items, ordered })
const callout = (title, text, tone = 'warning') => ({ type: 'callout', title, text, tone })
const quote = (text, attribution, role) => ({ type: 'quote', text, attribution, role })
const timeline = (items, title = '') => ({ type: 'timeline', items, title })
const diagram = (diagram_type, title, nodes, caption = '') => ({ type: 'diagram', diagram_type, title, nodes, caption })
const citation = (text, source, url, accessed) => ({ type: 'citation', text, source, url, accessed })
const image = (src, alt, caption, variant = 'standard') => ({ type: 'image', src, alt, caption, variant })
const equation = (plain, caption) => ({ type: 'equation', plain, caption })

const report = {
  document_id: 'demo-business-performance-report',
  title: 'Tinjauan Operasi Kuartal III 2026',
  subtitle: 'Kisah kinerja sintetis untuk Northstar Analytics: pertumbuhan, efisiensi, dan keputusan yang menanti',
  eyebrow: 'Paket dewan · Kuartal III 2026',
  category: 'report',
  language: 'id',
  audience: 'Dewan dan jajaran eksekutif',
  purpose: 'Menjelaskan kinerja kuartal, memisahkan sinyal dari kebisingan, lalu menyepakati tiga keputusan operasi',
  tone: 'Tenang, berbasis bukti, langsung',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A4' },
  theme: { family: 'modern_corporate' },
  brand: {
    organization: 'Northstar Analytics',
    logo_path: 'assets/brand/northstar.svg',
    colors: { primary: '#0B6E6E', accent: '#D98E2B' },
    website: 'northstar.example (fiktif)',
  },
  metadata: { author: 'Kantor Strategi Northstar (fiktif)', organization: 'Northstar Analytics', created_at: created, keywords: ['tinjauan operasi', 'sintetis', 'kinerja'], date: created },
  cover: { stats: [{ value: '$27.3M', label: 'Pendapatan kuartal' }, { value: '18.4%', label: 'Pertumbuhan tahunan' }, { value: '23.1%', label: 'Margin operasi' }] },
  sections: [
    {
      title: 'Ringkasan eksekutif', kicker: '01 · Satu halaman untuk kuartal ini',
      blocks: [
        p('Northstar Analytics menutup kuartal ketiga 2026 dengan pendapatan $27.3 juta, 6.6% di atas rencana dan 18.4% lebih tinggi dari kuartal yang sama tahun lalu. Pertumbuhan datang dari perluasan akun enterprise, siklus penjualan mid-market yang lebih pendek, dan konversi yang membaik di kanal mitra. Margin kotor selesai di 69.2%. Margin operasi menyentuh 23.1%. Semua angka, organisasi, dan kutipan di dokumen ini sintetis. Laporan ini dibuat untuk menunjukkan alur produksi editorial dan visual secara utuh.', { lead: true, dropcap: true }),
        p('Kuartal ini sehat, tetapi tidak sehat merata. Perluasan akun enterprise menopang hasil, sementara akuisisi pelanggan baru di mid-market masih di bawah rencana operasi. Selisih itu penting karena perusahaan sedang sengaja menggeser belanja ke kanal yang bisa diulang. Jawaban yang tepat bukan merayakan angka utama sambil membiarkan bauran pendapatan tanpa pemeriksaan. Yang perlu dilakukan justru tiga hal: jaga basis perpanjangan, biayai sisi yang paling kuat, dan persempit jarak antara indikator awal dan keputusan.'),
        kpi([
          { label: 'Pendapatan', value: '$27.3', unit: 'M', delta: '+6.6% vs rencana', tone: 'positive', note: 'Angka sintetis' },
          { label: 'Margin kotor', value: '69.2', unit: '%', delta: '+1.2 poin', tone: 'positive', note: 'Angka sintetis' },
          { label: 'Margin operasi', value: '23.1', unit: '%', delta: '+1.8 poin', tone: 'positive', note: 'Angka sintetis' },
          { label: 'Retensi pendapatan bersih', value: '112', unit: '%', delta: '+4 poin', tone: 'positive', note: 'Angka sintetis' },
        ]),
        callout('Cara membaca laporan ini', 'Cerita di sini memisahkan hasil, pemicu, dan keputusan. Angka tanpa keputusan hanya konteks. Keputusan tanpa pemilik dan tanggal hanya keinginan. Semua data sintetis dan tidak boleh dianggap sebagai klaim tentang perusahaan nyata mana pun.', 'info'),
      ],
    },
    {
      title: 'Kinerja terhadap rencana', kicker: '02 · Hasil dan arah',
      blocks: [
        p('Pendapatan naik terus sepanjang tahun, tetapi bentuk kurvanya lebih memberi pelajaran daripada angka akhirnya. Kuartal kedua terbantu dua perluasan enterprise yang besar. Kuartal ketiga terbantu oleh perluasan yang lebih banyak tetapi lebih kecil, ditambah konversi yang membaik sedikit. Pola ini lebih sehat karena mengurangi ketergantungan pada beberapa akun saja, walau selisih di atas rencana sedikit lebih kecil dari kuartal sebelumnya.'),
        chart('line', 'Pendapatan kuartalan dibandingkan rencana', {
          categories: ['Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26'],
          series: [
            { name: 'Pendapatan aktual', values: [20.1, 21.4, 22.4, 23.1, 25.2, 27.3] },
            { name: 'Rencana operasi', values: [20.8, 21.2, 22.5, 23.4, 24.8, 25.6] },
          ],
        }, 'Data demonstrasi sintetis. Dalam juta USD.'),
        p('Garis rencana direvisi dua kali selama periode ini. Revisi terakhir menyusul perpanjangan enterprise di kuartal kedua. Terhadap rencana yang berlaku sekarang, kelebihan di kuartal ketiga terkonsentrasi di pendapatan perluasan dan layanan tambahan. Pendapatan dari pelanggan baru 3.1% di bawah rencana. Bedanya penting. Perluasan adalah sinyal kualitas. Lemahnya pelanggan baru adalah indikator awal risiko cakupan di masa depan.'),
        kpi([
          { label: 'Pencapaian rencana', value: '106.6', unit: '%', delta: '+6.6 poin', tone: 'positive' },
          { label: 'Pendapatan perluasan', value: '$8.9', unit: 'M', delta: '+14.2% QoQ', tone: 'positive' },
          { label: 'Pendapatan baru', value: '$4.4', unit: 'M', delta: '-3.1% vs rencana', tone: 'negative' },
        ]),
      ],
    },
    {
      title: 'Bauran pendapatan', kicker: '03 · Dari mana pertumbuhan datang',
      blocks: [
        p('Segmen enterprise sekarang menyumbang 30% pendapatan, naik dari 26% setahun lalu. Perpanjangan inti masih jadi kumpulan terbesar, tetapi porsinya turun perlahan seiring perusahaan menambah akun besar dan layanan bernilai lebih tinggi. Pasar baru menyumbang 16% dan tumbuh paling cepat dalam persentase, dari basis yang kecil. Kombinasi itu bagus hanya kalau biaya melayani segmen baru tidak menghapus keunggulan margin yang sudah ada.'),
        chart('bar', 'Kontribusi pendapatan menurut segmen', {
          categories: ['Inti', 'Enterprise', 'Pasar baru', 'Layanan'],
          series: [{ name: 'Pendapatan', values: [11.5, 8.2, 4.4, 3.2] }],
        }, 'Data demonstrasi sintetis. Dalam juta USD.'),
        table('Pendapatan dan selisih rencana menurut segmen', [
          { key: 'segment', label: 'Segmen', width: 22 },
          { key: 'revenue', label: 'Pendapatan Q3 ($M)', align: 'right', width: 18 },
          { key: 'growth', label: 'Pertumbuhan YoY', align: 'right', width: 16 },
          { key: 'share', label: 'Porsi', align: 'right', width: 12 },
          { key: 'variance', label: 'vs rencana', align: 'right', width: 16 },
        ], [
          { segment: 'Inti', revenue: '11.5', growth: '+11.2%', share: '42%', variance: '+4.1%' },
          { segment: 'Enterprise', revenue: '8.2', growth: '+28.6%', share: '30%', variance: '+12.4%' },
          { segment: 'Pasar baru', revenue: '4.4', growth: '+31.0%', share: '16%', variance: '-3.1%' },
          { segment: 'Layanan', revenue: '3.2', growth: '+9.4%', share: '12%', variance: '+8.7%' },
        ], 'Data demonstrasi sintetis. Persentase hanya ilustrasi.'),
        p('Kelebihan di segmen enterprise memang nyata di dalam simulasi, tetapi juga terkonsentrasi. Tiga akun menyumbang 61% dari kenaikan segmen. Dewan perlu bertanya apakah konsentrasi itu pijakan yang disengaja atau ketergantungan yang kebetulan. Saran kami, perlakukan sebagai pijakan untuk dua kuartal ke depan, lalu tetapkan batas konsentrasi sebelum siklus perencanaan berikutnya.'),
      ],
    },
    {
      title: 'Efisiensi operasi', kicker: '04 · Biaya, bukan hanya pertumbuhan',
      blocks: [
        p('Beban operasi naik 11.9% dibanding tahun lalu, lebih lambat dari pendapatan. Selisih itulah sumber perbaikan margin operasi. Penjualan dan pemasaran tetap jadi pos biaya terbesar, disusul riset dan pengembangan. Biaya umum dan administrasi praktis datar secara absolut, dan itu wajar pada skala sekarang. Jadi cerita efisiensi di sini bukan cerita memotong biaya. Ini soal mengurutkan investasi mengikuti permintaan.'),
        table('Jembatan biaya operasi', [
          { key: 'line', label: 'Pos biaya', width: 34 },
          { key: 'actual', label: 'Aktual Q3 ($M)', align: 'right', width: 18 },
          { key: 'revenue', label: '% dari pendapatan', align: 'right', width: 16 },
          { key: 'plan', label: 'Rencana ($M)', align: 'right', width: 14 },
          { key: 'variance', label: 'Selisih', align: 'right', width: 14 },
        ], [
          { line: 'Penjualan dan pemasaran', actual: '5.8', revenue: '21.2%', plan: '5.6', variance: '+3.6%' },
          { line: 'Riset dan pengembangan', actual: '4.1', revenue: '15.0%', plan: '4.0', variance: '+2.5%' },
          { line: 'Keberhasilan pelanggan', actual: '1.8', revenue: '6.6%', plan: '1.9', variance: '-5.3%' },
          { line: 'Umum dan administrasi', actual: '1.4', revenue: '5.1%', plan: '1.4', variance: '0.0%' },
          { line: 'Total beban operasi', actual: '13.1', revenue: '48.0%', plan: '12.9', variance: '+1.6%' },
        ], 'Data demonstrasi sintetis.'),
        callout('Efisiensi bukan berarti menahan diri', 'Perusahaan tidak berusaha membelanjakan lebih sedikit secara absolut. Yang dikejar adalah memperpendek jeda antara sinyal permintaan yang terbukti dan kapasitas untuk melayaninya. Pos biaya boleh tumbuh lebih lambat dari pendapatan asalkan kualitas layanan tidak menurun.', 'success'),
        p('Risiko dua kuartal ke depan bukan permintaan yang kurang, melainkan kapasitas implementasi enterprise yang jadi penghambat. Pendapatan layanan tumbuh 9.4%, tetapi utilisasi tim implementasi berakhir di 87%, di atas rentang yang nyaman. Kalau pipeline enterprise terkonversi sesuai rencana, perusahaan perlu menambah kapasitas implementasi sebelum menambah program pencarian permintaan lagi.'),
      ],
    },
    {
      title: 'Sinyal pelanggan', kicker: '05 · Retensi dan kepercayaan',
      blocks: [
        quote('Kami tidak butuh dashboard lain. Kami butuh tiga angka yang sama punya arti yang sama di setiap percakapan.', 'Wawancara pelanggan sintetis', 'Pemimpin operasi, akun enterprise (fiktif)'),
        kpi([
          { label: 'Retensi pendapatan bersih', value: '112', unit: '%', delta: '+4 poin YoY', tone: 'positive' },
          { label: 'Churn akun', value: '4.1', unit: '%', delta: '-0.6 poin YoY', tone: 'positive' },
          { label: 'NPS hubungan', value: '48', delta: '+5 poin', tone: 'positive', note: 'Survei sintetis' },
        ]),
        p('Retensi membaik, tetapi sinyal kualitatifnya lebih campur. Pelanggan menghargai keandalan produk dan kedalaman tim akun. Mereka kurang puas dengan banyaknya tempat yang harus dibuka untuk menjawab satu pertanyaan sederhana. Masalahnya bukan kekurangan fitur. Masalahnya koherensi. Pelanggan semestinya bisa berpindah dari sinyal kinerja ke catatan di baliknya tanpa mengganti istilah, format ekspor, atau pemilik.'),
        p('Dari situ muncul prioritas praktis untuk kuartal depan, yaitu mengurangi jumlah definisi “akun sehat” yang saling bersaing. Tim komersial memakai probabilitas perpanjangan. Tim produk memakai kursi aktif mingguan. Tim keberhasilan pelanggan memakai skor gabungan. Masing-masing masuk akal kalau berdiri sendiri. Bersama-sama, ketiganya menimbulkan gesekan tepat saat pelanggan butuh jawaban yang jelas.'),
      ],
    },
    {
      title: 'Keputusan dan langkah berikutnya', kicker: '06 · Apa yang berubah sekarang',
      blocks: [
        p('Kuartal ini tidak membutuhkan strategi baru. Yang dibutuhkan tiga keputusan yang membuat strategi yang ada lebih mudah dijalankan. Setiap keputusan punya pemilik, titik pemeriksaan bertanggal, dan uji terukur untuk melihat apakah keputusan itu berhasil. Dewan diminta menyetujui keputusannya, bukan mengulang perdebatan diagnosis.'),
        timeline([
          { date: 'Paling lambat 15 Desember', title: 'Lindungi basis perpanjangan inti', text: 'Pindahkan 40 perpanjangan teratas ke satu rencana akun dengan satu definisi kesehatan dan satu sponsor eksekutif. Pemilik: Chief Customer Officer.' },
          { date: 'Paling lambat 31 Januari', title: 'Biayai sisi terkuat dengan sengaja', text: 'Geser 8% belanja pemasaran diskresioner dari akuisisi luas ke perluasan enterprise lewat mitra. Pemilik: Chief Revenue Officer.' },
          { date: 'Mulai Februari', title: 'Rapatkan ritme operasi', text: 'Ganti tinjauan metrik bulanan dengan tinjauan keputusan dua mingguan yang berfokus pada indikator awal dan dependensi yang masih terbuka. Pemilik: Chief Operating Officer.' },
        ]),
        p('Keputusannya sengaja sempit. Program yang terlalu luas cenderung menghasilkan aktivitas tanpa uji yang jelas. Kalau kelompok perpanjangan membaik dan pipeline dari mitra tumbuh tanpa penurunan margin kotor, model operasinya bekerja. Kalau tidak, perusahaan sudah punya bukti cukup awal untuk berbelok sebelum siklus perencanaan berikutnya dimulai.'),
        callout('Keputusan yang diminta', 'Setujui tiga langkah tadi beserta batasnya: kualitas implementasi tidak turun, kedalaman diskon tidak bertambah, dan tidak ada belanja akuisisi pelanggan baru sampai pilot mitra punya biaya terukur per peluang yang lolos kualifikasi.', 'accent'),
      ],
    },
  ],
}

const proposal = {
  document_id: 'demo-strategic-business-proposal',
  title: 'Membangun Mesin Pertumbuhan yang Tahan Siklus',
  subtitle: 'Proposal strategis untuk merancang sistem akuisisi dan retensi yang terukur, bukan kampanye yang cepat menguap',
  eyebrow: 'Proposal strategis · 2027',
  category: 'proposal',
  language: 'id',
  audience: 'Dewan direksi dan komite investasi PT Sinar Nusantara (entitas fiktif)',
  purpose: 'Meyakinkan klien agar memilih pendekatan sistem pertumbuhan yang bisa diulang, bukan taktik pemasaran tunggal',
  tone: 'Tenang, argumentatif, transparan',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A4' },
  theme: { family: 'premium_editorial' },
  brand: {
    organization: 'Lumina Advisory',
    logo_path: 'assets/brand/lumina.svg',
    colors: { primary: '#9C2C2C', accent: '#B89457' },
    website: 'lumina.example (fiktif)',
  },
  metadata: { author: 'Lumina Advisory (fiktif)', organization: 'Lumina Advisory', created_at: created, keywords: ['proposal', 'strategi', 'sintetis'], date: created },
  cover: { stats: [{ value: '3', label: 'Pilar sistem' }, { value: '24', label: 'Minggu program' }, { value: '118%', label: 'Target retensi' }] },
  sections: [
    {
      title: 'Sudut pandang kami', kicker: '01 · Argumen utama',
      blocks: [
        p('Pertumbuhan yang sehat jarang lahir dari satu kampanye yang brilian. Ia lahir dari sistem yang menyambungkan sinyal pasar, keputusan penawaran, dan pengalaman pelanggan dalam satu ritme yang bisa diulang. Ketika ketiga bagian itu terpisah, organisasi membeli lebih banyak perhatian daripada yang bisa diubah menjadi hubungan. Biaya naik. Pembelajaran tidak menumpuk. Setiap kuartal dimulai lagi dari nol.', { lead: true, dropcap: true }),
        p('Lumina Advisory mengusulkan program 24 minggu untuk membangun mesin pertumbuhan yang tahan siklus. Program ini tidak dimulai dari daftar taktik. Ia dimulai dari tiga pertanyaan. Pelanggan mana yang benar-benar layak dilayani? Sinyal apa yang paling cepat menunjukkan kecocokan? Keputusan apa yang harus berubah ketika sinyal itu muncul? Jawaban ketiganya menjadi arsitektur sistem, bukan sekadar laporan strategi yang tebal.'),
        quote('Pertumbuhan yang baik bukan yang paling cepat, tetapi yang paling bisa diulang.', 'Sintesis wawancara riset Lumina', 'Demo sintetis, bukan testimoni nyata'),
        p('Kami tidak mengklaim pendekatan ini cocok untuk semua organisasi. Ia paling relevan ketika perusahaan sudah punya permintaan awal, tetapi belum punya cara yang konsisten untuk memilih, melayani, dan mempertahankan pelanggan terbaiknya. Kalau kondisi itu belum terpenuhi, pekerjaan pertama bukan kampanye. Pekerjaan pertama adalah menyelaraskan definisi dan kepemilikan data.'),
      ],
    },
    {
      title: 'Peluang yang kami lihat', kicker: '02 · Mengapa sekarang',
      blocks: [
        p('Dalam simulasi diagnostik yang kami susun untuk proposal ini, tiga pola muncul berulang. Pertama, biaya akuisisi naik lebih cepat daripada nilai kontrak awal. Kedua, pelanggan yang bertahan lebih dari dua belas bulan punya pola onboarding yang berbeda, tetapi pola itu tidak pernah jadi standar. Ketiga, tim penjualan dan tim layanan memakai definisi “pelanggan sehat” yang berbeda, sehingga eskalasi sering terlambat.'),
        kpi([
          { label: 'Pertumbuhan pipeline', value: '34', unit: '%', delta: 'target 12 bulan', tone: 'positive', note: 'Ilustrasi sintetis' },
          { label: 'Biaya akuisisi', value: '-22', unit: '%', delta: 'target program', tone: 'positive', note: 'Ilustrasi sintetis' },
          { label: 'Retensi bersih', value: '118', unit: '%', delta: 'target akhir', tone: 'accent', note: 'Ilustrasi sintetis' },
          { label: 'Periode balik modal', value: '9', unit: 'bln', delta: 'dari 14 bulan', tone: 'positive', note: 'Ilustrasi sintetis' },
        ]),
        chart('bar', 'Kontribusi kanal terhadap pertumbuhan pipeline', {
          categories: ['Rujukan', 'Komunitas', 'Konten', 'Penjualan langsung'],
          series: [{ name: 'Kontribusi', values: [34, 27, 22, 17] }],
        }, 'Ilustrasi sintetis. Persentase tidak mewakili perusahaan nyata.'),
        p('Peluang terbesar bukan menambah kanal baru. Peluang terbesar adalah menaikkan hasil dari kanal yang sudah terbukti, lalu menghentikan kanal yang hanya menghasilkan perhatian tanpa kualitas percakapan. Kedengarannya sederhana. Jarang diambil, karena setiap kanal punya pemilik, anggaran, dan cerita keberhasilannya sendiri.'),
      ],
    },
    {
      title: 'Hambatan yang harus diakui', kicker: '03 · Risiko dan batasan',
      blocks: [
        p('Program pertumbuhan lebih sering gagal karena hambatan organisasi daripada karena kurang ide. Empat hambatan berikut perlu diselesaikan sebelum desain solusi dimulai. Kalau salah satunya tidak bisa diselesaikan, ruang lingkup program harus dipersempit secara eksplisit.'),
        list([
          { title: 'Data yang tidak sepakat', text: 'Pipeline, pendapatan, dan retensi dihitung dengan definisi berbeda di setiap tim. Sistem baru akan mewarisi perselisihan ini kalau definisinya tidak dibekukan lebih dulu.' },
          { title: 'Kepemilikan yang tersebar', text: 'Tidak ada satu pemilik untuk perjalanan pelanggan dari sinyal pertama sampai perpanjangan kontrak. Akibatnya keputusan penting jatuh di antara fungsi.' },
          { title: 'Insentif yang berlawanan', text: 'Tim penjualan diukur pada kontrak baru, tim layanan diukur pada kepuasan, dan tim produk diukur pada penggunaan. Ketiganya masuk akal sendiri-sendiri, tetapi tidak selalu sejalan.' },
          { title: 'Kapasitas implementasi', text: 'Permintaan yang tumbuh tanpa kapasitas implementasi akan menciptakan utang pengalaman pelanggan yang mahal untuk diperbaiki.' },
        ]),
        callout('Batasan proposal', 'Seluruh angka, organisasi, dan kutipan dalam dokumen ini adalah ilustrasi sintetis. Proposal tidak memuat riset pasar nyata, testimoni nyata, atau komitmen hasil yang bisa dianggap jaminan.', 'warning'),
      ],
    },
    {
      title: 'Arsitektur solusi', kicker: '04 · Sistem, bukan daftar taktik',
      blocks: [
        p('Kami merancang empat lapisan yang saling mengunci. Lapisan pertama menjaga kebenaran data. Isinya satu definisi untuk pelanggan, satu definisi untuk kesehatan akun, dan satu sumber untuk pipeline. Lapisan kedua soal pemilihan, yaitu model kecocokan yang menghubungkan sinyal awal dengan nilai jangka panjang. Lapisan ketiga soal orkestrasi, yaitu urutan interaksi yang berubah berdasarkan sinyal, bukan kalender. Lapisan keempat soal pembelajaran. Setiap interaksi menghasilkan bukti yang memperbaiki model berikutnya.'),
        diagram('flow', 'Empat lapisan mesin pertumbuhan', [
          { id: 'truth', label: 'Kebenaran data', detail: 'Definisi tunggal untuk pelanggan, pipeline, dan kesehatan akun.' },
          { id: 'fit', label: 'Pemilihan', detail: 'Model kecocokan yang memisahkan sinyal dari kebisingan.' },
          { id: 'orchestration', label: 'Orkestrasi', detail: 'Urutan interaksi yang dipicu oleh sinyal.' },
          { id: 'learning', label: 'Pembelajaran', detail: 'Bukti dari setiap interaksi kembali ke model.' },
        ], 'Ilustrasi arsitektur sintetis.'),
        p('Setiap lapisan punya keluaran yang bisa diperiksa. Lapisan data menghasilkan kamus metrik dan pemiliknya. Dari lapisan pemilihan keluar kriteria kualifikasi dan daftar akun prioritas. Orkestrasi menghasilkan peta perjalanan dan aturan eskalasi, sedangkan lapisan pembelajaran menghasilkan siklus tinjauan dua mingguan. Tidak ada lapisan yang bergantung pada satu alat tertentu. Alat bisa diganti tanpa membongkar logika sistemnya.'),
        list([
          'Minggu 1-2: membekukan definisi dan memetakan sumber data.',
          'Minggu 3-6: membangun model kecocokan dan kriteria kualifikasi.',
          'Minggu 7-14: menjalankan pilot orkestrasi pada satu segmen.',
          'Minggu 15-24: memperluas, mengukur, dan menetapkan ritme operasi.',
        ], true),
      ],
    },
    {
      title: 'Rencana kerja', kicker: '05 · Urutan dan gerbang keputusan',
      blocks: [
        p('Program dibagi menjadi empat fase dengan gerbang keputusan di akhir setiap fase. Gerbang ini bukan formalitas. Kalau kriteria pada suatu gerbang tidak terpenuhi, program berhenti atau dipersempit sebelum biaya berikutnya keluar. Pendekatan ini melindungi klien dari program besar yang berjalan tanpa bukti di tengahnya.'),
        timeline([
          { date: 'Fase 1 · 2 minggu', title: 'Diagnostik dan pembekuan definisi', text: 'Wawancara pemangku kepentingan, audit data, dan penetapan satu kamus metrik. Keluaran: peta hambatan dan baseline.' },
          { date: 'Fase 2 · 4 minggu', title: 'Desain sistem', text: 'Model kecocokan, peta perjalanan, aturan eskalasi, dan spesifikasi dashboard keputusan. Keluaran: blueprint yang disetujui.' },
          { date: 'Fase 3 · 8 minggu', title: 'Pilot pada satu segmen', text: 'Implementasi terbatas dengan kelompok kontrol. Keluaran: bukti awal, biaya per hasil, dan daftar perbaikan.' },
          { date: 'Fase 4 · 10 minggu', title: 'Perluasan dan institusionalisasi', text: 'Perluasan kanal, pelatihan pemilik, dan ritme tinjauan dua mingguan. Keluaran: sistem yang berjalan tanpa ketergantungan konsultan.' },
        ]),
        p('Kami menyarankan pilot pada satu segmen dengan volume cukup untuk menghasilkan sinyal, tetapi cukup kecil untuk dihentikan tanpa kerusakan komersial. Segmen ideal punya setidaknya 40 akun, siklus penjualan di bawah enam bulan, dan data interaksi yang bisa diakses. Kalau segmen tidak memenuhi kriteria itu, ruang lingkup pilot harus diubah sebelum Fase 3.'),
      ],
    },
    {
      title: 'Investasi', kicker: '06 · Transparansi komersial',
      blocks: [
        p('Investasi di bawah ini adalah ilustrasi sintetis untuk menunjukkan struktur harga berbasis fase, bukan penawaran komersial nyata. Setiap fase punya keluaran yang jelas dan bisa dihentikan di gerbang keputusan. Biaya belum termasuk lisensi perangkat pihak ketiga atau belanja media yang dikeluarkan klien.'),
        table('Struktur investasi per fase', [
          { key: 'fase', label: 'Fase', width: 28 },
          { key: 'durasi', label: 'Durasi', width: 14 },
          { key: 'investasi', label: 'Investasi (Rp juta)', align: 'right', width: 20 },
          { key: 'keluaran', label: 'Keluaran utama', width: 38 },
        ], [
          { fase: 'Diagnostik', durasi: '2 minggu', investasi: '180', keluaran: 'Baseline, peta hambatan, kamus metrik' },
          { fase: 'Desain sistem', durasi: '4 minggu', investasi: '420', keluaran: 'Blueprint, model kecocokan, aturan eskalasi' },
          { fase: 'Pilot', durasi: '8 minggu', investasi: '640', keluaran: 'Bukti awal, biaya per hasil, daftar perbaikan' },
          { fase: 'Perluasan', durasi: '10 minggu', investasi: '760', keluaran: 'Sistem berjalan, pelatihan, ritme tinjauan' },
        ], 'Ilustrasi sintetis. Bukan penawaran komersial.'),
        callout('Apa yang tidak termasuk', 'Belanja media, lisensi perangkat lunak, penambahan anggota tim klien, dan pekerjaan integrasi data di luar satu sumber utama tidak termasuk dalam ilustrasi ini. Estimasi untuk hal-hal itu disusun setelah diagnostik, bukan sebelumnya.', 'info'),
      ],
    },
    {
      title: 'Mengapa Lumina', kicker: '07 · Cara kami bekerja',
      blocks: [
        p('Kami bekerja sebagai mitra desain, bukan vendor laporan. Artinya kami ikut membangun keputusan, bukan hanya menyerahkan slide. Tim inti terdiri dari tiga peran. Arsitek pertumbuhan memimpin desain sistem. Analis data menjaga definisi dan bukti. Operator komersial bekerja bersama tim klien di lapangan. Tidak ada peran yang hanya simbolis.'),
        list([
          { title: 'Kami memulai dari keputusan', text: 'Setiap dokumen dan lokakarya diakhiri dengan keputusan, pemilik, dan tanggal. Kalau tidak ada keputusan yang mungkin, kami mengatakan demikian.' },
          { title: 'Kami menunjukkan batasan', text: 'Kami tidak menjanjikan hasil yang tidak bisa diukur dengan data yang tersedia. Asumsi dan ketidakpastian ditulis terbuka.' },
          { title: 'Kami membangun agar dilepas', text: 'Keberhasilan program diukur dari kemampuan tim klien menjalankan sistem tanpa kami, bukan dari ketergantungan pada konsultan.' },
        ]),
        quote('Kami tidak menjual kepastian. Kami menjual cara yang lebih disiplin untuk mengurangi ketidakpastian.', 'Sintesis prinsip kerja Lumina', 'Dokumen demonstrasi sintetis'),
      ],
    },
    {
      title: 'Keputusan berikutnya', kicker: '08 · Tiga langkah',
      blocks: [
        p('Kalau arah ini sesuai, kami mengusulkan tiga langkah berikutnya. Pertama, lokakarya keputusan selama 90 menit bersama pemilik komersial, data, dan layanan untuk mengonfirmasi ruang lingkup dan hambatan. Kedua, diagnostik dua minggu untuk menguji asumsi dengan data yang tersedia. Ketiga, gerbang keputusan untuk menentukan apakah program lanjut ke desain sistem.'),
        callout('Yang kami minta dari Anda', 'Satu sponsor eksekutif, akses ke data pipeline dan retensi 12 bulan terakhir, serta kesediaan menghentikan program kalau gerbang diagnostik tidak terpenuhi. Kami tidak meminta komitmen anggaran penuh sebelum bukti awal tersedia.', 'success'),
        list([
          'Minggu ini: konfirmasi sponsor dan dua peserta lokakarya.',
          'Minggu depan: lokakarya keputusan 90 menit.',
          'Dua minggu setelahnya: presentasi temuan diagnostik dan rekomendasi gerbang.',
        ], true),
        p('Dokumen ini adalah demonstrasi sintetis yang disiapkan untuk AI PDF Studio Ultimate. Seluruh nama organisasi, angka, kutipan, dan skenario adalah fiksi. Tidak ada pernyataan di dalamnya yang boleh dikutip sebagai bukti kinerja atau janji komersial.'),
      ],
    },
  ],
}

const ebook = {
  document_id: 'demo-educational-ebook',
  title: 'Latihan Memperhatikan',
  subtitle: 'Panduan singkat merancang pembelajaran yang benar-benar diingat orang',
  eyebrow: 'Desain pembelajaran · Panduan lapangan',
  category: 'ebook',
  language: 'id',
  audience: 'Perancang pembelajaran, guru, dan fasilitator yang membangun pengalaman belajar',
  purpose: 'Mengajarkan satu model praktis untuk desain pembelajaran yang sadar perhatian, lalu memberi pembaca latihan mingguan yang bisa diulang',
  tone: 'Hangat, tepat, praktis',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A5' },
  theme: { family: 'minimalist_clean' },
  brand: {
    organization: 'The Attention Lab',
    logo_path: 'assets/brand/attention.svg',
    colors: { primary: '#E23B2E', accent: '#111111' },
    website: 'attention.example (fiktif)',
  },
  metadata: { author: 'The Attention Lab (fiktif)', organization: 'The Attention Lab', created_at: created, keywords: ['desain pembelajaran', 'perhatian', 'sintetis'], date: created },
  cover: { stats: [{ value: '5', label: 'Bab singkat' }, { value: '1', label: 'Latihan mingguan' }, { value: '12', label: 'Menit per studio' }] },
  sections: [
    {
      title: 'Cara memakai buku ini', kicker: 'Sebelum mulai',
      blocks: [
        p('Ini buku kecil tentang masalah besar. Sebagian besar pengalaman belajar dirancang untuk disampaikan, bukan untuk diingat. Isinya disusun mengikuti apa yang ingin dikatakan guru, apa yang ingin ditampilkan slide, atau apa yang ingin dicatat tim kepatuhan. Peserta diminta menyediakan perhatiannya, menyambung kepingan gagasannya, lalu menindaklanjuti sendiri. Kadang mereka berhasil. Sering tidak.', { lead: true }),
        p('Buku ini pendek karena memang dirancang begitu. Setiap bab memperkenalkan satu gagasan, satu latihan, dan satu kegagalan yang umum. Anda bisa menamatkannya dalam satu sore, tetapi buku ini lebih berguna dipakai sebulan. Baca satu bab, cobalah latihannya pada sesi nyata, lalu kembali ke ringkasan sebelum lanjut ke bab berikutnya. Tujuannya bukan cepat selesai. Tujuannya mengubah satu keputusan desain.'),
        list([
          { title: 'Baca sambil membayangkan satu sesi', text: 'Pilih lokakarya, pelajaran, atau urutan onboarding yang sedang Anda rancang. Biarkan sesi itu terlihat selama Anda membaca.' },
          { title: 'Kerjakan latihan kecilnya', text: 'Setiap bab ditutup dengan latihan sepuluh sampai lima belas menit. Kerjakan sebelum lanjut.' },
          { title: 'Tinjau tiap minggu', text: 'Pakai tinjauan mingguan di Bab 5 untuk melihat apa yang berubah pada perhatian dan ingatan peserta Anda.' },
        ]),
        callout('Catatan soal bukti', 'Panduan ini adalah demonstrasi sintetis. Isinya bersandar pada prinsip belajar yang sudah banyak dibahas, tetapi tidak melaporkan eksperimen baru dan tidak boleh dikutip sebagai bukti empiris. Daftar referensi di bagian akhir menunjuk ke sumber nyata untuk bacaan lanjutan.', 'info'),
      ],
    },
    {
      title: 'Bab 1: Perhatian adalah anggaran', kicker: 'Satu gagasan',
      blocks: [
        p('Perhatian bukan keran yang bisa dibuka selama satu jam. Perhatian itu anggaran yang terus terpakai. Setiap elemen di ruang belajar meminta penarikan: istilah baru, gambar hiasan, notifikasi, instruksi yang seharusnya sudah diberikan lebih awal. Ketika anggarannya habis, peserta tidak berhenti memperhatikan begitu saja. Mereka mulai memilih hal lain untuk diabaikan.'),
        p('Karena itu, “lebih banyak” sering jadi jawaban yang salah untuk peserta yang mulai lepas. Lebih banyak slide, lebih banyak contoh, dan lebih banyak detail bisa mengurangi perhatian untuk hal yang benar-benar penting. Tugas perancang bukan mengisi anggaran. Tugasnya memutuskan apa yang layak mendapat penarikan berikutnya, lalu membuang yang tidak.'),
        quote('Pertanyaannya bukan “bagaimana saya menarik perhatian mereka”, tetapi “saya meminta mereka membelanjakan perhatian untuk apa”.', 'Catatan pengajaran sintetis', 'The Attention Lab (fiktif)'),
        p('Ada uji praktis yang bisa dicoba sekarang. Buka kerangka sesi Anda, tandai setiap elemen sebagai penting, berguna, atau opsional. Kalau elemen opsional lebih banyak daripada yang penting, sesi itu mungkin meminta peserta memikul persiapan Anda, bukan pemahaman mereka. Buang satu elemen opsional sebelum menambah apa pun.'),
        callout('Coba ini: sekali lewat untuk mengurangi', 'Ambil sesi 45 menit. Buang satu slide, satu aktivitas, atau satu instruksi. Jangan ganti dengan yang lain. Jalankan sesinya, lalu perhatikan apakah ada yang penting hilang. Kalau tidak ada, elemen itu mungkin melayani perancang, bukan peserta.', 'success'),
      ],
    },
    {
      title: 'Bab 2: Tiga saringan', kicker: 'Sebuah model',
      blocks: [
        p('Informasi tidak masuk ke memori kerja dengan sendirinya. Ia melewati tiga saringan: sinyal, relevansi, dan usaha. Peserta harus menyadari sinyalnya, menilai relevansinya dengan tujuan yang ia pegang, dan bersedia mengeluarkan usaha. Desain bisa menopang ketiganya, tetapi tidak bisa menggantikan semuanya.'),
        diagram('cycle', 'Tiga saringan pembelajaran yang bertahan', [
          { id: 'signal', label: 'Sinyal', detail: 'Apakah peserta bisa melihat perbedaan yang penting?' },
          { id: 'relevance', label: 'Relevansi', detail: 'Apakah ini tersambung dengan tujuan yang sudah dipegang peserta?' },
          { id: 'effort', label: 'Usaha', detail: 'Apakah kerja mentalnya menantang tetapi masih bisa dicapai?' },
          { id: 'reward', label: 'Imbalan', detail: 'Apakah usahanya menghasilkan kemajuan yang terlihat?' },
        ], 'Diagram orisinal. Lingkarannya heuristik desain, bukan model tahapan yang sudah divalidasi.'),
        p('Sinyal soal kontras. Kalau semua elemen sama kerasnya, tidak ada yang menonjol. Relevansi soal sambungan. Sebuah fakta jadi mudah dipelajari ketika ia menjawab pertanyaan yang sudah ada di kepala peserta. Usaha soal tingkat kesulitan. Usaha terlalu sedikit menghasilkan kelancaran tanpa daya ingat. Usaha terlalu banyak menghasilkan penghindaran. Tugas perancang adalah menjaga peserta di pita sempit antara bosan dan kelebihan beban.'),
        list([
          { title: 'Sinyal', text: 'Pakai satu kontras kuat per layar atau halaman. Hindari aksen yang saling bersaing.' },
          { title: 'Relevansi', text: 'Buka dengan keputusan atau masalah yang akan dihadapi peserta, bukan dengan sejarah topiknya.' },
          { title: 'Usaha', text: 'Minta peserta mengingat sebelum memberi jawaban. Buat percobaan pertama mungkin dilakukan, bukan mudah.' },
        ]),
      ],
    },
    {
      title: 'Bab 3: Studio dua belas menit', kicker: 'Sebuah latihan',
      blocks: [
        p('Studio dua belas menit adalah struktur kecil yang bisa diulang untuk satu segmen belajar. Ini bukan rencana pelajaran lengkap. Ini cara menjaga perhatian sambil membuat peserta mengerjakan kerja kognitif yang membentuk memori. Strukturnya punya empat bagian: satu pertanyaan, percobaan pertama, penjelasan singkat, dan tugas mengingat.'),
        timeline([
          { date: '0-2 menit', title: 'Pertanyaan', text: 'Ajukan satu keputusan atau masalah konkret. Jangan jelaskan konsepnya dulu.' },
          { date: '2-5 menit', title: 'Percobaan pertama', text: 'Minta peserta memilih jawaban, prediksi, atau pilihan desain. Jawaban salah adalah data yang berguna.' },
          { date: '5-9 menit', title: 'Penjelasan', text: 'Ajarkan gagasan terkecil yang menyelesaikan ketegangan tadi. Pakai satu contoh dan satu contoh tandingan.' },
          { date: '9-12 menit', title: 'Mengingat kembali', text: 'Minta peserta menyusun ulang gagasannya dari ingatan, lalu bandingkan dengan penjelasan.' },
        ]),
        p('Studio ini bekerja karena membalik urutan yang biasa. Sebagian besar sesi menjelaskan dulu, bertanya belakangan. Peserta pun merasa sudah paham sebelum sempat mengujinya. Percobaan pertama menciptakan kebutuhan untuk tahu. Penjelasan mendarat tepat di kebutuhan itu, bukan datang sebelum kebutuhan itu ada.'),
        callout('Jangan lewati percobaan pertama', 'Percobaan pertama tidak perlu dinilai. Tujuannya membuat model yang dipegang peserta sekarang terlihat, baik oleh peserta maupun fasilitator. Jawaban pertama yang salah bukan kegagalan studio. Justru itu alasan studio ini bekerja.', 'accent'),
      ],
    },
    {
      title: 'Bab 4: Jebakan yang sering muncul', kicker: 'Yang perlu dihindari',
      blocks: [
        p('Sebagian besar masalah perhatian tidak lahir dari kurangnya karisma. Ia lahir dari pilihan desain yang terasa membantu saat itu dan menimbulkan biaya kemudian. Jebakan di bawah ini umum di lokakarya, e-learning, dan pelatihan teknis. Tidak ada yang fatal sendirian. Bersama-sama, mereka menjelaskan kenapa sebuah sesi bisa terasa hidup tetapi menghasilkan sedikit sekali ingatan.'),
        table('Lima jebakan desain dan penggantinya', [
          { key: 'trap', label: 'Jebakan', width: 30 },
          { key: 'symptom', label: 'Bentuknya di lapangan', width: 34 },
          { key: 'replacement', label: 'Langkah yang lebih baik', width: 36 },
        ], [
          { trap: 'Berpikir cakupan', symptom: 'Setiap topik dapat satu slide', replacement: 'Pilih dua keputusan dan gali dalam' },
          { trap: 'Ilusi kelancaran', symptom: 'Peserta mengangguk saat Anda menjelaskan', replacement: 'Minta mereka mengingat sebelum ringkasan' },
          { trap: 'Beban hiasan', symptom: 'Gambar dan ikon bersaing dengan gagasannya', replacement: 'Satu visual yang membawa argumen' },
          { trap: 'Mengajar jawaban lebih dulu', symptom: 'Konsep datang sebelum pertanyaannya', replacement: 'Buka dengan prediksi atau dilema' },
          { trap: 'Tanpa jeda mengingat', symptom: 'Sesi ditutup dengan ringkasan', replacement: 'Jadwalkan tugas mengingat singkat dua hari kemudian' },
        ], 'Contoh pengajaran sintetis, bukan temuan riset.'),
        p('Jebakan paling mahal adalah ringkasan di akhir. Ringkasan terasa seperti pemantapan, tetapi sering berubah jadi penjelasan kedua yang disampaikan justru saat perhatian paling rendah. Pertanyaan untuk mengingat biasanya lebih baik. Minta peserta menuliskan tiga keputusan yang akan mereka ubah, lalu bandingkan dengan pasangannya. Ringkasan bisa jadi satu halaman rujukan yang mereka bawa pulang, bukan pertunjukan di penghujung sesi.'),
      ],
    },
    {
      title: 'Bab 5: Tinjauan mingguan', kicker: 'Sebuah ritme',
      blocks: [
        p('Satu sesi yang bagus bukan sebuah praktik. Tinjauan mingguan adalah ritual dua puluh menit untuk melihat apa yang sebenarnya dihasilkan desain Anda. Ukurannya sengaja kecil: tiga pertanyaan, satu artefak, satu perubahan. Tujuannya bukan membuktikan bahwa sebuah teknik berhasil. Tujuannya memperpendek jarak antara pilihan desain dan efeknya pada peserta.'),
        list([
          { title: 'Apa yang berhasil diingat peserta?', text: 'Bawa satu bukti: jawaban kuis, pertanyaan yang muncul, atau tugas yang selesai tanpa bantuan.' },
          { title: 'Di mana perhatian menghilang?', text: 'Tandai momen di sesi ketika ruangan jadi pasif. Apa yang terjadi tepat sebelumnya?' },
          { title: 'Apa yang akan Anda kurangi?', text: 'Pilih satu elemen untuk dibuang atau ditunda pada iterasi berikutnya. Jangan menambah elemen baru di minggu yang sama.' },
        ], true),
        p('Jaga tinjauannya cukup singkat agar bertahan di minggu yang sibuk. Retrospektif panjang yang cuma terjadi sekali kalah berguna dari tinjauan pendek yang terjadi empat kali. Artefaknya bisa satu halaman saja: kerangka sesi dengan tiga catatan dan satu keputusan.'),
        callout('Tinjauan paling minimal', 'Kalau Anda hanya punya lima menit, jawab satu pertanyaan: apa yang bisa dilakukan peserta dari ingatan yang sebelumnya tidak bisa mereka lakukan? Kalau tidak bisa menjawabnya, keputusan desain berikutnya bukan aktivitas baru. Keputusan itu tugas mengingat yang lebih baik.', 'info'),
      ],
    },
    {
      title: 'Ringkasan', kicker: 'Seluruh buku dalam satu halaman',
      blocks: [
        p('Perhatian adalah anggaran. Mendesain berarti memutuskan apa yang layak mendapat penarikan berikutnya. Tiga saringan, yaitu sinyal, relevansi, dan usaha, adalah cara praktis memeriksa pengalaman belajar sebelum Anda menambah isinya. Studio dua belas menit mengubah saringan itu menjadi urutan yang bisa diulang. Tinjauan mingguan menjaga praktiknya tetap jujur.'),
        list([
          'Buang satu elemen opsional sebelum menambah yang baru.',
          'Buka dengan keputusan, bukan definisi.',
          'Minta percobaan pertama sebelum penjelasan.',
          'Tutup dengan mengingat kembali, bukan pertunjukan ringkasan.',
          'Tinjau satu artefak dan buat satu perubahan tiap minggu.',
        ]),
        p('Kalau hanya satu kalimat yang ingin Anda ingat, ambil ini: kerja mental peserta adalah kurikulumnya. Sisanya panggung.'),
      ],
    },
    {
      title: 'Glosarium', kicker: 'Bahasa bersama',
      blocks: [
        table('Istilah yang dipakai di panduan ini', [
          { key: 'term', label: 'Istilah', width: 28 },
          { key: 'meaning', label: 'Definisi kerja', width: 72 },
        ], [
          { term: 'Anggaran perhatian', meaning: 'Kapasitas kognitif terbatas yang bisa dialokasikan peserta untuk satu tugas dalam periode tertentu.' },
          { term: 'Mengingat kembali', meaning: 'Menyusun ulang informasi dari ingatan tanpa melihat sumbernya.' },
          { term: 'Ilusi kelancaran', meaning: 'Perasaan bahwa materi sudah dipahami karena mudah diikuti saat itu.' },
          { term: 'Beban hiasan', meaning: 'Elemen visual atau teks yang memakan perhatian tanpa menopang tujuan belajar.' },
          { term: 'Percobaan pertama', meaning: 'Jawaban awal peserta sebelum konsepnya dijelaskan.' },
          { term: 'Sinyal', meaning: 'Kontras yang membuat perbedaan penting jadi terlihat.' },
        ], 'Definisi kerja untuk panduan sintetis ini.'),
        p('Definisinya sengaja dibuat sederhana. Kosakata bersama berguna hanya kalau ia mengubah keputusan. Kalau sebuah istilah tidak membantu Anda memilih apa yang dibuang, apa yang ditanyakan, atau apa yang ditinjau, biarkan istilah itu tinggal di glosarium.'),
      ],
    },
    {
      title: 'Referensi dan bacaan lanjutan', kicker: 'Sumber nyata',
      blocks: [
        p('Sumber berikut nyata dan disediakan untuk bacaan lanjutan. Sumber-sumber ini tidak dipakai untuk menghasilkan data sintetis di panduan ini, dan panduan ini tidak mengklaim mereplikasi temuannya.'),
        citation('Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin, 132(3), 354-380.', 'Psychological Bulletin', 'https://doi.org/10.1037/0033-2909.132.3.354', '10 November 2026'),
        citation('Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. Psychological Science, 17(3), 249-255.', 'Psychological Science', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x', '10 November 2026'),
        citation('Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students’ learning with effective learning techniques: Promising directions from cognitive and educational psychology. Psychological Science in the Public Interest, 14(1), 4-58.', 'Psychological Science in the Public Interest', 'https://doi.org/10.1177/1529100612453266', '10 November 2026'),
      ],
    },
  ],
}

const presentation = {
  document_id: 'demo-investor-presentation',
  title: 'Vela: Infrastruktur Energi untuk Kota yang Bergerak',
  subtitle: 'Ringkasan investasi Seri A · demonstrasi sintetis',
  eyebrow: 'Paparan investor · 2027',
  category: 'presentation',
  language: 'id',
  audience: 'Investor institusional dan mitra strategis',
  purpose: 'Menyampaikan tesis investasi, bukti traksi sintetis, dan permintaan pendanaan dalam delapan slide',
  tone: 'Percaya diri, ringkas, berbasis bukti',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'Presentation16x9' },
  theme: { family: 'creative_bold' },
  brand: {
    organization: 'Vela Systems',
    logo_path: 'assets/brand/vela.svg',
    colors: { primary: '#D8FF3E', accent: '#2B4CFF' },
    website: 'vela.example (fiktif)',
  },
  metadata: { author: 'Vela Systems (fiktif)', organization: 'Vela Systems', created_at: created, keywords: ['paparan investor', 'energi', 'sintetis'], date: created },
  cover: { stats: [{ value: '42', label: 'Situs aktif' }, { value: '99,98%', label: 'Ketersediaan' }, { value: 'Rp 45 M', label: 'Putaran Seri A' }] },
  sections: [
    {
      title: 'Tesis', kicker: '01 · Satu kalimat',
      blocks: [
        p('Kota tidak kekurangan energi. Kota kekurangan cara untuk memindahkan, menyimpan, dan menjual energi pada waktu yang tepat. Vela membangun lapisan perangkat lunak dan operasi yang membuat aset energi terdistribusi bisa dipercaya oleh jaringan, pemilik gedung, dan penyedia kendaraan listrik dalam satu sistem. Bukan tiga sistem terpisah yang ditempel menjadi satu.', { lead: true }),
        kpi([
          { label: 'Situs aktif', value: '42', delta: '+11 kuartal ini', tone: 'positive', note: 'Data sintetis' },
          { label: 'Ketersediaan', value: '99,98', unit: '%', delta: 'target 99,95%', tone: 'positive', note: 'Data sintetis' },
          { label: 'Pendapatan berulang', value: 'Rp 8,5', unit: 'M', delta: '+34% QoQ', tone: 'positive', note: 'Data sintetis' },
        ]),
      ],
    },
    {
      title: 'Masalah', kicker: '02 · Biaya koordinasi',
      blocks: [
        p('Pemilik aset melihat potensi pendapatan. Operator jaringan melihat risiko. Penyedia layanan melihat kompleksitas integrasi. Tidak ada pihak yang punya gambaran waktu-nyata yang sama. Akibatnya kapasitas idle dibiarkan, permintaan puncak ditangani dengan pembangkitan mahal, dan investasi baru tertunda karena imbal hasilnya belum pasti.'),
        quote('Setiap kilowatt yang tidak terjadwal adalah biaya yang dibayar oleh seseorang di jaringan.', 'Sintesis wawancara operator', 'Demo sintetis, bukan kutipan nyata'),
      ],
    },
    {
      title: 'Pasar', kicker: '03 · Di mana nilai terkonsentrasi',
      blocks: [
        p('Peluang awal kami terkonsentrasi di tiga segmen: gedung komersial dengan beban puncak tinggi, depot kendaraan listrik, dan kampus industri dengan pembangkit di lokasi. Dalam simulasi ini, ketiganya menyumbang 78% dari nilai pipeline. Angka itu hanya ilustrasi, bukan riset pasar independen. Kami juga tidak memakai ukuran pasar dari laporan pihak ketiga, karena tidak ada yang bisa kami verifikasi.'),
        chart('bar', 'Kontribusi segmen terhadap pipeline', {
          categories: ['Gedung komersial', 'Depot EV', 'Kampus industri', 'Lainnya'],
          series: [{ name: 'Pipeline', values: [38, 24, 16, 22] }],
        }, 'Ilustrasi sintetis. Persentase tidak mewakili pasar nyata.'),
      ],
    },
    {
      title: 'Produk', kicker: '04 · Satu lapisan kendali',
      blocks: [
        p('Vela menghubungkan data aset, prakiraan beban, dan aturan pasar ke dalam satu lapisan kendali. Operator bisa melihat kapasitas yang tersedia, menjalankan simulasi skenario, dan mengirim perintah ke aset dengan jejak audit yang jelas. Integrasi dimulai dari satu situs, lalu diperluas tanpa mengganti perangkat keras yang sudah terpasang. Tim lapangan tetap memegang kendali. Perangkat lunaknya menyimpan catatan siapa mengirim perintah apa dan kapan.'),
        diagram('flow', 'Alur operasi Vela', [
          { id: 'connect', label: 'Hubungkan aset', detail: 'Adaptor untuk inverter, meter, dan BMS.' },
          { id: 'forecast', label: 'Prakirakan', detail: 'Beban, harga, dan kapasitas dalam satu model.' },
          { id: 'dispatch', label: 'Kirim perintah', detail: 'Aturan pasar dan batas operasi yang bisa diaudit.' },
          { id: 'learn', label: 'Perbaiki', detail: 'Hasil aktual memperbarui prakiraan berikutnya.' },
        ], 'Ilustrasi arsitektur sintetis.'),
      ],
    },
    {
      title: 'Traksi', kicker: '05 · Bukti awal',
      blocks: [
        p('Dalam simulasi 18 bulan, jumlah situs aktif tumbuh dari 9 menjadi 42, sementara pendapatan berulang per situs naik 21%. Pertumbuhan itu belum membuktikan keunggulan kompetitif. Ia hanya menunjukkan bahwa model komersialnya bisa diulang pada segmen awal, dan bahwa biaya integrasi menurun seiring volume. Kami belum bisa memisahkan efek kepadatan wilayah dari efek harga, dan itu pekerjaan analisis berikutnya.'),
        chart('line', 'Situs aktif dan pendapatan berulang', {
          categories: ['Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26'],
          series: [
            { name: 'Situs aktif', values: [9, 13, 18, 24, 33, 42] },
            { name: 'Pendapatan berulang (Rp 100 jt)', values: [21, 30, 42, 55, 68, 85] },
          ],
        }, 'Data sintetis. Dua seri memakai skala berbeda untuk menunjukkan arah, bukan nilai absolut.'),
      ],
    },
    {
      title: 'Ekonomi unit', kicker: '06 · Jalur menuju margin',
      blocks: [
        p('Biaya akuisisi dan waktu integrasi turun ketika jumlah situs dalam satu wilayah bertambah. Model ini belum mencapai skala penuh, tetapi arahnya konsisten: makin padat wilayahnya, makin rendah biaya layanan per situs. Asumsi di bawah adalah ilustrasi, bukan proyeksi yang dijamin. Angkanya berguna untuk menguji logika, bukan untuk menghitung hasil pasti.'),
        kpi([
          { label: 'Periode balik modal', value: '14', unit: 'bln', delta: 'target 11 bulan', tone: 'accent', note: 'Ilustrasi sintetis' },
          { label: 'Margin kotor', value: '61', unit: '%', delta: '+7 poin YoY', tone: 'positive', note: 'Ilustrasi sintetis' },
          { label: 'Biaya layanan / situs', value: '-18', unit: '%', delta: 'saat kepadatan naik', tone: 'positive', note: 'Ilustrasi sintetis' },
        ]),
      ],
    },
    {
      title: 'Tim', kicker: '07 · Mengapa kami',
      blocks: [
        p('Tim inti menggabungkan operasi jaringan, perangkat lunak industri, dan penjualan infrastruktur. Kami tidak mengklaim pengalaman yang tidak kami miliki. Yang kami punya kombinasi yang jarang untuk masalah ini: orang yang pernah mengoperasikan aset, orang yang pernah membangun perangkat lunak untuk aset, dan orang yang pernah menjual ke pemilik aset.'),
        list([
          { title: 'Operasi', text: 'Dua belas tahun pengalaman operasi jaringan dan pemeliharaan aset terdistribusi (fiktif).' },
          { title: 'Produk', text: 'Tim perangkat lunak yang pernah membangun platform integrasi industri (fiktif).' },
          { title: 'Komersial', text: 'Pengalaman menjual infrastruktur kepada pemilik gedung dan operator depot (fiktif).' },
        ]),
      ],
    },
    {
      title: 'Permintaan', kicker: '08 · Penggunaan dana',
      blocks: [
        p('Kami mencari Rp 45 miliar untuk memperluas operasi di tiga wilayah, mempercepat integrasi produk, dan membangun tim layanan. Target kami adalah 90 situs aktif dan arus kas operasi positif dalam 24 bulan. Ini tujuan, bukan jaminan. Rencananya akan kami tinjau setiap kuartal dan kami sampaikan apa adanya kalau asumsinya bergeser.'),
        timeline([
          { date: '0-6 bulan', title: 'Perluas wilayah pertama', text: 'Tambahkan 20 situs dan satu tim layanan regional.' },
          { date: '6-12 bulan', title: 'Perkuat produk', text: 'Otomatisasi integrasi dan pelaporan kepatuhan.' },
          { date: '12-24 bulan', title: 'Capai skala operasi', text: 'Target 90 situs dan arus kas operasi positif.' },
        ]),
        callout('Demonstrasi sintetis', 'Seluruh angka, situs, dan proyeksi dalam paparan ini adalah fiksi. Paparan ini tidak menawarkan sekuritas, bukan ajakan investasi, dan tidak boleh dipakai sebagai dasar keputusan investasi nyata.', 'warning'),
      ],
    },
  ],
}

const brochure = {
  document_id: 'demo-product-marketing-brochure',
  title: 'Aurelia No. 07',
  subtitle: 'Sebuah kajian tentang amber, asap, dan ketekunan yang tenang',
  eyebrow: 'Maison Aurelia · Edisi privat',
  category: 'brochure',
  language: 'id',
  audience: 'Kolektor parfum modern yang jeli memilih',
  purpose: 'Memperkenalkan parfum edisi terbatas yang fiktif, menjelaskan kisah pembuatannya, dan mengundang konsultasi privat',
  tone: 'Tenang, indrawi, meyakinkan',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A4' },
  theme: { family: 'luxury_elegant' },
  brand: {
    organization: 'Maison Aurelia',
    logo_path: 'assets/brand/aurelia.svg',
    colors: { primary: '#B08A47', accent: '#6E1F2B' },
    website: 'aurelia.example (fiktif)',
    contact: 'Atelier: 14 Rue des Parfumeurs, Grasse (fiktif)',
  },
  metadata: { author: 'Maison Aurelia (fiktif)', organization: 'Maison Aurelia', created_at: created, keywords: ['parfum', 'brosur', 'sintetis'], date: created },
  cover: { stats: [{ value: 'No. 07', label: 'Edisi terbatas' }, { value: '18%', label: 'Konsentrasi amber' }, { value: '240', label: 'Flakon' }] },
  sections: [
    {
      title: 'Objeknya', kicker: '01 · Kehadiran yang tenang',
      blocks: [
        image('assets/illustrations/aurelia-flacon.svg', 'Ilustrasi vektor orisinal flakon Aurelia No. 07: botol kaca amber gelap dengan tutup emas dan label gading.', 'Ilustrasi vektor orisinal yang dibuat untuk demonstrasi sintetis ini.', 'full'),
        p('Aurelia No. 07 adalah parfum fiktif yang dibangun di sekitar amber, cedar berasap, dan pembukaan jeruk yang tertahan. Flakonnya sengaja terasa berat di tangan: kaca gelap, kerah emas yang disikat halus, dan label tercetak di kertas gading tanpa pelapis.', { lead: true }),
      ],
    },
    {
      title: 'Ritualnya', kicker: '02 · Cara memakainya',
      blocks: [
        p('Objek ini tidak berusaha menarik perhatian dari seberang ruangan. Ia berusaha memberi imbalan pada orang yang mengangkatnya. Semprotkan satu kali ke titik nadi, lalu tunggu. Pembukaannya terang tetapi singkat, bergamot dan lada merah muda yang hanya bertahan beberapa menit. Setelah itu aromanya lebih hangat dan lebih lambat: resin amber, jejak iris, dan asap cedar yang menempel dekat kulit. Parfum ini dirancang untuk ditemukan pada jarak percakapan, bukan diumumkan dari pintu.'),
        list([
          { title: 'Satu semprotan', text: 'Satu kali di setiap pergelangan sudah cukup. Jangan digosok, karena fase keringnya bagian dari komposisi.' },
          { title: 'Lapisi dengan keheningan', text: 'Hindari losion atau produk rambut beraroma pada satu jam pertama. Pembukaannya butuh ruang untuk selesai.' },
          { title: 'Simpan dengan hati-hati', text: 'Simpan flakon tegak, jauh dari cahaya langsung dan panas. Basis ambernya akan makin dalam seiring waktu.' },
        ]),
        quote('Parfum seharusnya tidak memenuhi ruangan. Ia seharusnya membuat ruangan terasa berbeda.', 'Camille Rousseau', 'Perfumer fiktif, Maison Aurelia'),
        callout('Catatan soal bahan', 'Brosur ini menggambarkan produk fiktif. Tidak ada parfum, bahan, sertifikasi, atau klaim klinis nyata yang diwakili. Ilustrasinya adalah karya vektor orisinal yang dibuat untuk demonstrasi ini.', 'info'),
      ],
    },
    {
      title: 'Asal-usul', kicker: '03 · Proses pembuatannya',
      blocks: [
        p('Komposisinya dibangun dalam tiga tahap selama sebelas bulan. Tahap pertama membentuk aksen amber. Tahap kedua menguranginya sampai asapnya bisa duduk di bawah, bukan di atas. Tahap ketiga memasukkan pembukaan jeruk, lalu membuang setengahnya. Sebagian besar pekerjaannya justru pengurangan. Formula akhirnya berisi kurang dari tiga puluh bahan, beberapa hanya dalam jejak yang terlalu kecil untuk ditulis di label.'),
        timeline([
          { date: 'Bulan 1', title: 'Studi amber', text: 'Aksen pertama dari labdanum, benzoin, dan isolat cedar kering. Terlalu berat, lalu disisihkan.' },
          { date: 'Bulan 4', title: 'Pengurangan', text: 'Amber dipotong 40% dan cedar diganti fraksi berasap. Strukturnya mulai terlihat.' },
          { date: 'Bulan 8', title: 'Pembukaan', text: 'Bergamot dan lada merah muda ditambahkan, lalu dikurangi jadi sapuan singkat, bukan pernyataan.' },
          { date: 'Bulan 11', title: 'Pendiaman', text: 'Konsentrat didiamkan enam minggu sebelum diencerkan. Flakon pertama diisi dengan tangan.' },
        ]),
        p('Edisionya dibatasi 240 flakon bernomor. Setiap flakon diisi, disegel, dan diberi label dengan tangan di atelier. Nomornya ditulis di dasar botol dengan tinta arsip, bukan dicetak. Detailnya kecil, tetapi detail seperti itulah yang diminta objek ini.'),
      ],
    },
    {
      title: 'Koleksinya', kicker: '04 · Tiga ekspresi',
      blocks: [
        p('Aurelia No. 07 tersedia dalam tiga format. Ketiganya memakai konsentrat yang sama. Bedanya ada di pembawa dan di kesempatan pemakaiannya. Tabel di bawah adalah demonstrasi produk fiktif, bukan daftar harga nyata.'),
        table('Koleksi Aurelia', [
          { key: 'format', label: 'Format', width: 26 },
          { key: 'volume', label: 'Volume', align: 'right', width: 14 },
          { key: 'character', label: 'Karakter', width: 36 },
          { key: 'price', label: 'Harga indikatif', align: 'right', width: 24 },
        ], [
          { format: 'Eau de parfum', volume: '50 ml', character: 'Komposisi utuh', price: '€ 185' },
          { format: 'Extrait', volume: '30 ml', character: 'Amber lebih padat, pembukaan lebih lambat', price: '€ 240' },
          { format: 'Set perjalanan', volume: '3 × 10 ml', character: 'Tiga decant terpisah', price: '€ 120' },
        ], 'Produk dan harga fiktif. Bukan penawaran untuk dijual.'),
        p('Extrait bukan sekadar versi yang lebih kuat. Pada konsentrasi lebih tinggi, pembukaan jeruknya memendek dan asap cedar lebih terlihat. Ia tafsir lain atas komposisi yang sama, lebih dekat ke basis dan kurang peduli pada kesan pertama.'),
      ],
    },
    {
      title: 'Undangannya', kicker: '05 · Konsultasi privat',
      blocks: [
        p('Aurelia No. 07 tersedia lewat janji temu privat. Konsultasinya tiga puluh menit, bisa langsung atau lewat video, dan dimulai dengan percakapan singkat tentang parfum yang sudah Anda pakai. Tidak ada kewajiban membeli. Tujuannya memutuskan apakah parfum ini pantas masuk koleksi Anda, bukan menyelesaikan transaksi.'),
        table('Kontak atelier', [
          { key: 'channel', label: 'Kanal', width: 28 },
          { key: 'detail', label: 'Detail', width: 52 },
          { key: 'hours', label: 'Ketersediaan', width: 20 },
        ], [
          { channel: 'Janji temu privat', detail: 'atelier@aurelia.example (fiktif)', hours: 'Senin-Jumat' },
          { channel: 'Atelier', detail: '14 Rue des Parfumeurs, Grasse (fiktif)', hours: 'Dengan janji' },
          { channel: 'Concierge', detail: '+33 000 000 000 (fiktif)', hours: '10.00-18.00 CET' },
        ], 'Detail kontak fiktif, hanya untuk demonstrasi.'),
        callout('Pesan konsultasi', 'Tulis ke atelier dengan waktu yang Anda inginkan dan satu kalimat tentang parfum yang sedang Anda pakai. Kami akan membalas dengan konfirmasi dan catatan persiapan singkat. Ini demonstrasi fiktif dan detail kontaknya tidak mengarah ke bisnis nyata.', 'accent'),
      ],
    },
    {
      title: 'Bahan dan perawatan', kicker: '06 · Merawat objeknya',
      blocks: [
        p('Flakonnya terbuat dari kaca amber tebal dengan kerah kuningan dan dasar yang diberi pemberat. Labelnya kertas katun tanpa pelapis, dipilih karena menyerap tinta tidak rata sehingga merekam tangan yang menulis nomor edisi. Kotak luarnya slipcase kaku berlapis tenun linen gelap.'),
        list([
          { title: 'Cahaya', text: 'Simpan flakon di dalam slipcase saat tidak dipakai. Kaca amber memperlambat paparan cahaya, tetapi tidak menghentikannya.' },
          { title: 'Suhu', text: 'Simpan di bawah 25°C, jauh dari radiator, jendela, dan uap kamar mandi.' },
          { title: 'Penanganan', text: 'Pegang badan kacanya, bukan kerahnya. Kuningan akan menua dan berubah warna. Itu memang disengaja.' },
        ]),
        p('Parfum ini komposisi fiktif yang dibuat untuk demonstrasi ini. Kemiripan dengan produk yang sudah ada tidak disengaja. Ilustrasi dan mereknya aset vektor orisinal yang dilisensikan untuk proyek ini.'),
      ],
    },
  ],
}

const academic = {
  document_id: 'demo-academic-research-document',
  title: 'Jarak, Bukan Kebaruan: Studi Terkendali tentang Waktu Tinjauan pada Pembelajaran Mikro',
  subtitle: 'Demonstrasi riset sintetis untuk AI PDF Studio Ultimate',
  eyebrow: 'Makalah riset · Demonstrasi',
  category: 'academic',
  language: 'id',
  audience: 'Peneliti ilmu pembelajaran dan komite penelaahan',
  purpose: 'Menunjukkan struktur dokumen akademik yang lengkap tanpa membuat klaim empiris nyata',
  tone: 'Formal, hati-hati, tepat',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A4' },
  theme: { family: 'academic_professional' },
  brand: {
    organization: 'Institute for Applied Cognition',
    logo_path: 'assets/brand/iac.svg',
    colors: { primary: '#6B1D2A', accent: '#2B4A6F' },
    website: 'iac.example (fiktif)',
  },
  metadata: { author: 'A. Rahman, M. Putri, dan J. Ellis (penulis fiktif)', organization: 'Institute for Applied Cognition', created_at: created, keywords: ['jarak tinjauan', 'pembelajaran mikro', 'riset sintetis'], date: created },
  cover: { stats: [{ value: 'N = 120', label: 'Peserta sintetis' }, { value: '3', label: 'Jadwal tinjauan' }, { value: '0.41', label: 'Ukuran efek sintetis' }] },
  sections: [
    {
      title: 'Abstrak', kicker: 'Ringkasan',
      blocks: [
        p('Makalah ini mendemonstrasikan alur dokumen akademik AI PDF Studio Ultimate. Isinya melaporkan eksperimen yang sepenuhnya sintetis, membandingkan tiga jadwal tinjauan dalam satu modul pembelajaran mikro yang singkat. Temuannya dihasilkan untuk pengujian tata letak dan jaminan mutu. Temuan itu bukan bukti tentang cara manusia belajar. Strukturnya mengikuti pola makalah biasa, yaitu pendahuluan, metode, hasil, pembahasan, keterbatasan, referensi, dan lampiran, supaya tipografi, tabel, persamaan, sitasi, dan geometri halaman bisa dinilai pada isi yang realistis.', { lead: true }),
        list([
          { title: 'Pertanyaan', text: 'Apakah pengaturan waktu tinjauan yang tersebar memperbaiki ingatan tertunda dibandingkan tinjauan yang dikumpulkan dalam satu blok, pada tugas pembelajaran mikro sintetis?' },
          { title: 'Metode', text: 'Rancangan simulasi tiga kelompok dengan 40 peserta per kelompok dan tes tertunda pada hari ke-14.' },
          { title: 'Hasil', text: 'Dalam simulasi, kelompok berjarak memperoleh skor ingatan rata-rata lebih tinggi daripada kelompok terkumpul, dengan ketidakpastian yang saling tumpang tindih.' },
          { title: 'Implikasi', text: 'Pola sintetis ini sejalan dengan literatur yang lebih luas, tetapi hanya ilustratif dan tidak boleh dikutip sebagai temuan.' },
        ]),
        p('Kata kunci: efek jarak, pembelajaran mikro, latihan mengingat, rekayasa dokumen, data sintetis'),
        callout('Pernyataan data sintetis', 'Seluruh catatan peserta, skor, dan ukuran efek di makalah ini dihasilkan. Referensinya sumber nyata yang disertakan untuk menunjukkan penyajian sitasi dan tautan yang bisa diklik. Dokumen ini tidak boleh disajikan sebagai uji coba nyata.', 'warning'),
      ],
    },
    {
      title: '1. Pendahuluan', kicker: 'Konteks riset',
      blocks: [
        p('Pelajaran digital pendek sekarang jadi format yang umum untuk belajar profesional. Singkatnya menguntungkan dari sisi akses, tetapi berisiko untuk daya ingat. Peserta bisa menyelesaikan modul dalam beberapa menit dan tetap kehilangan sebagian besar isinya dalam beberapa hari. Efek jarak, yaitu keunggulan menyebar waktu belajar ke beberapa kesempatan alih-alih menumpuknya di satu waktu, termasuk temuan yang cukup kokoh di ilmu pembelajaran (Cepeda dkk., 2006). Pertanyaan praktis bagi perancang pembelajaran mikro bukan apakah jarak bekerja secara prinsip, melainkan bagaimana waktu tinjauan diatur ketika total waktu belajar tetap dan pendek.'),
        p('Literatur kedua soal mengingat kembali. Menguji ingatan peserta, bukan sekadar menampilkan ulang materinya, cenderung memperbaiki retensi jangka panjang (Roediger & Karpicke, 2006). Dalam konteks pembelajaran mikro, latihan mengingat bisa ditambahkan dengan biaya rendah: satu pertanyaan singkat di awal sesi tinjauan, tugas menyusun ulang tanpa membuka catatan, atau satu dorongan penerapan singkat. Pertanyaan desainnya adalah bagaimana momen mengingat itu berinteraksi dengan jarak. Tinjauan yang terlalu awal bisa terasa lancar dan tidak informatif. Tinjauan yang terlalu lambat bisa menghasilkan kegagalan tanpa pembelajaran.'),
        p('Makalah ini memakai eksperimen sintetis untuk menjalankan alur kerja dokumen riset secara utuh. Klaim substantifnya sengaja dibuat sederhana: simulasinya disusun agar menghasilkan pola yang masuk akal, bukan untuk menyelesaikan pertanyaan ilmiah. Karena itu, kontribusi dokumen ini bersifat metodologis dan editorial. Dokumen ini menunjukkan bagaimana studi dengan tiga kelompok, hasil tertunda, satu persamaan, tabel hasil, dua gambar, dan daftar referensi bisa disajikan dengan sistem visual akademik yang konsisten.'),
        p('Sisa makalah disusun begini. Bagian 2 menjelaskan rancangan dan analisis simulasi. Bagian 3 melaporkan hasil sintetis. Bagian 4 membahas polanya dan batasnya. Bagian 5 menyatakan keterbatasannya secara terbuka. Referensi dan lampiran menyusul.'),
      ],
    },
    {
      title: '2. Metode', kicker: 'Rancangan dan analisis',
      blocks: [
        p('Studi simulasi ini memakai rancangan antarkelompok dengan tiga kelompok. Setiap kelompok menerima modul pembelajaran mikro 30 menit yang sama tentang topik operasi fiktif, lalu satu jadwal tinjauan: terkumpul (satu tinjauan 15 menit tepat setelah modul), berjarak awal (tiga tinjauan 5 menit pada hari 1, 3, dan 7), atau berjarak akhir (tiga tinjauan 5 menit pada hari 3, 7, dan 12). Hasil utamanya tes ingatan 20 butir pada hari ke-14. Skor dinyatakan sebagai proporsi jawaban benar.'),
        equation('Adjusted recall = (correct − 0.25 × errors) / 20', 'Aturan penilaian sintetis yang dipakai dalam simulasi. Penalti ini menekan inflasi tebakan, tetapi bukan model psikometrik yang sudah divalidasi.'),
        table('Alokasi peserta simulasi', [
          { key: 'arm', label: 'Kelompok', width: 26 },
          { key: 'n', label: 'n', align: 'right', width: 10 },
          { key: 'review', label: 'Jadwal tinjauan', width: 34 },
          { key: 'duration', label: 'Total tinjauan', align: 'right', width: 14 },
        ], [
          { arm: 'Terkumpul', n: '40', review: 'Satu blok, hari 0', duration: '15 menit' },
          { arm: 'Berjarak awal', n: '40', review: 'Hari 1, 3, 7', duration: '15 menit' },
          { arm: 'Berjarak akhir', n: '40', review: 'Hari 3, 7, 12', duration: '15 menit' },
        ], 'Alokasi sintetis. Tidak ada peserta nyata yang terlibat.'),
        p('Analisisnya memakai model linear dengan kelompok sebagai faktor tetap dan skor kuis modul awal sebagai kovariat. Simulasinya dikalibrasi agar kovariat dasar menjelaskan porsi varians yang besar, karena pola itu realistis dalam studi pembelajaran terapan. Ketidakpastiannya digambarkan dengan interval 95% dari varians residu simulasi. Tidak ada uji signifikansi yang ditafsirkan sebagai bukti karena datanya sintetis.'),
        p('Materinya sengaja dibuat sederhana secara visual dan verbal agar jadwal tinjauan, bukan tingkat kesulitan isi, yang mendominasi perbedaan dalam simulasi. Ini pilihan desain di dalam generator, bukan sifat populasi nyata. Kehati-hatian yang sama berlaku untuk ukuran efek dan arah analisis sekunder.'),
      ],
    },
    {
      title: '3. Hasil', kicker: 'Temuan sintetis',
      blocks: [
        p('Tabel 2 melaporkan rata-rata ingatan terkoreksi yang disimulasikan per kelompok. Kelompok berjarak awal menghasilkan rata-rata tertinggi, disusul berjarak akhir dan terkumpul. Intervalnya saling tumpang tindih, terutama antara dua kelompok berjarak. Tumpang tindih itu disengaja: dokumen ini dibuat untuk menguji bagaimana ketidakpastian ditampilkan, bukan untuk mengklaim urutan yang pasti.'),
        table('Ingatan terkoreksi simulasi menurut jadwal tinjauan', [
          { key: 'arm', label: 'Kelompok', width: 26 },
          { key: 'mean', label: 'Rata-rata', align: 'right', width: 12 },
          { key: 'sd', label: 'SD', align: 'right', width: 10 },
          { key: 'ci', label: 'Interval 95%', align: 'right', width: 22 },
          { key: 'n', label: 'n', align: 'right', width: 10 },
        ], [
          { arm: 'Terkumpul', mean: '0.54', sd: '0.17', ci: '0.48-0.60', n: '40' },
          { arm: 'Berjarak awal', mean: '0.71', sd: '0.15', ci: '0.66-0.76', n: '40' },
          { arm: 'Berjarak akhir', mean: '0.66', sd: '0.16', ci: '0.61-0.71', n: '40' },
        ], 'Data sintetis. Intervalnya ilustratif dan tidak boleh ditafsirkan sebagai ketidakpastian empiris.'),
        chart('bar', 'Rata-rata ingatan terkoreksi per kelompok', {
          categories: ['Terkumpul', 'Berjarak awal', 'Berjarak akhir'],
          series: [{ name: 'Rata-rata ingatan', values: [0.54, 0.71, 0.66] }],
        }, 'Data sintetis. Nilai lebih tinggi berarti ingatan simulasi lebih baik.'),
        p('Polanya sejalan dengan keunggulan jarak, tetapi dokumen ini tidak memperlakukan pola itu sebagai konfirmasi. Studi nyata akan perlu pemeriksaan pengacakan, analisis peserta yang gugur, dan rencana analisis yang diregistrasi sebelumnya. Semua itu di luar cakupan demonstrasi sintetis ini.'),
      ],
    },
    {
      title: '4. Analisis sekunder', kicker: 'Perbedaan antarindividu',
      blocks: [
        p('Gambar 2 memetakan skor kuis dasar simulasi terhadap ingatan terkoreksi untuk setiap kelompok. Kemiringan positifnya dihasilkan oleh struktur kovariat, bukan penemuan empiris. Gambar ini disertakan karena diagram sebaran lazim ada di makalah akademik, dan karena temanya harus tetap terbaca dengan penanda titik kecil, label sumbu, dan legenda.'),
        chart('scatter', 'Skor dasar dan ingatan terkoreksi', {
          points: [
            { x: 0.35, y: 0.41 }, { x: 0.42, y: 0.47 }, { x: 0.48, y: 0.52 }, { x: 0.55, y: 0.58 }, { x: 0.61, y: 0.62 },
            { x: 0.38, y: 0.55 }, { x: 0.46, y: 0.61 }, { x: 0.52, y: 0.67 }, { x: 0.58, y: 0.72 }, { x: 0.66, y: 0.76 },
            { x: 0.41, y: 0.50 }, { x: 0.49, y: 0.57 }, { x: 0.57, y: 0.66 }, { x: 0.63, y: 0.70 }, { x: 0.70, y: 0.74 },
          ],
        }, 'Observasi sintetis. Warna hanya dipakai membedakan titik, tidak ada kesimpulan pengelompokan yang bisa ditarik.', { x_label: 'Skor kuis dasar', y_label: 'Ingatan terkoreksi' }),
        p('Diagram sebarannya sengaja dibuat sederhana. Makalah nyata biasanya menyertakan kecocokan model, pita kepercayaan, atau tabel koefisien. Tujuannya di sini memastikan alur render bisa menempatkan grafik kedua di satu halaman tanpa mendesak keterangan gambar atau teks di sekitarnya.'),
      ],
    },
    {
      title: '5. Pembahasan', kicker: 'Tafsir dan kehati-hatian',
      blocks: [
        p('Hasil simulasi mengikuti arah yang diharapkan dari literatur jarak: menyebar tinjauan ke beberapa hari menghasilkan ingatan terkoreksi lebih tinggi daripada satu tinjauan terkumpul. Kondisi berjarak awal juga lebih baik daripada berjarak akhir dalam simulasi, tetapi tumpang tindih intervalnya berarti urutan itu jangan ditafsirkan berlebihan. Dalam studi nyata, rekomendasi praktisnya akan bergantung pada interval retensi yang penting bagi peserta, bukan pada satu tes tertunda.'),
        p('Untuk desain pembelajaran mikro, implikasi yang lebih berguna bersifat prosedural. Modul pendek bisa memuat tinjauan terjadwal tanpa menambah sesi panjang kedua: tiga tinjauan lima menit mungkin cukup untuk mengubah bentuk kurva retensi. Pertanyaan desainnya adalah bagaimana membuat tinjauan itu menuntut mengingat, bukan sekadar bagaimana memendekkannya. Tinjauan lima menit yang hanya menampilkan ulang slide yang sama adalah intervensi yang berbeda dari tinjauan lima menit yang meminta peserta menyusun ulang gagasan.'),
        p('Dokumen ini juga menunjukkan kenapa kualitas editorial dan visual harus dinilai bersama. Tabel hasil dengan interval yang tumpang tindih bisa valid secara teknis dan tetap menyesatkan kalau hierarki visualnya menyiratkan perbedaan yang pasti. Grafik bisa terlihat menarik dan tetap menyembunyikan skalanya. Karena itu tema akademik di sini memakai warna yang tertahan, label sumbu yang jelas, dan pemisahan tegas antara data sintetis dan referensi nyata.'),
        callout('Batas tafsir', 'Ukuran efek sintetis tidak boleh dikutip, digabungkan, atau dipakai membenarkan intervensi belajar nyata. Makalah ini menunjukkan alur produksi, bukan hasil ilmiah.', 'warning'),
      ],
    },
    {
      title: '6. Keterbatasan', kicker: 'Yang tidak bisa didukung dokumen ini',
      blocks: [
        p('Keterbatasannya disengaja dan cukup besar. Studi ini simulasi, bukan uji coba. Peserta, skor, dan intervalnya dihasilkan. Simulasi tidak memodelkan motivasi, pengetahuan awal, atau konteks sosial belajar. Ia tidak bisa menetapkan sebab akibat, dan tidak bisa memperkirakan efek populasi. Pemakaian angka di luar dokumen ini sama dengan menyalahgunakan artefaknya.'),
        list([
          'Tidak ada peserta manusia yang direkrut atau diamati.',
          'Ukuran efek dan intervalnya parameter yang dihasilkan, bukan estimasi dari data.',
          'Referensinya nyata, tetapi bukan bukti untuk hasil sintetis ini.',
          'Dokumen ini tidak memuat praregistrasi, persetujuan etik, atau analisis peserta yang gugur.',
          'Sistem visualnya dioptimalkan untuk keterbacaan dan demonstrasi, bukan untuk pengiriman ke jurnal tertentu.',
        ]),
        p('Keterbatasan itu bukan cacat dokumen. Itu bagian dari deskripsinya yang jujur. Sistem produksi harus membuat perbedaan antara data demonstrasi dan bukti faktual terlihat saat membaca, bukan hanya di kolom metadata.'),
      ],
    },
    {
      title: 'Referensi', kicker: 'Sumber nyata',
      blocks: [
        citation('Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin, 132(3), 354-380.', 'Psychological Bulletin', 'https://doi.org/10.1037/0033-2909.132.3.354', '10 November 2026'),
        citation('Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. Psychological Science, 17(3), 249-255.', 'Psychological Science', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x', '10 November 2026'),
        citation('Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students’ learning with effective learning techniques: Promising directions from cognitive and educational psychology. Psychological Science in the Public Interest, 14(1), 4-58.', 'Psychological Science in the Public Interest', 'https://doi.org/10.1177/1529100612453266', '10 November 2026'),
        p('Lampiran A menyusul. Referensi di atas adalah publikasi nyata. Studi yang dilaporkan dalam dokumen ini sintetis.'),
      ],
    },
    {
      title: 'Lampiran A: Rancangan stimulus', kicker: 'Materi tambahan',
      blocks: [
        p('Modul simulasi memakai enam skenario operasional pendek. Setiap skenario berisi satu dorongan keputusan, penjelasan singkat, dan satu pertanyaan untuk mengingat. Tabel di bawah menunjukkan sebaran jenis butir yang dipakai di tes tertunda. Tabel ini disertakan untuk menunjukkan tabel lampiran yang ringkas dan menguji penomoran halaman setelah daftar referensi.'),
        table('Sebaran butir tes tertunda', [
          { key: 'type', label: 'Jenis butir', width: 30 },
          { key: 'count', label: 'Butir', align: 'right', width: 12 },
          { key: 'example', label: 'Contoh pertanyaan', width: 58 },
        ], [
          { type: 'Ingatan', count: '8', example: 'Sebutkan tiga interval tinjauan yang dipakai kelompok berjarak awal.' },
          { type: 'Penerapan', count: '6', example: 'Pilih jadwal tinjauan untuk modul kepatuhan 20 menit.' },
          { type: 'Transfer', count: '4', example: 'Jelaskan kenapa tinjauan terkumpul bisa terasa lebih lancar daripada tinjauan berjarak.' },
          { type: 'Tafsir', count: '2', example: 'Kenali keterbatasan membandingkan interval yang tumpang tindih.' },
        ], 'Lampiran sintetis. Tidak ada butir tes nyata yang diujikan.'),
        p('Semua butir lampiran hanya ilustrasi. Dokumen berakhir di sini. Pembaca yang ingin memakai strukturnya sebaiknya mengganti hasil sintetis, referensi, dan lampiran dengan materi yang sudah diverifikasi sebelum rilis eksternal.'),
      ],
    },
  ],
}

const documents = [report, proposal, ebook, presentation, brochure, academic]
const filenames = [
  '01-business-performance-report.json',
  '02-strategic-business-proposal.json',
  '03-educational-ebook.json',
  '04-investor-presentation.json',
  '05-product-marketing-brochure.json',
  '06-academic-research-document.json',
]

await mkdir(OUT, { recursive: true })
for (const [index, document] of documents.entries()) {
  await writeFile(path.join(OUT, filenames[index]), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  process.stdout.write(`wrote ${filenames[index]}\n`)
}
