CCTV Snapshot Evaluation Kit

1. Salin scripts/evaluate_snapshots.py ke folder scripts pada proyek CCTV.
2. Jalankan dari direktori utama proyek:
   python scripts/evaluate_snapshots.py --prepare-labels
3. Verifikasi semua identitas pada evaluation_data/snapshot_labels.csv.
4. Jalankan evaluasi:
   python scripts/evaluate_snapshots.py --det-sizes 320,480,640,800

Baca EVALUATION_GUIDE.md sebelum menjalankan evaluasi final.
