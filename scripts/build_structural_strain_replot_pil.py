from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "structural-strain-replot.png"

W, H = 1500, 1000
BG = "#eaf3fa"
NAVY = "#14213d"
TEXT = "#14213d"
MUTED = "#53627c"
BORDER = "#9fc7ff"
PANEL = "#fbfdff"
BLUE = "#2f6fdf"
TEAL = "#129587"
RED = "#d43c3c"
PURPLE = "#9a72df"
DARK_ATOM = "#4f5d73"
LI = "#49b56f"


def font(size: int, bold: bool = False):
    paths = (
        [
            Path("C:/Windows/Fonts/arialbd.ttf"),
            Path("C:/Windows/Fonts/segoeuib.ttf"),
            Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        ]
        if bold
        else [
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/segoeui.ttf"),
            Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        ]
    )
    for path in paths:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def rr(draw, box, r=16, fill=PANEL, outline=BORDER, width=2):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def rotated_text(base, center, text, text_font, fill, angle=90):
    bbox = text_font.getbbox(text)
    tw, th = bbox[2] - bbox[0] + 10, bbox[3] - bbox[1] + 10
    layer = Image.new("RGBA", (tw, th), (255, 255, 255, 0))
    layer_draw = ImageDraw.Draw(layer)
    layer_draw.text((tw / 2, th / 2), text, font=text_font, fill=fill, anchor="mm")
    layer = layer.rotate(angle, expand=True)
    x, y = center
    base.alpha_composite(layer, (int(x - layer.width / 2), int(y - layer.height / 2)))


def line_with_points(draw, pts, color, width=5, r=6):
    draw.line(pts, fill=color, width=width, joint="curve")
    for x, y in pts:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def draw_header(draw):
    rr(draw, (0, 0, W, 130), r=36, fill=NAVY, outline=NAVY, width=0)
    draw.rectangle((0, 94, W, 130), fill=NAVY)
    draw.text((58, 45), "Structural Readout: Formation Rate Changes the Strain Path",
              font=font(38, True), fill="white", anchor="lm")
    draw.text((58, 84), "Replotted source data for c-axis change during initial charge",
              font=font(20), fill="#d8e2ef", anchor="lm")


def draw_chart(image, draw):
    rr(draw, (64, 165, 970, 718), r=12)
    draw.text((96, 215), "A. Replotted structural data: c-axis change during initial charge",
              font=font(26, True), fill=TEXT, anchor="lm")

    left, top, right, bottom = 180, 272, 888, 632
    # Grid and risk window.
    draw.rectangle((720, top, 872, bottom), fill="#f5d6da")
    for yval in [-0.3, 0.0, 0.3]:
        y = map_y(yval, top, bottom)
        draw.line((left, y, right, y), fill="#d8e2ef", width=1)
        draw.text((left - 28, y), f"{yval:.1f}" if yval else "0.0", font=font(21), fill=MUTED, anchor="rm")

    # Axes.
    draw.line((left, top, left, bottom), fill=TEXT, width=3)
    draw.line((left, bottom, right, bottom), fill=TEXT, width=3)
    for xval, label in [(0, "0.00"), (0.25, "0.25"), (0.50, "0.50"), (0.75, "0.75"), (1.0, "1.00")]:
        x = map_x(xval, left, right)
        draw.text((x, bottom + 20), label, font=font(21), fill=MUTED, anchor="mt")
    rotated_text(image, (98, (top + bottom) / 2), "Relative c-axis change, Δc/c (%)", font(20, True), MUTED, angle=90)
    draw.text(((left + right) / 2, bottom + 60), "Normalized progress through the first charge",
              font=font(22, True), fill=MUTED, anchor="mm")

    # Legend: down near chart, clear of title and curves.
    ly = 256
    lx = 555
    draw.line((lx, ly, lx + 58, ly), fill=BLUE, width=5)
    draw.ellipse((lx + 26, ly - 7, lx + 40, ly + 7), fill=BLUE)
    draw.text((lx + 72, ly), "0.2C charge", font=font(20, True), fill=MUTED, anchor="lm")
    lx2 = lx + 245
    draw.line((lx2, ly, lx2 + 58, ly), fill=TEAL, width=5)
    draw.ellipse((lx2 + 26, ly - 7, lx2 + 40, ly + 7), fill=TEAL)
    draw.text((lx2 + 72, ly), "2C charge", font=font(20, True), fill=MUTED, anchor="lm")

    slow = [(0.00, 0.00), (0.06, 0.02), (0.13, 0.18), (0.18, 0.29), (0.26, 0.41),
            (0.34, 0.38), (0.46, 0.37), (0.56, 0.36), (0.63, 0.33), (0.70, 0.31),
            (0.78, 0.25), (0.84, 0.22), (1.00, -0.32)]
    fast = [(0.00, 0.00), (0.06, 0.08), (0.12, 0.10), (0.20, 0.24), (0.30, 0.31),
            (0.38, 0.42), (0.50, 0.40), (0.62, 0.38), (0.74, 0.37), (0.82, 0.35),
            (0.90, 0.35), (1.00, 0.33)]
    slow_pts = [(map_x(x, left, right), map_y(y, top, bottom)) for x, y in slow]
    fast_pts = [(map_x(x, left, right), map_y(y, top, bottom)) for x, y in fast]
    line_with_points(draw, slow_pts, BLUE)
    line_with_points(draw, fast_pts, TEAL)

    draw.text((725, 535), "Deep-delithiation\nstructural-distortion\nregime",
              font=font(27, True), fill=RED, anchor="mm", align="center", spacing=4)


def map_x(x, left, right):
    return left + x * (right - left)


def map_y(y, top, bottom):
    ymin, ymax = -0.45, 0.50
    return bottom - (y - ymin) / (ymax - ymin) * (bottom - top)


def draw_layer(draw, x, y, w, h, distorted, residual, title, color):
    rr(draw, (x, y, x + w, y + h), r=28, fill=PANEL, outline=BORDER, width=2)
    draw.text((x + 18, y - 18), title, font=font(26, True), fill=TEXT, anchor="lm")
    # Net lithium-extraction arrows.
    for ax in [x + w * 0.25, x + w * 0.50, x + w * 0.75]:
        draw.line((ax, y + 56, ax, y + 24), fill=color, width=3)
        draw.polygon([(ax, y + 17), (ax - 6, y + 29), (ax + 6, y + 29)], fill=color)

    for row in range(4):
        base_y = y + 58 + row * 23
        pts = []
        for i in range(7):
            px = x + 34 + i * 52
            wave = 11 if distorted else 3
            py = base_y + (wave if i % 2 else 0)
            pts.append((px, py))
        draw.line(pts, fill=PURPLE, width=7, joint="curve")
        draw.line([(px, py + 6) for px, py in pts], fill="#c7b1ff", width=4, joint="curve")

    atoms = [(0.16, 0.40), (0.31, 0.30), (0.50, 0.43), (0.70, 0.32), (0.85, 0.45),
             (0.22, 0.70), (0.41, 0.65), (0.62, 0.72), (0.78, 0.63)]
    for fx, fy in atoms:
        cx, cy = x + fx * w, y + fy * h
        draw.ellipse((cx - 12, cy - 8, cx + 12, cy + 8), fill=DARK_ATOM, outline=TEXT, width=1)
    for fx in ([0.18, 0.42, 0.63] if distorted else [0.14, 0.24, 0.42, 0.57, 0.72, 0.86]):
        cx, cy = x + fx * w, y + 0.72 * h
        draw.ellipse((cx - 12, cy - 8, cx + 12, cy + 8), fill=LI)
    if distorted:
        for fx in [0.28, 0.55, 0.82]:
            cx, cy = x + fx * w, y + 0.50 * h
            draw.line((cx - 10, cy - 22, cx + 10, cy, cx - 2, cy + 22), fill=RED, width=3)

    note_fill = "#eaf3ff" if distorted else "#e4fbf4"
    draw.rounded_rectangle((x + 24, y + h - 40, x + w - 24, y + h - 7), radius=12, fill=note_fill)
    label = f"Residual Li ~{residual:.2f} per f.u.\n" + ("higher distortion" if distorted else "more Li retained")
    draw.text((x + w / 2, y + h - 24), label, font=font(16, True), fill=color, anchor="mm", align="center", spacing=0)


def draw_right_panel(draw):
    rr(draw, (980, 165, 1450, 718), r=12)
    draw.text((1028, 215), "B. Layered-structure interpretation",
              font=font(25, True), fill=TEXT, anchor="lm")
    draw_layer(draw, 1025, 292, 380, 180, True, 0.13, "Slow 0.2C first charge", BLUE)
    draw_layer(draw, 1025, 522, 380, 180, False, 0.41, "Fast 2C first charge", TEAL)
    rr(draw, (75, 810, 1425, 920), r=16, fill="#fff6d6", outline="#d59d22", width=3)
    draw.text((750, 865),
              "Slow formation reaches a heavily delithiated end state; fast formation leaves more residual Li\n"
              "and a less distorted starting state.",
              font=font(26, True), fill=TEXT, anchor="mm", align="center", spacing=5)


def main():
    image = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw_header(draw)
    draw_chart(image, draw)
    draw_right_panel(draw)
    draw.text((1380, 972), "(c) Winigen Materials - winigenmaterials.com",
              font=font(18, True), fill="#8d9ab0", anchor="rm")
    image.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
