#!/usr/bin/env python3
"""Offline evaluation for this CCTV project's InsightFace buffalo_l pipeline.

Uses the existing data/face_db.json as the enrolled identity gallery and
images from data/snapshots as query images. Each snapshot is expected to contain
one real face, as confirmed by the project owner. Snapshot filenames contain
the system's previous prediction; that prediction is NOT treated as ground truth.

Workflow:
  1) Generate a review CSV:
       python scripts/evaluate_snapshots.py --prepare-labels
  2) Manually fill true_identity and set verified=yes for every row.\n     Legacy true_identity_verified/verification_status columns are also accepted.
  3) Run evaluation:
       python scripts/evaluate_snapshots.py --det-sizes 320,480,640,800

The script canonicalizes the two duplicate-name pairs confirmed by the user:
  Sdq == Muhammad Sidiq
  Grace == Gracsia Andhika
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import numpy as np
from insightface.app import FaceAnalysis

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
UNKNOWN_LABELS = {
    "unknown", "unknown_face", "unregistered", "not_registered",
    "tidak dikenal", "tidak_dikenal", "tidak terdaftar",
}

# Canonical names reflect the user's confirmation that these are aliases.
ALIASES = {
    "aga": "Aga",
    "sdq": "Muhammad Sidiq",
    "muhammad sidiq": "Muhammad Sidiq",
    "grace": "Gracsia Andhika",
    "gracsia andhika": "Gracsia Andhika",
}


def canonicalize_identity(value: str) -> str:
    value = (value or "").strip()
    key = re.sub(r"\s+", " ", value).casefold()
    if key in UNKNOWN_LABELS:
        return "Unknown"
    return ALIASES.get(key, value)


def parse_filename_prediction(filename: str) -> str:
    """Extract the system's saved label from snap_<epoch>_<name>_cam_<id>.jpg."""
    stem = Path(filename).stem
    match = re.match(r"^snap_\d+_(.+?)_cam_", stem, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""


def list_images(root: Path) -> List[Path]:
    return sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
    )


def make_label_template(snapshot_dir: Path, csv_path: Path) -> int:
    images = list_images(snapshot_dir)
    if not images:
        raise FileNotFoundError(f"Tidak ada gambar di folder snapshot: {snapshot_dir}")

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "filename",
                "predicted_label_from_filename",
                "suggested_canonical_label",
                "true_identity",
                "verified",
                "notes",
            ],
        )
        writer.writeheader()
        for image_path in images:
            predicted = parse_filename_prediction(image_path.name)
            writer.writerow({
                "filename": image_path.name,
                "predicted_label_from_filename": predicted,
                # This is only a suggestion for human review, never used as truth.
                "suggested_canonical_label": canonicalize_identity(predicted) if predicted else "",
                "true_identity": "",
                "verified": "no",
                "notes": "",
            })
    return len(images)


def load_gallery(db_path: Path) -> Tuple[Dict[str, np.ndarray], Dict[str, int], int]:
    if not db_path.exists():
        raise FileNotFoundError(f"Database wajah tidak ditemukan: {db_path}")
    with db_path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, dict) or not raw:
        raise ValueError("face_db.json kosong atau formatnya bukan objek JSON.")

    grouped: Dict[str, List[np.ndarray]] = defaultdict(list)
    original_counts: Dict[str, int] = {}
    total_vectors = 0
    for raw_name, raw_vectors in raw.items():
        canonical_name = canonicalize_identity(str(raw_name))
        arr = np.asarray(raw_vectors, dtype=np.float32)
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        if arr.ndim != 2:
            raise ValueError(f"Format embedding untuk '{raw_name}' tidak valid: shape {arr.shape}")
        if arr.shape[1] != 512:
            raise ValueError(
                f"Embedding '{raw_name}' memiliki {arr.shape[1]} dimensi, seharusnya 512."
            )
        original_counts[str(raw_name)] = int(arr.shape[0])
        for vector in arr:
            norm = float(np.linalg.norm(vector))
            if not np.isfinite(norm) or norm <= 1e-12:
                continue
            grouped[canonical_name].append(vector / norm)
            total_vectors += 1

    gallery: Dict[str, np.ndarray] = {}
    for name, vectors in grouped.items():
        if vectors:
            gallery[name] = np.vstack(vectors).astype(np.float32)
    if not gallery:
        raise ValueError("Tidak ada embedding valid di face_db.json.")
    return gallery, original_counts, total_vectors


def load_verified_labels(labels_csv: Path, snapshot_root: Path, image_paths: Sequence[Path]) -> Dict[str, str]:
    if not labels_csv.exists():
        raise FileNotFoundError(
            f"File label belum ada: {labels_csv}\n"
            "Buat template dahulu dengan opsi --prepare-labels."
        )

    labels: Dict[str, str] = {}
    with labels_csv.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = set(reader.fieldnames or [])

        # Accept the current CSV schema and the legacy template schema.
        if "filename" not in fields:
            raise ValueError(
                "CSV harus memiliki kolom filename. "
                "Periksa file evaluation_data/snapshot_labels.csv."
            )

        if "true_identity" in fields:
            identity_column = "true_identity"
        elif "true_identity_verified" in fields:
            identity_column = "true_identity_verified"
        else:
            raise ValueError(
                "Kolom identitas sebenarnya tidak ditemukan. "
                "Gunakan true_identity atau true_identity_verified."
            )

        if "verified" in fields:
            verified_column = "verified"
        elif "verification_status" in fields:
            verified_column = "verification_status"
        else:
            verified_column = None

        accepted_statuses = {
            "yes", "ya", "true", "1", "verified",
            "terverifikasi", "dikonfirmasi", "confirmed",
        }

        for row_num, row in enumerate(reader, start=2):
            filename = (row.get("filename") or "").strip().replace("\\\\", "/")
            truth = (row.get(identity_column) or "").strip()
            verified = (
                (row.get(verified_column) or "").strip().casefold()
                if verified_column else ""
            )

            if not filename or not truth:
                continue

            if verified_column and verified not in accepted_statuses:
                continue

            key = Path(filename).name
            if key in labels:
                raise ValueError(f"Nama file duplikat di CSV pada baris {row_num}: {key}")
            labels[key] = canonicalize_identity(truth)

    available = {p.name for p in image_paths}
    missing = sorted(available - set(labels))
    extra = sorted(set(labels) - available)
    if missing:
        preview = ", ".join(missing[:8])
        raise ValueError(
            f"Ada {len(missing)} snapshot yang belum memiliki true_identity terverifikasi. "
            f"Contoh: {preview}. Isi true_identity dan ubah verified menjadi yes."
        )
    if extra:
        print(f"Peringatan: {len(extra)} baris CSV tidak ditemukan di folder snapshot; baris tersebut diabaikan.")
    return labels


def match_embedding(embedding: np.ndarray, gallery: Dict[str, np.ndarray]) -> Tuple[str, float]:
    query = np.asarray(embedding, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(query))
    if norm <= 1e-12:
        return "Unknown", 0.0
    query = query / norm
    best_name = "Unknown"
    best_score = -1.0
    for name, vectors in gallery.items():
        scores = vectors @ query
        score = float(np.max(scores)) if scores.size else -1.0
        if score > best_score:
            best_name, best_score = name, score
    return best_name, max(0.0, best_score)


def parse_sizes(value: str) -> List[int]:
    try:
        sizes = [int(part.strip()) for part in value.split(",") if part.strip()]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Ukuran harus berupa angka, contoh 320,480,640,800") from exc
    if not sizes or any(size <= 0 for size in sizes):
        raise argparse.ArgumentTypeError("Ukuran input harus lebih besar dari nol.")
    return sizes


def get_metrics(rows: Sequence[dict], threshold: float) -> dict:
    total = len(rows)
    if total == 0:
        return {}
    known_rows = [r for r in rows if r["true_identity"] != "Unknown"]
    unknown_rows = [r for r in rows if r["true_identity"] == "Unknown"]

    def prediction_for(row: dict) -> str:
        if row["faces_detected"] == 0:
            return "NoFace"
        if row["best_score"] < threshold:
            return "Unknown"
        return row["best_identity"]

    predictions = [prediction_for(r) for r in rows]
    correct = sum(p == r["true_identity"] for p, r in zip(predictions, rows))
    known_correct = sum(
        prediction_for(r) == r["true_identity"] for r in known_rows
    )
    known_rejected = sum(
        prediction_for(r) in {"Unknown", "NoFace"} for r in known_rows
    )
    known_wrong_identity = sum(
        prediction_for(r) not in {r["true_identity"], "Unknown", "NoFace"}
        for r in known_rows
    )
    unknown_false_accept = sum(
        prediction_for(r) not in {"Unknown", "NoFace"} for r in unknown_rows
    )
    detected_rows = [r for r in rows if r["faces_detected"] > 0]
    detected_correct = sum(
        prediction_for(r) == r["true_identity"] for r in detected_rows
    )

    redetected = sum(1 for r in rows if r["faces_detected"] >= 1)
    no_face_on_rerun = total - redetected
    extra_detections = sum(max(0, r["faces_detected"] - 1) for r in rows)

    return {
        "threshold": threshold,
        "images": total,
        "known_images": len(known_rows),
        "unknown_images": len(unknown_rows),
        "mean_inference_ms": float(np.mean([r["inference_ms"] for r in rows])),
        "median_inference_ms": float(np.median([r["inference_ms"] for r in rows])),
        "snapshot_redetection_rate": redetected / total if total else 0.0,
        "snapshots_with_no_face_on_rerun": no_face_on_rerun,
        "snapshots_with_multiple_faces_on_rerun": sum(1 for r in rows if r["faces_detected"] > 1),
        "extra_detections_beyond_expected_one": extra_detections,
        "overall_accuracy": correct / total,
        "known_identity_accuracy": known_correct / len(known_rows) if known_rows else float("nan"),
        "accuracy_when_face_detected": detected_correct / len(detected_rows) if detected_rows else float("nan"),
        "far_unknown_false_accept_rate": unknown_false_accept / len(unknown_rows) if unknown_rows else float("nan"),
        "frr_known_reject_rate": known_rejected / len(known_rows) if known_rows else float("nan"),
        "known_misidentification_rate": known_wrong_identity / len(known_rows) if known_rows else float("nan"),
        "no_face_count": sum(1 for r in rows if r["faces_detected"] == 0),
        "multiple_face_detection_count": sum(1 for r in rows if r["faces_detected"] > 1),
    }


def threshold_metrics(rows: Sequence[dict], thresholds: Iterable[float]) -> List[dict]:
    result = []
    known = [r for r in rows if r["true_identity"] != "Unknown"]
    unknown = [r for r in rows if r["true_identity"] == "Unknown"]
    for threshold in thresholds:
        false_accept = 0
        false_reject = 0
        correct_known = 0
        wrong_known = 0
        for row in unknown:
            if row["faces_detected"] > 0 and row["best_score"] >= threshold:
                false_accept += 1
        for row in known:
            if row["faces_detected"] == 0 or row["best_score"] < threshold:
                false_reject += 1
            elif row["best_identity"] == row["true_identity"]:
                correct_known += 1
            else:
                wrong_known += 1
        result.append({
            "threshold": float(threshold),
            "far": false_accept / len(unknown) if unknown else float("nan"),
            "frr": false_reject / len(known) if known else float("nan"),
            "known_correct_identification_rate": correct_known / len(known) if known else float("nan"),
            "known_misidentification_rate": wrong_known / len(known) if known else float("nan"),
            "unknown_count": len(unknown),
            "known_count": len(known),
        })
    return result


def write_csv(path: Path, rows: Sequence[dict]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def save_confusion_matrix(rows: Sequence[dict], threshold: float, path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    actual_labels = sorted({r["true_identity"] for r in rows}, key=str.casefold)
    predicted_labels = sorted(
        {r["best_identity"] if r["faces_detected"] and r["best_score"] >= threshold
         else ("NoFace" if r["faces_detected"] == 0 else "Unknown") for r in rows},
        key=str.casefold,
    )
    labels = sorted(set(actual_labels) | set(predicted_labels), key=str.casefold)
    index = {label: i for i, label in enumerate(labels)}
    matrix = np.zeros((len(labels), len(labels)), dtype=int)
    for row in rows:
        actual = row["true_identity"]
        if row["faces_detected"] == 0:
            predicted = "NoFace"
        elif row["best_score"] >= threshold:
            predicted = row["best_identity"]
        else:
            predicted = "Unknown"
        matrix[index[actual], index[predicted]] += 1

    fig_w = max(7, len(labels) * 1.1)
    fig_h = max(5, len(labels) * 0.85)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    image = ax.imshow(matrix, interpolation="nearest")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    ax.set(
        xticks=np.arange(len(labels)), yticks=np.arange(len(labels)),
        xticklabels=labels, yticklabels=labels,
        xlabel="Predicted identity", ylabel="Verified identity",
        title=f"Confusion Matrix (threshold={threshold:.2f})",
    )
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ax.text(j, i, str(matrix[i, j]), ha="center", va="center")
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def save_plots(summary: Sequence[dict], threshold_rows: Sequence[dict], out_dir: Path, matrix_rows: Sequence[dict], matrix_threshold: float) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    sizes = [str(row["det_size"]) for row in summary]
    times = [row["mean_inference_ms"] for row in summary]
    acc = [row["overall_accuracy"] * 100 for row in summary]
    known_acc = [row["known_identity_accuracy"] * 100 if math.isfinite(row["known_identity_accuracy"]) else float("nan") for row in summary]

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(times, acc, marker="o", label="Overall accuracy")
    ax.plot(times, known_acc, marker="s", label="Known identity accuracy")
    for x, y, label in zip(times, acc, sizes):
        ax.annotate(f"{label}px", (x, y), xytext=(5, 6), textcoords="offset points")
    ax.set_xlabel("Mean inference time (ms/image)")
    ax.set_ylabel("Accuracy (%)")
    ax.set_title("Inference time vs face-recognition accuracy")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_dir / "speed_vs_recognition_accuracy.png", dpi=180)
    plt.close(fig)

    if threshold_rows:
        thresholds = [r["threshold"] for r in threshold_rows]
        far = [r["far"] * 100 if math.isfinite(r["far"]) else float("nan") for r in threshold_rows]
        frr = [r["frr"] * 100 if math.isfinite(r["frr"]) else float("nan") for r in threshold_rows]
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.plot(thresholds, far, marker="o", label="FAR: unknown accepted")
        ax.plot(thresholds, frr, marker="s", label="FRR: known rejected")
        ax.set_xlabel("Cosine similarity threshold")
        ax.set_ylabel("Rate (%)")
        ax.set_title("FAR and FRR by recognition threshold")
        ax.grid(True, alpha=0.3)
        ax.legend()
        fig.tight_layout()
        fig.savefig(out_dir / "far_frr_vs_threshold.png", dpi=180)
        plt.close(fig)

    save_confusion_matrix(matrix_rows, matrix_threshold, out_dir / "confusion_matrix.png")


def run_evaluation(args: argparse.Namespace) -> None:
    snapshot_root: Path = args.project_root / args.snapshot_dir
    db_path: Path = args.project_root / args.db_path
    labels_csv: Path = args.project_root / args.labels_csv
    out_dir: Path = args.project_root / args.output_dir

    image_paths = list_images(snapshot_root)
    if not image_paths:
        raise FileNotFoundError(f"Tidak ada gambar di folder snapshot: {snapshot_root}")
    if args.max_images:
        image_paths = image_paths[:args.max_images]

    labels = load_verified_labels(labels_csv, snapshot_root, image_paths)
    gallery, original_counts, vector_count = load_gallery(db_path)

    print(f"Snapshot yang diuji : {len(image_paths)}")
    print(f"Identitas asli di DB: {len(original_counts)}")
    print(f"Identitas setelah penggabungan alias: {len(gallery)}")
    print(f"Jumlah embedding    : {vector_count}")
    print("Alias: Sdq -> Muhammad Sidiq; Grace -> Gracsia Andhika")
    print("Memuat InsightFace buffalo_l dengan CPUExecutionProvider...")

    app = FaceAnalysis(
        name=args.model,
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )

    all_predictions: List[dict] = []
    summaries: List[dict] = []
    threshold_rows_for_640: List[dict] = []
    matrix_rows_for_640: List[dict] = []

    for det_size in args.det_sizes:
        print(f"\nEvaluasi input {det_size}x{det_size}...")
        app.prepare(ctx_id=0, det_size=(det_size, det_size), det_thresh=args.det_threshold)

        # Warm-up so model initialization/runtime startup does not distort latency.
        warmup_image = cv2.imread(str(image_paths[0]))
        if warmup_image is None:
            raise ValueError(f"Gambar tidak dapat dibaca: {image_paths[0]}")
        for _ in range(max(0, args.warmup)):
            app.get(warmup_image)

        rows: List[dict] = []
        for index, image_path in enumerate(image_paths, start=1):
            image = cv2.imread(str(image_path))
            if image is None:
                raise ValueError(f"Gambar tidak dapat dibaca: {image_path}")

            start = time.perf_counter()
            faces = app.get(image)
            face_count = len(faces)
            if face_count:
                # The user confirmed one face per snapshot. If the detector returns
                # multiple boxes, select the largest and record the count for review.
                face = max(
                    faces,
                    key=lambda item: max(0.0, float(item.bbox[2] - item.bbox[0]))
                    * max(0.0, float(item.bbox[3] - item.bbox[1])),
                )
                embedding = getattr(face, "normed_embedding", None)
                if embedding is None:
                    embedding = face.embedding
                best_identity, best_score = match_embedding(embedding, gallery)
                det_score = float(getattr(face, "det_score", float("nan")))
                bbox = [round(float(v), 2) for v in face.bbox.tolist()]
            else:
                best_identity, best_score = "Unknown", 0.0
                det_score = float("nan")
                bbox = []
            elapsed_ms = (time.perf_counter() - start) * 1000.0

            row = {
                "filename": image_path.name,
                "det_size": det_size,
                "true_identity": labels[image_path.name],
                "faces_detected": face_count,
                "selected_face_det_score": det_score,
                "best_identity": best_identity,
                "best_cosine_similarity": best_score,
                "inference_ms": elapsed_ms,
                "selected_bbox_xyxy": json.dumps(bbox),
            }
            # Internal field used for metric calculation; omitted from exported CSV.
            row["best_score"] = best_score
            rows.append(row)

            if index % 20 == 0 or index == len(image_paths):
                print(f"  Diproses {index}/{len(image_paths)} gambar")

        metrics = get_metrics(rows, args.rec_threshold)
        summary = {"det_size": det_size, **metrics}
        summaries.append(summary)
        print(
            f"  Accuracy={metrics['overall_accuracy'] * 100:.2f}% | "
            f"Known accuracy={metrics['known_identity_accuracy'] * 100:.2f}% | "
            f"Mean inference={metrics['mean_inference_ms']:.2f} ms"
        )

        for row in rows:
            exported = {k: v for k, v in row.items() if k != "best_score"}
            exported["predicted_identity_at_threshold"] = (
                "NoFace" if row["faces_detected"] == 0 else
                row["best_identity"] if row["best_score"] >= args.rec_threshold else "Unknown"
            )
            all_predictions.append(exported)

        if det_size == 640 or (640 not in args.det_sizes and det_size == args.det_sizes[0]):
            matrix_rows_for_640 = rows
            threshold_values = np.round(np.arange(args.threshold_min, args.threshold_max + 0.0001, args.threshold_step), 3)
            threshold_rows_for_640 = threshold_metrics(rows, threshold_values)

    out_dir.mkdir(parents=True, exist_ok=True)
    write_csv(out_dir / "predictions_by_image_and_size.csv", all_predictions)
    write_csv(out_dir / "summary_by_input_size.csv", summaries)
    write_csv(out_dir / "far_frr_threshold_sweep.csv", threshold_rows_for_640)

    matrix_threshold = args.rec_threshold
    save_plots(summaries, threshold_rows_for_640, out_dir, matrix_rows_for_640, matrix_threshold)

    print("\nEvaluasi selesai.")
    print(f"Hasil tersimpan di: {out_dir}")
    print("File utama:")
    print("  - summary_by_input_size.csv")
    print("  - predictions_by_image_and_size.csv")
    print("  - far_frr_threshold_sweep.csv")
    print("  - speed_vs_recognition_accuracy.png")
    print("  - far_frr_vs_threshold.png")
    print("  - confusion_matrix.png")
    print("\nCatatan metodologi:")
    print("- Recognition diuji pada snapshot yang identitas sebenarnya sudah diverifikasi manual.")
    print("- Redetection rate hanya mengukur apakah wajah masih terdeteksi saat snapshot diproses ulang.")
    print("- Snapshot dibuat setelah deteksi berhasil, jadi redetection rate bukan recall deteksi CCTV yang independen.")
    print("- AP50/mAP tidak dihitung karena tidak tersedia bounding box ground truth independen dan frame tanpa deteksi.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Evaluasi InsightFace CCTV memakai face_db.json dan data/snapshots."
    )
    parser.add_argument("--project-root", type=Path, default=Path.cwd(), help="Folder utama proyek CCTV (default: direktori aktif).")
    parser.add_argument("--snapshot-dir", type=Path, default=Path("data/snapshots"), help="Folder snapshot relatif terhadap project root.")
    parser.add_argument("--db-path", type=Path, default=Path("data/face_db.json"), help="Database embedding JSON relatif terhadap project root.")
    parser.add_argument("--labels-csv", type=Path, default=Path("evaluation_data/snapshot_labels.csv"), help="CSV identitas sebenarnya yang sudah diverifikasi.")
    parser.add_argument("--output-dir", type=Path, default=Path("evaluation_results"), help="Folder hasil evaluasi.")
    parser.add_argument("--model", default="buffalo_l", help="Nama model InsightFace (default: buffalo_l).")
    parser.add_argument("--det-sizes", type=parse_sizes, default=parse_sizes("320,480,640,800"), help="Ukuran input detector, contoh 320,480,640,800.")
    parser.add_argument("--det-threshold", type=float, default=0.5, help="Detection threshold; default mengikuti proyek: 0.5.")
    parser.add_argument("--rec-threshold", type=float, default=0.4, help="Recognition threshold; default mengikuti proyek: 0.4.")
    parser.add_argument("--warmup", type=int, default=2, help="Jumlah inferensi pemanasan per ukuran input.")
    parser.add_argument("--max-images", type=int, default=0, help="Batasi jumlah gambar untuk uji awal; 0 berarti semua gambar.")
    parser.add_argument("--threshold-min", type=float, default=0.20, help="Batas bawah threshold sweep.")
    parser.add_argument("--threshold-max", type=float, default=0.80, help="Batas atas threshold sweep.")
    parser.add_argument("--threshold-step", type=float, default=0.02, help="Interval threshold sweep.")
    parser.add_argument("--prepare-labels", action="store_true", help="Buat template CSV dari nama file snapshot lalu berhenti.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    args.project_root = args.project_root.resolve()
    snapshot_root = args.project_root / args.snapshot_dir
    labels_csv = args.project_root / args.labels_csv

    try:
        if args.prepare_labels:
            count = make_label_template(snapshot_root, labels_csv)
            print(f"Template label dibuat: {labels_csv}")
            print(f"Jumlah snapshot: {count}")
            print("Isi kolom true_identity setelah memeriksa setiap foto.")
            print("Set verified=yes hanya setelah identitas benar-benar dikonfirmasi.")
            print("Jangan menganggap suggested_canonical_label sebagai ground truth.")
            return 0

        if not labels_csv.exists():
            count = make_label_template(snapshot_root, labels_csv)
            print(f"CSV label belum ada. Template otomatis dibuat: {labels_csv}")
            print(f"Jumlah snapshot: {count}")
            print("Isi true_identity dan verified=yes, lalu jalankan script kembali.")
            return 0

        if args.max_images < 0:
            parser.error("--max-images tidak boleh negatif.")
        if args.threshold_step <= 0:
            parser.error("--threshold-step harus lebih besar dari nol.")
        if not (0.0 <= args.det_threshold <= 1.0):
            parser.error("--det-threshold harus berada pada rentang 0 sampai 1.")
        if not (0.0 <= args.rec_threshold <= 1.0):
            parser.error("--rec-threshold harus berada pada rentang 0 sampai 1.")
        if args.threshold_max < args.threshold_min:
            parser.error("--threshold-max harus >= --threshold-min.")

        run_evaluation(args)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
