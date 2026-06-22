import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Camera, 
  Video, 
  Trash2, 
  Sliders, 
  Compass, 
  Maximize, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Eye, 
  Tag, 
  PlusCircle, 
  Crosshair, 
  Filter, 
  Info, 
  Image as ImageIcon 
} from "lucide-react";

interface TelescopeIntegrationProps {
  latitude: number;
  longitude: number;
  elevation: number;
  markazName: string;
  hijriYear: number;
  hijriMonthName: string;
  onAddLog: (message: string) => void;
  moonAzimuth: number; // calculated from parent or simulated
  moonAltitude: number; // calculated from parent or simulated
  sunAltitude: number;
  moonElongation: number;
  moonAge: number;
}

interface ObservationPhoto {
  id: string;
  timestamp: string;
  imageUrl: string; 
  latitude: number;
  longitude: number;
  elevation: number;
  markaz: string;
  moonAlt: number;
  moonAz: number;
  sunAlt: number;
  elongation: number;
  age: number;
  filtersUsed: string[];
  notes: string;
}

export default function TelescopeIntegration({
  latitude,
  longitude,
  elevation,
  markazName,
  hijriYear,
  hijriMonthName,
  onAddLog,
  moonAzimuth = 278.4,
  moonAltitude = 6.2,
  sunAltitude = -4.5,
  moonElongation = 8.4,
  moonAge = 1.2
}: TelescopeIntegrationProps) {
  // Video Source Management
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("simulator");
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Filter Styles
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [exposure, setExposure] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [brightness, setBrightness] = useState<number>(100);
  const [imageFilter, setImageFilter] = useState<"none" | "sobel" | "threshold" | "invert" | "infrared">("none");
  const [thresholdLevel, setThresholdLevel] = useState<number>(128);
  const [showReticle, setShowReticle] = useState<boolean>(true);

  // Interactive Angle Ruler tool
  const [rulerPoints, setRulerPoints] = useState<{ x: number; y: number }[]>([]);
  const [measuringMode, setMeasuringMode] = useState<boolean>(false);

  // Gallery
  const [capturedPhotos, setCapturedPhotos] = useState<ObservationPhoto[]>(() => {
    try {
      const saved = localStorage.getItem("integral_hilal_captured_photos");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedPhoto, setSelectedPhoto] = useState<ObservationPhoto | null>(null);
  const [photoNotes, setPhotoNotes] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Save photos to storage
  useEffect(() => {
    try {
      localStorage.setItem("integral_hilal_captured_photos", JSON.stringify(capturedPhotos));
    } catch (e) {
      console.error("Gagal menyimpan galeri foto:", e);
    }
  }, [capturedPhotos]);

  // Enumerate video input devices
  const loadVideoDevices = async () => {
    try {
      // Prompt permission first to get labels
      await navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0 && selectedDeviceId === "simulator") {
        // keep simulator or default first
      }
    } catch (err: any) {
      console.error("Gagal membaca hardware kamera:", err);
      onAddLog(`[KAMERA] Peringatan: Tidak dapat mendeteksi daftar input video hardware.`);
    }
  };

  useEffect(() => {
    loadVideoDevices();
  }, []);

  // Handle stream initialization & processing loop
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const stopStream = () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
      }
      setStreamActive(false);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };

    if (selectedDeviceId !== "simulator") {
      setCameraError(null);
      navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      .then(stream => {
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error(e));
        }
        setStreamActive(true);
        onAddLog(`[HARDWARE] Terhubung ke perangkat input video: "${videoDevices.find(d => d.deviceId === selectedDeviceId)?.label || 'Kamera USB'}"`);
      })
      .catch(err => {
        console.error("Gagal membuka kamera:", err);
        setCameraError("Tidak dapat mengakses kamera terpilih. Pastikan izin browser diberikan.");
        setSelectedDeviceId("simulator");
        onAddLog(`[HARDWARE] GAGAL menghubungkan kamera: ${err.message}. Mengalihkan ke simulator.`);
      });
    }

    return () => {
      stopStream();
    };
  }, [selectedDeviceId]);

  // Canvas drawing loop (handles effects & simulator drawing)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw source (either hardware video or simulator background)
      if (selectedDeviceId !== "simulator" && videoRef.current && streamActive) {
        // Draw video frame
        // Apply scaling for zoom from center
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.drawImage(videoRef.current, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        // Draw physical telescope simulator (Sky & Crescent)
        ctx.fillStyle = "#1E2B3E"; // senja deep blue twilight sky
        
        // Ambient twilight gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, "#080F1D"); // high sky deep blue
        skyGrad.addColorStop(0.5, "#1B2A4A");
        skyGrad.addColorStop(0.85, "#934336"); // orange horizon sunset glow
        skyGrad.addColorStop(1, "#9D4B32"); // red horizon edge
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Draw Stars (twinkling subtle stars)
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (let i = 0; i < 35; i++) {
          const x = (Math.sin(i * 92 + Date.now() * 0.0001) * 0.5 + 0.5) * width;
          const y = (Math.cos(i * 12 + Date.now() * 0.00005) * 0.5 + 0.5) * (height * 0.7);
          ctx.fillRect(x, y, 1.2, 1.2);
        }

        // Draw Sun setting (sub-horizon glow reflection)
        const sunX = width / 2 + (moonAzimuth - 270) * 12;
        const sunY = height * 0.95; // below horizon
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 150);
        sunGlow.addColorStop(0, "rgba(255, 180, 100, 0.6)");
        sunGlow.addColorStop(0.3, "rgba(242, 106, 56, 0.3)");
        sunGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 150, 0, Math.PI, true);
        ctx.fill();

        // DRAW HILAL (The extremely thin crescent moon)
        ctx.save();
        // Zoom translation
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomLevel, zoomLevel);

        // Center on Moon dynamic tracking offsets (slightly offset based on actual values)
        const moonX = 0;
        const moonY = -40; // centered in reticle

        // Thin Crescent Moon
        // Inner moon disk size
        const r = 24; 
        
        // Draw moon crescent shape
        ctx.shadowColor = "rgba(255, 235, 180, 0.35)";
        ctx.shadowBlur = 8;

        // Draw a gorgeous physically stylized crescent moon pointing upwards-left (WIB Rukyat angle)
        ctx.fillStyle = "rgba(255, 248, 220, 0.95)";
        ctx.beginPath();
        // Outer arc (illuminated limb)
        ctx.arc(moonX, moonY, r, 0.1 * Math.PI, 1.1 * Math.PI, false);
        // Inner arc (shadow terminator offset representing elongation & moon age width)
        const crescentThickness = Math.max(0.6, Math.min(2.8, moonElongation * 0.22));
        ctx.arc(moonX - crescentThickness, moonY - 0.7, r - 0.95, 1.08 * Math.PI, 0.12 * Math.PI, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Heavy Atmospheric Volumetric Noise (Heat haze shimmer / turbulensi atmosfer)
        const time = Date.now() * 0.002;
        ctx.fillStyle = "rgba(242, 106, 56, 0.02)";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, height * 0.8 + Math.sin(time + i) * 6);
          ctx.bezierCurveTo(
            width * 0.25, height * 0.75 + Math.cos(time - i) * 8,
            width * 0.75, height * 0.85 + Math.sin(time * 0.5 + i) * 10,
            width, height * 0.8 + Math.cos(time + i) * 6
          );
          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.closePath();
          ctx.fill();
        }

        // Simulative digital telescope stats watermark overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "7px monospace";
        ctx.fillText(`SIMULASI KONEKSI TELESKOP: BAADER PLANETARIUM TDK-280`, 16, height - 32);
        ctx.fillText(`LUNAR TRACKING ACTIVE | GUIDING ACCURACY: 0.12 ASC`, 16, height - 22);
      }

      // 2. APPLY IMAGE FILTERS (Brightness, Contrast, Exposure, Sepia/Edge) on current Canvas data
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      // Custom brightness/contrast/exposure transformation
      // formula: pixel_val = (pixel_val - 128) * (contrast/100) + 128 + exposure_adjustment
      const expFactor = exposure / 100;
      const cntFactor = contrast / 100;
      const bgtFactor = brightness - 100;

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i];
        let g = d[i+1];
        let b = d[i+2];

        // Exposure & contrast
        r = (r * expFactor - 128) * cntFactor + 128 + bgtFactor;
        g = (g * expFactor - 128) * cntFactor + 128 + bgtFactor;
        b = (b * expFactor - 128) * cntFactor + 128 + bgtFactor;

        d[i] = Math.max(0, Math.min(255, r));
        d[i+1] = Math.max(0, Math.min(255, g));
        d[i+2] = Math.max(0, Math.min(255, b));
      }

      // Advanced Astronomy Digital Filter Modes
      if (imageFilter === "invert") {
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 255 - d[i];
          d[i+1] = 255 - d[i+1];
          d[i+2] = 255 - d[i+2];
        }
      } else if (imageFilter === "infrared") {
        // Infrared filter isolates contrast peaks (mostly grayscale with heavy red weighting)
        for (let i = 0; i < d.length; i += 4) {
          const gray = Math.round(d[i] * 0.7 + d[i+1] * 0.25 + d[i+2] * 0.05); // High weight to infrared-friendly red channel
          d[i] = gray;
          d[i+1] = Math.max(0, gray - 20); // greenish cool tint for tactical feedback
          d[i+2] = Math.max(0, gray - 40);
        }
      } else if (imageFilter === "threshold") {
        // Binarization filters to prove pixel contrast gaps
        for (let i = 0; i < d.length; i += 4) {
          const gray = (d[i] + d[i+1] + d[i+2]) / 3;
          const val = gray >= thresholdLevel ? 255 : 0;
          d[i] = val;
          d[i+1] = val;
          d[i+2] = val;
        }
      } else if (imageFilter === "sobel") {
        // Simple Sobel edge detection to map out crescent contour bounds
        // Sobel filter is computed in a custom subpass on gray values
        const buffer = new Uint8Array(width * height);
        for (let i = 0; i < d.length; i += 4) {
          buffer[i/4] = (d[i] + d[i+1] + d[i+2]) / 3;
        }

        // Sobel kernels
        // gx = [-1 0 1, -2 0 2, -1 0 1], gy = [-1 -2 -1,  0  0  0,  1  2  1]
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            const v00 = buffer[idx - width - 1];
            const v01 = buffer[idx - width];
            const v02 = buffer[idx - width + 1];
            const v10 = buffer[idx - 1];
            const v12 = buffer[idx + 1];
            const v20 = buffer[idx + width - 1];
            const v21 = buffer[idx + width];
            const v22 = buffer[idx + width + 1];

            const gx = -v00 + v02 - 2*v10 + 2*v12 - v20 + v22;
            const gy = -v00 - 2*v01 - v02 + v20 + 2*v21 + v22;

            let val = Math.sqrt(gx*gx + gy*gy) * 2.2; // edge amplification
            val = val > 95 ? 255 : 0; // contrast sharpening

            const pixIdx = idx * 4;
            d[pixIdx] = val;
            d[pixIdx+1] = val * 0.9;
            d[pixIdx+2] = val * 0.45; // Golden edge trace color
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // 3. DRAW MEASURING RULES, RETICLE & COMPASS OVERLAYS (on top of filtered pixel arrays)
      if (showReticle) {
        ctx.strokeStyle = "rgba(4, 255, 4, 0.45)"; // High viz tactical green reticle
        ctx.lineWidth = 1.0;

        // Draw crosshair center
        ctx.beginPath();
        ctx.moveTo(width / 2, 20); ctx.lineTo(width / 2, height - 20);
        ctx.moveTo(20, height / 2); ctx.lineTo(width - 20, height / 2);
        ctx.stroke();

        // Concentric tracking circles (represented in altitude/azimuth radial grid steps of 1°, 2°, 3°)
        ctx.strokeStyle = "rgba(4, 255, 4, 0.25)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 45, 0, Math.PI * 2);
        ctx.arc(width / 2, height / 2, 90, 0, Math.PI * 2);
        ctx.arc(width / 2, height / 2, 140, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Azimuth ticks on borders
        ctx.fillStyle = "rgba(4, 255, 4, 0.7)";
        ctx.font = "8px font-mono";
        ctx.fillText("N (000°)", width / 2 - 18, 15);
        ctx.fillText("S (180°)", width / 2 - 18, height - 8);
        ctx.fillText("W (270°)", 10, height / 2 + 3);
        ctx.fillText("E (090°)", width - 48, height / 2 + 3);

        // Center cursor coordinate tags
        ctx.fillStyle = "rgba(4, 255, 4, 0.8)";
        ctx.font = "7.5px monospace";
        ctx.fillText(`TELESCOPE FOV: 1.2° | ELEVATION LOCK`, width / 2 + 8, height / 2 - 8);
        ctx.fillText(`ALT: ${moonAltitude.toFixed(2)}° | AZ: ${moonAzimuth.toFixed(2)}°`, width / 2 + 8, height / 2 + 12);
      }

      // Drawing Ruler Lines
      if (rulerPoints.length > 0) {
        ctx.strokeStyle = "#F59E0B"; // Amber ruler line
        ctx.fillStyle = "#F59E0B";
        ctx.lineWidth = 1.5;

        // Draw points & lines
        rulerPoints.forEach((p, index) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "9px monospace";
          ctx.fillText(`P${index + 1}`, p.x + 6, p.y - 4);
        });

        if (rulerPoints.length === 2) {
          const p1 = rulerPoints[0];
          const p2 = rulerPoints[1];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Calculate raw distance
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const pixelDist = Math.sqrt(dx * dx + dy * dy);
          
          // Convert pixels to simulative arcminutes of telescope view (assuming a field of view of 1.2 degrees across an 800px width canvas)
          // FOV height = 450px = 67.5 arcminutes (0.15' per pixel)
          const arcMinutes = pixelDist * 0.15;

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2 - 8;
          ctx.font = "bold 9px monospace";
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "#000000";
          ctx.shadowBlur = 4;
          ctx.fillText(`Δθ = ${arcMinutes.toFixed(1)}' (${(arcMinutes / 60).toFixed(2)}°)`, midX - 30, midY);
          ctx.shadowBlur = 0; // reset
        }
      }

      localFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(localFrameId);
    };
  }, [
    selectedDeviceId, streamActive, zoomLevel, exposure, contrast, brightness, 
    imageFilter, thresholdLevel, showReticle, rulerPoints, moonAzimuth, moonAltitude
  ]);

  // Handle click on canvas for measuring tool or focus
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measuringMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    setRulerPoints(prev => {
      if (prev.length >= 2) {
        return [{ x, y }]; // Reset with first point
      } else {
        return [...prev, { x, y }];
      }
    });
  };

  // Capture Snapshot & Burn Watermark Data onto captured image
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // We will create a high-resolution canvas to burn the watermark permanently
    const burnCanvas = document.createElement("canvas");
    burnCanvas.width = canvas.width;
    burnCanvas.height = canvas.height;
    
    const bctx = burnCanvas.getContext("2d");
    if (!bctx) return;

    // Draw the current state of observation view
    bctx.drawImage(canvas, 0, 0);

    // Render permanent professional burn watermark
    bctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    bctx.fillRect(0, burnCanvas.height - 52, burnCanvas.width, 52);

    bctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(0, burnCanvas.height - 52);
    bctx.lineTo(burnCanvas.width, burnCanvas.height - 52);
    bctx.stroke();

    // Text labels
    bctx.font = "8px monospace";
    bctx.fillStyle = "#FFFFFF";
    
    const col1X = 14;
    const col2X = burnCanvas.width * 0.32;
    const col3X = burnCanvas.width * 0.65;
    const rowY1 = burnCanvas.height - 38;
    const rowY2 = burnCanvas.height - 25;
    const rowY3 = burnCanvas.height - 12;

    const localTimeStr = new Date().toLocaleString("id-ID", { timeZoneName: "short" });

    // Col 1: Markaz & Location
    bctx.fillText(`MARKAZ: ${markazName.toUpperCase()}`, col1X, rowY1);
    bctx.fillText(`GEO: Lat ${latitude.toFixed(4)}°, Lon ${longitude.toFixed(4)}°`, col1X, rowY2);
    bctx.fillText(`ELV: ${elevation} M | TANGGAL: ${localTimeStr}`, col1X, rowY3);

    // Col 2: Celestial Coordinates
    bctx.fillText(`ALTITUDE BULAN: +${moonAltitude.toFixed(3)}°`, col2X, rowY1);
    bctx.fillText(`AZIMUTH BULAN:  ${moonAzimuth.toFixed(3)}°`, col2X, rowY2);
    bctx.fillText(`ALTITUDE MATAHARI: ${sunAltitude.toFixed(3)}°`, col2X, rowY3);

    // Col 3: Parameters Verification
    bctx.fillText(`ELONGASI: ${moonElongation.toFixed(2)}° | UMUR: ${moonAge.toFixed(2)}h`, col3X, rowY1);
    const filterDesc = imageFilter === "none" ? "MURNI (NO FILTER)" : `FILTER: ${imageFilter.toUpperCase()}`;
    bctx.fillText(`PEMROSESAN CITRA: ${filterDesc} | ZOOM: ${zoomLevel}x`, col3X, rowY2);
    const estText = moonAltitude > 2 ? "HILAL MEMENUHI KRITERIA ESTIMULASI" : "HILAL SANGAT TIPIS (DI BAWAH UFUK/KRITERIA)";
    bctx.fillText(`INTEGRAL STATUS: ${estText}`, col3X, rowY3);

    // Generate downsample data URL
    const imageUrl = burnCanvas.toDataURL("image/jpeg", 0.9);

    const newPhoto: ObservationPhoto = {
      id: "snap_" + Date.now(),
      timestamp: new Date().toLocaleTimeString("id-ID") + " WIB - " + hijriMonthName + " " + hijriYear + " H",
      imageUrl,
      latitude,
      longitude,
      elevation,
      markaz: markazName,
      moonAlt: moonAltitude,
      moonAz: moonAzimuth,
      sunAlt: sunAltitude,
      elongation: moonElongation,
      age: moonAge,
      filtersUsed: imageFilter !== "none" ? [imageFilter] : [],
      notes: "Citra pengamatan berhasil ditangkap melalui antarmuka kamera terintegrasi."
    };

    setCapturedPhotos(prev => [newPhoto, ...prev]);
    onAddLog(`[HARDWARE] Capture Foto Sukses: "${newPhoto.id}" tersimpan ke database galeri lokal.`);
    
    // Highlight first caught photo
    setSelectedPhoto(newPhoto);
    setPhotoNotes(newPhoto.notes);
  };

  // Delete observation photo
  const handleDeletePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Apakah anda yakin ingin menghapus foto pengamatan ini?")) {
      setCapturedPhotos(prev => prev.filter(p => p.id !== id));
      if (selectedPhoto?.id === id) {
        setSelectedPhoto(null);
      }
      onAddLog(`[GALERI] Foto pengamatan "${id}" berhasil dihapus.`);
    }
  };

  // Save notes to active photo
  const handleSavePhotoNotes = () => {
    if (!selectedPhoto) return;
    setCapturedPhotos(prev => prev.map(p => {
      if (p.id === selectedPhoto.id) {
        return { ...p, notes: photoNotes };
      }
      return p;
    }));
    setSelectedPhoto(prev => prev ? { ...prev, notes: photoNotes } : null);
    onAddLog(`[GALERI] Catatan pengamatan untuk foto ${selectedPhoto.id} diperbarui.`);
  };

  return (
    <div className="border border-[#141414] bg-[#EDEDEB]">
      {/* SECTION PANEL HEADER */}
      <div className="p-4 border-b border-[#141414] bg-[#D1D0CC] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Camera className="h-4.5 w-4.5 text-[#141414]" />
          <div>
            <h3 className="text-xs uppercase font-bold tracking-widest font-mono text-[#141414]">Konektor Perangkat Keras Pengamatan & Kamera Teleskop</h3>
            <p className="text-[10px] font-serif italic text-[#141414]/70">Integrasi real-time input capture card teleskop, sistem perekaman fotometri, penapis digital kontras tinggi, dan penaksir sudut retikel.</p>
          </div>
        </div>

        {/* INPUT HARDWARE SELECTOR */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="font-bold opacity-60">INPUT DEVICE:</span>
          <select 
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="bg-white border border-[#141414] px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-0 text-[#141414]"
          >
            <option value="simulator">🎮 TELESCOPE VIEW SIMULATOR (VIRTUAL FEEDS)</option>
            {videoDevices.map((device, idx) => (
              <option key={device.deviceId} value={device.deviceId}>
                📷 {device.label || `Device Input #${idx + 1}`}
              </option>
            ))}
          </select>
          <button 
            onClick={loadVideoDevices}
            className="p-1 bg-white hover:bg-gray-100 border border-[#141414] cursor-pointer"
            title="Muat Ulang Perangkat Hardware"
          >
            <RefreshCw className="h-3 w-3 text-[#141414]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#141414]">
        
        {/* VIEWPORT CONTROLS COLUMN */}
        <div className="p-4 space-y-4 lg:col-span-1 select-none">
          <h4 className="text-[9px] font-mono font-black uppercase text-[#141414]/80 flex items-center gap-1 border-b border-black/10 pb-1.5">
            <Sliders className="h-3.5 w-3.5 text-[#141414]" /> Parameter Penapis Optik
          </h4>

          {/* ZOOM LEVEL */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8px] uppercase font-mono font-bold text-[#141414]/70">
              <span>Perbesaran Digital</span>
              <span className="font-bold bg-[#141414] text-white px-1.5 rounded-sm">{zoomLevel.toFixed(1)}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="10.0" 
              step="0.1"
              value={zoomLevel} 
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
            />
          </div>

          {/* EXPOSURE */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8px] uppercase font-mono font-bold text-[#141414]/70">
              <span>Rana Eksposur</span>
              <span className="font-bold">{exposure}%</span>
            </div>
            <input 
              type="range" 
              min="20" 
              max="250" 
              step="5"
              value={exposure} 
              onChange={(e) => setExposure(parseInt(e.target.value))}
              className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
            />
          </div>

          {/* CONTRAST */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8px] uppercase font-mono font-bold text-[#141414]/70">
              <span>Kontras Citra</span>
              <span className="font-bold">{contrast}%</span>
            </div>
            <input 
              type="range" 
              min="50" 
              max="300" 
              step="5"
              value={contrast} 
              onChange={(e) => setContrast(parseInt(e.target.value))}
              className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
            />
          </div>

          {/* BRIGHTNESS */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8px] uppercase font-mono font-bold text-[#141414]/70">
              <span>Kecerahan</span>
              <span className="font-bold">{brightness}%</span>
            </div>
            <input 
              type="range" 
              min="30" 
              max="200" 
              step="5"
              value={brightness} 
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
            />
          </div>

          {/* DIGITAL IMAGE PROCESSING MODE */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[8px] uppercase font-mono font-bold text-[#141414]/70">Mode Penapis Digital Fotometri:</label>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[8px] font-bold">
              <button 
                onClick={() => setImageFilter("none")}
                className={`py-1 border cursor-pointer transition-all ${imageFilter === "none" ? "bg-[#141414] text-white border-[#141414]" : "bg-white text-[#141414] border-black/15"}`}
              >
                MURNI
              </button>
              <button 
                onClick={() => setImageFilter("infrared")}
                className={`py-1 border cursor-pointer transition-all ${imageFilter === "infrared" ? "bg-[#141414] text-white border-[#141414]" : "bg-white text-[#141414] border-black/15"}`}
                title="Bagus untuk hilal siang/sore mengeliminasi kabut duga"
              >
                INFRAMERAH (IR)
              </button>
              <button 
                onClick={() => setImageFilter("sobel")}
                className={`py-1 border cursor-pointer transition-all ${imageFilter === "sobel" ? "bg-[#141414] text-white border-[#141414]" : "bg-white text-[#141414] border-black/15"}`}
                title="Deteksi tepi kontur hilal tipis secara real-time"
              >
                KONTUR (SOBEL)
              </button>
              <button 
                onClick={() => setImageFilter("invert")}
                className={`py-1 border cursor-pointer transition-all ${imageFilter === "invert" ? "bg-[#141414] text-white border-[#141414]" : "bg-white text-[#141414] border-black/15"}`}
                title="Membalikkan kecerahan untuk mengulas gradasi warna sabit"
              >
                INVERSI
              </button>
            </div>
          </div>

          {imageFilter === "threshold" && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[8px] uppercase font-mono font-bold text-[#141414]/70">
                <span>Ambang Threshold</span>
                <span className="font-bold">{thresholdLevel}</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="220" 
                step="2"
                value={thresholdLevel} 
                onChange={(e) => setThresholdLevel(parseInt(e.target.value))}
                className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
              />
            </div>
          )}

          <div className="border border-dashed border-[#141414]/30 bg-amber-50/45 p-2 space-y-1 text-[8.5px] font-mono leading-relaxed text-[#141414]/80">
            <div className="flex items-center gap-1 font-bold text-[#b45309]">
              <Info className="h-3 w-3 shrink-0" /> METODE FOTOMETRI INFORMASI:
            </div>
            <span>Pengamat rukyat profesional Indonesia umumnya menggunakan filter optik inframerah 850nm untuk memotong hamburan cahaya biru senja atmosfer demi memaksimalkan kontras sabit Hilal. Gunakan penapis **INFRAMERAH SIMULASI** dia atas untuk reproduksi kontras tersebut.</span>
          </div>
        </div>

        {/* ACTIVE BROADCAST VIEWPORT COLUMN */}
        <div className="p-4 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center bg-white border border-[#141414] px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span className="text-[9px] font-mono font-black uppercase text-[#141414]">LIVE FEED TELESKOP & KAMERA</span>
            </div>

            {/* VISIBILITY TOGGLES */}
            <div className="flex items-center gap-2 font-mono text-[8.5px] font-bold">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showReticle}
                  onChange={(e) => setShowReticle(e.target.checked)}
                  className="accent-[#141414] cursor-pointer"
                />
                RETICEL GRID
              </label>
              
              <button
                onClick={() => {
                  setMeasuringMode(!measuringMode);
                  setRulerPoints([]);
                }}
                className={`px-2 py-0.5 border cursor-pointer flex items-center gap-1 ${measuringMode ? "bg-amber-500 text-black border-amber-600 font-extrabold" : "bg-white text-[#141414] border-black/20"}`}
                title="Gunakan jangka pengukur sudut antar dua piksel (Klik dua lokasi di video)"
              >
                <Crosshair className="h-2.5 w-2.5" /> JANGKA SUDUT DETEKSI
              </button>
            </div>
          </div>

          {/* HTML5 CAMERA / FALLBACK SIMULATION */}
          <div className="relative border border-[#141414] bg-black aspect-video overflow-hidden group select-none">
            {/* Real HTML5 Hidden Video Element */}
            {selectedDeviceId !== "simulator" && (
              <video 
                ref={videoRef}
                style={{ display: "none" }}
                playsInline
                muted
              />
            )}

            {/* Render Output Canvas */}
            <canvas 
              ref={canvasRef}
              width={800}
              height={450}
              onClick={handleCanvasClick}
              className={`w-full h-full block object-cover ${measuringMode ? 'cursor-cell' : 'cursor-default'}`}
            />

            {/* ERROR COVER */}
            {cameraError && (
              <div className="absolute inset-0 bg-[#1E2B3E] flex flex-col items-center justify-center p-6 text-center text-rose-200 z-10 font-mono">
                <span className="text-sm font-bold uppercase tracking-wider mb-2">Akses Gagal Perangkat</span>
                <p className="text-xs leading-normal max-w-sm">{cameraError}</p>
                <button 
                  onClick={() => { setCameraError(null); setSelectedDeviceId("simulator"); }}
                  className="mt-4 px-3 py-1 bg-white text-black border border-black font-bold uppercase text-[9px] hover:bg-gray-100 transition-all"
                >
                  Kembali ke Simulator
                </button>
              </div>
            )}

            {/* Active Measure Tool Tag overlay */}
            {measuringMode && (
              <div className="absolute left-2.5 top-2.5 bg-amber-500 text-black border border-[#141414] text-[8.5px] font-mono font-black uppercase px-2 py-1 flex items-center gap-1 rounded shadow-sm z-10 selection:bg-transparent">
                <Crosshair className="h-3 w-3 animate-spin"/>
                <span>RULER AKTIF: Klik 2 Titik untuk mengukur jarak sudut elongasi / tebal hilal (Aproksimatif)</span>
              </div>
            )}
          </div>

          {/* TAKING PICTURE TRIGGER BUTTON */}
          <div className="flex gap-2">
            <button
              onClick={handleCaptureSnapshot}
              className="flex-1 py-2.5 px-4 bg-[#141414] text-[#E4E3E0] hover:bg-amber-500 hover:text-black border border-[#141414] font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[3px_3px_0px_0px_#141414] hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
            >
              <Camera className="h-4.5 w-4.5" />
              <span>LOG & AMBIL SNAPSHOT FOTO PENGAMATAN KRITIS</span>
            </button>
          </div>
        </div>

        {/* IMAGE HISTORY & ANALYSIS METRICS */}
        <div className="p-4 lg:col-span-1 space-y-4">
          <h4 className="text-[9px] font-mono font-black uppercase text-[#141414]/80 flex items-center gap-1 border-b border-black/10 pb-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-[#141414]" /> Galeri Tangkapan Kritis ({capturedPhotos.length})
          </h4>

          {/* MINI SCROLLABLE GALLERY LIST */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {capturedPhotos.length > 0 ? (
              capturedPhotos.map((photo) => (
                <div 
                  key={photo.id}
                  onClick={() => {
                    setSelectedPhoto(photo);
                    setPhotoNotes(photo.notes);
                  }}
                  className={`p-1.5 border flex gap-2 cursor-pointer transition-colors ${selectedPhoto?.id === photo.id ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-[#141414] border-black/15 hover:border-[#141414]'}`}
                >
                  <img 
                    src={photo.imageUrl} 
                    alt="Capture" 
                    className="w-14 h-10 object-cover border border-black/20 font-mono text-[6px]" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0 font-mono text-[8px] uppercase">
                    <p className="font-bold truncate leading-tight">{photo.markaz}</p>
                    <p className="text-[7.5px] opacity-75 truncate mt-0.5">{photo.timestamp}</p>
                    <div className="flex justify-between items-center text-[7px] text-amber-500 font-extrabold mt-1">
                      <span>ALT: {photo.moonAlt.toFixed(1)}°</span>
                      <span>ELON: {photo.elongation.toFixed(1)}°</span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => handleDeletePhoto(photo.id, e)}
                    className="p-1 hover:text-red-500 self-center transition-colors"
                    title="Hapus tangkapan"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center p-8 border border-dashed border-[#141414]/25 bg-white text-gray-400 font-mono text-[9px]">
                Belum ada foto ditangkap. Klik tombol eksposur/snapshot untuk mengunci bukti rukyat hilal.
              </div>
            )}
          </div>

          {/* ACTIVE PHOTO WATERMARK DATA SHEET */}
          {selectedPhoto && (
            <div className="border border-[#141414] bg-white p-3 space-y-2 text-[9px] font-mono leading-normal shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)]">
              <div className="flex justify-between items-center border-b border-black/10 pb-1 mb-1.5">
                <span className="font-extrabold text-[#141414]">KARTU LOG FOTOMETRI HILAL</span>
                <a 
                  href={selectedPhoto.imageUrl} 
                  download={`Hilal_Edisi_${selectedPhoto.id}.jpg`}
                  className="text-amber-600 hover:text-amber-800 flex items-center gap-0.5 font-black uppercase text-[8.5px]"
                  title="Unduh foto dengan tanda air data meteor astronomi"
                >
                  <Download className="h-3 w-3" /> JPG
                </a>
              </div>

              <div className="space-y-1 text-[8.5px] text-[#141414]/90 uppercase">
                <div><span className="text-[#141414]/50">Markaz:</span> <strong className="float-right text-right truncate max-w-[110px]">{selectedPhoto.markaz}</strong></div>
                <div><span className="text-[#141414]/50">Geolokasi:</span> <strong className="float-right">{selectedPhoto.latitude.toFixed(4)}°, {selectedPhoto.longitude.toFixed(4)}°</strong></div>
                <div><span className="text-[#141414]/50">Tinggi Hilal:</span> <strong className="float-right text-emerald-700 font-black">+{selectedPhoto.moonAlt.toFixed(3)}°</strong></div>
                <div><span className="text-[#141414]/50">Azimuth Hilal:</span> <strong className="float-right">{selectedPhoto.moonAz.toFixed(3)}°</strong></div>
                <div><span className="text-[#141414]/50">Kecerahan Elongasi:</span> <strong className="float-right">{selectedPhoto.elongation.toFixed(2)}°</strong></div>
                <div><span className="text-[#141414]/50">Umur Hilal:</span> <strong className="float-right">{selectedPhoto.age.toFixed(2)} jam</strong></div>
              </div>

              {/* Observer Field Notes input */}
              <div className="pt-2 border-t border-dashed border-black/10 space-y-1.5">
                <label className="block text-[8px] font-black text-[#141414]/60 uppercase flex items-center gap-1">
                  <Tag className="h-3 w-3 text-amber-600" /> Catatan Verifikasi Lapangan:
                </label>
                <textarea 
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  placeholder="Instruksi kelaikan cuaca, kualitas sighting teleskop, hambatan awan mendung..."
                  className="w-full text-[8.5px] font-mono leading-snug p-1.5 border border-black/20 bg-amber-50/10 focus:outline-none focus:border-[#141414] h-12 text-[#141414] resize-none"
                />
                <button
                  type="button"
                  onClick={handleSavePhotoNotes}
                  className="w-full bg-[#141414] text-white py-1 hover:bg-[#323230] font-bold text-[8.5px] uppercase filter"
                >
                  Simpan Catatan
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
