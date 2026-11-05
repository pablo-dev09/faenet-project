from docx import Document

path = r"C:\Users\Pablo\faenet-project\FaeNet_Documentacao_Sem_IDs.docx"
doc = Document(path)
print("sections", len(doc.sections))
for i, sec in enumerate(doc.sections):
    print(
        i,
        "orient", sec.orientation,
        "page", round(sec.page_width.inches, 2), "x", round(sec.page_height.inches, 2),
        "margins", tuple(round(v.inches, 2) for v in (sec.left_margin, sec.right_margin, sec.top_margin, sec.bottom_margin)),
        "header/footer", round(sec.header_distance.inches, 2), round(sec.footer_distance.inches, 2),
    )
