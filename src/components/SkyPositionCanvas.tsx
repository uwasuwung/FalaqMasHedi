import React, { useRef, useEffect, useState } from "react";
import { Compass, Info, Sun, Moon, HelpCircle, Eye, EyeOff, Sliders } from "lucide-react";
import { TopocentricEphemeris } from "../ephemeris";

interface SkyPositionCanvasProps {
  sunsetTime: Date;
  moonAltTopo: number;
  moonAzTopo: number;
  sunAltTopo: number;
  sunAzTopo: number;
  elongationTopoSunset: number;
  moonAgeHours: number;
  width?: number;
  height?: number;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  refractionModel?: "saemundsson" | "custom";
  pressureMb?: number;
  temperatureC?: number;
}

export default function SkyPositionCanvas({
  sunsetTime,
  moonAltTopo,
  moonAzTopo,
  sunAltTopo,
  sunAzTopo,
  elongationTopoSunset,
  moonAgeHours,
  width = 440,
  height = 240,
  latitude = -7.1706,
  longitude = 112.6074,
  elevation = 120,
  refractionModel = "saemundsson",
  pressureMb = 1013.25,
  temperatureC = 10,
}: SkyPositionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showAtmosphericLift, setShowAtmosphericLift] = useState<boolean>(true);

  // Azimuth wrapping calculation
  const getRelativeAzimuth = (targetAz: number, referenceAz: number): number => {
    let diff = targetAz - referenceAz;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return diff;
  };

  // Re-calculate observers & positions in real-time to support instantaneous draft updates!
  const observer = React.useMemo(() => {
    return TopocentricEphemeris.createObserver(latitude, longitude, elevation);
  }, [latitude, longitude, elevation]);

  // Apparent and True positions for Moon
  const moonApparent = React.useMemo(() => {
    return TopocentricEphemeris.getMoonTopocentric(
      sunsetTime,
      observer,
      true,
      refractionModel,
      pressureMb,
      temperatureC
    );
  }, [sunsetTime, observer, refractionModel, pressureMb, temperatureC]);

  const moonTrue = React.useMemo(() => {
    return TopocentricEphemeris.getMoonTopocentric(
      sunsetTime,
      observer,
      false, // no refraction
      refractionModel,
      pressureMb,
      temperatureC
    );
  }, [sunsetTime, observer, refractionModel, pressureMb, temperatureC]);

  // Apparent and True positions for Sun
  const sunApparent = React.useMemo(() => {
    return TopocentricEphemeris.getSunTopocentric(
      sunsetTime,
      observer,
      true,
      refractionModel,
      pressureMb,
      temperatureC
    );
  }, [sunsetTime, observer, refractionModel, pressureMb, temperatureC]);

  const sunTrue = React.useMemo(() => {
    return TopocentricEphemeris.getSunTopocentric(
      sunsetTime,
      observer,
      false, // no refraction
      refractionModel,
      pressureMb,
      temperatureC
    );
  }, [sunsetTime, observer, refractionModel, pressureMb, temperatureC]);

  // Resolved positional coordinates to plot
  const rMoonAlt = moonApparent.altitude;
  const rMoonAz = moonApparent.azimuth;
  const rSunAlt = sunApparent.altitude;
  const rSunAz = sunApparent.azimuth;

  const tMoonAlt = moonTrue.altitude;
  const tMoonAz = moonTrue.azimuth;
  const tSunAlt = sunTrue.altitude;

  const diffAz = getRelativeAzimuth(rMoonAz, rSunAz);
  const diffAzTrue = getRelativeAzimuth(tMoonAz, rSunAz); // relative to apparent Sun to maintain x-grid parity

  // Coordinate ranges for the plot representation
  const minAlt = -4; // degrees
  const maxAlt = 16; // degrees
  const altRange = maxAlt - minAlt;

  const minDiffAz = -15; // degrees from sun
  const maxDiffAz = 15; // degrees from sun
  const azRange = maxDiffAz - minDiffAz;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous renders
    ctx.clearRect(0, 0, width, height);

    // Horizon level pixel ratio calculation
    const horizonY = height - ((-minAlt / altRange) * height); // altitude = 0 line

    // 1. Twilight sky background linear gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0.0, "#080c1e"); // High sky dark indigo
    skyGradient.addColorStop(0.35, "#141733"); // Midnight twilight transition
    skyGradient.addColorStop(0.65, "#3d1f3b"); // Purplish twilight zone
    skyGradient.addColorStop(0.85, "#822521"); // Red sunset dust
    skyGradient.addColorStop(1.0, "#fc602b"); // Radiant warm orange limit near sea/land
    
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, horizonY);

    // 2. Sea/Ground below horizon line
    ctx.fillStyle = "#11110f"; // Obsidian earth plane
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // 3. Grid line drawers
    // Altitude parallel lines (h=5°, h=10°, h=15°)
    const altGridLines = [5, 10, 15];
    altGridLines.forEach((alt) => {
      const yGrid = height - (((alt - minAlt) / altRange) * height);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, yGrid);
      ctx.lineTo(width, yGrid);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.font = "8px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText(`h = ${alt}°`, 6, yGrid - 4);
    });

    // Azimuth perspective vertical lines (-15°, -10°, -5°, 0°, +5°, +10°, +15°)
    const azGridLines = [-10, -5, 0, 5, 10];
    azGridLines.forEach((diff) => {
      const xGrid = ((diff - minDiffAz) / azRange) * width;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(xGrid, 0);
      ctx.lineTo(xGrid, horizonY);
      ctx.strokeStyle = diff === 0 ? "rgba(252, 96, 43, 0.35)" : "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Label at the celestial floor
      ctx.font = "8px monospace";
      ctx.fillStyle = diff === 0 ? "rgba(252, 96, 43, 0.7)" : "rgba(255, 255, 255, 0.35)";
      const trueCompassHeading = (rSunAz + diff + 360) % 360;
      ctx.fillText(`${diff > 0 ? "+" : ""}${diff}° (${trueCompassHeading.toFixed(0)}°)`, xGrid + 3, horizonY - 6);
    });

    // 4. Draw horizon boundary
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#141414";
    ctx.stroke();

    // 5. Draw Sun True & Apparent Positions
    const trueSunX = width / 2;
    const trueSunY = height - (((tSunAlt - minAlt) / altRange) * height);
    const sunX = width / 2;
    const sunY = height - (((rSunAlt - minAlt) / altRange) * height);

    // Draw True (Unrefracted) Sun Outline
    if (showAtmosphericLift && Math.abs(sunY - trueSunY) > 0.5) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(trueSunX, trueSunY, 5.5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label for physical sun location
      ctx.font = "6.5px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText("Sun (True)", trueSunX + 8, trueSunY + 2);
    }

    // Solar refraction glare (Apparent Sun)
    const solarGlint = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 30);
    solarGlint.addColorStop(0.0, "rgba(255, 230, 100, 1.0)");
    solarGlint.addColorStop(0.2, "rgba(252, 96, 43, 0.75)");
    solarGlint.addColorStop(0.5, "rgba(252, 96, 43, 0.25)");
    solarGlint.addColorStop(1.0, "rgba(252, 96, 43, 0.0)");

    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = solarGlint;
    ctx.fill();

    // Solar body (Apparent)
    ctx.beginPath();
    ctx.arc(sunX, sunY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#fc602b";
    ctx.stroke();

    // Line from Sun pointing up to x = sunX for azimuth reference
    ctx.beginPath();
    ctx.setLineDash([2, 5]);
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX, horizonY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Draw Moon True & Apparent Positions
    const trueMoonX = ((diffAzTrue - minDiffAz) / azRange) * width;
    const trueMoonY = height - (((tMoonAlt - minAlt) / altRange) * height);
    
    const moonX = ((diffAz - minDiffAz) / azRange) * width;
    const moonY = height - (((rMoonAlt - minAlt) / altRange) * height);

    const isMoonVisibleInCanvas = moonX >= 0 && moonX <= width && moonY >= 0 && moonY <= height;

    if (isMoonVisibleInCanvas) {
      
      // Draw TRUE (Airless / Unrefracted) Moon Wireframe Outline
      if (showAtmosphericLift && (Math.abs(moonX - trueMoonX) > 0.5 || Math.abs(moonY - trueMoonY) > 0.5)) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.setLineDash([2, 2.5]);
        ctx.beginPath();
        ctx.arc(trueMoonX, trueMoonY, 8, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "6.5px monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillText("True Moon", trueMoonX - 22, trueMoonY - 11);

        // Draw dynamic indicator vector connecting true position to apparent refracted position
        ctx.beginPath();
        ctx.moveTo(trueMoonX, trueMoonY);
        ctx.lineTo(moonX, moonY);
        ctx.strokeStyle = "#F59E0B"; // bright amber vector line
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Little arrow arrowhead at apparent position
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(moonX, moonY, 2, 0, 2 * Math.PI);
        ctx.fill();

        // Display Lift in arcminutes next to the arrow
        const liftDeg = rMoonAlt - tMoonAlt;
        const liftArcmin = liftDeg * 60;
        ctx.font = "bold 7px monospace";
        ctx.fillStyle = "#F59E0B";
        ctx.fillText(`+${liftArcmin.toFixed(1)}'`, Math.max(trueMoonX, moonX) + 11, (trueMoonY + moonY) / 2 + 2);
      }

      // Altitude Indicator Line (Moon vertical drop down to Horizon)
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.moveTo(moonX, moonY);
      ctx.lineTo(moonX, horizonY);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Point at horizon base
      ctx.beginPath();
      ctx.arc(moonX, horizonY, 2, 0, 2 * Math.PI);
      ctx.fillStyle = "#fffde1";
      ctx.fill();

      // Draw connection Elongation Line (Sun to Moon vector representation)
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(moonX, moonY);
      ctx.strokeStyle = "rgba(255, 253, 225, 0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Moon body shadow ring
      ctx.beginPath();
      ctx.arc(moonX, moonY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(35, 35, 38, 0.7)";
      ctx.fill();

      // Beautiful customized waxing crescent Hilal pointing geometrically towards Sun
      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, 8, -Math.PI / 2, Math.PI / 2, true);
      ctx.arc(moonX - 2.2, moonY, 8, Math.PI / 2, -Math.PI / 2, false);
      ctx.closePath();
      
      const crescentGlow = ctx.createRadialGradient(moonX, moonY, 1, moonX, moonY, 10);
      crescentGlow.addColorStop(0.0, "#ffffff");
      crescentGlow.addColorStop(0.5, "#fffde1");
      crescentGlow.addColorStop(1.0, "#eef29d");
      
      ctx.fillStyle = crescentGlow;
      ctx.fill();
      ctx.restore();

      // Little outer atmospheric halo rings
      ctx.beginPath();
      ctx.arc(moonX, moonY, 9, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255, 253, 225, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Name label
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#fffde1";
      ctx.fillText("HILAL", moonX + 11, moonY + 3);
    }

  }, [sunsetTime, rMoonAlt, rMoonAz, rSunAlt, rSunAz, tMoonAlt, tMoonAz, tSunAlt, showAtmosphericLift, width, height]);

  // Compass text representation
  const formatCompassDirection = (deg: number): string => {
    const d = (deg + 360) % 360;
    if (d >= 337.5 || d < 22.5) return "Utara (N)";
    if (d >= 22.5 && d < 67.5) return "Timur Laut (NE)";
    if (d >= 67.5 && d < 112.5) return "Timur (E)";
    if (d >= 112.5 && d < 157.5) return "Tenggara (SE)";
    if (d >= 157.5 && d < 202.5) return "Selatan (S)";
    if (d >= 202.5 && d < 247.5) return "Barat Daya (SW)";
    if (d >= 247.5 && d < 292.5) return "Barat (W)";
    return "Barat Laut (NW)";
  };

  const getObserverInstruction = (): string => {
    const azDiffAbs = Math.abs(diffAz);
    const direction = diffAz > 0 ? "kanan (utara)" : "kiri (selatan)";
    const compassStr = formatCompassDirection(rSunAz);
    
    if (rMoonAlt <= 0) {
      return "Hilal berada di bawah ufuk. Pengamatan fisik tidak mungkin dilakukan karena bulan sudah tenggelam.";
    }

    return `Hadapkan kompas ke arah terbenam matahari (${rSunAz.toFixed(1)}° - ${compassStr}). Cari Hilal setebal garis benang sekitar ${azDiffAbs.toFixed(1)}° di sebelah ${direction} matahari, pada ketinggian ${rMoonAlt.toFixed(1)}° di atas cakrawala barat.`;
  };

  // Refraction calculation metrics to display on live-panel
  const computedLiftArcmin = (rMoonAlt - tMoonAlt) * 60;

  return (
    <div className="border border-[#141414] bg-white text-[#141414] font-mono flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#141414] bg-[#D8D7D4] text-[9px] uppercase font-bold tracking-widest flex justify-between items-center select-none">
        <div className="flex items-center gap-1.5 animate-pulse">
          <Compass className="h-3.5 w-3.5" />
          <span>Posisi 2D & Refraksi Cakrawala Senja</span>
        </div>
        
        {/* Toggle dynamic comparison vector */}
        <button 
          onClick={() => setShowAtmosphericLift(!showAtmosphericLift)}
          className={`flex items-center gap-1 px-1.5 py-0.5 border text-[7.5px] font-bold cursor-pointer transition-colors ${showAtmosphericLift ? "bg-amber-500 border-amber-600 text-black" : "bg-white border-black/15 text-[#141414]"}`}
          title="Tampilkan / Sembunyikan pergeseran semu akibat kerapatan atmosfer"
        >
          {showAtmosphericLift ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
          LIFT VECTOR
        </button>
      </div>

      {/* Canvas container */}
      <div className="bg-[#050505] p-2 flex items-center justify-center relative overflow-hidden group select-none">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="mx-auto block aspect-[11/6] max-w-full font-mono"
        />

        {/* Real-time Dynamic Refraction metrics HUD box */}
        <div className="absolute top-2.5 left-2.5 bg-black/85 backdrop-blur-[2px] border border-amber-500/30 p-2 text-[7px] text-gray-300 space-y-1.5 max-w-[170px] pointer-events-none rounded">
          <div className="font-extrabold text-[7.5px] uppercase tracking-wider text-amber-500 border-b border-amber-500/30 pb-1 mb-1 flex items-center gap-1">
            <Sliders className="h-2.5 w-2.5" /> Real-Time Refraction
          </div>
          <div className="space-y-0.5 leading-snug">
            <div>MODEL FILTER: <strong className="float-right text-white">{refractionModel.toUpperCase()}</strong></div>
            <div>UDARA: <strong className="float-right text-white">{pressureMb.toFixed(0)} mbar / {temperatureC.toFixed(1)}°C</strong></div>
            <div className="border-t border-dashed border-white/10 mt-1 pt-1 text-amber-400 font-bold">
              LIFT SEMU: 
              <strong className="float-right text-amber-400">+{computedLiftArcmin.toFixed(2)}' (+{(computedLiftArcmin/60).toFixed(4)}°)</strong>
            </div>
            <div className="text-[6px] text-gray-400 leading-normal uppercase mt-1">
              *Geser tekanan & suhu di sidebar untuk melihat pergeseran semu piringan bulan secara real-time.
            </div>
          </div>
        </div>

        {/* Floating coordinates dashboard */}
        <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-[2px] border border-white/20 p-2 text-[7.5px] text-white space-y-1 max-w-[170px] pointer-events-none rounded">
          <div className="font-bold text-[8px] uppercase tracking-wider text-teal-400 border-b border-white/10 pb-1 mb-1">
            Sistem Koordinat 2D
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">SUN ALT/AZ:</span>
            <span className="font-bold">{rSunAlt.toFixed(2)}° / {rSunAz.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">MOON ALT/AZ:</span>
            <span className="font-bold text-teal-300">{rMoonAlt.toFixed(2)}° / {rMoonAz.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">ARC ELONG:</span>
            <span className="font-bold text-amber-300">{elongationTopoSunset.toFixed(2)}°</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">LOG AGE:</span>
            <span className="font-bold">+{moonAgeHours.toFixed(1)} hrs</span>
          </div>
        </div>

        {/* Visual axis references marker */}
        <div className="absolute bottom-2.5 left-2.5 text-[7px] text-white/50 bg-black/40 px-1 py-0.5 pointer-events-none">
          Zenit ↑ • Horizons Level ↔
        </div>
      </div>

      {/* Interactive Legend / Data Panel */}
      <div className="grid grid-cols-2 text-[8px] border-t border-[#141414] bg-white divide-x divide-[#141414] select-none uppercase font-bold">
        <div className="p-2 flex flex-col justify-between">
          <span className="text-[#141414]/50 leading-none">SELISIH AZIMUTH (DAZ)</span>
          <span className="text-sm font-mono mt-1 text-[#141414]">
            {Math.abs(diffAz).toFixed(2)}° {diffAz > 0 ? "Utara (Kanan)" : "Selatan (Kiri)"}
          </span>
        </div>
        <div className="p-2 flex flex-col justify-between">
          <span className="text-[#141414]/50 leading-none">TITIK BIDIK APPARENT (AZ-ALT)</span>
          <span className="text-sm font-mono mt-1 text-teal-800">
            [ {rMoonAz.toFixed(1)}°, {rMoonAlt.toFixed(1)}° ]
          </span>
        </div>
      </div>

      {/* Guide & Tooltip explanation of geometric factors */}
      <div className="p-3 bg-[#EDEDEB] border-t border-[#141414] text-[9px] leading-normal text-[#141414] space-y-2">
        <div className="font-serif italic text-[#141414]/90 text-justify">
          <strong>Panduan Pengamatan Lapangan:</strong> {getObserverInstruction()}
        </div>
        
        <div className="pt-2 border-t border-[#141414]/10 flex items-center justify-between text-[7px] text-[#141414]/60 uppercase font-mono font-bold">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3 text-[#141414]/80" />
            <span>Ketinggian Grid: Interval 5°</span>
          </div>
          <div className="relative group cursor-help">
            <span className="underline decoration-dotted font-bold hover:text-black">Karakteristik Orbit & Kerapatan Udara ⓘ</span>
            <div className="absolute right-0 bottom-full mb-1.5 w-60 bg-white border border-[#141414] text-[#141414] p-3 text-[8.5px] font-mono normal-case font-normal shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[1000] leading-relaxed text-justify border-l-4 border-l-[#141414]">
              <p className="font-bold uppercase text-[7.5px] tracking-wide mb-1">Kerapatan Udara & Refraksi Astronomi</p>
              Mengapa piringan semu bulan diangkat ke atas? Cahaya dari bulan membias saat memasuki atmosfer bumi yang berkerapatan lebih tinggi. Tekanan udara yang tinggi (mbar) meningkatkan kerapatan gas murni atmosfer, meningkatkan pembiasan cahaya, sedangkan suhu udara yang dingin meningkatkan kerapatan udara, yang memperbesar pembiasan astronomi (Hilal terangkat lebih tinggi secara semu).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
