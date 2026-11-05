from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from PIL import Image, ImageDraw, ImageFont
import io

SRC = Path(r"C:\Users\Pablo\OneDrive - NET4TRESS\FaeNet_Documentacao_Revisada.docx")
OUT = Path(r"C:\Users\Pablo\faenet-project\tmp\docx-inspect")
OUT.mkdir(parents=True, exist_ok=True)

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

with ZipFile(SRC) as z:
    rels = etree.fromstring(z.read("word/_rels/document.xml.rels"))
    relmap = {el.get("Id"): el.get("Target") for el in rels}
    doc = etree.fromstring(z.read("word/document.xml"))
    lines = []
    image_order = []
    for idx, p in enumerate(doc.xpath("//w:body/w:p", namespaces=NS), start=1):
        text = "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()
        rids = p.xpath(".//a:blip/@r:embed", namespaces=NS)
        if text or rids:
            targets = [relmap.get(rid, rid) for rid in rids]
            lines.append(f"{idx:04d}\t{text}\t{' | '.join(targets)}")
            image_order.extend(targets)
    (OUT / "paragraphs.tsv").write_text("\n".join(lines), encoding="utf-8")

    media = []
    for name in sorted(n for n in z.namelist() if n.startswith("word/media/")):
        data = z.read(name)
        target = OUT / Path(name).name
        target.write_bytes(data)
        try:
            im = Image.open(io.BytesIO(data)).convert("RGB")
            media.append((Path(name).name, im.copy()))
        except Exception:
            pass

thumb_w, thumb_h = 360, 260
margin, label_h = 20, 34
cols = 2
rows = (len(media) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (thumb_w + margin) + margin, rows * (thumb_h + label_h + margin) + margin), "white")
draw = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(media):
    im.thumbnail((thumb_w, thumb_h))
    x = margin + (i % cols) * (thumb_w + margin)
    y = margin + (i // cols) * (thumb_h + label_h + margin)
    sheet.paste(im, (x + (thumb_w - im.width)//2, y + (thumb_h - im.height)//2))
    draw.text((x, y + thumb_h + 6), f"{name}  {im.width}x{im.height}", fill="black")
sheet.save(OUT / "contact-sheet.png")
print(f"Extracted {len(media)} images")
print("Image order:")
for item in image_order:
    print(item)
