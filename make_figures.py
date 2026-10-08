"""
Generates the dissertation figures directly from the physics engine.

Every curve here is computed by calling jones_calculus, so the figures cannot
drift out of step with the code. Run with:

    python make_figures.py

Output: figures/*.png at 300 dpi, sized for a single thesis column.
"""

import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

import jones_calculus as jc

OUT = "figures"
os.makedirs(OUT, exist_ok=True)

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 9,
    "axes.linewidth": 0.8,
    "axes.grid": True,
    "grid.alpha": 0.25,
    "grid.linewidth": 0.5,
    "figure.dpi": 300,
    "savefig.dpi": 300,
    "savefig.bbox": "tight",
})

INK = "#1a1a1a"
S_COL = "#0057b8"   # s-polarization
P_COL = "#c1272d"   # p-polarization


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, facecolor="white")
    plt.close(fig)
    print(f"  wrote {path}")


# ---------------------------------------------------------------------------
# Figure 3.1 — System architecture and data flow
# ---------------------------------------------------------------------------
def fig_3_1():
    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    ax.set_xlim(0, 10); ax.set_ylim(0, 6)
    ax.axis("off"); ax.grid(False)

    def box(x, y, w, h, title, lines, fc):
        ax.add_patch(FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0.08",
            facecolor=fc, edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, y + h - 0.30, title, ha="center", va="top",
                fontsize=9, fontweight="bold", color=INK)
        for i, ln in enumerate(lines):
            ax.text(x + w / 2, y + h - 0.72 - i * 0.32, ln, ha="center",
                    va="top", fontsize=7.4, color="#333333")

    def arrow(x1, y1, x2, y2, label, above=True):
        ax.add_patch(FancyArrowPatch(
            (x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=11,
            linewidth=0.9, color=INK, shrinkA=0, shrinkB=0))
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + (0.16 if above else -0.34),
                label, ha="center", fontsize=6.9, color="#444444", style="italic")

    box(0.2, 3.3, 3.0, 2.3, "Presentation Tier",
        ["React + Vite", "react-three-fiber", "(WebGL / Three.js)",
         "sliders, presets, 3-D scene"], "#eaf2fb")
    box(6.8, 3.3, 3.0, 2.3, "Computation Tier",
        ["FastAPI + Uvicorn", "Pydantic validation", "NumPy complex128",
         "POST /simulate"], "#fdeeee")
    box(6.8, 0.35, 3.0, 2.2, "Physics Engine",
        ["jones_calculus.py", "Fresnel equations", "Transfer Matrix Method",
         "birefringent retarder"], "#f2f2f2")
    box(0.2, 0.35, 3.0, 2.2, "Validation Suite",
        ["validate.py", "5 analytical benchmarks", "make_figures.py",
         "(no browser required)"], "#f2f2f2")

    arrow(3.25, 4.95, 6.75, 4.95,
          "JSON request: mode, n, d, $\\lambda$, $\\theta$", above=True)
    arrow(6.75, 3.95, 3.25, 3.95,
          "response: complex $E_x$, $E_y$, $R_s$, $R_p$", above=False)
    arrow(8.3, 3.25, 8.3, 2.6, "", above=True)
    ax.text(8.42, 2.92, "calls", fontsize=6.9, color="#444444", style="italic")
    arrow(6.75, 1.45, 3.25, 1.45, "imports directly (no HTTP)", above=True)

    ax.text(5.0, 5.85, "Decoupled architecture: the physics engine is importable "
                       "and testable without the browser",
            ha="center", fontsize=7.6, style="italic", color="#555555")
    save(fig, "fig_3_1_architecture.png")


# ---------------------------------------------------------------------------
# Figure 4.1 — Reflectance response of the anti-reflection benchmark
# ---------------------------------------------------------------------------
def fig_4_1():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.8, 2.9))

    n0, n_sub = 1.0, 1.52
    n_ideal = np.sqrt(n0 * n_sub)
    lam0 = 500.0
    d_ideal = lam0 / (4 * n_ideal)
    R_bare = ((n0 - n_sub) / (n0 + n_sub)) ** 2

    # (a) R vs wavelength at fixed quarter-wave thickness
    lams = np.linspace(400, 800, 500)
    for n_f, d, lab, col, ls in [
        (n_ideal, d_ideal, f"ideal $n_f=\\sqrt{{n_s}}$={n_ideal:.3f}", S_COL, "-"),
        (1.38, lam0 / (4 * 1.38), "MgF$_2$, $n_f$=1.38", "#e08b00", "--"),
        (2.00, lam0 / (4 * 2.00), "SnO$_2$, $n_f$=2.00", P_COL, "-."),
    ]:
        R = [abs(jc.thin_film_reflection_matrix(n0, n_f, n_sub, d, l, 0.0)[0][0]) ** 2
             for l in lams]
        ax1.plot(lams, np.array(R) * 100, ls, color=col, lw=1.3, label=lab)

    ax1.axhline(R_bare * 100, color="#666666", lw=1.0, ls=":",
                label=f"uncoated ({R_bare*100:.2f}%)")
    ax1.axvline(lam0, color="#999999", lw=0.7, ls="-", zorder=0)
    ax1.annotate(f"design $\\lambda_0$ = {lam0:.0f} nm", xy=(lam0, 22.5),
                 xytext=(578, 23.7), fontsize=6.6, color="#555555", va="center",
                 arrowprops=dict(arrowstyle="->", lw=0.6, color="#777777"))
    ax1.set_xlabel("Wavelength $\\lambda$ (nm)")
    ax1.set_ylabel("Reflectance $R_s$ (%)")
    ax1.set_title("(a) Spectral response at $\\lambda_0/4$", fontsize=8.5)
    ax1.set_ylim(0, 26)
    ax1.legend(fontsize=6.2, framealpha=0.95, loc="center right")

    # (b) R vs physical thickness at the design wavelength
    ds = np.linspace(0, 400, 600)
    for n_f, lab, col, ls in [
        (n_ideal, f"ideal $n_f$={n_ideal:.3f}", S_COL, "-"),
        (1.38, "MgF$_2$", "#e08b00", "--"),
        (2.00, "SnO$_2$", P_COL, "-."),
    ]:
        R = [abs(jc.thin_film_reflection_matrix(n0, n_f, n_sub, d, lam0, 0.0)[0][0]) ** 2
             for d in ds]
        ax2.plot(ds, np.array(R) * 100, ls, color=col, lw=1.3, label=lab)

    ax2.axhline(R_bare * 100, color="#666666", lw=1.0, ls=":")
    ax2.plot([d_ideal], [0], "o", ms=4.5, mfc="white", mec=S_COL, mew=1.2, zorder=5)
    ax2.annotate(f"$d=\\lambda_0/4n_f$ = {d_ideal:.1f} nm,  $R_s$ = 0 exactly",
                 xy=(d_ideal, 0.3), xytext=(18, 23.7), fontsize=6.6, color="#333333",
                 va="center",
                 arrowprops=dict(arrowstyle="->", lw=0.6, color="#777777",
                                 connectionstyle="arc3,rad=-0.2"))
    ax2.set_xlabel("Film thickness $d$ (nm)")
    ax2.set_ylabel("Reflectance $R_s$ (%)")
    ax2.set_title(f"(b) Thickness sweep at $\\lambda$ = {lam0:.0f} nm", fontsize=8.5)
    ax2.set_ylim(0, 26)
    ax2.legend(fontsize=6.2, framealpha=0.95, loc="center right")

    fig.tight_layout()
    save(fig, "fig_4_1_ar_reflectance.png")


# ---------------------------------------------------------------------------
# Figure 4.3 — Quarter-wave plate conversion to circular polarization (file fig_4_2_*)
# ---------------------------------------------------------------------------
def fig_4_2():
    angles = [0, 15, 30, 45]
    fig, axes = plt.subplots(1, 4, figsize=(6.8, 2.1))

    E_in = jc.horizontal_linear()
    t = np.linspace(0, 2 * np.pi, 400)

    for ax, a in zip(axes, angles):
        M = jc.quarter_waveplate(np.radians(a))
        out = jc.normalize(M @ E_in)
        Ex, Ey = complex(out[0][0]), complex(out[1][0])

        x = abs(Ex) * np.cos(t + np.angle(Ex))
        y = abs(Ey) * np.cos(t + np.angle(Ey))

        ax.plot(x, y, color=S_COL, lw=1.4)
        # Arrowheads along the curve show the sense of rotation (handedness).
        ax.plot(x[0], y[0], "o", ms=3.0, color=P_COL, zorder=6)
        for k in (0, 100, 200, 300):
            ax.annotate("", xy=(x[k + 12], y[k + 12]), xytext=(x[k], y[k]),
                        arrowprops=dict(arrowstyle="-|>", lw=0.9, color=P_COL,
                                        mutation_scale=9), zorder=5)

        ax.set_xlim(-1.15, 1.15); ax.set_ylim(-1.15, 1.15)
        ax.set_aspect("equal")
        ax.axhline(0, color="#bbbbbb", lw=0.5, zorder=0)
        ax.axvline(0, color="#bbbbbb", lw=0.5, zorder=0)
        ax.set_xticks([-1, 0, 1]); ax.set_yticks([-1, 0, 1])
        ax.tick_params(labelsize=6.5)

        dphi = np.degrees(np.angle(Ey) - np.angle(Ex))
        ratio = min(abs(Ex), abs(Ey)) / max(abs(Ex), abs(Ey), 1e-12)
        if ratio < 0.02:
            state = "linear"
        elif abs(abs(dphi) - 90) < 1 and abs(ratio - 1) < 0.01:
            state = "circular"
        else:
            state = "elliptical"
        ax.set_title(f"$\\theta$ = {a}$^\\circ$\n{state}", fontsize=7.4)
        ax.set_xlabel("$E_x$", fontsize=7)
        if a == 0:
            ax.set_ylabel("$E_y$", fontsize=7)

    fig.suptitle("Horizontally polarized input through a quarter-wave plate, "
                 "fast axis rotated by $\\theta$", fontsize=8, y=1.04)
    fig.tight_layout()
    save(fig, "fig_4_2_qwp_ellipses.png")


# ---------------------------------------------------------------------------
# Figure 4.4 — Thin-film interference: AR versus HR (file fig_4_3_*)
# ---------------------------------------------------------------------------
def fig_4_3():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.8, 2.9))
    n0, n_sub, lam0 = 1.0, 1.52, 550.0
    R_bare = ((n0 - n_sub) / (n0 + n_sub)) ** 2

    # (a) reflectance versus angle of incidence, both polarizations
    angs = np.linspace(0, 89, 400)
    for n_f, d, lab, col in [
        (1.38, lam0 / (4 * 1.38), "MgF$_2$ AR", S_COL),
        (2.00, lam0 / (4 * 2.00), "SnO$_2$ HR", P_COL),
    ]:
        Rs, Rp = [], []
        for a in angs:
            M = jc.thin_film_reflection_matrix(n0, n_f, n_sub, d, lam0, np.radians(a))
            Rs.append(abs(M[0][0]) ** 2)
            Rp.append(abs(M[1][1]) ** 2)
        ax1.plot(angs, np.array(Rs) * 100, "-", color=col, lw=1.3, label=f"{lab}  $R_s$")
        ax1.plot(angs, np.array(Rp) * 100, "--", color=col, lw=1.1, label=f"{lab}  $R_p$")

    ax1.axhline(R_bare * 100, color="#666666", lw=0.9, ls=":",
                label=f"uncoated ({R_bare*100:.1f}%)")
    ax1.set_xlabel("Angle of incidence $\\theta_i$ (deg)")
    ax1.set_ylabel("Reflectance (%)")
    ax1.set_title("(a) Angular response, $\\lambda/4$ films", fontsize=8.5)
    ax1.set_ylim(0, 60)
    ax1.legend(fontsize=6.0, framealpha=0.95, loc="upper left")

    # (b) the Brewster benchmark, uncoated interface
    n_glass = 1.62
    theta_b = np.degrees(np.arctan(n_glass / n0))
    Rs, Rp = [], []
    for a in angs:
        M = jc.fresnel_reflection_matrix(n0, n_glass, np.radians(a))
        Rs.append(abs(M[0][0]) ** 2)
        Rp.append(abs(M[1][1]) ** 2)
    ax2.plot(angs, np.array(Rs) * 100, "-", color=S_COL, lw=1.4, label="$R_s$")
    ax2.plot(angs, np.array(Rp) * 100, "-", color=P_COL, lw=1.4, label="$R_p$")
    ax2.axvline(theta_b, color="#666666", lw=0.8, ls="--")
    ax2.plot([theta_b], [0], "o", ms=4.5, mfc="white", mec=P_COL, mew=1.2, zorder=5)
    ax2.annotate(f"$\\theta_B$ = {theta_b:.2f}$^\\circ$\n$R_p \\to 0$",
                 xy=(theta_b, 0), xytext=(22, 26), fontsize=6.8, color="#333333",
                 arrowprops=dict(arrowstyle="->", lw=0.6, color="#777777"))
    ax2.set_xlabel("Angle of incidence $\\theta_i$ (deg)")
    ax2.set_ylabel("Reflectance (%)")
    ax2.set_title(f"(b) Brewster extinction, air $\\to$ $n$ = {n_glass}", fontsize=8.5)
    ax2.set_ylim(0, 100)
    ax2.legend(fontsize=6.6, framealpha=0.95, loc="upper left")

    fig.tight_layout()
    save(fig, "fig_4_3_interference_and_brewster.png")


# ---------------------------------------------------------------------------
# Figure 4.2 — TMM validated against the analytic Airy formula (file fig_4_4_*)
# ---------------------------------------------------------------------------
def fig_4_4():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.8, 2.7))
    n0, nf, ns, lam = 1.0, 2.0, 1.52, 550.0
    ds = np.linspace(0, 500, 400)

    r01 = (n0 - nf) / (n0 + nf)
    r12 = (nf - ns) / (nf + ns)

    tmm, airy = [], []
    for d in ds:
        delta = 2 * np.pi / lam * nf * d
        airy.append((r01 + r12 * np.exp(-2j * delta)) /
                    (1 + r01 * r12 * np.exp(-2j * delta)))
        tmm.append(jc.thin_film_reflection_matrix(n0, nf, ns, d, lam, 0.0)[0][0])
    tmm, airy = np.array(tmm), np.array(airy)

    ax1.plot(ds, np.abs(airy) ** 2 * 100, "-", color="#999999", lw=3.0,
             label="analytic Airy formula")
    ax1.plot(ds, np.abs(tmm) ** 2 * 100, "--", color=S_COL, lw=1.2,
             label="Transfer Matrix Method")
    ax1.set_xlabel("Film thickness $d$ (nm)")
    ax1.set_ylabel("Reflectance $R_s$ (%)")
    ax1.set_title("(a) Reflectance agreement", fontsize=8.5)
    ax1.legend(fontsize=6.4, framealpha=0.95)

    # Phase is unwrapped so the curve reads as continuous; the raw arg() output
    # jumps by 360 deg each time it crosses the branch cut at +/-180 deg.
    ax2.plot(ds, np.degrees(np.unwrap(np.angle(airy))), "-", color="#999999",
             lw=3.0, label="analytic Airy formula")
    ax2.plot(ds, np.degrees(np.unwrap(np.angle(tmm))), "--", color=P_COL,
             lw=1.2, label="Transfer Matrix Method")
    ax2.set_xlabel("Film thickness $d$ (nm)")
    ax2.set_ylabel("Reflected phase $\\arg(r_s)$, unwrapped (deg)")
    ax2.set_title("(b) Phase agreement (sign-convention test)", fontsize=8.5)
    ax2.legend(fontsize=6.4, framealpha=0.95)

    worst = np.max(np.abs(tmm - airy))
    fig.suptitle(f"Maximum deviation across the sweep: "
                 f"$\\max|r_{{TMM}} - r_{{Airy}}|$ = {worst:.2e}",
                 fontsize=7.6, y=1.03)
    fig.tight_layout()
    save(fig, "fig_4_4_tmm_vs_airy.png")


if __name__ == "__main__":
    print("Generating figures from the physics engine...")
    fig_3_1()
    fig_4_1()
    fig_4_2()
    fig_4_3()
    fig_4_4()
    print("Done.")
