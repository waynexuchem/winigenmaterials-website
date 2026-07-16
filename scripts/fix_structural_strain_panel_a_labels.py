from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "structural-strain-replot.png"

TEXT = "#14213d"
MUTED = "#53627c"
BLUE = "#2f6fdf"
TEAL = "#129587"
RED = "#d43c3c"
PINK = "#f5d6da"
WHITE = "#fbfdff"


def font(size: int, bold: bool = False):
    names = ["arialbd.ttf", "segoeuib.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def draw_legend(draw: ImageDraw.ImageDraw, x: int, y: int):
    f = font(20, True)
    draw.line((x, y, x + 58, y), fill=BLUE, width=5)
    draw.ellipse((x + 26, y - 7, x + 40, y + 7), fill=BLUE)
    draw.text((x + 72, y), "0.2C charge", anchor="lm", font=f, fill=MUTED)

    x2 = x + 245
    draw.line((x2, y, x2 + 58, y), fill=TEAL, width=5)
    draw.ellipse((x2 + 26, y - 7, x2 + 40, y + 7), fill=TEAL)
    draw.text((x2 + 72, y), "2C charge", anchor="lm", font=f, fill=MUTED)


def main():
    image = Image.open(IMAGE).convert("RGBA")
    draw = ImageDraw.Draw(image)

    # Clear old split title and legend while preserving the panel border and plot area.
    draw.rectangle((90, 205, 930, 270), fill=WHITE)
    draw.text(
        (96, 238),
        "A. Replotted structural data: c-axis change during initial charge",
        anchor="lm",
        font=font(30, True),
        fill=TEXT,
    )
    draw_legend(draw, 555, 263)

    # Reposition the high-SOC label lower/left in the shaded region.
    # Clear the full risk-window span so old text fragments are removed.
    draw.rectangle((721, 270, 872, 631), fill=PINK)
    for y in (348, 465, 583):
        draw.line((721, y, 872, y), fill="#d8e2ef", width=1)
    # Redraw the visible curve segments that pass through the cleared shaded window.
    draw.line([(721, 382), (762, 399), (807, 468), (872, 590)], fill=BLUE, width=5)
    draw.ellipse((715, 376, 727, 388), fill=BLUE)
    draw.ellipse((866, 584, 878, 596), fill=BLUE)
    draw.line([(721, 335), (762, 342), (807, 342), (872, 355)], fill=TEAL, width=5)
    draw.ellipse((715, 329, 727, 341), fill=TEAL)
    draw.ellipse((866, 349, 878, 361), fill=TEAL)
    draw.text(
        (770, 500),
        "high-SOC\nstructural risk\nwindow",
        anchor="mm",
        font=font(30, True),
        fill=RED,
        align="center",
        spacing=4,
    )

    image.save(IMAGE)
    print(IMAGE)


if __name__ == "__main__":
    main()
