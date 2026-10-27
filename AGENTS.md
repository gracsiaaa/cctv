la

ak

# AI Face Recognition Attendance System

**Role**: AI Architect & Project Leader
**Stack**: Python 3.10+, FastAPI, OpenCV, InsightFace (SCRFD+ArcFace), PostgreSQL.
**Goal**: Bangun backend API AI Recognition Engine untuk absensi via CCTV RTSP.

---

## 📅 Roadmap & Progress Tracking

*Digunakan oleh AI Agent untuk resume context.*

### DAY 1: PROJECT FOUNDATION 🟢 (COMPLETED)

- **Target**: Setup env, dependency, project skeleton, download model pretrained.
- **Tools**: pip, pytest.
- **Output**:
  - `requirements.txt` ter-install lengkap (insightface, onnxruntime, fastapi, dsb).
  - Struktur folder `/app`, `/tests`, `/models`, `/test_images` terbuat.
  - Model `buffalo_l` (SCRFD & ArcFace ONNX) sukses terdownload di lokal.
  - Test (`test_setup.py`) passed: import sukses, OpenCV baca gambar sukses, `app.get(img)` berhasil mendeteksi wajah di foto test.

### DAY 2: FACE DETECTION ENGINE 🟢 (COMPLETED)

- **Target**: Implement class `FaceDetector` wrapping SCRFD. Output: list bounding box wajah.
- **Task**:
  1. Modif `app/detection/detector.py` panggil instance InsightFace (SCRFD mode).
  2. Implement return bbox & face_count.
  3. Buat `tests/test_detection.py` (blank, None, single face, rotated face).
- **Status**: Passed (all 4 tests green).

### DAY 3: FACE EMBEDDING GENERATION 🟢 (COMPLETED)

- **Target**: Extract 512-dimensi vector wajah.
- **Task**:
  1. Modif `app/recognition/embedder.py` dengan InsightFace (`allowed_modules=['detection', 'recognition']`).
  2. Implement extract embedding 512-d and normalized embedding.
  3. Buat `tests/test_embedding.py` (check 512-d size, similarity antara orang sama vs orang beda).
- **Status**: Passed (all 3 tests green).

### DAY 4: FACE MATCHING ENGINE 🟢 (COMPLETED)

- **Target**: Cosine similarity engine untuk mencocokkan wajah.
- **Task**:
  1. Buat `app/matching/matcher.py` membandingkan vector wajah dengan threshold.
  2. Test true positive & false positive di `tests/test_matching.py`.
- **Status**: Passed. Mampu filter "Unknown".

### DAY 5: RECOGNITION PIPELINE 🟢 (COMPLETED)

- **Target**: End-to-end flow: Image -> Detection -> Embedding -> Matching -> Identity.
- **Task**:
  1. Buat `app/pipeline/recognizer.py` merangkai Embedder dan Matcher.
  2. Test menggunakan foto valid (known), invalid (unknown), blank image, dan None image di `tests/test_pipeline.py`.
- **Status**: Passed (all tests green). Pipeline return JSON/dict: name, confidence, bbox, timestamp.

### DAY 6: FASTAPI SERVICE 🟢 (COMPLETED)

- **Target**: Expose pipeline jadi REST API endpoint (register, recognize).
- **Task**:
  1. Buat `app/api/routes.py` (POST `/api/register-face`, POST `/api/recognize`).
  2. Integrasi model dengan FastApi UploadFile.
  3. Buat `tests/test_api.py` untuk menguji endpoint dan error handling.
- **Status**: Passed. Endpoint mereturn JSON valid dan handling multiple face saat register.

### DAY 7: OPTIMIZATION & FINAL REVIEW 🟢 (COMPLETED)

- **Target**: Stress test, FPS optimization, integrasi stream siap.
- **Task**:
  1. Set provider ONNX secara eksplisit ke `CPUExecutionProvider` untuk efisiensi loading dan mencegah warning tensorrt.
  2. Final QA Check & run full 23 unit tests.
- **Status**: Ready for Production CCTV stream integration! Pipeline sukses mendeteksi, mengeksekusi cosine similarity, dan JSON serialization dengan cepat (23 tests < 30 detik termasuk model loading overhead).

---

## 🚀 FRONTEND DASHBOARD & ENTERPRISE ENGINE (COMPLETED)
- **Tech Stack**: React 18, Vite, TypeScript, TailwindCSS, Shadcn UI, React-Webcam, Lucide React.
- **Arsitektur Baru**:
  1. `app/storage/json_store.py` - Persistent storage untuk database wajah, log presensi, daftar kamera, dan jadwal kerja.
  2. `app/attendance/engine.py` - Full Attendance Engine:
     - Anti-duplicate cooldown (300s default)
     - Shift & schedule checking (ON_TIME, LATE, EARLY_LEAVE, ABSENT)
     - Multi-event tracking per user per hari
  3. `app/cameras/manager.py` - CRUD RTSP camera manager + test connectivity.
  4. `app/stream/worker.py` - Background stream consumer worker siap integrasi RTSP CCTV.
  5. `app/matching/matcher.py` - Multi-embedding matching (mendukung multiple foto per karyawan, ambil MAX similarity).
- **8 Halaman Dashboard (Mobile-First & Desktop)**:
  1. `DashboardPage.tsx` - Ringkasan metrik lengkap (Hadir, Tepat Waktu, Terlambat, Belum Hadir, Server Status).
  2. `RegisterPage.tsx` - Live camera capture dengan toggle kamera depan/belakang, multi-foto (hingga 5 sudut wajah), thumbnail preview gallery.
  3. `RecognizePage.tsx` - Live scanner dengan bounding box scaling, status presensi real-time, getaran feedback, interval slider.
  4. `PeoplePage.tsx` - Database karyawan, badge jumlah embedding, modal konfirmasi hapus (Shadcn Dialog).
  5. `AttendancePage.tsx` - Log presensi dengan filter tanggal, badge status kehadiran, card layout di mobile, table di desktop.
  6. `CamerasPage.tsx` - Manajemen CCTV (RTSP URL, Lokasi, Mode Check-in/out, Uji Koneksi live stream).
  7. `SchedulesPage.tsx` - Konfigurasi jam shift masuk, jam pulang, dan toleransi keterlambatan.
  8. `SettingsPage.tsx` - Pengaturan parameter AI (Threshold ArcFace dan Jeda Cooldown).
- **Responsive Layout**:
  - `BottomNav.tsx` untuk navigasi mobile touch-friendly.
  - `Sidebar.tsx` untuk desktop layout.
  - Dark mode konsisten (`class="dark"` pada `<html>`).
  - Semua unit tests backend (29 tests) lulus 100%.
  - Fitur Baru Ditambahkan:
    1. Flow Interaktif Presensi Scanner: Deteksi wajah -> Muncul tombol "Klik Untuk Presensi Masuk" jika belum absen, atau "Klik Untuk Check Out (Presensi Pulang)" jika sudah absen masuk.
    2. Jam Berjalan Real-time (LiveClock): Jam digital berjalan detik per detik dan tanggal format Indonesia pada header aplikasi dan scanner.
    3. Dashboard Monitoring Detail: Tabel visual daftar karyawan yang sudah presensi hari ini (jam masuk, jam pulang, status ketepatan waktu, dan filter status).
    4. Auto-Capture 10 Foto: Registrasi otomatis burst 10 frame foto berbagai sudut wajah tanpa klik berulang.
    5. Single-Admin Authentication: Sistem login token `POST /api/auth/login` (`admin` / `admin123`) dengan proteksi rute di frontend.
    6. Human Override Presensi: Modal koreksi manual status presensi (LATE -> ON_TIME / sebaliknya) dengan pencatatan alasan dan badge audit trail.
    7. Multi-Shift Management: Dukungan shift kerja jam operasional terpisah (Shift Pagi, Siang, Malam, Lembur).
    8. Edit Metadata Karyawan: Dialog edit departemen, jabatan, ID karyawan, dan shift kerja di Data Karyawan.
    9. Real-time Notification Drawer: Peringatan otomatis keterlambatan dan wajah tidak dikenal dengan status unread.
    10. Audit Log Trail: Rekam jejak seluruh aksi administratif dan koreksi manual di halaman Audit Log.
    11. Laporan & Ekspor CSV: Unduh rekapitulasi data presensi ke file CSV/Excel langsung dari dashboard.
    12. Visual Weekly Attendance Chart: Grafik bar chart tren kehadiran 7 hari terakhir (tepat waktu vs terlambat).
  - QA Bugs Fixed:
    - BUG-1: Late cutoff hour overflow fix via timedelta
    - BUG-2: Status string compounding normalized
    - BUG-3: CamerasPage delete dialog converted to Shadcn Dialog
    - BUG-4: Runtime threshold synchronization on PUT /settings
    - Missing PUT /cameras/{id} endpoint implemented
    - RecognizePage CHECKED_OUT badge added
    - Manual Check-in/Out status fixed when morning check-in missed (NO_CHECK_IN)
    - Manual Check-in/Out cooldown timestamp tracking enforced
    - RecognizePage state flicker fixed with await on captureAndRecognize
    - RecognizePage stale face cards cleared on stop
    - RegisterPage timer leaks cleared on unmount and frame-drop guard added
    - RegisterPage auto-capture refactored to deterministic async loop (strictly 10 photos, no 35 attempts overflow)
    - Open Default Dashboard: Removed blocking route redirects so `/` opens directly by default with prominent "Masuk Admin" button.
    - Attendance Override Security Enforced: Protected manual status override button in frontend (only rendered when admin is logged in) and secured backend PUT /attendance/{id}/override with bearer token verification.
    - Performance & Latency Optimization:
      - FastAPI event loop unlocked: inference SCRFD/ArcFace wrapped in run_in_threadpool
      - Frame queuing buffer bloat eliminated via isProcessingRef guard in RecognizePage
      - Optimistic UI state update on Check-In and Check-Out (instant 0ms feedback)
    - 1-CCTV and Multi-CCTV Architecture:
      - Mode AUTO added for single CCTV setup (first scan = Check-in, subsequent scan = Check-out)
      - StreamManager background thread worker with auto-reconnect and rate-limiting
      - Static mounting of snapshots at /snapshots for audit image proof
      - RecognizePage dual mode switcher: Webcam vs CCTV Event Stream
      - Auto-closing task for missing checkouts (POST /api/attendance/auto-close)
    - Admin Menu Isolation:
      - All "Sistem & Konfigurasi" menus (CCTV, Multi-Shift, Audit Log, AI Settings) isolated to admin-only.
      - Hidden from sidebar and bottom navigation when logged out.
      - Protected via ProtectedRoute wrapper in App.tsx.
    - **SCENARIO B IMPLEMENTATION (Top-Down CCTV Workaround):**
      - **Problem:** EZVIZ CCTV mounted corner fisheye (~180° FOV), top-down angle, 3-5m distance → Face detection rate low, recognition accuracy poor (out-of-distribution for InsightFace frontal-trained model).
      - **Solution:** Register wajah DARI angle CCTV yang sama (bukan dari webcam frontal).
      - **Backend:** Endpoint baru `POST /api/register-face-from-cctv/{camera_id}` → Capture 10 frame langsung dari RTSP stream, extract embedding dari angle CCTV, save ke database.
      - **Frontend:** Halaman baru `/register-cctv` (admin-only) → Form nama + pilih CCTV → Trigger capture otomatis → User berdiri di posisi sama dengan saat absensi → 10 sampel terekam.
      - **Trade-off:** Accuracy 30-50% (suboptimal, tapi sistem bisa jalan). Rekomendasi tetap: Reposisi CCTV ke eye-level frontal untuk >90% accuracy.
      - **Status:** Implemented & tested (build sukses, endpoint ready, UI ready).
    - **Live Snapshot Page (2026-10-14):**
      - Halaman baru `/live-snapshot` → Tampil snapshot CCTV terbaru real-time (auto-refresh 3 detik).
      - Tombol manual: **Absen Masuk** & **Absen Keluar** → Karyawan berdiri di CCTV → Klik tombol sesuai kebutuhan.
      - Fitur: Identity display, confidence score badge, timestamp, status (sudah/belum absen).
      - UI: Single large snapshot (bukan gallery), fokus pada action buttons, mobile-friendly.
      - Berbeda dari RecognizePage: Ini untuk manual trigger absensi dengan approval visual, bukan auto-scan background.

---

## 🛠️ Architecture Notes (AI Memory)

- **InsightFace bundle**: Kita pakai model package `buffalo_l`. Package ini **langsung bundle** Detection (SCRFD) & Recognition (ArcFace) sekaligus 2D/3D landmarks.
- **No manual crop**: Method `app.get()` dari InsightFace meng-handle detection -> crop -> align -> embedding sekaligus di balik layar.
- **Environment**: Pydantic v2 `BaseSettings` di-config pakai ConfigDict untuk avoid deprecation warning pytest.
