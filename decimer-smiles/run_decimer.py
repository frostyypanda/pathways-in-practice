#!/usr/bin/env python3
"""
DECIMER-SMILES Pipeline
Convert chemical structure images to SMILES notation.
"""

import argparse
import os
import site
import sys
import time
from pathlib import Path


def setup_gpu_environment():
    """Configure library paths for GPU support (pip-installed CUDA)."""
    sp = site.getsitepackages()[0]
    nvidia_dir = f"{sp}/nvidia"

    if os.path.exists(nvidia_dir):
        lib_paths = [
            f"{nvidia_dir}/cudnn/lib",
            f"{nvidia_dir}/cublas/lib",
            f"{nvidia_dir}/cuda_runtime/lib",
            f"{nvidia_dir}/cuda_nvrtc/lib",
            f"{nvidia_dir}/cufft/lib",
            f"{nvidia_dir}/cusolver/lib",
            f"{nvidia_dir}/cusparse/lib",
            f"{nvidia_dir}/nccl/lib",
            f"{nvidia_dir}/nvjitlink/lib",
        ]
        existing_paths = [p for p in lib_paths if os.path.exists(p)]
        if existing_paths:
            os.environ["LD_LIBRARY_PATH"] = ":".join(existing_paths) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
            os.environ["XLA_FLAGS"] = f"--xla_gpu_cuda_data_dir={nvidia_dir}/cuda_nvcc"
            return True
    return False


def predict_single(image_path: str, hand_drawn: bool = False) -> str:
    """Predict SMILES for a single image."""
    from DECIMER import predict_SMILES
    return predict_SMILES(image_path, hand_drawn=hand_drawn)


def predict_batch(image_paths: list, hand_drawn: bool = False, verbose: bool = True) -> list:
    """Predict SMILES for multiple images."""
    from DECIMER import predict_SMILES
    from tqdm import tqdm

    results = []
    iterator = tqdm(image_paths, desc="Processing") if verbose else image_paths

    for path in iterator:
        try:
            smiles = predict_SMILES(str(path), hand_drawn=hand_drawn)
            results.append({"file": str(path), "smiles": smiles, "error": None})
        except Exception as e:
            results.append({"file": str(path), "smiles": None, "error": str(e)})

    return results


def get_device_info():
    """Get information about available compute devices."""
    import tensorflow as tf

    gpus = tf.config.list_physical_devices("GPU")
    cpus = tf.config.list_physical_devices("CPU")

    info = {
        "gpu_available": len(gpus) > 0,
        "gpu_count": len(gpus),
        "gpu_names": [g.name for g in gpus],
        "cpu_count": len(cpus),
    }
    return info


def main():
    parser = argparse.ArgumentParser(
        description="Convert chemical structure images to SMILES using DECIMER"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Input image file or directory"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file (CSV or JSON). If not specified, prints to stdout"
    )
    parser.add_argument(
        "--hand-drawn",
        action="store_true",
        help="Use hand-drawn structure model"
    )
    parser.add_argument(
        "--no-gpu",
        action="store_true",
        help="Disable GPU, use CPU only"
    )
    parser.add_argument(
        "--info",
        action="store_true",
        help="Show device information and exit"
    )

    args = parser.parse_args()

    # Setup GPU if available
    if not args.no_gpu:
        gpu_setup = setup_gpu_environment()
    else:
        os.environ["CUDA_VISIBLE_DEVICES"] = ""

    # Show device info
    if args.info:
        info = get_device_info()
        print(f"GPU Available: {info['gpu_available']}")
        print(f"GPU Count: {info['gpu_count']}")
        if info['gpu_names']:
            print(f"GPU Devices: {', '.join(info['gpu_names'])}")
        return

    input_path = Path(args.input)

    # Single file
    if input_path.is_file():
        start = time.time()
        smiles = predict_single(str(input_path), hand_drawn=args.hand_drawn)
        elapsed = time.time() - start

        if args.output:
            with open(args.output, "w") as f:
                f.write(f"{input_path.name},{smiles}\n")
            print(f"Saved to {args.output}")
        else:
            print(f"File: {input_path.name}")
            print(f"SMILES: {smiles}")
            print(f"Time: {elapsed:.2f}s")

    # Directory
    elif input_path.is_dir():
        extensions = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"}
        image_files = [f for f in input_path.iterdir() if f.suffix.lower() in extensions]

        if not image_files:
            print(f"No image files found in {input_path}")
            return

        print(f"Found {len(image_files)} images")

        start = time.time()
        results = predict_batch(image_files, hand_drawn=args.hand_drawn)
        elapsed = time.time() - start

        # Output results
        if args.output:
            output_path = Path(args.output)
            if output_path.suffix == ".json":
                import json
                with open(output_path, "w") as f:
                    json.dump(results, f, indent=2)
            else:  # CSV
                with open(output_path, "w") as f:
                    f.write("file,smiles,error\n")
                    for r in results:
                        error = r["error"] or ""
                        smiles = r["smiles"] or ""
                        f.write(f"{r['file']},{smiles},{error}\n")
            print(f"Saved to {args.output}")
        else:
            for r in results:
                if r["smiles"]:
                    print(f"{Path(r['file']).name}: {r['smiles']}")
                else:
                    print(f"{Path(r['file']).name}: ERROR - {r['error']}")

        successful = sum(1 for r in results if r["smiles"])
        print(f"\nProcessed {successful}/{len(results)} images in {elapsed:.2f}s")
        print(f"Average: {elapsed/len(results):.2f}s per image")

    else:
        print(f"Error: {input_path} not found")
        sys.exit(1)


if __name__ == "__main__":
    main()
