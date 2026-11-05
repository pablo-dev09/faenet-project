from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from io import BytesIO
from PIL import Image

SRC = Path(r"C:\Users\Pablo\OneDrive - NET4TRESS\FaeNet_Documentacao_Revisada.docx")
OUT = Path(r"C:\Users\Pablo\faenet-project\FaeNet_Documentacao_Sem_IDs.docx")
PREVIEW = Path(r"C:\Users\Pablo\faenet-project\tmp\docx-edited-images")
PREVIEW.mkdir(parents=True, exist_ok=True)

# Each tuple is (left border, right border, bottom of header row, separator below attributes).
# The first attribute row in every listed box is the standalone id/PK id field.
EDITS = {
    "word/media/image3.png": [
        (72, 421, 737, 848),       # Publicação
        (540, 861, 784, 855),      # Comentário
        (1013, 1347, 750, 862),    # Story
    ],
    "word/media/image4.png": [
        (66, 414, 704, 835),       # Mensagem
        (546, 881, 724, 835),      # Notificação
        (1026, 1387, 670, 842),    # Item do Hub
    ],
    "word/media/image5.png": [
        (53, 422, 710, 862),       # posts
        (480, 814, 757, 868),      # comments
        (912, 1260, 724, 835),     # stories
    ],
    "word/media/image7.png": [(1013, 1382, 144, 295)],  # posts
    "word/media/image8.png": [(1013, 1382, 144, 295)],  # posts
    "word/media/image9.png": [(1013, 1382, 144, 295)],  # posts
    "word/media/image10.png": [
        (46, 427, 710, 922),       # messages
        (533, 901, 744, 895),      # notifications
        (1013, 1408, 690, 902),    # hub_items
    ],
}


def remove_first_attribute_row(image: Image.Image, box: tuple[int, int, int, int]) -> None:
    left, right, header_bottom, attributes_bottom = box
    row_height = 20
    inner_left = left + 4
    inner_right = right - 4
    # Text begins roughly 10 px below the header rule. Start the source at the
    # following row so no antialiased pixels from the removed id line survive.
    dest_top = header_bottom + 10
    source_top = dest_top + row_height
    source_bottom = attributes_bottom

    moved = image.crop((inner_left, source_top, inner_right, source_bottom))
    image.paste(moved, (inner_left, dest_top))

    # Match the box's native fill color when clearing the vacated final row.
    sample_x = max(inner_left + 2, inner_right - 10)
    sample_y = max(dest_top, attributes_bottom - row_height - 3)
    fill = image.getpixel((sample_x, sample_y))
    image.paste(fill, (inner_left, attributes_bottom - row_height, inner_right, attributes_bottom))


with ZipFile(SRC, "r") as zin, ZipFile(OUT, "w") as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename in EDITS:
            image = Image.open(BytesIO(data)).convert("RGB")
            for box in EDITS[info.filename]:
                remove_first_attribute_row(image, box)
            image.save(PREVIEW / Path(info.filename).name, format="PNG", optimize=True)
            buffer = BytesIO()
            image.save(buffer, format="PNG", optimize=True)
            data = buffer.getvalue()
        zout.writestr(info, data, compress_type=ZIP_DEFLATED)

print(OUT)
print(f"Edited {len(EDITS)} embedded diagram images")
