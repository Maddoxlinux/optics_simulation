import { useMemo, useRef, useState, useEffect } from 'react'
import axios from 'axios'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'

const WAVE_LENGTH = 10
const SEGMENTS = 200
const TRACE_SEGMENTS = 256

function AnimatedWave({ vectorX = 1, vectorY = 0 }) {
  const timeRef = useRef(0)
  const lineRef = useRef()

  // Static geometry positions buffer — updated each frame
  const positions = useMemo(() => new Float32Array((SEGMENTS + 1) * 3), [])

  useFrame((_, delta) => {
    timeRef.current += delta * 1.5

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = timeRef.current - (i / SEGMENTS) * Math.PI * 4
      const z = (i / SEGMENTS) * WAVE_LENGTH
      positions[i * 3 + 0] = vectorX * Math.cos(t)
      positions[i * 3 + 1] = vectorY * Math.cos(t)
      positions[i * 3 + 2] = z
    }

    if (lineRef.current) {
      lineRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  // Full 360° polarization trace at z = length
  const tracePoints = useMemo(() => {
    const pts = []
    for (let i = 0; i <= TRACE_SEGMENTS; i++) {
      const t = (i / TRACE_SEGMENTS) * Math.PI * 2
      pts.push(new THREE.Vector3(
        vectorX * Math.cos(t),
        vectorY * Math.cos(t),
        WAVE_LENGTH
      ))
    }
    return pts
  }, [vectorX, vectorY])

  return (
    <group>
      {/* Animated propagating wave */}
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
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
  const positions = useMemo(() => new Float32Array((IN_SEGMENTS + 1) * 3), [])

  useFrame((_, delta) => {
    timeRef.current += delta * 1.5   // same phase speed as AnimatedWave → seamless join

    for (let i = 0; i <= IN_SEGMENTS; i++) {
      const t = timeRef.current - (i / IN_SEGMENTS) * Math.PI * 4
      const z = SOURCE_Z + (i / IN_SEGMENTS) * (-SOURCE_Z)  // maps i → z: −8 … 0
      positions[i * 3 + 0] = Math.cos(t)   // constant unit amplitude along x
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = z
    }

    if (lineRef.current) {
      lineRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Animated beam */}
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
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
  { label: 'Water',              mode: 'single',    nMaterial: 1.333, nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  lambdaNm: 632.8 },
  { label: 'Crown Glass',        mode: 'single',    nMaterial: 1.52,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  lambdaNm: 632.8 },
  { label: 'Flint Glass',        mode: 'single',    nMaterial: 1.62,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  lambdaNm: 632.8 },
  { label: 'Diamond',            mode: 'single',    nMaterial: 2.42,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 500,  lambdaNm: 632.8 },
  { label: 'Silicon NIR Film',   mode: 'thin_film', nMaterial: 3.48,  nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 100,  lambdaNm: 1064  },
  { label: 'SnO₂ AR Coating',   mode: 'thin_film', nMaterial: 2.0,   nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 138,  lambdaNm: 550   },
  { label: 'Quartz (α-SiO₂)',   mode: 'crystal',   nMaterial: 1.553, nSub: 1.52,  ne: 1.553, nOrd: 1.544, dNm: 17556, lambdaNm: 632.8 },
  { label: 'Calcite',            mode: 'crystal',   nMaterial: 1.658, nSub: 1.52,  ne: 1.486, nOrd: 1.658, dNm: 1820, lambdaNm: 632.8 },
  { label: 'BBO Crystal',        mode: 'crystal',   nMaterial: 1.67,  nSub: 1.52,  ne: 1.555, nOrd: 1.677, dNm: 5170, lambdaNm: 532   },
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

  // ── API response → wave vectors ───────────────────────────────────────────
  const [vectorX, setVectorX] = useState(1)
  const [vectorY, setVectorY] = useState(0)
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

    axios.post('http://localhost:8000/simulate', payload)
      .then(({ data }) => {
        setVectorX(data.reflected_x)
        setVectorY(data.reflected_y)
        setApiError(null)
      })
      .catch(err => {
        setApiError(err.response?.data?.detail ?? err.message)
      })
  }, [mode, nAir, nMaterial, nSub, angleDeg, dNm, lambdaNm, ne, nOrd])

  // ── Derived booleans ──────────────────────────────────────────────────────
  const isThinFilm = mode === 'thin_film'
  const isCrystal  = mode === 'crystal'

  // ── Physics explanation ───────────────────────────────────────────────────
  const physicsAnalysis = useMemo(() => {
    const Ex = vectorX
    const Ey = vectorY
    const aX = Math.abs(Ex)
    const aY = Math.abs(Ey)

    if (mode === 'single') {
      const Rs = Ex * Ex
      const Rp = Ey * Ey
      const brewster = (Math.atan(nMaterial / nAir) * 180 / Math.PI).toFixed(1)
      if (aY < 0.01) {
        return `Brewster's Angle (~${brewster}°) detected. The p-polarized (vertical) component is fully transmitted into the material — zero p-reflection. Only s-polarized light reflects with Eₓ = ${Ex.toFixed(4)}.`
      }
      if (Rs + Rp > 1.8) {
        return `Near Total Internal Reflection. Both polarizations reflect strongly (Rs = ${Rs.toFixed(3)}, Rp = ${Rp.toFixed(3)}). The transmitted ray is becoming evanescent.`
      }
      const ratio = (aX / Math.max(aY, 1e-9)).toFixed(2)
      return `Fresnel reflection at θ = ${angleDeg}°. s-pol reflects ${ratio}× stronger than p-pol. Rs = ${Rs.toFixed(4)}, Rp = ${Rp.toFixed(4)}. Brewster's angle for n = ${nMaterial} is ≈ ${brewster}°.`
    }

    if (mode === 'thin_film') {
      const Rs = Ex * Ex
      const Rp = Ey * Ey
      const total = Rs + Rp
      const optThick = (nMaterial * dNm).toFixed(0)
      if (total < 0.04) {
        return `Anti-Reflection condition. Destructive interference between air/film and film/substrate reflections cancels nearly all reflected light. R_total ≈ ${total.toFixed(4)}. Optical thickness = ${optThick} nm.`
      }
      if (total > 1.5) {
        return `Constructive interference. Both surface reflections add in phase, maximising reflectance (R_total = ${total.toFixed(3)}). Optical thickness = ${optThick} nm. Try halving d to reach the AR minimum.`
      }
      return `Partial thin-film interference at λ = ${lambdaNm} nm, d = ${dNm} nm. Rs = ${Rs.toFixed(4)}, Rp = ${Rp.toFixed(4)}, R_total = ${total.toFixed(4)}. Optical thickness = ${optThick} nm — tune d or λ to reach AR or HR condition.`
    }

    if (mode === 'crystal') {
      const TWO_PI = 2 * Math.PI
      const Gamma  = (2 * Math.PI / lambdaNm) * (ne - nOrd) * dNm
      const GammaMod = ((Gamma % TWO_PI) + TWO_PI) % TWO_PI
      const GammaDeg = (GammaMod * 180 / Math.PI).toFixed(1)
      const biref    = (ne - nOrd).toFixed(4)
      const near = (x, target) => Math.abs(x - target) < 0.15
      if (near(GammaMod, Math.PI / 2) || near(GammaMod, 1.5 * Math.PI)) {
        return `Quarter-wave retardance (Γ ≈ ${GammaDeg}°). The crystal introduces a 90° phase shift between the fast and slow axes, converting linearly polarized input into circular polarization. Birefringence Δn = ${biref}.`
      }
      if (near(GammaMod, Math.PI)) {
        return `Half-wave retardance (Γ ≈ ${GammaDeg}°). The crystal rotates the polarization plane by 2θ = ${(2 * angleDeg).toFixed(0)}°, where θ = ${angleDeg}° is the fast-axis angle. Birefringence Δn = ${biref}.`
      }
      if (GammaMod < 0.1 || GammaMod > TWO_PI - 0.1) {
        return `Full-wave retardance (Γ ≈ ${GammaDeg}°). A complete 2π phase cycle — the output is polarization-identical to the input. Birefringence Δn = ${biref}, d = ${dNm} nm.`
      }
      return `Elliptical polarization. Retardance Γ = ${GammaDeg}° (Δn = ${biref}, d = ${dNm} nm, λ = ${lambdaNm} nm). Eₓ = ${Ex.toFixed(4)}, Eᵧ = ${Ey.toFixed(4)}. The projection trace ellipse has aspect ratio ${(aY / Math.max(aX, 1e-9)).toFixed(3)}.`
    }

    return ''
  }, [mode, angleDeg, vectorX, vectorY, nMaterial, nAir, dNm, lambdaNm, ne, nOrd])

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

        {/* Live field readout */}
        <div style={styles.readout}>
          <span>Eₓ = {vectorX.toFixed(4)}</span>
          <span>Eᵧ = {vectorY.toFixed(4)}</span>
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
          <AnimatedWave vectorX={vectorX} vectorY={vectorY} />

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
  analysisText: {
    fontSize: '0.72rem',
    color: '#a0c4e0',
    lineHeight: 1.55,
    margin: 0,
  },
}
