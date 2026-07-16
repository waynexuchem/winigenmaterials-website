from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "structural-strain-replot.png"
NAVY = "#14213d"


def font(size: int, bold: bool = False):
    names = ["arialbd.ttf", "segoeuib.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def main():
    image = Image.open(IMAGE).convert("RGBA")
    draw = ImageDraw.Draw(image)
    w, _ = image.size

    header_h = 130
    draw.rounded_rectangle((0, 0, w, header_h), radius=38, fill=NAVY)
    draw.rectangle((0, 96, w, header_h), fill=NAVY)

    draw.text(
        (58, 45),
        "Structural Readout: Formation Rate Changes the Strain Path",
        font=font(38, True),
        fill="white",
        anchor="lm",
    )
    draw.text(
        (58, 84),
        "Replotted source data for c-axis change during initial charge",
        font=font(20, False),
        fill="#d8e2ef",
        anchor="lm",
    )
    image.save(IMAGE)
    print(IMAGE)


if __name__ == "__main__":
    main()
