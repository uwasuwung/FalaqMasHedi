import { Observer, Equator, Horizon, Body, AngleBetween, MakeTime } from "astronomy-engine";

export class TopocentricEphemeris {
  /**
   * Instantiates an Observer config for Topocentric computation.
   * @param latitude Degrees north of equator
   * @param longitude Degrees east, or west if negative
   * @param elevationM meters above sea level (wgs84 equivalent)
   */
  public static createObserver(
    latitude: number,
    longitude: number,
    elevationM: number
  ): Observer {
    return new Observer(latitude, longitude, elevationM);
  }

  /**
   * Calculates refraction lift in degrees using Bennett/Saemundsson formula
   */
  public static calculateRefraction(
    trueAlt: number,
    refractionModel: "saemundsson" | "custom",
    pressureMb: number,
    temperatureC: number
  ): number {
    const p = refractionModel === "saemundsson" ? 1013.25 : pressureMb;
    const t = refractionModel === "saemundsson" ? 10.0 : temperatureC;
    
    const h = trueAlt;
    if (h <= -90.0) return 0.0;
    
    // Bennett's formula for refraction at true altitude h in degrees
    const arg = (h + 10.3 / (h + 5.11)) * Math.PI / 180;
    let rArcmin = 1.02 / Math.tan(arg);
    
    if (h < -5.0) {
      rArcmin = Math.max(0.0, rArcmin);
    }
    
    const f = (p / 1013.25) * (283.15 / (273.15 + t));
    let rDeg = (rArcmin / 60.0) * f;
    
    // Linearly taper refraction below horizon to 0 at -90 degrees
    if (h < 0.0) {
      const scale = (h + 90.0) / 90.0;
      rDeg = rDeg * Math.max(0.0, Math.min(1.0, scale));
    }
    
    return rDeg;
  }

  /**
   * Computes the precise astronomical Topocentric details of the Moon at a given time.
   * Applying complete:
   * 1. Parallax reduction: Translates coordinates from geocentric center to surface observer's location (WGS84 lat/lon/el).
   * 2. Atmospheric refraction: Adds average density optical bending correction to apparent altitude.
   */
  public static getMoonTopocentric(
    date: Date,
    obs: Observer,
    useRefraction: boolean = true,
    refractionModel: "saemundsson" | "custom" = "saemundsson",
    pressureMb: number = 1013.25,
    tempCelsius: number = 10
  ) {
    const time = MakeTime(date);
    
    // Topocentric equatorial positions (parallax applied inside Equator if observer is given)
    const eq = Equator(Body.Moon, time, obs, true, true);
    
    // Convert equatorial coordinates of date to horizontal coords (altitude/azimuth)
    // Refraction mode: omit to get unrefracted, then apply custom formulation
    const hor = Horizon(time, obs, eq.ra, eq.dec);
    
    let altitude = hor.altitude;
    if (useRefraction) {
      const refr = this.calculateRefraction(altitude, refractionModel, pressureMb, tempCelsius);
      altitude += refr;
    }
    
    return {
      altitude: altitude, // topocentric altitude in degrees
      azimuth: hor.azimuth,   // azimuth in degrees
      ra: eq.ra,
      dec: eq.dec,
      distanceKm: eq.dist * 149597870.69098932, // AU to km
    };
  }

  /**
   * Computes the precise astronomical Topocentric details of the Sun at a given time.
   */
  public static getSunTopocentric(
    date: Date,
    obs: Observer,
    useRefraction: boolean = true,
    refractionModel: "saemundsson" | "custom" = "saemundsson",
    pressureMb: number = 1013.25,
    tempCelsius: number = 10
  ) {
    const time = MakeTime(date);
    const eq = Equator(Body.Sun, time, obs, true, true);
    const hor = Horizon(time, obs, eq.ra, eq.dec);
    
    let altitude = hor.altitude;
    if (useRefraction) {
      const refr = this.calculateRefraction(altitude, refractionModel, pressureMb, tempCelsius);
      altitude += refr;
    }
    
    return {
      altitude: altitude,
      azimuth: hor.azimuth,
      ra: eq.ra,
      dec: eq.dec,
      distanceKm: eq.dist * 149597870.69098932, // AU to km
    };
  }

  /**
   * Computes the high-accuracy Topocentric Elongation angle between the Moon and Sun.
   * This is computed as the 3D angular separation between the Moon and Sun vectors
   * relative to the local topocentric coordinate frame of the Observer.
   */
  public static getTopocentricElongation(date: Date, obs: Observer): number {
    const time = MakeTime(date);
    // Get topocentric direction vectors
    const moonEq = Equator(Body.Moon, time, obs, true, true);
    const sunEq = Equator(Body.Sun, time, obs, true, true);
    
    // AngleBetween takes the astronomical position vectors and computes 3D angular separation
    return AngleBetween(moonEq.vec, sunEq.vec);
  }
}
