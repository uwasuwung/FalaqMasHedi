import React, { useRef, useEffect, useState } from "react";
import { Compass, Info, Sun, Moon, HelpCircle } from "lucide-react";

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
}: SkyPositionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredObject, setHoveredObject] = useState<"sun" | "moon" | "grid" | null>(null);

  // Azimuth wrapping calculation
  const getRelativeAzimuth = (targetAz: number, referenceAz: number): number => {
    let diff = targetAz - referenceAz;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return diff;
  };

  const diffAz = getRelativeAzimuth(moonAzTopo, sunAzTopo);

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
    ctx.fillStyle = "#11110f"; // Obsidian obsidian earth plane
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
      const trueCompassHeading = (sunAzTopo + diff + 360) % 360;
      ctx.fillText(`${diff > 0 ? "+" : ""}${diff}° (${trueCompassHeading.toFixed(0)}°)`, xGrid + 3, horizonY - 6);
    });

    // 4. Draw horizon boundary
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#141414";
    ctx.stroke();

    // 5. Draw Sun under/at horizon (Azimuth = 0 offset point)
    const sunX = width / 2;
    const sunY = height - (((sunAltTopo - minAlt) / altRange) * height);

    // Solar refraction glare
    const solarGlint = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 30);
    solarGlint.addColorStop(0.0, "rgba(255, 230, 100, 1.0)");
    solarGlint.addColorStop(0.2, "rgba(252, 96, 43, 0.75)");
    solarGlint.addColorStop(0.5, "rgba(252, 96, 43, 0.25)");
    solarGlint.addColorStop(1.0, "rgba(252, 96, 43, 0.0)");

    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = solarGlint;
    ctx.fill();

    // Solar body
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

    // 6. Draw Moon (Hilal)
    const moonX = ((diffAz - minDiffAz) / azRange) * width;
    const moonY = height - (((moonAltTopo - minAlt) / altRange) * height);

    const isMoonVisibleInCanvas = moonX >= 0 && moonX <= width && moonY >= 0 && moonY <= height;

    if (isMoonVisibleInCanvas) {
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
      // We clip outer/inner arcs to represent a thin crescent facing downwards/towards sunX
      ctx.save();
      ctx.beginPath();
      // Thin golden crescent crescent path
      // Waxing crescent curve
      ctx.arc(moonX, moonY, 8, -Math.PI / 2, Math.PI / 2, true);
      // Offset arc representing the terminator shadow boundary
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

  }, [sunsetTime, moonAltTopo, moonAzTopo, sunAltTopo, sunAzTopo, diffAz, width, height]);

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
    const compassStr = formatCompassDirection(sunAzTopo);
    
    if (moonAltTopo <= 0) {
      return "Hilal berada di bawah ufuk. Pengamatan fisik tidak mungkin dilakukan karena bulan sudah tenggelam.";
    }

    return `Hadapkan kompas ke arah terbenam matahari (${sunAzTopo.toFixed(1)}° - ${compassStr}). Cari Hilal setebal garis benang sekitar ${azDiffAbs.toFixed(1)}° di sebelah ${direction} matahari, pada ketinggian ${moonAltTopo.toFixed(1)}° di atas cakrawala barat.`;
  };

  return (
    <div className="border border-[#141414] bg-white text-[#141414] font-mono flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#141414] bg-[#D8D7D4] text-[9px] uppercase font-bold tracking-widest flex justify-between items-center select-none">
        <div className="flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5" />
          <span>Posisi 2D Cakrawala Senja (Hilal Finder)</span>
        </div>
        <span className="opacity-60 text-[8px]">PROYEKSI AZ-ALT</span>
      </div>

      {/* Canvas container */}
      <div className="bg-[#050505] p-2 flex items-center justify-center relative overflow-hidden group select-none">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="mx-auto block aspect-[11/6] max-w-full"
        />

        {/* Floating coordinates dashboard */}
        <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-[2px] border border-white/20 p-2 text-[7.5px] text-white space-y-1 max-w-[170px] pointer-events-none rounded">
          <div className="font-bold text-[8px] uppercase tracking-wider text-amber-400 border-b border-white/10 pb-1 mb-1">
            Sistem Koordinat 2D
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">SUN ALT/AZ:</span>
            <span className="font-bold">{sunAltTopo.toFixed(2)}° / {sunAzTopo.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">MOON ALT/AZ:</span>
            <span className="font-bold text-amber-300">{moonAltTopo.toFixed(2)}° / {moonAzTopo.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="opacity-60">ARC ELONG:</span>
            <span className="font-bold text-teal-300">{elongationTopoSunset.toFixed(2)}°</span>
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
          <span className="text-[#141414]/50 leading-none">TITIK BIDIK (AZ-ALT)</span>
          <span className="text-sm font-mono mt-1 text-teal-800">
            [ {moonAzTopo.toFixed(1)}°, {moonAltTopo.toFixed(1)}° ]
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
            <span className="underline decoration-dotted font-bold hover:text-black">Karakteristik Orbit ⓘ</span>
            <div className="absolute right-0 bottom-full mb-1.5 w-60 bg-white border border-[#141414] text-[#141414] p-3 text-[8.5px] font-mono normal-case font-normal shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[1000] leading-relaxed text-justify border-l-4 border-l-[#141414]">
              <p className="font-bold uppercase text-[7.5px] tracking-wide mb-1">Kemiringan Orbit & Sudut Paralaks</p>
              Lintasan Hilal tidak lurus vertikal dari matahari karena sudut inklinasi bidang orbit bulan (~5.14°) dan paralaks toposentrik pengamat. Ini memindahkan proyeksi hilal ke arah kiri atau kanan harian, di mana perbedaannya diidentifikasi sebagai beda azimuth (DAZ).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
