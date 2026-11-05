# Panduan evaluasi model CCTV dengan InsightFace

## 1. Persiapan file

Ekstrak ZIP ini, lalu salin isi folder `cctv_evaluation_kit/` ke direktori utama proyek `cctv/`. Hasilnya harus memiliki `cctv/scripts/`, `cctv/evaluation_data/`, `cctv/evaluation-requirements.txt`, dan `cctv/EVALUATION_GUIDE.md`.

## 2. Model yang dievaluasi

Berdasarkan kode proyek, sistem menggunakan InsightFace `buffalo_l` dengan modul deteksi dan pengenalan wajah. Pipeline menjalankan deteksi wajah, ekstraksi embedding 512 dimensi, lalu pencocokan embedding menggunakan cosine similarity.

Konfigurasi proyek saat ini:

- Model pack: `buffalo_l`
- Detection input size: `640 x 640`
- Detection threshold: `0.5`
- Recognition threshold: `0.4`
- Provider: `CPUExecutionProvider`

Skrip ini membandingkan ukuran input deteksi `320`, `480`, `640`, dan `800`. Model pack tetap `buffalo_l`; yang diubah hanya ukuran input deteksi. Titik `640 x 640` mewakili konfigurasi proyek saat ini.

## 3. Struktur dataset

Buat struktur berikut dari direktori utama proyek:

```text
cctv/
├── scripts/
│   └── evaluate_model.py
├── evaluation_data/
│   ├── gallery/
│   │   ├── Budi/
│   │   │   ├── enroll_01.jpg
│   │   │   └── enroll_02.jpg
│   │   └── Siti/
│   │       └── enroll_01.jpg
│   ├── queries/
│   │   ├── Budi/
│   │   │   └── query_01.jpg
│   │   ├── Siti/
│   │   │   └── query_01.jpg
│   │   └── unknown/
│   │       └── query_01.jpg
│   └── annotations.csv
└── evaluation-requirements.txt
```

`gallery` berisi foto pendaftaran/referensi setiap identitas. `queries` berisi foto yang belum pernah dipakai untuk mendaftarkan identitas. Jangan memakai foto yang sama di gallery dan queries.

Setiap gambar gallery sebaiknya berisi satu orang. Jika satu gambar berisi beberapa wajah, skrip memilih wajah dengan bounding box terbesar untuk mewakili identitas folder.

## 4. Anotasi ground truth

Salin `evaluation_data/annotations_template.csv` menjadi `evaluation_data/annotations.csv`. Isi satu baris untuk setiap wajah yang tampak pada setiap gambar query.

Contoh format:

```csv
filename,x1,y1,x2,y2,identity
Budi/query_01.jpg,100,45,250,220,Budi
Siti/query_01.jpg,80,50,230,225,Siti
unknown/query_01.jpg,120,60,270,240,unknown
```

Keterangan:

- `filename`: lokasi gambar relatif terhadap folder `queries`.
- `x1,y1`: koordinat sudut kiri atas bounding box.
- `x2,y2`: koordinat sudut kanan bawah bounding box.
- `identity`: nama folder/identitas yang benar. Gunakan `unknown` untuk orang yang tidak terdaftar.
- Koordinat harus mengacu pada gambar asli, bukan gambar yang sudah di-resize.
- Jika satu gambar memiliki lebih dari satu wajah, tambahkan beberapa baris dengan `filename` yang sama.
- Gambar query tanpa wajah tetap boleh disimpan di folder `queries`, tetapi tidak perlu memiliki baris anotasi.

Gunakan alat anotasi seperti CVAT atau LabelImg untuk menggambar bounding box. Pastikan anotasi mencakup semua wajah yang terlihat dan konsisten.

## 5. Instalasi dan menjalankan evaluasi

Jalankan dari direktori utama proyek `cctv`. File `evaluation-requirements.txt` memanggil `requirements.txt` proyek dan menambahkan Matplotlib:

```bash
pip install -r evaluation-requirements.txt
python scripts/evaluate_model.py --data-dir evaluation_data --det-sizes 320,480,640,800 --det-threshold 0.5 --rec-threshold 0.4
```

Pada pemakaian pertama, InsightFace mungkin perlu mengunduh model pack `buffalo_l`. Pastikan komputer memiliki akses internet saat model belum tersimpan di cache.

Jika ingin menguji hanya konfigurasi produksi saat ini:

```bash
python scripts/evaluate_model.py --data-dir evaluation_data --det-sizes 640
```

## 6. Hasil yang dihasilkan

Skrip membuat folder `evaluation_results` yang berisi:

- `evaluation_results.csv`: tabel seluruh metrik untuk setiap ukuran input.
- `speed_vs_ap50.png`: grafik waktu inferensi rata-rata terhadap AP50 deteksi wajah, seperti grafik referensi YOLO.
- `recognition_metrics.png`: grafik akurasi identitas, false accept rate, dan false reject rate.

Metrik deteksi:

- `AP50`: Average Precision pada IoU 0,50. Karena kelas yang dinilai hanya wajah, AP50 juga menjadi mAP50 untuk kelas tunggal.
- `mAP50_95`: rata-rata AP pada IoU 0,50 sampai 0,95 dengan interval 0,05.
- `precision`, `recall`, dan `F1`: dihitung pada IoU 0,50 dan detection threshold yang ditentukan.
- `mean_inference_ms`: waktu rata-rata `FaceAnalysis.get()` per gambar. Pengukuran mencakup deteksi dan ekstraksi embedding, tetapi tidak mencakup pembacaan file dan proses pencocokan ke gallery.
- `FPS`: 1000 dibagi waktu inferensi rata-rata dalam milidetik.

Metrik pengenalan:

- `known_identity_accuracy`: proporsi wajah terdaftar yang dikenali dengan identitas benar.
- `false_accept_rate_unknown`: proporsi wajah tidak terdaftar yang keliru diterima sebagai identitas terdaftar.
- `false_reject_rate_known`: proporsi wajah terdaftar yang tidak dikenali dengan benar, termasuk ditolak sebagai `Unknown` atau salah identitas.

Metrik pengenalan dihitung hanya pada wajah ground truth yang berhasil dideteksi dan dipasangkan dengan IoU minimal sesuai konfigurasi. Karena itu, baca metrik deteksi dan pengenalan secara bersamaan.

## 7. Catatan metodologi

1. Pisahkan data gallery dan query. Jangan menguji model menggunakan foto yang sama dengan foto pendaftaran.
2. Sertakan variasi pencahayaan, jarak kamera, sudut wajah, resolusi, dan jumlah orang.
3. Sertakan wajah orang yang tidak terdaftar untuk mengukur false accept rate.
4. Gunakan perangkat keras dan kondisi yang sama saat membandingkan ukuran input.
5. Jalankan pengujian beberapa kali jika ingin mengurangi pengaruh beban komputer.
6. Nilai `AP50` dihitung dari skor deteksi dengan confidence rendah agar kurva precision-recall tidak terpotong pada threshold operasional. Precision, recall, dan F1 menggunakan threshold operasional `0.5`.
7. Grafik speed-versus-AP50 membandingkan ukuran input deteksi pada model `buffalo_l` yang sama. Grafik ini bukan perbandingan dengan arsitektur YOLO atau model lain.

Jangan menulis angka hasil evaluasi ke laporan sebelum skrip dijalankan pada dataset beranotasi milik proyek.
