# Optics Simulation: Light Polarization Through Optical Media

A Python physics engine and interactive dashboard that compute and visualize how the
polarization state of light changes at interfaces, in thin films, and in waveplates.

Companion code for the B.Sc. thesis *Computational Modeling and Interactive Visualization of
Light Polarization States Through Various Optical Media Using Python* (Annor Yaw Osei,
Department of Physics, University of Ghana, October 2026; supervisor: Dr. Joanna A. Modupeh Hodasi).

## What it does

Light is a complex two-component Jones vector and every optical element is a 2 x 2 complex
matrix, so the output state is `matrix @ vector`. Three physical models are implemented:

| Mode | Physics | Result |
|------|---------|--------|
| `single` | Fresnel equations at one dielectric boundary (with a total-internal-reflection trap) | reflection |
| `thin_film` | Single film on a substrate by the Transfer Matrix Method (admittance formalism) | reflection |
| `crystal` | Birefringent plate modelled as a general retarder (quarter-wave, half-wave, ...) | transmission |

The API applies the chosen matrix to a normalized 45-degree linear input and returns the full
complex output vector, the relative phase between the components, and the intensities
`R_s` and `R_p` (= |r|^2). Conventions: fields vary as `exp(i(wt - kz))`; `(1, i)/sqrt(2)` is
right-circular (Hecht's convention). Jones calculus only describes fully polarized light.

## Repository layout

| Path | Role |
|------|------|
| `jones_calculus.py` | Physics engine: Jones vectors, polarizer, waveplate, Fresnel, thin-film TMM, crystal |
| `api.py` | FastAPI backend, single endpoint `POST /simulate` |
| `validate.py` | Automated validation suite (five benchmarks) |
| `make_figures.py` | Generates the thesis figures |
| `run_simulation.py`, `test_materials.py` | Command-line demos (quarter-wave plate; Brewster angle in crown glass) |
| `optics-dashboard/` | React + Vite front end with the 3D visualization |
| `requirements.txt` | Backend dependencies |
| `requirements-dev.txt` | Backend dependencies plus Matplotlib (needed only for `make_figures.py`) |

## Run it locally

Requires Python 3.12 and Node.js.

```bash
# backend (from the repository root)
python -m venv venv
venv\Scripts\activate            # Windows;  source venv/bin/activate on Linux/macOS
pip install -r requirements.txt
uvicorn api:app --reload         # http://127.0.0.1:8000  (docs at /docs)

# front end (second terminal)
cd optics-dashboard
npm install
npm run dev                      # http://localhost:5173
```

To point the front end at a deployed backend, set `VITE_API_URL` before building
(for example `VITE_API_URL=https://your-backend.onrender.com`).

Example request:

```bash
curl -X POST http://127.0.0.1:8000/simulate \
  -H "Content-Type: application/json" \
  -d '{"mode": "single", "n_material": 1.52, "angle_degrees": 30}'
```

## Validation

```bash
python validate.py
```

Five benchmarks compare the engine with closed-form results; all checks pass to
double-precision rounding (machine epsilon is 2.22e-16):

| Benchmark | Test | Residual |
|-----------|------|----------|
| 1 | Quarter-wave plate at 45 degrees turns horizontal light into circular light | 2.3e-16 |
| 2 | `r_p` vanishes at Brewster's angle (air to flint glass, n = 1.62) | 6.5e-17 |
| 3 | Quarter-wave anti-reflection coating gives zero reflection | 3.4e-17 |
| 4 | Transfer Matrix Method matches the analytic Airy formula in magnitude and phase | 5.6e-17 |
| 5 | Reflectance stays within 0 and 1 over a thickness and angle sweep (lossless stack) | R_max = 0.915 |

The script exits with a non-zero status if any check fails. To regenerate the thesis figures:
`pip install -r requirements-dev.txt` then `python make_figures.py`.

## Deployment

The backend is hosted on Render and the front end on Vercel. Typical settings: on Render,
build command `pip install -r requirements.txt` and start command
`uvicorn api:app --host 0.0.0.0 --port $PORT`; on Vercel, root directory `optics-dashboard`
with the environment variable `VITE_API_URL` set to the Render address.

## Limitations

Jones calculus cannot represent unpolarized or partially polarized light (that needs the
Mueller-Stokes formalism); the thin-film model covers a single layer; each material has one
fixed refractive index at all wavelengths.

## AI assistance

Claude Code (Anthropic) was used to modify the code and to assist with the analysis, and
Google Gemini was used to support the background research.
