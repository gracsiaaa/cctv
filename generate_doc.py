"""
Generate DOCX documentation for AI Face Recognition Attendance System.
"""
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

def set_cell_shading(cell, color_hex):
    shading = cell._element.get_or_add_tcPr()
    shading_elm = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): color_hex,
        qn('w:val'): 'clear'
    })
    shading.append(shading_elm)

def add_styled_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Header row
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.runs[0]
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_shading(cell, '2E4057')

    # Data rows
    for r_idx, row_data in enumerate(rows):
        for c_idx, val in enumerate(row_data):
            cell = table.rows[r_idx + 1].cells[c_idx]
            cell.text = str(val)
            p = cell.paragraphs[0]
            run = p.runs[0] if p.runs else p.add_run(str(val))
            run.font.size = Pt(9)
            if r_idx % 2 == 1:
                set_cell_shading(cell, 'F0F4F8')

    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)

    doc.add_paragraph()
    return table

def build_document():
    doc = Document()

    # ============================================================
    # STYLES
    # ============================================================
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15

    for level in range(1, 4):
        hs = doc.styles[f'Heading {level}']
        hs.font.name = 'Calibri'
        hs.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)

    # ============================================================
    # COVER PAGE
    # ============================================================
    for _ in range(6):
        doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('AI FACE RECOGNITION\nATTENDANCE SYSTEM')
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('Dokumentasi Teknis Sistem Absensi Berbasis Pengenalan Wajah\nMenggunakan CCTV RTSP')
    run.font.size = Pt(13)
    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    doc.add_paragraph()
    doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('Teknologi: InsightFace (SCRFD + ArcFace) • FastAPI • React\nNovember 2026')
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x77, 0x77, 0x77)

    doc.add_page_break()

    # ============================================================
    # DAFTAR ISI
    # ============================================================
    doc.add_heading('DAFTAR ISI', level=1)
    toc_items = [
        ('1.', 'Pendahuluan', '3'),
        ('2.', 'Model AI yang Digunakan', '4'),
        ('  2.1', 'SCRFD (Face Detection)', '4'),
        ('  2.2', 'ArcFace (Face Recognition)', '5'),
        ('  2.3', 'Perbandingan dengan Model Lain', '6'),
        ('3.', 'Dataset', '7'),
        ('  3.1', 'Dataset Training Model', '7'),
        ('  3.2', 'Dataset Evaluasi/Benchmark', '8'),
        ('  3.3', 'Dataset Lokal (Runtime)', '8'),
        ('4.', 'Arsitektur Sistem', '9'),
        ('  4.1', 'Pipeline Face Recognition', '9'),
        ('  4.2', 'Tech Stack', '10'),
        ('  4.3', 'Flow Check-in/Check-out', '10'),
        ('5.', 'Konsep Kunci', '11'),
        ('  5.1', 'Cosine Similarity', '11'),
        ('  5.2', 'Embedding Vector 512-D', '12'),
        ('  5.3', 'Threshold & Trade-off', '12'),
        ('6.', 'Implementasi', '13'),
        ('  6.1', 'Struktur Kode', '13'),
        ('  6.2', 'Endpoint API', '14'),
        ('  6.3', 'Skenario CCTV Top-Down', '15'),
        ('7.', 'Referensi', '16'),
    ]
    for num, title, page in toc_items:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run(f'{num}  {title}')
        run.font.size = Pt(11)
        if not num.startswith(' '):
            run.bold = True

    doc.add_page_break()

    # ============================================================
    # BAB 1: PENDAHULUAN
    # ============================================================
    doc.add_heading('1. Pendahuluan', level=1)

    doc.add_paragraph(
        'Sistem AI Face Recognition Attendance adalah sistem absensi otomatis berbasis '
        'pengenalan wajah yang memanfaatkan kamera CCTV dengan protokol RTSP (Real Time '
        'Streaming Protocol). Sistem ini dirancang untuk menggantikan metode absensi '
        'konvensional (fingerprint, kartu RFID) dengan pendekatan contactless yang lebih '
        'higienis dan efisien.'
    )

    doc.add_heading('1.1 Tujuan Sistem', level=2)
    objectives = [
        'Mendeteksi wajah karyawan secara otomatis dari stream CCTV real-time.',
        'Mengekstrak fitur unik wajah (embedding vector 512 dimensi) menggunakan deep learning.',
        'Mencocokkan wajah terdeteksi dengan database karyawan menggunakan cosine similarity.',
        'Mencatat presensi masuk (check-in) secara otomatis dan presensi pulang (check-out) secara manual.',
        'Menyediakan dashboard monitoring real-time berbasis web.',
    ]
    for obj in objectives:
        doc.add_paragraph(obj, style='List Bullet')

    doc.add_heading('1.2 Keunggulan', level=2)
    advantages = [
        ('Contactless', 'Tidak memerlukan kontak fisik, lebih higienis dibanding fingerprint.'),
        ('Real-time', 'Deteksi dan pengenalan wajah dalam hitungan milidetik.'),
        ('Multi-embedding', 'Mendukung penyimpanan multiple sampel wajah per karyawan untuk akurasi lebih tinggi.'),
        ('Anti-duplicate', 'Cooldown period mencegah pencatatan absensi berulang.'),
        ('Audit Trail', 'Semua aktivitas tercatat lengkap dengan timestamp dan snapshot bukti.'),
    ]
    for title, desc in advantages:
        p = doc.add_paragraph()
        run = p.add_run(f'{title}: ')
        run.bold = True
        run.font.size = Pt(11)
        p.add_run(desc).font.size = Pt(11)

    doc.add_page_break()

    # ============================================================
    # BAB 2: MODEL AI
    # ============================================================
    doc.add_heading('2. Model AI yang Digunakan', level=1)

    doc.add_paragraph(
        'Sistem ini menggunakan package model InsightFace "buffalo_l" (large variant) yang '
        'merupakan bundle dari beberapa model deep learning untuk analisis wajah. Package ini '
        'di-distribusikan dalam format ONNX (Open Neural Network Exchange) dan dijalankan '
        'menggunakan ONNXRuntime dengan CPUExecutionProvider.'
    )

    add_styled_table(doc,
        ['Parameter', 'Value'],
        [
            ['Package name', 'buffalo_l (large variant)'],
            ['Format model', 'ONNX (Open Neural Network Exchange)'],
            ['Runtime', 'ONNXRuntime + CPUExecutionProvider'],
            ['Detection model', 'det_10g.onnx (SCRFD-10GF)'],
            ['Recognition model', 'w600k_r50.onnx (ArcFace ResNet-50)'],
            ['Embedding dimension', '512-d (L2 normalized)'],
            ['Input size (detection)', '640 × 640 pixels'],
            ['Input size (recognition)', '112 × 112 pixels (after alignment)'],
            ['Similarity metric', 'Cosine Similarity (dot product)'],
            ['Threshold default', '0.40 (configurable via dashboard)'],
            ['Download size', '~350 MB'],
        ]
    )

    # --- 2.1 SCRFD ---
    doc.add_heading('2.1 SCRFD – Face Detection', level=2)

    doc.add_paragraph(
        'SCRFD (Sample and Computation Redistribution for Efficient Face Detection) adalah '
        'model deteksi wajah yang dikembangkan oleh tim InsightFace dan dipublikasikan di '
        'ICLR 2021. Model ini menggunakan pendekatan anchor-free single-stage detector dengan '
        'teknik redistribusi sample dan komputasi untuk mencapai keseimbangan optimal antara '
        'kecepatan dan akurasi.'
    )

    doc.add_heading('Cara Kerja SCRFD:', level=3)
    scrfd_steps = [
        'Input: Frame gambar di-resize ke 640×640 pixels.',
        'Backbone: Feature extraction menggunakan modified ResNet dengan FPN (Feature Pyramid Network).',
        'Head: Multi-scale detection head untuk mendeteksi wajah berbagai ukuran.',
        'Output: Bounding box (x1, y1, x2, y2), confidence score, dan 5 facial landmarks.',
        'Landmarks: Mata kiri, mata kanan, hidung, sudut mulut kiri, sudut mulut kanan.',
    ]
    for i, step in enumerate(scrfd_steps, 1):
        doc.add_paragraph(f'{step}', style='List Number')

    doc.add_heading('Keunggulan SCRFD:', level=3)
    doc.add_paragraph(
        'Computation Redistribution: Mengalokasikan ulang komputasi antar stage berdasarkan '
        'kontribusi terhadap akurasi. Stage yang lebih berkontribusi mendapat lebih banyak komputasi.'
    )
    doc.add_paragraph(
        'Sample Redistribution: Mengoptimalkan distribusi positive/negative sample saat training '
        'untuk meningkatkan recall pada wajah kecil.'
    )
    doc.add_paragraph(
        'SCRFD-10GF (yang digunakan dalam buffalo_l) mencapai 96.1% akurasi pada WIDER FACE Easy '
        'dengan inference time ~10ms pada GPU, menjadikannya 2× lebih cepat dari RetinaFace dengan '
        'akurasi yang kompetitif.'
    )

    doc.add_page_break()

    # --- 2.2 ArcFace ---
    doc.add_heading('2.2 ArcFace – Face Recognition', level=2)

    doc.add_paragraph(
        'ArcFace (Additive Angular Margin Loss for Deep Face Recognition) adalah metode face '
        'recognition yang dipublikasikan di CVPR 2019 oleh Deng et al. ArcFace merupakan '
        'state-of-the-art dalam face recognition dan menjadi standar de facto untuk aplikasi '
        'pengenalan wajah modern.'
    )

    doc.add_heading('Konsep Inti ArcFace:', level=3)

    doc.add_paragraph(
        'ArcFace menggunakan Additive Angular Margin Loss sebagai fungsi loss saat training. '
        'Konsep dasarnya:'
    )

    arcface_concepts = [
        ('Embedding Space', 'Setiap wajah direpresentasikan sebagai vektor 512 dimensi dalam '
         'hypersphere (L2 normalized). Vektor ini disebut "embedding" atau "face descriptor".'),
        ('Angular Margin', 'Saat training, ArcFace menambahkan penalty berupa angular margin (m) '
         'antara embedding dan class center. Ini memaksa model untuk mempelajari representasi '
         'yang lebih discriminative.'),
        ('Loss Function', 'L = -log(e^(s·cos(θ+m)) / (e^(s·cos(θ+m)) + Σ e^(s·cos(θj))))\n'
         'dimana θ adalah sudut antara feature dan weight, m adalah angular margin (default 0.5), '
         'dan s adalah scaling factor (default 64).'),
        ('Geometric Interpretation', 'Angular margin lebih geometrically interpretable dibanding '
         'cosine margin (CosFace) atau softmax margin. Margin ditambahkan langsung pada sudut, '
         'sehingga pemisahan antar identitas lebih konsisten di seluruh feature space.'),
    ]
    for title, desc in arcface_concepts:
        p = doc.add_paragraph()
        run = p.add_run(f'{title}: ')
        run.bold = True
        p.add_run(desc)

    doc.add_heading('Pipeline ArcFace (dalam sistem ini):', level=3)
    arcface_pipeline = [
        'Wajah yang terdeteksi oleh SCRFD di-crop berdasarkan bounding box.',
        'Crop di-align menggunakan 5 facial landmarks (affine transformation) ke posisi standar.',
        'Aligned face di-resize ke 112×112 pixels.',
        'Input ke ResNet-50 backbone → menghasilkan vektor 512 dimensi.',
        'Vektor di-normalize dengan L2 norm (||v|| = 1).',
        'Vektor disimpan sebagai "embedding" identitas wajah.',
    ]
    for step in arcface_pipeline:
        doc.add_paragraph(step, style='List Number')

    doc.add_heading('Backbone Architecture:', level=3)
    doc.add_paragraph(
        'Variant yang digunakan: w600k_r50.onnx\n'
        '• Backbone: ResNet-50 (modified untuk face recognition)\n'
        '• Training data: Glint360K (~17 juta gambar, ~360.000 identitas)\n'
        '• Output layer: 512-d fully connected layer\n'
        '• Activation: PReLU\n'
        '• Normalization: Batch Normalization + L2 Normalization pada output'
    )

    doc.add_page_break()

    # --- 2.3 Perbandingan ---
    doc.add_heading('2.3 Perbandingan dengan Model Lain', level=2)

    doc.add_heading('Face Detection:', level=3)
    add_styled_table(doc,
        ['Model', 'Speed (640×640)', 'WIDER FACE Easy', 'Keterangan'],
        [
            ['MTCNN', '~30ms', '85.1%', 'Cascade 3-stage, lebih lambat'],
            ['RetinaFace', '~20ms', '96.3%', 'Single-stage, anchor-based'],
            ['SCRFD (digunakan)', '~10ms', '96.1%', '2× lebih cepat, computation redistribution'],
            ['YOLO-Face', '~8ms', '94.5%', 'Cepat, tapi akurasi lebih rendah'],
        ]
    )

    doc.add_heading('Face Recognition:', level=3)
    add_styled_table(doc,
        ['Model', 'Loss Function', 'LFW Accuracy', 'Tahun', 'Keterangan'],
        [
            ['FaceNet', 'Triplet Loss', '99.63%', '2015', 'Pioneer face embedding (Google)'],
            ['SphereFace', 'A-Softmax', '99.42%', '2017', 'Angular softmax loss'],
            ['CosFace', 'LMCL', '99.73%', '2018', 'Large margin cosine loss'],
            ['ArcFace (digunakan)', 'Angular Margin', '99.83%', '2019', 'State-of-the-art, additive angular margin'],
        ]
    )

    doc.add_paragraph(
        'ArcFace dipilih karena memiliki akurasi tertinggi (99.83% pada LFW benchmark) dan '
        'implementasi yang mature melalui library InsightFace. Angular margin loss menghasilkan '
        'embedding yang lebih discriminative dibanding metode sebelumnya.'
    )

    doc.add_page_break()

    # ============================================================
    # BAB 3: DATASET
    # ============================================================
    doc.add_heading('3. Dataset', level=1)

    p = doc.add_paragraph()
    run = p.add_run('Penting: ')
    run.bold = True
    run.font.color.rgb = RGBColor(0xCC, 0x00, 0x00)
    p.add_run(
        'Sistem ini TIDAK melakukan training model dari nol. Model SCRFD dan ArcFace yang '
        'digunakan adalah pretrained model yang sudah di-train oleh tim InsightFace pada dataset '
        'berskala besar. Sistem ini menggunakan model tersebut sebagai feature extractor.'
    )

    doc.add_heading('3.1 Dataset Training Model (oleh InsightFace)', level=2)

    doc.add_heading('Dataset Training SCRFD (Face Detection):', level=3)
    add_styled_table(doc,
        ['Dataset', 'Jumlah Gambar', 'Jumlah Wajah', 'Keterangan'],
        [
            ['WIDER FACE', '~32.000', '~394.000', 'Dataset standar face detection. Berisi wajah dengan berbagai skala (8px-1000px), oklusi (0%-90%), pose (frontal, profile, extreme), ekspresi, dan kondisi pencahayaan.'],
        ]
    )

    doc.add_paragraph(
        'WIDER FACE terdiri dari 3 split: Easy (61 event), Medium (20 event), dan Hard (22 event). '
        'Split Hard berisi wajah sangat kecil (<20px), sangat teroklusi, dan blur.'
    )

    doc.add_heading('Dataset Training ArcFace (Face Recognition):', level=3)
    add_styled_table(doc,
        ['Dataset', 'Jumlah Gambar', 'Jumlah Identitas', 'Keterangan'],
        [
            ['MS1MV2', '~5.8 juta', '~85.000', 'Cleaned version dari MS-Celeb-1M (Microsoft). Noise label dan duplicate sudah dihapus melalui semi-automatic cleaning.'],
            ['Glint360K', '~17 juta', '~360.000', 'Dataset terbesar untuk face recognition. Digunakan untuk training variant w600k (yang dipakai dalam sistem ini).'],
        ]
    )

    doc.add_paragraph(
        'Variant w600k_r50 (yang digunakan dalam buffalo_l) di-train pada Glint360K dengan '
        '17 juta gambar dari 360.000 identitas berbeda. Dataset ini mencakup variasi: ras, '
        'usia, gender, ekspresi wajah, pencahayaan, dan aksesori (kacamata, topi, masker).'
    )

    doc.add_page_break()

    doc.add_heading('3.2 Dataset Evaluasi/Benchmark', level=2)

    doc.add_paragraph(
        'Akurasi model ArcFace diukur menggunakan beberapa benchmark standar:'
    )

    add_styled_table(doc,
        ['Benchmark', 'Akurasi', 'Jumlah Pasang', 'Fokus Evaluasi'],
        [
            ['LFW (Labeled Faces in the Wild)', '99.83%', '6.000 pairs', 'Verifikasi wajah in-the-wild (variasi pose, ekspresi, pencahayaan)'],
            ['CFP-FP (Celebrities Frontal-Profile)', '98.37%', '7.000 pairs', 'Cross-pose: frontal vs profile (perubahan sudut wajah)'],
            ['AgeDB-30', '98.28%', '6.000 pairs', 'Cross-age: verifikasi wajah dengan perbedaan usia >30 tahun'],
            ['CALFW (Cross-Age LFW)', '96.08%', '6.000 pairs', 'Variasi usia pada dataset LFW'],
            ['CPLFW (Cross-Pose LFW)', '93.37%', '6.000 pairs', 'Variasi pose pada dataset LFW'],
        ]
    )

    doc.add_heading('3.3 Dataset Lokal (Runtime)', level=2)

    doc.add_paragraph(
        'Saat runtime, sistem menyimpan data karyawan dalam format JSON flat-file:'
    )

    add_styled_table(doc,
        ['File', 'Isi', 'Format'],
        [
            ['data/db.json', 'Embedding wajah karyawan (512-d vectors)', '{ "nama": [array of float[512]] }'],
            ['data/attendance.json', 'Log presensi harian', 'Array of { name, date, check_in, check_out, status }'],
            ['data/cameras.json', 'Konfigurasi kamera CCTV', 'Array of { id, name, rtsp_url, mode }'],
            ['data/snapshots/', 'Foto bukti snapshot dari CCTV', 'File JPEG dengan timestamp'],
            ['data/schedules.json', 'Jadwal shift kerja', '{ check_in, check_out, tolerance }'],
            ['data/settings.json', 'Konfigurasi threshold & cooldown', '{ recognition_threshold, cooldown_seconds }'],
        ]
    )

    doc.add_page_break()

    # ============================================================
    # BAB 4: ARSITEKTUR SISTEM
    # ============================================================
    doc.add_heading('4. Arsitektur Sistem', level=1)

    doc.add_heading('4.1 Pipeline Face Recognition', level=2)

    doc.add_paragraph(
        'Pipeline pengenalan wajah terdiri dari 5 tahap utama yang dijalankan secara sekuensial '
        'untuk setiap frame yang ditangkap dari stream CCTV:'
    )

    pipeline_steps = [
        ('Tahap 1 – Frame Capture',
         'Frame ditangkap dari stream RTSP CCTV menggunakan OpenCV VideoCapture. '
         'Background worker thread menangkap frame setiap 1-2 detik untuk menjaga keseimbangan '
         'antara responsivitas dan beban CPU.'),
        ('Tahap 2 – Face Detection (SCRFD)',
         'Frame di-resize ke 640×640 dan diproses oleh model SCRFD. Output: bounding box '
         '(x1, y1, x2, y2), confidence score, dan 5 facial landmarks untuk setiap wajah '
         'yang terdeteksi. Threshold deteksi default: 0.5.'),
        ('Tahap 3 – Face Alignment',
         'Wajah yang terdeteksi di-crop dan di-align menggunakan affine transformation '
         'berdasarkan 5 landmarks. Tujuannya: menormalisasi posisi mata, hidung, dan mulut '
         'ke koordinat standar. Output: aligned face 112×112 pixels.'),
        ('Tahap 4 – Feature Extraction (ArcFace)',
         'Aligned face diproses oleh model ArcFace (ResNet-50). Output: vektor embedding '
         '512 dimensi yang di-normalize dengan L2 norm (||v|| = 1). Vektor ini merepresentasikan '
         'identitas unik wajah.'),
        ('Tahap 5 – Face Matching',
         'Embedding wajah baru dibandingkan dengan seluruh embedding di database menggunakan '
         'cosine similarity (dot product karena sudah L2-normalized). Jika similarity tertinggi '
         '≥ threshold (0.40), wajah dikenali. Jika tidak, ditandai sebagai "Unknown".'),
    ]
    for title, desc in pipeline_steps:
        p = doc.add_paragraph()
        run = p.add_run(f'{title}\n')
        run.bold = True
        p.add_run(desc)

    doc.add_heading('Diagram Pipeline:', level=3)
    pipeline_diagram = (
        'Frame (CCTV RTSP)\n'
        '      │\n'
        '      ▼\n'
        '┌─────────────┐\n'
        '│   SCRFD      │ → Bounding Box + 5 Landmarks\n'
        '│  Detection   │\n'
        '└──────┬───────┘\n'
        '       │\n'
        '       ▼\n'
        '┌─────────────┐\n'
        '│  Alignment   │ → Crop + Affine Transform → 112×112\n'
        '└──────┬───────┘\n'
        '       │\n'
        '       ▼\n'
        '┌─────────────┐\n'
        '│   ArcFace    │ → Embedding Vector 512-d (L2 normalized)\n'
        '│  ResNet-50   │\n'
        '└──────┬───────┘\n'
        '       │\n'
        '       ▼\n'
        '┌─────────────┐\n'
        '│   Cosine     │ → Match / Unknown\n'
        '│  Similarity  │\n'
        '└──────┬───────┘\n'
        '       │\n'
        '       ▼\n'
        '┌─────────────┐\n'
        '│ Attendance   │ → Check-in (Auto) / Check-out (Manual)\n'
        '│   Engine     │\n'
        '└─────────────┘'
    )
    p = doc.add_paragraph(pipeline_diagram)
    p.style = doc.styles['Normal']
    for run in p.runs:
        run.font.name = 'Consolas'
        run.font.size = Pt(8)

    doc.add_page_break()

    doc.add_heading('4.2 Tech Stack', level=2)

    add_styled_table(doc,
        ['Layer', 'Teknologi', 'Fungsi'],
        [
            ['AI/ML', 'InsightFace, ONNX Runtime, OpenCV, NumPy', 'Face detection, embedding extraction, image processing'],
            ['Backend API', 'FastAPI, Uvicorn, Pydantic', 'REST API server, request validation'],
            ['Storage', 'JSON flat-file (tanpa database server)', 'Persistensi data embedding, attendance, config'],
            ['Frontend', 'React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui', 'Dashboard monitoring real-time'],
            ['Stream', 'OpenCV VideoCapture (RTSP protocol)', 'CCTV stream consumer, background thread worker'],
            ['Auth', 'Token-based Bearer Authentication', 'Proteksi endpoint admin'],
        ]
    )

    doc.add_heading('4.3 Flow Check-in / Check-out', level=2)

    doc.add_paragraph(
        'Sistem menggunakan hybrid flow: check-in otomatis oleh background worker, '
        'check-out manual oleh karyawan melalui tombol di dashboard.'
    )

    flow_steps = [
        ('Check-in Otomatis',
         '1. Background stream worker capture frame CCTV setiap 1-2 detik.\n'
         '2. Jika wajah terdeteksi dan dikenali (confidence ≥ threshold):\n'
         '   a. Cek apakah sudah ada record hari ini → Jika belum: buat record CHECK-IN.\n'
         '   b. Evaluasi status: ON_TIME (sebelum batas toleransi) atau LATE.\n'
         '   c. Simpan ke attendance.json + kirim notifikasi.\n'
         '3. Jika sudah check-in hari ini → Skip (tidak auto check-out).\n'
         '4. Cooldown 5 menit mencegah log event berulang.'),
        ('Check-out Manual',
         '1. Karyawan buka halaman Live Snapshot di browser.\n'
         '2. Berdiri di depan CCTV → Wajah terdeteksi otomatis (auto-refresh 3 detik).\n'
         '3. Status "Sudah Absen Masuk" muncul → Tombol "Absen Keluar" aktif.\n'
         '4. Karyawan klik tombol "Absen Keluar" → Sistem catat jam pulang.\n'
         '5. Status dievaluasi: EARLY_LEAVE (sebelum jam pulang) atau ON_TIME.'),
    ]
    for title, desc in flow_steps:
        p = doc.add_paragraph()
        run = p.add_run(f'{title}:\n')
        run.bold = True
        p.add_run(desc)

    doc.add_page_break()

    # ============================================================
    # BAB 5: KONSEP KUNCI
    # ============================================================
    doc.add_heading('5. Konsep Kunci', level=1)

    doc.add_heading('5.1 Cosine Similarity', level=2)

    doc.add_paragraph(
        'Cosine similarity mengukur kesamaan arah antara dua vektor dalam ruang berdimensi tinggi. '
        'Formula:'
    )

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('Cosine Similarity(A, B) = (A · B) / (||A|| × ||B||)')
    run.bold = True
    run.font.size = Pt(12)
    run.font.name = 'Consolas'

    doc.add_paragraph(
        'Karena embedding ArcFace sudah di-normalize dengan L2 norm (||v|| = 1), maka cosine '
        'similarity menjadi sederhana: dot product dari dua vektor.'
    )

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('similarity = dot(A, B)  (karena ||A|| = ||B|| = 1)')
    run.font.name = 'Consolas'
    run.font.size = Pt(11)

    doc.add_paragraph(
        'Range nilai: -1 sampai 1. Semakin mendekati 1, semakin mirip kedua wajah. '
        'Dalam praktik, wajah orang yang sama menghasilkan similarity 0.5-0.9, sedangkan '
        'wajah orang berbeda menghasilkan similarity <0.3.'
    )

    doc.add_heading('Mengapa Cosine Similarity (bukan Euclidean Distance)?', level=3)

    add_styled_table(doc,
        ['Metrik', 'Formula', 'Kelebihan', 'Kekurangan'],
        [
            ['Cosine Similarity', 'dot(A,B) / (||A||·||B||)', 'Invariant terhadap magnitude, fokus pada "arah" vektor', 'Range -1 s/d 1 (perlu threshold)'],
            ['Euclidean Distance', '√Σ(Ai-Bi)²', 'Intuitif, mengukur jarak absolut', 'Sensitif terhadap magnitude/skala'],
        ]
    )

    doc.add_paragraph(
        'Untuk embedding yang L2-normalized, cosine similarity dan Euclidean distance memberikan '
        'ranking yang identik. Namun cosine similarity lebih efisien secara komputasi (hanya dot product) '
        'dan lebih mudah di-threshold.'
    )

    doc.add_page_break()

    doc.add_heading('5.2 Embedding Vector 512-D', level=2)

    doc.add_paragraph(
        'Embedding adalah representasi numerik dari wajah dalam ruang vektor berdimensi tinggi. '
        'Setiap wajah dikonversi menjadi array 512 bilangan floating-point yang merangkum fitur-fitur '
        'unik wajah tersebut.'
    )

    embed_properties = [
        ('Dimensi', '512 float values (contoh: [0.0234, -0.0156, 0.0891, ..., -0.0412])'),
        ('Normalisasi', 'L2 normalized (panjang vektor = 1)'),
        ('Sifat', 'Embedding TIDAK bisa di-reverse menjadi gambar wajah asli (one-way function)'),
        ('Uniqueness', 'Wajah orang berbeda menghasilkan embedding yang berbeda arah di 512-D space'),
        ('Robustness', 'Embedding relatif stabil terhadap perubahan kecil (ekspresi, lighting, aksesori ringan)'),
        ('Storage', 'Per embedding: 512 × 4 bytes (float32) = 2 KB. Per orang (10 sampel): ~20 KB'),
    ]
    for title, desc in embed_properties:
        p = doc.add_paragraph()
        run = p.add_run(f'{title}: ')
        run.bold = True
        p.add_run(desc)

    doc.add_heading('5.3 Threshold & Trade-off', level=2)

    doc.add_paragraph(
        'Threshold menentukan batas minimum similarity untuk menerima atau menolak kecocokan. '
        'Pemilihan threshold melibatkan trade-off antara dua jenis kesalahan:'
    )

    add_styled_table(doc,
        ['Threshold', 'False Positive Rate', 'False Negative Rate', 'Keterangan'],
        [
            ['0.30 (sangat rendah)', 'Tinggi ↑', 'Rendah ↓', 'Banyak orang salah dikenali, tapi jarang miss'],
            ['0.40 (default sistem)', 'Sedang', 'Sedang', 'Keseimbangan untuk CCTV top-down angle'],
            ['0.50 (sedang)', 'Rendah', 'Sedang', 'Cocok untuk kamera frontal jarak dekat'],
            ['0.65 (tinggi)', 'Sangat rendah ↓', 'Tinggi ↑', 'Hanya accept match sangat yakin'],
        ]
    )

    doc.add_paragraph(
        'Sistem ini menggunakan threshold 0.40 karena CCTV dipasang dengan angle top-down '
        '(fisheye dari atas), yang menghasilkan embedding berbeda dari angle frontal saat training. '
        'Threshold lebih rendah diperlukan untuk mengakomodasi gap ini.'
    )

    doc.add_page_break()

    # ============================================================
    # BAB 6: IMPLEMENTASI
    # ============================================================
    doc.add_heading('6. Implementasi', level=1)

    doc.add_heading('6.1 Struktur Kode', level=2)

    code_structure = [
        ['app/', '', 'Root package backend'],
        ['app/api/routes.py', '~530 baris', 'Semua endpoint REST API (register, recognize, attendance, cameras, dll)'],
        ['app/detection/detector.py', '~40 baris', 'Wrapper class FaceDetector untuk SCRFD'],
        ['app/recognition/embedder.py', '~50 baris', 'Wrapper class FaceEmbedder untuk ArcFace'],
        ['app/matching/matcher.py', '~37 baris', 'FaceMatcher dengan cosine similarity dan multi-embedding support'],
        ['app/pipeline/recognizer.py', '~60 baris', 'FaceRecognizerPipeline merangkai detector + embedder + matcher'],
        ['app/attendance/engine.py', '~520 baris', 'AttendanceEngine: check-in/out, shift, cooldown, override, audit'],
        ['app/stream/worker.py', '~180 baris', 'RTSPStreamWorker + StreamManager untuk background CCTV processing'],
        ['app/storage/json_store.py', '~50 baris', 'JSON flat-file persistence layer'],
        ['app/cameras/manager.py', '~80 baris', 'CRUD kamera CCTV + test koneksi RTSP'],
        ['app/auth/security.py', '~40 baris', 'Simple token-based admin authentication'],
        ['app/config.py', '~13 baris', 'Pydantic Settings (threshold, port, model name)'],
        ['app/main.py', '~30 baris', 'FastAPI app entry point, CORS, static mount'],
        ['frontend/', '', 'React 18 + TypeScript + Vite + Tailwind + shadcn/ui'],
        ['tests/', '~200 baris', '31 unit tests (detection, embedding, matching, pipeline, API, attendance)'],
    ]
    add_styled_table(doc,
        ['File/Folder', 'Ukuran', 'Fungsi'],
        code_structure
    )

    doc.add_page_break()

    doc.add_heading('6.2 Endpoint API', level=2)

    api_endpoints = [
        ['GET', '/api/status', 'Status server + jumlah wajah terdaftar'],
        ['GET', '/api/stats', 'Statistik presensi hari ini'],
        ['POST', '/api/register-face', 'Registrasi wajah via upload foto (webcam)'],
        ['POST', '/api/register-face-from-cctv/{camera_id}', 'Registrasi wajah langsung dari stream CCTV'],
        ['POST', '/api/recognize', 'Recognize wajah dari uploaded image'],
        ['GET', '/api/registered-faces', 'Daftar semua wajah terdaftar'],
        ['DELETE', '/api/delete-face/{name}', 'Hapus wajah dari database'],
        ['GET', '/api/attendance', 'Log presensi (filter by date)'],
        ['GET', '/api/attendance/status/{name}', 'Status presensi hari ini per orang'],
        ['POST', '/api/attendance/check-in', 'Manual check-in'],
        ['POST', '/api/attendance/check-out', 'Manual check-out'],
        ['POST', '/api/auth/login', 'Login admin (admin/admin123)'],
        ['GET', '/api/cameras', 'Daftar kamera CCTV'],
        ['POST', '/api/cameras', 'Tambah kamera baru'],
        ['POST', '/api/cameras/{id}/test', 'Test koneksi RTSP'],
        ['GET', '/api/stream/events', 'Event terbaru dari background worker'],
        ['POST', '/api/stream/start/{camera_id}', 'Start background stream worker'],
    ]
    add_styled_table(doc,
        ['Method', 'Endpoint', 'Fungsi'],
        api_endpoints
    )

    doc.add_heading('6.3 Skenario CCTV Top-Down (Scenario B)', level=2)

    doc.add_paragraph(
        'CCTV EZVIZ dalam sistem ini dipasang di sudut ruangan dengan angle fisheye ~180° FOV, '
        'posisi top-down (melihat dari atas ke bawah). Ini menghasilkan tantangan teknis:'
    )

    challenges = [
        ('Out-of-Distribution', 'Model ArcFace di-train pada dataset wajah frontal (LFW, Glint360K). '
         'Wajah dari angle atas (crown of head) sangat berbeda dari data training.'),
        ('Small Face Size', 'Jarak 3-5 meter + fisheye distortion menghasilkan wajah ~40-60px di frame, '
         'sementara SCRFD membutuhkan minimal ~80px untuk reliable detection.'),
        ('Fisheye Distortion', 'Lens distortion di edge frame membuat bentuk wajah terdistorsi, '
         'menghasilkan embedding yang inkonsisten antara center dan edge.'),
    ]
    for title, desc in challenges:
        p = doc.add_paragraph()
        run = p.add_run(f'{title}: ')
        run.bold = True
        run.font.color.rgb = RGBColor(0xCC, 0x00, 0x00)
        p.add_run(desc)

    doc.add_heading('Solusi (Workaround):', level=3)
    solutions = [
        'Registrasi wajah dilakukan DARI angle CCTV yang sama (bukan dari webcam frontal), '
        'sehingga embedding saat registrasi cocok dengan embedding saat absensi.',
        'Threshold diturunkan dari 0.65 ke 0.40 untuk mengakomodasi variasi angle.',
        'Multi-embedding per karyawan (10 sampel dari CCTV) meningkatkan coverage variasi posisi.',
        'Expected accuracy: 30-50% (suboptimal). Rekomendasi: reposisi CCTV ke eye-level '
        'frontal untuk accuracy >90%.',
    ]
    for sol in solutions:
        doc.add_paragraph(sol, style='List Bullet')

    doc.add_page_break()

    # ============================================================
    # BAB 7: REFERENSI
    # ============================================================
    doc.add_heading('7. Referensi', level=1)

    references = [
        'Deng, J., Guo, J., Xue, N., & Zafeiriou, S. (2019). "ArcFace: Additive Angular Margin Loss '
        'for Deep Face Recognition." IEEE/CVF Conference on Computer Vision and Pattern Recognition '
        '(CVPR), pp. 4690-4699.',

        'Guo, J., Deng, J., Lattas, A., & Zafeiriou, S. (2021). "Sample and Computation Redistribution '
        'for Efficient Face Detection." International Conference on Learning Representations (ICLR).',

        'Deng, J., Guo, J., Zhou, Y., Yu, J., Kotsia, I., & Zafeiriou, S. (2019). "RetinaFace: '
        'Single-Shot Multi-Level Face Localisation in the Wild." arXiv preprint arXiv:1905.00641.',

        'Schroff, F., Kalenichenko, D., & Philbin, J. (2015). "FaceNet: A Unified Embedding for '
        'Face Recognition and Clustering." IEEE/CVF Conference on Computer Vision and Pattern '
        'Recognition (CVPR), pp. 815-823.',

        'Yang, S., Luo, P., Loy, C. C., & Tang, X. (2016). "WIDER FACE: A Face Detection Benchmark." '
        'IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), pp. 5525-5533.',

        'Huang, G. B., Ramesh, M., Berg, T., & Learned-Miller, E. (2007). "Labeled Faces in the Wild: '
        'A Database for Studying Face Recognition in Unconstrained Environments." University of '
        'Massachusetts, Amherst, Technical Report 07-49.',

        'An, X., Deng, J., Guo, J., Feng, Z., Zhu, X., Yang, J., & Liu, T. (2021). "Killing Two '
        'Birds with One Stone: Efficient and Robust Training of Face Recognition CNNs by Partial FC." '
        'IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR).',

        'InsightFace: 2D and 3D Face Analysis Project. https://github.com/deepinsight/insightface',
    ]
    for i, ref in enumerate(references, 1):
        p = doc.add_paragraph()
        run = p.add_run(f'[{i}] ')
        run.bold = True
        p.add_run(ref)
        p.paragraph_format.space_after = Pt(8)

    # ============================================================
    # SAVE
    # ============================================================
    output_path = r'D:\Code\CCTV\Dokumentasi_AI_Face_Recognition_System.docx'
    doc.save(output_path)
    print(f'Document saved: {output_path}')
    return output_path

if __name__ == '__main__':
    build_document()
