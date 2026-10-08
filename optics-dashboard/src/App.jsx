import { useMemo, useRef, useState, useEffect } from 'react'
import axios from 'axios'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'

const WAVE_LENGTH = 10
const SEGMENTS = 200
const TRACE_SEGMENTS = 256

// Renders an elliptically polarized wave from the FULL complex Jones vector.
//
//   Ex(z,t) = |Ex| cos(wt - kz + phi_x)
//   Ey(z,t) = |Ey| cos(wt - kz + phi_y)
//
// The polarization state lives entirely in the phase DIFFERENCE phi_y - phi_x.
// If both components are forced to share one phase, the tip of the field vector
// can only move along a straight line, and circular/elliptical states become
// impossible to draw. That is why the backend must return complex amplitudes.
function AnimatedWave({ exAmp = 1, exPhase = 0, eyAmp = 0, eyPhase = 0 }) {
  const timeRef = useRef(0)
  const lineRef = useRef()

  // Initial (zeroed) position buffer handed to the geometry once at mount.
  // Per-frame updates are written through lineRef into the live geometry
  // attribute rather than into this array directly -- that is the standard
  // react-three-fiber pattern for animated BufferGeometry.
  const initialPositions = useMemo(() => new Float32Array((SEGMENTS + 1) * 3), [])

  // Reflected amplitudes are typically small (|r| ~ 0.05-0.5), so the raw wave
  // would be almost invisible next to the unit-amplitude incident beam. Scale
  // both components by the SAME factor: this preserves the shape of the
  // ellipse (axis ratio, tilt, handedness) while making it legible.
  const gain = useMemo(() => {
    const peak = Math.max(exAmp, eyAmp, 1e-9)
    return Math.min(1.4 / peak, 40)
  }, [exAmp, eyAmp])

  useFrame((_, delta) => {
    timeRef.current += delta * 1.5
    if (!lineRef.current) return

    const attr = lineRef.current.geometry.attributes.position
    const positions = attr.array
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = timeRef.current - (i / SEGMENTS) * Math.PI * 4
      const z = (i / SEGMENTS) * WAVE_LENGTH
      positions[i * 3 + 0] = gain * exAmp * Math.cos(t + exPhase)
      positions[i * 3 + 1] = gain * eyAmp * Math.cos(t + eyPhase)
      positions[i * 3 + 2] = z
    }
    attr.needsUpdate = true
  })

  // Full 360° polarization ellipse traced at z = WAVE_LENGTH. Sweeping one
  // complete cycle of wt draws the closed curve the field tip follows.
  const tracePoints = useMemo(() => {
    const pts = []
    for (let i = 0; i <= TRACE_SEGMENTS; i++) {
      const t = (i / TRACE_SEGMENTS) * Math.PI * 2
      pts.push(new THREE.Vector3(
        gain * exAmp * Math.cos(t + exPhase),
        gain * eyAmp * Math.cos(t + eyPhase),
        WAVE_LENGTH
      ))
    }
    return pts
  }, [exAmp, exPhase, eyAmp, eyPhase, gain])

  return (
    <group>
      {/* Animated propagating wave */}
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={initialPositions}
            count={SEGMENTS + 1}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00aaff" linewidth={2} />
      </line>

      {/* X-axis guide */}
      <Line
        points={[[-2, 0, 0], [2, 0, 0]]}
        color="#ff4444"
        lineWidth={1}
        dashed
      />
      {/* Y-axis guide */}
      <Line
        points={[[0, -2, 0], [0, 2, 0]]}
        color="#44ff44"
        lineWidth={1}
        dashed
      />
      {/* Z propagation axis */}
      <Line
        points={[[0, 0, 0], [0, 0, WAVE_LENGTH + 1]]}
        color="#aaaaaa"
        lineWidth={1}
        dashed
      />

      {/* 2D Projection Plane */}
      <mesh position={[0, 0, WAVE_LENGTH]} rotation={[0, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial
          color="#001133"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Polarization trace on the projection plane */}
      <Line
        points={tracePoints}
        color="yellow"
        lineWidth={3}
      />
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE ENVIRONMENT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_Z    = -8    // z-position of the laser emitter
const IN_SEGMENTS = 150   // vertex resolution for the incoming wave

// Metallic laser emitter body sitting behind the interface on the optical axis.
function LightSource() {
  return (
    <group position={[0, 0, SOURCE_Z - 0.8]}>

      {/* Main cylinder body, rotated so its long axis aligns with +z */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.35, 1.6, 20]} />
        <meshStandardMaterial color="#1a1a2e" metalness={1} roughness={0.25} />
      </mesh>

      {/* Brass aperture ring at the output face */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.75]}>
        <torusGeometry args={[0.28, 0.055, 8, 24]} />
        <meshStandardMaterial color="#cc8800" metalness={1} roughness={0.1} />
      </mesh>

      {/* Glowing aperture disc — the visible emission point */}
      <mesh position={[0, 0, 0.82]}>
        <circleGeometry args={[0.18, 20]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={3}
        />
      </mesh>

      {/* Warm point-light that radiates from the source into the scene */}
      <pointLight color="#ff8844" intensity={2.5} distance={7} decay={2} />
    </group>
  )
}

// Animated wave travelling from SOURCE_Z to z = 0 (the interface).
// Represents the source / incident beam before it interacts with the material.
// Constant x-amplitude, gray color — distinct from the cyan resultant wave.
function IncomingWave() {
  const timeRef   = useRef(0)
  const lineRef   = useRef()
  const initialPositions = useMemo(() => new Float32Array((IN_SEGMENTS + 1) * 3), [])

  useFrame((_, delta) => {
    timeRef.current += delta * 1.5   // same phase speed as AnimatedWave → seamless join
    if (!lineRef.current) return

    const attr = lineRef.current.geometry.attributes.position
    const positions = attr.array
    for (let i = 0; i <= IN_SEGMENTS; i++) {
      const t = timeRef.current - (i / IN_SEGMENTS) * Math.PI * 4
      const z = SOURCE_Z + (i / IN_SEGMENTS) * (-SOURCE_Z)  // maps i → z: −8 … 0
      positions[i * 3 + 0] = Math.cos(t)   // constant unit amplitude along x
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = z
    }
    attr.needsUpdate = true
  })

  return (
    <group>
      {/* Animated beam */}
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={initialPositions}
            count={IN_SEGMENTS + 1}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#aaaaaa" linewidth={1.5} />
      </line>

      {/* Dashed z-axis extension from source to interface — continues the
          axis guide that AnimatedWave draws from 0 → WAVE_LENGTH */}
      <Line
        points={[[0, 0, SOURCE_Z], [0, 0, 0]]}
        color="#aaaaaa"
        lineWidth={1}
        dashed
      />
    </group>
  )
}

// Semi-transparent glass slab at the origin representing the optical interface
// (dielectric boundary, thin-film stack, or crystal).  meshPhysicalMaterial
// with high transmission so both the incoming and outgoing waves stay visible.
function MaterialSample() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[5, 5, 0.5]} />
      <meshPhysicalMaterial
        color="#88ccff"
        transmission={0.9}
        transparent
        opacity={1}
        roughness={0.1}
        metalness={0}
        thickness={0.5}
        envMapIntensity={0.8}
      />
    </mesh>
  )
}

// ── Material presets ──────────────────────────────────────────────────────────
// Each entry carries enough state to fully configure any simulation mode.
const MATERIALS = [
  { label: '— Select Preset —', mode: null },
  { label: 'Water',              mode: 'single',    nMaterial: 1.333, nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  angleDeg: 30,    lambdaNm: 632.8 },
  { label: 'Crown Glass',        mode: 'single',    nMaterial: 1.52,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  angleDeg: 30,    lambdaNm: 632.8 },
  { label: 'Flint Glass',        mode: 'single',    nMaterial: 1.62,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  angleDeg: 30,    lambdaNm: 632.8 },
  { label: 'Diamond',            mode: 'single',    nMaterial: 2.42,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  angleDeg: 30,    lambdaNm: 632.8 },
  { label: 'Silicon NIR Film',   mode: 'thin_film', nMaterial: 3.48,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 100,  angleDeg: 30,    lambdaNm: 1064  },
  // Ideal AR layer: n_film = sqrt(n0 * n_sub) = sqrt(1.52) = 1.2329, quarter-wave
  // at 500 nm -> d = 500/(4 * 1.2329) = 101.4 nm. Drives reflectance to exactly
  // zero; this is the configuration validated as Benchmark 3.
  { label: 'Ideal AR Layer (√n_sub)', mode: 'thin_film', nMaterial: 1.233, nSub: 1.52, ne: 1.553, nOrd: 1.544, dNm: 101,  angleDeg: 0,    lambdaNm: 500 },
  // MgF2 is the standard real-world AR coating. n = 1.38 is above the ideal
  // 1.2329, so it cannot cancel the reflection completely -- it reduces glass
  // reflectance from ~4.3% to ~1.3% rather than to zero. Quarter-wave at
  // 550 nm -> d = 550/(4 * 1.38) = 99.6 nm.
  { label: 'MgF₂ AR Coating',    mode: 'thin_film', nMaterial: 1.38,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 100,  angleDeg: 0,    lambdaNm: 550   },
  // High-index layer: SnO2 on glass REFLECTS more than bare glass at
  // quarter-wave thickness. Included as the deliberate contrast to the AR case.
  { label: 'SnO₂ HR Layer',      mode: 'thin_film', nMaterial: 2.0,   nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 69,   angleDeg: 0,    lambdaNm: 550   },
  { label: 'Quartz QWP (α-SiO₂)', mode: 'crystal',   nMaterial: 1.553, nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 17578, angleDeg: 0,     lambdaNm: 632.8 },
  { label: 'Calcite HWP',        mode: 'crystal',   nMaterial: 1.658, nSub: 1.52,  ne: 1.486, nOrd: 1.658, dNm: 1840, angleDeg: 0,     lambdaNm: 632.8 },
  { label: 'BBO λ/8 (elliptical)', mode: 'crystal',  nMaterial: 1.67,  nSub: 1.52,  ne: 1.555, nOrd: 1.677, dNm: 545, angleDeg: 0,     lambdaNm: 532   },
]

export default function App() {
  // ── Simulation state ──────────────────────────────────────────────────────
  const [mode, setMode]           = useState('single')
  const [nAir]                    = useState(1.0)
  const [nMaterial, setNMaterial] = useState(1.52)
  const [nSub, setNSub]           = useState(1.52)
  const [angleDeg, setAngleDeg]   = useState(30)
  const [dNm, setDNm]             = useState(500)
  const [lambdaNm, setLambdaNm]   = useState(632.8)
  const [ne, setNe]               = useState(1.553)   // extraordinary index
  const [nOrd, setNOrd]           = useState(1.544)   // ordinary index
  const [selectedMat, setSelectedMat] = useState(0)  // preset dropdown index

  // ── API response → complex output field ───────────────────────────────────
  // Stored in polar form (amplitude + phase) because that is what the renderer
  // and the polarization-state classification both need.
  const [field, setField] = useState({
    exAmp: 1, exPhase: 0,
    eyAmp: 0, eyPhase: 0,
    deltaPhase: 0,
    Rs: 0, Rp: 0,
    channel: 'reflection',
  })
  const [apiError, setApiError] = useState(null)

  // ── Material preset handler ───────────────────────────────────────────────
  function handleMaterialSelect(e) {
    const idx = parseInt(e.target.value, 10)
    setSelectedMat(idx)
    if (idx === 0) return
    const m = MATERIALS[idx]
    setMode(m.mode)
    setNMaterial(m.nMaterial)
    setNSub(m.nSub)
    setNe(m.ne)
    setNOrd(m.nOrd)
    setDNm(m.dNm)
    setLambdaNm(m.lambdaNm)
    // Presets also set the angle: thin-film benchmarks are defined at normal
    // incidence, and in crystal mode the angle is the FAST-AXIS orientation.
    // The input state is 45-degree linear, so a fast axis at 0 deg sits 45 deg
    // away from it and gives maximum conversion. A fast axis AT 45 deg would
    // align with the input, which is then an eigenstate of the plate and passes
    // through completely unchanged.
    setAngleDeg(m.angleDeg)
  }

  // ── API call ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const payload = {
      mode,
      n_air:         nAir,
      n_material:    nMaterial,
      n_sub:         nSub,
      angle_degrees: angleDeg,
      d_nm:          dNm,
      lambda_nm:     lambdaNm,
      ne,
      no:            nOrd,
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    axios.post(`${API_URL}/simulate`, payload)
      .then(({ data }) => {
        setField({
          exAmp: data.ex_amp, exPhase: data.ex_phase,
          eyAmp: data.ey_amp, eyPhase: data.ey_phase,
          deltaPhase: data.delta_phase,
          Rs: data.R_s, Rp: data.R_p,
          channel: data.channel,
        })
        setApiError(null)
      })
      .catch(err => {
        setApiError(err.response?.data?.detail ?? err.message)
      })
  }, [mode, nAir, nMaterial, nSub, angleDeg, dNm, lambdaNm, ne, nOrd])

  // ── Derived booleans ──────────────────────────────────────────────────────
  const isThinFilm = mode === 'thin_film'
  const isCrystal  = mode === 'crystal'

  // ── Polarization state classification ─────────────────────────────────────
  // Determined from the amplitude ratio and the relative phase, which is the
  // standard way to read a Jones vector:
  //   delta = 0 or +/-180 deg          -> linear
  //   delta = +/-90 deg, |Ex| = |Ey|   -> circular
  //   everything else                  -> elliptical
  const polState = useMemo(() => {
    const { exAmp, eyAmp, deltaPhase } = field
    const d = Math.abs(deltaPhase * 180 / Math.PI)
    const peak = Math.max(exAmp, eyAmp)
    if (peak < 1e-9) return 'no output field'
    const ratio = Math.min(exAmp, eyAmp) / peak
    if (ratio < 0.02) return 'linear (single channel)'
    if (d < 2 || d > 178) return 'linear'
    if (Math.abs(d - 90) < 2 && Math.abs(ratio - 1) < 0.02) {
      // exp(+iwt) convention: Ey leading Ex by +90 deg rotates clockwise for an
      // observer facing the source, which is right-handed (Hecht).
      return deltaPhase > 0 ? 'circular (right-handed)' : 'circular (left-handed)'
    }
    return `elliptical (Δφ = ${(deltaPhase * 180 / Math.PI).toFixed(1)}°)`
  }, [field])

  // ── Physics explanation ───────────────────────────────────────────────────
  const physicsAnalysis = useMemo(() => {
    // Rs and Rp are true intensity coefficients |r|^2 computed by the backend
    // from the complex amplitudes. They are NOT Re(r)^2, which would understate
    // the reflectance whenever r has an imaginary part.
    const { Rs, Rp, exAmp, eyAmp } = field

    if (mode === 'single') {
      const brewster = (Math.atan(nMaterial / nAir) * 180 / Math.PI).toFixed(1)
      if (Rp < 1e-6) {
        return `Brewster's angle (≈ ${brewster}°). The p-polarized component is fully transmitted — R_p = ${Rp.toExponential(2)}, zero to within machine precision. The reflected beam is therefore 100% s-polarized, R_s = ${Rs.toFixed(4)}. This is how a pile-of-plates polarizer works.`
      }
      const ratio = (Rs / Math.max(Rp, 1e-12)).toFixed(2)
      return `Fresnel reflection at θ = ${angleDeg}°. R_s = ${Rs.toFixed(4)}, R_p = ${Rp.toFixed(4)} — s-polarization reflects ${ratio}× more strongly. Brewster's angle for n = ${nMaterial} is ≈ ${brewster}°; approach it to drive R_p to zero. Reflection off a dielectric is always partially polarizing.`
    }

    if (mode === 'thin_film') {
      const optThick = (nMaterial * dNm).toFixed(1)
      const quarterWave = (lambdaNm / 4).toFixed(1)
      const idealAR = Math.sqrt(nAir * nSub).toFixed(4)
      const Rbare = Math.pow((nAir - nSub) / (nAir + nSub), 2)
      const head = `Optical thickness n·d = ${optThick} nm (λ/4 = ${quarterWave} nm). Uncoated substrate would reflect ${(Rbare * 100).toFixed(2)}%.`
      if (Rs < 0.005) {
        return `${head} Anti-reflection condition: the front and back reflections are equal in magnitude and π out of phase, so they cancel. R_s = ${Rs.toExponential(2)}. Perfect cancellation needs n_film = √(n_air·n_sub) = ${idealAR} at exactly λ/4.`
      }
      if (Rs > Rbare * 1.5) {
        return `${head} High-reflectance condition: the two surface reflections add in phase, so R_s = ${Rs.toFixed(4)} exceeds the bare-substrate value. This happens when n_film > n_sub at λ/4 thickness. Halve d, or lower n_film below ${idealAR}, to move toward the AR minimum.`
      }
      return `${head} Partial interference at λ = ${lambdaNm} nm, d = ${dNm} nm: R_s = ${Rs.toFixed(4)}, R_p = ${Rp.toFixed(4)}. Tune d toward λ/(4·n_film) = ${(lambdaNm / (4 * nMaterial)).toFixed(1)} nm to reach a turning point.`
    }

    if (mode === 'crystal') {
      const TWO_PI = 2 * Math.PI
      const Gamma  = (TWO_PI / lambdaNm) * (ne - nOrd) * dNm
      const GammaMod = ((Gamma % TWO_PI) + TWO_PI) % TWO_PI
      const GammaDeg = (GammaMod * 180 / Math.PI).toFixed(1)
      const biref    = (ne - nOrd).toFixed(4)
      const near = (x, target) => Math.abs(x - target) < 0.15
      const tail = `Δn = ${biref}, d = ${dNm} nm, λ = ${lambdaNm} nm. Output is ${polState}.`

      // The plate only alters the state if the input has a component on BOTH
      // eigenaxes. The input here is 45° linear, so a fast axis at 45° (or 135°)
      // is parallel to it: the input is then an eigenstate and emerges unchanged
      // no matter how large Γ is. This is a property of the geometry, not a
      // failure of the retarder, so it is checked before the Γ cases below.
      const offAxis = Math.abs(((angleDeg - 45) % 180 + 180) % 180)
      if (offAxis < 1.5 || Math.abs(offAxis - 180) < 1.5) {
        return `Fast axis is parallel to the input polarization (both at 45°), so the 45° linear input is an eigenstate of the plate. It picks up an overall phase but its polarization is unchanged, whatever the retardance (Γ = ${GammaDeg}°). Rotate the fast axis toward 0° or 90° to drive the conversion. ${tail}`
      }
      if (near(GammaMod, Math.PI / 2) || near(GammaMod, 1.5 * Math.PI)) {
        return `Quarter-wave retardance (Γ = ${GammaDeg}°). A 90° phase delay between the fast and slow axes converts the 45° linear input into circular polarization. ${tail}`
      }
      if (near(GammaMod, Math.PI)) {
        return `Half-wave retardance (Γ = ${GammaDeg}°). The plate reflects the polarization about its fast axis, rotating linear input by 2θ = ${(2 * angleDeg).toFixed(0)}° for a fast axis at θ = ${angleDeg}°. ${tail}`
      }
      if (GammaMod < 0.1 || GammaMod > TWO_PI - 0.1) {
        return `Full-wave retardance (Γ = ${GammaDeg}°). A complete 2π cycle returns the state to the input — the plate is invisible at this wavelength. ${tail}`
      }
      const axisRatio = (Math.min(exAmp, eyAmp) / Math.max(exAmp, eyAmp, 1e-12)).toFixed(3)
      return `General retardance Γ = ${GammaDeg}°, producing elliptical polarization with axis ratio ${axisRatio}. ${tail}`
    }

    return ''
  }, [mode, angleDeg, field, nMaterial, nAir, nSub, dNm, lambdaNm, ne, nOrd, polState])

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.shell}>

      {/* ── Left control panel ─────────────────────────────────────────── */}
      <aside style={styles.panel}>
        <h2 style={styles.heading}>Optics Simulation</h2>

        {/* Material preset picker */}
        <div style={styles.field}>
          <label style={styles.label}>Material Preset</label>
          <select value={selectedMat} onChange={handleMaterialSelect} style={styles.select}>
            {MATERIALS.map((m, i) => (
              <option key={i} value={i}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Simulation mode */}
        <div style={styles.field}>
          <label style={styles.label}>Simulation Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={styles.select}>
            <option value="single">Single Boundary</option>
            <option value="thin_film">Thin Film (TMM)</option>
            <option value="crystal">Birefringent Crystal</option>
          </select>
        </div>

        <div style={styles.groupDivider} />

        {/* ── Single / Thin-Film controls ─────────────────────────────── */}
        {!isCrystal && (
          <>
            <SliderField
              label={isThinFilm ? 'Film Refractive Index (nₘ)' : 'Bulk Refractive Index (nₘ)'}
              min={1} max={4} step={0.01}
              value={nMaterial}
              onChange={setNMaterial}
            />
            <SliderField
              label="Angle of Incidence (°)"
              min={0} max={89} step={1}
              value={angleDeg}
              onChange={setAngleDeg}
            />
          </>
        )}

        {/* ── Thin-film extra controls ────────────────────────────────── */}
        {isThinFilm && (
          <>
            <SliderField
              label="Substrate Index (n_sub)"
              min={1} max={3} step={0.01}
              value={nSub}
              onChange={setNSub}
            />
            <SliderField
              label="Film Thickness d (nm)"
              min={0} max={2000} step={1}
              value={dNm}
              onChange={setDNm}
            />
            <SliderField
              label="Wavelength λ (nm)"
              min={400} max={1100} step={1}
              value={lambdaNm}
              onChange={setLambdaNm}
              trackStyle={wavelengthGradient}
            />
          </>
        )}

        {/* ── Crystal controls ────────────────────────────────────────── */}
        {isCrystal && (
          <>
            <SliderField
              label="Extraordinary Index (nₑ)"
              min={1} max={3} step={0.001}
              value={ne}
              onChange={setNe}
            />
            <SliderField
              label="Ordinary Index (n_o)"
              min={1} max={3} step={0.001}
              value={nOrd}
              onChange={setNOrd}
            />
            <SliderField
              label="Crystal Thickness d (nm)"
              min={0} max={50000} step={10}
              value={dNm}
              onChange={setDNm}
            />
            <SliderField
              label="Wavelength λ (nm)"
              min={400} max={1100} step={1}
              value={lambdaNm}
              onChange={setLambdaNm}
              trackStyle={wavelengthGradient}
            />
            <SliderField
              label="Fast-Axis Angle θ (°)"
              min={0} max={180} step={1}
              value={angleDeg}
              onChange={setAngleDeg}
            />
          </>
        )}

        {/* API error banner */}
        {apiError && <p style={styles.error}>{apiError}</p>}

        {/* Live field readout — magnitudes, relative phase, and intensities */}
        <div style={styles.readout}>
          <span>|Eₓ| = {field.exAmp.toFixed(4)}</span>
          <span>|Eᵧ| = {field.eyAmp.toFixed(4)}</span>
          <span>Δφ = {(field.deltaPhase * 180 / Math.PI).toFixed(2)}°</span>
          <span>R_s = {field.Rs.toFixed(5)}</span>
          <span>R_p = {field.Rp.toFixed(5)}</span>
          <span style={styles.stateLine}>{field.channel}: {polState}</span>
        </div>

        {/* Physics Analysis box */}
        <div style={styles.analysisBox}>
          <p style={styles.analysisTitle}>Physics Analysis</p>
          <p style={styles.analysisText}>{physicsAnalysis}</p>
        </div>
      </aside>

      {/* ── 3D canvas ──────────────────────────────────────────────────── */}
      <div style={styles.canvasWrap}>
        <Canvas camera={{ position: [6, 4, 14], fov: 50 }}>
          {/* Ambient fill so nothing is completely dark */}
          <ambientLight intensity={0.35} />

          {/* Key light — illuminates the glass slab from above-right */}
          <directionalLight position={[6, 10, 4]} intensity={1.8} />

          {/* Cool blue fill from the left to give the scene depth */}
          <pointLight position={[-6, 4, 6]} color="#4477ff" intensity={1.2} distance={20} decay={2} />

          {/* Scene objects — source → interface → resultant */}
          <LightSource />
          <IncomingWave />
          <MaterialSample />
          <AnimatedWave
            exAmp={field.exAmp} exPhase={field.exPhase}
            eyAmp={field.eyAmp} eyPhase={field.eyPhase}
          />

          <OrbitControls />
        </Canvas>
      </div>

    </div>
  )
}

// ── Reusable slider row ───────────────────────────────────────────────────────
function SliderField({ label, min, max, step, value, onChange, trackStyle }) {
  return (
    <div style={styles.field}>
      <div style={styles.labelRow}>
        <label style={styles.label}>{label}</label>
        <span style={styles.value}>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...styles.slider, ...(trackStyle ?? {}) }}
      />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const wavelengthGradient = {
  background: 'linear-gradient(to right, #7b00ff, #0000ff, #00bfff, #00ff00, #ffff00, #ff8000, #ff0000)',
}

const styles = {
  shell: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    background: '#050a14',
    fontFamily: 'system-ui, sans-serif',
    color: '#c8d8f0',
  },
  panel: {
    width: '290px',
    flexShrink: 0,
    background: '#0b1628',
    borderRight: '1px solid #1e3a5f',
    padding: '24px 18px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  canvasWrap: {
    flex: 1,
  },
  heading: {
    fontSize: '1rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#5bc8ff',
    marginBottom: '18px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '14px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontSize: '0.75rem',
    color: '#8ab0d0',
    userSelect: 'none',
  },
  value: {
    fontSize: '0.75rem',
    color: '#5bc8ff',
    fontVariantNumeric: 'tabular-nums',
  },
  slider: {
    width: '100%',
    accentColor: '#5bc8ff',
    cursor: 'pointer',
  },
  select: {
    background: '#0f2040',
    color: '#c8d8f0',
    border: '1px solid #1e3a5f',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    width: '100%',
  },
  groupDivider: {
    height: '1px',
    background: '#1e3a5f',
    margin: '2px 0 14px',
  },
  error: {
    fontSize: '0.72rem',
    color: '#ff6b6b',
    background: '#2a0a0a',
    border: '1px solid #5a1010',
    borderRadius: '4px',
    padding: '6px 8px',
    marginTop: '4px',
  },
  readout: {
    paddingTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.78rem',
    color: '#5bc8ff',
    fontVariantNumeric: 'tabular-nums',
    borderTop: '1px solid #1e3a5f',
    marginTop: '8px',
  },
  analysisBox: {
    marginTop: '14px',
    padding: '10px 12px',
    background: '#060f20',
    border: '1px solid #1e3a5f',
    borderRadius: '6px',
  },
  analysisTitle: {
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#5bc8ff',
    margin: '0 0 6px 0',
  },
  stateLine: {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px dashed #1e3a5f',
    color: '#8ab0d0',
  },
  analysisText: {
    fontSize: '0.72rem',
    color: '#a0c4e0',
    lineHeight: 1.55,
    margin: 0,
  },
}
