from pathlib import Path
from copy import deepcopy
from math import cos, sin, pi

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches
from docx.oxml.ns import qn


ROOT = Path(r"C:\Users\Pablo\faenet-project")
SOURCE = ROOT / "FaeNet_Documentacao_Sem_IDs.docx"
OUTPUT = ROOT / "FaeNet_Documentacao_Consolidada_brModelo.docx"
ASSETS = ROOT / "tmp" / "consolidated-assets"
ASSETS.mkdir(parents=True, exist_ok=True)

FONT_REG = r"C:\Windows\Fonts\arial.ttf"
FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"

NAVY = "#17324D"
BLUE = "#245A87"
BLUE_2 = "#DCECF7"
GREEN = "#2D7A55"
GREEN_2 = "#E2F3E9"
GOLD = "#A36A14"
GOLD_2 = "#FFF2CF"
PURPLE = "#67418A"
PURPLE_2 = "#EEE3F7"
INK = "#1F2933"
MUTED = "#5C6773"
LINE = "#405466"
LIGHT = "#F7F9FB"
WHITE = "#FFFFFF"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def rounded(draw, box, radius=24, fill=WHITE, outline=LINE, width=4):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center_text(draw, box, text, fnt, fill=INK, spacing=6):
    x1, y1, x2, y2 = box
    bbox = draw.multiline_textbbox((0, 0), text, font=fnt, spacing=spacing, align="center")
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.multiline_text(
        ((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2),
        text,
        font=fnt,
        fill=fill,
        spacing=spacing,
        align="center",
    )


def polyline(draw, points, fill=LINE, width=5):
    draw.line(points, fill=fill, width=width, joint="curve")


def endpoint_labels(draw, points, start_label, end_label, fnt=None, fill=INK):
    fnt = fnt or font(27, True)
    sx, sy = points[0]
    ex, ey = points[-1]
    draw.text((sx + 10, sy - 38), start_label, font=fnt, fill=fill)
    eb = draw.textbbox((0, 0), end_label, font=fnt)
    draw.text((ex - (eb[2] - eb[0]) - 10, ey - 38), end_label, font=fnt, fill=fill)


def stick_actor(draw, cx, cy, label, color=NAVY, note=None):
    head_r = 34
    draw.ellipse((cx-head_r, cy-135-head_r, cx+head_r, cy-135+head_r), outline=color, width=7, fill=WHITE)
    draw.line((cx, cy-100, cx, cy+30), fill=color, width=8)
    draw.line((cx-65, cy-50, cx+65, cy-50), fill=color, width=8)
    draw.line((cx, cy+30, cx-60, cy+115), fill=color, width=8)
    draw.line((cx, cy+30, cx+60, cy+115), fill=color, width=8)
    label_box = (cx-150, cy+120, cx+150, cy+185)
    center_text(draw, label_box, label, font(35, True), fill=color)
    if note:
        center_text(draw, (cx-180, cy+178, cx+180, cy+230), note, font(24), fill=MUTED)


def use_case(draw, cx, cy, text, fill=BLUE_2, outline=BLUE, width=520, height=150):
    box = (cx-width//2, cy-height//2, cx+width//2, cy+height//2)
    draw.ellipse(box, fill=fill, outline=outline, width=5)
    center_text(draw, box, text, font(31, True), fill=INK)
    return box


def build_use_case(path):
    W, H = 2200, 2700
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    d.rectangle((355, 115, 1845, 2570), fill="#FBFCFE", outline=NAVY, width=6)
    d.rectangle((355, 115, 1845, 215), fill=NAVY)
    center_text(d, (355, 115, 1845, 215), "FaeNet — visão consolidada", font(40, True), fill=WHITE)

    left_x, right_x = 790, 1410
    positions = {
        "create": (left_x, 360), "auth": (left_x, 610),
        "feed": (left_x, 930), "publish": (left_x, 1200),
        "interact": (left_x, 1470), "stories": (left_x, 1740),
        "messages": (left_x, 2010),
        "profile": (right_x, 840), "explore": (right_x, 1110),
        "notifications": (right_x, 1380), "hub": (right_x, 1650),
        "logout": (right_x, 1920), "manage_hub": (right_x, 2290),
    }

    # Linhas são desenhadas antes dos elementos para manter os rótulos limpos.
    visitor_anchor = (300, 485)
    for key in ("create", "auth"):
        x, y = positions[key]
        polyline(d, [visitor_anchor, (445, visitor_anchor[1]), (445, y), (x-260, y)], fill=GREEN, width=5)

    user_left_anchor = (300, 1450)
    for i, key in enumerate(("feed", "publish", "interact", "stories", "messages")):
        x, y = positions[key]
        channel = 430 + i * 24
        polyline(d, [user_left_anchor, (channel, user_left_anchor[1]), (channel, y), (x-260, y)], fill=BLUE, width=5)

    user_right_anchor = (1900, 1380)
    for i, key in enumerate(("profile", "explore", "notifications", "hub", "logout")):
        x, y = positions[key]
        channel = 1770 - i * 24
        polyline(d, [user_right_anchor, (channel, user_right_anchor[1]), (channel, y), (x+260, y)], fill=BLUE, width=5)

    admin_anchor = (1900, 2250)
    x, y = positions["manage_hub"]
    polyline(d, [admin_anchor, (1765, admin_anchor[1]), (1765, y), (x+260, y)], fill=GOLD, width=5)
    # Generalização Administrador -> Usuário.
    polyline(d, [(2010, 2100), (2010, 1650)], fill=GOLD, width=6)
    d.polygon([(2010, 1610), (1987, 1655), (2033, 1655)], fill=WHITE, outline=GOLD)

    use_case(d, *positions["create"], "Criar conta", GREEN_2, GREEN)
    use_case(d, *positions["auth"], "Autenticar-se", GREEN_2, GREEN)
    use_case(d, *positions["feed"], "Consultar feed")
    use_case(d, *positions["publish"], "Publicar conteúdo")
    use_case(d, *positions["interact"], "Interagir com\npublicação")
    use_case(d, *positions["stories"], "Gerenciar stories")
    use_case(d, *positions["messages"], "Enviar mensagens")
    use_case(d, *positions["profile"], "Gerenciar perfil", PURPLE_2, PURPLE)
    use_case(d, *positions["explore"], "Explorar usuários\ne conteúdos", PURPLE_2, PURPLE)
    use_case(d, *positions["notifications"], "Acompanhar\nnotificações", PURPLE_2, PURPLE)
    use_case(d, *positions["hub"], "Acessar Hub\ndo Curso", GOLD_2, GOLD)
    use_case(d, *positions["logout"], "Encerrar sessão", PURPLE_2, PURPLE)
    use_case(d, *positions["manage_hub"], "Gerenciar Hub\ndo Curso", GOLD_2, GOLD)

    stick_actor(d, 170, 485, "Visitante", GREEN)
    stick_actor(d, 170, 1450, "Usuário", BLUE)
    stick_actor(d, 2030, 1380, "Usuário", BLUE, "mesmo ator")
    stick_actor(d, 2030, 2250, "Administrador", GOLD)
    img.save(path, quality=95, dpi=(300, 300))


def class_card(draw, box, title, attributes, methods, accent=BLUE):
    x1, y1, x2, y2 = box
    rounded(draw, box, radius=20, fill=WHITE, outline=accent, width=5)
    header_h = 78
    draw.rounded_rectangle((x1, y1, x2, y1+header_h+14), radius=20, fill=accent)
    draw.rectangle((x1, y1+header_h-10, x2, y1+header_h+10), fill=accent)
    center_text(draw, (x1, y1, x2, y1+header_h), title, font(34, True), fill=WHITE)
    total_rows = len(attributes) + len(methods)
    row_h = max(26, (y2 - y1 - header_h - 34) / max(1, total_rows))
    row_font = font(22 if row_h < 34 else 24)
    y = y1 + header_h + 7
    for item in attributes:
        dtext = f"{item}"
        draw.text((x1+22, y+3), dtext, font=row_font, fill=INK)
        y += row_h
    sep_y = y + 1
    draw.line((x1, sep_y, x2, sep_y), fill=accent, width=3)
    y = sep_y + 5
    for item in methods:
        draw.text((x1+22, y+2), f"{item}()", font=row_font, fill=MUTED)
        y += row_h


def build_class(path):
    W, H = 3600, 2200
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    d.rectangle((28, 28, W-28, H-28), fill="#FBFCFE", outline=NAVY, width=5)
    center_text(d, (80, 45, W-80, 120), "Diagrama de classes consolidado — FaeNet", font(45, True), fill=NAVY)

    boxes = {
        "user": (1320, 145, 2280, 705),
        "post": (90, 900, 830, 1560),
        "comment": (900, 1010, 1600, 1555),
        "story": (1690, 920, 2380, 1470),
        "message": (2480, 760, 3430, 1395),
        "notification": (2550, 1550, 3390, 2070),
        "hub": (1240, 1640, 2260, 2100),
    }

    # Associações ortogonais, cada par ligado por uma única linha.
    relations = [
        ([(1450, 705), (1450, 800), (460, 800), (460, 900)], "1", "0..*", "cria", (470, 810)),
        ([(1660, 705), (1660, 875), (1250, 875), (1250, 1010)], "1", "0..*", "escreve", (1260, 885)),
        ([(1900, 705), (1900, 820), (2035, 820), (2035, 920)], "1", "0..*", "publica", (2045, 830)),
        ([(2280, 410), (2395, 410), (2395, 1060), (2480, 1060)], "1", "0..*", "remetente / destinatário", (2250, 1010)),
        ([(2140, 705), (2140, 750), (3460, 750), (3460, 1810), (3390, 1810)], "1", "0..*", "recebe", (3260, 710)),
        ([(2050, 705), (2050, 1510), (1930, 1510), (1930, 1640)], "1", "0..*", "publica", (1940, 1520)),
        ([(830, 1230), (900, 1230)], "1", "0..*", "contém", (810, 1185)),
    ]
    for pts, a, b, label, label_pos in relations:
        polyline(d, pts, fill=LINE, width=5)
        endpoint_labels(d, pts, a, b, font(26, True))
        d.text(label_pos, label, font=font(22, True), fill=MUTED)

    # Autorrelacionamento de seguidores.
    loop = [(2280, 265), (2390, 265), (2390, 600), (2280, 600)]
    polyline(d, loop, fill=PURPLE, width=5)
    d.text((2310, 315), "segue", font=font(25, True), fill=PURPLE)
    d.text((2290, 220), "0..*", font=font(25, True), fill=PURPLE)
    d.text((2290, 615), "0..*", font=font(25, True), fill=PURPLE)

    class_card(d, boxes["user"], "Usuário", [
        "username : String", "passwordHash : String", "nome : String", "curso : String", "turma : String",
        "bio : String", "avatar : String", "banner : String", "online : boolean", "ultimoAcesso : DateTime",
    ], ["autenticar", "editarPerfil", "seguir", "deixarDeSeguir"], NAVY)
    class_card(d, boxes["post"], "Publicação", [
        "conteudo : Text", "imagens : JSON", "enquete : JSON", "publicadoEm : DateTime",
    ], ["publicar", "editar", "excluir", "repostar"], BLUE)
    class_card(d, boxes["comment"], "Comentário", [
        "texto : Text", "criadoEm : DateTime",
    ], ["comentar", "excluir"], GREEN)
    class_card(d, boxes["story"], "Story", [
        "imagem : String", "legenda : String", "publicadoEm : DateTime", "expiraEm : DateTime",
    ], ["publicar", "visualizar", "excluir"], PURPLE)
    class_card(d, boxes["message"], "Mensagem", [
        "texto : Text", "arquivoUrl : String", "tipoArquivo : String", "lida : boolean", "enviadaEm : DateTime",
    ], ["enviar", "responder", "marcarComoLida"], BLUE)
    class_card(d, boxes["notification"], "Notificação", [
        "tipo : String", "texto : String", "lida : boolean", "criadaEm : DateTime",
    ], ["gerar", "marcarComoLida"], GOLD)
    class_card(d, boxes["hub"], "Item do Hub", [
        "curso : String", "tipo : String", "titulo : String", "conteudo : Text", "extra : JSON", "resolvido : boolean", "criadoEm : DateTime",
    ], ["publicar", "responder", "marcarResolvido", "excluir"], GREEN)
    img.save(path, quality=95, dpi=(300, 300))


def logical_table(draw, box, title, fields, accent=BLUE):
    x1, y1, x2, y2 = box
    rounded(draw, box, radius=14, fill=WHITE, outline=accent, width=4)
    hh = 64
    draw.rounded_rectangle((x1, y1, x2, y1+hh+12), radius=14, fill=accent)
    draw.rectangle((x1, y1+hh-10, x2, y1+hh+10), fill=accent)
    center_text(draw, (x1, y1, x2, y1+hh), title, font(31, True), fill=WHITE)
    row_h = (y2-y1-hh) / max(1, len(fields))
    y = y1 + hh
    for i, (key, name, dtype) in enumerate(fields):
        if i:
            draw.line((x1, int(y), x2, int(y)), fill="#D5DEE7", width=2)
        key_fill = GOLD if "PK" in key else (PURPLE if "FK" in key else MUTED)
        draw.text((x1+13, y+7), key, font=font(21, True), fill=key_fill)
        draw.text((x1+78, y+7), name, font=font(22, True), fill=INK)
        dtype_box = draw.textbbox((0, 0), dtype, font=font(20))
        draw.text((x2-14-(dtype_box[2]-dtype_box[0]), y+8), dtype, font=font(20), fill=MUTED)
        y += row_h


def build_logical(path):
    W, H = 4200, 2400
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    d.rectangle((25, 25, W-25, H-25), fill="#FAFCFE", outline=NAVY, width=5)
    d.rectangle((25, 25, W-25, 115), fill=NAVY)
    center_text(d, (25, 25, W-25, 115), "Projeto lógico consolidado — padrão brModelo", font(42, True), fill=WHITE)

    boxes = {
        "users": (1500, 155, 2670, 700),
        "posts": (90, 680, 900, 1260),
        "comments": (90, 1530, 900, 1930),
        "stories": (960, 760, 1680, 1195),
        "viewers": (960, 1440, 1680, 1740),
        "followers": (1740, 820, 2390, 1125),
        "likes": (1760, 1280, 2380, 1575),
        "saves": (1760, 1660, 2380, 1955),
        "reposts": (1760, 2040, 2380, 2335),
        "messages": (2770, 590, 4050, 1200),
        "notifications": (2860, 1320, 3970, 1735),
        "hub": (2730, 1830, 4090, 2335),
    }

    # Conectores em rotas dedicadas. A cardinalidade fica junto às extremidades.
    rels = [
        ([(1610, 700), (1610, 730), (500, 730), (500, 680)], "1", "0..*", BLUE),
        ([(1500, 520), (1250, 520), (1250, 760)], "1", "0..*", PURPLE),
        ([(1740, 700), (1740, 820)], "1", "0..*", GREEN),
        ([(1900, 700), (1900, 1280)], "1", "0..*", GOLD),
        ([(2070, 700), (2070, 1660)], "1", "0..*", GOLD),
        ([(2240, 700), (2240, 2040)], "1", "0..*", GOLD),
        ([(2670, 400), (2720, 400), (2720, 900), (2770, 900)], "1", "0..*", BLUE),
        ([(2520, 700), (2520, 1510), (2860, 1510)], "1", "0..*", PURPLE),
        ([(2610, 700), (2610, 2080), (2730, 2080)], "1", "0..*", GREEN),
        ([(500, 1260), (500, 1530)], "1", "0..*", BLUE),
        ([(900, 1010), (920, 1010), (920, 1700), (900, 1700)], "1", "0..*", BLUE),
        ([(1320, 1195), (1320, 1440)], "1", "0..*", PURPLE),
        ([(1680, 980), (1710, 980), (1710, 1490), (1680, 1490)], "1", "0..*", PURPLE),
        ([(900, 860), (930, 860), (930, 1425), (1760, 1425)], "1", "0..*", GOLD),
        ([(900, 940), (950, 940), (950, 1805), (1760, 1805)], "1", "0..*", GOLD),
        ([(900, 1030), (970, 1030), (970, 2185), (1760, 2185)], "1", "0..*", GOLD),
    ]
    for pts, a, b, color in rels:
        polyline(d, pts, fill=color, width=4)
        endpoint_labels(d, pts, a, b, font(22, True), fill=color)

    # Autorrelacionamento de respostas no Hub.
    polyline(d, [(4090, 1980), (4150, 1980), (4150, 2250), (4090, 2250)], fill=GREEN, width=4)
    d.text((3990, 1938), "0..1", font=font(21, True), fill=GREEN)
    d.text((3990, 2260), "0..*", font=font(21, True), fill=GREEN)
    d.text((4070, 2090), "respostas", font=font(20, True), fill=GREEN)

    logical_table(d, boxes["users"], "users", [
        ("PK", "username", "VARCHAR(60)"), ("", "password_hash", "VARCHAR(256)"), ("", "name", "VARCHAR(120)"),
        ("", "curso", "VARCHAR(80)"), ("", "turma", "VARCHAR(100)"), ("", "avatar_text", "VARCHAR(4)"),
        ("", "avatar_img", "TEXT"), ("", "banner_img", "TEXT"), ("", "bio", "VARCHAR(300)"),
        ("", "online", "BOOLEAN"), ("", "last_seen", "DATETIME"), ("", "joined", "DATETIME"),
    ], NAVY)
    logical_table(d, boxes["posts"], "posts", [
        ("PK/FK", "username", "VARCHAR(60)"), ("PK", "timestamp", "DATETIME"), ("", "content", "TEXT"),
        ("", "images", "JSON"), ("", "poll_data", "JSON"), ("FK", "repost_username", "VARCHAR(60)"),
        ("FK", "repost_timestamp", "DATETIME"),
    ], BLUE)
    logical_table(d, boxes["comments"], "comments", [
        ("PK/FK", "post_username", "VARCHAR(60)"), ("PK/FK", "post_timestamp", "DATETIME"),
        ("PK/FK", "username", "VARCHAR(60)"), ("PK", "timestamp", "DATETIME"), ("", "text", "TEXT"),
    ], BLUE)
    logical_table(d, boxes["stories"], "stories", [
        ("PK/FK", "username", "VARCHAR(60)"), ("PK", "timestamp", "DATETIME"), ("", "image", "TEXT"), ("", "caption", "VARCHAR(200)"),
    ], PURPLE)
    logical_table(d, boxes["viewers"], "story_viewers", [
        ("PK/FK", "story_username", "VARCHAR(60)"), ("PK/FK", "story_timestamp", "DATETIME"), ("PK/FK", "username", "VARCHAR(60)"),
    ], PURPLE)
    logical_table(d, boxes["followers"], "followers", [
        ("PK/FK", "follower", "VARCHAR(60)"), ("PK/FK", "followed", "VARCHAR(60)"),
    ], GREEN)
    for key, title in (("likes", "post_likes"), ("saves", "post_saves"), ("reposts", "post_reposts")):
        logical_table(d, boxes[key], title, [
            ("PK/FK", "username", "VARCHAR(60)"), ("PK/FK", "post_username", "VARCHAR(60)"), ("PK/FK", "post_timestamp", "DATETIME"),
        ], GOLD)
    logical_table(d, boxes["messages"], "messages", [
        ("PK/FK", "from_user", "VARCHAR(60)"), ("PK/FK", "to_user", "VARCHAR(60)"), ("PK", "timestamp", "DATETIME"), ("", "text", "TEXT"),
        ("", "file_url", "TEXT"), ("", "file_name", "VARCHAR(200)"), ("", "file_type", "VARCHAR(20)"),
        ("", "reply_to", "JSON"), ("", "read", "BOOLEAN"),
    ], BLUE)
    logical_table(d, boxes["notifications"], "notifications", [
        ("PK/FK", "to_user", "VARCHAR(60)"), ("PK", "timestamp", "DATETIME"), ("", "from_name", "VARCHAR(120)"),
        ("", "notif_type", "VARCHAR(30)"), ("", "text", "VARCHAR(200)"), ("", "read", "BOOLEAN"),
    ], PURPLE)
    logical_table(d, boxes["hub"], "hub_items", [
        ("PK/FK", "username", "VARCHAR(60)"), ("PK", "timestamp", "DATETIME"), ("", "curso", "VARCHAR(80)"),
        ("", "item_type", "VARCHAR(20)"), ("FK", "parent_username", "VARCHAR(60)"), ("FK", "parent_timestamp", "DATETIME"),
        ("", "title", "VARCHAR(200)"), ("", "content", "TEXT"), ("", "extra", "JSON"), ("", "solved", "BOOLEAN"),
    ], GREEN)

    # Legenda curta do padrão lógico.
    d.rounded_rectangle((90, 2070, 1540, 2325), radius=16, fill=WHITE, outline="#B7C5D3", width=3)
    d.text((125, 2100), "Legenda do modelo lógico", font=font(27, True), fill=NAVY)
    d.text((125, 2150), "PK  chave primária   •   FK  chave estrangeira", font=font(23), fill=INK)
    d.text((125, 2198), "1  ocorrência obrigatória   •   0..*  zero ou muitas", font=font(23), fill=INK)
    d.text((125, 2246), "Notação e organização visual compatíveis com o brModelo.", font=font(22), fill=MUTED)
    img.save(path, quality=95, dpi=(300, 300))


def has_page_break(p):
    return bool(p._p.xpath('.//w:br[@w:type="page"]'))


def clear_keep_properties(p):
    for child in list(p._p):
        if child.tag != qn("w:pPr"):
            p._p.remove(child)


def remove_paragraph(p):
    parent = p._p.getparent()
    if parent is not None:
        parent.remove(p._p)


def set_text(p, text):
    p.text = text


def find_para(doc, startswith):
    matches = [p for p in doc.paragraphs if p.text.strip().startswith(startswith)]
    if matches:
        # Títulos também aparecem no sumário; a última ocorrência é a seção real.
        return matches[-1]
    raise KeyError(startswith)


def remove_between_keep_sect(start_p, end_p):
    cur = start_p._p.getnext()
    end_text = end_p.text.strip()
    while cur is not None:
        cur_text = "".join(cur.xpath(".//w:t/text()")) if cur.tag == qn("w:p") else ""
        if cur_text.strip() == end_text:
            break
        nxt = cur.getnext()
        ppr = cur.find(qn("w:pPr")) if cur.tag == qn("w:p") else None
        if ppr is not None and ppr.find(qn("w:sectPr")) is not None:
            for child in list(cur):
                if child.tag != qn("w:pPr"):
                    cur.remove(child)
        else:
            cur.getparent().remove(cur)
        cur = nxt


def replace_image_paragraph(p, image_path, width_inches):
    clear_keep_properties(p)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    run = p.add_run()
    run.add_picture(str(image_path), width=Inches(width_inches))


def update_justification_table(doc):
    replacements = {
        "Publicação": "conteúdo, imagens e enquete suportam os formatos do feed; publicadoEm organiza a ordenação cronológica.",
        "Comentário": "texto contém a contribuição do usuário; criadoEm mantém a ordem da conversa.",
        "Story": "imagem e legenda formam o conteúdo efêmero; publicadoEm e expiraEm delimitam a disponibilidade.",
        "Mensagem": "texto e arquivoUrl suportam comunicação textual e anexos; tipoArquivo orienta a exibição; lida e enviadaEm controlam estado e histórico.",
        "Notificação": "tipo define o evento; texto resume a ocorrência; lida e criadaEm controlam estado e ordenação.",
        "Item do Hub": "curso e tipo permitem segmentação; título, conteúdo e extra acomodam vagas, provas e tópicos; resolvido e criadoEm apoiam o fórum.",
    }
    for table in doc.tables:
        if not table.rows:
            continue
        hdr = [c.text.strip() for c in table.rows[0].cells]
        if hdr[:2] == ["Classe", "Justificativa"]:
            for row in table.rows[1:]:
                name = row.cells[0].text.strip()
                if name in replacements:
                    row.cells[1].text = replacements[name]
            return


def build_document():
    use_case = ASSETS / "casos_de_uso_consolidado.png"
    class_diagram = ASSETS / "classes_consolidado.png"
    logical = ASSETS / "projeto_logico_brmodelo.png"
    build_use_case(use_case)
    build_class(class_diagram)
    build_logical(logical)

    doc = Document(SOURCE)
    image_paras = [p for p in doc.paragraphs if p._p.xpath(".//w:drawing")]
    if len(image_paras) != 11:
        raise RuntimeError(f"Esperadas 11 imagens, encontradas {len(image_paras)}")

    # Casos de uso: manter apenas a primeira posição de figura.
    replace_image_paragraph(image_paras[0], use_case, 6.05)
    cap_use = find_para(doc, "Figura 1 ")
    set_text(cap_use, "Figura 1 – Diagrama consolidado de casos de uso da FaeNet.")
    actors = find_para(doc, "3.3 Atores")
    remove_between_keep_sect(cap_use, actors)

    # Classes: uma figura no único trecho em paisagem.
    replace_image_paragraph(image_paras[2], class_diagram, 9.95)
    cap_class = find_para(doc, "Figura 3 ")
    set_text(cap_class, "Figura 2 – Diagrama de classes consolidado da FaeNet.")
    heading_41 = find_para(doc, "4.1 Justificativa")
    remove_between_keep_sect(cap_class, heading_41)

    # Projeto lógico: uma figura única em padrão brModelo.
    replace_image_paragraph(image_paras[4], logical, 9.95)
    cap_logical = find_para(doc, "Figura 5 ")
    set_text(cap_logical, "Figura 3 – Projeto lógico consolidado da FaeNet no padrão brModelo.")
    heading_51 = find_para(doc, "5.1 Decisões")
    remove_between_keep_sect(cap_logical, heading_51)

    # Texto e numeração coerentes com as novas figuras.
    set_text(find_para(doc, "Para preservar a legibilidade"),
             "O modelo de casos de uso foi consolidado em uma única visão. O diagrama reúne acesso, conteúdo, perfil, descoberta, comunicação e Hub do Curso, preservando os três atores e suas responsabilidades.")
    set_text(find_para(doc, "3.1 Acesso e conteúdo"), "3.1 Visão consolidada")
    set_text(actors, "3.2 Atores")
    set_text(find_para(doc, "3.4 Especificação"), "3.3 Especificação dos casos de uso")

    set_text(find_para(doc, "O modelo de domínio representa"),
             "O modelo de domínio reúne, em uma única visão, os objetos centrais e as relações que sustentam as funções da FaeNet. As cardinalidades foram preservadas e cada associação utiliza um único conector, inclusive entre Usuário e Mensagem.")
    set_text(find_para(doc, "O projeto lógico traduz"),
             "O projeto lógico traduz o domínio para relações persistentes em uma única visão consolidada, organizada segundo a notação visual do brModelo. As chaves estrangeiras e as cardinalidades permanecem explícitas, sem os campos de identificação removidos.")
    set_text(find_para(doc, "posts, comments, stories"),
             "posts, comments, stories, messages, notifications e hub_items registram datas de criação e mantêm autoria por meio das chaves de relacionamento.")
    set_text(find_para(doc, "hub_items.parent_id"),
             "hub_items.parent_username e hub_items.parent_timestamp permitem que respostas do fórum reutilizem a entidade do item principal sem criar estrutura paralela.")
    update_justification_table(doc)

    nav_cap = find_para(doc, "Figura 11 ")
    set_text(nav_cap, "Figura 4 – Mapa de navegação revisado da FaeNet.")

    # Metadados básicos e atualização de campos ao abrir.
    doc.core_properties.title = "FaeNet — Documentação consolidada"
    doc.core_properties.subject = "Diagramas consolidados de casos de uso, classes e projeto lógico em padrão brModelo"
    settings = doc.settings._element
    update = settings.find(qn("w:updateFields"))
    if update is None:
        update = settings.makeelement(qn("w:updateFields"), {qn("w:val"): "true"})
        settings.append(update)
    else:
        update.set(qn("w:val"), "true")

    doc.save(OUTPUT)
    print(OUTPUT)
    print(use_case)
    print(class_diagram)
    print(logical)


if __name__ == "__main__":
    build_document()
