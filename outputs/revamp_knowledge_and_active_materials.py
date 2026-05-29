import html
import json
import re
from pathlib import Path

import pandas as pd
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path(r"C:\Users\xw198\Downloads")
TODAY = "2026-05-28"
BASE_URL = "https://www.winigenmaterials.com"


ARTICLE_FILES = {
    "Electrolyte Additives for SEI and CEI.docx": {
        "slug": "electrolyte-additives-sei-cei",
        "title": "Electrolyte Additives for SEI, CEI, Silicon Anodes, and High-Voltage Cathodes",
        "eyebrow": "Electrolyte Additives",
        "description": "Learn how FEC, VC, sulfur-containing additives, nitrile additives, and phosphorus-containing additives affect SEI formation, CEI stability, gas generation, impedance growth, and cycle life in advanced lithium batteries.",
        "about": "Electrolyte additives for SEI and CEI formation",
        "related": [
            ("Electrolyte additives family", "../products/electrolyte-additives.html"),
            ("Custom electrolyte formulations", "../products/custom-electrolyte-formulations.html"),
            ("LiFSI electrolyte guide", "lifsi-lithium-metal-batteries.html"),
            ("Low-temperature electrolyte guide", "low-temperature-electrolytes.html"),
        ],
        "faqs": [
            ("Why are electrolyte additives used in small concentrations?", "Small additive levels can strongly influence SEI formation, CEI stability, gas generation, impedance growth, and cycle life."),
            ("Are SEI and CEI additives interchangeable?", "No. Additives should be screened against the anode, cathode, voltage window, salt, solvent blend, and formation protocol used in the target cell."),
            ("Which additives are relevant for silicon-rich anodes?", "FEC, VC, sulfur-containing additives, phosphorus-containing additives, nitriles, and blended additive packages are commonly evaluated for silicon-rich anode systems."),
        ],
        "headings": {
            "Why Electrolyte Additives Matter",
            "SEI Additives for Graphite, Silicon, and Lithium-Metal Anodes",
            "CEI Additives for High-Voltage Cathodes",
            "Additives for Transition-Metal Dissolution and Electrode Cross-Talk",
            "How to Screen Electrolyte Additives",
            "Practical Screening Metrics",
            "Practical Screening Notes",
            "Bottom Line",
        },
        "further": [
            "FEC and VC are widely studied for silicon-anode and graphite-anode SEI control, but their impact depends strongly on the electrode design and electrolyte formulation.",
            "High-voltage cathode additive studies emphasize CEI stability, electrolyte oxidation control, and transition-metal dissolution as linked full-cell failure modes.",
        ],
        "references": [
            ("Xu et al., Improved Performance of the Silicon Anode for Li-Ion Batteries: Understanding the Surface Modification Mechanism of Fluoroethylene Carbonate as an Effective Electrolyte Additive, Chemistry of Materials, 2015.", "https://pubs.acs.org/doi/10.1021/acs.chemmater.5b00339"),
            ("Klein et al., Re-evaluating common electrolyte additives for high-voltage lithium ion batteries, Cell Reports Physical Science, 2021.", "https://cris.uni-muenster.de/portal/en/publication/80195434"),
            ("Hou et al., Recent Advances in Electrolytes for High-Voltage Cathodes of Lithium-Ion Batteries, Transactions of Tianjin University, 2023.", "https://link.springer.com/article/10.1007/s12209-023-00355-0"),
            ("Zhang et al., Challenges of film-forming additives in low-temperature lithium-ion batteries: A review, Journal of Power Sources, 2024.", "https://www.sciencedirect.com/science/article/pii/S0378775324005111"),
        ],
    },
    "LiFSI for Lithium-Metal Batteries, Fast Charge, and Low-Temperature Electrolytes.docx": {
        "slug": "lifsi-lithium-metal-batteries",
        "title": "LiFSI for Lithium-Metal Batteries, Fast Charge, and Low-Temperature Electrolytes",
        "eyebrow": "LiFSI Electrolytes",
        "description": "Learn why LiFSI is used in lithium-metal, fast-charge, low-temperature, and high-concentration battery electrolytes, including interphase formation, current-collector compatibility, and formulation strategy.",
        "about": "LiFSI electrolyte salt formulation",
        "related": [
            ("LiFSI product page", "../products/lithium-bis-fluorosulfonyl-imide-lifsi.html"),
            ("LiPF6 vs LiFSI vs LiTFSI", "lipf6-vs-lifsi-vs-litfsi.html"),
            ("Lithium salts family", "../products/lithium-salts.html"),
            ("Custom electrolyte formulations", "../products/custom-electrolyte-formulations.html"),
        ],
        "faqs": [
            ("Why is LiFSI used in lithium-metal electrolytes?", "LiFSI can participate in fluorine-rich or inorganic-rich interphase formation and is often evaluated to improve lithium plating and stripping stability."),
            ("Is LiFSI a drop-in replacement for LiPF6?", "No. LiFSI performance depends on solvent structure, concentration, additives, voltage window, and current-collector compatibility."),
            ("What should be screened with LiFSI electrolytes?", "Conductivity, viscosity, impedance growth, coulombic efficiency, aluminum compatibility, gas generation, and cycle retention should be compared against a baseline electrolyte."),
        ],
        "headings": {
            "Why LiFSI Matters for Lithium-Metal Batteries",
            "LiFSI in Fast-Charge Electrolyte Development",
            "LiFSI for Low-Temperature Battery Electrolytes",
            "Key Formulation Variables for LiFSI Electrolytes",
            "Current-Collector Compatibility",
            "Practical Screening Notes",
            "When LiFSI Is a Good Candidate",
            "Bottom Line",
        },
        "further": [
            "Recent lithium-metal electrolyte studies highlight fluorinated and inorganic-rich interphases as important tools for improving lithium-metal reversibility.",
            "Low-temperature Li-metal reviews emphasize conductivity, desolvation energy, charge-transfer kinetics, and lithium plating risk as coupled formulation targets.",
        ],
        "references": [
            ("Fan et al., Highly Fluorinated Interphases Enable High-Voltage Li-Metal Batteries, Chem, 2018.", "https://www.sciencedirect.com/science/article/pii/S245192941730445X"),
            ("Sun et al., Electrolyte Design for Low-Temperature Li-Metal Batteries: Challenges and Prospects, Nano-Micro Letters, 2023.", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10687327/"),
            ("Zhao et al., Electrolyte engineering for highly inorganic solid electrolyte interphase in high-performance lithium metal batteries, Chem, 2023.", "https://www.sciencedirect.com/science/article/pii/S2451929423000229"),
            ("Tong et al., The rise of lithium bis(fluorosulfonyl) imide: An efficient alternative to LiPF6 and functional additive in electrolytes, Materials Today, 2025.", "https://www.sciencedirect.com/science/article/pii/S1369702125000677"),
        ],
    },
    "LiPF₆ vs LiFSI vs LiTFSI.docx": {
        "slug": "lipf6-vs-lifsi-vs-litfsi",
        "title": "LiPF6 vs LiFSI vs LiTFSI: How to Choose Lithium Electrolyte Salts for Battery Development",
        "eyebrow": "Lithium Salt Comparison",
        "description": "Compare LiPF6, LiFSI, and LiTFSI for lithium-ion, lithium-metal, fast-charge, low-temperature, polymer, and specialty electrolyte development.",
        "about": "Lithium electrolyte salt comparison",
        "related": [
            ("LiPF6 product page", "../products/lithium-hexafluorophosphate-lipf6.html"),
            ("LiFSI product page", "../products/lithium-bis-fluorosulfonyl-imide-lifsi.html"),
            ("LiTFSI product page", "../products/lithium-bis-trifluoromethane-sulphonyl-imide-litfsi.html"),
            ("Lithium salts family", "../products/lithium-salts.html"),
        ],
        "faqs": [
            ("Which lithium salt is the baseline for conventional lithium-ion electrolytes?", "LiPF6 remains the common carbonate-electrolyte baseline because it balances conductivity, graphite compatibility, and aluminum passivation."),
            ("When is LiFSI attractive?", "LiFSI is often evaluated for lithium-metal, fast-charge, low-temperature, high-concentration, and interphase-focused formulations."),
            ("Where is LiTFSI most useful?", "LiTFSI is common in polymer, gel, ionic-liquid, lithium-metal, and specialty electrolyte research, but aluminum corrosion must be considered in many high-voltage systems."),
        ],
        "headings": {
            "Where LiPF₆ Fits",
            "Why LiFSI Is Used in Advanced Electrolytes",
            "Where LiTFSI Is Useful",
            "How to Compare Lithium Salts",
            "When to Use Co-Salt Systems",
            "Practical Selection Notes",
            "Bottom Line",
        },
        "further": [
            "Low-temperature electrolyte reviews connect salt choice with solvent melting point, lithium-ion affinity, viscosity, conductivity, and interfacial kinetics.",
            "LiFSI and LiTFSI studies repeatedly emphasize that aluminum compatibility depends on concentration, solvent coordination, additives, and voltage window.",
        ],
        "references": [
            ("Eshetu et al., LiFSI vs. LiPF6 electrolytes in contact with lithiated graphite: Comparing thermal stabilities and identification of specific SEI-reinforcing additives, Electrochimica Acta, 2013.", "https://www.sciencedirect.com/science/article/pii/S0013468613006105"),
            ("Tong et al., The rise of lithium bis(fluorosulfonyl) imide: An efficient alternative to LiPF6 and functional additive in electrolytes, Materials Today, 2025.", "https://www.sciencedirect.com/science/article/pii/S1369702125000677"),
            ("Sun et al., Electrolyte Design for Low-Temperature Li-Metal Batteries: Challenges and Prospects, Nano-Micro Letters, 2023.", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10687327/"),
            ("Fan et al., Highly Fluorinated Interphases Enable High-Voltage Li-Metal Batteries, Chem, 2018.", "https://www.sciencedirect.com/science/article/pii/S245192941730445X"),
        ],
    },
    "Low Temperature Electrolytes.docx": {
        "slug": "low-temperature-electrolytes",
        "title": "Low-Temperature Electrolyte Design for Battery Research and Extreme Environments",
        "eyebrow": "Low-Temperature Electrolytes",
        "description": "Low-temperature electrolyte design considerations for solvent viscosity, salt selection, lithium plating risk, ionic conductivity, desolvation, and cold-climate battery testing.",
        "about": "Low-temperature battery electrolyte design",
        "related": [
            ("Custom electrolyte formulations", "../products/custom-electrolyte-formulations.html"),
            ("Battery solvents family", "../products/battery-solvents.html"),
            ("LiFSI electrolyte guide", "lifsi-lithium-metal-batteries.html"),
            ("Electrolyte additives guide", "electrolyte-additives-sei-cei.html"),
        ],
        "faqs": [
            ("Why do batteries lose performance at low temperature?", "Low temperature increases electrolyte viscosity, lowers conductivity, slows desolvation and charge transfer, and raises lithium-plating risk during charge."),
            ("Can salt selection alone solve low-temperature performance?", "No. Salt selection must be combined with solvent structure, additive package, water control, and formation protocol."),
            ("What should be measured in low-temperature electrolyte screening?", "Conductivity, viscosity, impedance, lithium plating tendency, gas generation, capacity retention, and recovery after cold exposure should be tracked."),
        ],
        "headings": {
            "Why Low-Temperature Electrolytes Are Difficult",
            "Solvent Design for Low-Temperature Electrolytes",
            "Lithium Salt Selection at Low Temperature",
            "Additives and Interphase Control",
            "Lithium Plating Risk During Cold Charging",
            "How to Screen Low-Temperature Electrolytes",
            "Practical Screening Metrics",
            "Bottom Line",
        },
        "further": [
            "Low-temperature electrolyte design reviews emphasize low melting point, low viscosity, suitable lithium-ion solvation, and favorable interphase chemistry.",
            "Lithium-metal and fast-charge studies connect low-temperature operation with desolvation kinetics, interphase resistance, and lithium plating control.",
        ],
        "references": [
            ("Yang et al., Electrolyte design principles for low-temperature lithium-ion batteries, eScience, 2023.", "https://doi.org/10.1016/j.esci.2023.100170"),
            ("Zhao et al., Low-Temperature Electrolytes for Lithium-Ion Batteries: Current Challenges, Development, and Perspectives, Nano-Micro Letters, 2025.", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12432001/"),
            ("Zhang et al., Challenges of film-forming additives in low-temperature lithium-ion batteries: A review, Journal of Power Sources, 2024.", "https://www.sciencedirect.com/science/article/pii/S0378775324005111"),
            ("Logan and Dahn, Electrolyte Design for Fast-Charging Li-Ion Batteries, Trends in Chemistry, 2020.", "https://doi.org/10.1016/j.trechm.2020.01.011"),
        ],
    },
    "Sodium-Ion Battery Electrolyte Materials.docx": {
        "slug": "sodium-ion-electrolyte-materials",
        "title": "Sodium-Ion Battery Electrolyte Materials: Sodium Salts, Solvents, Additives, and Water Control",
        "eyebrow": "Sodium-Ion Electrolytes",
        "description": "Learn how sodium salts such as NaPF6, NaTFSI, and NaODFB, along with solvents, additives, and water control, affect sodium-ion battery electrolyte performance.",
        "about": "Sodium-ion electrolyte materials",
        "related": [
            ("Next-generation salts family", "../products/next-generation-salts.html"),
            ("NaPF6 product page", "../products/sodium-hexafluorophosphate-napf-6.html"),
            ("NaTFSI product page", "../products/sodium-bis-trifluoromethanesulfonyl-imide-natfsi.html"),
            ("Custom electrolyte formulations", "../products/custom-electrolyte-formulations.html"),
        ],
        "faqs": [
            ("Which sodium salt is a common sodium-ion baseline?", "NaPF6 is commonly used as a sodium-ion electrolyte baseline, especially in carbonate-based systems."),
            ("Why is water control important for sodium-ion electrolytes?", "Trace water can change salt stability, promote HF formation in NaPF6 systems, affect gas behavior, and reduce test reproducibility."),
            ("Are ether solvents relevant to sodium-ion batteries?", "Yes. Ether-based sodium-ion electrolytes are actively studied, but oxidative stability, safety, and cost must be evaluated for the target cell."),
        ],
        "headings": {
            "Sodium Salt Selection for Sodium-Ion Batteries",
            "Solvent Systems for Sodium-Ion Electrolytes",
            "Additive Screening for Sodium-Ion Batteries",
            "Why Water Control Matters in Sodium-Ion Electrolytes",
            "Practical Sodium-Ion Electrolyte Screening Notes",
            "Bottom Line",
        },
        "further": [
            "Recent sodium-ion salt studies compare NaPF6 and NaClO4 for practical process compatibility and cell performance.",
            "Sodium-ion electrolyte additive reviews emphasize interphase control, gas behavior, impedance growth, and full-cell screening.",
        ],
        "references": [
            ("Barnes et al., A non-aqueous sodium hexafluorophosphate-based electrolyte degradation study: Formation and mitigation of hydrofluoric acid, Journal of Power Sources, 2020.", "https://www.osti.gov/pages/biblio/1593898"),
            ("Zhang et al., Research progress of organic liquid electrolyte for sodium ion battery, Frontiers in Chemistry, 2023.", "https://www.frontiersin.org/journals/chemistry/articles/10.3389/fchem.2023.1253959/full"),
            ("Cheng et al., Reviving ether-based electrolytes for sodium-ion batteries, Energy & Environmental Science, 2025.", "https://pubs.rsc.org/en/content/articlelanding/2025/ee/d5ee00725a"),
            ("Electrolyte salts for large-scale application of sodium-ion batteries: NaPF6 and emerging alternatives, Journal of Power Sources, 2025.", "https://www.sciencedirect.com/science/article/pii/S0378775325013552"),
        ],
    },
    "Solid State Materials.docx": {
        "slug": "solid-state-electrolyte-materials",
        "title": "Solid-State Electrolyte Materials: Sulfide, Oxide, Halide, and Polymer Electrolyte Screening",
        "eyebrow": "Solid-State Materials",
        "description": "Compare sulfide, oxide, halide, polymer, and hybrid solid-state electrolyte materials for battery development, including ionic conductivity, particle size, moisture sensitivity, and interface compatibility.",
        "about": "Solid-state electrolyte material screening",
        "related": [
            ("Solid-state electrolyte family", "../products/solid-state-electrolytes.html"),
            ("Li6PS5Cl product page", "../products/li-6-ps-5-cl-d-50-10-um.html"),
            ("LATP product page", "../products/latp-d-50-0-3-um.html"),
            ("Products catalog", "../products.html"),
        ],
        "faqs": [
            ("Why is ionic conductivity alone not enough?", "Conductivity depends on pellet density, pressure, interface contact, moisture exposure, and whether the reported value is bulk, grain-boundary, or total conductivity."),
            ("Why does particle size matter for solid-state electrolytes?", "Particle size affects powder packing, pellet density, composite cathode contact, processability, and surface-driven side reactions."),
            ("Which solid-state electrolyte families are commonly screened?", "Sulfide, oxide, halide, polymer, and hybrid electrolytes are commonly evaluated, each with different handling, conductivity, and interface tradeoffs."),
        ],
        "headings": {
            "Sulfide Solid-State Electrolytes",
            "Oxide Solid-State Electrolytes",
            "Halide Solid-State Electrolytes",
            "Polymer and Hybrid Solid Electrolytes",
            "What to Compare When Screening Solid-State Electrolyte Powders",
            "Why Ionic Conductivity Alone Is Not Enough",
            "Practical Screening Notes",
            "Bottom Line",
            "References and Further Reading",
            "General Solid-State Electrolyte Screening",
            "Sulfide Solid Electrolytes",
            "Oxide Solid Electrolytes",
            "Halide Solid Electrolytes",
            "Polymer and Hybrid Solid Electrolytes",
        },
        "further": [
            "Solid-state electrolyte reviews emphasize that practical screening should report particle size, pellet density, stack pressure, electronic conductivity, and interface conditions.",
            "Sulfide, oxide, halide, and polymer electrolyte families each require different moisture-control, densification, and interface-engineering strategies.",
        ],
        "references": [
            ("Janek and Zeier, Designing solid-state electrolytes for safe, energy-dense batteries, Nature Reviews Materials, 2020.", "https://www.nature.com/articles/s41578-019-0165-5"),
            ("Miura et al., Liquid-phase syntheses of sulfide electrolytes for all-solid-state lithium battery, Nature Reviews Chemistry, 2019.", "https://www.nature.com/articles/s41570-019-0078-2"),
            ("Dixit et al., Sulfide and Oxide Inorganic Solid Electrolytes for All-Solid-State Li Batteries: A Review, Journal of Electrochemical Energy Conversion and Storage, 2020.", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7466729/"),
            ("Li et al., Sulfide-based composite solid electrolyte films for all-solid-state batteries, Communications Materials, 2024.", "https://www.nature.com/articles/s43246-024-00482-8"),
            ("Song et al., A reflection on polymer electrolytes for solid-state lithium metal batteries, Nature Communications, 2023.", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10423282/"),
        ],
    },
}


ACTIVE_SPECS = {
    ("LFP", "Energy grade, carbon-coated, commercial cell-grade"): {
        "name": "Lithium iron phosphate (LFP) - energy grade",
        "abbr": "LFP",
        "family": "Cathode Active Material",
        "formula": "LiFePO4",
        "composition": "Carbon-coated LiFePO4 olivine cathode powder",
        "specs": ["D50 typically 0.8-2 um", "Tap density typically 0.8-1.3 g/cm3", "Discharge capacity typically >=150 mAh/g", "Moisture typically <=1000 ppm"],
        "use": "Energy-grade LFP is used for safer, lower-cost lithium-ion cells, storage batteries, and cathode formulation screening where cycle life and thermal stability matter.",
    },
    ("LFP", "Power grade, carbon-coated, higher-rate commercial cell-grade"): {
        "name": "Lithium iron phosphate (LFP) - power grade",
        "abbr": "LFP",
        "family": "Cathode Active Material",
        "formula": "LiFePO4",
        "composition": "Carbon-coated LiFePO4 optimized for higher-rate operation",
        "specs": ["D50 typically 0.5-1.5 um", "Carbon-coated power-grade morphology", "Rate-performance grade; confirm target C-rate", "Moisture typically <=1000 ppm"],
        "use": "Power-grade LFP is selected for higher-rate cathode studies, fast-charge screening, and applications where power capability is prioritized over maximum tap density.",
    },
    ("NCA622", "Commercial NCA622 cathode powder"): {
        "name": "Lithium nickel cobalt aluminum oxide (NCA622)",
        "abbr": "NCA622",
        "family": "Cathode Active Material",
        "formula": "LiNi0.6Co0.2Al0.2O2",
        "composition": "Layered nickel cobalt aluminum cathode powder",
        "specs": ["D50 typically 10-15 um for secondary particles", "Tap density typically >=2.0 g/cm3", "Residual lithium commonly controlled by grade", "Moisture typically <=500 ppm"],
        "use": "NCA622 is used in high-energy cathode screening where nickel-rich layered oxide behavior, surface coating, and electrolyte compatibility need evaluation.",
    },
    ("NCA811", "Commercial NCA811 cathode powder"): {
        "name": "Lithium nickel cobalt aluminum oxide (NCA811)",
        "abbr": "NCA811",
        "family": "Cathode Active Material",
        "formula": "LiNi0.8Co0.1Al0.1O2",
        "composition": "High-nickel layered NCA cathode powder",
        "specs": ["D50 commonly 10-15 um for polycrystalline grades", "Tap density typically >=2.0 g/cm3", "High-nickel grade; coating/doping to be confirmed", "Moisture typically <=500 ppm"],
        "use": "NCA811 is evaluated for high-energy cathode systems where electrolyte oxidation, gas generation, and thermal stability must be carefully controlled.",
    },
    ("LCO", "High-voltage / standard LCO to be selected"): {
        "name": "Lithium cobalt oxide (LCO)",
        "abbr": "LCO",
        "family": "Cathode Active Material",
        "formula": "LiCoO2",
        "composition": "Layered lithium cobalt oxide cathode powder",
        "specs": ["D50 typically 10-18 um", "Tap density commonly >=2.5 g/cm3", "Standard or high-voltage grade available by request", "Moisture typically <=500 ppm"],
        "use": "LCO is used for consumer-electronics cathode studies, high-voltage electrolyte screening, and benchmark layered oxide formulations.",
    },
    ("NMC622", "Commercial NMC622 cathode powder"): {
        "name": "Lithium nickel manganese cobalt oxide (NMC622)",
        "abbr": "NMC622",
        "family": "Cathode Active Material",
        "formula": "LiNi0.6Mn0.2Co0.2O2",
        "composition": "Layered nickel manganese cobalt cathode powder",
        "specs": ["D50 typically 10-15 um", "Tap density typically >=2.0 g/cm3", "Single-crystal or polycrystalline grade by request", "Moisture typically <=500 ppm"],
        "use": "NMC622 provides a balanced high-energy cathode platform for electrolyte screening, surface-coating studies, and Li-ion cell development.",
    },
    ("NMC811", "Commercial NMC811 cathode powder"): {
        "name": "Lithium nickel manganese cobalt oxide (NMC811)",
        "abbr": "NMC811",
        "family": "Cathode Active Material",
        "formula": "LiNi0.8Mn0.1Co0.1O2",
        "composition": "High-nickel layered NMC cathode powder",
        "specs": ["D50 commonly 10-15 um for secondary-particle grades", "Tap density typically >=2.1 g/cm3", "Residual Li commonly <=0.5 wt% by grade", "Moisture typically <=500 ppm"],
        "use": "NMC811 is used for high-energy cell research where electrolyte stability, CEI formation, gas generation, and thermal behavior are key screening concerns.",
    },
    ("LMFP", "Energy grade LMFP"): {
        "name": "Lithium manganese iron phosphate (LMFP) - energy grade",
        "abbr": "LMFP",
        "family": "Cathode Active Material",
        "formula": "LiMnxFe1-xPO4",
        "composition": "Carbon-coated manganese iron phosphate cathode powder",
        "specs": ["Mn/Fe ratio to be confirmed by target grade", "D50 typically 0.8-2 um", "Higher voltage than LFP; capacity grade-dependent", "Moisture typically <=1000 ppm"],
        "use": "Energy-grade LMFP is evaluated as a higher-voltage phosphate cathode material for improved energy density while retaining LFP-like safety advantages.",
    },
    ("LMFP", "Power grade LMFP"): {
        "name": "Lithium manganese iron phosphate (LMFP) - power grade",
        "abbr": "LMFP",
        "family": "Cathode Active Material",
        "formula": "LiMnxFe1-xPO4",
        "composition": "Power-grade carbon-coated LMFP cathode powder",
        "specs": ["Mn/Fe ratio to be confirmed", "Particle morphology tuned for rate capability", "Rate-performance grade; confirm target C-rate", "Moisture typically <=1000 ppm"],
        "use": "Power-grade LMFP supports cathode studies targeting a balance of phosphate safety, elevated voltage, and improved rate performance.",
    },
    ("LMO", "Commercial LMO cathode powder"): {
        "name": "Lithium manganese oxide (LMO)",
        "abbr": "LMO",
        "family": "Cathode Active Material",
        "formula": "LiMn2O4",
        "composition": "Spinel lithium manganese oxide cathode powder",
        "specs": ["D50 typically 8-15 um", "Tap density commonly >=1.8 g/cm3", "Specific capacity typically 100-120 mAh/g", "Moisture typically <=500 ppm"],
        "use": "LMO is used for spinel cathode screening, cost-sensitive lithium-ion studies, rate-performance evaluation, and LMO/NMC blend development.",
    },
    ("Graphite", "Ordinary graphite, commercial anode grade"): {
        "name": "Graphite anode material - standard grade",
        "abbr": "Graphite",
        "family": "Anode Active Material",
        "formula": "C",
        "composition": "Natural or artificial graphite anode powder, grade to be confirmed",
        "specs": ["D50 typically 10-20 um", "Tap density typically >=1.0 g/cm3", "Reversible capacity typically 340-360 mAh/g", "First-cycle efficiency commonly >=90%"],
        "use": "Standard graphite is used for lithium-ion anode formulation, baseline electrode development, and electrolyte compatibility screening.",
    },
    ("Graphite", "High-power graphite"): {
        "name": "Graphite anode material - high-power grade",
        "abbr": "Graphite",
        "family": "Anode Active Material",
        "formula": "C",
        "composition": "High-power graphite anode powder",
        "specs": ["Particle-size distribution tuned for rate capability", "D50 commonly 8-16 um", "Tap density and coating grade to be confirmed", "First-cycle efficiency commonly >=90%"],
        "use": "High-power graphite is used for fast-charge, high-rate, and power-oriented lithium-ion anode screening.",
    },
    ("Graphite", "Ultra-high-power graphite"): {
        "name": "Graphite anode material - ultra-high-power grade",
        "abbr": "Graphite",
        "family": "Anode Active Material",
        "formula": "C",
        "composition": "Ultra-high-power graphite anode powder",
        "specs": ["Rate-performance grade; confirm target C-rate", "Particle-size and coating package to be confirmed", "Tap density typically lower than high-density energy grades", "Moisture typically <=500 ppm"],
        "use": "Ultra-high-power graphite supports aggressive rate-capability and fast-charge screening where kinetics are more important than maximum volumetric energy density.",
    },
    ("LTO", "Commercial lithium titanate anode powder"): {
        "name": "Lithium titanate (LTO)",
        "abbr": "LTO",
        "family": "Anode Active Material",
        "formula": "Li4Ti5O12",
        "composition": "Spinel lithium titanate anode powder",
        "specs": ["D50 typically 0.5-2 um", "Specific capacity typically 160-175 mAh/g", "Rate grade and surface area to be confirmed", "Moisture typically <=500 ppm"],
        "use": "LTO is selected for high-power, long-cycle-life, and safer anode systems where higher anode potential is acceptable.",
    },
    ("Hard carbon", "Sodium-ion hard carbon, grade to be confirmed"): {
        "name": "Hard carbon anode material",
        "abbr": "Hard Carbon",
        "family": "Anode Active Material",
        "formula": "C",
        "composition": "Sodium-ion hard carbon anode powder",
        "specs": ["D50 typically 5-12 um", "Reversible sodium capacity commonly 280-330 mAh/g", "Initial coulombic efficiency grade-dependent", "Moisture typically <=500 ppm"],
        "use": "Hard carbon is the leading sodium-ion anode platform and is used for Na-ion full-cell development, electrolyte screening, and formation optimization.",
    },
    ("Silicon", "Silicon powder / nano-Si option"): {
        "name": "Silicon anode powder",
        "abbr": "Si",
        "family": "Anode Active Material",
        "formula": "Si",
        "composition": "Micron or nano silicon powder for anode composite development",
        "specs": ["Nano-Si or micron-Si option by request", "Purity commonly >=99%", "Particle size and oxide layer to be confirmed", "High capacity; expansion management required"],
        "use": "Silicon powder is used for high-capacity anode development, silicon-carbon composites, binder screening, and electrolyte/additive optimization.",
    },
    ("Silicon / SiOx / Si-C", "Battery-grade SiOx or Si-C composite option"): {
        "name": "SiOx / silicon-carbon composite anode material",
        "abbr": "SiOx / Si-C",
        "family": "Anode Active Material",
        "formula": "SiOx / Si-C",
        "composition": "Battery-grade silicon oxide or silicon-carbon composite anode powder",
        "specs": ["Si content and capacity grade by request", "D50 commonly 5-10 um for composite powders", "Initial efficiency and expansion grade-dependent", "Binder compatibility to be confirmed"],
        "use": "SiOx and Si-C composites are used for higher-capacity lithium-ion anodes with more manageable expansion than pure silicon powders.",
    },
}


def esc(text):
    return html.escape(str(text), quote=True)


def slugify(value):
    value = value.lower().replace("/", " ").replace("+", " plus ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def formula_html(text):
    s = esc(text)
    for num in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]:
        s = re.sub(rf"(?<=[A-Za-z\)]){num}(?:\.([0-9]))?", lambda m: f"<sub>{m.group(0)}</sub>", s)
    s = s.replace("LiMnxFe<sub>1</sub>-xPO<sub>4</sub>", "LiMn<sub>x</sub>Fe<sub>1-x</sub>PO<sub>4</sub>")
    s = s.replace("SiOx", "SiO<sub>x</sub>")
    return f'<span class="formula-text">{s}</span>'


def iter_blocks(doc):
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, doc)
        elif child.tag.endswith("}tbl"):
            yield Table(child, doc)


def is_stop_text(text):
    return text.startswith("Suggested SEO Title") or text.startswith("Sources·")


def docx_article_body(file_name, known_headings):
    doc = Document(str(DOWNLOADS / file_name))
    blocks = []
    started = False
    stop = False
    for block in iter_blocks(doc):
        if stop:
            break
        if isinstance(block, Paragraph):
            text = " ".join(block.text.split())
            if not text:
                continue
            # The Word drafts include pasted reference URLs inline after some
            # technical statements. Keep the technical sentence readable on the
            # website and summarize references in the Further Reading section.
            text = re.sub(r"\s*\(https?://.*$", ".", text).replace("..", ".")
            if not started:
                started = True
                continue
            if is_stop_text(text) or text == "Suggested References / Further Reading":
                stop = True
                break
            if text in known_headings:
                blocks.append(f'<section class="article-block"><h2>{esc(text)}</h2>')
            elif text.startswith("Suggested ") or text in {"Your current URL is already good:", "I would keep it.", "A useful internal anchor would be:", "This page should link to:"}:
                continue
            else:
                blocks.append(f"<p>{linkify_inline(esc(text))}</p>")
        else:
            rows = []
            for row in block.rows:
                cells = [" ".join(cell.text.split()) for cell in row.cells]
                if any(cells):
                    rows.append(cells)
            if rows:
                blocks.append(table_html(rows))
    # Close all opened sections by inserting closure before each new section except first.
    out = []
    open_section = False
    for b in blocks:
        if b.startswith('<section class="article-block"'):
            if open_section:
                out.append("</section>")
            open_section = True
        out.append(b)
    if open_section:
        out.append("</section>")
    return "\n".join(out)


def linkify_inline(text):
    return re.sub(r"(https?://[^\s)]+)", r'<a href="\1">\1</a>', text)


def table_html(rows):
    head = rows[0]
    body = rows[1:]
    html_rows = ['<div class="article-table-wrap"><table class="article-table">']
    html_rows.append("<thead><tr>" + "".join(f"<th>{esc(c)}</th>" for c in head) + "</tr></thead>")
    html_rows.append("<tbody>")
    for row in body:
        html_rows.append("<tr>" + "".join(f"<td>{linkify_inline(esc(c))}</td>" for c in row) + "</tr>")
    html_rows.append("</tbody></table></div>")
    return "\n".join(html_rows)


ARTICLE_CSS = """
.article-hero { padding: 78px 0; }
.article-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 34px; align-items: start; }
.article-main, .article-side { background: rgba(255,255,255,.92); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 32px; }
.article-main p { line-height: 1.78; }
.article-main a { color: var(--blue); font-weight: 800; }
.article-block { margin-top: 30px; padding-top: 26px; border-top: 1px solid rgba(18,32,51,.1); }
.article-table-wrap { overflow-x: auto; margin: 20px 0 22px; border: 1px solid rgba(18,32,51,.1); border-radius: 16px; background: #fff; }
.article-table { width: 100%; border-collapse: collapse; min-width: 620px; }
.article-table th { background: #14213d; color: #fff; text-align: left; padding: 13px 15px; font-size: 13px; }
.article-table td { padding: 13px 15px; border-top: 1px solid rgba(18,32,51,.1); color: #2b3950; vertical-align: top; line-height: 1.45; }
.reference-list { display: grid; gap: 12px; padding-left: 22px; margin: 18px 0 0; }
.reference-list li { color: #40516f; line-height: 1.58; padding-left: 4px; }
.reference-list a { color: var(--blue); font-weight: 850; text-decoration: none; }
.reference-list a:hover { text-decoration: underline; }
.related-link-list { display: grid; gap: 10px; margin-top: 16px; }
.related-link-list a { display: block; padding: 12px 14px; border: 1px solid rgba(18,32,51,.1); border-radius: 12px; background: #f8fbff; color: var(--navy); font-weight: 850; text-decoration: none; }
.related-link-list a:hover { color: var(--blue); border-color: rgba(42,102,217,.28); }
.faq-list { display: grid; gap: 12px; max-width: 920px; margin: 0 auto; }
.faq-list details { border: 1px solid var(--border); border-radius: 16px; background: rgba(255,255,255,.9); box-shadow: 0 10px 26px rgba(15,31,77,.06); padding: 18px 20px; }
.faq-list summary { cursor: pointer; color: var(--navy); font-weight: 900; }
.faq-list p { margin: 12px 0 0; }
@media(max-width:900px) { .article-layout { grid-template-columns: 1fr; } .article-main, .article-side { padding: 24px; } }
"""


def header(prefix, active):
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


def article_page(file_name, cfg):
    body = docx_article_body(file_name, cfg["headings"])
    further = "".join(f"<p>{esc(x)}</p>" for x in cfg["further"])
    references = "".join(f'<li><a href="{esc(url)}">{esc(label)}</a></li>' for label, url in cfg.get("references", []))
    related = "".join(f'<a href="{href}">{esc(label)}</a>' for label, href in cfg["related"])
    faq_details = "".join(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in cfg["faqs"])
    faq_schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": f"{BASE_URL}/knowledge/{cfg['slug']}.html#faq",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in cfg["faqs"]],
    }
    article_schema = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "@id": f"{BASE_URL}/knowledge/{cfg['slug']}.html#article",
        "headline": cfg["title"],
        "description": cfg["description"],
        "url": f"{BASE_URL}/knowledge/{cfg['slug']}.html",
        "datePublished": "2026-05-25",
        "dateModified": TODAY,
        "author": {"@id": f"{BASE_URL}/#organization"},
        "publisher": {"@id": f"{BASE_URL}/#organization"},
        "about": cfg["about"],
        "citation": [label for label, _ in cfg.get("references", [])],
        "mainEntityOfPage": f"{BASE_URL}/knowledge/{cfg['slug']}.html",
    }
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "@id": f"{BASE_URL}/knowledge/{cfg['slug']}.html#breadcrumb",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": "Knowledge", "item": f"{BASE_URL}/knowledge.html"},
            {"@type": "ListItem", "position": 3, "name": cfg["title"], "item": f"{BASE_URL}/knowledge/{cfg['slug']}.html"},
        ],
    }
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(cfg['title'])} | Winigen Materials</title>
<meta name="description" content="{esc(cfg['description'])}">
<link rel="canonical" href="{BASE_URL}/knowledge/{cfg['slug']}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
<style>{ARTICLE_CSS}</style>
<script type="application/ld+json">{json.dumps(article_schema, ensure_ascii=False, indent=2)}</script>
<script type="application/ld+json">{json.dumps(faq_schema, ensure_ascii=False, indent=2)}</script>
<script type="application/ld+json">{json.dumps(breadcrumb, ensure_ascii=False, indent=2)}</script>
</head>
<body>
{header('../', 'Knowledge')}
<main>
  <section class="section dark article-hero">
    <div class="container section-title">
      <div class="breadcrumb"><a href="../knowledge.html">Knowledge</a> / {esc(cfg['eyebrow'])}</div>
      <p class="eyebrow">{esc(cfg['eyebrow'])}</p>
      <h1>{esc(cfg['title'])}</h1>
      <p>{esc(cfg['description'])}</p>
    </div>
  </section>
  <section class="section">
    <div class="container article-layout">
      <article class="article-main">
        {body}
        <section class="article-block"><h2>Further Reading</h2>{further}</section>
        <section class="article-block"><h2>References</h2><ol class="reference-list">{references}</ol></section>
      </article>
      <aside class="article-side">
        <p class="eyebrow">Related Pages</p>
        <h2>Continue Reading</h2>
        <p>Connect this technical topic with Winigen Materials product families, product pages, and formulation support.</p>
        <div class="related-link-list">{related}<a href="../knowledge.html">Knowledge Center</a></div>
      </aside>
    </div>
  </section>
  <section class="section" id="faq">
    <div class="container">
      <div class="section-title"><p class="eyebrow">FAQ</p><h2>Common Questions</h2></div>
      <div class="faq-list">{faq_details}</div>
    </div>
  </section>
</main>
{footer('../')}
<script src="../assets/js/main.js"></script>
</body>
</html>
"""


def read_active_materials():
    p = DOWNLOADS / "Winigen_Battery-NY_Budgetary_Material_Pricing_20260527.xlsx"
    df = pd.read_excel(p, sheet_name="Budgetary Pricing", header=9)
    df = df[df["No."].apply(lambda x: str(x).isdigit() if pd.notna(x) else False)].copy()
    records = []
    for _, row in df.iterrows():
        cat = str(row["Category"])
        if "active material" not in cat.lower():
            continue
        material = str(row["Material"]).strip()
        grade = str(row["Grade / Type"]).strip()
        spec = ACTIVE_SPECS[(material, grade)]
        rec = {**spec}
        rec["source_category"] = cat
        rec["grade"] = grade
        rec["qty"] = str(row["Suggested First-Pass Qty"])
        rec["documentation"] = str(row["Documentation"])
        rec["notes"] = "" if pd.isna(row["Notes / Clarification Needed"]) else str(row["Notes / Clarification Needed"])
        rec["slug"] = slugify(rec["name"])
        records.append(rec)
    return records


def rfq_form(product, prefix):
    specs = "; ".join(product["specs"])
    return f"""
    <form class="product-card__rfq" action="{prefix}contact.html" method="get">
      <input type="hidden" name="inquiry_type" value="Request for Quote">
      <input type="hidden" name="product_interest" value="{esc(product['name'])}">
      <input type="hidden" name="category" value="{esc(product['family'])}">
      <input type="hidden" name="specs" value="{esc(specs)}">
      <input type="hidden" name="message" value="{esc('I would like to request a quote for ' + product['name'] + '. Product category: ' + product['family'] + '. Target specifications: ' + specs + '.')}">
      <label class="rfq-label" for="qty-{product['slug']}">RFQ quantity</label>
      <div class="product-card__controls">
        <select id="qty-{product['slug']}" name="quantity_scale">
          <option value="100 g">100 g</option>
          <option value="500 g">500 g</option>
          <option value="1 kg">1 kg</option>
          <option value=">1 kg">&gt;1 kg</option>
        </select>
        <button class="btn" type="submit">Request Quote</button>
      </div>
    </form>"""


def active_card(product, prefix):
    specs = "".join(f"<li><strong>{esc(s.split(':')[0]) if ':' in s else 'Spec'}:</strong> {esc(s.split(':', 1)[1].strip()) if ':' in s else esc(s)}</li>" for s in product["specs"])
    search = " ".join([product["family"], product["name"], product["abbr"], product["formula"], product["composition"], " ".join(product["specs"]), product["grade"]]).lower()
    href = f"{prefix}products/{product['slug']}.html" if prefix == "" else f"{product['slug']}.html"
    return f"""
    <article class="product-card" data-product-card data-section="active-materials" data-search="{esc(search)}">
      <div class="product-card__media">
        <a class="product-media-link" href="{href}" aria-label="View details for {esc(product['name'])}">
          <span class="structure-fallback structure-fallback--active">{formula_html(product['formula'])}</span>
        </a>
      </div>
      <div class="product-card__body">
        <div class="product-card__topline">
          <span class="product-card__category">{esc(product['family'])}</span>
          <span class="product-card__abbr">{esc(product['abbr'])}</span>
        </div>
        <h3><a class="product-detail-link" href="{href}">{esc(product['name'])}</a></h3>
        <dl class="product-card__facts"><div><dt>Grade</dt><dd>{esc(product['grade'])}</dd></div><div><dt>Available</dt><dd>RFQ</dd></div></dl>
        <ul class="product-card__properties">{specs}</ul>
        {rfq_form(product, prefix)}
      </div>
    </article>"""


def product_detail_page(product):
    spec_items = "".join(f"<li>{esc(s)}</li>" for s in product["specs"])
    use_cases = [
        product["use"],
        "Requested materials can be quoted for R&D, pilot-scale qualification, or production-scale sourcing after grade, particle-size, documentation, and packaging requirements are confirmed.",
        "Typical supporting documents may include SDS, COA, and TDS depending on supplier lot and requested specification.",
    ]
    use_html = "".join(f"<li>{esc(x)}</li>" for x in use_cases)
    schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": f"{BASE_URL}/products/{product['slug']}.html#product",
        "name": product["name"],
        "category": product["family"],
        "description": product["use"],
        "brand": {"@id": f"{BASE_URL}/#organization"},
        "additionalProperty": [{"@type": "PropertyValue", "name": "Typical specification", "value": s} for s in product["specs"]],
        "offers": {"@type": "Offer", "availability": "https://schema.org/InStock", "priceSpecification": {"@type": "PriceSpecification", "price": "0", "priceCurrency": "USD", "description": "RFQ-based pricing"}},
    }
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": "Products", "item": f"{BASE_URL}/products.html"},
            {"@type": "ListItem", "position": 3, "name": "Battery Active Materials", "item": f"{BASE_URL}/products/battery-active-materials.html"},
            {"@type": "ListItem", "position": 4, "name": product["name"], "item": f"{BASE_URL}/products/{product['slug']}.html"},
        ],
    }
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(product['name'])} | Winigen Materials</title>
<meta name="description" content="{esc(product['use'])}">
<link rel="canonical" href="{BASE_URL}/products/{product['slug']}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
<style>.product-detail-hero {{ padding: 78px 0; }} .product-detail-layout {{ display: grid; grid-template-columns: .9fr 1.1fr; gap: 34px; align-items: start; }} .product-detail-media, .product-detail-main {{ background: rgba(255,255,255,.92); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 32px; }} .product-detail-media {{ display: grid; place-items: center; min-height: 320px; background: radial-gradient(circle at 70% 20%, rgba(184,150,74,.18), transparent 32%), linear-gradient(135deg,#fff 0%,#eef7fc 100%); }} .active-formula-display {{ font-family: Manrope, Inter, sans-serif; font-size: clamp(34px,5vw,64px); font-weight: 900; color: var(--navy); text-align:center; }} .spec-list {{ display:grid; gap:10px; padding:0; list-style:none; }} .spec-list li {{ position:relative; padding-left:24px; line-height:1.55; color:#2b3950; }} .spec-list li::before {{ content:""; position:absolute; left:0; top:10px; width:8px; height:8px; border-radius:50%; background:var(--gold); }} @media(max-width:900px) {{ .product-detail-layout {{ grid-template-columns:1fr; }} }}</style>
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, indent=2)}</script>
<script type="application/ld+json">{json.dumps(breadcrumb, ensure_ascii=False, indent=2)}</script>
</head>
<body>
{header('../', 'Products')}
<main>
  <section class="section dark product-detail-hero"><div class="container section-title"><p class="eyebrow">{esc(product['family'])}</p><h1>{esc(product['name'])}</h1><p>{esc(product['use'])}</p></div></section>
  <section class="section"><div class="container product-detail-layout">
    <div class="product-detail-media"><div class="active-formula-display">{formula_html(product['formula'])}</div></div>
    <article class="product-detail-main">
      <p class="eyebrow">Product Details</p>
      <h2>{esc(product['name'])}</h2>
      <dl class="product-card__facts"><div><dt>Category</dt><dd>{esc(product['family'])}</dd></div><div><dt>Availability</dt><dd>RFQ</dd></div><div><dt>Grade</dt><dd>{esc(product['grade'])}</dd></div><div><dt>Documents</dt><dd>{esc(product['documentation'])}</dd></div></dl>
      <section class="article-block"><h3>Typical Specification</h3><ul class="spec-list">{spec_items}</ul><p>These are typical commercial specification ranges for web guidance only. Final values should be confirmed by grade, supplier lot, COA/TDS, and customer application.</p></section>
      <section class="article-block"><h3>Use Cases</h3><ul class="spec-list">{use_html}</ul></section>
      {rfq_form(product, '../')}
      <p style="margin-top:20px"><a class="btn secondary" href="battery-active-materials.html">Back to Battery Active Materials</a></p>
    </article>
  </div></section>
</main>
{footer('../')}
<script src="../assets/js/main.js"></script>
</body>
</html>"""


def family_page(products):
    cards = "\n".join(active_card(p, prefix="") for p in products).replace('href="products/', 'href="').replace('action="contact.html"', 'action="../contact.html"')
    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "@id": f"{BASE_URL}/products/battery-active-materials.html#family",
        "name": "Battery Active Materials Product Family",
        "numberOfItems": len(products),
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@id": f"{BASE_URL}/products/{p['slug']}.html#product", "name": p["name"], "url": f"{BASE_URL}/products/{p['slug']}.html", "category": p["family"]}}
            for i, p in enumerate(products)
        ],
    }
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Battery Active Materials | Winigen Materials</title>
<meta name="description" content="Cathode and anode active materials from Winigen Materials, including LFP, NMC, NCA, LCO, LMFP, LMO, graphite, LTO, hard carbon, silicon, and SiOx/Si-C materials.">
<link rel="canonical" href="{BASE_URL}/products/battery-active-materials.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
<style>.family-hero {{ padding:78px 0; }} .family-layout {{ display:grid; grid-template-columns:1.05fr .95fr; gap:34px; align-items:stretch; }} .family-card {{ background:rgba(255,255,255,.9); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow); padding:28px; }} .family-list {{ display:grid; gap:12px; margin:18px 0 0; padding:0; list-style:none; }} .family-list li {{ position:relative; padding-left:24px; color:#2b3950; line-height:1.5; }} .family-list li::before {{ content:""; position:absolute; left:0; top:10px; width:8px; height:8px; border-radius:50%; background:var(--gold); }} @media(max-width:1000px) {{ .family-layout {{ grid-template-columns:1fr; }} }}</style>
<script type="application/ld+json">{json.dumps(item_list, ensure_ascii=False, indent=2)}</script>
</head>
<body>
{header('../', 'Products')}
<main>
  <section class="section dark family-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / Battery Active Materials</div><p class="eyebrow">Product Family</p><h1>Battery Active Materials</h1><p>Cathode and anode active materials for lithium-ion, sodium-ion, fast-charge, high-energy, and pilot-scale cell development.</p></div></section>
  <section class="section"><div class="container family-layout"><div class="family-card"><h2>Materials Covered</h2><p>Winigen Materials can support RFQ-based sourcing for cathode and anode powders used in electrode formulation, cell screening, and material down-selection.</p><ul class="family-list"><li>LFP, LMFP, LMO, LCO, NMC, and NCA cathode materials</li><li>Graphite, LTO, hard carbon, silicon, SiOx, and Si-C anode materials</li><li>Typical SDS, COA, and TDS support depending on material and lot</li></ul></div><div class="family-card"><h2>Specification Guidance</h2><p>Values shown on the cards are typical commercial specification ranges. Final quotes should confirm grade, morphology, particle-size distribution, capacity, initial efficiency, moisture, packaging, and documents.</p><a class="btn" href="../contact.html?inquiry_type=Request%20for%20Quote&product_interest=Battery%20active%20materials">Request Active Materials Quote</a></div></div></section>
  <section class="section"><div class="container"><div class="section-title"><p class="eyebrow">Product Family</p><h2>Available Materials</h2></div><div class="product-card-grid">{cards}</div></div></section>
</main>
{footer('../')}
<script src="../assets/js/main.js"></script>
</body>
</html>"""


def active_section(products):
    cards = "\n".join(active_card(p, prefix="") for p in products)
    return f"""
    <section id="active-materials" class="product-section" data-product-section>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Battery Active Materials</p>
          <h2>Cathode & Anode Active Materials</h2>
          <p>RFQ-based cathode and anode powders for lithium-ion, sodium-ion, high-energy, fast-charge, and pilot-scale cell development. Typical commercial specification ranges are shown for initial screening and must be confirmed by grade and lot.</p>
        </div>
        <span class="section-count">{len(products)} materials</span>
      </div>
      <div class="product-card-grid">{cards}</div>
    </section>
"""


def replace_products_catalog(products):
    path = ROOT / "products.html"
    text = path.read_text(encoding="utf-8")
    text = text.replace('<a class="tab" href="#solid-state">Solid-State</a>\n        <a class="tab" href="#next-gen">Next-Gen</a>', '<a class="tab" href="#solid-state">Solid-State</a>\n        <a class="tab" href="#active-materials">Battery Active Materials</a>\n        <a class="tab" href="#next-gen">Next-Gen</a>')
    active_family_card = '<a class="family-hub-card" href="products/battery-active-materials.html"><strong>Battery Active Materials</strong><span>LFP, NMC, NCA, LCO, LMFP, LMO, graphite, LTO, hard carbon, silicon, and SiOx/Si-C materials.</span></a>'
    text = re.sub(r'\s*<a class="family-hub-card" href="products/battery-active-materials\.html"><strong>Battery Active Materials</strong><span>LFP, NMC, NCA, LCO, LMFP, LMO, graphite, LTO, hard carbon, silicon, and SiOx/Si-C materials\.</span></a>', '', text)
    text = text.replace('<a class="family-hub-card" href="products/next-generation-salts.html">', active_family_card + '\n      <a class="family-hub-card" href="products/next-generation-salts.html">', 1)
    marker = '    <section id="next-gen" class="product-section" data-product-section>'
    if 'id="active-materials"' not in text:
        text = text.replace(marker, active_section(products) + "\n" + marker)
    path.write_text(text, encoding="utf-8")


def knowledge_hub():
    cards = []
    pills = []
    for cfg in ARTICLE_FILES.values():
        pills.append(f'<a class="knowledge-pill" href="knowledge/{cfg["slug"]}.html">{esc(cfg["eyebrow"])}</a>')
        cards.append(f"""    <article class="knowledge-card">
      <h2><a href="knowledge/{cfg['slug']}.html">{esc(cfg['title'])}</a></h2>
      <p>{esc(cfg['description'])}</p>
      <div class="related-link-list"><a href="knowledge/{cfg['slug']}.html">Read article</a></div>
    </article>""")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge Center | Winigen Materials</title>
<meta name="description" content="Technical articles on lithium salts, sodium-ion electrolytes, LiFSI and LiPF6 systems, solid-state electrolyte materials, electrolyte additives, and low-temperature battery formulation.">
<link rel="canonical" href="{BASE_URL}/knowledge.html">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
<style>.knowledge-grid {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:32px; margin-top:40px; }} .knowledge-card {{ background:#fff; border-radius:24px; padding:34px; box-shadow:0 12px 34px rgba(15,31,77,.08); border:1px solid rgba(15,31,77,.08); transition:transform .25s ease,box-shadow .25s ease; }} .knowledge-card:hover {{ transform:translateY(-4px); box-shadow:0 20px 48px rgba(15,31,77,.12); }} .knowledge-card h2 {{ min-height:118px; display:flex; align-items:flex-start; margin-bottom:18px; line-height:1.2; }} .knowledge-card h2 a {{ color:inherit; text-decoration:none; }} .knowledge-card h2 a:hover {{ color:var(--blue); }} .knowledge-card p {{ color:#4f5b72; line-height:1.78; }} .knowledge-intro {{ max-width:860px; margin:0 auto; }} .knowledge-pill-row {{ display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin-top:28px; }} .knowledge-pill {{ display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,.14); color:#fff; border:1px solid rgba(255,255,255,.24); border-radius:999px; padding:10px 18px; font-size:.95rem; font-weight:800; text-decoration:none; transition:background .25s ease,transform .25s ease; }} .knowledge-pill:hover {{ background:rgba(255,255,255,.24); color:#fff; transform:translateY(-1px); }} .related-link-list {{ display:grid; gap:10px; margin-top:18px; }} .related-link-list a {{ display:inline-flex; width:fit-content; padding:11px 14px; border:1px solid rgba(18,32,51,.1); border-radius:12px; background:#f8fbff; color:var(--navy); font-weight:850; text-decoration:none; }} @media(max-width:900px) {{ .knowledge-grid {{ grid-template-columns:1fr; }} .knowledge-card h2 {{ min-height:auto; }} }}</style>
</head>
<body>
{header('', 'Knowledge')}
<main>
<section class="section dark"><div class="container section-title knowledge-intro"><h1>Battery Materials Knowledge Center</h1><p>Technical articles on lithium salt selection, sodium-ion electrolytes, LiFSI and LiPF6 electrolyte systems, solid-state electrolyte materials, SEI/CEI additives, and low-temperature battery formulation.</p><div class="knowledge-pill-row">{''.join(pills)}</div></div></section>
<section class="section"><div class="container knowledge-grid">
{chr(10).join(cards)}
</div></section>
</main>
{footer('')}
<script src="assets/js/main.js"></script>
</body>
</html>"""


def update_main_js():
    path = ROOT / "assets/js/main.js"
    text = path.read_text(encoding="utf-8")
    if "Battery Active Materials" not in text:
        text = text.replace("['Solid-State Electrolytes', `${prefix}products/solid-state-electrolytes.html`],", "['Solid-State Electrolytes', `${prefix}products/solid-state-electrolytes.html`],\n          ['Battery Active Materials', `${prefix}products/battery-active-materials.html`],")
    path.write_text(text, encoding="utf-8")


def update_css():
    path = ROOT / "assets/css/style.css"
    text = path.read_text(encoding="utf-8")
    if ".structure-fallback--active" not in text:
        text += "\n.structure-fallback--active { display: grid; font-size: 30px; }\n"
    path.write_text(text, encoding="utf-8")


def update_sitemap():
    html_files = sorted([p for p in ROOT.rglob("*.html") if "outputs" not in p.parts], key=lambda p: str(p.relative_to(ROOT)).replace("\\", "/"))
    priorities = {
        "index.html": "1.0",
        "products.html": "0.95",
        "knowledge.html": "0.8",
        "contact.html": "0.8",
    }
    rows = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in html_files:
        rel = p.relative_to(ROOT).as_posix()
        loc = f"{BASE_URL}/" if rel == "index.html" else f"{BASE_URL}/{rel}"
        pri = priorities.get(rel, "0.9" if rel.startswith("products/") and rel.count("/") == 1 else "0.75")
        rows.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{pri}</priority>\n  </url>")
    rows.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(rows) + "\n", encoding="utf-8")


def update_llms(products):
    path = ROOT / "llms.txt"
    text = path.read_text(encoding="utf-8")
    if "Battery active materials:" not in text:
        text += "\nBattery active materials: Winigen Materials lists RFQ-based cathode and anode active materials including LFP, NMC, NCA, LCO, LMFP, LMO, graphite, LTO, hard carbon, silicon, and SiOx/Si-C composite options. See /products/battery-active-materials.html.\n"
    path.write_text(text, encoding="utf-8")


def main():
    (ROOT / "knowledge").mkdir(exist_ok=True)
    (ROOT / "products").mkdir(exist_ok=True)
    for file_name, cfg in ARTICLE_FILES.items():
        (ROOT / "knowledge" / f"{cfg['slug']}.html").write_text(article_page(file_name, cfg), encoding="utf-8")
    (ROOT / "knowledge.html").write_text(knowledge_hub(), encoding="utf-8")
    products = read_active_materials()
    for p in products:
        (ROOT / "products" / f"{p['slug']}.html").write_text(product_detail_page(p), encoding="utf-8")
    (ROOT / "products" / "battery-active-materials.html").write_text(family_page(products), encoding="utf-8")
    replace_products_catalog(products)
    update_main_js()
    update_css()
    update_sitemap()
    update_llms(products)
    print(json.dumps({"articles": len(ARTICLE_FILES), "active_material_products": len(products)}, indent=2))


if __name__ == "__main__":
    main()
