import numpy as np

# ==========================================
# 1. LIGHT STATES (JONES VECTORS)
# ==========================================

def horizontal_linear():
    """Returns a horizontally polarized light vector."""
    return np.array([[1],
                     [0]])

def vertical_linear():
    """Returns a vertically polarized light vector."""
    return np.array([[0],
                     [1]])

def right_circular():
    """Returns a right-circularly polarized (RCP) light vector."""
    return (1 / np.sqrt(2)) * np.array([[1],
                                        [-1j]])

def left_circular():
    """Returns a left-circularly polarized (LCP) light vector."""
    return (1 / np.sqrt(2)) * np.array([[1],
                                        [1j]])

# ==========================================
# 2. OPTICAL COMPONENTS (JONES MATRICES)
# ==========================================

def linear_polarizer(theta_radians):
    """
    Returns the 2x2 matrix for a linear polarizer.
    theta_radians: Angle of the transmission axis.
    """
    c = np.cos(theta_radians)
    s = np.sin(theta_radians)
    return np.array([[c**2, c*s],
                     [c*s, s**2]])

def waveplate(retardance, theta_radians):
    """
    Returns the 2x2 matrix for a generic retarder/waveplate.
    retardance: Phase delay (e.g., pi/2 for a Quarter-Wave Plate).
    theta_radians: Angle of the fast axis.
    """
    c = np.cos(theta_radians)
    s = np.sin(theta_radians)
    phase_factor = np.exp(-1j * retardance)

    matrix = np.array([
        [c**2 + phase_factor * s**2, c * s * (1 - phase_factor)],
        [c * s * (1 - phase_factor), s**2 + phase_factor * c**2]
    ])
    return matrix

def quarter_waveplate(theta_radians):
    """Specific implementation of a Quarter-Wave Plate (QWP)."""
    return waveplate(np.pi / 2, theta_radians)

def half_waveplate(theta_radians):
    """Specific implementation of a Half-Wave Plate (HWP)."""
    return waveplate(np.pi, theta_radians)
def normalize(vector):
    """
    Removes the global phase from a Jones vector to make it
    match standard textbook formats.
    """
    # Find the phase angle of the first element
    global_phase = np.angle(vector[0][0])
    # Multiply the vector by the opposite phase to cancel it out
    normalized_vector = vector * np.exp(-1j * global_phase)
    return normalized_vector
# ==========================================
# 3. MATERIAL INTERACTIONS (FRESNEL EQUATIONS)
# ==========================================

def fresnel_reflection_matrix(n1, n2, theta_i):
    """
    Calculates the Jones matrix for reflection at a dielectric boundary.
    n1: Refractive index of starting material (e.g., Air = 1.0)
    n2: Refractive index of target material (e.g., Crown Glass = 1.52)
    theta_i: Angle of incidence in radians
    """
    # Snell's Law to find the angle of transmission (theta_t)
    # n1 * sin(theta_i) = n2 * sin(theta_t)
    sin_theta_t = (n1 / n2) * np.sin(theta_i)

    # Check for Total Internal Reflection (TIR)
    if sin_theta_t > 1.0:
        raise ValueError("Total Internal Reflection occurred.")

    theta_t = np.arcsin(sin_theta_t)

    # Fresnel equations for s-polarized and p-polarized reflection
    # 's' is perpendicular to the plane of incidence (horizontal)
    # 'p' is parallel to the plane of incidence (vertical)
    rs = (n1 * np.cos(theta_i) - n2 * np.cos(theta_t)) / (n1 * np.cos(theta_i) + n2 * np.cos(theta_t))
    rp = (n2 * np.cos(theta_i) - n1 * np.cos(theta_t)) / (n2 * np.cos(theta_i) + n1 * np.cos(theta_t))

    # The Jones matrix for reflection
    matrix = np.array([[rs, 0],
                       [0, rp]])
    return matrix


# ==========================================
# 4. THIN-FILM OPTICS (TRANSFER MATRIX METHOD)
# ==========================================

def thin_film_reflection_matrix(n0, n_film, n_sub, d_nm, lambda_nm, theta_i_radians):
    """
    Calculates the 2x2 Jones reflection matrix for a single thin-film layer
    on a substrate using the Transfer Matrix Method (Macleod formalism).

    The stack geometry is:  Ambient (n0) | Film (n_film, d_nm) | Substrate (n_sub)

    Parameters
    ----------
    n0            : float or complex  -- Refractive index of the ambient medium (e.g. 1.0 for air).
    n_film        : float or complex  -- Refractive index of the thin-film layer (e.g. 2.0 for SnO2).
    n_sub         : float or complex  -- Refractive index of the substrate     (e.g. 1.52 for Crown Glass).
    d_nm          : float             -- Physical thickness of the film in nanometres.
    lambda_nm     : float             -- Free-space wavelength of the incident light in nanometres.
    theta_i_radians: float            -- Angle of incidence (in the ambient medium) in radians.

    Returns
    -------
    np.ndarray, shape (2, 2), complex
        Jones reflection matrix  [[rs, 0], [0, rp]]  where rs and rp are the
        complex amplitude reflection coefficients for s- and p-polarisation.
    """

    # ------------------------------------------------------------------
    # STEP 1 — Refraction angles via Snell's Law
    #   n0 * sin(θ_i) = n_film * sin(θ_f) = n_sub * sin(θ_sub)
    #
    # Cast every intermediate value to complex so that:
    #   (a) absorbing media with complex n are handled transparently, and
    #   (b) numpy's arcsin returns the correct branch for evanescent fields.
    # ------------------------------------------------------------------
    sin_theta_i = np.sin(theta_i_radians) + 0j   # keep as complex throughout

    # Complex propagation angle inside the film
    sin_theta_f   = (n0 / n_film) * sin_theta_i
    theta_f       = np.arcsin(sin_theta_f)        # complex-safe arcsin

    # Complex propagation angle inside the substrate
    sin_theta_sub = (n0 / n_sub) * sin_theta_i
    theta_sub     = np.arcsin(sin_theta_sub)

    # ------------------------------------------------------------------
    # STEP 2 — Phase thickness δ of the film
    #   δ = (2π / λ) · n_film · d · cos(θ_film)
    #
    # δ accumulates the round-trip phase the wave picks up while
    # traversing the film once.  When δ = π/2 the film is a
    # quarter-wave layer at this wavelength and angle.
    # ------------------------------------------------------------------
    delta = (2.0 * np.pi / lambda_nm) * n_film * d_nm * np.cos(theta_f)

    # ------------------------------------------------------------------
    # STEP 3 — Optical admittances η for each medium
    #
    # The admittance is the ratio of the tangential magnetic field to the
    # tangential electric field.  It depends on polarisation:
    #
    #   s-pol (TE)  →  η =  n · cos(θ)          (∝ the y-component of H)
    #   p-pol (TM)  →  η =  n / cos(θ)          (∝ the x-component of H)
    #
    # We use the relative admittance (normalised by η_vacuum = 1),
    # which is numerically equal to the expressions above.
    # ------------------------------------------------------------------
    cos_theta_i   = np.cos(theta_i_radians) + 0j
    cos_theta_f   = np.cos(theta_f)
    cos_theta_sub = np.cos(theta_sub)

    # --- s-polarisation (TE) ---
    #   η_s = n · cos(θ)
    eta0_s    = n0    * cos_theta_i     # ambient
    eta_f_s   = n_film * cos_theta_f    # film
    eta_sub_s = n_sub * cos_theta_sub   # substrate

    # --- p-polarisation (TM) ---
    #   η_p = cos(θ) / n   ← Verdet / Born-Wolf convention
    #
    #   This matches the sign convention used in fresnel_reflection_matrix()
    #   in this module, where rp = (n2·cos θi − n1·cos θt) / (…) is positive
    #   for a low-to-high index boundary at small angles.
    #
    #   The alternative Macleod definition (η_p = n/cos θ) is also internally
    #   consistent but negates rp relative to the Fresnel formula above.
    eta0_p    = cos_theta_i   / n0      # ambient
    eta_f_p   = cos_theta_f   / n_film  # film
    eta_sub_p = cos_theta_sub / n_sub   # substrate

    # ------------------------------------------------------------------
    # STEP 4 — Transfer (characteristic) matrix for the film layer
    #   Macleod formalism, eq. for a single homogeneous layer:
    #
    #         ┌                              ┐
    #         │   cos(δ)       −i·sin(δ)/η  │
    #   M  =  │                              │
    #         │  −i·η·sin(δ)    cos(δ)      │
    #         └                              ┘
    #
    # The matrix is applied to the "entrance vector" of the substrate
    # [1, η_sub], yielding the equivalent entrance vector [B, C] for
    # the ambient / film / substrate assembly.
    #
    #   [B]   [  cos(δ)       −i·sin(δ)/η  ] [  1   ]
    #   [C] = [ −i·η·sin(δ)    cos(δ)      ] [ η_sub]
    #
    # The assembly admittance is then  Y = C / B.
    # ------------------------------------------------------------------
    cos_d = np.cos(delta)
    sin_d = np.sin(delta)

    def _admittance(eta_f, eta_sub):
        """Returns the equivalent admittance Y of the film+substrate stack."""
        # Row 1 of M applied to [1, η_sub]
        B = cos_d  +  (-1j * sin_d / eta_f) * eta_sub
        # Row 2 of M applied to [1, η_sub]
        C = (-1j * eta_f * sin_d)  +  cos_d * eta_sub
        return C / B   # equivalent admittance Y

    Y_s = _admittance(eta_f_s, eta_sub_s)
    Y_p = _admittance(eta_f_p, eta_sub_p)

    # ------------------------------------------------------------------
    # STEP 5 — Complex reflection coefficients
    #   Using the Fresnel-like formula in terms of admittances:
    #
    #         η_0 − Y
    #   r  =  ───────
    #         η_0 + Y
    #
    # This is exact for any number of layers; for a single layer it
    # sums all multiple-reflection contributions (Fabry-Pérot series)
    # analytically through the matrix multiplication above.
    # ------------------------------------------------------------------
    rs = (eta0_s - Y_s) / (eta0_s + Y_s)
    rp = (eta0_p - Y_p) / (eta0_p + Y_p)

    # ------------------------------------------------------------------
    # STEP 6 — Assemble and return the Jones reflection matrix
    #   Convention matches fresnel_reflection_matrix() in this module:
    #   row/col 0 → s-polarisation,  row/col 1 → p-polarisation.
    #   Off-diagonal elements are zero for a planar isotropic stack.
    # ------------------------------------------------------------------
    return np.array([[rs, 0],
                     [0,  rp]], dtype=complex)


# ==========================================
# 5. BIREFRINGENT CRYSTALS (WAVEPLATE MODEL)
# ==========================================

def birefringent_crystal_matrix(ne, no, d_nm, lambda_nm, theta_radians):
    """
    Returns the 2x2 Jones transmission matrix for a birefringent crystal
    (uniaxial, planarly cut) modelled as a general retarder/waveplate.

    The crystal is treated as lossless: only the relative phase between the
    ordinary and extraordinary rays matters, not the absolute optical path.

    Parameters
    ----------
    ne           : float -- Extraordinary refractive index (e.g. 1.553 for α-Quartz).
    no           : float -- Ordinary   refractive index (e.g. 1.544 for α-Quartz).
    d_nm         : float -- Physical thickness of the crystal in nanometres.
    lambda_nm    : float -- Free-space wavelength in nanometres.
    theta_radians: float -- Orientation angle of the fast axis w.r.t. the x-axis.

    Returns
    -------
    np.ndarray, shape (2, 2), complex
        Jones matrix identical in form to waveplate(Γ, θ).

    Physics
    -------
    The phase retardance accumulated across the crystal thickness d is:

        Γ = (2π / λ) · (ne − no) · d

    Special cases:
        Γ = π/2  →  Quarter-Wave Plate  (linear → circular polarisation)
        Γ = π    →  Half-Wave Plate     (rotates linear polarisation by 2θ)
        Γ = 2π   →  Full-Wave Plate     (identity; output = input)

    The sign of Γ encodes the handedness: positive Δn (ne > no, positive
    uniaxial like Quartz) retards the e-ray; negative Δn (ne < no, negative
    uniaxial like Calcite) retards the o-ray.
    """
    # Phase retardance Γ = (2π/λ) · Δn · d
    retardance = (2.0 * np.pi / lambda_nm) * (ne - no) * d_nm

    # Delegate to the general waveplate formula already defined in Section 2.
    # This keeps the crystal model self-consistent with QWP / HWP functions.
    return waveplate(retardance, theta_radians)
