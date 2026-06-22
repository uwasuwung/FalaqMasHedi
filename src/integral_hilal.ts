import { Body, MakeTime, SearchMoonPhase, Observer, SearchRiseSet, PairLongitude, GeoVector, Ecliptic } from "astronomy-engine";
import { IjtimaResult, IntegralResult, JavaneseDate, ObserverConfig } from "./types";
import { TopocentricEphemeris } from "./ephemeris";
import { NumericalIntegrator } from "./integrator";

export class IntegralHilalEngine {
  /**
   * Solves for precision Conjunction (Ijtima') using Brent's method
   * on the difference between the Moon and Sun's geocentric ecliptic longitudes (λ_moon - λ_sun = 0).
   */
  public static solveIjtimaBrent(approxDate: Date, toleranceMs: number = 2000): IjtimaResult {
    // 1. Get an initial estimate using astronomy-engine's SearchMoonPhase (highly optimized)
    const initialMoonPhase = SearchMoonPhase(0, approxDate, 30);
    const pivotTime = initialMoonPhase ? initialMoonPhase.date.getTime() : approxDate.getTime();
    
    // 2. We set search range ± 24 hours around the pivot time to isolate the conjunction root
    const tMin = pivotTime - 24 * 3600000;
    const tMax = pivotTime + 24 * 3600000;

    // 3. Define root-finding function: f(t) = (λ_moon(t) - λ_sun(t)) in [-180, 180]
    const getLongitudeDifference = (tMs: number): number => {
      const date = new Date(tMs);
      const time = MakeTime(date);
      let diff = PairLongitude(Body.Moon, Body.Sun, time);
      if (diff > 180) diff -= 360;
      return diff;
    };

    // Solve via Brent's method
    let a = tMin;
    let b = tMax;
    let fa = getLongitudeDifference(a);
    let fb = getLongitudeDifference(b);

    // If signs do not differ, we scan in 1-hour steps to locate sign change
    if (fa * fb >= 0) {
      for (let t = tMin; t < tMax; t += 3600000) {
        const t1 = t;
        const t2 = t + 3600000;
        const f1 = getLongitudeDifference(t1);
        const f2 = getLongitudeDifference(t2);
        if (f1 * f2 <= 0) {
          a = t1;
          b = t2;
          fa = f1;
          fb = f2;
          break;
        }
      }
    }

    let c = a;
    let fc = fa;
    let d = b - a;
    let e = d;

    while (Math.abs(b - a) > toleranceMs) {
      if (Math.abs(fc) < Math.abs(fb)) {
        a = b; b = c; c = a;
        fa = fb; fb = fc; fc = fa;
      }

      const m = 0.5 * (c - b);
      if (Math.abs(m) <= toleranceMs || fb === 0) {
        break;
      }

      if (Math.abs(e) >= toleranceMs && Math.abs(fa) > Math.abs(fb)) {
        const s = fb / fa;
        let p, q;
        if (a === c) {
          p = 2 * m * s;
          q = 1 - s;
        } else {
          const r = fa / fc;
          const t = fb / fc;
          p = s * (2 * m * r * (r - t) - (b - a) * (t - 1));
          q = (r - 1) * (t - 1) * (s - 1);
        }

        if (p > 0) {
          q = -q;
        } else {
          p = -p;
        }

        if (2 * p < Math.min(3 * m * q - Math.abs(toleranceMs * q), Math.abs(e * q))) {
          e = d;
          d = p / q;
        } else {
          d = m;
          e = d;
        }
      } else {
        d = m;
        e = d;
      }

      a = b;
      fa = fb;

      if (Math.abs(d) > toleranceMs) {
        b += d;
      } else {
        b += m > 0 ? toleranceMs : -toleranceMs;
      }
      fb = getLongitudeDifference(b);
      
      if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
        c = a;
        fc = fa;
        d = b - a;
        e = d;
      }
    }

    const exactMatchTime = new Date(b);
    const finalTime = MakeTime(exactMatchTime);

    return {
      exactTime: exactMatchTime,
      moonLongitude: Ecliptic(GeoVector(Body.Moon, finalTime, true)).elon,
      sunLongitude: Ecliptic(GeoVector(Body.Sun, finalTime, true)).elon,
      durationFromSearchStartHours: (b - tMin) / 3600000,
    };
  }

  /**
   * Converte a Gregorian date to its Javanese simple equivalents (Hari, Pasaran, Neptu).
   */
  public static getJavaneseDate(date: Date): JavaneseDate {
    const hariNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const pasaranNames = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];
    
    const hariNeptuMap: Record<string, number> = {
      "Minggu": 5, "Senin": 4, "Selasa": 3, "Rabu": 7, "Kamis": 8, "Jumat": 6, "Sabtu": 9
    };
    
    const pasaranNeptuMap: Record<string, number> = {
      "Kliwon": 8, "Legi": 5, "Pahing": 9, "Pon": 7, "Wage": 4
    };

    // Reference midnight (local) on Thursday Pon, Jan 1, 1970
    const d = new Date(date);
    d.setHours(12, 0, 0, 0); // use noon to avoid midnight timezone jumps

    const refNoon = new Date(1970, 0, 1, 12, 0, 0, 0);
    const diffMs = d.getTime() - refNoon.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    // Day of the week index: Kamis = index 4
    let dayIdx = (4 + diffDays) % 7;
    if (dayIdx < 0) dayIdx += 7;

    // Pasaran index: Pon = index 2 (if list is: ["Legi", "Pahing", "Pon", "Wage", "Kliwon"])
    // Let's verify: Pon is indeed index 2 of ["Legi", "Pahing", "Pon", "Wage", "Kliwon"]
    let pasIdx = (2 + diffDays) % 5;
    if (pasIdx < 0) pasIdx += 5;

    const hari = hariNames[dayIdx];
    const pasaran = pasaranNames[pasIdx];
    const neptu = (hariNeptuMap[hari] || 0) + (pasaranNeptuMap[pasaran] || 0);

    return {
      hari,
      pasaran,
      neptu,
      weton: `${hari} ${pasaran}`
    };
  }

  /**
   * Computes the entire Metode Integral-Hilal v3.0 logic for a given location,
   * year, month, and actual horizon parameters.
   */
  public static computeIntegralHilal(
    targetHijriYear: number,
    targetHijriMonth: number,
    config: ObserverConfig,
    eTotalThreshold: number = 80,
    hIntegralThreshold: number = 2.0
  ): IntegralResult {
    // 1. Calculate Tabular Hijri approximation for start of target Month
    const totalMonthsSinceEpoch = (targetHijriYear - 1) * 12 + (targetHijriMonth - 1);
    const julianDays = 1948439.5 + totalMonthsSinceEpoch * 29.530589;
    const approxGregorianDate = new Date((julianDays - 2440587.5) * 86400 * 1000);

    // 2. Solve precise geocentric conjunction (Ijtima') using Brent's method on Ecliptic Longitude
    const ijtimaRes = this.solveIjtimaBrent(approxGregorianDate);
    const ijtimaTime = ijtimaRes.exactTime;

    // 3. Setup Observer
    const observer = TopocentricEphemeris.createObserver(
      config.latitude,
      config.longitude,
      config.elevation
    );

    // 4. Determine observation (Rukyat) sunset time.
    // Standard Islamic practice performs rukyat at Sunset of the 29th (the day of conjunction or day after).
    // Let's find sunset on the day of conjunction.
    let sunsetTime: Date;
    const sunsetAstro = SearchRiseSet(Body.Sun, observer, -1, ijtimaTime, 1);
    if (sunsetAstro) {
      sunsetTime = sunsetAstro.date;
    } else {
      sunsetTime = new Date(ijtimaTime.getTime() + 12 * 3600000); // feedback
    }

    // Solve moonset on that same observation evening
    let moonsetTime: Date;
    const moonsetAstro = SearchRiseSet(Body.Moon, observer, -1, sunsetTime, 1);
    if (moonsetAstro) {
      moonsetTime = moonsetAstro.date;
    } else {
      moonsetTime = new Date(sunsetTime.getTime() + 45 * 60000); // fallback is +45mins if not computed
    }

    // Dip Horizon calculation due to elevated view
    // Dip = 1.76 * sqrt(el) / 60
    const dipDegrees = (1.76 * Math.sqrt(config.elevation)) / 60;

    // 5. Compute conditions at Sunset
    const moonSunsetCond = TopocentricEphemeris.getMoonTopocentric(
      sunsetTime, 
      observer, 
      true, 
      config.refractionModel, 
      config.pressureMb, 
      config.temperatureC
    );
    const sunSunsetCond = TopocentricEphemeris.getSunTopocentric(
      sunsetTime, 
      observer, 
      true, 
      config.refractionModel, 
      config.pressureMb, 
      config.temperatureC
    );
    const elongationTopoSunset = TopocentricEphemeris.getTopocentricElongation(sunsetTime, observer);
    
    const moonAltTopo = moonSunsetCond.altitude;
    const moonAzTopo = moonSunsetCond.azimuth;
    const sunAltTopo = sunSunsetCond.altitude;
    const sunAzTopo = sunSunsetCond.azimuth;
    
    const moonAgeHours = (sunsetTime.getTime() - ijtimaTime.getTime()) / 3600000;

    // 6. Integrate Elongation E_total (°-hour) of lunar crescent from Ijtima' to Sunset
    let E_total = 0;
    const E_points: { time: Date; val: number }[] = [];
    const numSteps = config.simpsonIntervals || 20;
    
    if (ijtimaTime.getTime() < sunsetTime.getTime()) {
      const getElongVal = (t: Date) => TopocentricEphemeris.getTopocentricElongation(t, observer);
      
      E_total = NumericalIntegrator.simpson_1_3(getElongVal, ijtimaTime, sunsetTime, numSteps);
 
       // Generate points for charts
       for (let i = 0; i <= numSteps; i++) {
         const ptTime = new Date(ijtimaTime.getTime() + (i * (sunsetTime.getTime() - ijtimaTime.getTime())) / numSteps);
         E_points.push({ time: ptTime, val: getElongVal(ptTime) });
       }
     }
 
     // 7. Integrate Altitude H_integral (°-hour) of moon from Sunset to Moonset
     let H_integral = 0;
     const H_points: { time: Date; val: number }[] = [];
 
     if (sunsetTime.getTime() < moonsetTime.getTime() && moonAltTopo > 0) {
       const getAltVal = (t: Date) => {
         const moonTopo = TopocentricEphemeris.getMoonTopocentric(
           t, 
           observer, 
           true, 
           config.refractionModel, 
           config.pressureMb, 
           config.temperatureC
         );
         // Corrected altitude = h_topo - (horizon_angle - Dip)
         // If below horizon, clamp to 0
         const val = moonTopo.altitude - (config.horizonAngle - dipDegrees);
         return val > 0 ? val : 0;
       };
 
       H_integral = NumericalIntegrator.simpson_1_3(getAltVal, sunsetTime, moonsetTime, numSteps);
 
       // Generate points for charts
       for (let i = 0; i <= numSteps; i++) {
         const ptTime = new Date(sunsetTime.getTime() + (i * (moonsetTime.getTime() - sunsetTime.getTime())) / numSteps);
         H_points.push({ time: ptTime, val: getAltVal(ptTime) });
       }
     }

    // 8. Decision logic
    let isNewMonthEstablished = false;
    let decisionReason = "";

    if (ijtimaTime.getTime() >= sunsetTime.getTime()) {
      isNewMonthEstablished = false;
      decisionReason = `Ijtima' terjadi SETELAH waktu sunset (${ijtimaTime.toLocaleTimeString()} vs ${sunsetTime.toLocaleTimeString()}), sehingga Hilal belum lahir saat rukyat dilaksanakan (Istikmal 30 Hari).`;
    } else if (moonAltTopo <= config.horizonAngle - dipDegrees) {
      isNewMonthEstablished = false;
      decisionReason = `Tinggi Hilal Toposentrik di bawah Ufuk efektif (${moonAltTopo.toFixed(2)}° < ${(config.horizonAngle - dipDegrees).toFixed(2)}°), hilal terbenam sebelum/di bawah batas pandangan (Istikmal 30 Hari).`;
    } else if (E_total < eTotalThreshold || H_integral < hIntegralThreshold) {
      isNewMonthEstablished = false;
      decisionReason = `Akumulasi integral Elongasi E_total (${E_total.toFixed(2)}°-jam < ${eTotalThreshold.toFixed(1)}°-jam) atau integral Tinggi Hilal H_integral (${H_integral.toFixed(2)}°-jam < ${hIntegralThreshold.toFixed(1)}°-jam) belum memenuhi ambang batas energi Metode Integral-Hilal v3.0 (Istikmal 30 Hari).`;
    } else {
      isNewMonthEstablished = true;
      decisionReason = `Hilal MEMENUHI kriteria Metode Integral-Hilal v3.0! E_total (${E_total.toFixed(2)}°-jam ≥ ${eTotalThreshold.toFixed(1)}°-jam) dan H_integral (${H_integral.toFixed(2)}°-jam ≥ ${hIntegralThreshold.toFixed(1)}°-jam). Berdasarkan kriteria ini, Tanggal 1 baru dimulai esok hari.`;
    }

    return {
      approxGregorianDate,
      ijtimaTime,
      sunsetTime,
      moonsetTime,
      moonAltTopo,
      moonAzTopo,
      sunAltTopo,
      sunAzTopo,
      elongationTopoSunset,
      moonAgeHours,
      dipDegrees,
      E_total,
      H_integral,
      E_points,
      H_points,
      isNewMonthEstablished,
      decisionReason
    };
  }
}
