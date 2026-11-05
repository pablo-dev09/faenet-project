from pathlib import Path
from zipfile import ZipFile
from lxml import etree

DOCX = Path(r"C:\Users\Pablo\faenet-project\FaeNet_Documentacao_Sem_IDs.docx")
NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

with ZipFile(DOCX) as zf:
    root = etree.fromstring(zf.read("word/document.xml"))
    rels = etree.fromstring(zf.read("word/_rels/document.xml.rels"))

relmap = {
    rel.get("Id"): rel.get("Target")
    for rel in rels
    if rel.get("Type", "").endswith("/image")
}

body = root.find("w:body", NS)
for idx, child in enumerate(body):
    kind = etree.QName(child).localname
    if kind == "p":
        text = "".join(child.xpath(".//w:t/text()", namespaces=NS)).strip()
        embeds = child.xpath(".//a:blip/@r:embed", namespaces=NS)
        images = [relmap.get(e, e) for e in embeds]
        has_sect = bool(child.xpath("./w:pPr/w:sectPr", namespaces=NS))
        breaks = child.xpath(".//w:br/@w:type", namespaces=NS)
        if text or images or has_sect or breaks:
            print(f"{idx:04d} p sect={has_sect} breaks={breaks} images={images} text={text[:150]!r}")
    elif kind == "tbl":
        texts = child.xpath(".//w:t/text()", namespaces=NS)
        print(f"{idx:04d} tbl text={' | '.join(texts)[:180]!r}")
    elif kind == "sectPr":
        pg = child.find("w:pgSz", NS)
        print(f"{idx:04d} body-sectPr orient={pg.get('{%s}orient' % NS['w']) if pg is not None else None}")
