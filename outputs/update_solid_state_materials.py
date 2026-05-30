import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://www.winigenmaterials.com"
TODAY = "2026-05-30"


def esc(value):
    return html.escape(str(value), quote=True)


def slugify(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def formula_html(value):
    s = esc(value)
    s = re.sub(r"(?<=[A-Za-z\)])(\d+(?:\.\d+)?)", r"<sub>\1</sub>", s)
    s = s.replace("ClxBr<sub>1.5</sub>-x", "Cl<sub>x</sub>Br<sub>1.5-x</sub>")
    s = s.replace("ClxBry", "Cl<sub>x</sub>Br<sub>y</sub>")
    s = s.replace("Li<sub>1.3</sub>Al<sub>0.3</sub>Ti<sub>1.7</sub>(PO<sub>4</sub>)<sub>3</sub>", "Li<sub>1.3</sub>Al<sub>0.3</sub>Ti<sub>1.7</sub>(PO<sub>4</sub>)<sub>3</sub>")
    return f'<span class="formula-text">{s}</span>'


def header(prefix, active="Products"):
    links = [
        ("Home", prefix),
        ("Products", f"{prefix}products.html"),
        ("Applications", f"{prefix}applications.html"),
        ("Services", f"{prefix}services.html"),
        ("Quality", f"{prefix}quality.html"),
        ("About", f"{prefix}about.html"),
        ("Knowledge", f"{prefix}knowledge.html"),
        ("Contact", f"{prefix}contact.html"),
    ]
    nav = "".join(f'<a{" class=\"active\"" if label == active else ""} href="{href}">{label}</a>' for label, href in links)
    return f"""<header class="header">
  <div class="container nav">
    <a class="logo" href="{prefix}"><img src="{prefix}assets/images/winigen-logo.png" alt="Winigen Materials logo"></a>
    <nav class="nav-links">{nav}</nav>
    <button class="mobile-toggle" aria-label="Open menu">&#9776;</button>
  </div>
  <div class="mobile-menu">{nav}</div>
</header>"""


def footer(prefix):
    return f"""<footer class="footer"><div class="container footer-grid"><div><img src="{prefix}assets/images/winigen-logo.png" alt="Winigen Materials logo"><h3>Winigen Materials</h3><p>Battery Materials & Electrochemical Components</p></div><div><h4>Location</h4><p>New Jersey, USA</p></div><div><h4>Contact</h4><p><a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></p><p><a href="https://www.linkedin.com/company/118914606/">LinkedIn company page</a></p></div></div></footer>"""


def q(product_name):
    return esc(product_name)


PRODUCTS = [
    {
        "name": "LATP powder, D50 0.30 um",
        "short": "LATP",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide",
        "family": "Oxide solid electrolyte powder",
        "slug": "latp-d-50-0-3-um",
        "image": "latp-300nm-powder-photo.jpg",
        "summary": "LATP oxide solid electrolyte powder for cathode blending and lithium-ion battery safety, rate, and cycle-performance screening.",
        "properties": ["Particle size: D50 0.30 +/- 0.05 um", "Water: <= 500 ppm", "Magnetic impurities: <= 500 ppb", "Ionic conductivity: >= 0.55 mS/cm at 25 degC, pressed pellet"],
        "table": [
            ("Appearance", "White powder, no visible foreign matter", "Visual inspection"),
            ("D50 particle size", "0.30 +/- 0.05 um", "Laser particle-size analyzer"),
            ("Water", "<= 500 ppm", "Karl Fischer moisture analyzer"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Ionic conductivity", ">= 0.55 mS/cm", "Pressed-pellet test at 25 degC"),
            ("Use case", "Cathode blending for lithium-ion batteries", "Application guidance"),
        ],
        "media": [("latp-300nm-sem.jpg", "SEM image of LATP powder."), ("latp-300nm-xrd.jpg", "XRD pattern for LATP powder.")],
    },
    {
        "name": "LATP powder, D50 0.40 um",
        "short": "LATP",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide",
        "family": "Oxide solid electrolyte powder",
        "slug": "latp-d-50-0-4-um",
        "image": "latp-400nm-powder-photo.jpg",
        "summary": "LATP oxide solid electrolyte powder for separator, current-collector, and electrode coating studies.",
        "properties": ["Particle size: D50 0.40 +/- 0.10 um", "Water: <= 500 ppm", "Magnetic impurities: <= 500 ppb", "Ionic conductivity: >= 0.5 mS/cm at 25 degC, pressed pellet"],
        "table": [
            ("Appearance", "White powder, no visible foreign matter", "Visual inspection"),
            ("D50 particle size", "0.40 +/- 0.10 um", "Laser particle-size analyzer"),
            ("Water", "<= 500 ppm", "Karl Fischer moisture analyzer"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Ionic conductivity", ">= 0.5 mS/cm", "Pressed-pellet test at 25 degC"),
            ("Use case", "Separator, current-collector, or electrode coating", "Application guidance"),
        ],
        "media": [("latp-400nm-sem.jpg", "SEM image of LATP powder."), ("latp-400nm-xrd.jpg", "XRD pattern for LATP powder.")],
    },
    {
        "name": "LATP powder, D50 0.65 um",
        "short": "LATP",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide",
        "family": "Oxide solid electrolyte powder",
        "slug": "latp-d-50-0-65-um",
        "image": "latp-600nm-powder-photo.jpg",
        "summary": "LATP oxide solid electrolyte powder with broader particle size for coating and solid-electrolyte screening workflows.",
        "properties": ["Particle size: D50 0.65 +/- 0.15 um", "Water: <= 500 ppm", "Magnetic impurities: <= 500 ppb", "Ionic conductivity: >= 0.3 mS/cm at 25 degC, pressed pellet"],
        "table": [
            ("Appearance", "White powder, no visible foreign matter", "Visual inspection"),
            ("D50 particle size", "0.65 +/- 0.15 um", "Laser particle-size analyzer"),
            ("Water", "<= 500 ppm", "Karl Fischer moisture analyzer"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Ionic conductivity", ">= 0.3 mS/cm", "Pressed-pellet test at 25 degC"),
            ("Use case", "Separator, current-collector, or electrode coating", "Application guidance"),
        ],
        "media": [("latp-600nm-sem.jpg", "SEM image of LATP powder."), ("latp-600nm-xrd.jpg", "XRD pattern for LATP powder.")],
    },
    {
        "name": "LATP water-based slurry, D50 0.65 um",
        "short": "LATP slurry",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide Slurry",
        "family": "Water-based oxide solid electrolyte slurry",
        "slug": "latp-water-based-slurry-d-50-0-65-um",
        "image": "latp-water-slurry-photo.jpg",
        "summary": "Water-based LATP slurry for separator coating and aqueous process development.",
        "properties": ["Particle size: D50 0.65 +/- 0.15 um", "Solid content: target +/- process range", "Viscosity: <= 80 mPa.s", "pH: 5-9"],
        "table": [
            ("Appearance", "White slurry, uniform color", "Visual inspection"),
            ("D50 particle size", "0.65 +/- 0.15 um", "Laser particle-size analyzer"),
            ("Solid content", "Target value -0.5% to +1.5%; typical range 20-40%", "Solid-content test"),
            ("Viscosity", "<= 80 mPa.s", "Viscometer"),
            ("pH", "5-9", "pH meter"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Use case", "Lithium-ion battery separator coating", "Application guidance"),
        ],
        "media": [],
    },
    {
        "name": "LATP water-based slurry, D50 0.30 um",
        "short": "LATP slurry",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide Slurry",
        "family": "Water-based oxide solid electrolyte slurry",
        "slug": "latp-water-based-slurry-d-50-0-30-um",
        "image": "latp-water-slurry-photo.jpg",
        "summary": "Water-based LATP slurry with fine particle size for separator coating studies.",
        "properties": ["Particle size: D50 0.30 +/- 0.05 um", "Solid content: target +/- process range", "Viscosity: <= 80 mPa.s", "pH: 5-9"],
        "table": [
            ("Appearance", "White slurry, uniform color", "Visual inspection"),
            ("D50 particle size", "0.30 +/- 0.05 um", "Laser particle-size analyzer"),
            ("Solid content", "Target value -0.5% to +1.5%; typical range 20-40%", "Solid-content test"),
            ("Viscosity", "<= 80 mPa.s", "Viscometer"),
            ("pH", "5-9", "pH meter"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Use case", "Lithium-ion battery separator coating", "Application guidance"),
        ],
        "media": [],
    },
    {
        "name": "LATP water-based slurry, D50 0.15 um",
        "short": "LATP slurry",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide Slurry",
        "family": "Water-based oxide solid electrolyte slurry",
        "slug": "latp-water-based-slurry-d-50-0-15-um",
        "image": "latp-water-slurry-photo.jpg",
        "summary": "Water-based LATP slurry for current-collector and electrode coating applications.",
        "properties": ["Particle size: D50 0.15 +/- 0.05 um", "Solid content: target +/- process range", "Viscosity: <= 80 mPa.s", "pH: 5-9"],
        "table": [
            ("Appearance", "White slurry, uniform color", "Visual inspection"),
            ("D50 particle size", "0.15 +/- 0.05 um", "Laser particle-size analyzer"),
            ("Solid content", "Target value -0.5% to +1.5%; typical range 20-40%", "Solid-content test"),
            ("Viscosity", "<= 80 mPa.s", "Viscometer"),
            ("pH", "5-9", "pH meter"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Use case", "Current-collector or electrode coating", "Application guidance"),
        ],
        "media": [],
    },
    {
        "name": "LATP oil-based slurry, D50 0.65 um",
        "short": "LATP slurry",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide Slurry",
        "family": "Oil-based oxide solid electrolyte slurry",
        "slug": "latp-oil-based-slurry-d-50-0-65-um",
        "image": "latp-oil-slurry-photo.jpg",
        "summary": "Oil-based LATP slurry for cathode current-collector coating development.",
        "properties": ["Particle size: D50 0.65 +/- 0.15 um", "Solid content: target +/- process range", "Water: <= 500 ppm", "pH: 8-12"],
        "table": [
            ("Appearance", "White slurry, uniform color", "Visual inspection"),
            ("D50 particle size", "0.65 +/- 0.15 um", "Laser particle-size analyzer"),
            ("Solid content", "Target value -0.5% to +1.5%; typical range 20-40%", "Solid-content test"),
            ("Water", "<= 500 ppm", "Karl Fischer moisture analyzer"),
            ("Viscosity", "<= 80 mPa.s", "Viscometer"),
            ("pH", "8-12", "pH meter"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Use case", "Cathode current-collector coating", "Application guidance"),
        ],
        "media": [],
    },
    {
        "name": "LATP oil-based slurry, D50 0.30 um",
        "short": "LATP slurry",
        "formula": "Li1.3Al0.3Ti1.7(PO4)3",
        "category": "Solid-State Oxide Slurry",
        "family": "Oil-based oxide solid electrolyte slurry",
        "slug": "latp-oil-based-slurry-d-50-0-30-um",
        "image": "latp-oil-slurry-photo.jpg",
        "summary": "Oil-based LATP slurry for current-collector and electrode coating development.",
        "properties": ["Particle size: D50 0.30 +/- 0.05 um", "Solid content: target +/- process range", "Water: <= 500 ppm", "pH: 8-12"],
        "table": [
            ("Appearance", "White slurry, uniform color", "Visual inspection"),
            ("D50 particle size", "0.30 +/- 0.05 um", "Laser particle-size analyzer"),
            ("Solid content", "Target value -0.5% to +1.5%; typical range 20-40%", "Solid-content test"),
            ("Water", "<= 500 ppm", "Karl Fischer moisture analyzer"),
            ("Viscosity", "<= 80 mPa.s", "Viscometer"),
            ("pH", "8-12", "pH meter"),
            ("Magnetic impurities", "<= 500 ppb", "ICP-OES"),
            ("Use case", "Current-collector or electrode coating", "Application guidance"),
        ],
        "media": [],
    },
    {
        "name": "LLZTO powder",
        "short": "LLZTO",
        "formula": "Li6.5La3Zr1.5Ta0.5O12",
        "category": "Solid-State Oxide",
        "family": "Garnet oxide solid electrolyte powder",
        "slug": "llzto-powder",
        "image": "llzto-powder-photo.jpg",
        "summary": "LLZTO garnet-type oxide solid electrolyte powder. Particle-size customization is available for research and process-development needs.",
        "properties": ["Particle size: customizable", "Garnet-type oxide solid electrolyte", "Available as powder for solid-state battery screening"],
        "table": [
            ("Appearance", "White to off-white powder", "Visual inspection"),
            ("Composition", "Ta-doped LLZO / LLZTO", "Formula guidance"),
            ("Particle size", "Customizable by request", "Project specification"),
            ("Use case", "Garnet electrolyte screening, composite electrolyte studies, and coating development", "Application guidance"),
        ],
        "media": [("llzto-sem.jpg", "SEM image of LLZTO powder."), ("llzto-xrd.jpg", "XRD pattern for LLZTO powder.")],
    },
]


def sulfide_product(name, formula, slug, image, particle, ionic, electronic, category, table=None, media=None, summary=None):
    base_table = table or [
        ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
        ("Particle size", particle, "Laser particle-size analysis"),
        ("Water", "Lot-dependent; confirm by COA/TDS", "Moisture analyzer"),
        ("Ionic conductivity", ionic, "Electrochemical workstation, cold-pressed pellet"),
        ("Electronic conductivity", electronic, "Electrochemical workstation"),
    ]
    return {
        "name": name,
        "short": formula,
        "formula": formula,
        "category": category,
        "family": "Sulfide solid electrolyte powder",
        "slug": slug,
        "image": image,
        "summary": summary or f"{name} is a sulfide solid electrolyte powder for cold-press conductivity screening, composite cathode studies, and solid-state battery research.",
        "properties": [f"Particle size: {particle}", f"Electronic: {electronic}", f"Ionic: {ionic}"],
        "table": base_table,
        "media": media or [],
    }


PRODUCTS += [
    sulfide_product(
        "Li5.5PS4.5Cl1.5, D50 >10 um", "Li5.5PS4.5Cl1.5", "li-5-5-ps-4-5-cl-1-5-d-50-10-um", "sulfide-sample-photo.jpg",
        "D50 >10 um", ">10 mS/cm, cold press", "<= 10^-6 mS/cm", "Solid-State Sulfide"),
    sulfide_product(
        "Li5.5PS4.5Cl1.5, D50 4.5 +/- 1.5 um", "Li5.5PS4.5Cl1.5", "li-5-5-ps-4-5-cl-1-5-d-50-5-um", "sulfide-sample-photo.jpg",
        "D50 4.5 +/- 1.5 um", ">5 mS/cm, cold press", "<= 10^-6 mS/cm", "Solid-State Sulfide"),
    sulfide_product(
        "Li5.5PS4.5Cl1.5, D50 2.168 um", "Li5.5PS4.5Cl1.5", "li-5-5-ps-4-5-cl-1-5-d-50-2-um", "sulfide-sample-photo.jpg",
        "D10 0.567 um; D50 2.168 um; D90 6.592 um", "8.5 mS/cm, cold press", "1.38 x 10^-6 mS/cm", "Solid-State Sulfide",
        table=[
            ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
            ("D10 particle size", "0.567 um", "Laser particle-size analyzer"),
            ("D50 particle size", "2.168 um", "Laser particle-size analyzer"),
            ("D90 particle size", "6.592 um", "Laser particle-size analyzer"),
            ("Water", "28.8 ppm", "Moisture analyzer"),
            ("Elemental impurities", "Ca 9.64 ppm; Cr 4.41 ppm; Cu ND; Fe 7.53 ppm; Mg 2.56 ppm; Na 11.38 ppm; K 1.75 ppm; Si 33.9 ppm; Zn 4.98 ppm", "ICP"),
            ("Ionic conductivity", "8.5 mS/cm", "Electrochemical workstation"),
            ("Electronic conductivity", "1.38 x 10^-6 mS/cm", "Electrochemical workstation"),
        ],
        media=[
            ("li55ps45cl15-d50-2um-dls.jpg", "Particle-size distribution for the D50 2.168 um sulfide powder."),
            ("li55ps45cl15-d50-2um-xrd-clean.jpg", "XRD pattern with internal product-code label removed."),
            ("li55ps45cl15-d50-2um-sem.jpg", "SEM image representative of the fine sulfide powder morphology."),
        ]),
    sulfide_product(
        "Li5.5PS4.5Cl1.5, D50 0.925 um", "Li5.5PS4.5Cl1.5", "li-5-5-ps-4-5-cl-1-5-d-50-1-um", "sulfide-sample-photo.jpg",
        "D10 0.474 um; D50 0.925 um; D90 2.019 um", "6.2 mS/cm, cold press", "1.67 x 10^-6 mS/cm", "Solid-State Sulfide",
        table=[
            ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
            ("D10 particle size", "0.474 um", "Laser particle-size analyzer"),
            ("D50 particle size", "0.925 um", "Laser particle-size analyzer"),
            ("D90 particle size", "2.019 um", "Laser particle-size analyzer"),
            ("Water", "17 ppm", "Moisture analyzer"),
            ("Elemental impurities", "Ca 10.59 ppm; Cr 2.7 ppm; Cu ND; Fe 7.56 ppm; Mg 2.39 ppm; Na 19.23 ppm; K 1.2 ppm; Si 39.68 ppm; Zn 6.23 ppm", "ICP"),
            ("Ionic conductivity", "6.2 mS/cm", "Electrochemical workstation"),
            ("Electronic conductivity", "1.67 x 10^-6 mS/cm", "Electrochemical workstation"),
        ],
        media=[
            ("li55ps45cl15-d50-1um-dls.jpg", "Particle-size distribution for the D50 0.925 um sulfide powder."),
            ("li55ps45cl15-d50-1um-xrd-clean.jpg", "XRD pattern with internal product-code label removed."),
        ]),
    sulfide_product(
        "Li6PS5Cl, D50 >10 um", "Li6PS5Cl", "li-6-ps-5-cl-d-50-10-um", "sulfide-sample-photo.jpg",
        "D50 >10 um", ">4 mS/cm, cold press", "<= 10^-6 mS/cm", "Solid-State Sulfide"),
    sulfide_product(
        "Li6PS5Cl, D50 4.5 +/- 1.5 um", "Li6PS5Cl", "li-6-ps-5-cl-d-50-5-um", "sulfide-sample-photo.jpg",
        "D50 4.5 +/- 1.5 um", ">4 mS/cm, cold press", "<= 10^-6 mS/cm", "Solid-State Sulfide"),
    sulfide_product(
        "Li6PS5Cl, D50 2.123 um", "Li6PS5Cl", "li-6-ps-5-cl-d-50-2-um", "sulfide-sample-photo.jpg",
        "D10 0.555 um; D50 2.123 um; D90 6.573 um", "3.5 mS/cm, cold press", "1.74 x 10^-6 mS/cm", "Solid-State Sulfide",
        table=[
            ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
            ("D10 particle size", "0.555 um", "Laser particle-size analyzer"),
            ("D50 particle size", "2.123 um", "Laser particle-size analyzer"),
            ("D90 particle size", "6.573 um", "Laser particle-size analyzer"),
            ("Water", "43 ppm", "Moisture analyzer"),
            ("Elemental impurities", "Ca 20.45 ppm; Cr 2.517 ppm; Cu ND; Fe 9.656 ppm; Mg 2.146 ppm; Na 7.591 ppm; K 1.783 ppm; Si 8.257 ppm; Zn 2.673 ppm", "ICP"),
            ("Ionic conductivity", "3.5 mS/cm", "Electrochemical workstation"),
            ("Electronic conductivity", "1.74 x 10^-6 mS/cm", "Electrochemical workstation"),
        ],
        media=[
            ("li6ps5cl-d50-2um-dls.jpg", "Particle-size distribution for the D50 2.123 um sulfide powder."),
            ("li6ps5cl-d50-2um-xrd-clean.jpg", "XRD pattern with internal product-code label removed."),
        ]),
    sulfide_product(
        "Li6PS5Cl, D50 0.734 um", "Li6PS5Cl", "li-6-ps-5-cl-d-50-1-um", "sulfide-sample-photo.jpg",
        "D10 0.445 um; D50 0.734 um; D90 1.128 um", "3.1 mS/cm, cold press", "2.04 x 10^-6 mS/cm", "Solid-State Sulfide",
        table=[
            ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
            ("D10 particle size", "0.445 um", "Laser particle-size analyzer"),
            ("D50 particle size", "0.734 um", "Laser particle-size analyzer"),
            ("D90 particle size", "1.128 um", "Laser particle-size analyzer"),
            ("Water", "28.8 ppm", "Moisture analyzer"),
            ("Elemental impurities", "Ca 9.64 ppm; Cr 2.01 ppm; Cu ND; Fe 15.03 ppm; Mg 0.59 ppm; Na 27.61 ppm; K 2.5 ppm; Si 28.26 ppm; Zn 1 ppm", "ICP"),
            ("Ionic conductivity", "3.1 mS/cm", "Electrochemical workstation"),
            ("Electronic conductivity", "2.04 x 10^-6 mS/cm", "Electrochemical workstation"),
        ],
        media=[
            ("li6ps5cl-d50-1um-dls.jpg", "Particle-size distribution for the D50 0.734 um sulfide powder."),
            ("li6ps5cl-d50-1um-xrd-clean.jpg", "XRD pattern with internal product-code label removed."),
        ]),
    sulfide_product(
        "Li5.5PS4.5ClxBr1.5-x, D50 >10 um", "Li5.5PS4.5ClxBr1.5-x", "li-5-5-ps-4-5-cl-x-br-y-d-50-10-um", "sulfide-sample-photo.jpg",
        "D50 >10 um", ">12 mS/cm, cold press", "<= 10^-6 mS/cm", "Solid-State Sulfide"),
    sulfide_product(
        "Li5.5PS4.5ClxBr1.5-x, D50 4.5 +/- 1.5 um", "Li5.5PS4.5ClxBr1.5-x", "li-5-5-ps-4-5-clxbr-1-5-x-d-50-5-um", "sulfide-sample-photo.jpg",
        "D50 4.5 +/- 1.5 um", ">8 mS/cm, cold press", "<= 10^-6 mS/cm", "Solid-State Sulfide"),
    sulfide_product(
        "Li5.5PS4.5ClxBr1.5-x, D50 2.398 um", "Li5.5PS4.5ClxBr1.5-x", "li-5-5-ps-4-5-clxbr-1-5-x-d-50-2-um", "sulfide-sample-photo.jpg",
        "D10 0.623 um; D50 2.398 um; D90 6.559 um", "9.2 mS/cm, cold press", "1.84 x 10^-6 mS/cm", "Solid-State Sulfide",
        table=[
            ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
            ("D10 particle size", "0.623 um", "Laser particle-size analyzer"),
            ("D50 particle size", "2.398 um", "Laser particle-size analyzer"),
            ("D90 particle size", "6.559 um", "Laser particle-size analyzer"),
            ("Water", "21.4 ppm", "Moisture analyzer"),
            ("Elemental impurities", "Ca 17.08 ppm; Cr 3.19 ppm; Cu ND; Fe 4.71 ppm; Mg 2.02 ppm; Na 20.38 ppm; K 4.93 ppm; Si 41.46 ppm; Zn 0.92 ppm", "ICP"),
            ("Ionic conductivity", "9.2 mS/cm", "Electrochemical workstation"),
            ("Electronic conductivity", "1.84 x 10^-6 mS/cm", "Electrochemical workstation"),
        ],
        media=[
            ("li55ps45clxbr15x-d50-2um-dls.jpg", "Particle-size distribution for the D50 2.398 um sulfide powder."),
            ("li55ps45clxbr15x-d50-2um-xrd-clean.jpg", "XRD pattern with internal product-code label removed."),
        ]),
    sulfide_product(
        "Li5.5PS4.5ClxBr1.5-x, D50 0.759 um", "Li5.5PS4.5ClxBr1.5-x", "li-5-5-ps-4-5-clxbr-1-5-x-d-50-1-um", "sulfide-sample-photo.jpg",
        "D10 0.427 um; D50 0.759 um; D90 1.277 um", "6.5 mS/cm, cold press", "2.37 x 10^-6 mS/cm", "Solid-State Sulfide",
        table=[
            ("Appearance", "Gray-white powder, uniform color, no visible agglomeration", "Visual inspection"),
            ("D10 particle size", "0.427 um", "Laser particle-size analyzer"),
            ("D50 particle size", "0.759 um", "Laser particle-size analyzer"),
            ("D90 particle size", "1.277 um", "Laser particle-size analyzer"),
            ("Water", "61.6 ppm", "Moisture analyzer"),
            ("Elemental impurities", "Ca 13.8 ppm; Cr 3.43 ppm; Cu 0.17 ppm; Fe 5.79 ppm; Mg 2.71 ppm; Na 24.92 ppm; K 4.1 ppm; Si 67.62 ppm; Zn 2.7 ppm", "ICP"),
            ("Ionic conductivity", "6.5 mS/cm", "Electrochemical workstation"),
            ("Electronic conductivity", "2.37 x 10^-6 mS/cm", "Electrochemical workstation"),
        ],
        media=[
            ("li55ps45clxbr15x-d50-1um-dls.jpg", "Particle-size distribution for the D50 0.759 um sulfide powder."),
            ("li55ps45clxbr15x-d50-1um-xrd-clean.jpg", "XRD pattern with internal product-code label removed."),
        ]),
    {
        "name": "Li3InCl6 powder, D50 0.9 um",
        "short": "Li3InCl6",
        "formula": "Li3InCl6",
        "category": "Solid-State Halide",
        "family": "Halide solid electrolyte powder",
        "slug": "li-3-incl-6-d-50-0-9-um",
        "image": "li3incl6-powder-photo.jpg",
        "summary": "Li3InCl6 halide solid electrolyte powder for high-purity phase screening, EIS conductivity testing, and solid-state battery research.",
        "properties": ["Particle size: D50 0.9 +/- 0.3 um", "Water: <= 500 ppm", "Ionic conductivity: >= 1.5 mS/cm; measured value 1.85 mS/cm at 25 degC", "Main phase: 04-009-9027 by XRD"],
        "table": [
            ("Appearance", "White powder", "Visual inspection"),
            ("D10 particle size", "0.5 +/- 0.05 um", "Laser particle-size analyzer, dry method"),
            ("D50 particle size", "0.9 +/- 0.3 um", "Laser particle-size analyzer, dry method"),
            ("D90 particle size", "20 +/- 0.2 um", "Laser particle-size analyzer, dry method"),
            ("D99 particle size", "31 +/- 0.3 um", "Laser particle-size analyzer, dry method"),
            ("Water", "<= 500 ppm", "Karl Fischer moisture analyzer"),
            ("Ionic conductivity", ">= 1.5 mS/cm; measured value 1.85 mS/cm at 25 degC after 40 min hold", "EIS"),
            ("Elemental impurities", "Ca <=50 ppm; Cr <=50 ppm; Cu <=50 ppm; Fe <=500 ppm; K <=500 ppm; Mg <=50 ppm; Na <=500 ppm; Zn <=50 ppm; Zr <=50 ppm", "ICP"),
            ("Phase", "Main phase 04-009-9027", "XRD"),
        ],
        "media": [("li3incl6-particle-size.jpg", "Particle-size distribution image with English axis labels.")],
    },
]


ORDER = [
    "Solid-State Oxide",
    "Solid-State Oxide Slurry",
    "Solid-State Sulfide",
    "Solid-State Halide",
]


def product_url(product, href_prefix="products/"):
    return f"{href_prefix}{product['slug']}.html"


def props_html(product):
    rows = []
    for prop in product["properties"]:
        label, _, rest = prop.partition(":")
        if rest:
            cls = ' class="property-highlight"' if "Particle size" in label else ""
            rows.append(f"<li{cls}><strong>{esc(label)}:</strong> {formula_html(rest.strip()) if any(c.isdigit() for c in rest) and any(x in rest for x in ['Li','PS','Cl','PO']) else esc(rest.strip())}</li>")
        else:
            rows.append(f"<li>{esc(prop)}</li>")
    return "".join(rows)


def card(product, href_prefix="products/", asset_prefix="", contact_prefix=""):
    img_src = f"{asset_prefix}assets/images/solid-state/{product['image']}"
    return f"""    <article class="product-card" data-product-card data-section="solid-state" data-search="{esc((product['category'] + ' ' + product['name'] + ' ' + product['formula'] + ' ' + ' '.join(product['properties'])).lower())}">
      <div class="product-card__media">
        <a class="product-media-link" href="{esc(product_url(product, href_prefix))}" aria-label="View details for {esc(product['name'])}">
          <img class="product-photo" src="{esc(img_src)}" alt="{esc(product['name'])} product image" loading="lazy">
        </a>
      </div>
      <div class="product-card__body">
        <div class="product-card__topline">
          <span class="product-card__category">{esc(product['category'])}</span>
          <span class="product-card__abbr">{formula_html(product['short'])}</span>
        </div>
        <h3><a class="product-detail-link" href="{esc(product_url(product, href_prefix))}">{formula_html(product['name'])}</a></h3>
        <dl class="product-card__facts"><div><dt>Available</dt><dd>RFQ</dd></div></dl>
        <ul class="product-card__properties">{props_html(product)}</ul>
        <form class="product-card__rfq" action="{esc(contact_prefix)}contact.html" method="get">
          <input type="hidden" name="inquiry_type" value="Request for Quote">
          <input type="hidden" name="product_interest" value="{q(product['name'])}">
          <input type="hidden" name="category" value="{esc(product['category'])}">
          <input type="hidden" name="message" value="I would like to request a quote for {q(product['name'])}. Product category: {esc(product['category'])}.">
          <label class="rfq-label" for="qty-{esc(product['slug'])}">RFQ Quantity</label>
          <div class="product-card__controls">
            <select id="qty-{esc(product['slug'])}" name="quantity">
              <option value="100 g">100 g</option><option value="1 kg">1 kg</option><option value="5 kg">5 kg</option><option value=">5 kg">&gt;5 kg</option>
            </select>
            <button class="btn" type="submit">Request Quote</button>
          </div>
        </form>
      </div>
    </article>"""


def table_html(product):
    rows = "".join(f"<tr><td>{esc(a)}</td><td>{esc(b)}</td><td>{esc(c)}</td></tr>" for a, b, c in product["table"])
    return f"""<div class="characterization-table-wrap"><table class="characterization-table">
      <thead><tr><th>Parameter</th><th>Specification / Result</th><th>Method</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>"""


def media_html(product):
    figures = []
    for file, cap in product.get("media", []):
        figures.append(f"""<figure><img src="../assets/images/solid-state/{esc(file)}" alt="{esc(cap)}" loading="lazy"><figcaption>{esc(cap)}</figcaption></figure>""")
    return "".join(figures) or f"""<figure><img src="../assets/images/solid-state/{esc(product['image'])}" alt="{esc(product['name'])} product image" loading="lazy"><figcaption>Representative product image from the solid-state materials summary deck.</figcaption></figure>"""


DETAIL_CSS = """
.product-detail-hero { padding: 78px 0; }
.product-detail-hero .section-title { max-width: 940px; }
.product-detail-hero h1 { max-width: 940px; margin-left: auto; margin-right: auto; }
.product-detail-layout { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 34px; align-items: start; }
.structure-panel, .detail-panel { background: rgba(255,255,255,.9); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
.structure-panel { display: grid; place-items: center; min-height: 460px; padding: 34px; background: radial-gradient(circle at 70% 20%, rgba(184,150,74,.16), transparent 34%), linear-gradient(135deg,#fff 0%,#eef7fc 100%); }
.detail-panel { padding: 30px; }
.detail-kicker { color: var(--blue); font-size: 13px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 12px; }
.detail-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
.detail-fact { padding: 15px; border: 1px solid rgba(18,32,51,.1); border-radius: 14px; background: #f8fbff; }
.detail-fact dt { margin-bottom: 5px; color: var(--muted); font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.detail-fact dd { margin: 0; color: var(--text); font-size: 17px; font-weight: 850; overflow-wrap: anywhere; }
.spec-list { display: grid; gap: 10px; margin: 0 0 26px; padding: 0; list-style: none; }
.spec-list li { position: relative; padding-left: 24px; color: #2b3950; line-height: 1.45; }
.spec-list li::before { content: ""; position: absolute; left: 0; top: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); }
.detail-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
.breadcrumb { margin-bottom: 18px; color: rgba(255,255,255,.74); font-weight: 800; }
.breadcrumb a { color: #fff; text-decoration: none; }
.related-note { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(18,32,51,.1); }
@media(max-width:900px) { .product-detail-layout { grid-template-columns: 1fr; } .structure-panel { min-height: 320px; } .detail-facts { grid-template-columns: 1fr; } }
"""


def product_page(product):
    schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": f"{BASE_URL}/products/{product['slug']}.html#product",
        "name": product["name"],
        "description": product["summary"],
        "category": product["category"],
        "image": f"{BASE_URL}/assets/images/solid-state/{product['image']}",
        "brand": {"@id": f"{BASE_URL}/#organization"},
        "offers": {"@type": "Offer", "availability": "https://schema.org/InStock", "priceSpecification": {"@type": "PriceSpecification", "price": "0", "priceCurrency": "USD"}, "url": f"{BASE_URL}/contact.html"},
        "additionalProperty": [{"@type": "PropertyValue", "name": a, "value": b} for a, b, _ in product["table"]],
    }
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "@id": f"{BASE_URL}/products/{product['slug']}.html#breadcrumb",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": "Products", "item": f"{BASE_URL}/products.html"},
            {"@type": "ListItem", "position": 3, "name": "Solid-State Electrolytes", "item": f"{BASE_URL}/products/solid-state-electrolytes.html"},
            {"@type": "ListItem", "position": 4, "name": product["name"], "item": f"{BASE_URL}/products/{product['slug']}.html"},
        ],
    }
    props = "".join(f"<li>{formula_html(p)}</li>" for p in product["properties"])
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(product['name'])} | Winigen Materials</title>
<meta name="description" content="{esc(product['summary'])}">
<link rel="canonical" href="{BASE_URL}/products/{product['slug']}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
<style>{DETAIL_CSS}</style>
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, indent=2)}</script>
<script type="application/ld+json">{json.dumps(breadcrumb, ensure_ascii=False, indent=2)}</script>
</head>
<body>
{header('../', 'Products')}
<main>
  <section class="section dark product-detail-hero">
    <div class="container section-title">
      <div class="breadcrumb"><a href="../products.html">Products</a> / <a href="solid-state-electrolytes.html">Solid-State Electrolytes</a></div>
      <p class="eyebrow">{esc(product['category'])}</p>
      <h1>{formula_html(product['name'])}</h1>
      <p>{esc(product['summary'])}</p>
    </div>
  </section>
  <section class="section">
    <div class="container product-detail-layout">
      <aside class="structure-panel" aria-label="{esc(product['name'])} product image">
        <img class="product-photo" src="../assets/images/solid-state/{esc(product['image'])}" alt="{esc(product['name'])} product image" loading="lazy">
      </aside>
      <article class="detail-panel">
        <p class="detail-kicker">Product Details</p>
        <h2>{formula_html(product['short'])}</h2>
        <p>{esc(product['summary'])}</p>
        <dl class="detail-facts"><div class="detail-fact"><dt>Category</dt><dd>{esc(product['category'])}</dd></div><div class="detail-fact"><dt>Availability</dt><dd>RFQ</dd></div></dl>
        <h3>Typical Specification</h3>
        <ul class="spec-list">{props}</ul>
        <div class="detail-actions"><a class="btn" href="../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest={esc(product['name'].replace(' ', '%20'))}">Request Quote</a><a class="btn secondary" href="solid-state-electrolytes.html">Back to Solid-State Materials</a></div>
        <p class="related-note">Final values should be confirmed by grade, lot, COA/TDS, and intended processing conditions.</p>
      </article>
    </div>
  </section>
  <section class="section product-technical-section">
    <div class="container">
      <div class="section-title"><p class="eyebrow">Characterization</p><h2>Tabular Data & Supporting Images</h2></div>
      <div class="characterization-grid">
        {table_html(product)}
        <div class="characterization-media">{media_html(product)}</div>
      </div>
    </div>
  </section>
</main>
{footer('../')}
<script src="../assets/js/main.js"></script>
</body>
</html>
"""


FAMILY_CSS = """
.family-hero { padding: 78px 0; }
.family-layout { display: grid; grid-template-columns: 1.05fr .95fr; gap: 34px; align-items: stretch; }
.family-card { background: rgba(255,255,255,.9); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 28px; }
.family-list { display: grid; gap: 12px; margin: 18px 0 0; padding: 0; list-style: none; }
.family-list li { position: relative; padding-left: 24px; color: #2b3950; line-height: 1.5; }
.family-list li::before { content: ""; position: absolute; left: 0; top: 10px; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); }
.faq-list { display: grid; gap: 12px; max-width: 920px; margin: 0 auto; }
.faq-list details { border: 1px solid var(--border); border-radius: 16px; background: rgba(255,255,255,.9); box-shadow: 0 10px 26px rgba(15,31,77,.06); padding: 18px 20px; }
.faq-list summary { cursor: pointer; color: var(--navy); font-weight: 900; }
.faq-list p { margin: 12px 0 0; }
@media(max-width:1000px) { .family-layout { grid-template-columns: 1fr; } }
"""


def family_page():
    cards = "\n".join(card(p, href_prefix="", asset_prefix="../", contact_prefix="../") for p in sorted(PRODUCTS, key=lambda p: (ORDER.index(p["category"]) if p["category"] in ORDER else 99, p["name"])))
    schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": f"{BASE_URL}/products/solid-state-electrolytes.html#webpage",
        "url": f"{BASE_URL}/products/solid-state-electrolytes.html",
        "name": "Solid-State Electrolytes",
        "description": "Solid-state electrolyte powders and slurries including LATP, LLZTO, sulfide, and halide materials with particle-size, conductivity, moisture, impurity, SEM, and XRD characterization where available.",
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": len(PRODUCTS),
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{BASE_URL}/products/{p['slug']}.html", "name": p["name"]} for i, p in enumerate(PRODUCTS)],
        },
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": f"{BASE_URL}/products/solid-state-electrolytes.html#faq",
        "mainEntity": [
            {"@type": "Question", "name": "What solid-state electrolyte materials are listed?", "acceptedAnswer": {"@type": "Answer", "text": "Winigen lists oxide powders and slurries, sulfide electrolyte powders, LLZTO, and Li3InCl6 halide electrolyte powder."}},
            {"@type": "Question", "name": "Are particle-size and conductivity data available?", "acceptedAnswer": {"@type": "Answer", "text": "Product pages list particle-size, conductivity, moisture, impurity, and characterization data where available from the source deck."}},
            {"@type": "Question", "name": "Can particle size or slurry formulation be customized?", "acceptedAnswer": {"@type": "Answer", "text": "Several oxide and LLZTO materials can be matched to customer particle-size or formulation requirements; final specifications should be confirmed through RFQ."}},
        ],
    }
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Solid-State Electrolytes | Winigen Materials</title>
<meta name="description" content="Solid-state electrolyte powders and slurries including LATP, LLZTO, sulfide, and Li3InCl6 materials with characterization data.">
<link rel="canonical" href="{BASE_URL}/products/solid-state-electrolytes.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
<style>{FAMILY_CSS}</style>
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, indent=2)}</script>
<script type="application/ld+json">{json.dumps(faq, ensure_ascii=False, indent=2)}</script>
</head>
<body>
{header('../', 'Products')}
<main>
  <section class="section dark family-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / Solid-State Electrolytes</div><p class="eyebrow">Product Family</p><h1>Solid-State Electrolytes</h1><p>Compare oxide powders and slurries, sulfide powders, LLZTO, and halide solid electrolytes with particle-size, conductivity, moisture, impurity, SEM, and XRD data where available.</p></div></section>
  <section class="section"><div class="container family-layout"><article class="family-card"><p class="eyebrow">Technical Scope</p><h2>Oxide, Sulfide & Halide Materials</h2><p>These materials support lithium-ion and solid-state battery research workflows, including separator coating, current-collector coating, cathode blending, pellet pressing, EIS conductivity testing, and composite electrode development.</p><ul class="family-list"><li>LATP powders and water- or oil-based slurries</li><li>LLZTO garnet-type oxide electrolyte powder</li><li>Argyrodite-style sulfide powders with controlled D50 ranges</li><li>Li3InCl6 halide powder with particle-size and conductivity data</li></ul></article><aside class="family-card"><p class="eyebrow">RFQ Support</p><h2>Request Product or Formulation Support</h2><p>Share target chemistry, particle size, conductivity, coating route, quantity, and moisture/handling requirements. Winigen Materials can route the request toward product supply or formulation support.</p><a class="btn" href="../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=Solid-State%20Electrolytes">Request Quote</a></aside></div></section>
  <section class="section"><div class="container"><div class="section-title"><p class="eyebrow">Product Family</p><h2>Available Solid-State Materials</h2></div><div class="product-card-grid">{cards}</div></div></section>
  <section class="section" id="faq"><div class="container"><div class="section-title"><p class="eyebrow">FAQ</p><h2>Common Questions</h2></div><div class="faq-list"><details><summary>What solid-state electrolyte materials are listed?</summary><p>Winigen lists oxide powders and slurries, sulfide electrolyte powders, LLZTO, and Li3InCl6 halide electrolyte powder.</p></details><details><summary>Are particle-size and conductivity data available?</summary><p>Product pages list particle-size, conductivity, moisture, impurity, and characterization data where available from the source deck.</p></details><details><summary>Can particle size or slurry formulation be customized?</summary><p>Several oxide and LLZTO materials can be matched to customer particle-size or formulation requirements; final specifications should be confirmed through RFQ.</p></details></div></div></section>
</main>
{footer('../')}
<script src="../assets/js/main.js"></script>
</body>
</html>"""


def catalog_section():
    cards = "\n".join(card(p, href_prefix="products/", asset_prefix="", contact_prefix="") for p in sorted(PRODUCTS, key=lambda p: (ORDER.index(p["category"]) if p["category"] in ORDER else 99, p["name"])))
    return f"""    <section id="solid-state" class="product-section" data-product-section>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Solid-State Materials</p>
          <h2>Solid-State Materials</h2>
          <p>Solid-state electrolyte powders and slurries including LATP, LLZTO, sulfide, and Li3InCl6 materials. Product pages include translated specification tables and characterization data where available.</p>
        </div>
        <span class="section-count">{len(PRODUCTS)} materials</span>
      </div>
      <div class="product-card-grid">{cards}</div>
    </section>"""


def replace_catalog_section():
    path = ROOT / "products.html"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'    <section id="solid-state" class="product-section" data-product-section>.*?\n    <section id="active-materials"', catalog_section() + "\n\n    <section id=\"active-materials\"", text, flags=re.S)
    text = update_catalog_schema(text)
    path.write_text(text, encoding="utf-8")


def product_list_item(product, position):
    return {
        "@type": "ListItem",
        "position": position,
        "item": {
            "@type": "Product",
            "name": product["name"],
            "category": product["category"],
            "brand": {"@id": f"{BASE_URL}/#organization"},
            "url": f"{BASE_URL}/products/{product['slug']}.html",
            "image": f"{BASE_URL}/assets/images/solid-state/{product['image']}",
            "description": product["summary"],
            "additionalProperty": [
                {"@type": "PropertyValue", "name": "Availability", "value": "RFQ"},
                *[
                    {"@type": "PropertyValue", "name": a, "value": b}
                    for a, b, _ in product["table"]
                ],
            ],
            "offers": {
                "@type": "Offer",
                "availability": "https://schema.org/InStock",
                "url": f"{BASE_URL}/contact.html",
                "description": "Pricing available by request for quote.",
            },
        },
    }


def update_catalog_schema(text):
    pattern = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
    matches = list(pattern.finditer(text))
    for m in matches:
        raw = m.group(1)
        try:
            data = json.loads(raw)
        except Exception:
            continue
        objects = data if isinstance(data, list) else [data]
        changed = False
        for obj in objects:
            if obj.get("@type") == "CollectionPage" and obj.get("@id") == f"{BASE_URL}/products.html#webpage":
                item_list = obj.get("mainEntity", {})
                old_items = item_list.get("itemListElement", [])
                remaining = [
                    item for item in old_items
                    if not item.get("item", {}).get("category", "").startswith("Solid-State")
                ]
                new_items = [product_list_item(p, i + 1) for i, p in enumerate(PRODUCTS)]
                combined = new_items + remaining
                for idx, item in enumerate(combined, start=1):
                    item["position"] = idx
                item_list["itemListElement"] = combined
                item_list["numberOfItems"] = len(combined)
                obj["description"] = "Searchable Winigen Materials product catalog covering expanded solid-state electrolyte powders and slurries, battery active materials, next-generation salts, lithium salts, solvents, additives, and custom electrolyte formulations."
                changed = True
        if changed:
            replacement = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, indent=2) + '</script>'
            return text[:m.start()] + replacement + text[m.end():]
    return text


def update_sitemap():
    path = ROOT / "sitemap.xml"
    html_files = []
    for pattern in ("*.html", "products/*.html", "knowledge/*.html"):
        html_files.extend(ROOT.glob(pattern))

    excluded = {"products_old.html"}
    rels = []
    for html_file in html_files:
        rel = html_file.relative_to(ROOT).as_posix()
        if rel in excluded:
            continue
        rels.append(rel)

    def sort_key(rel):
        preferred = {
            "index.html": (0, ""),
            "products.html": (1, ""),
            "products/solid-state-electrolytes.html": (2, ""),
            "products/battery-active-materials.html": (3, ""),
            "knowledge.html": (4, ""),
            "contact.html": (8, ""),
        }
        if rel in preferred:
            return preferred[rel]
        if rel.startswith("products/"):
            return (5, rel)
        if rel.startswith("knowledge/"):
            return (6, rel)
        return (7, rel)

    def priority(rel):
        if rel == "index.html":
            return "1.0"
        if rel == "products.html":
            return "0.95"
        if rel.startswith("products/"):
            return "0.90"
        if rel == "knowledge.html":
            return "0.85"
        if rel.startswith("knowledge/"):
            return "0.80"
        if rel == "contact.html":
            return "0.80"
        return "0.75"

    seen = set()
    entries = []
    for rel in sorted(rels, key=sort_key):
        if rel in seen:
            continue
        seen.add(rel)
        loc = f"{BASE_URL}/" if rel == "index.html" else f"{BASE_URL}/{rel}"
        entries.append(
            "  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{TODAY}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            f"    <priority>{priority(rel)}</priority>\n"
            "  </url>"
        )

    text = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    path.write_text(text, encoding="utf-8")


def main():
    for product in PRODUCTS:
        (ROOT / "products" / f"{product['slug']}.html").write_text(product_page(product), encoding="utf-8")
    (ROOT / "products" / "solid-state-electrolytes.html").write_text(family_page(), encoding="utf-8")
    replace_catalog_section()
    update_sitemap()
    print(json.dumps({"solid_state_products": len(PRODUCTS), "pages_written": len(PRODUCTS) + 1}, indent=2))


if __name__ == "__main__":
    main()
