export interface ObserverConfig {
  latitude: number;
  longitude: number;
  elevation: number; // in meters
  horizonAngle: number; // in degrees
  refractionModel: "saemundsson" | "custom";
  pressureMb: number; // Atmospheric pressure in hPa/mb
  temperatureC: number; // Temperature in Celsius
  simpsonIntervals: number; // Number of subdivisions for Simpson 1/3
}

export interface IjtimaResult {
  exactTime: Date;
  moonLongitude: number; // degrees
  sunLongitude: number; // degrees
  durationFromSearchStartHours: number;
}

export interface IntegralResult {
  approxGregorianDate: Date;
  ijtimaTime: Date;
  sunsetTime: Date;
  moonsetTime: Date;
  
  // Sunset Topocentric conditions
  moonAltTopo: number; // degrees (including refraction)
  moonAzTopo: number; // degrees
  sunAltTopo: number; // degrees
  sunAzTopo: number; // degrees
  elongationTopoSunset: number; // degrees
  moonAgeHours: number; // age since ijtima at sunset
  
  // Dip correction
  dipDegrees: number;
  
  // Integrals
  E_total: number; // degree-hours
  H_integral: number; // degree-hours
  
  // Integration points for visualization
  E_points: { time: Date; val: number }[];
  H_points: { time: Date; val: number }[];
  
  // Decision
  isNewMonthEstablished: boolean; // if criteria are met
  decisionReason: string;
}

export interface JavaneseDate {
  hari: string;
  pasaran: string;
  neptu: number;
  weton: string;
}

export interface OrbitalPhysicsResult {
  eccentricity: number;
  semiMajorAxisKm: number;
  currentDistanceKm: number;
  orbitalVelocityKmS: number;
  shapiroDelayNs: number;
  tidalAccelerationMScale: number;
}
