import { OrbitalPhysicsResult } from "./types";

// Cosmic Physics Constants
export const G = 6.6743e-11; // Gravitational constant (m^3 kg^-1 s^-2)
export const M_EARTH = 5.9722e24; // Mass of Earth (kg)
export const M_MOON = 7.342e22; // Mass of Moon (kg)
export const M_SUN = 1.989e30; // Mass of Sun (kg)
export const R_EARTH = 6371000; // Mean Earth radius (m)
export const C_LIGHT = 299792458; // Speed of light (m/s)

export class OrbitalPhysics {
  /**
   * Calculates the orbital distance r using Kepler's First Law.
   * r = a * (1 - e^2) / (1 + e * cos(theta))
   * @param semiMajorAxisM Semi-major axis in meters (a)
   * @param eccentricity Eccentricity (e, dimensionless)
   * @param trueAnomalyRad True anomaly in radians (theta)
   */
  public static calculateKeplerDistance(
    semiMajorAxisM: number,
    eccentricity: number,
    trueAnomalyRad: number
  ): number {
    const numerator = semiMajorAxisM * (1 - eccentricity * eccentricity);
    const denominator = 1 + eccentricity * Math.cos(trueAnomalyRad);
    return numerator / denominator;
  }

  /**
   * Calculates the orbital velocity v based on the Vis-Viva equation.
   * v = sqrt( G * M * (2/r - 1/a) )
   * @param centralMassKg Mass of the primary body (M, e.g. Earth or Sun)
   * @param distanceM Current distance between bodies in meters (r)
   * @param semiMajorAxisM Semi-major axis in meters (a)
   */
  public static calculateOrbitalVelocity(
    centralMassKg: number,
    distanceM: number,
    semiMajorAxisM: number
  ): number {
    if (distanceM <= 0 || semiMajorAxisM <= 0) return 0;
    const GM = G * centralMassKg;
    const velocitySquared = GM * (2 / distanceM - 1 / semiMajorAxisM);
    return velocitySquared > 0 ? Math.sqrt(velocitySquared) : 0;
  }

  /**
   * Calculates relativistic Shapiro / Einstein delay.
   * dt = (2 * G * M / c^3) * ln(r1 / r2)
   * @param massKg Mass of deflecting body (M)
   * @param r1 Distance from source to standard marker 1
   * @param r2 Distance from source to standard marker 2
   */
  public static calculateShapiroDelay(
    massKg: number,
    r1: number,
    r2: number
  ): number {
    if (r2 <= 0 || r1 <= 0) return 0;
    const c3 = Math.pow(C_LIGHT, 3);
    const coef = (2 * G * massKg) / c3;
    return coef * Math.log(r1 / r2);
  }

  /**
   * Calculates tidal acceleration exerted on Earth surface by Moon or Sun.
   * a_tidal = 2 * G * M * R / r^3
   * @param perturbingMassKg Mass of perturbing body (e.g. Moon)
   * @param earthRadiusM Radius of Earth (R)
   * @param distanceM Center-to-center distance in meters (r)
   */
  public static calculateTidalForceField(
    perturbingMassKg: number,
    earthRadiusM: number,
    distanceM: number
  ): number {
    if (distanceM <= 0) return 0;
    const r3 = Math.pow(distanceM, 3);
    return (2 * G * perturbingMassKg * earthRadiusM) / r3;
  }

  /**
   * Aggregates standard computed values at a specific Earth-Moon distance.
   */
  public static computeForMoonDistance(distanceM: number): OrbitalPhysicsResult {
    const a = 384400000; // Mean Earth-Moon distance (m)
    const e = 0.0549; // Moon's orbital eccentricity
    
    const v = this.calculateOrbitalVelocity(M_EARTH, distanceM, a);
    
    // Relativity: Shapiro delay difference between apogee and perigee
    const r_perigee = a * (1 - e);
    const r_apogee = a * (1 + e);
    const delay = this.calculateShapiroDelay(M_EARTH, r_apogee, distanceM);
    
    // Tidal force acceleration
    const tidalForce = this.calculateTidalForceField(M_MOON, R_EARTH, distanceM);

    return {
      eccentricity: e,
      semiMajorAxisKm: a / 1000,
      currentDistanceKm: distanceM / 1000,
      orbitalVelocityKmS: v / 1000,
      shapiroDelayNs: delay * 1e9, // in nanoseconds
      tidalAccelerationMScale: tidalForce // in m/s^2
    };
  }
}
