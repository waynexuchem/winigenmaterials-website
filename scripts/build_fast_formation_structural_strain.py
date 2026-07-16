from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
MPLCONFIG = ROOT / "tmp" / "matplotlib"
MPLCONFIG.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("MPLCONFIGDIR", str(MPLCONFIG))

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib import patches


SOURCE = ROOT / "literature" / "2026 - Nature Fast formation to reinforce lithium-rich cathodes" / "41586_2025_9553_MOESM3_ESM.xlsx"
OUT = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "structural-strain-replot.png"


NAVY = "#14213d"
BG = "#edf5fb"
PANEL = "#ffffff"
BORDER = "#a9c9ef"
GRID = "#dce7f2"
BLUE = "#2f6fdd"
TEAL = "#0f9488"
PURPLE = "#8b63d6"
LI = "#4fac6a"
TM = "#4b5a70"
OXY = "#b8c3d3"
RED = "#d43c3c"
TEXT = "#14213d"
MUTED = "#53627c"


def read_xy(sheet_name: str) -> tuple[list[float], list[float]]:
    df = pd.read_excel(SOURCE, sheet_name=sheet_name, header=0)
    df = df.dropna()
    return df.iloc[:, 0].astype(float).tolist(), df.iloc[:, 1].astype(float).tolist()


def rounded_box(ax, xy, width, height, fc=PANEL, ec=BORDER, lw=1.2, radius=0.04):
    box = patches.FancyBboxPatch(
        xy,
        width,
        height,
        boxstyle=f"round,pad=0.012,rounding_size={radius}",
        facecolor=fc,
        edgecolor=ec,
        linewidth=lw,
        transform=ax.transAxes,
        clip_on=False,
    )
    ax.add_patch(box)
    return box


def draw_layered_structure(ax, x0, y0, w, h, distorted: bool, residual: float, label: str, color: str):
    rounded_box(ax, (x0, y0), w, h, fc="#fbfdff", ec=BORDER, lw=1.2, radius=0.025)
    ax.text(x0, y0 + h + 0.025, label, ha="left", va="bottom", fontsize=15, fontweight="bold", color=TEXT, transform=ax.transAxes)

    rows = 4
    cols = 8
    line_x = [x0 + 0.07 * w + i * (0.86 * w / (cols - 1)) for i in range(cols)]
    base_ys = [y0 + 0.22 * h + r * (0.18 * h) for r in range(rows)]

    for r, base_y in enumerate(base_ys):
        if distorted:
            wiggle = [0.010, -0.004, 0.018, -0.010, 0.014, -0.006, 0.012, -0.014]
            ys = [base_y + wiggle[i] for i in range(cols)]
        else:
            ys = [base_y + (0.002 if i % 2 else -0.002) for i in range(cols)]
        ax.plot(line_x, ys, color=PURPLE, lw=4.2, alpha=0.85, transform=ax.transAxes, solid_capstyle="round")
        ax.plot(line_x, [v + 0.006 for v in ys], color="#c7b8ff", lw=1.6, alpha=0.8, transform=ax.transAxes)

    li_count = 4 if residual < 0.2 else 11
    li_positions = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            li_positions.append((x0 + 0.12 * w + c * (0.78 * w / 6), y0 + 0.30 * h + r * (0.17 * h)))
    for i, (x, y) in enumerate(li_positions[:li_count]):
        shade = 0.85 if residual > 0.2 else 0.55
        ax.add_patch(patches.Circle((x, y), 0.009, facecolor=LI, edgecolor="white", lw=0.7, alpha=shade, transform=ax.transAxes))

    for r in range(rows - 1):
        for c in range(3):
            x = x0 + 0.22 * w + c * 0.24 * w + (0.03 * w if r % 2 else 0)
            y = y0 + 0.27 * h + r * 0.18 * h
            ax.add_patch(patches.Circle((x, y), 0.011, facecolor=TM, edgecolor="#233044", lw=0.7, transform=ax.transAxes))
            ax.add_patch(patches.Circle((x + 0.035 * w, y + 0.018 * h), 0.008, facecolor=OXY, edgecolor="white", lw=0.6, transform=ax.transAxes))

    if distorted:
        for dx, dy in [(0.32, 0.44), (0.64, 0.30), (0.78, 0.55)]:
            x = x0 + dx * w
            y = y0 + dy * h
            ax.plot([x - 0.012, x, x + 0.015, x + 0.004], [y + 0.030, y + 0.012, y - 0.006, y - 0.028],
                    color=RED, lw=2.2, transform=ax.transAxes)

    arrow_y = y0 + 0.93 * h
    for i in range(3):
        x = x0 + 0.22 * w + i * 0.25 * w
        ax.annotate("", xy=(x, arrow_y + 0.055), xytext=(x, arrow_y + 0.010),
                    arrowprops=dict(arrowstyle="-|>", lw=1.4, color=color), xycoords=ax.transAxes)

    note_h = 0.19 * h
    note_y = y0 + 0.055 * h
    note = patches.FancyBboxPatch(
        (x0 + 0.05 * w, note_y),
        0.90 * w,
        note_h,
        boxstyle="round,pad=0.004,rounding_size=0.012",
        facecolor="#eef5ff" if color == BLUE else "#e9f8f4",
        edgecolor="none",
        alpha=0.94,
        transform=ax.transAxes,
        clip_on=False,
    )
    ax.add_patch(note)
    info = f"Residual Li ~{residual:.2f} per f.u.\n" + ("higher distortion" if distorted else "more Li retained")
    ax.text(x0 + w / 2, note_y + note_h / 2, info, ha="center", va="center", fontsize=11.4, fontweight="bold",
            color=color, transform=ax.transAxes)


def main():
    x_slow, y_slow = read_xy("Fig2c")
    x_fast, y_fast = read_xy("Fig2d")

    fig = plt.figure(figsize=(15, 9), dpi=100)
    fig.patch.set_facecolor(BG)

    canvas = fig.add_axes([0, 0, 1, 1])
    canvas.set_axis_off()

    header = patches.FancyBboxPatch((0, 0.855), 1, 0.145, boxstyle="round,pad=0.0,rounding_size=0.03",
                                    facecolor=NAVY, edgecolor=NAVY, transform=canvas.transAxes)
    canvas.add_patch(header)
    canvas.text(0.04, 0.942, "Structural Readout: Formation Rate Changes the Strain Path",
                color="white", fontsize=26, fontweight="bold", ha="left", va="center", transform=canvas.transAxes)
    canvas.text(0.04, 0.904, "Replotted source data for c-axis change during initial charge",
                color="#d8e2ef", fontsize=13.5, ha="left", va="center", transform=canvas.transAxes)

    rounded_box(canvas, (0.055, 0.215), 0.58, 0.59, fc=PANEL, ec=BORDER, lw=1.1, radius=0.012)
    chart = fig.add_axes([0.12, 0.30, 0.47, 0.40])
    chart.set_facecolor("#fbfdff")
    chart.plot(x_slow, y_slow, color=BLUE, lw=3.0, marker="o", ms=5.8, markevery=[0, 3, 6, 9, 12, 15, 18], label="0.2C charge")
    chart.plot(x_fast, y_fast, color=TEAL, lw=3.0, marker="o", ms=5.8, markevery=[0, 2, 4, 6, 8, 10, 12, len(x_fast) - 1], label="2C charge")
    chart.axvspan(0.78, 1.0, color="#f5c9cf", alpha=0.65, zorder=0)
    chart.text(0.82, 0.07, "high-SOC\nstructural risk\nwindow", ha="center", va="center",
               color=RED, fontsize=19, fontweight="bold")
    chart.set_xlim(-0.02, 1.02)
    chart.set_ylim(-0.42, 0.50)
    chart.set_xticks([0, 0.25, 0.50, 0.75, 1.00])
    chart.set_yticks([-0.3, 0.0, 0.3])
    chart.tick_params(axis="both", labelsize=13, colors=MUTED, pad=7)
    chart.grid(axis="y", color=GRID, linewidth=1.1)
    chart.spines["top"].set_visible(False)
    chart.spines["right"].set_visible(False)
    for side in ["left", "bottom"]:
        chart.spines[side].set_color(TEXT)
        chart.spines[side].set_linewidth(2.0)
    chart.set_xlabel("state of charge during first charge", fontsize=14, fontweight="bold", color=MUTED, labelpad=10)
    chart.set_ylabel("relative c-axis change", fontsize=14, fontweight="bold", color=MUTED, labelpad=34, rotation=90)
    chart.yaxis.set_label_coords(-0.105, 0.5)
    chart.set_title("A. Replotted structural data: c-axis change during initial charge",
                    fontsize=16, fontweight="bold", color=TEXT, loc="left", pad=18)
    leg = chart.legend(loc="upper right", bbox_to_anchor=(0.92, 1.06), ncol=2, frameon=False,
                       fontsize=13, handlelength=2.3, columnspacing=1.5)
    for text in leg.get_texts():
        text.set_fontweight("bold")
        text.set_color(MUTED)

    rounded_box(canvas, (0.665, 0.215), 0.29, 0.59, fc=PANEL, ec=BORDER, lw=1.1, radius=0.012)
    canvas.text(0.685, 0.735, "B. Layered-structure interpretation", fontsize=16, fontweight="bold", color=TEXT, transform=canvas.transAxes)
    draw_layered_structure(canvas, 0.695, 0.505, 0.23, 0.160, True, 0.13, "Slow 0.2C first charge", BLUE)
    draw_layered_structure(canvas, 0.695, 0.285, 0.23, 0.160, False, 0.41, "Fast 2C first charge", TEAL)

    rounded_box(canvas, (0.665, 0.090), 0.29, 0.095, fc="#fff6df", ec="#d59d22", lw=1.2, radius=0.012)
    canvas.text(0.81, 0.137,
                "Slow formation reaches a heavily delithiated end state;\n"
                "fast formation leaves more residual Li\n"
                "and a less distorted starting state.",
                ha="center", va="center", fontsize=12.3, fontweight="bold", color=TEXT, transform=canvas.transAxes)

    canvas.text(0.92, 0.052, "(c) Winigen Materials - winigenmaterials.com",
                fontsize=11.5, fontweight="bold", color="#8d9ab0", ha="right", transform=canvas.transAxes)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=100, bbox_inches=None, pad_inches=0)
    plt.close(fig)
    print(OUT)


if __name__ == "__main__":
    main()
