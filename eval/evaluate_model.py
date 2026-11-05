#!/usr/bin/env python3
"""
Evaluate the InsightFace buffalo_l face detection + recognition pipeline.

Dataset layout:
evaluation_data/
  gallery/
    Alice/*.jpg
    Bob/*.jpg
  queries/
    Alice/*.jpg
    Bob/*.jpg
    unknown/*.jpg
  annotations.csv

annotations.csv columns:
filename,x1,y1,x2,y2,identity

`filename` is relative to queries/ (for example: Alice/query_01.jpg).
Add one CSV row for every ground-truth face. Images with no faces need no row.
Use identity `unknown` for people who are not enrolled in the gallery.
"""

from __future__ import annotations

import argparse
import csv
import math
import time
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import matplotlib.pyplot as plt
import numpy as np
from insightface.app import FaceAnalysis


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
UNKNOWN_LABELS = {"unknown", "unknown_face", "unregistered", "tidak dikenal", "tidak_dikenal"}


def parse_sizes(value: str) -> List[int]:
    sizes = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not sizes or any(size <= 0 for size in sizes):
        raise argparse.ArgumentTypeError("det-sizes harus berisi angka positif, contoh: 320,480,640,800")
    return sizes


def list_images(folder: Path) -> List[Path]:
    return sorted(
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )


def relative_name(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def load_annotations(csv_path: Path, query_root: Path) -> Dict[str, List[dict]]:
    annotations: Dict[str, List[dict]] = {}
    if not csv_path.exists():
        raise FileNotFoundError(f"File anotasi tidak ditemukan: {csv_path}")

    with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"filename", "x1", "y1", "x2", "y2", "identity"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise ValueError(
                "Header annotations.csv harus: filename,x1,y1,x2,y2,identity"
            )

        for row_number, row in enumerate(reader, start=2):
            filename = row["filename"].strip().replace("\\", "/")
            if not filename:
                raise ValueError(f"filename kosong pada baris {row_number}")
            image_path = query_root / filename
            if not image_path.exists():
                raise FileNotFoundError(
                    f"Gambar pada anotasi baris {row_number} tidak ditemukan: {image_path}"
                )
            try:
                box = [float(row[key]) for key in ("x1", "y1", "x2", "y2")]
            except (TypeError, ValueError):
                raise ValueError(f"Koordinat bounding box tidak valid pada baris {row_number}")
            if box[2] <= box[0] or box[3] <= box[1]:
                raise ValueError(f"Bounding box tidak valid pada baris {row_number}: {box}")
            identity = row["identity"].strip()
            if not identity:
                raise ValueError(f"identity kosong pada baris {row_number}")
            annotations.setdefault(filename, []).append(
                {"bbox": box, "identity": identity}
            )
    return annotations


def box_iou(box_a, box_b) -> float:
    ax1, ay1, ax2, ay2 = [float(v) for v in box_a]
    bx1, by1, bx2, by2 = [float(v) for v in box_b]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    intersection = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def average_precision(
    predictions: List[dict],
    ground_truth: Dict[str, List[dict]],
    iou_threshold: float,
) -> float:
    total_gt = sum(len(items) for items in ground_truth.values())
    if total_gt == 0:
        return float("nan")
    if not predictions:
        return 0.0

    ordered = sorted(predictions, key=lambda item: item["score"], reverse=True)
    matched = {filename: set() for filename in ground_truth}
    true_positive = []
    false_positive = []

    for prediction in ordered:
        filename = prediction["filename"]
        gt_items = ground_truth.get(filename, [])
        best_iou = 0.0
        best_index = -1
        for index, gt in enumerate(gt_items):
            if index in matched.setdefault(filename, set()):
                continue
            overlap = box_iou(prediction["bbox"], gt["bbox"])
            if overlap > best_iou:
                best_iou, best_index = overlap, index

        if best_index >= 0 and best_iou >= iou_threshold:
            matched[filename].add(best_index)
            true_positive.append(1)
            false_positive.append(0)
        else:
            true_positive.append(0)
            false_positive.append(1)

    tp = np.cumsum(true_positive)
    fp = np.cumsum(false_positive)
    recall = tp / total_gt
    precision = tp / np.maximum(tp + fp, 1e-12)

    # VOC-style all-points interpolated AP.
    recall = np.concatenate(([0.0], recall, [1.0]))
    precision = np.concatenate(([0.0], precision, [0.0]))
    for index in range(len(precision) - 2, -1, -1):
        precision[index] = max(precision[index], precision[index + 1])
    change_points = np.where(recall[1:] != recall[:-1])[0]
    return float(np.sum(
        (recall[change_points + 1] - recall[change_points])
        * precision[change_points + 1]
    ))


def detection_operating_metrics(
    predictions: List[dict],
    ground_truth: Dict[str, List[dict]],
    iou_threshold: float,
) -> Tuple[dict, Dict[str, List[Tuple[dict, dict]]]]:
    matched_pairs: Dict[str, List[Tuple[dict, dict]]] = {}
    total_gt = sum(len(items) for items in ground_truth.values())
    tp = fp = 0

    by_image: Dict[str, List[dict]] = {}
    for prediction in predictions:
        by_image.setdefault(prediction["filename"], []).append(prediction)

    for filename, image_predictions in by_image.items():
        image_predictions.sort(key=lambda item: item["score"], reverse=True)
        gt_items = ground_truth.get(filename, [])
        used_gt = set()
        for prediction in image_predictions:
            best_iou = 0.0
            best_index = -1
            for index, gt in enumerate(gt_items):
                if index in used_gt:
                    continue
                overlap = box_iou(prediction["bbox"], gt["bbox"])
                if overlap > best_iou:
                    best_iou, best_index = overlap, index

            if best_index >= 0 and best_iou >= iou_threshold:
                used_gt.add(best_index)
                tp += 1
                matched_pairs.setdefault(filename, []).append(
                    (prediction, gt_items[best_index])
                )
            else:
                fp += 1

    fn = max(0, total_gt - tp)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "detection_precision_at_iou": precision,
        "detection_recall_at_iou": recall,
        "detection_f1_at_iou": f1,
        "detection_tp": tp,
        "detection_fp": fp,
        "detection_fn": fn,
    }, matched_pairs


def build_gallery(app: FaceAnalysis, gallery_root: Path) -> Dict[str, List[np.ndarray]]:
    if not gallery_root.exists():
        raise FileNotFoundError(f"Folder gallery tidak ditemukan: {gallery_root}")

    gallery: Dict[str, List[np.ndarray]] = {}
    identity_dirs = sorted(path for path in gallery_root.iterdir() if path.is_dir())

    for identity_dir in identity_dirs:
        identity = identity_dir.name
        for image_path in list_images(identity_dir):
            image = cv2.imread(str(image_path))
            if image is None:
                print(f"[PERINGATAN] Gagal membaca gambar gallery: {image_path}")
                continue
            faces = app.get(image)
            if not faces:
                print(f"[PERINGATAN] Tidak ada wajah pada gallery: {image_path}")
                continue
            # One identity image should ideally contain one person.
            # If there are multiple faces, use the largest detected face.
            face = max(
                faces,
                key=lambda item: max(0.0, item.bbox[2] - item.bbox[0])
                * max(0.0, item.bbox[3] - item.bbox[1]),
            )
            embedding = np.asarray(face.normed_embedding, dtype=np.float32)
            gallery.setdefault(identity, []).append(embedding)

    if not gallery:
        raise ValueError(
            "Embedding gallery kosong. Pastikan setiap folder identitas berisi foto wajah yang jelas."
        )
    return gallery


def identify_face(embedding: np.ndarray, gallery: Dict[str, List[np.ndarray]], threshold: float):
    best_identity = "Unknown"
    best_score = -1.0
    for identity, vectors in gallery.items():
        for vector in vectors:
            score = float(np.dot(embedding, vector))
            if score > best_score:
                best_identity, best_score = identity, score
    best_score = max(0.0, best_score)
    if best_score >= threshold:
        return best_identity, best_score
    return "Unknown", best_score


def recognition_metrics(
    matched_pairs: Dict[str, List[Tuple[dict, dict]]],
    gallery: Dict[str, List[np.ndarray]],
    threshold: float,
) -> dict:
    known_total = known_correct = known_error = 0
    unknown_total = unknown_false_accept = unknown_correct = 0
    total_correct = total_matched = 0

    for pairs in matched_pairs.values():
        for prediction, gt in pairs:
            true_identity = gt["identity"]
            predicted_identity, _ = identify_face(
                prediction["embedding"], gallery, threshold
            )
            is_unknown = true_identity.strip().casefold() in UNKNOWN_LABELS
            total_matched += 1

            if is_unknown:
                unknown_total += 1
                if predicted_identity == "Unknown":
                    unknown_correct += 1
                    total_correct += 1
                else:
                    unknown_false_accept += 1
            else:
                known_total += 1
                if predicted_identity.casefold() == true_identity.casefold():
                    known_correct += 1
                    total_correct += 1
                else:
                    known_error += 1

    return {
        "recognition_accuracy_on_matched_faces": (
            total_correct / total_matched if total_matched else float("nan")
        ),
        "known_identity_accuracy": (
            known_correct / known_total if known_total else float("nan")
        ),
        "false_accept_rate_unknown": (
            unknown_false_accept / unknown_total if unknown_total else float("nan")
        ),
        "false_reject_rate_known": (
            known_error / known_total if known_total else float("nan")
        ),
        "known_faces_evaluated": known_total,
        "unknown_faces_evaluated": unknown_total,
        "recognition_faces_matched": total_matched,
    }


def evaluate_size(
    model_name: str,
    size: int,
    query_images: List[Path],
    query_root: Path,
    gallery_root: Path,
    annotations: Dict[str, List[dict]],
    det_threshold: float,
    rec_threshold: float,
    iou_threshold: float,
    warmup: int,
) -> dict:
    print(f"\n[INFO] Memuat {model_name} pada det_size={size}x{size} ...")
    app = FaceAnalysis(
        name=model_name,
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    # Keep low-confidence detections for AP calculation. The operating threshold
    # is applied separately below, so AP is not truncated at 0.5.
    app.prepare(ctx_id=0, det_size=(size, size), det_thresh=0.001)

    gallery = build_gallery(app, gallery_root)
    print(f"[INFO] Gallery: {sum(len(v) for v in gallery.values())} embeddings, "
          f"{len(gallery)} identities")

    # Warm-up is excluded from timing.
    for image_path in query_images[:max(0, warmup)]:
        image = cv2.imread(str(image_path))
        if image is not None:
            app.get(image)

    raw_predictions: List[dict] = []
    latencies_ms = []

    for index, image_path in enumerate(query_images, start=1):
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"[PERINGATAN] Gagal membaca query: {image_path}")
            continue

        start = time.perf_counter()
        faces = app.get(image)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        latencies_ms.append(elapsed_ms)

        filename = relative_name(image_path, query_root)
        for face in faces:
            embedding = getattr(face, "normed_embedding", None)
            if embedding is None:
                continue
            raw_predictions.append({
                "filename": filename,
                "bbox": [float(v) for v in face.bbox.tolist()],
                "score": float(getattr(face, "det_score", 1.0)),
                "embedding": np.asarray(embedding, dtype=np.float32),
            })

        if index % 25 == 0 or index == len(query_images):
            print(f"[INFO] Diproses {index}/{len(query_images)} gambar")

    if not latencies_ms:
        raise RuntimeError("Tidak ada gambar query yang berhasil dibaca.")

    # Ensure every query image is represented, including images with no faces.
    ground_truth = {
        relative_name(path, query_root): annotations.get(relative_name(path, query_root), [])
        for path in query_images
    }

    ap_values = [
        average_precision(raw_predictions, ground_truth, threshold)
        for threshold in np.arange(0.50, 0.951, 0.05)
    ]
    ap50 = ap_values[0]
    map_50_95 = float(np.nanmean(ap_values))

    operating_predictions = [
        item for item in raw_predictions if item["score"] >= det_threshold
    ]
    detection_stats, matched_pairs = detection_operating_metrics(
        operating_predictions, ground_truth, iou_threshold
    )
    recognition_stats = recognition_metrics(
        matched_pairs, gallery, rec_threshold
    )

    mean_ms = float(np.mean(latencies_ms))
    result = {
        "model": model_name,
        "det_size": size,
        "mean_inference_ms": mean_ms,
        "median_inference_ms": float(np.median(latencies_ms)),
        "p95_inference_ms": float(np.percentile(latencies_ms, 95)),
        "fps": 1000.0 / mean_ms if mean_ms > 0 else float("nan"),
        "AP50": ap50,
        "mAP50_95": map_50_95,
        "raw_detections": len(raw_predictions),
        "detections_at_operating_threshold": len(operating_predictions),
        **detection_stats,
        **recognition_stats,
    }
    print(
        f"[HASIL] {size}x{size} | AP50={ap50:.4f} | "
        f"mAP50-95={map_50_95:.4f} | latency={mean_ms:.2f} ms | "
        f"FPS={result['fps']:.2f}"
    )
    return result


def save_outputs(results: List[dict], output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "evaluation_results.csv"
    fieldnames = list(results[0].keys())

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    # Plot equivalent to the reference figure: latency versus detection AP50.
    ordered = sorted(results, key=lambda item: item["det_size"])
    x = [item["mean_inference_ms"] for item in ordered]
    y = [item["AP50"] * 100.0 for item in ordered]
    labels = [f'{item["det_size"]}x{item["det_size"]}' for item in ordered]

    plt.figure(figsize=(10, 6))
    plt.plot(x, y, marker="o", linewidth=2)
    for x_value, y_value, label in zip(x, y, labels):
        plt.annotate(
            label,
            (x_value, y_value),
            textcoords="offset points",
            xytext=(7, 7),
            fontsize=9,
        )
    plt.xlabel("Mean inference time per image (ms)")
    plt.ylabel("Face detection AP50 (%)")
    plt.title("InsightFace buffalo_l: inference speed vs detection AP50")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plot_path = output_dir / "speed_vs_ap50.png"
    plt.savefig(plot_path, dpi=180)
    plt.close()

    # A second plot shows the recognition metrics at the configured threshold.
    rec_labels = [f'{item["det_size"]}x{item["det_size"]}' for item in ordered]
    acc = [item["known_identity_accuracy"] * 100 for item in ordered]
    far = [item["false_accept_rate_unknown"] * 100 for item in ordered]
    frr = [item["false_reject_rate_known"] * 100 for item in ordered]

    plt.figure(figsize=(10, 6))
    plt.plot(rec_labels, acc, marker="o", label="Known identity accuracy")
    plt.plot(rec_labels, far, marker="s", label="False accept rate (unknown)")
    plt.plot(rec_labels, frr, marker="^", label="False reject rate (known)")
    plt.xlabel("Detection input size")
    plt.ylabel("Rate (%)")
    plt.title("Face recognition evaluation at configured threshold")
    plt.ylim(0, 100)
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    recognition_plot_path = output_dir / "recognition_metrics.png"
    plt.savefig(recognition_plot_path, dpi=180)
    plt.close()

    print("\n=== FILE HASIL ===")
    print(f"CSV evaluasi       : {csv_path}")
    print(f"Grafik speed vs AP : {plot_path}")
    print(f"Grafik recognition : {recognition_plot_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Evaluasi deteksi dan pengenalan wajah InsightFace buffalo_l."
    )
    parser.add_argument("--data-dir", type=Path, default=Path("evaluation_data"))
    parser.add_argument("--model", type=str, default="buffalo_l")
    parser.add_argument("--det-sizes", type=parse_sizes, default=parse_sizes("320,480,640,800"))
    parser.add_argument("--det-threshold", type=float, default=0.5)
    parser.add_argument("--rec-threshold", type=float, default=0.4)
    parser.add_argument("--iou-threshold", type=float, default=0.5)
    parser.add_argument("--warmup", type=int, default=3)
    parser.add_argument("--output-dir", type=Path, default=Path("evaluation_results"))
    args = parser.parse_args()

    query_root = args.data_dir / "queries"
    gallery_root = args.data_dir / "gallery"
    annotation_path = args.data_dir / "annotations.csv"

    if not query_root.exists():
        raise FileNotFoundError(f"Folder query tidak ditemukan: {query_root}")
    query_images = list_images(query_root)
    if not query_images:
        raise ValueError(f"Tidak ada gambar di folder query: {query_root}")

    annotations = load_annotations(annotation_path, query_root)
    total_gt = sum(len(items) for items in annotations.values())
    if total_gt == 0:
        raise ValueError("annotations.csv belum memiliki ground-truth wajah.")

    print(f"[INFO] Model             : {args.model}")
    print(f"[INFO] Jumlah query      : {len(query_images)}")
    print(f"[INFO] Jumlah ground truth: {total_gt}")
    print(f"[INFO] Det threshold     : {args.det_threshold}")
    print(f"[INFO] Rec threshold     : {args.rec_threshold}")
    print(f"[INFO] IoU threshold     : {args.iou_threshold}")

    results = []
    for size in args.det_sizes:
        results.append(
            evaluate_size(
                model_name=args.model,
                size=size,
                query_images=query_images,
                query_root=query_root,
                gallery_root=gallery_root,
                annotations=annotations,
                det_threshold=args.det_threshold,
                rec_threshold=args.rec_threshold,
                iou_threshold=args.iou_threshold,
                warmup=args.warmup,
            )
        )

    save_outputs(results, args.output_dir)


if __name__ == "__main__":
    main()
