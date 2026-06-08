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
    mode: str = "single"          # "single" | "thin_film"
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
    Receives material data from the frontend, runs the requested reflection
    model, and returns the resulting polarization components.

    Modes
    -----
    single    : single dielectric boundary via Fresnel equations
    thin_film : one-layer thin-film stack via the Transfer Matrix Method
    """
    try:
        # Convert frontend degrees to radians for numpy
        theta_i = np.radians(req.angle_degrees)

        # Dispatch to the correct physics engine based on mode
        if req.mode == "single":
            ref_matrix = jc.fresnel_reflection_matrix(
                req.n_air, req.n_material, theta_i
            )
        elif req.mode == "thin_film":
            ref_matrix = jc.thin_film_reflection_matrix(
                req.n_air, req.n_material, req.n_sub,
                req.d_nm, req.lambda_nm, theta_i
            )
        else:  # crystal
            # In crystal mode theta_i is reused as the fast-axis orientation angle
            ref_matrix = jc.birefringent_crystal_matrix(
                req.ne, req.no, req.d_nm, req.lambda_nm, theta_i
            )

        # Simulate unpolarized light hitting the material
        incoming_light = np.array([[1], [1]])
        reflected_light = ref_matrix @ incoming_light

        # Send the X and Y vector components back to React
        return {
            "status": "success",
            "mode": req.mode,
            "material_index": req.n_material,
            "incidence_angle": req.angle_degrees,
            "reflected_x": float(np.real(reflected_light[0][0])),
            "reflected_y": float(np.real(reflected_light[1][0]))
        }

    except ValueError as e:
        # Catch errors like Total Internal Reflection
        raise HTTPException(status_code=400, detail=str(e))
