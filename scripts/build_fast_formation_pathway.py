from pathlib import Path
import os
import math

ROOT = Path(__file__).resolve().parents[1]
MPLCONFIG = ROOT / "tmp" / "matplotlib"
MPLCONFIG.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("MPLCONFIGDIR", str(MPLCONFIG))

import matplotlib.pyplot as plt
from matplotlib import patches


OUT = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "formation-pathway-schematic.png"

NAVY = "#14213d"
BG = "#edf5fb"
PANEL = "#ffffff"
BORDER = "#a9c9ef"
TEXT = "#14213d"
MUTED = "#53627c"
BLUE = "#2f6fdd"
TEAL = "#0f9488"
PURPLE = "#8b63d6"
PURPLE_LIGHT = "#c6b5ff"
ORANGE = "#ef5a24"
YELLOW = "#fff4d9"
YELLOW_BORDER = "#d59d22"
RED = "#d43c3c"
GREEN = "#4fac6a"
TM = "#48566d"
OXY = "#e7eef5"
GRAY = "#eef3f8"


def rounded_box(ax, xy, width, height, fc=PANEL, ec=BORDER, lw=1.2, radius=0.02, z=1):
    box = patches.FancyBboxPatch(
        xy,
        width,
        height,
        boxstyle=f"round,pad=0.010,rounding_size={radius}",
        facecolor=fc,
        edgecolor=ec,
        linewidth=lw,
        transform=ax.transAxes,
        clip_on=False,
        zorder=z,
    )
    ax.add_patch(box)
    return box


def draw_layered(ax, x0, y0, w, h, title, color, residual_li, removed_li, plateau_li, distorted):
    rounded_box(ax, (x0, y0), w, h, fc=PANEL, ec=BORDER, lw=1.1, radius=0.012)
    ax.text(x0 + 0.02 * w, y0 + h - 0.025, title, ha="left", va="top",
            fontsize=17.4, fontweight="bold", color=TEXT, transform=ax.transAxes)

    # Layered cathode cartoon.
    sx, sy, sw, sh = x0 + 0.06 * w, y0 + 0.50 * h, 0.88 * w, 0.30 * h
    rounded_box(ax, (sx, sy), sw, sh, fc="#fbfdff", ec=BORDER, lw=0.9, radius=0.010)
    rows = 4
    cols = 8
    xs = [sx + 0.07 * sw + i * (0.86 * sw / (cols - 1)) for i in range(cols)]
    row_ys = [sy + 0.20 * sh + r * 0.20 * sh for r in range(rows)]
    for r, base_y in enumerate(row_ys):
        wiggles = [0.010, -0.005, 0.014, -0.010, 0.013, -0.006, 0.011, -0.012] if distorted else [0.002, -0.001] * 4
        ys = [base_y + wiggles[i] for i in range(cols)]
        ax.plot(xs, ys, lw=4.8, color=PURPLE, alpha=0.90, transform=ax.transAxes, solid_capstyle="round")
        ax.plot(xs, [yy + 0.006 for yy in ys], lw=1.8, color=PURPLE_LIGHT, alpha=0.88, transform=ax.transAxes)

    li_count = 4 if residual_li < 0.2 else 12
    li_positions = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            li_positions.append((sx + 0.10 * sw + c * (0.80 * sw / 6), sy + 0.30 * sh + r * 0.19 * sh))
    for i, (lx, ly) in enumerate(li_positions[:li_count]):
        ax.add_patch(patches.Circle((lx, ly), 0.009, facecolor=GREEN, edgecolor="white", lw=0.7,
                                    transform=ax.transAxes, zorder=4))

    for r in range(rows - 1):
        for c in range(3):
            tx = sx + 0.24 * sw + c * 0.24 * sw + (0.02 * sw if r % 2 else 0)
            ty = sy + 0.28 * sh + r * 0.19 * sh
            ax.add_patch(patches.Circle((tx, ty), 0.011, facecolor=TM, edgecolor="#263142", lw=0.7,
                                        transform=ax.transAxes, zorder=4))
            ax.add_patch(patches.Circle((tx + 0.035 * sw, ty + 0.018 * sh), 0.008,
                                        facecolor=OXY, edgecolor="#c8d4e3", lw=0.5,
                                        transform=ax.transAxes, zorder=3))

    if distorted:
        for dx, dy in [(0.27, 0.45), (0.55, 0.32), (0.78, 0.55)]:
            cx = sx + dx * sw
            cy = sy + dy * sh
            ax.plot([cx - 0.010, cx + 0.005, cx - 0.006, cx + 0.014],
                    [cy + 0.035, cy + 0.015, cy - 0.006, cy - 0.032],
                    color=RED, lw=2.2, transform=ax.transAxes, zorder=5)

    for i in range(3):
        ax.annotate("", xy=(sx + (0.22 + i * 0.26) * sw, sy + sh + 0.055),
                    xytext=(sx + (0.22 + i * 0.26) * sw, sy + sh + 0.012),
                    arrowprops=dict(arrowstyle="-|>", lw=1.4, color=color), xycoords=ax.transAxes)
    mid_arrow_x = sx + 0.48 * sw
    ax.text(mid_arrow_x - 0.010, sy + sh + 0.030, "Li extraction", ha="right", va="center",
            fontsize=10.8, fontweight="bold", color=color, transform=ax.transAxes)

    # Separate sphere legend below cathode structure.
    legend_y = y0 + 0.455 * h
    items = [
        (TM, f"Li removed {removed_li:.2f}"),
        ("#ffffff", f"plateau Li {plateau_li:.2f}"),
        (GREEN, f"residual Li {residual_li:.2f}"),
    ]
    start_x = x0 + 0.12 * w
    for i, (fc, label) in enumerate(items):
        ix = start_x + i * 0.285 * w
        ax.add_patch(patches.Circle((ix, legend_y), 0.0105, facecolor=fc, edgecolor=TM, lw=1.0,
                                    transform=ax.transAxes, zorder=5))
        ax.text(ix + 0.014, legend_y, label, ha="left", va="center", fontsize=9.8,
                fontweight="bold", color=TEXT if fc != GREEN else TEAL, transform=ax.transAxes)

    # Bar summary.
    bx, by, bw, bh = x0 + 0.16 * w, y0 + 0.070 * h, 0.68 * w, 0.255 * h
    rounded_box(ax, (bx, by), bw, bh, fc="#f9fbfe", ec="#c4d8f0", lw=0.9, radius=0.008)
    bar_h = (0.27 if distorted else 0.60) * bh
    bar_color = "#f3b5b9" if distorted else "#bfeee4"
    ax.add_patch(patches.Rectangle((bx, by), bw, bar_h, facecolor=bar_color, edgecolor="none", transform=ax.transAxes))
    ax.text(bx + bw / 2, by + bar_h + (bh - bar_h) / 2,
            "low residual Li\nmore structural distortion" if distorted else "higher residual Li\nless structural distortion",
            ha="center", va="center", fontsize=12.4, fontweight="bold", color=TEXT, transform=ax.transAxes)


def draw_flow(ax):
    labels = [
        ("formation\nrate", BLUE),
        ("polarization +\nspatial reaction\npattern", TEAL),
        ("plateau-region\naccess", YELLOW_BORDER),
        ("delithiation\ndepth", ORANGE),
        ("residual Li\ndistribution", TEAL),
        ("TM migration +\ndeformation\ntendency", RED),
        ("later cycling\nbehavior", BLUE),
    ]
    w, h = 0.105, 0.070
    gap = 0.024
    x0, y = (1 - (len(labels) * w + (len(labels) - 1) * gap)) / 2, 0.085
    for i, (label, color) in enumerate(labels):
        x = x0 + i * (w + gap)
        rounded_box(ax, (x, y), w, h, fc=PANEL, ec=color, lw=1.7, radius=0.008)
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center",
                fontsize=10.7, fontweight="bold", color=TEXT, transform=ax.transAxes)
        if i < len(labels) - 1:
            ax.annotate("", xy=(x + w + gap - 0.004, y + h / 2), xytext=(x + w + 0.004, y + h / 2),
                        arrowprops=dict(arrowstyle="-|>", color=TEXT, lw=1.6), xycoords=ax.transAxes)


def main():
    fig = plt.figure(figsize=(1500 / 100, 900 / 100), dpi=100)
    fig.patch.set_facecolor(BG)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.patch.set_alpha(0)
    ax.set_axis_off()

    header = patches.FancyBboxPatch((0, 0.865), 1, 0.135, boxstyle="round,pad=0.0,rounding_size=0.028",
                                    facecolor=NAVY, edgecolor=NAVY, transform=ax.transAxes)
    ax.add_patch(header)
    ax.text(0.04, 0.948, "Formation Pathway: First-Charge Rate and the LLO Starting State",
            ha="left", va="center", fontsize=22.5, fontweight="bold", color="white", transform=ax.transAxes)
    ax.text(0.04, 0.908,
            "Slow and fast formation reach the same cutoff but establish different cathode end states",
            ha="left", va="center", fontsize=15.4, color="#d8e2ef", transform=ax.transAxes)

    draw_layered(ax, 0.055, 0.275, 0.395, 0.535, "Slow 0.2C first charge", BLUE, 0.13, 1.07, 0.74, True)
    draw_layered(ax, 0.550, 0.275, 0.395, 0.535, "Fast 2C first charge", TEAL, 0.41, 0.79, 0.46, False)

    rounded_box(ax, (0.150, 0.182), 0.700, 0.060, fc=YELLOW, ec=YELLOW_BORDER, lw=1.3, radius=0.012)
    ax.text(0.500, 0.212, "Fast formation leaves about 3x more residual lithium at the same 4.8 V cutoff.",
            ha="center", va="center", fontsize=15.5, fontweight="bold", color=TEXT, transform=ax.transAxes)

    draw_flow(ax)

    ax.text(0.500, 0.035, "Li values are per formula unit.", ha="center", va="center",
            fontsize=12.5, fontweight="bold", color=MUTED, transform=ax.transAxes)
    ax.text(0.925, 0.035, "(c) Winigen Materials - winigenmaterials.com", ha="right", va="center",
            fontsize=10.8, fontweight="bold", color="#8d9ab0", transform=ax.transAxes)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=100, bbox_inches=None, pad_inches=0)
    plt.close(fig)
    print(OUT)


if __name__ == "__main__":
    main()
