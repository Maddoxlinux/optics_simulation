"""
Automated validation suite for the optics engine.

Each benchmark compares the engine's numerical output against a classical
analytical result with a known closed form. Run with:

    python validate.py

The printed output is the source of the numbers reported in Chapter 4.
"""

import numpy as np
import jones_calculus as jc

PASS = "PASS"
FAIL = "FAIL"
results = []


def check(name, ok):
    results.append((name, ok))
    print(f"\n  [{PASS if ok else FAIL}] {name}")


def rule(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ---------------------------------------------------------------------------
# BENCHMARK 1 — Polarization state conversion by a quarter-wave plate
# ---------------------------------------------------------------------------
def benchmark_1():
    rule("BENCHMARK 1: Quarter-wave plate converts linear -> circular")

    incoming = jc.horizontal_linear()
    qwp = jc.quarter_waveplate(np.pi / 4)
    out = jc.normalize(qwp @ incoming)

    lcp = jc.left_circular()
    rcp = jc.right_circular()
    err_l = float(np.max(np.abs(out - lcp)))
    err_r = float(np.max(np.abs(out - rcp)))
    matches_lcp = err_l < err_r

    print(f"\n  Input  E_in  = ({incoming[0][0]:.4f}, {incoming[1][0]:.4f})")
    print(f"  QWP fast axis at theta = 45.0 deg, retardance Gamma = pi/2")
    print(f"\n  Output E_out = ({out[0][0]:.6f}, {out[1][0]:.6f})   [global phase removed]")
    print(f"  RCP (1, +i)/sqrt(2) = ({rcp[0][0]:.6f}, {rcp[1][0]:.6f})   max|diff| = {err_r:.3e}")
    print(f"  LCP (1, -i)/sqrt(2) = ({lcp[0][0]:.6f}, {lcp[1][0]:.6f})   max|diff| = {err_l:.3e}")

    # Physical descriptors independent of the handedness naming convention
    ax, ay = abs(out[0][0]), abs(out[1][0])
    dphi = np.angle(out[1][0]) - np.angle(out[0][0])
    print(f"\n  |Ex| = {ax:.6f}, |Ey| = {ay:.6f}, amplitude ratio = {ay/ax:.6f}")
    print(f"  Relative phase delta = {np.degrees(dphi):+.4f} deg")
    print(f"  -> equal amplitudes + 90 deg relative phase = CIRCULAR polarization")
    print(f"  -> handedness matches this module's {'left_circular()' if matches_lcp else 'right_circular()'}")

    err = min(err_l, err_r)
    check("QWP at 45 deg produces circular polarization", err < 1e-12)
    return err


# ---------------------------------------------------------------------------
# BENCHMARK 2 — Extinction of r_p at Brewster's angle
# ---------------------------------------------------------------------------
def benchmark_2():
    rule("BENCHMARK 2: p-polarization extinction at Brewster's angle")

    n1, n2 = 1.0, 1.62          # air -> flint glass
    theta_b = np.arctan(n2 / n1)
    M = jc.fresnel_reflection_matrix(n1, n2, theta_b)
    rs, rp = M[0][0], M[1][1]

    print(f"\n  Interface: air (n1 = {n1}) -> flint glass (n2 = {n2})")
    print(f"  Brewster angle theta_B = arctan(n2/n1) = {np.degrees(theta_b):.4f} deg")
    print(f"\n  r_s = {rs:+.10f}      R_s = |r_s|^2 = {abs(rs)**2:.6f}")
    print(f"  r_p = {rp:+.3e}   R_p = |r_p|^2 = {abs(rp)**2:.3e}")

    # Off-Brewster control: r_p must be clearly non-zero away from theta_B
    off = jc.fresnel_reflection_matrix(n1, n2, theta_b - np.radians(10))
    print(f"\n  Control at theta_B - 10 deg: r_p = {off[1][1]:+.6f}  (non-zero, as expected)")

    # Index sweep: the residual must stay at rounding level for every material,
    # with no systematic drift (rounding, not an algorithmic bias).
    sweep = [1.33, 1.45, 1.52, 1.62, 2.0, 2.4]
    resid = [abs(jc.fresnel_reflection_matrix(n1, n, np.arctan(n / n1))[1][1])
             for n in sweep]
    print("\n  Index sweep, |r_p| at each material's own Brewster angle:")
    for n, r in zip(sweep, resid):
        print(f"    n2 = {n:<5}  |r_p| = {r:.3e}")
    eps = np.finfo(np.float64).eps

    check("r_p vanishes at Brewster's angle", abs(rp) < 1e-12)
    check("r_p is non-zero away from Brewster's angle", abs(off[1][1]) > 1e-3)
    check("Brewster residual stays within 10 eps for all indices in the sweep",
          max(resid) < 10 * eps)
    return abs(rp)


# ---------------------------------------------------------------------------
# BENCHMARK 3 — Quarter-wave anti-reflection coating
# ---------------------------------------------------------------------------
def benchmark_3():
    rule("BENCHMARK 3: quarter-wave AR coating, ideal index-matched layer")

    n0, n_sub, lam = 1.0, 1.52, 500.0
    n_film = np.sqrt(n0 * n_sub)        # geometric-mean matching condition
    d = lam / (4 * n_film)              # quarter-wave optical thickness

    M = jc.thin_film_reflection_matrix(n0, n_film, n_sub, d, lam, 0.0)
    rs, rp = M[0][0], M[1][1]

    print(f"\n  Stack: air (n0 = {n0}) | film | substrate (n_sub = {n_sub})")
    print(f"  Matching condition n_film = sqrt(n0 * n_sub) = {n_film:.6f}")
    print(f"  Quarter-wave thickness d = lambda/(4 n_film) = {d:.4f} nm at lambda = {lam} nm")
    print(f"  Optical thickness n_film * d = {n_film*d:.4f} nm = lambda/4 = {lam/4:.4f} nm")
    print(f"\n  r_s = {rs:.3e}    R_s = {abs(rs)**2:.3e}")
    print(f"  r_p = {rp:.3e}    R_p = {abs(rp)**2:.3e}")

    # Control: uncoated substrate must reflect ~4%
    bare = jc.fresnel_reflection_matrix(n0, n_sub, 0.0)
    R_bare = abs(bare[0][0]) ** 2
    print(f"\n  Control, uncoated air->glass at normal incidence:")
    print(f"    r = {bare[0][0]:+.6f},  R = {R_bare:.6f}  ({R_bare*100:.2f} %)")
    print(f"    The coating suppresses reflectance from {R_bare*100:.2f} % to {abs(rs)**2*100:.2e} %.")

    check("AR coating drives r_s to zero", abs(rs) < 1e-12)
    check("AR coating drives r_p to zero", abs(rp) < 1e-12)
    check("uncoated substrate reflects approx 4%", abs(R_bare - 0.0426) < 5e-3)
    return abs(rs)


# ---------------------------------------------------------------------------
# BENCHMARK 4 — Transfer Matrix Method vs the analytic Airy formula
# ---------------------------------------------------------------------------
def benchmark_4():
    rule("BENCHMARK 4: TMM reproduces the analytic Airy multiple-beam formula")

    n0, nf, ns, lam = 1.0, 2.0, 1.52, 550.0
    worst = 0.0
    print(f"\n  Stack: air | n_film = {nf} | n_sub = {ns},  lambda = {lam} nm, normal incidence")
    print(f"\n  {'d (nm)':>8}  {'TMM r_s':>26}  {'Airy r_s':>26}  {'|diff|':>10}")
    print("  " + "-" * 76)

    for d in [0.0, 25.0, 68.75, 137.0, 200.0, 412.5]:
        delta = 2 * np.pi / lam * nf * d
        r01 = (n0 - nf) / (n0 + nf)
        r12 = (nf - ns) / (nf + ns)
        airy = (r01 + r12 * np.exp(-2j * delta)) / (1 + r01 * r12 * np.exp(-2j * delta))

        tmm = jc.thin_film_reflection_matrix(n0, nf, ns, d, lam, 0.0)[0][0]
        diff = abs(tmm - airy)
        worst = max(worst, diff)
        print(f"  {d:8.2f}  {tmm.real:+.8f}{tmm.imag:+.8f}j  "
              f"{airy.real:+.8f}{airy.imag:+.8f}j  {diff:10.2e}")

    print(f"\n  Worst-case deviation across all thicknesses: {worst:.3e}")
    print("  This test is sign-sensitive: it fixes the exp(i(wt - kz)) time")
    print("  convention. The opposite convention returns conj(r) -- the same")
    print("  reflectance, but the wrong reflected phase.")

    check("TMM matches the analytic Airy formula", worst < 1e-12)
    return worst


# ---------------------------------------------------------------------------
# BENCHMARK 5 — Energy conservation for a lossless stack
# ---------------------------------------------------------------------------
def benchmark_5():
    rule("BENCHMARK 5: reflectance stays physical for a lossless stack")

    n0, nf, ns, lam = 1.0, 2.35, 1.52, 550.0
    ok = True
    worst = 0.0
    for d in np.linspace(0, 400, 33):
        for ang in [0.0, 30.0, 60.0, 85.0]:
            M = jc.thin_film_reflection_matrix(
                n0, nf, ns, d, lam, np.radians(ang))
            for r in (M[0][0], M[1][1]):
                R = abs(r) ** 2
                worst = max(worst, R)
                if not (0.0 <= R <= 1.0 + 1e-12):
                    ok = False

    print(f"\n  Swept d = 0..400 nm (33 steps) x theta = 0, 30, 60, 85 deg")
    print(f"  Stack: air | n_film = {nf} | n_sub = {ns}")
    print(f"  Maximum reflectance encountered: R_max = {worst:.6f}")
    print(f"  All values satisfy 0 <= R <= 1 for this lossless stack.")

    check("no unphysical reflectance R > 1 anywhere in the sweep", ok)
    return worst


# ---------------------------------------------------------------------------
def main():
    print("\nOPTICS ENGINE VALIDATION SUITE")
    print(f"numpy {np.__version__}, complex128 (double precision) throughout")

    b1 = benchmark_1()
    b2 = benchmark_2()
    b3 = benchmark_3()
    b4 = benchmark_4()
    b5 = benchmark_5()

    rule("SUMMARY")
    print()
    for name, ok in results:
        print(f"  [{PASS if ok else FAIL}]  {name}")

    n_pass = sum(1 for _, ok in results if ok)
    print(f"\n  {n_pass}/{len(results)} checks passed.")
    print("\n  Numbers for Chapter 4:")
    print(f"    Benchmark 1  max|E_out - E_theory| = {b1:.3e}")
    print(f"    Benchmark 2  |r_p| at Brewster     = {b2:.3e}")
    print(f"    Benchmark 3  |r_s| for AR coating  = {b3:.3e}")
    print(f"    Benchmark 4  max|r_TMM - r_Airy|   = {b4:.3e}")
    print(f"    Benchmark 5  max R over sweep      = {b5:.6f}")
    print(f"\n  Machine epsilon for float64: {np.finfo(np.float64).eps:.3e}")
    print()
    return 0 if n_pass == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
