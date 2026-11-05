# Panduan Evaluasi Snapshot CCTV dengan InsightFace

## Tujuan

Script ini mengevaluasi pipeline InsightFace `buffalo_l` menggunakan:

- `data/face_db.json` sebagai database embedding wajah yang sudah terdaftar.
- `data/snapshots/` sebagai gambar pengujian yang dihasilkan CCTV.

Script tidak membutuhkan foto gallery karyawan tambahan. Script membaca embedding 512 dimensi dari `face_db.json`.

## Penting sebelum menjalankan

Nama pada file snapshot adalah hasil prediksi CCTV, bukan label kebenaran. Karena itu, identitas sebenarnya harus diperiksa secara manual pada CSV.

Dua pasangan nama digabung sesuai konfirmasi pemilik proyek:

- `Sdq` dan `Muhammad Sidiq` menjadi `Muhammad Sidiq`.
- `Grace` dan `Gracsia Andhika` menjadi `Gracsia Andhika`.

Identitas terdaftar setelah penggabungan: `Aga`, `Muhammad Sidiq`, dan `Gracsia Andhika`.

## Penempatan file

Salin folder `scripts` dari paket ini ke direktori utama proyek CCTV sehingga susunannya menjadi:

```text
D:\Code\cctv\
├── app\
├── data\
│   ├── face_db.json
│   └── snapshots\
├── scripts\
│   └── evaluate_snapshots.py
└── evaluation_data\   (dibuat otomatis)
```

## Langkah 1: buat template label

Buka PowerShell di `D:\Code\cctv`, lalu jalankan:

```powershell
python scripts/evaluate_snapshots.py --prepare-labels
```

Script membuat:

```text
evaluation_data\snapshot_labels.csv
```

CSV berisi nama file snapshot, prediksi yang tertulis pada nama file, dan saran nama kanonis. Kolom `suggested_canonical_label` hanya petunjuk, bukan ground truth.

## Langkah 2: verifikasi identitas

Buka `evaluation_data\snapshot_labels.csv` di Excel. Untuk setiap gambar:

1. Buka file gambar yang tercantum pada kolom `filename`.
2. Periksa siapa orang sebenarnya.
3. Isi `true_identity` dengan salah satu nama berikut:
   - `Aga`
   - `Muhammad Sidiq`
   - `Gracsia Andhika`
   - `Unknown` jika orang tersebut memang tidak terdaftar dalam `face_db.json`.
4. Isi `verified` dengan `yes` hanya setelah kamu memeriksa gambar.

Jangan menyalin prediksi secara otomatis ke `true_identity`. Jika foto bernama `Unknown` ternyata orang yang terdaftar, isi identitas aslinya. Jika foto bernama `Grace`, gunakan `Gracsia Andhika` setelah memastikan orangnya sama.

## Langkah 3: instal Matplotlib bila belum tersedia

Dependensi utama seperti OpenCV, InsightFace, NumPy, dan ONNX Runtime seharusnya sudah terpasang pada proyek CCTV. Script hanya membutuhkan Matplotlib tambahan untuk grafik:

```powershell
python -m pip install matplotlib
```

Tidak perlu menjalankan `pip install -r requirements.txt` dari folder evaluasi. Jalankan perintah di atas hanya jika Matplotlib belum tersedia.

## Langkah 4: jalankan evaluasi

Dari direktori `D:\Code\cctv`:

```powershell
python scripts/evaluate_snapshots.py --det-sizes 320,480,640,800 --det-threshold 0.5 --rec-threshold 0.4
```

Ukuran 640 dan threshold 0.5 untuk deteksi serta 0.4 untuk pengenalan mengikuti konfigurasi proyek yang diperiksa.

Untuk uji awal menggunakan 10 gambar:

```powershell
python scripts/evaluate_snapshots.py --max-images 10 --det-sizes 640
```

Uji 10 gambar hanya untuk memastikan script berjalan. Jangan gunakan hasil sampel kecil sebagai hasil penelitian final.

## Output

Script menghasilkan folder `evaluation_results` dengan file:

- `summary_by_input_size.csv`: ringkasan metrik untuk setiap ukuran input.
- `predictions_by_image_and_size.csv`: hasil per gambar dan ukuran input.
- `far_frr_threshold_sweep.csv`: FAR dan FRR pada berbagai threshold.
- `speed_vs_recognition_accuracy.png`: waktu inferensi dibanding akurasi pengenalan.
- `far_frr_vs_threshold.png`: perubahan FAR dan FRR berdasarkan threshold.
- `confusion_matrix.png`: perbandingan identitas sebenarnya dan prediksi.

## Definisi metrik

- **Overall accuracy**: proporsi seluruh gambar yang identitas prediksinya sama dengan identitas terverifikasi, termasuk kelas Unknown.
- **Known identity accuracy**: proporsi gambar orang terdaftar yang dikenali sebagai identitas yang benar. Penolakan sebagai Unknown dan salah identitas dihitung salah.
- **FAR**: proporsi gambar Unknown yang keliru diterima sebagai salah satu identitas terdaftar.
- **FRR**: proporsi gambar orang terdaftar yang ditolak sebagai Unknown atau tidak terdeteksi saat evaluasi ulang.
- **Known misidentification rate**: proporsi gambar orang terdaftar yang diterima tetapi diberi identitas orang terdaftar lain.
- **Mean inference time**: rata-rata waktu pemrosesan inferensi dan pencocokan per gambar. Waktu membaca file tidak dihitung.
- **Snapshot re-detection rate**: proporsi snapshot yang wajahnya kembali terdeteksi ketika gambar tersimpan diproses ulang.

## Batasan metodologis yang wajib ditulis

1. Snapshot disimpan oleh sistem setelah deteksi berhasil. Karena itu, kumpulan snapshot tidak mencakup frame yang gagal dideteksi. `snapshot_redetection_rate` hanya mengukur keberhasilan deteksi ulang pada gambar yang sudah lolos deteksi sebelumnya, bukan recall deteksi CCTV pada seluruh kondisi.
2. Snapshot proyek memiliki kotak dan label teks yang digambar di atas frame. Pemrosesan ulang gambar tersebut dapat sedikit memengaruhi deteksi atau embedding. Hasil recognition dari snapshot harus dijelaskan sebagai evaluasi retrospektif pada snapshot tersimpan.
3. AP50/mAP tidak dihitung. Metrik tersebut membutuhkan bounding box ground truth independen dan sampel frame yang mewakili kondisi gagal maupun berhasil dideteksi.
4. Enam file yang namanya memuat `Unknown` tidak otomatis merupakan enam ground truth Unknown. Identitasnya tetap harus diperiksa. Jika jumlah sampel Unknown sedikit, FAR akan memiliki ketidakpastian tinggi.
5. Banyak snapshot diambil berurutan dalam waktu dekat. Gambar yang hampir sama bukan observasi independen. Untuk penelitian yang lebih kuat, tambahkan pengujian dari waktu, pencahayaan, jarak, dan sudut kamera yang berbeda.
6. Pastikan foto yang dipakai sebagai snapshot tidak sama dengan foto yang digunakan untuk membuat embedding pendaftaran di `face_db.json`.

## Jika muncul error

- `Folder snapshot tidak ditemukan`: pastikan menjalankan script dari `D:\Code\cctv` dan folder `data\snapshots` tersedia.
- `CSV label belum lengkap`: isi semua `true_identity` dan set `verified=yes`.
- `No module named insightface`: aktifkan environment Python yang digunakan aplikasi CCTV, lalu instal dependensi proyek pada environment tersebut.
- `No module named matplotlib`: jalankan `python -m pip install matplotlib`.
