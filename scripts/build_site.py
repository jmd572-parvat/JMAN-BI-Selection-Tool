#!/usr/bin/env python3
"""
Assemble the static site into site/ (no bundler, no dependencies; every file is served as written).

    python scripts/build_site.py                 # preview: draft questions included, with a toggle
    python scripts/build_site.py --production    # draft questions excluded, no toggle, no preview notes
    python scripts/build_site.py --production --with-font   # as above, keeping the M PLUS 1 font link (for hosting the page on its own, e.g. GitHub Pages)

Inputs: src/engine/*.js, src/page/*, data/questions.json (rebuilt with --exclude-draft for production), data/deck/*.json.
The marketplace shell is assumed to provide the hero, tabs and feedback (docs/page-design.md A1); src/page/index.html is only a stand-in.
"""
import argparse
import datetime
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

OUT_DEFAULT = Path("site")
FILES = [("src/engine/engine.js", "engine.js"), ("src/engine/session.js", "session.js"), ("src/page/lib.js", "lib.js"),
         ("src/page/playbook.js", "playbook.js"), ("src/page/styles.css", "styles.css")]
DECK = ["profiles", "matrix", "migration", "reference"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--production", action="store_true")
    ap.add_argument("--with-font", action="store_true", help="keep the Google Fonts link for M PLUS 1 in a production build")
    ap.add_argument("--out", default=str(OUT_DEFAULT))
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    (out / "data" / "deck").mkdir(parents=True)
    for src, dst in FILES:
        shutil.copy(src, out / dst)
    logos = {}
    for f in sorted(p for p in Path("src/page/assets/logos").iterdir() if p.suffix in (".png", ".jpg", ".jpeg", ".svg")):
        (out / "assets" / "logos").mkdir(parents=True, exist_ok=True)
        shutil.copy(f, out / "assets" / "logos" / f.name)
        logos[f.stem] = f"assets/logos/{f.name}"
    for name in DECK:
        p = Path("data/deck") / f"{name}.json"
        if not p.exists():
            sys.exit(f"{p} is missing: run scripts/extract_deck_content.py first")
        shutil.copy(p, out / "data" / "deck" / p.name)
    if a.production:
        r = subprocess.run([sys.executable, "scripts/excel_to_json.py", "--exclude-draft", "--out", str(out / "data" / "questions.json")],
                           capture_output=True, text=True)
        if r.returncode:
            sys.exit(r.stderr)
    else:
        shutil.copy("data/questions.json", out / "data" / "questions.json")
    cfg = {"preview": not a.production, "showDrafts": not a.production, "draftToggle": not a.production, "storageKey": "bi-playbook-v1", "logos": logos}
    html = Path("src/page/index.html").read_text(encoding="utf-8")
    # a version in every file URL, so a browser never keeps showing an older build of the scripts, styles or data
    h = hashlib.sha256()
    for f in sorted(out.rglob("*")):
        if f.is_file():
            h.update(f.read_bytes())
    html = html.replace("{{VERSION}}", h.hexdigest()[:10])
    html = html.replace("{{CONFIG}}", json.dumps(cfg)).replace("{{BUILD_DATE}}", datetime.date.today().isoformat())
    if a.production:   # the preview strip is for reviewers, not for the published page
        import re
        html = re.sub(r'<div class="pv-preview".*?</div>\n', "", html, flags=re.S)
        if not a.with_font:   # the marketplace supplies the font; --with-font keeps the link for a page hosted on its own
            html = re.sub(r'<!-- Preview only: the marketplace already loads M PLUS 1.*?-->\n(?:<link[^>]*fonts\.g[^>]*>\n)+', "", html, flags=re.S)
        else:
            html = re.sub(r'<!-- Preview only: the marketplace already loads M PLUS 1.*?-->\n', "", html, flags=re.S)
    (out / "index.html").write_text(html, encoding="utf-8")
    q = json.loads((out / "data" / "questions.json").read_text(encoding="utf-8"))
    total = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"built {out}/ ({'production' if a.production else 'preview'}): {len(q['questions'])} questions, "
          f"{len(list(out.rglob('*.*')))} files, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
