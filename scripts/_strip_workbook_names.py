"""
One-off: take the names, e-mail addresses and account ids out of a workbook, without touching anything else in it.

The workbook holds people in several hidden places: the document properties (created by / last modified by), the people list behind the
threaded comments, the comments themselves (authors and @mentions inside the text), the review tasks, and the folder the file was saved
from. This rewrites exactly those parts inside the .xlsx package and copies every other part across unchanged, so the Flow drawing, the
threaded comments and the data are kept (the workbook is never rewritten by a library that would drop them).

People become "Reviewer A" to "Reviewer D" (the same person always gets the same letter); the document properties say "JMAN".
Excel puts the editor's name back into "last modified by" each time a person saves the file in Excel.

Usage: python scripts/_strip_workbook_names.py data/bi-tools-questions.xlsx
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

PEOPLE = [  # full name, e-mail local part, label
    ("Vishal Kumar Singh", "vishal.s", "Reviewer A"),
    ("Konduru Tharun", "kondurutharun", "Reviewer B"),
    ("Deepthi Nadiminti", "nadiminti", "Reviewer C"),
    ("Suganya S", "suganyaselvaraj", "Reviewer D"),
]
OWNER = "Parvat R"


def scrub(text):
    """Names, e-mail addresses and account ids in running text."""
    for name, _mail, label in PEOPLE:
        text = text.replace(name, label)
    text = re.sub(r"S::[\w.+-]+@[\w.-]+::[0-9a-f-]{36}", "reviewer", text)
    text = re.sub(r"[\w.+-]+@jmangroup\.com", "reviewer", text)
    text = text.replace(OWNER, "JMAN")
    return text


def fix_mentions(xml):
    """A mention records where its @name sits in the comment text: recompute after the names were shortened."""
    def one(m):
        block = m.group(0)
        text = re.search(r"<text[^>]*>(.*?)</text>", block, re.S).group(1)
        at = [x.start() for x in re.finditer(r"@Reviewer [A-D]", text)]
        it = iter(at)
        def mention(mm):
            pos = next(it)
            return re.sub(r'startIndex="\d+" length="\d+"', f'startIndex="{pos}" length="{len("@Reviewer X")}"', mm.group(0))
        return re.sub(r"<mention [^>]*/>", mention, block)
    return re.sub(r"<threadedComment .*?</threadedComment>", one, xml, flags=re.S)


def rewrite(name, data):
    x = data.decode("utf-8")
    if name == "docProps/core.xml":
        x = re.sub(r"<dc:creator>[^<]*</dc:creator>", "<dc:creator>JMAN</dc:creator>", x)
        x = re.sub(r"<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>", "<cp:lastModifiedBy>JMAN</cp:lastModifiedBy>", x)
    elif name == "xl/persons/person.xml":
        label_of = {n: l for n, _m, l in PEOPLE}
        def person(m):
            who = re.search(r'displayName="([^"]*)"', m.group(0)).group(1)
            lab = label_of.get(who, "Reviewer")
            s = re.sub(r'displayName="[^"]*"', f'displayName="{lab}"', m.group(0))
            s = re.sub(r'userId="[^"]*"', f'userId="{lab.replace(" ", "").lower()}"', s)
            return re.sub(r'providerId="[^"]*"', 'providerId="None"', s)
        x = re.sub(r"<person [^>]*/>", person, x)
    elif name == "xl/workbook.xml":
        x = re.sub(r'(<x15ac:absPath url=")[^"]*(")', r"\1\2", x)
    elif name.startswith(("xl/comments", "xl/threadedComments/", "xl/documenttasks/")):
        x = scrub(x)
        if name.startswith("xl/threadedComments/"):
            x = fix_mentions(x)
    return x.encode("utf-8")


def main(path):
    src = Path(path)
    tmp = src.with_suffix(".stripped.xlsx")
    changed = []
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w") as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            new = rewrite(info.filename, data) if info.filename.endswith(".xml") else data
            if new != data:
                changed.append(info.filename)
            zout.writestr(info, new, compress_type=info.compress_type)
    shutil.move(tmp, src)
    print("rewritten parts:", ", ".join(changed))


if __name__ == "__main__":
    main(sys.argv[1])
