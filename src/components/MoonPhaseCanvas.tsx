import React, { useRef, useEffect } from "react";
import { Body, Illumination, MakeTime } from "astronomy-engine";
import { HelpCircle } from "lucide-react";

interface MoonPhaseCanvasProps {
  date: Date;
  size?: number;
}

export default function MoonPhaseCanvas({ date, size = 120 }: MoonPhaseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Safely grab illumination calculations
  const time = MakeTime(date);
  const illumInfo = Illumination(Body.Moon, time);
  const fraction = illumInfo.phase_fraction; // 0.0 to 1.0 (sunlit percentage)
  const angle = illumInfo.phase_angle; // 0.0 (full) to 180.0 (new)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, size, size);

    const radius = size * 0.42;
    const cx = size / 2;
    const cy = size / 2;

    // Hilal is by definition waxing crescent (growing light on right side)
    const isWaxing = true; 

    // Draw total shadow outer orbit ring (the darkened body of the moon)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#161614"; // Eerie dark lunar shadow
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#141414";
    ctx.stroke();

    // Draw the actual sunlit portions slice by slice for maximum realistic curves
    ctx.fillStyle = "#F6F5F2"; 
    ctx.strokeStyle = "#F6F5F2";
    
    // We render horizontal lines (strips) inside the circle representing the 3D-projected terminator
    for (let y = -radius; y <= radius; y++) {
      const r_y = Math.sqrt(radius * radius - y * y);
      const x_left = -r_y;
      const x_right = r_y;

      // The terminator path represents a semi-ellipse on x-axis with width based on cos(angle)
      const cosAngle = Math.cos(angle * Math.PI / 180);
      
      let xStart = 0;
      let xEnd = 0;

      if (isWaxing) {
        // Waxing crescent: light occupies right side
        xStart = r_y * cosAngle;
        xEnd = x_right;
      } else {
        // Waning crescent: light occupies left side
        xStart = x_left;
        xEnd = r_y * cosAngle;
      }

      // Draw horizontal line segment
      if (xEnd > xStart) {
        ctx.beginPath();
        ctx.moveTo(cx + xStart, cy + y);
        ctx.lineTo(cx + xEnd, cy + y);
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }

    // Give a beautiful soft outer halo glow to represent the atmospheric diffuse reflection
    if (fraction > 0.005) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(246, 245, 242, 0.4)";
      ctx.stroke();
    }

  }, [date, size, angle, fraction]);

  return (
    <div className="border border-[#141414] bg-white text-[#141414] flex flex-col font-mono h-full">
      {/* Header of card */}
      <div className="px-3 py-1.5 border-b border-[#141414] bg-[#D8D7D4] text-[9px] uppercase font-bold tracking-widest flex justify-between items-center select-none">
        <span>Fase Fisik Hilal Baru (Moon Phase)</span>
        <span className="opacity-60 text-[8px]">DIGITAL CANVAS OBS</span>
      </div>

      {/* Visual content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white select-none">
        <div className="relative mb-3 flex items-center justify-center">
          {/* Circular frame */}
          <div className="p-3 bg-[#111111] rounded-full shadow-2xl border border-[#141414]">
            <canvas 
              ref={canvasRef} 
              width={size} 
              height={size} 
              className="rounded-full select-none"
              style={{ display: "block" }}
            />
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-bold tracking-tight text-[#141414]">
            {(fraction * 100).toFixed(4)}% <span className="text-[10px] text-[#141414]/65">Sunlit</span>
          </p>
          <div className="flex justify-center gap-3 text-[9px] uppercase font-bold text-[#141414]/60">
            <span>Elongasi: {angle.toFixed(2)}°</span>
            <span>Rasio: {fraction.toFixed(5)}</span>
          </div>
        </div>
      </div>

      {/* Information footer */}
      <div className="p-3 bg-[#EDEDEB] border-t border-[#141414] text-[9px] leading-relaxed text-[#141414]/80 text-justify">
        <p className="font-serif italic flex gap-1 items-start">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[#141414]/60 mt-0.5" />
          <span>Fase bulan dan persentase penyinaran dihitung tepat pada saat matahari tenggelam di waktu murni astronomis. Ketinggian cahaya ideal (visibilitas rukyat murni) mensyaratkan elongasi minimal 6.4° agar piringan bulan memancarkan cahaya terpisah dari pendar lembayung senja.</span>
        </p>
      </div>
    </div>
  );
}
