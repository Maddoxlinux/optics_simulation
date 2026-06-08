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

    # Define incoming light with both horizontal (1) and vertical (1) components
    # This simulates light vibrating in multiple directions
    incoming_light = np.array([[1],
                               [1]])

    # Get the reflection matrix for the glass at Brewster's angle
    reflection_matrix = jc.fresnel_reflection_matrix(n_air, n_glass, brewster_angle)

    # Simulate the reflection
    reflected_light = reflection_matrix @ incoming_light

    print("Reflected Light Vector:")
    print(np.round(reflected_light, 3), "\n")

    # The vertical (p-polarized) bottom number should be exactly 0.0
    if np.isclose(reflected_light[1][0], 0.0):
        print("✅ SUCCESS: The reflected light is 100% horizontally polarized.")
        print("The Fresnel equations successfully eliminated the vertical component at Brewster's angle.")
    else:
        print("❌ FAILED: Vertical component still exists.")

if __name__ == "__main__":
    main()
