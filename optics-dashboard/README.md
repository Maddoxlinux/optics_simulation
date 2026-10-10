# Optics dashboard (front end)

React + Vite front end for the polarization simulation. It collects the physical parameters
(refractive indices, angle, film thickness, wavelength) and draws the resulting polarization
state in 3D with react-three-fiber.

It talks to the FastAPI backend in the repository root through `POST /simulate`.
The backend address is read from `VITE_API_URL` and defaults to `http://127.0.0.1:8000`.

```bash
npm install
npm run dev      # development server, http://localhost:5173
npm run build    # production build in dist/
```

See the [main README](../README.md) for the full project description.
