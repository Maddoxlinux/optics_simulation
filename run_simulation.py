import numpy as np
import jones_calculus as jc

def main():
    print("--- Optical Simulation Initialized ---\n")

    # 1. Define the incoming light (Horizontal)
    incoming_light = jc.horizontal_linear()

    # 2. Define the QWP at +45 degrees
    angle = np.pi / 4
    qwp_45 = jc.quarter_waveplate(angle)

    # 3. Simulate and NORMALIZE
    raw_output = qwp_45 @ incoming_light
    clean_output = jc.normalize(raw_output)

    print("Normalized Output Light Vector (After QWP):")
    print(np.round(clean_output, 3), "\n")

    # 4. Check against expected Right-Circular theory (Hecht's convention)
    expected_rcp = jc.right_circular()
    print("Theoretical Right-Circular Vector:")
    print(np.round(expected_rcp, 3))

if __name__ == "__main__":
    main()
