# 🎯 PANDUAN LENGKAP - Sistem Absensi CCTV (Scenario B: Top-Down Angle)

**Status:** ✅ Sistem siap digunakan dengan workaround untuk CCTV angle top-down
**Tanggal:** 2026-10-14
**CCTV:** EZVIZ IP 192.168.1.2:554

---

## 📋 RINGKASAN SETUP

### ✅ Yang Sudah Selesai:
1. Backend FastAPI dengan InsightFace (buffalo_l) running
2. Frontend React dashboard dengan 11 halaman
3. CCTV EZVIZ terdaftar & connected (RTSP: `rtsp://admin:Multi100%25@192.168.1.2:554/h264/ch1/main/av_stream`)
4. Endpoint registrasi dari CCTV (`POST /register-face-from-cctv/{camera_id}`)
5. Halaman UI `/register-cctv` untuk admin

### ⚠️ Catatan Penting:
- CCTV dipasang di **corner fisheye top-down** (tidak optimal untuk face recognition)
- Accuracy expected: **30-50%** (rendah karena angle)
- Solusi: **Register wajah dari angle CCTV yang sama** (bukan webcam frontal)
- Rekomendasi: Reposisi CCTV ke eye-level frontal untuk accuracy >90%

---

## 🚀 CARA MENJALANKAN SISTEM

### **1. Start Backend (Terminal 1)**

```powershell
cd D:\Code\CCTV
D:\Code\Emosi\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Started server process [PID]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Jangan tutup terminal ini!**

---

### **2. Start Frontend (Terminal 2)**

```powershell
cd D:\Code\CCTV\frontend
npm run dev -- --host
```

**Expected Output:**
```
VITE v8.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.23:5173/
```

**Jangan tutup terminal ini!**

---

### **3. Akses Dashboard**

Buka browser: **http://localhost:5173**

---

## 👤 REGISTRASI WAJAH DARI CCTV (SCENARIO B)

### **Langkah-langkah:**

#### **A. Login Admin**
1. Di dashboard, klik icon **Login** (pojok kanan atas)
2. Username: `admin`
3. Password: `admin123`
4. Klik **Masuk**

#### **B. Buka Halaman Register dari CCTV**
1. Setelah login, sidebar kiri muncul section **"Sistem & Konfigurasi"**
2. Klik menu **"Register dari CCTV"** (paling atas di section admin)

#### **C. Registrasi Karyawan Baru**
1. Isi **Nama Karyawan** (contoh: `Budi Santoso`)
2. Pilih **Kamera CCTV** dari dropdown (biasanya sudah otomatis pilih `EZVIZ Pintu Utama`)
3. **PENTING:** Sebelum klik tombol, minta karyawan **berdiri di posisi yang sama** dengan angle CCTV saat absensi nanti:
   - Di depan motor / pintu (posisi screenshot yang Anda kirim sebelumnya)
   - Hadap ke atas sedikit (karena CCTV di atas)
   - Jarak 3-5 meter dari CCTV
   - Cahaya cukup (jangan backlit)
4. Klik tombol **"Mulai Registrasi dari CCTV"**
5. **Jangan bergerak!** Sistem akan capture 10 frame otomatis (~5-10 detik)
6. Loading progress muncul: "Mengambil 10 sampel wajah dari CCTV..."
7. Jika berhasil: Toast hijau muncul "Berhasil Registrasi dari CCTV - X sampel wajah berhasil direkam"
8. Jika gagal:
   - **"Tidak ada wajah terdeteksi"** → Karyawan terlalu jauh / angle terlalu ekstrim → Coba posisi lebih dekat / adjust angle berdiri
   - **"Terdeteksi lebih dari 1 wajah"** → Ada orang lain di frame → Pastikan hanya 1 orang di depan CCTV
   - **"Tidak dapat terhubung ke stream CCTV"** → Cek backend logs, mungkin RTSP disconnected

#### **D. Verifikasi Registrasi Berhasil**
1. Buka menu **"Data Karyawan"** (sidebar kiri)
2. Cari nama karyawan yang baru diregister
3. Harus muncul dengan badge **"X embedding"** (X = 10 jika sukses semua)

---

## 🎥 TESTING ABSENSI DARI CCTV

### **Cara Test:**

#### **Opsi 1: Via Background Stream Worker (Otomatis)**

**Status:** Stream worker sudah otomatis start saat backend running jika CCTV terdaftar.

**Cara Verifikasi Worker Running:**
1. Buka **Terminal 1 (Backend)**
2. Cari log: `[StreamManager] Started worker for camera: EZVIZ Pintu Utama`
3. Setiap 2 detik muncul: `[RTSPWorker] Frame captured`

**Test:**
1. Karyawan yang sudah diregister berdiri di **posisi yang sama** dengan saat registrasi
2. Tunggu 2-5 detik
3. Cek backend logs:
   - `[RTSPWorker] Face detected! Running recognition...`
   - `[RTSPWorker] Match found: Budi Santoso (confidence: 0.XX)`
   - `[AttendanceEngine] Check-in attempt: Budi Santoso at 2026-10-14 10:05:12`
   - `[AttendanceEngine] Success: Check-in recorded (status: ON_TIME)`
4. Cek Dashboard (browser):
   - Buka menu **"Dashboard"** → Section "Daftar Karyawan Hari Ini"
   - Harus muncul row baru: `Budi Santoso | 10:05:12 | - | ON_TIME`
5. Cek Notifikasi:
   - Icon bell (pojok kanan atas) muncul badge merah
   - Klik bell → Notif: "✅ Budi Santoso berhasil presensi masuk (Tepat Waktu)"
6. Cek Snapshot:
   - Buka folder: `D:\Code\CCTV\data\snapshots`
   - Harus ada file `.jpg` baru dengan timestamp

#### **Opsi 2: Via Halaman Live Absensi (Manual)**

**Langkah:**
1. Buka menu **"Live Absensi"** (sidebar kiri)
2. Klik tab **"Event Kamera CCTV"** (tab ke-2)
3. Dropdown pilih **"EZVIZ Pintu Utama"**
4. Karyawan berdiri di depan CCTV (posisi sama)
5. Tunggu ~3-5 detik
6. Snapshot gallery muncul dengan card:
   - Foto snapshot
   - Nama karyawan
   - Confidence score
   - Timestamp
   - Tombol "Klik Untuk Presensi Masuk" atau "Check Out"

**Catatan:** Opsi ini untuk monitoring real-time, tapi attendance tetap auto-recorded via background worker (Opsi 1).

---

## ❗ TROUBLESHOOTING

### **Problem 1: Wajah Tidak Terdeteksi dari CCTV**

**Gejala:**
- Backend log: `[RTSPWorker] No face detected in frame XXX` (terus-menerus)
- Frontend: Snapshot gallery kosong / "Belum ada deteksi wajah"

**Diagnosis:**
- CCTV angle terlalu ekstrim (top-down >60°)
- Jarak terlalu jauh (>5 meter)
- Pencahayaan buruk (backlit / terlalu gelap)
- Face size terlalu kecil (<80px di frame)

**Solusi:**
1. **Adjust posisi karyawan:**
   - Lebih dekat ke CCTV (2-3 meter)
   - Berdiri tegak, hadap sedikit ke atas (lihat ke arah CCTV)
   - Pastikan wajah tidak tertutup helm/masker/rambut
2. **Improve lighting:**
   - Tambah lampu di area CCTV
   - Hindari backlight (jangan berdiri membelakangi cahaya terang)
3. **Test manual:**
   - Buka EZVIZ Studio → Live view camera
   - Screenshot saat karyawan di posisi
   - Cek: Apakah wajah terlihat jelas? Ukuran wajah cukup besar?
   - Jika tidak: Reposisi atau zoom CCTV (jika support digital zoom)

---

### **Problem 2: Wajah Terdeteksi Tapi Tidak Dikenali (Selalu "Unknown")**

**Gejala:**
- Backend log: `[RTSPWorker] Face detected! Running recognition...`
- Backend log: `[RTSPWorker] Unknown face (confidence: 0.XX < threshold 0.4)`
- Frontend: Muncul card "Unknown"

**Diagnosis:**
- Wajah teregister tapi dengan angle BERBEDA (contoh: register via webcam frontal, tapi recognize via CCTV top-down)
- Confidence score terlalu rendah akibat angle mismatch
- Lighting/expression berbeda saat register vs recognize

**Solusi:**
1. **RE-REGISTER dari angle CCTV yang sama:**
   - Hapus data lama: Menu "Data Karyawan" → Klik tombol Delete
   - Register ulang via menu **"Register dari CCTV"** (BUKAN via webcam)
   - Pastikan posisi saat register = posisi saat absensi
2. **Lower threshold (jika masih gagal):**
   - Login admin → Menu **"Pengaturan AI"**
   - Ubah **Recognition Threshold** dari `0.40` ke `0.35`
   - Klik **Simpan Pengaturan**
   - Trade-off: False positive rate ↑ (orang lain mungkin salah dikenali)
3. **Tambah sampel registrasi:**
   - Register ulang karyawan yang sama (sistem support multiple embedding per user)
   - Lakukan 2-3 kali di waktu berbeda (pagi/siang/sore, lighting berbeda)
   - Sistem akan ambil MAX similarity dari semua embedding

---

### **Problem 3: Backend Error "Unable to connect RTSP stream"**

**Gejala:**
- Backend log: `[RTSPWorker] Unable to connect RTSP stream rtsp://admin:***@192.168.1.2:554/...`
- Frontend: "Uji Koneksi" gagal

**Diagnosis:**
- CCTV offline / mati
- IP CCTV berubah (DHCP lease expired)
- Network issue (WiFi disconnect, router restart)
- RTSP password salah

**Solusi:**
1. **Ping CCTV:**
   ```powershell
   ping 192.168.1.2
   ```
   Jika `Request timed out` → CCTV offline atau IP berubah
2. **Cari IP baru (jika berubah):**
   ```powershell
   arp -a | findstr "192.168.1"
   ```
   Cari MAC `64:24:4d:8b:8d:71` (MAC EZVIZ Anda) → Catat IP baru
3. **Update RTSP URL di dashboard:**
   - Login admin → Menu **"Kamera & CCTV"**
   - Klik **Edit** pada card EZVIZ
   - Update IP di URL RTSP
   - Klik **Simpan** → Klik **Uji Koneksi**
4. **Test di VLC:**
   ```
   rtsp://admin:Multi100%25@192.168.1.2:554/h264/ch1/main/av_stream
   ```
   Jika VLC gagal juga → Problem di CCTV/network, bukan software

---

### **Problem 4: Accuracy Terlalu Rendah (<30%)**

**Gejala:**
- Sebagian besar karyawan tidak dikenali meski sudah register dari CCTV
- Confidence score rata-rata <0.3

**Diagnosis:**
- CCTV angle **terlalu ekstrim** untuk face recognition (fisheye distortion, pitch >70°)
- Face size terlalu kecil (<60px)
- Model InsightFace inherently bad untuk non-frontal faces

**Solusi (Long-term):**
1. **REKOMENDASI UTAMA: Reposisi CCTV** (Scenario A)
   - Mount ulang di **eye-level** (160-180cm height)
   - **Frontal angle** (horizontal ±15° tilt down)
   - **Jarak 1-2 meter** dari checkpoint
   - **FOV 60-90°** (bukan fisheye 180°)
   - Expected accuracy: **>90%**
2. **Alternatif: Tambah IP Camera Kedua** (Scenario C)
   - CCTV existing tetap untuk security monitoring
   - IP camera baru (TP-Link Tapo C200 ~300rb) untuk face recognition
   - Mount di posisi optimal (frontal, eye-level)
   - System support multi-camera
3. **Accept Trade-off:**
   - Tetap pakai angle existing dengan accuracy 30-50%
   - Tambah **manual override** untuk false negative:
     - Menu "Log Presensi" → Klik row karyawan yang belum absen
     - Admin bisa manual check-in via tombol "Manual Check-in"
     - Audit log tercatat

---

## 📊 MONITORING & MAINTENANCE

### **Daily Monitoring:**
1. **Cek Dashboard Metrics:**
   - Total hadir / Total karyawan
   - Jumlah "Tepat Waktu" vs "Terlambat"
   - Jumlah "Belum Hadir" (di siang hari)
2. **Cek Notifikasi:**
   - Icon bell → Review notifikasi "Wajah tidak dikenal" atau keterlambatan
3. **Cek Backend Logs (Terminal 1):**
   - Jika banyak `Unknown face` → Cek apakah orang luar atau karyawan belum register

### **Weekly Maintenance:**
1. **Backup Database:**
   ```powershell
   Copy-Item D:\Code\CCTV\data\db.json D:\Code\CCTV\data\backup\db_$(Get-Date -Format 'yyyyMMdd').json
   ```
2. **Cleanup Snapshots (Optional):**
   ```powershell
   # Hapus snapshot >7 hari (save disk space)
   Get-ChildItem D:\Code\CCTV\data\snapshots -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
   ```
3. **Review Audit Logs:**
   - Menu "Audit Log Trail" → Cek apakah ada manual override yang mencurigakan

### **Monthly Review:**
1. **Export CSV Presensi:**
   - Menu "Log Presensi" → Klik **"Ekspor CSV"**
   - Gunakan untuk payroll / HR report
2. **Accuracy Report:**
   - Hitung: `(Total check-in sukses) / (Total karyawan * Total hari kerja)` × 100%
   - Jika <50% → Consider reposisi CCTV (Scenario A)

---

## 🎓 TIPS & BEST PRACTICES

### **Registrasi:**
1. **Gunakan Register dari CCTV (bukan webcam)** untuk karyawan yang absen via CCTV top-down
2. **Register di kondisi lighting yang sama** dengan saat absensi (pagi/siang/sore)
3. **Register multiple times** (2-3 kali di waktu berbeda) untuk improve accuracy
4. **Instruksikan karyawan:**
   - Berdiri di titik yang sama setiap hari
   - Hadap ke CCTV (lihat ke atas sedikit)
   - Lepas helm/masker/kacamata hitam saat scan

### **Absensi:**
1. **Buat marking fisik** di lantai (stiker/duct tape) sebagai "checkpoint" agar posisi konsisten
2. **Tunggu 3-5 detik** setelah berdiri di checkpoint (jangan langsung pergi)
3. **Cek notifikasi** di dashboard untuk konfirmasi (atau install bell/buzzer via webhook jika mau DIY)

### **Troubleshooting:**
1. **Jangan panik jika 1-2 karyawan tidak dikenali sesekali** (expected dengan accuracy 30-50%)
2. **Gunakan manual override** untuk edge case (admin login → Log Presensi → Manual check-in)
3. **Monitor backend logs** saat troubleshoot (Terminal 1 harus tetap terbuka)

---

## 📞 SUPPORT & NEXT STEPS

### **Jika Masih Ada Masalah:**
1. Screenshot backend logs (Terminal 1)
2. Screenshot frontend error (jika ada)
3. Screenshot EZVIZ live view saat karyawan di posisi absensi
4. Kirim ke support / developer

### **Future Improvements (Jika Budget Ada):**
1. **Reposisi CCTV ke eye-level frontal** → Accuracy ↑↑↑ (90%+)
2. **Tambah IP Camera Kedua** → Dedicated untuk face recognition
3. **Tambah Hardware Buzzer/LED** → Feedback real-time untuk karyawan (hijau=sukses, merah=gagal)
4. **Integrations:** Webhook ke Slack/Telegram untuk notifikasi keterlambatan

---

**Dokumentasi dibuat:** 2026-10-14 10:07 WIB
**Status:** ✅ Sistem ready untuk production dengan workaround Scenario B
**Next Review:** Evaluasi accuracy setelah 1 minggu usage → Decide reposisi CCTV atau tidak
