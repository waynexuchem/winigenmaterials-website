from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "redox-residual-li-inventory.png"

NAVY = "#14213d"
MUTED = "#53627c"
BLUE = "#2f6fdd"
TEAL = "#0f9488"
PURPLE = "#8b63d6"
PEACH = "#f5cdbd"
ORANGE_LIGHT = "#f8dfcb"
GREEN_LIGHT = "#cfeee4"
YELLOW = "#fff4d9"
YELLOW_BORDER = "#d59d22"
BORDER = "#a9c9ef"
GRID = "#dbe6f2"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
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
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def text_center(draw: ImageDraw.ImageDraw, box, text, font, fill=NAVY, spacing=4):
    x0, y0, x1, y1 = box
    lines = text.split("\n")
    heights = []
    widths = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        widths.append(bbox[2] - bbox[0])
        heights.append(bbox[3] - bbox[1])
    total_h = sum(heights) + spacing * (len(lines) - 1)
    y = y0 + (y1 - y0 - total_h) / 2
    for line, width, height in zip(lines, widths, heights):
        draw.text((x0 + (x1 - x0 - width) / 2, y), line, font=font, fill=fill)
        y += height + spacing


def rotated_text(image: Image.Image, center, text, font, fill=NAVY, angle=90):
    bbox_probe = Image.new("RGBA", (1, 1), (255, 255, 255, 0))
    probe = ImageDraw.Draw(bbox_probe)
    bbox = probe.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0] + 24
    th = bbox[3] - bbox[1] + 24
    layer = Image.new("RGBA", (tw, th), (255, 255, 255, 0))
    d = ImageDraw.Draw(layer)
    bbox = d.textbbox((0, 0), text, font=font)
    d.text(((tw - (bbox[2] - bbox[0])) / 2, (th - (bbox[3] - bbox[1])) / 2), text, font=font, fill=fill)
    rotated = layer.rotate(angle, expand=True)
    image.alpha_composite(rotated, (int(center[0] - rotated.width / 2), int(center[1] - rotated.height / 2)))


def interp(points, t):
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        if x0 <= t <= x1:
            f = (t - x0) / (x1 - x0)
            return y0 + f * (y1 - y0)
    return points[-1][1]


def main():
    W, H = 1500, 900
    image = Image.new("RGBA", (W, H), "#edf5fb")
    draw = ImageDraw.Draw(image)

    title_font = load_font(46, True)
    label_font = load_font(25, True)
    tick_font = load_font(22, False)
    small_bold = load_font(22, True)
    region_font = load_font(24, True)
    box_font = load_font(26, True)

    draw.rounded_rectangle((24, 20, W - 24, H - 20), radius=26, fill="white", outline=BORDER, width=3)
    text_center(draw, (120, 54, W - 120, 130), "First-charge curves and redox regions", title_font, NAVY)

    # Plot frame.
    px0, py0, px1, py1 = 225, 195, 1365, 640
    left, bottom, right, top = px0, py1, px1, py0

    def sx(x):
        return left + (x / 1.20) * (right - left)

    def sy(y):
        return bottom - ((y - 2.75) / (5.0 - 2.75)) * (bottom - top)

    # Region backgrounds.
    draw.rectangle((sx(0.00), top, sx(0.32), bottom), fill="#d9d0ec")
    draw.rectangle((sx(0.32), top, sx(0.79), bottom), fill=ORANGE_LIGHT)
    draw.rectangle((sx(0.79), top, sx(1.07), bottom), fill=PEACH)
    draw.rectangle((sx(0.79), top, sx(1.20), sy(4.55)), fill=GREEN_LIGHT)

    for y in [3, 4, 5]:
        draw.line((left, sy(y), right, sy(y)), fill=GRID, width=2)
    draw.line((left, top, left, bottom), fill=NAVY, width=5)
    draw.line((left, bottom, right, bottom), fill=NAVY, width=5)

    # Curves.
    blue_pts = [(0, 2.8), (0.005, 3.55), (0.04, 3.72), (0.12, 3.90), (0.22, 4.18), (0.32, 4.45),
                (0.45, 4.56), (0.70, 4.60), (0.95, 4.66), (1.07, 4.82)]
    green_pts = [(0, 2.8), (0.005, 3.70), (0.04, 3.82), (0.12, 3.98), (0.22, 4.24), (0.32, 4.50),
                 (0.45, 4.62), (0.70, 4.69), (0.79, 4.82)]
    dense_blue = [(t / 100 * 1.07, interp(blue_pts, t / 100 * 1.07)) for t in range(101)]
    dense_green = [(t / 100 * 0.79, interp(green_pts, t / 100 * 0.79)) for t in range(101)]
    draw.line([(sx(x), sy(y)) for x, y in dense_blue], fill=BLUE, width=7, joint="curve")
    draw.line([(sx(x), sy(y)) for x, y in dense_green], fill=TEAL, width=7, joint="curve")
    draw.line((sx(0.79), sy(2.85), sx(0.79), sy(4.82)), fill=TEAL, width=5)
    draw.line((sx(1.07), sy(2.85), sx(1.07), sy(4.82)), fill=BLUE, width=5)

    # Legend.
    ly = 152
    draw.line((360, ly, 480, ly), fill=BLUE, width=7)
    draw.text((500, ly - 14), "0.2C charge", font=small_bold, fill=MUTED)
    draw.line((800, ly, 920, ly), fill=TEAL, width=7)
    draw.text((940, ly - 14), "2C charge", font=small_bold, fill=MUTED)

    # Ticks and labels.
    for x, label in [(0, "0"), (0.32, "0.32"), (0.79, "0.79"), (1.07, "1.07"), (1.20, "1.20")]:
        draw.line((sx(x), bottom, sx(x), bottom + 10), fill=MUTED, width=2)
        bbox = draw.textbbox((0, 0), label, font=tick_font)
        draw.text((sx(x) - (bbox[2] - bbox[0]) / 2, bottom + 18), label, font=tick_font, fill=MUTED)
    for y, label in [(3, "3"), (4, "4"), (4.8, "4.8"), (5, "5")]:
        draw.line((left - 10, sy(y), left, sy(y)), fill=MUTED, width=2)
        bbox = draw.textbbox((0, 0), label, font=tick_font)
        draw.text((left - 20 - (bbox[2] - bbox[0]), sy(y) - (bbox[3] - bbox[1]) / 2), label, font=tick_font, fill=MUTED)

    rotated_text(image, (112, (top + bottom) / 2), "Voltage / V", label_font, MUTED, 90)
    xlabel = "Li extracted per formula unit, 1.20 - x"
    bbox = draw.textbbox((0, 0), xlabel, font=label_font)
    draw.text(((left + right - (bbox[2] - bbox[0])) / 2, bottom + 46), xlabel, font=label_font, fill=MUTED)

    # Region annotations.
    text_center(draw, (245, 268, 415, 360), "pre-plateau\nNi oxidation\n~0.32 Li", load_font(21, True), PURPLE, spacing=1)
    text_center(draw, (570, 318, 760, 420), "high-voltage\nplateau", region_font, "#ef5a24", spacing=2)
    text_center(draw, (1010, 328, 1210, 420), "deeper plateau\naccess at 0.2C", region_font, "#b33d12", spacing=2)
    text_center(draw, (982, 180, 1180, 252), "Li remaining after 2C\nx ≈ 0.79; Li ≈ 0.41", load_font(20, True), TEAL, spacing=1)
    draw.rounded_rectangle((1242, 540, 1364, 630), radius=12, fill="#df4b57", outline=None)
    text_center(draw, (1242, 540, 1364, 630), "Li remaining\nafter 0.2C\nx ≈ 1.07\nLi ≈ 0.13", load_font(17, True), "white", spacing=0)

    # Summary boxes.
    draw.rounded_rectangle((120, 735, 735, 805), radius=14, fill="#dff5ef", outline=None)
    text_center(draw, (130, 735, 725, 805), "2C: 0.79 Li extracted\nresidual Li ~0.41", box_font, TEAL, spacing=2)
    draw.rounded_rectangle((765, 735, 1380, 805), radius=14, fill="#e7efff", outline=None)
    text_center(draw, (775, 735, 1370, 805), "0.2C: 1.07 Li extracted\nresidual Li ~0.13", box_font, BLUE, spacing=2)

    draw.rounded_rectangle((135, 812, 1365, 870), radius=12, fill=YELLOW, outline=YELLOW_BORDER, width=3)
    text_center(draw, (150, 812, 1350, 870),
                "Similar pre-plateau Li extraction; different plateau depth and residual-Li inventory.",
                load_font(27, True), NAVY, spacing=0)

    image.save(IMAGE)
    print(IMAGE)


if __name__ == "__main__":
    main()
