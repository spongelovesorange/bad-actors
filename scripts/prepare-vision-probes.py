"""Prepare the two offline image probes and one short speech request. No network I/O."""

import base64
import json
from pathlib import Path
import struct
import zlib


DESTINATION = Path(__file__).resolve().parent.parent / ".local"
WIDTH, HEIGHT = 240, 144
PROMPT = "Describe the visible objects and their relative positions. Use one short sentence."


def png_chunk(kind, data):
    checksum = zlib.crc32(kind + data)
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def draw_fixture(circle_x, square_x):
    # Two shapes have the same dimensions/colors in both images. Only their order changes.
    raster = bytearray()
    for y in range(HEIGHT):
        raster.append(0)  # No PNG scanline filter.
        for x in range(WIDTH):
            color = (252, 250, 245)
            if (x - circle_x) ** 2 + (y - HEIGHT // 2) ** 2 <= 31 ** 2:
                color = (214, 27, 45)
            elif abs(x - square_x) <= 27 and abs(y - HEIGHT // 2) <= 27:
                color = (26, 66, 222)
            raster.extend(color)
    header = struct.pack(">2I5B", WIDTH, HEIGHT, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header)
            + png_chunk(b"IDAT", zlib.compress(raster)) + png_chunk(b"IEND", b""))


def save_request(filename, body):
    (DESTINATION / filename).write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")


def main():
    DESTINATION.mkdir(mode=0o700, exist_ok=True)
    for label, circle_x, square_x in [("a", 62, 178), ("b", 178, 62)]:
        image = draw_fixture(circle_x, square_x)
        (DESTINATION / f"probe-{label}.png").write_bytes(image)
        image_source = {"type": "base64", "media_type": "image/png",
                        "data": base64.b64encode(image).decode("ascii")}
        content = [{"type": "image", "source": image_source}, {"type": "text", "text": PROMPT}]
        save_request(f"vision-probe-{label}.json", {
            "model": "claude-haiku-4-5", "max_tokens": 120, "temperature": 0,
            "messages": [{"role": "user", "content": content}],
        })
    save_request("voice-probe.json", {"text": "Drinking water.", "model_id": "eleven_flash_v2_5",
                                     "output_format": "mp3_44100_64"})
    print("Prepared two PNGs, two vision requests and one TTS request under .local/.")


if __name__ == "__main__":
    main()
