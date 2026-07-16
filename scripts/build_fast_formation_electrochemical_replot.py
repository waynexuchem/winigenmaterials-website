from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
MPLCONFIG = ROOT / "tmp" / "matplotlib"
MPLCONFIG.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("MPLCONFIGDIR", str(MPLCONFIG))

import matplotlib.pyplot as plt
from matplotlib import patches
import pandas as pd


SRC = ROOT / "literature" / "2026 - Nature Fast formation to reinforce lithium-rich cathodes" / "41586_2025_9553_MOESM2_ESM.xlsx"
OUT = ROOT / "assets" / "images" / "knowledge" / "fast-formation-lithium-rich-cathodes" / "electrochemical-replot.png"

NAVY = "#14213d"
BG = "#edf5fb"
PANEL = "#ffffff"
BORDER = "#a9c9ef"
TEXT = "#14213d"
MUTED = "#53627c"
BLUE = "#2f6fdd"
TEAL = "#0f9488"
PURPLE = "#815ad8"
RED = "#f2384a"
YELLOW = "#fff4d9"
YELLOW_BORDER = "#d59d22"
GRID = "#dbe6f2"


def rounded_box(ax, xy, width, height, fc=PANEL, ec=BORDER, lw=1.2, radius=0.012, z=1):
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


def fig_axes(fig, bg, rect):
    ax_bg = fig.add_axes(rect)
    ax_bg.patch.set_alpha(0)
    ax_bg.set_axis_off()
    rounded_box(ax_bg, (0, 0), 1, 1, fc=PANEL, ec=BORDER, lw=1.2, radius=0.012)
    return ax_bg


def read_charge_profiles():
    df = pd.read_excel(SRC, sheet_name="Fig. 1b", header=None)
    slow = df.iloc[2:, [0, 1]].dropna().astype(float)
    fast = df.iloc[2:, [3, 4]].dropna().astype(float)
    slow.columns = ["x", "v"]
    fast.columns = ["x", "v"]
    slow["li_removed"] = 1.2 - slow["x"]
    fast["li_removed"] = 1.2 - fast["x"]
    slow = slow[(slow["li_removed"] >= 0) & (slow["li_removed"] <= 1.07)].copy()
    fast = fast[(fast["li_removed"] >= 0) & (fast["li_removed"] <= 0.79)].copy()
    return slow, fast


def read_penalty():
    df = pd.read_excel(SRC, sheet_name="Fig. 1d", header=None)
    df = df.iloc[1:, [0, 1, 2]].dropna()
    df.columns = ["label", "irr", "ce"]
    df["irr"] = pd.to_numeric(df["irr"])
    df["ce"] = pd.to_numeric(df["ce"])
    return df


def read_cycling():
    df = pd.read_excel(SRC, sheet_name="Fig. 1e", header=None)
    data = df.iloc[2:, :].apply(pd.to_numeric, errors="coerce")
    names = ["LLO-0.2/0.2", "LLO-0.2/2", "LLO-2/0.2", "LLO-2/2"]
    cols = [0, 3, 6, 9]
    out = {}
    for name, col in zip(names, cols):
        s = data.iloc[:, col].dropna().reset_index(drop=True)
        out[name] = s
    return out


def style_axis(ax, labelsize=11):
    ax.set_facecolor(PANEL)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(TEXT)
    ax.spines["bottom"].set_color(TEXT)
    ax.spines["left"].set_linewidth(1.4)
    ax.spines["bottom"].set_linewidth(1.4)
    ax.tick_params(axis="both", colors=MUTED, labelsize=labelsize, width=1.2, pad=5)
    ax.grid(axis="y", color=GRID, linewidth=1.0)


def panel_a(fig, rect):
    bg = fig_axes(fig, None, rect)
    bg.text(0.025, 0.93, "A. First-charge voltage profile", ha="left", va="top",
            fontsize=15.5, fontweight="bold", color=TEXT, transform=bg.transAxes)
    ax = fig.add_axes([rect[0] + 0.075 * rect[2], rect[1] + 0.155 * rect[3], rect[2] * 0.87, rect[3] * 0.67])

    slow, fast = read_charge_profiles()
    ax.plot(slow["li_removed"], slow["v"], color=BLUE, lw=3.0, label="0.2C charge")
    ax.plot(fast["li_removed"], fast["v"], color=TEAL, lw=3.0, label="2C charge")
    ax.set_xlim(0, 1.10)
    ax.set_ylim(2.75, 5.0)
    ax.set_xticks([0, 0.4, 0.8, 1.1])
    ax.set_yticks([3.0, 4.0, 5.0])
    ax.set_xlabel("Li extracted per formula unit, 1.20 - x", fontsize=12, fontweight="bold",
                  color=MUTED, labelpad=3)
    ax.set_ylabel("Voltage / V", fontsize=12, fontweight="bold", color=MUTED, labelpad=10)
    style_axis(ax, labelsize=11)
    ax.legend(loc="upper right", bbox_to_anchor=(0.985, 1.16), ncol=2, frameon=False,
              fontsize=10.8, handlelength=2.3)

    # Annotation boxes are placed in open regions near the curves, avoiding trace overlap.
    ax.text(0.012, 4.94, "0.79 Li extracted\nLi residual about 0.41",
            ha="left", va="top", fontsize=10.8, fontweight="bold", color=TEAL,
            bbox=dict(boxstyle="round,pad=0.38", fc="#dff5f0", ec="none", alpha=0.76))
    ax.text(0.62, 4.18, "1.07 Li extracted\nLi residual about 0.13",
            ha="left", va="top", fontsize=11.2, fontweight="bold", color=BLUE,
            bbox=dict(boxstyle="round,pad=0.50", fc="#e8f0ff", ec="none", alpha=0.98))


def panel_b(fig, rect):
    bg = fig_axes(fig, None, rect)
    bg.text(0.06, 0.93, "B. First-cycle penalty", ha="left", va="top",
            fontsize=15.5, fontweight="bold", color=TEXT, transform=bg.transAxes)

    # Shift the plotting area slightly right for better optical centering once the
    # left and right y-axis labels are included.
    ax = fig.add_axes([rect[0] + 0.225 * rect[2], rect[1] + 0.255 * rect[3], rect[2] * 0.58, rect[3] * 0.55])
    df = read_penalty()
    labels = ["0.2/0.2", "2/0.2", "0.2/2", "2/2"]
    colors = [BLUE, TEAL, BLUE, TEAL]
    x = range(len(labels))
    ax.bar(x, df["irr"].values, color=colors, width=0.62, zorder=2)
    ax.set_ylim(0, 115)
    ax.set_xticks(list(x), labels)
    ax.set_yticks([0, 50, 100])
    ax.set_ylabel("Irreversible\ncapacity / mAh g$^{-1}$", fontsize=11.5, fontweight="bold",
                  color=TEXT, labelpad=8)
    style_axis(ax, labelsize=10.8)
    for xi, yi in zip(x, df["irr"].values):
        ax.text(xi, yi + 4.5, f"{yi:.0f}", ha="center", va="bottom",
                fontsize=10.8, color=TEXT)

    ax2 = ax.twinx()
    ax2.plot(list(x), df["ce"].values, color=RED, marker="o", lw=2.5, markersize=7.5, zorder=4)
    ax2.set_ylim(60, 95)
    ax2.set_yticks([60, 75, 90])
    ax2.tick_params(axis="y", colors=RED, labelsize=10.8, width=1.2, pad=4)
    ax2.set_ylabel("Coulombic efficiency / %", fontsize=10.8, fontweight="bold",
                   color=RED, rotation=270, labelpad=16)
    ax2.spines["top"].set_visible(False)
    ax2.spines["left"].set_visible(False)
    ax2.spines["right"].set_color(RED)
    ax2.spines["right"].set_linewidth(1.3)

    # Keep the callout below the x tick labels and give the long first line
    # enough horizontal room at responsive display sizes.
    rounded_box(bg, (0.015, 0.018), 0.970, 0.105, fc=YELLOW, ec=YELLOW_BORDER, lw=1.0, radius=0.010)
    bg.text(0.50, 0.070,
            "Initial irreversible capacity does not determine later cycling;\n"
            "first-charge protocol controls the inherited state.",
            ha="center", va="center", fontsize=8.8, fontweight="bold", color=TEXT, transform=bg.transAxes)


def panel_c(fig, rect):
    bg = fig_axes(fig, None, rect)
    bg.text(0.02, 0.93, "C. Cycling after different initial charge/discharge protocols",
            ha="left", va="top", fontsize=15.7, fontweight="bold", color=TEXT, transform=bg.transAxes)

    ax = fig.add_axes([rect[0] + 0.060 * rect[2], rect[1] + 0.160 * rect[3], rect[2] * 0.895, rect[3] * 0.66])
    data = read_cycling()
    cycles = range(1, len(next(iter(data.values()))) + 1)
    ax.plot(cycles, data["LLO-0.2/0.2"], color=BLUE, lw=2.6, label="LLO-0.2/0.2")
    ax.plot(cycles, data["LLO-0.2/2"], color=PURPLE, lw=2.6, ls=(0, (6, 4)), label="LLO-0.2/2")
    ax.plot(cycles, data["LLO-2/0.2"], color=TEAL, lw=2.6, label="LLO-2/0.2")
    ax.plot(cycles, data["LLO-2/2"], color=TEAL, lw=2.6, ls=(0, (6, 4)), label="LLO-2/2")
    ax.set_xlim(1, 200)
    ax.set_ylim(180, 260)
    ax.set_xticks([1, 50, 100, 150, 200])
    ax.set_yticks([190, 220, 250])
    ax.set_xlabel("Cycle number", fontsize=12.4, fontweight="bold", color=MUTED, labelpad=4)
    ax.set_ylabel("Capacity / mAh g$^{-1}$", fontsize=12.4, fontweight="bold", color=MUTED, labelpad=16)
    style_axis(ax, labelsize=11.3)
    ax.legend(loc="upper right", bbox_to_anchor=(0.99, 1.10), ncol=4, frameon=False,
              fontsize=10.8, handlelength=2.4, columnspacing=1.7)

    ax.text(153, 247.2, "LLO-2/0.2: 98.4% retention at cycle 200",
            ha="center", va="center", fontsize=11.2, fontweight="bold", color=TEAL,
            bbox=dict(boxstyle="round,pad=0.55", fc="#dff5f0", ec="#86d4ca", lw=1.0, alpha=0.98))
    ax.text(88, 211.2, "LLO-0.2/0.2: 87.3% retention at cycle 200",
            ha="center", va="center", fontsize=11.2, fontweight="bold", color=PURPLE,
            bbox=dict(boxstyle="round,pad=0.55", fc="#f0eaff", ec="#bda4ff", lw=1.0, alpha=0.98))


def main():
    fig = plt.figure(figsize=(1500 / 100, 900 / 100), dpi=100)
    fig.patch.set_facecolor(BG)

    ax = fig.add_axes([0, 0, 1, 1])
    ax.patch.set_alpha(0)
    ax.set_axis_off()
    header = patches.FancyBboxPatch((0, 0.850), 1, 0.150, boxstyle="round,pad=0.0,rounding_size=0.030",
                                    facecolor=NAVY, edgecolor=NAVY, transform=ax.transAxes)
    ax.add_patch(header)
    ax.text(0.040, 0.932, "Replotted Formation Data: First Charge, Irreversibility,\nand Cycling Memory",
            ha="left", va="center", fontsize=25, fontweight="bold", color="white", transform=ax.transAxes,
            linespacing=0.88)
    ax.text(0.040, 0.878, "Fresh visualization from source data accompanying Fan et al.; plotted in Winigen style",
            ha="left", va="center", fontsize=13.2, color="#d8e2ef", transform=ax.transAxes)

    panel_a(fig, [0.035, 0.485, 0.595, 0.345])
    panel_b(fig, [0.660, 0.485, 0.305, 0.345])
    panel_c(fig, [0.035, 0.085, 0.930, 0.355])

    ax.text(0.925, 0.035, "(c) Winigen Materials - winigenmaterials.com", ha="right", va="center",
            fontsize=10.5, fontweight="bold", color="#8d9ab0", transform=ax.transAxes)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=100, bbox_inches=None, pad_inches=0)
    plt.close(fig)
    print(OUT)


if __name__ == "__main__":
    main()
