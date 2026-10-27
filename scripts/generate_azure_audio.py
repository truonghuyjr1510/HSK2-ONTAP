"""Generate HSK audio with the official Azure AI Speech REST API.

Install: pip install pypinyin
Set HSK_SPEECH_KEY and HSK_SPEECH_REGION in the shell running this script.
Dry run first: python scripts/generate_azure_audio.py --dry-run --indices 46,47
"""

import argparse
import json
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape, quoteattr

from pypinyin import Style, pinyin

from generate_audio import ROOT, words_from_js


TONE_MARKS = {"\u0304": 1, "\u0301": 2, "\u030c": 3, "\u0300": 4}
OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3"


def letters_and_tones(text):
    letters = []
    for char in unicodedata.normalize("NFD", text.lower()):
        if "a" <= char <= "z":
            letters.append([char, 0])
        elif char == "\u0308" and letters and letters[-1][0] == "u":
            letters[-1][0] = "v"  # Azure's zh-CN SAPI spelling for ü.
        elif char in TONE_MARKS:
            if not letters or letters[-1][1]:
                raise ValueError(f"Invalid pinyin tone placement: {text}")
            letters[-1][1] = TONE_MARKS[char]
    return letters


def sapi_pronunciation(hanzi, sheet_pinyin):
    """Align the sheet's tones to each Hanzi syllable; never guess a new reading."""
    target = letters_and_tones(sheet_pinyin)
    spelling = "".join(letter for letter, _ in target)
    options = pinyin(hanzi, style=Style.NORMAL, heteronym=True, strict=False)

    def match(char_index, offset):
        if char_index == len(options):
            return [] if offset == len(spelling) else None
        for candidate in options[char_index]:
            plain = "".join(letter for letter, _ in letters_and_tones(candidate))
            if not spelling.startswith(plain, offset):
                continue
            rest = match(char_index + 1, offset + len(plain))
            if rest is not None:
                return [(offset, offset + len(plain))] + rest
        return None

    spans = match(0, 0)
    if spans is None:
        return None  # Erhua words such as diǎnr need a listening review.
    syllables = []
    for start, end in spans:
        tones = {tone for _, tone in target[start:end] if tone}
        if len(tones) > 1:
            raise ValueError(f"Multiple tones in one syllable: {hanzi} {sheet_pinyin}")
        syllables.append(f"{spelling[start:end]} {next(iter(tones), 5)}")
    return " ".join(syllables)


def make_ssml(text, voice, rate, pronunciation=None):
    spoken = escape(text)
    if pronunciation:
        spoken = f'<phoneme alphabet="sapi" ph={quoteattr(pronunciation)}>{spoken}</phoneme>'
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xml:lang="zh-CN">'
        f'<voice name={quoteattr(voice)}>'
        f'<prosody rate="{rate:+d}%">{spoken}</prosody>'
        '</voice></speak>'
    ).encode("utf-8")


def request_audio(ssml, key, region):
    endpoint = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    request = Request(
        endpoint,
        data=ssml,
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": "HSK2ReviewAudioGenerator",
        },
        method="POST",
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=45) as response:
                audio = response.read()
                if not response.headers.get("Content-Type", "").startswith("audio/"):
                    raise RuntimeError("Azure returned a non-audio response")
                if len(audio) < 1000:
                    raise RuntimeError("Azure returned an unexpectedly short audio file")
                return audio
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f"Azure Speech request failed: HTTP {error.code}") from error
        except URLError as error:
            if attempt == 3:
                raise RuntimeError("Azure Speech could not be reached") from error
        time.sleep(2 ** attempt)
    raise RuntimeError("Azure Speech did not return audio")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voice", default="zh-CN-XiaoxiaoNeural")
    parser.add_argument("--rate", type=int, default=-10, help="SSML speaking-rate percent")
    parser.add_argument("--output-dir", type=Path, default=Path("audio-azure-c"))
    parser.add_argument("--indices", help="Comma-separated, one-based word positions")
    parser.add_argument("--words-only", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Validate pinyin without using Azure")
    args = parser.parse_args()
    if not re.fullmatch(r"zh-CN-[A-Za-z0-9]+Neural", args.voice):
        parser.error("--voice must be a zh-CN Azure neural voice name")
    if not -50 <= args.rate <= 50:
        parser.error("--rate must be between -50 and 50")
    words = words_from_js()
    try:
        selected = {int(value) for value in args.indices.split(",")} if args.indices else set(range(1, len(words) + 1))
    except ValueError:
        parser.error("--indices must be comma-separated integers")
    if not selected or min(selected) < 1 or max(selected) > len(words):
        parser.error(f"--indices must be between 1 and {len(words)}")

    jobs, unforced = [], []
    for number in sorted(selected):
        word = words[number - 1]
        pronunciation = sapi_pronunciation(word["hanzi"], word["pinyin"])
        if pronunciation is None:
            unforced.append(f"{number}: {word['hanzi']} ({word['pinyin']})")
        jobs.append((f"w-{number:03}.mp3", word["hanzi"], pronunciation))
        if not args.words_only:
            jobs.append((f"e-{number:03}.mp3", word["exZh"], None))
    print(json.dumps({"files": len(jobs), "voice": args.voice, "rate": args.rate,
                      "words_with_sheet_pronunciation": len(selected) - len(unforced),
                      "word_pronunciations_needing_review": unforced}, ensure_ascii=False))
    if args.dry_run:
        return

    key = os.getenv("HSK_SPEECH_KEY") or os.getenv("AZURE_SPEECH_KEY")
    region = os.getenv("HSK_SPEECH_REGION") or os.getenv("AZURE_SPEECH_REGION")
    if not key or not region:
        parser.error("Set HSK_SPEECH_KEY and HSK_SPEECH_REGION before generating audio")
    if not re.fullmatch(r"[a-z0-9-]+", region):
        parser.error("HSK_SPEECH_REGION has an invalid format")
    output_dir = args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    for number, (filename, text, pronunciation) in enumerate(jobs, start=1):
        target = output_dir / filename
        if target.exists() and target.stat().st_size > 1000 and not args.overwrite:
            continue
        ssml = make_ssml(text, args.voice, args.rate, pronunciation)
        audio = request_audio(ssml, key, region)
        temporary = target.with_suffix(".tmp")
        temporary.write_bytes(audio)
        temporary.replace(target)
        print(f"{number}/{len(jobs)} {filename}", flush=True)


if __name__ == "__main__":
    main()
