import numpy as np
import jones_calculus as jc

def main():
    print("--- Material Simulation: Crown Glass ---\n")

    # Material Properties
    n_air = 1.0
    n_glass = 1.52

    # Calculate Brewster's Angle theoretically: theta_B = arctan(n2/n1)
    brewster_angle = np.arctan(n_glass / n_air)
    print(f"Calculated Brewster's Angle: {np.degrees(brewster_angle):.2f} degrees\n")

    # Incoming light with equal horizontal and vertical components: this is
    # linear polarization at 45 degrees, which excites the s and p channels
    # equally so the reflection's asymmetry is caused purely by the interface.
    #
    # It is NOT unpolarized light. A Jones vector always describes a fully
    # polarized, fully coherent state -- unpolarized light has no Jones
    # representation at all and requires the Mueller-Stokes formalism.
    incoming_light = jc.linear_at(np.pi / 4)

    # Get the reflection matrix for the glass at Brewster's angle
    reflection_matrix = jc.fresnel_reflection_matrix(n_air, n_glass, brewster_angle)

    # Simulate the reflection
    reflected_light = reflection_matrix @ incoming_light

    print("Reflected Light Vector:")
    print(np.round(reflected_light, 3), "\n")

    # The vertical (p-polarized) bottom number should be exactly 0.0
    if np.isclose(reflected_light[1][0], 0.0):
        print("PASS: The reflected light is 100% horizontally polarized.")
        print("The Fresnel equations successfully eliminated the vertical component at Brewster's angle.")
    else:
        print("FAIL: Vertical component still exists.")

if __name__ == "__main__":
    main()
