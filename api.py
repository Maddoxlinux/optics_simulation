from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import numpy as np
import jones_calculus as jc

# Initialize the API
app = FastAPI(title="Optics Simulation Backend")

# Allow the React frontend to communicate with this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows local React dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the data format we expect from the React sliders
class SimulationRequest(BaseModel):
    mode: str = "single"          # "single" | "thin_film" | "crystal"
    n_air: float = 1.0            # ambient refractive index
    n_material: float             # bulk target (single) or film layer (thin_film)
    n_sub: float = 1.52           # substrate beneath the film (thin_film only)
    angle_degrees: float
    d_nm: float = 500.0           # film physical thickness in nanometres
    lambda_nm: float = 632.8      # free-space wavelength in nanometres

    ne: float = 1.553             # extraordinary index (crystal mode; Quartz default)
    no: float = 1.544             # ordinary    index (crystal mode; Quartz default)

    @field_validator("mode")
    @classmethod
    def mode_must_be_valid(cls, v: str) -> str:
        allowed = {"single", "thin_film", "crystal"}
        if v not in allowed:
            raise ValueError(f"mode must be one of {allowed}, got '{v}'")
        return v


@app.post("/simulate")
def run_simulation(req: SimulationRequest):
    """
    Receives material data from the frontend, runs the requested optical model,
    and returns the full COMPLEX output Jones vector.

    The complex amplitudes must be preserved end-to-end.  The polarization state
    is encoded in the RELATIVE PHASE between Ex and Ey, not in their magnitudes:
    (1, 1)/sqrt(2) is 45-degree linear light, while (1, i)/sqrt(2) has identical
    magnitudes but is circular.  Discarding the imaginary part would collapse
    every state onto a line and make circular/elliptical output unrepresentable.

    Modes
    -----
    single    : reflection at one dielectric boundary via the Fresnel equations
    thin_film : reflection from a one-layer stack via the Transfer Matrix Method
    crystal   : transmission through a birefringent plate (a general retarder)
    """
    try:
        # Convert frontend degrees to radians for numpy
        theta_i = np.radians(req.angle_degrees)

        # Dispatch to the correct physics engine based on mode
        if req.mode == "single":
            jones_matrix = jc.fresnel_reflection_matrix(
                req.n_air, req.n_material, theta_i
            )
        elif req.mode == "thin_film":
            jones_matrix = jc.thin_film_reflection_matrix(
                req.n_air, req.n_material, req.n_sub,
                req.d_nm, req.lambda_nm, theta_i
            )
        else:  # crystal
            # In crystal mode theta_i is reused as the fast-axis orientation angle.
            # Note this matrix describes TRANSMISSION through the plate, not
            # reflection -- see the "channel" field in the response.
            jones_matrix = jc.birefringent_crystal_matrix(
                req.ne, req.no, req.d_nm, req.lambda_nm, theta_i
            )

        # Input state: linear polarization at 45 degrees, normalized to unit
        # intensity.  This excites the s/p (or fast/slow) channels equally, so
        # any asymmetry in the output is caused by the optic and not the input.
        #
        # NOTE: this is NOT unpolarized light.  Unpolarized light cannot be
        # written as a Jones vector at all -- Jones calculus describes only
        # fully polarized, fully coherent states.  Modelling a partially
        # polarized beam requires the Mueller-Stokes formalism instead.
        incoming_light = jc.linear_at(np.pi / 4)
        outgoing_light = jones_matrix @ incoming_light

        Ex = complex(outgoing_light[0][0])
        Ey = complex(outgoing_light[1][0])

        # Relative phase between the two channels, wrapped to (-pi, pi].
        # This single number distinguishes the polarization states:
        #   0 or pi     -> linear
        #   +/- pi/2    -> circular (when |Ex| == |Ey|)
        #   anything else -> elliptical
        delta_phase = float(np.angle(Ey) - np.angle(Ex))
        delta_phase = float(np.arctan2(np.sin(delta_phase), np.cos(delta_phase)))

        # Intensity coefficients. R = |r|^2, NOT Re(r)^2 -- the two differ
        # whenever r is complex, which is always the case for a thin film.
        R_s = float(abs(Ex) ** 2) * 2.0   # x2 undoes the 1/sqrt(2) input weighting
        R_p = float(abs(Ey) ** 2) * 2.0

        return {
            "status": "success",
            "mode": req.mode,
            "channel": "transmission" if req.mode == "crystal" else "reflection",
            "material_index": req.n_material,
            "incidence_angle": req.angle_degrees,

            # Full complex output vector
            "ex_re": float(Ex.real), "ex_im": float(Ex.imag),
            "ey_re": float(Ey.real), "ey_im": float(Ey.imag),

            # Polar form, which is what the visualiser actually needs
            "ex_amp": float(abs(Ex)), "ex_phase": float(np.angle(Ex)),
            "ey_amp": float(abs(Ey)), "ey_phase": float(np.angle(Ey)),
            "delta_phase": delta_phase,

            # Intensity reflectance/transmittance per polarization channel
            "R_s": R_s,
            "R_p": R_p,
        }

    except ValueError as e:
        # Catch errors like Total Internal Reflection
        raise HTTPException(status_code=400, detail=str(e))
