#!/usr/bin/env python3
"""
Prepare the tool logos for the page (no imaging library needed).

Source: the logo files the owner added to the dumps folder: looker.png, powerbi.png, qlik.png, tableau.png, Symbol.png (the ThoughtSpot
mark) and SigmaComputing.jpeg. PNGs are trimmed to their visible pixels (white counts as background), padded, centred on a square and
scaled to 192 px. The Sigma file is a JPEG with a solid black square, which cannot be trimmed without an imaging library, so it is
copied as it is and the page rounds its corners.

    python scripts/prepare_logos.py <folder with the original logo files>
"""
import struct
import sys
import zlib
from pathlib import Path

OUT = Path("src/page/assets/logos")
SIZE = 192
SOURCES = {"looker": "looker.png", "powerbi": "powerbi.png", "qlik": "qlik.png", "tableau": "tableau.png", "thoughtspot": "Symbol.png"}
COPIED = {"sigma": "SigmaComputing.jpeg"}


def decode(data):
    """PNG bytes -> (w, h, rows) with rows as bytearrays of RGBA. Handles 8-bit RGBA and 1-8 bit palette images, no interlace."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, plte, trns = 8, b"", None, None
    while pos < len(data):
        n, t = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        pos += 12 + n
        if t == b"IHDR":
            w, h, bd, ct, _, _, il = struct.unpack(">IIBBBBB", body)
        elif t == b"PLTE":
            plte = body
        elif t == b"tRNS":
            trns = body
        elif t == b"IDAT":
            idat += body
    assert il == 0 and ((ct == 6 and bd == 8) or (ct == 3 and bd in (1, 2, 4, 8))), (w, h, bd, ct, il)
    raw = zlib.decompress(idat)
    bits = bd * (4 if ct == 6 else 1)
    stride = (w * bits + 7) // 8
    bpp = max(1, bits // 8)
    rows, prev = [], bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        cur = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        if f == 1:
            for i in range(bpp, stride):
                cur[i] = (cur[i] + cur[i - bpp]) & 255
        elif f == 2:
            for i in range(stride):
                cur[i] = (cur[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                cur[i] = (cur[i] + (((cur[i - bpp] if i >= bpp else 0) + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = cur[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                cur[i] = (cur[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = cur
        if ct == 6:
            rows.append(cur)
        else:
            out = bytearray(w * 4)
            mask = (1 << bd) - 1
            per = 8 // bd
            for x in range(w):
                idx = (cur[x // per] >> (8 - bd * (x % per + 1))) & mask
                r, g, b = plte[idx * 3:idx * 3 + 3]
                a = trns[idx] if trns and idx < len(trns) else 255
                out[x * 4:x * 4 + 4] = bytes((r, g, b, a))
            rows.append(out)
    return w, h, rows


def encode(w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def process(png):
    w, h, rows = decode(png)
    # white counts as background
    x0, y0, x1, y1 = w, h, -1, -1
    for y, r in enumerate(rows):
        for x in range(w):
            i = x * 4
            if r[i + 3] and not (r[i] > 245 and r[i + 1] > 245 and r[i + 2] > 245):
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
            else:
                r[i + 3] = 0
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    side = int(max(cw, ch) * 1.12)
    ox, oy = x0 - (side - cw) // 2, y0 - (side - ch) // 2
    out = []
    for oyi in range(SIZE):
        sy0, sy1 = oy + oyi * side // SIZE, max(oy + (oyi + 1) * side // SIZE, oy + oyi * side // SIZE + 1)
        row = bytearray(SIZE * 4)
        for oxi in range(SIZE):
            sx0, sx1 = ox + oxi * side // SIZE, max(ox + (oxi + 1) * side // SIZE, ox + oxi * side // SIZE + 1)
            ra = ga = ba = aa = n = 0
            for sy in range(max(sy0, 0), min(sy1, h)):
                r = rows[sy]
                for sx in range(max(sx0, 0), min(sx1, w)):
                    i = sx * 4
                    a = r[i + 3]
                    ra += r[i] * a; ga += r[i + 1] * a; ba += r[i + 2] * a; aa += a; n += 1
            # pixels outside the source count as transparent
            tot = max((min(sy1, h) - max(sy0, 0)) * (min(sx1, w) - max(sx0, 0)), 0)
            full = max((sy1 - sy0) * (sx1 - sx0), 1)
            if aa:
                j = oxi * 4
                row[j:j + 4] = bytes((ra // aa, ga // aa, ba // aa, min(255, aa // full)))
        out.append(row)
    return encode(SIZE, SIZE, out)


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python scripts/prepare_logos.py <folder with the original logo files> (they are not kept in the repository)")
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for tool, name in SOURCES.items():
        data = process((src / name).read_bytes())
        (OUT / f"{tool}.png").write_bytes(data)
        print(f"{tool}: {OUT / (tool + '.png')} ({len(data) // 1024} KB)")
    for tool, name in COPIED.items():
        data = (src / name).read_bytes()
        (OUT / f"{tool}{Path(name).suffix.lower()}").write_bytes(data)
        print(f"{tool}: copied {name} ({len(data) // 1024} KB)")


if __name__ == "__main__":
    main()
