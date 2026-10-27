"""Generate the shared Mandarin audio used by the static HSK site.

Install: pip install kokoro-onnx==0.6.1 'misaki-fork[zh]==0.9.6'
Download the Kokoro v1.1-zh ONNX model, voices and config into --model-dir.
Run: python scripts/generate_audio.py --model-dir /path/to/model --voice zf_002 --speed 0.9 --output-dir audio-c
"""

import argparse
import json
import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import subprocess
import tempfile


os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("ORT_DISABLE_TELEMETRY", "1")

ROOT = Path(__file__).resolve().parents[1]
G2P = None
MODEL = None
VOICE = None
SPEED = None


def words_from_js():
    js = "const fs=require('fs'),vm=require('vm');const context={window:{}};" \
         "vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),context);" \
         "process.stdout.write(JSON.stringify(context.window.INITIAL_WORDS));"
    result = subprocess.check_output(["node", "-e", js, str(ROOT / "words-data.js")])
    return json.loads(result)


def init_worker(model_dir, voice, speed):
    global G2P, MODEL, VOICE, SPEED
    from misaki import zh
    from kokoro_onnx import Kokoro
    from pypinyin import load_phrases_dict, load_single_dict

    model_dir = Path(model_dir)
    VOICE, SPEED = voice, speed
    G2P = zh.ZHG2P(version="1.1")
    # Match the HSK sheet for polyphones and a few common regional tone variants.
    load_single_dict({ord("长"): "chang2,zhang3", ord("谁"): "shei2,shui2"})
    load_phrases_dict({
        "早上": [["zao3"], ["shang5"]],
        "左边": [["zuo3"], ["bian1"]],
        "右边": [["you4"], ["bian1"]],
        "还是": [["hai2"], ["shi5"]],
    })
    MODEL = Kokoro(
        str(model_dir / "kokoro-v1.1-zh.onnx"),
        str(model_dir / "voices-v1.1-zh.bin"),
        vocab_config=str(model_dir / "config.json"),
    )


def generate(job):
    name, text, output_dir = job
    target = Path(output_dir) / name
    if target.exists() and target.stat().st_size > 0:
        return name, "cached"
    phonemes, _ = G2P(text)
    if not phonemes:
        raise ValueError(f"No Chinese phonemes for {name}: {text}")
    samples, rate = MODEL.create(phonemes, voice=VOICE, speed=SPEED, is_phonemes=True)
    if len(samples) < rate // 10:
        raise ValueError(f"Audio too short for {name}: {text}")
    handle, temp_name = tempfile.mkstemp(prefix=name + ".", suffix=".mp3", dir=output_dir)
    os.close(handle)
    try:
        subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
             "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
             "-codec:a", "libmp3lame", "-b:a", "64k", temp_name],
            input=samples.astype("<f4").tobytes(), check=True,
        )
        if Path(temp_name).stat().st_size < 1000:
            raise ValueError(f"Encoded audio too small for {name}: {text}")
        os.replace(temp_name, target)
        os.chmod(target, 0o644)
    finally:
        if Path(temp_name).exists():
            Path(temp_name).unlink()
    return name, "generated"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--voice", default="zf_001")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--output-dir", type=Path, default=Path("audio"))
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0, help="Only generate first N jobs for a trial")
    parser.add_argument("--indices", help="Comma-separated word positions to regenerate")
    args = parser.parse_args()
    for model_file in ("kokoro-v1.1-zh.onnx", "voices-v1.1-zh.bin", "config.json"):
        if not (args.model_dir / model_file).exists():
            parser.error(f"Missing {model_file} in {args.model_dir}")
    if not 0.5 <= args.speed <= 1.5:
        parser.error("--speed must be between 0.5 and 1.5")
    output_dir = args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir
    output_dir.mkdir(exist_ok=True)
    jobs = []
    selected = {int(x) for x in args.indices.split(",")} if args.indices else None
    for number, word in enumerate(words_from_js(), start=1):
        if selected is not None and number not in selected:
            continue
        jobs.append((f"w-{number:03}.mp3", word["hanzi"], str(output_dir)))
        jobs.append((f"e-{number:03}.mp3", word["exZh"], str(output_dir)))
    if args.limit:
        jobs = jobs[:args.limit]
    with ProcessPoolExecutor(max_workers=args.workers, initializer=init_worker, initargs=(str(args.model_dir), args.voice, args.speed)) as pool:
        for done, (name, status) in enumerate(pool.map(generate, jobs), start=1):
            if done % 25 == 0 or done == len(jobs):
                print(f"{done}/{len(jobs)} ({name}: {status})", flush=True)


if __name__ == "__main__":
    main()
