from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(r"C:\Users\Pablo\faenet-project\tmp\docx-inspect")
BOXES = {
    "image3.png": [(70, 422, 700, 1050), (535, 865, 745, 1010), (1005, 1355, 710, 1030)],
    "image4.png": [(60, 420, 665, 1020), (540, 890, 685, 990), (1020, 1395, 630, 1040)],
    "image5.png": [(45, 430, 670, 1025), (470, 825, 715, 1015), (900, 1270, 680, 1000)],
    "image7.png": [(1005, 1390, 100, 460)],
    "image8.png": [(1005, 1390, 100, 460)],
    "image9.png": [(1005, 1390, 100, 460)],
    "image10.png": [(35, 440, 670, 1120), (520, 915, 700, 1080), (1000, 1420, 650, 1120)],
}

for fn, boxes in BOXES.items():
    arr = np.array(Image.open(ROOT / fn).convert("L"))
    print(f"\n{fn}")
    for box in boxes:
        x1, x2, y1, y2 = box
        crop = arr[y1:y2, x1:x2]
        counts = (crop < 80).sum(axis=1)
        peaks = [(y1 + i, int(v)) for i, v in enumerate(counts) if v > (x2-x1)*0.45]
        print(box, peaks)
