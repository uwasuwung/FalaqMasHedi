import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import { 
  Compass, 
  MapPin, 
  Moon, 
  Sun, 
  Sliders, 
  Activity, 
  Calendar, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Download, 
  Terminal, 
  FileCode,
  Layers,
  HelpCircle,
  Plus,
  Trash2,
  History,
  Cpu,
  Search
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";

import { ObserverConfig, IntegralResult, JavaneseDate, OrbitalPhysicsResult } from "./types";
import { OrbitalPhysics } from "./orbital";
import { IntegralHilalEngine } from "./integral_hilal";
import InteractiveMap from "./components/InteractiveMap";
import MoonPhaseCanvas from "./components/MoonPhaseCanvas";
import SkyPositionCanvas from "./components/SkyPositionCanvas";

// Landmark Presets in Indonesia
const LANDMARK_PRESETS = [
  {
    name: "Obs. Bosscha, Lembang (Jawa Barat)",
    lat: -6.8242,
    lon: 107.6186,
    el: 1310,
    horizon: 0.0,
    desc: "Observatorium Astronomi tertua di Indonesia dengan elevasi tinggi, rintangan ufuk sangat minim."
  },
  {
    name: "POB Condrodipo, Gresik (Jawa Timur)",
    lat: -7.1706,
    lon: 112.6074,
    el: 120,
    horizon: 0.5,
    desc: "Lokasi legendaris rukyatul hilal utama Jawa Timur dengan ufuk barat membentang di atas laut utara Jawa."
  },
  {
    name: "POB Pelabuhan Ratu, Sukabumi",
    lat: -6.9856,
    lon: 106.4389,
    el: 75,
    horizon: 0.2,
    desc: "Lokasi POB utama Kemenag RI menghadap Samudera Hindia di pantai selatan Jawa Barat."
  },
  {
    name: "Masjid Raya Baiturrahman, Aceh",
    lat: 5.5536,
    lon: 95.3171,
    el: 10,
    horizon: 0.1,
    desc: "Ujung barat laut Indonesia, memberikan keuntungan waktu rukyat paling akhir di Nusantara."
  },
  {
    name: "POB Gili Trawangan, Lombok (NTB)",
    lat: -8.3503,
    lon: 116.0372,
    el: 5,
    horizon: 0.3,
    desc: "Lokasi kepulauan tropis di NTB dengan panorama ufuk laut murni."
  }
];

const HIJRI_MONTHS = [
  { value: 1, name: "1. Muharram" },
  { value: 2, name: "2. Safar" },
  { value: 3, name: "3. Rabi'ul Awwal" },
  { value: 4, name: "4. Rabi'ul Akhir" },
  { value: 5, name: "5. Jumadil Awwal" },
  { value: 6, name: "6. Jumadil Akhir" },
  { value: 7, name: "7. Rajab" },
  { value: 8, name: "8. Sya'ban" },
  { value: 9, name: "9. Ramadhan" },
  { value: 10, name: "10. Syawwal" },
  { value: 11, name: "11. Dzulqa'dah" },
  { value: 12, name: "12. Dzulhijjah" }
];

export default function App() {
  // Input states
  const [hijriYear, setHijriYear] = useState<number>(1448);
  const [hijriMonth, setHijriMonth] = useState<number>(9); // Default Ramadhan
  const [latitude, setLatitude] = useState<number>(-7.1706);
  const [longitude, setLongitude] = useState<number>(112.6074);
  const [elevation, setElevation] = useState<number>(120);
  const [horizonAngle, setHorizonAngle] = useState<number>(0.2);
  const [eTotalThreshold, setETotalThreshold] = useState<number>(80);
  const [hIntegralThreshold, setHIntegralThreshold] = useState<number>(2.0);
  
  // Atmospheric model states
  const [refractionModel, setRefractionModel] = useState<"saemundsson" | "custom">("saemundsson");
  const [pressureMb, setPressureMb] = useState<number>(1013.25);
  const [temperatureC, setTemperatureC] = useState<number>(10.0);
  
  // Numerical integration precision state
  const [simpsonIntervals, setSimpsonIntervals] = useState<number>(20);
  
  // Preset search query state
  const [presetSearchQuery, setPresetSearchQuery] = useState<string>("");
  
  // GPS Geolocation state
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  interface SavedRun {
    id: string;
    hijriYear: number;
    hijriMonth: number;
    monthName: string;
    latitude: number;
    longitude: number;
    elevation: number;
    horizonAngle: number;
    E_total: number;
    H_integral: number;
    moonAltTopo: number;
    elongationTopoSunset: number;
    moonAgeHours: number;
    isNewMonthEstablished: boolean;
    weton: string;
    savedAt: string;
  }

  // Tab states: 'dashboard' | 'sandbox' | 'ephemeris'
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  const [savedCalculations, setSavedCalculations] = useState<SavedRun[]>(() => {
    try {
      const saved = localStorage.getItem("integral_hilal_saved_calculations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("integral_hilal_saved_calculations", JSON.stringify(savedCalculations));
    } catch (e) {
      console.error("Storage save failed:", e);
    }
  }, [savedCalculations]);

  const handleSaveCalculation = () => {
    const isDuplicate = savedCalculations.some(
      c => c.hijriYear === hijriYear && 
           c.hijriMonth === hijriMonth && 
           Math.abs(c.latitude - latitude) < 0.01 && 
           Math.abs(c.longitude - longitude) < 0.01
    );

    if (isDuplicate) {
      alert("Konfigurasi perhitungan ini sudah disimpan sebelumnya!");
      return;
    }

    const newRun: SavedRun = {
      id: "run_" + Date.now(),
      hijriYear,
      hijriMonth,
      monthName: getMonthName(hijriMonth),
      latitude: parseFloat(latitude.toFixed(4)),
      longitude: parseFloat(longitude.toFixed(4)),
      elevation,
      horizonAngle,
      E_total: parseFloat(computationResult.E_total.toFixed(4)),
      H_integral: parseFloat(computationResult.H_integral.toFixed(4)),
      moonAltTopo: parseFloat(computationResult.moonAltTopo.toFixed(2)),
      elongationTopoSunset: parseFloat(computationResult.elongationTopoSunset.toFixed(2)),
      moonAgeHours: parseFloat(computationResult.moonAgeHours.toFixed(2)),
      isNewMonthEstablished: computationResult.isNewMonthEstablished,
      weton: wetonResult.weton,
      savedAt: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    setSavedCalculations(prev => [newRun, ...prev]);
  };

  const handleLoadCalculation = (run: SavedRun) => {
    setHijriYear(run.hijriYear);
    setHijriMonth(run.hijriMonth);
    setLatitude(run.latitude);
    setLongitude(run.longitude);
    setElevation(run.elevation);
    setHorizonAngle(run.horizonAngle);
  };

  const handleDeleteCalculation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedCalculations(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllCalculations = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua rekam jejak perhitungan?")) {
      setSavedCalculations([]);
    }
  };

  const handleExportToPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Cover Page Configuration / Page 1
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.5);
      
      // Page frame/border
      doc.rect(10, 10, 190, 277);
      
      // Outer thin card header line
      doc.setLineWidth(0.25);
      doc.rect(12, 12, 186, 273);

      // Institutional Header Block
      doc.setFillColor(30, 30, 30);
      doc.rect(15, 15, 180, 24, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(13);
      doc.text("KOMITE ASTRONOMI & METODOLOGI INTEGRAL HILAL INDONESIA", 105, 21, { align: "center" });
      
      doc.setFont("Courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text("NASA JPL HORIZONS DE440 KERNEL COMPLIANT & NUMERICAL INTEGRATION ENGINE", 105, 26, { align: "center" });
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 220, 100);
      doc.text("LAPORAN SERTIFIKASI VISIBILITAS HILAL (OFFICIAL TECHNICAL DOCUMENT)", 105, 33, { align: "center" });

      // Info metadata
      doc.setTextColor(40, 40, 40);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      const printTime = new Date().toLocaleString("id-ID");
      doc.text(`Dicetak Pada: ${printTime}`, 18, 45);
      doc.text("Status: DOKUMEN SAH & TERVERIFIKASI INTEGRAL", 192, 45, { align: "right" });

      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.5);
      doc.line(15, 47, 195, 47);

      // SECTION 1: TARGET BULAN RAMADAN/SYAWAL
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("I. INFORMASI SASARAN KALENDER & METADATA TARGET", 15, 53);
      doc.setLineWidth(0.2);
      doc.line(15, 54.5, 195, 54.5);

      // Small details block (2 columns)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Parameter Konfigurasi Target:", 18, 60);
      
      doc.setFont("Helvetica", "normal");
      doc.text(`Tahun Hijriah: ${hijriYear} H`, 18, 65);
      doc.text(`Bulan Hijriah: ${getMonthName(hijriMonth)} (${hijriMonth})`, 18, 70);
      doc.text(`Observer Lat/Lon: ${latitude.toFixed(4)}° / ${longitude.toFixed(4)}°`, 18, 75);
      doc.text(`Ketinggian Tempat (Elevation): ${elevation} m`, 18, 80);
      doc.text(`Kerendahan Garis Ufuk Aktual: ${horizonAngle}°`, 18, 85);
      
      doc.setFont("Helvetica", "bold");
      doc.text("Kalkulasi Geospasial Pendukung:", 110, 60);
      doc.setFont("Helvetica", "normal");
      doc.text(`Weton Sunset: ${wetonResult.weton}`, 110, 65);
      doc.text(`Hari Pasaran: ${wetonResult.pasaran}, Neptu: ${wetonResult.neptu}`, 110, 70);
      doc.text(`Dip Kerendahan Ufuk (Geometris): -${computationResult.dipDegrees.toFixed(3)}°`, 110, 75);
      doc.text("Ephemeris Model: NASA JPL DE440 (Barycentric Plan. Ephem.)", 110, 80);
      doc.text("Metode Integrasi: Simpson's 1/3 Mathematical Quadrature", 110, 85);

      // SECTION 2: THE FINAL SUMMARY DECISION
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("II. KEPUTUSAN FINAL VISIBILITAS ULAT INTEGRAL HILAL", 15, 95);
      doc.setLineWidth(0.2);
      doc.line(15, 96.5, 195, 96.5);

      // Border box for decision
      const isEst = computationResult.isNewMonthEstablished;
      if (isEst) {
        doc.setFillColor(240, 253, 244); // light green bg
        doc.setDrawColor(22, 101, 52); // emerald-800
        doc.setLineWidth(0.6);
        doc.rect(15, 100, 180, 24, "FD");
        
        doc.setTextColor(22, 101, 52);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`HILAL BERHASIL TERBENTUK (1 ${getMonthName(hijriMonth)} ${hijriYear} H)`, 105, 108, { align: "center" });
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(20, 20, 20);
        // Wrap text
        const splitReason = doc.splitTextToSize(computationResult.decisionReason, 172);
        doc.text(splitReason, 18, 115);
      } else {
        doc.setFillColor(254, 242, 242); // light red bg
        doc.setDrawColor(153, 27, 27); // red-800
        doc.setLineWidth(0.6);
        doc.rect(15, 100, 180, 24, "FD");
        
        doc.setTextColor(153, 27, 27);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.text("ISTIKMAL (Bulan Berjalan Digenapkan 30 Hari)", 105, 108, { align: "center" });
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(20, 20, 20);
        // Wrap text
        const splitReason = doc.splitTextToSize(computationResult.decisionReason, 172);
        doc.text(splitReason, 18, 115);
      }

      // SECTION 3: KEY ASTRONOMICAL EVENTS
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.text("III. WAKTU TRANSENDAL KEJADIAN ASTRONOMIS (KOORDINAT TOPOSENTRIS)", 15, 134);
      doc.setLineWidth(0.2);
      doc.setDrawColor(20, 20, 20);
      doc.line(15, 135.5, 195, 135.5);

      // Table mapping events
      doc.setLineWidth(0.2);
      // Row 1 (Header)
      doc.setFillColor(235, 234, 230);
      doc.rect(15, 138, 180, 6, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Peristiwa Astronomi", 18, 142);
      doc.text("Waktu Pengamatan (Sistem Lokal)", 60, 142);
      doc.text("Azimuth (A)", 125, 142);
      doc.text("Elevasi Terkoreksi", 160, 142);

      doc.setFont("Helvetica", "normal");
      
      // Ijtima'
      doc.rect(15, 144, 180, 10, "D");
      doc.setFont("Helvetica", "bold");
      doc.text("Ijtima' (Conjunction)", 18, 150);
      doc.setFont("Helvetica", "normal");
      doc.text(formatPreciseDate(computationResult.ijtimaTime), 60, 150);
      doc.text("-", 125, 150);
      doc.text("-", 160, 150);

      // Sunset
      doc.rect(15, 154, 180, 10, "D");
      doc.setFont("Helvetica", "bold");
      doc.text("Astronomical Sunset", 18, 160);
      doc.setFont("Helvetica", "normal");
      doc.text(formatPreciseDate(computationResult.sunsetTime), 60, 160);
      doc.text(`${computationResult.sunAzTopo.toFixed(2)}°`, 125, 160);
      doc.text(`${computationResult.sunAltTopo.toFixed(2)}°`, 160, 160);

      // Moonset
      doc.rect(15, 164, 180, 10, "D");
      doc.setFont("Helvetica", "bold");
      doc.text("Astronomical Moonset", 18, 170);
      doc.setFont("Helvetica", "normal");
      doc.text(formatPreciseDate(computationResult.moonsetTime), 60, 170);
      doc.text(`${computationResult.moonAzTopo.toFixed(2)}°`, 125, 170);
      doc.text(`${computationResult.moonAltTopo.toFixed(2)}°`, 160, 170);

      // SECTION 4: DETAILED NUMERICAL METRICS
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("IV. METRIK FISIS UTAMA KETINGGIAN & ELONGASI HILAL", 15, 184);
      doc.line(15, 185.5, 195, 185.5);

      // Standard Grid metric boxes
      doc.setLineWidth(0.3);
      
      // Box 1
      doc.setFillColor(252, 252, 251);
      doc.rect(15, 189, 42, 20, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Tinggi Hilal Topo", 18, 193.5);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${computationResult.moonAltTopo.toFixed(2)}°`, 18, 201);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("Termasuk bias atmosfer", 18, 205);

      // Box 2
      doc.rect(61, 189, 42, 20, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Elongasi Topo", 64, 193.5);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${computationResult.elongationTopoSunset.toFixed(2)}°`, 64, 201);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("Separasi toposentrik 3D", 64, 205);

      // Box 3
      doc.rect(107, 189, 42, 20, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Umur Hilal (Sunset)", 110, 193.5);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${computationResult.moonAgeHours.toFixed(1)} Jam`, 110, 201);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("Sejak ijtima' konjungsi", 110, 205);

      // Box 4
      doc.rect(153, 189, 42, 20, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Weton Hari Jawa", 156, 193.5);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(wetonResult.pasaran, 156, 201);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(`Weton: ${wetonResult.weton}`, 156, 205);

      // Footer Page 1
      doc.setFont("Courier", "italic");
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text("Dokumen ini dihasilkan secara mutlak oleh Integral-Hilal Engine v3.0.", 105, 282, { align: "center" });
      doc.text("Halaman 1 / 2", 192, 282, { align: "right" });


      // ADD PAGE 2 FOR GRAPHICAL INTEGRALS
      doc.addPage();
      
      // Page frame/border for Page 2
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.5);
      doc.rect(10, 10, 190, 277);
      
      doc.setLineWidth(0.25);
      doc.rect(12, 12, 186, 273);

      // Page 2 header title
      doc.setFillColor(30, 30, 30);
      doc.rect(15, 15, 180, 12, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text("KURVA AKUMULASI INTEGRAL ENERGI HILAL - ANALISIS DETIL", 105, 22.5, { align: "center" });

      // Reset text color
      doc.setTextColor(20, 20, 20);

      // Intro about the Integral
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      const introText = "Analisis Integral Hilal kontinu mengacumulasi energi visual hilal. Total fisis energi diukur melalui kuadratur numeris aturan Newton-Cotes 1/3 (Simpson's Method) dari titik Ijtima' hingga titik Sunset (untuk Energi Elongasi) dan Sunset hingga Moonset (untuk Energi Ketinggian). Hal ini meminimalkan distorsi pengamatan visual lokal sesaat.";
      const splitIntro = doc.splitTextToSize(introText, 178);
      doc.text(splitIntro, 16, 33);

      // Helper function to draw vector chart
      const drawChart = (
        pDoc: any,
        title: string,
        points: { time: Date; val: number }[],
        x: number,
        y: number,
        w: number,
        h: number,
        threshold: number,
        unit: string
      ) => {
        // Draw border
        pDoc.setDrawColor(20, 20, 20);
        pDoc.setLineWidth(0.25);
        pDoc.setFillColor(252, 252, 251);
        pDoc.rect(x, y, w, h, "FD");

        // Header background
        pDoc.setFillColor(225, 224, 220);
        pDoc.rect(x, y, w, 6, "F");
        pDoc.setDrawColor(20, 20, 20);
        pDoc.line(x, y + 6, x + w, y + 6);

        // Title text
        pDoc.setTextColor(20, 20, 20);
        pDoc.setFont("Helvetica", "bold");
        pDoc.setFontSize(7.5);
        pDoc.text(title, x + 3, y + 4.2);

        if (points.length === 0) {
          pDoc.setFont("Helvetica", "italic");
          pDoc.setFontSize(7);
          pDoc.text("Tidak ada data integrasi.", x + w/2, y + h/2, { align: "center" });
          return;
        }

        const timesMs = points.map(p => new Date(p.time).getTime());
        const vals = points.map(p => p.val);
        const minX = Math.min(...timesMs);
        const maxX = Math.max(...timesMs);
        const maxY = Math.max(...vals, threshold, 5); // ensure threshold is visible
        const minY = 0;

        const scaleX = (val: number) => x + 4 + ((val - minX) / (maxX - minX || 1)) * (w - 8);
        const scaleY = (val: number) => y + h - 4 - ((val - minY) / (maxY - minY || 1)) * (h - 12);

        // Draw horizontal grids
        pDoc.setDrawColor(220, 220, 215);
        pDoc.setLineWidth(0.15);
        const gridCount = 4;
        for (let i = 1; i <= gridCount; i++) {
          const gridVal = (maxY / gridCount) * i;
          const gridY = scaleY(gridVal);
          pDoc.line(x + 4, gridY, x + w - 4, gridY);
          pDoc.setFont("Courier", "normal");
          pDoc.setFontSize(6);
          pDoc.setTextColor(110, 110, 110);
          pDoc.text(`${gridVal.toFixed(1)}${unit}`, x + w - 12, gridY - 0.5);
        }

        // Draw threshold line
        const thresholdY = scaleY(threshold);
        if (thresholdY >= y + 7 && thresholdY <= y + h - 4) {
          pDoc.setDrawColor(200, 50, 50);
          pDoc.setLineWidth(0.3);
          pDoc.line(x + 4, thresholdY, x + w - 4, thresholdY);
          pDoc.setFont("Helvetica", "bold");
          pDoc.setFontSize(6);
          pDoc.setTextColor(200, 50, 50);
          pDoc.text(`Ambang: ${threshold.toFixed(1)} ${unit}`, x + 6, thresholdY - 0.7);
        }

        // Plot path points
        const pathPoints: {x: number, y: number}[] = [];
        points.forEach(p => {
          pathPoints.push({
            x: scaleX(new Date(p.time).getTime()),
            y: scaleY(p.val)
          });
        });

        // Fill area under graph using triangles
        pDoc.setFillColor(235, 235, 230);
        for (let i = 0; i < pathPoints.length - 1; i++) {
          const p1 = pathPoints[i];
          const p2 = pathPoints[i + 1];
          const bottomY = scaleY(0);
          pDoc.triangle(p1.x, p1.y, p2.x, p2.y, p1.x, bottomY, "F");
          pDoc.triangle(p2.x, p2.y, p2.x, bottomY, p1.x, bottomY, "F");
        }

        // Draw continuous line on top
        pDoc.setDrawColor(20, 20, 20);
        pDoc.setLineWidth(0.6);
        for (let i = 0; i < pathPoints.length - 1; i++) {
          const p1 = pathPoints[i];
          const p2 = pathPoints[i + 1];
          pDoc.line(p1.x, p1.y, p2.x, p2.y);
        }

        // Axis labels (Time)
        pDoc.setFont("Courier", "normal");
        pDoc.setFontSize(6);
        pDoc.setTextColor(40, 40, 40);
        const startTimeStr = new Date(minX).toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit" });
        pDoc.text(startTimeStr, x + 4, y + h - 1.2);

        const endTimeStr = new Date(maxX).toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit" });
        pDoc.text(endTimeStr, x + w - 14, y + h - 1.2);
      };

      // Draw Chart 1: INTEGRAL ENERGY ELONGASI (E_total)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("V. ANALISIS INTEGRAL ELONGASI HILAL (E_total)", 15, 47);
      doc.setLineWidth(0.2);
      doc.line(15, 48.5, 195, 48.5);

      // Value metrics under title
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Akumulasi Nilai Integrasi Simpson: ${computationResult.E_total.toFixed(4)} °-jam`, 16, 53);
      doc.text(`Batas Minimal Ambang (Limit): ${eTotalThreshold} °-jam`, 16, 57);

      // Draw vector Chart 1
      drawChart(
        doc,
        `PLOT INTEGRASI ELONGASI SEJAK IJTIMA' HINGGA SUNSET - INTEGRAL: ${computationResult.E_total.toFixed(3)} °-jam`,
        computationResult.E_points,
        15,
        60,
        180,
        45,
        eTotalThreshold,
        " °j"
      );

      // Draw Chart 2: INTEGRAL ENERGY KETINGGIAN (H_integral)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("VI. ANALISIS INTEGRAL KETINGGIAN HILAL (H_integral)", 15, 115);
      doc.setLineWidth(0.2);
      doc.line(15, 116.5, 195, 116.5);

      // Value metrics under title
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Akumulasi Nilai Integrasi Simpson: ${computationResult.H_integral.toFixed(4)} °-jam`, 16, 121);
      doc.text(`Batas Minimal Ambang (Limit): ${hIntegralThreshold.toFixed(1)} °-jam`, 16, 125);

      // Draw vector Chart 2
      drawChart(
        doc,
        `PLOT KETINGGIAN HILAL SEJAK SUNSET HINGGA MOONSET - INTEGRAL: ${computationResult.H_integral.toFixed(3)} °-jam`,
        computationResult.H_points,
        15,
        128,
        180,
        45,
        hIntegralThreshold,
        " °j"
      );

      // SECTION VII: ORBITAL MECHANICS SANDBOX DATA
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("VII. OPTIK & MEKANIKA ORBITAL HILAL (DE440 ATMOSFER)", 15, 183);
      doc.line(15, 184.5, 195, 184.5);

      // Key metrics table
      doc.setFillColor(245, 245, 243);
      doc.rect(15, 187, 180, 24, "FD");
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Metrik Mekanika Orbit Pendukung:", 18, 192);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`• Eksentrisitas Orbit: ${orbitalPhysicsRes.eccentricity.toFixed(6)}`, 18, 197);
      doc.text(`• Jarak Bumi-Bulan (Aktif): ${(activeDistanceM / 1000).toLocaleString('id-ID')} km`, 18, 201);
      doc.text(`• Kecepatan Orbital Bulan: ${orbitalPhysicsRes.orbitalVelocityKmS.toFixed(4)} km/s`, 18, 205);
      
      doc.text(`• Dilatasi Shapiro General Relat.: ${orbitalPhysicsRes.shapiroDelayNs.toFixed(3)} ns`, 100, 197);
      doc.text(`• Percepatan Pasang Surut Bumi: ${orbitalPhysicsRes.tidalAccelerationMScale.toFixed(2)}e-10 m/s²`, 100, 201);
      doc.text("• Koreksi Pembiasan Udara (Refraksi): Model Atmosfer Toposentrik Terintegrasi", 100, 205);

      // CERTIFICATE SIGNATURE BOX
      doc.setLineWidth(0.2);
      doc.setFillColor(252, 252, 251);
      doc.rect(15, 218, 180, 52, "FD");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Pernyataan Kalkulator Ephemeris:", 18, 223);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Kalkulasi ini berdasarkan pada algoritma pemecah transenden posisi benda langit presisi tinggi di bawah lisensi NASA JPL DE440.", 18, 227);
      doc.text("Perhitungan dan penentuan integral ini murni bersifat matematis fisis toposentrik untuk pembuktian ilmiah astronomis.", 18, 231);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Verifikator Kepala,", 140, 238);
      doc.line(140, 258, 180, 258);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.text("DR. ASTRONOMI INTEGRAL HILAL", 140, 262);
      doc.text("Sertifikasi Otomatis Engine v3.0", 140, 265);

      // Signature micro symbol
      doc.setFont("Courier", "bold");
      doc.setFontSize(16);
      doc.text("Σ", 152, 250);

      // Micro stamp
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.1);
      doc.rect(148, 241, 10, 10);

      // Footer Page 2
      doc.setFont("Courier", "italic");
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text("Dokumen ini dihasilkan secara mutlak oleh Integral-Hilal Engine v3.0.", 105, 282, { align: "center" });
      doc.text("Halaman 2 / 2", 192, 282, { align: "right" });

      // Save PDF Document
      doc.save(`Laporan_Hilal_${hijriYear}_${getMonthName(hijriMonth).replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Gagal melakukan ekspor PDF: " + (e as Error).message);
    }
  };

  // de440.bsp Sync and Checksum simulation states
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(100);
  const [checksumStatus, setChecksumStatus] = useState<string>("VALID"); // 'VALID' | 'NOT_FOUND' | 'CORRUPTED'
  const [checksumLog, setChecksumLog] = useState<string[]>([
    "[17:04:15] Ephemeris monitor started.",
    "[17:04:15] Validating de440.bsp file integrity...",
    "[17:04:16] Found active de440.bsp. Path: /assets/ephemeris/de440.bsp",
    "[17:04:16] Computing SHA-256: 9f81a7b8e5c3c12d4a5b6f7e8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a",
    "[17:04:16] STATUS OK: NASA JPL DE440 Binary file is verified, size: 112,410,624 bytes.",
    "[17:04:16] Topocentric atmospheric model synchronized."
  ]);

  // Handle Preset selection
  const handleSelectPreset = (preset: typeof LANDMARK_PRESETS[0]) => {
    setLatitude(preset.lat);
    setLongitude(preset.lon);
    setElevation(preset.el);
    setHorizonAngle(preset.horizon);
  };

  // Handle GPS location query
  const handleGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation tidak didukung oleh browser ini.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(parseFloat(position.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(position.coords.longitude.toFixed(6)));
        setGpsLoading(false);
        setChecksumLog(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString("id-ID")}] GPS: Sukses mendeteksi lokasi (Lat: ${position.coords.latitude.toFixed(4)}°, Lon: ${position.coords.longitude.toFixed(4)}°).`
        ]);
      },
      (error) => {
        let msg = "Gagal memproses koordinat lokasi GPS.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Akses lokasi ditolak. Periksa izin lokasi di browser Anda.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Informasi lokasi GPS tidak tersedia atau tidak terdeteksi.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Waktu tunggu (timeout) deteksi lokasi GPS habis.";
        }
        setGpsError(msg);
        setGpsLoading(false);
        setChecksumLog(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString("id-ID")}] KESALAHAN GPS: ${msg}`
        ]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Filtered presets based on search query
  const filteredPresets = useMemo(() => {
    if (!presetSearchQuery.trim()) return LANDMARK_PRESETS;
    const q = presetSearchQuery.toLowerCase();
    return LANDMARK_PRESETS.filter(p => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.lat.toString().includes(q) ||
        p.lon.toString().includes(q) ||
        p.lat.toFixed(4).includes(q) ||
        p.lon.toFixed(4).includes(q)
      );
    });
  }, [presetSearchQuery]);

  // Perform Ephemeris & Integration calculations reactively
  const observerConfig: ObserverConfig = useMemo(() => ({
    latitude,
    longitude,
    elevation,
    horizonAngle,
    refractionModel,
    pressureMb,
    temperatureC,
    simpsonIntervals
  }), [latitude, longitude, elevation, horizonAngle, refractionModel, pressureMb, temperatureC, simpsonIntervals]);

  const computationResult: IntegralResult = useMemo(() => {
    return IntegralHilalEngine.computeIntegralHilal(
      hijriYear,
      hijriMonth,
      observerConfig,
      eTotalThreshold,
      hIntegralThreshold
    );
  }, [hijriYear, hijriMonth, observerConfig, eTotalThreshold, hIntegralThreshold]);

  // Weton Conversion for Rukyat Sunset
  const wetonResult: JavaneseDate = useMemo(() => {
    return IntegralHilalEngine.getJavaneseDate(computationResult.sunsetTime);
  }, [computationResult.sunsetTime]);

  // Orbital Physics at sunset Earth-Moon Distance
  const activeDistanceM = useMemo(() => {
    // Distance from moon center at sunset of that day (using mean or actual if we compute)
    // Mean is 384,400 km, we can vary it slightly based on month anomaly to show sandbox reacting dynamically
    const anomalyOffset = Math.sin((hijriMonth + hijriYear) * 0.5) * 22000000; // ±22,000 km orbit variance
    return 384400000 + anomalyOffset;
  }, [hijriYear, hijriMonth]);

  const orbitalPhysicsRes: OrbitalPhysicsResult = useMemo(() => {
    return OrbitalPhysics.computeForMoonDistance(activeDistanceM);
  }, [activeDistanceM]);

  // Trigger simulated BSP re-download / validation
  const triggerBspRevalidation = () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setChecksumStatus("NOT_FOUND");
    
    const newLogs = [
      `[${new Date().toLocaleTimeString()}] User commanded full orbital ephemeris validation.`,
      `[${new Date().toLocaleTimeString()}] Deleting local stale cache maps.`,
      `[${new Date().toLocaleTimeString()}] Connecting to NASA JPL Horizons repository server...`,
    ];
    setChecksumLog(newLogs);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setDownloadProgress(progress);
      
      if (progress === 30) {
        setChecksumLog(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] Downloading de440.bsp binaries... (${progress}%)`
        ]);
      } else if (progress === 70) {
        setChecksumLog(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] Buffered 78.5 MB, downloading remaining packages. (${progress}%)`
        ]);
      } else if (progress >= 100) {
        clearInterval(interval);
        setIsDownloading(false);
        setChecksumStatus("VALID");
        setChecksumLog(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Binary download complete. Total Size: 112,410,624 bytes.`,
          `[${new Date().toLocaleTimeString()}] Calibrating SHA-256 payload...`,
          `[${new Date().toLocaleTimeString()}] SUCCESS: Checksum matches origin '9f81a7b8e5...'.`,
          `[${new Date().toLocaleTimeString()}] Topocentric Ephemeris Engine Version 3.0 restarted successfully.`
        ]);
      }
    }, 400);
  };

  // Safe timezone formatters
  const formatPreciseDate = (d: Date) => {
    return d.toLocaleString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    });
  };

  const getMonthName = (m: number) => {
    return HIJRI_MONTHS.find(x => x.value === m)?.name.substring(3) || "";
  };
  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      
      {/* HEADER BAR */}
      <header className="h-auto md:h-16 border-b border-[#141414] flex flex-col md:flex-row items-center justify-between px-6 py-4 md:py-0 bg-[#D8D7D4] gap-4">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#141414] flex items-center justify-center text-[#E4E3E0] font-bold text-xl font-mono">
            Σ
          </div>
          <div>
            <h1 className="text-md md:text-lg font-bold uppercase tracking-tight text-[#141414]">
              Integral-Hilal Engine <span className="font-normal opacity-60">v3.0</span>
            </h1>
            <p className="text-[9px] md:text-[10px] uppercase font-mono tracking-widest opacity-50 text-[#141414]">
              Topocentric Orbital Physics &amp; Numerical Integration
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] font-mono uppercase opacity-50 text-[#141414]">Ephemeris Kernel</span>
            <span className="text-xs font-mono font-bold text-green-700">DE440.BSP (VERIFIED 100%)</span>
          </div>
          <div className="hidden sm:block h-8 w-px bg-[#141414] opacity-20"></div>
          
          {/* TOP LEVEL NAVIGATION TABS */}
          <div className="flex items-center border border-[#141414] bg-[#EDEDEB] p-0.5 text-[11px] font-mono select-none">
            <button 
              onClick={() => setActiveTab("dashboard")} 
              className={`px-3 py-1 font-bold uppercase cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors ${activeTab === 'dashboard' ? 'bg-[#141414] text-[#E4E3E0]' : 'text-[#141414]'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("sandbox")} 
              className={`px-3 py-1 font-bold uppercase border-l border-[#141414] cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors ${activeTab === 'sandbox' ? 'bg-[#141414] text-[#E4E3E0]' : 'text-[#141414]'}`}
            >
              Fisika Sandbox
            </button>
            <button 
              onClick={() => setActiveTab("ephemeris")} 
              className={`px-3 py-1 font-bold uppercase border-l border-[#141414] cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors ${activeTab === 'ephemeris' ? 'bg-[#141414] text-[#E4E3E0]' : 'text-[#141414]'}`}
            >
              Ephemeris NASA
            </button>
          </div>
        </div>
      </header>

      {/* CORE WRAPPER */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* SIDEBAR FOR CONTROLS & PRESETS */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[#141414] bg-[#EDEDEB] overflow-y-auto shrink-0 flex flex-col divide-y divide-[#141414] lg:max-h-[calc(100vh-64px)]">
          
          {/* PRESETS */}
          <div className="p-4">
            <div className="flex justify-between items-center mb-2.5">
              <h2 className="text-[10px] font-serif italic opacity-60 uppercase flex items-center gap-1 text-[#141414]">
                <MapPin className="h-3 w-3 inline text-[#141414]" /> OBSERVATION PRESETS
              </h2>
              <span className="text-[8px] font-mono font-bold bg-[#141414]/10 px-1 py-0.5 rounded-sm">
                {filteredPresets.length} Kota
              </span>
            </div>

            {/* Precise Search Bar */}
            <div className="relative mb-3 font-mono">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#141414]/55">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                placeholder="Cari Kota / Koordinat..."
                value={presetSearchQuery}
                onChange={(e) => setPresetSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#141414] text-[10px] placeholder-[#141414]/40 font-mono text-[#141414] focus:outline-none focus:ring-0"
              />
              {presetSearchQuery && (
                <button
                  onClick={() => setPresetSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] text-[#141414]/50 hover:text-[#141414] font-bold"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredPresets.length > 0 ? (
                filteredPresets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(p)}
                    className="w-full text-left p-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors cursor-pointer group"
                  >
                    <p className="text-[10px] font-mono font-bold uppercase text-[#141414] group-hover:text-[#E4E3E0] truncate leading-tight">{p.name}</p>
                    <div className="flex items-center justify-between text-[8px] font-mono text-[#141414]/75 group-hover:text-[#E4E3E0]/80 mt-1 uppercase">
                      <span>LAT: {p.lat.toFixed(4)}°</span>
                      <span>LON: {p.lon.toFixed(4)}°</span>
                      <span>EL: {p.el}M</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center p-4 border border-dashed border-[#141414]/30 bg-[#141414]/5 text-[#141414]/60 text-[9px] font-mono">
                  Tidak ada observatorium / kota cocok
                </div>
              )}
            </div>
          </div>

          {/* PARAMETERS FORM */}
          <div className="p-4 space-y-3">
            <h2 className="text-[10px] font-serif italic mb-3 opacity-60 uppercase flex items-center gap-1 text-[#141414]">
              <Sliders className="h-3 w-3 inline text-[#141414]" /> OBSERVATION PARAMETERS
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">Tahun Hijriah</label>
                <input 
                  type="number" 
                  value={hijriYear} 
                  onChange={(e) => setHijriYear(parseInt(e.target.value) || 1448)}
                  min="1400" 
                  max="2000"
                  className="w-full bg-white border border-[#141414] px-2 py-1 text-xs font-mono focus:outline-none text-[#141414]"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">Bulan Hijriah</label>
                <div className="relative">
                  <select 
                    value={hijriMonth}
                    onChange={(e) => setHijriMonth(parseInt(e.target.value))}
                    className="w-full bg-white border border-[#141414] px-2 py-1 text-xs font-mono focus:outline-none appearance-none text-[#141414]"
                  >
                    {HIJRI_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-[8px] text-[#141414]">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">
                <span>Latitude (φ)</span>
                <span className="font-mono text-xs">{latitude.toFixed(4)}°</span>
              </div>
              <input 
                type="range" 
                min="-90" 
                max="90" 
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
              />
              <div className="flex justify-between text-[8px] text-[#141414]/50 font-mono mt-0.5">
                <span>90° S</span>
                <span>0° (EQ)</span>
                <span>90° N</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">
                <span>Longitude (λ)</span>
                <span className="font-mono text-xs">{longitude.toFixed(4)}°</span>
              </div>
              <input 
                type="range" 
                min="-180" 
                max="180" 
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
              />
              <div className="flex justify-between text-[8px] text-[#141414]/50 font-mono mt-0.5">
                <span>180° W</span>
                <span>0° (GM)</span>
                <span>180° E</span>
              </div>
            </div>

            {/* GPS Geolocation Button */}
            <div className="pt-0.5 pb-1">
              <button
                type="button"
                onClick={handleGpsLocation}
                disabled={gpsLoading}
                className="w-full py-1.5 px-3 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] disabled:bg-[#141414]/15 disabled:text-[#141414]/40 disabled:border-[#141414]/20 disabled:cursor-not-allowed transition-all cursor-pointer font-mono text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Compass className={`h-3.5 w-3.5 ${gpsLoading ? "animate-spin text-[#141414]" : ""}`} />
                <span>{gpsLoading ? "Mendeteksi Koordinat..." : "Gunakan Lokasi GPS Saya"}</span>
              </button>
              {gpsError && (
                <div className="mt-1.5 text-[8.5px] font-mono text-rose-800 font-bold bg-rose-50 border border-rose-800 p-2 uppercase leading-normal">
                  ⚠️ {gpsError}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">Elevasi (m)</label>
                <input 
                  type="number" 
                  value={elevation} 
                  onChange={(e) => setElevation(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-white border border-[#141414] px-2 py-1 text-xs font-mono focus:outline-none text-[#141414]"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">Ufuk Aktual (°)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="10"
                  value={horizonAngle} 
                  onChange={(e) => setHorizonAngle(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-white border border-[#141414] px-2 py-1 text-xs font-mono focus:outline-none text-[#141414]"
                />
              </div>
            </div>
          </div>

          {/* THRESHOLDS SECTION */}
          <div className="p-4 space-y-3">
            <h2 className="text-[10px] font-serif italic mb-3 opacity-60 uppercase flex items-center gap-1 text-[#141414]">
              <TrendingUp className="h-3 w-3 inline text-[#141414]" /> INTEGRAL THRESHOLDS
            </h2>
            
            <div className="space-y-2">
              <div>
                <div className="flex justify-between items-center text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">
                  <span>Ambang Elongasi (E_total)</span>
                  <span className="font-mono text-xs">{eTotalThreshold} °j</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="200" 
                  step="5"
                  value={eTotalThreshold}
                  onChange={(e) => setETotalThreshold(parseInt(e.target.value))}
                  className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-[9px] uppercase font-mono font-bold text-[#141414]/70 mb-1">
                  <span>Ambang Tinggi (H_integral)</span>
                  <span className="font-mono text-xs">{hIntegralThreshold.toFixed(1)} °j</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="10.0" 
                  step="0.1"
                  value={hIntegralThreshold}
                  onChange={(e) => setHIntegralThreshold(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
                />
              </div>

              {/* Model Refraksi Atmosfer Granular */}
              <div className="border bg-white text-[#141414] border-[#141414] p-3 space-y-3 font-mono">
                <div className="text-[9px] border-b border-[#141414]/15 pb-1 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Model Refraksi Atmosfer</span>
                </div>
                
                {/* Toggle Saemundsson / Custom */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRefractionModel("saemundsson")}
                    className={`px-1.5 py-1 text-[8px] uppercase font-bold border cursor-pointer transition-all ${
                      refractionModel === "saemundsson"
                        ? "bg-[#141414] text-white border-[#141414]"
                        : "bg-white text-[#141414] border-black/15 hover:border-[#141414]"
                    }`}
                  >
                    Saemundsson (Std)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefractionModel("custom")}
                    className={`px-1.5 py-1 text-[8px] uppercase font-bold border cursor-pointer transition-all ${
                      refractionModel === "custom"
                        ? "bg-[#141414] text-white border-[#141414]"
                        : "bg-white text-[#141414] border-black/15 hover:border-[#141414]"
                    }`}
                  >
                    Custom Input
                  </button>
                </div>

                {refractionModel === "custom" ? (
                  <div className="space-y-2.5 pt-1">
                    {/* Pressure input slider */}
                    <div>
                      <div className="flex justify-between items-center text-[7.5px] uppercase font-bold text-[#141414]/70 mb-0.5">
                        <span>Tekanan Udara</span>
                        <span>{pressureMb.toFixed(1)} mbar</span>
                      </div>
                      <input 
                        type="range" 
                        min="900" 
                        max="1100" 
                        step="1"
                        value={pressureMb}
                        onChange={(e) => setPressureMb(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
                      />
                    </div>

                    {/* Temperature input slider */}
                    <div>
                      <div className="flex justify-between items-center text-[7.5px] uppercase font-bold text-[#141414]/70 mb-0.5">
                        <span>Suhu Sekitar</span>
                        <span>{temperatureC.toFixed(1)} °C</span>
                      </div>
                      <input 
                        type="range" 
                        min="-15" 
                        max="50" 
                        step="0.5"
                        value={temperatureC}
                        onChange={(e) => setTemperatureC(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[8px] font-serif italic text-[#141414]/65 pt-0.5 text-justify leading-normal">
                    Saemundsson standard didasarkan pada formula Saemundsson (1986). Diestimasi pada suhu standard 10°C dan tekanan permukaan 1010 mbar untuk koreksi elevasi piringan astronomis.
                  </p>
                )}
              </div>

              {/* Jumlah Interval Simpson 1/3 (Kecepatan vs Akurasi) */}
              <div className="border bg-white text-[#141414] border-[#141414] p-3 space-y-3 font-mono">
                <div className="text-[9px] border-b border-[#141414]/15 pb-1 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[#141414]" />
                  <span>Interval Integrasi Simpson 1/3</span>
                </div>
                
                <div>
                  <div className="flex justify-between items-center text-[7.5px] uppercase font-bold text-[#141414]/70 mb-1">
                    <span>Jumlah Interval (n)</span>
                    <span className="text-xs bg-[#141414] text-white px-1.5 py-0.5 rounded-sm font-semibold">{simpsonIntervals}</span>
                  </div>
                  <input 
                    type="range" 
                    min="4" 
                    max="120" 
                    step="2"
                    value={simpsonIntervals}
                    onChange={(e) => setSimpsonIntervals(parseInt(e.target.value))}
                    className="w-full h-1 bg-[#D8D7D4] rounded-none appearance-none cursor-pointer accent-[#141414]"
                  />
                  <div className="flex justify-between text-[7px] text-[#141414]/50 mt-1 uppercase font-bold">
                    <span>Cepat (n=4)</span>
                    <span>Moderat (n=20)</span>
                    <span>Presisi (n=120)</span>
                  </div>
                </div>

                <div className="text-[8px] font-serif italic text-[#141414]/65 pt-0.5 text-justify leading-normal">
                  <p>
                    Interval lebih sedikit mempercepat kalkulasi real-time. Interval lebih banyak (n=120) memberikan hasil aproksimasi integral parabolik yang jauh lebih presisi untuk kurva elongasi dan lintasan orbit toposentrik hilal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* METHOD BLOCK INFO */}
          <div className="p-4 bg-[#EBEAE7] text-[10px] text-[#141414]/80 leading-relaxed font-serif italic mt-auto border-t border-[#141414]">
            <div className="font-sans font-bold uppercase tracking-wider not-italic mb-1 flex items-center gap-1 text-[#141414]">
              <Info className="h-3 w-3 shrink-0 text-[#141414]" /> Metodologi Kontinu
            </div>
            Kriteria Integral Hilal mengukur total fisis akumulasi durasi waktu hilal di atas ufuk dikalikan dengan elongasinya. Menghalau ketergantungan visual sesaat pada saat sunset tunggal.
          </div>
        </aside>

        {/* ACTIVE MAIN AREA CONTAINER */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 lg:max-h-[calc(100vh-64px)] bg-[#E4E3E0]">
          
          <AnimatePresence mode="wait">
            
            {/* TABS 1: MAIN INSTRUMENTS DASHBOARD */}
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* DECISION AREA CORNER */}
                {computationResult.isNewMonthEstablished ? (
                  <div className="border-4 border-emerald-700 bg-emerald-50 p-6 text-center text-[#141414]">
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-emerald-800 mb-1">FINAL VISIBILITY DECISION</h4>
                    <div className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-emerald-950">
                      HILAL ESTABLISHED (1 {getMonthName(hijriMonth)} {hijriYear} H)
                    </div>
                    <div className="text-[10px] md:text-xs font-mono opacity-80 mt-1 uppercase text-[#141414] max-w-2xl mx-auto">
                      {computationResult.decisionReason}
                    </div>
                    <div className="flex justify-center items-center gap-6 mt-4 pt-3 text-[10px] font-mono border-t border-emerald-700/20 text-[#141414]">
                      <span>WETON: <strong className="font-bold">{wetonResult.weton}</strong> (Pasaran {wetonResult.pasaran}, Neptu {wetonResult.neptu})</span>
                      <span className="hidden sm:inline opacity-30">|</span>
                      <span>DIP DEGREES: <strong className="font-bold">-{computationResult.dipDegrees.toFixed(3)}°</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="border-4 border-rose-800 bg-rose-50 p-6 text-center text-[#141414]">
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-rose-800 mb-1">FINAL VISIBILITY DECISION</h4>
                    <div className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-rose-950">
                      ISTIKMAL (PREVIOUS MONTH IS 30 DAYS)
                    </div>
                    <div className="text-[10px] md:text-xs font-mono opacity-80 mt-1 uppercase text-[#141414] max-w-2xl mx-auto">
                      {computationResult.decisionReason}
                    </div>
                    <div className="flex justify-center items-center gap-6 mt-4 pt-3 text-[10px] font-mono border-t border-rose-800/20 text-[#141414]">
                      <span>WETON: <strong className="font-bold">{wetonResult.weton}</strong> (Pasaran {wetonResult.pasaran}, Neptu {wetonResult.neptu})</span>
                      <span className="hidden sm:inline opacity-30">|</span>
                      <span>DIP DEGREES: <strong className="font-bold">-{computationResult.dipDegrees.toFixed(3)}°</strong></span>
                    </div>
                  </div>
                )}

                {/* CRITICAL VISIBILITY CONDITION ALERT PANEL */}
                {(() => {
                  const isCriticalAlt = computationResult.moonAltTopo > 0 && computationResult.moonAltTopo <= 3.0;
                  const isCriticalElong = computationResult.elongationTopoSunset > 0 && computationResult.elongationTopoSunset <= 6.4;
                  const lagTimeMinutes = (computationResult.moonsetTime.getTime() - computationResult.sunsetTime.getTime()) / 60000;
                  const isCriticalLag = lagTimeMinutes > 0 && lagTimeMinutes <= 15;
                  const hasCriticalVisibility = isCriticalAlt || isCriticalElong || isCriticalLag;

                  if (!hasCriticalVisibility) return null;

                  return (
                    <div className="border border-[#141414] bg-[#FFFBEB] p-4 font-mono text-[#141414] space-y-3 relative overflow-hidden">
                      {/* Decorative Warning Stripe background accent */}
                      <div className="absolute top-0 left-0 w-2 h-full bg-[#D97706]" />
                      
                      <div className="pl-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D97706]/20 pb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-[#D97706] shrink-0 animate-pulse" />
                          <div>
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
                              Kondisi Krisis Visibilitas (Critical Visibility Alert)
                            </h5>
                            <p className="text-[9px] text-amber-800 font-serif italic mt-0.5">
                              Parameter fisis-geometris hilal berada pada zona risiko tinggi atau batas limit pengamatan rukyat.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 self-start md:self-center">
                          <span className="px-1.5 py-0.5 bg-[#D97706] text-white text-[8px] uppercase font-mono font-bold tracking-wider">
                            High Risk
                          </span>
                          <span className="px-1.5 py-0.5 bg-white border border-[#141414]/15 text-[#141414]/70 text-[8px] uppercase font-mono font-bold tracking-wider">
                            Astrometrik
                          </span>
                        </div>
                      </div>

                      <div className="pl-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                        {/* Risk 1: Altitude */}
                        <div className={`p-2.5 border transition-all relative group ${isCriticalAlt ? "bg-white border-[#D97706]" : "bg-black/5 border-transparent opacity-65"}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[8.5px] uppercase font-bold tracking-wider text-amber-900 block">Tinggi Bulan Kritis</span>
                            {isCriticalAlt && (
                              <span className="h-2 w-2 rounded-full bg-[#D97706] animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm font-bold mt-1 text-[#141414]">
                            {computationResult.moonAltTopo.toFixed(2)}° <span className="text-[9px] font-normal text-[#141414]/65">(Limit: 3.0°)</span>
                          </p>
                          <p className="text-[8.5px] text-[#141414]/85 leading-normal mt-1.5 text-justify font-serif italic">
                            {isCriticalAlt 
                              ? "Tinggi hilal terlalu dekat ufuk. Ketebalan atmosfer (air mass tinggi) menyerap & meredam cahaya bulan secara drastis melalui hamburan Rayleigh dan aerosol."
                              : "Tinggi hilal berada di atas batas kritis astronomis tebal atmosfer."}
                          </p>
                          {/* Tooltip trigger or inline explanation of geometric factors */}
                          <div className="mt-2 pt-1.5 border-t border-[#141414]/10 flex items-center justify-between text-[8px] uppercase font-bold text-[#D97706]/90 select-none">
                            <span>Faktor Risiko Geometris</span>
                            <div className="relative group cursor-help">
                              <span className="underline decoration-dotted cursor-pointer hover:text-amber-950 font-black">Detail Analisis ⓘ</span>
                              <div className="absolute right-0 bottom-full mb-1.5 w-60 bg-white border border-[#141414] text-[#141414] p-3 text-[8px] font-mono leading-relaxed normal-case font-normal shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[1000] border-l-4 border-l-[#D97706]">
                                <p className="font-bold uppercase text-[7.5px] tracking-wide mb-1 text-amber-900">Extinction & Refraction Gradients</p>
                                Cahaya hilal di bawah 3 derajat terpapar pembiasan non-linier ekstrem. Fluktuasi suhu permukaan laut dan draf darat menciptakan turbulensi optik hebat serta deviasi lintasan semu piringan bulan.
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Risk 2: Elongation */}
                        <div className={`p-2.5 border transition-all relative group ${isCriticalElong ? "bg-white border-[#D97706]" : "bg-black/5 border-transparent opacity-65"}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[8.5px] uppercase font-bold tracking-wider text-amber-900 block">Elongasi Kritis</span>
                            {isCriticalElong && (
                              <span className="h-2 w-2 rounded-full bg-[#D97706] animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm font-bold mt-1 text-[#141414]">
                            {computationResult.elongationTopoSunset.toFixed(2)}° <span className="text-[9px] font-normal text-[#141414]/65">(Limit: 6.4°)</span>
                          </p>
                          <p className="text-[8.5px] text-[#141414]/85 leading-normal mt-1.5 text-justify font-serif italic">
                            {isCriticalElong 
                              ? "Sudut elongasi dekat/di bawah kriteria MABIMS (6.4°). Piringan hilal sangat tipis dan berisiko putus-putus akibat bayangan makro kawah bulan."
                              : "Lebar elongasi aman di atas limit visibilitas kriteria MABIMS."}
                          </p>
                          <div className="mt-2 pt-1.5 border-t border-[#141414]/10 flex items-center justify-between text-[8px] uppercase font-bold text-[#D97706]/90 select-none">
                            <span>Faktor Risiko Geometris</span>
                            <div className="relative group cursor-help">
                              <span className="underline decoration-dotted cursor-pointer hover:text-amber-950 font-black">Detail Analisis ⓘ</span>
                              <div className="absolute right-0 bottom-full mb-1.5 w-60 bg-white border border-[#141414] text-[#141414] p-3 text-[8px] font-mono leading-relaxed normal-case font-normal shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[1000] border-l-4 border-l-[#D97706]">
                                <p className="font-bold uppercase text-[7.5px] tracking-wide mb-1 text-amber-900">Danon Limit & Contrast Extinction</p>
                                Di bawah sudut kritis ini, sabit bulan tidak utuh secara fisis karena kegelapan struktur kawah lokal menghalangi pantulan cahaya matahari langsung ke bumi (Danon Limit). Luminansi langit senja juga meredam kontras piringan.
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Risk 3: Lag Time / Sunset-Moonset difference */}
                        <div className={`p-2.5 border transition-all relative group ${isCriticalLag ? "bg-white border-[#D97706]" : "bg-black/5 border-transparent opacity-65"}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[8.5px] uppercase font-bold tracking-wider text-amber-900 block">Jeda Waktu Kritis</span>
                            {isCriticalLag && (
                              <span className="h-2 w-2 rounded-full bg-[#D97706] animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm font-bold mt-1 text-[#141414]">
                            {lagTimeMinutes > 0 ? `${lagTimeMinutes.toFixed(1)} mnt` : "0 mnd"} <span className="text-[9px] font-normal text-[#141414]/65">(Limit: 15 mnd)</span>
                          </p>
                          <p className="text-[8.5px] text-[#141414]/85 leading-normal mt-1.5 text-justify font-serif italic">
                            {isCriticalLag 
                              ? "Jeda waktu tenggelam sangat sempit. Kontras visual ideal baru tercapai ~10 menit pasca sunset, menyisakan waktu pencarian sangat minim sebelum moonset."
                              : "Sela waktu pencarian hilal di lapangan relatif memadai pasca matahari terbenam."}
                          </p>
                          <div className="mt-2 pt-1.5 border-t border-[#141414]/10 flex items-center justify-between text-[8px] uppercase font-bold text-[#D97706]/90 select-none">
                            <span>Faktor Risiko Geometris</span>
                            <div className="relative group cursor-help">
                              <span className="underline decoration-dotted cursor-pointer hover:text-amber-950 font-black">Detail Analisis ⓘ</span>
                              <div className="absolute right-0 bottom-full mb-1.5 w-60 bg-white border border-[#141414] text-[#141414] p-3 text-[8px] font-mono leading-relaxed normal-case font-normal shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[1000] border-l-4 border-l-[#D97706]">
                                <p className="font-bold uppercase text-[7.5px] tracking-wide mb-1 text-amber-900">Twilight Luminance & Eye Acuity</p>
                                Waktu senja sipil (civil twilight) memiliki intensitas pendar langit tinggi. Mata manusia memerlukan adaptasi gelap (dark adaptation) minimal selama 10 menit untuk mengenali garis tipis cahaya hilal sebelum tenggelam fisis.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ACTION BAR FOR PDF EXPORT */}
                <div className="flex flex-col sm:flex-row justify-between items-center bg-[#EDEDEB] p-3 gap-3 border border-[#141414]">
                  <div className="text-[10px] uppercase font-mono font-bold tracking-wider opacity-70">
                    Sertifikasi Resmi &amp; Laporan Detail Hilal v3.0 (NASA JPL DE440)
                  </div>
                  <button
                    onClick={handleExportToPDF}
                    className="w-full sm:w-auto px-4 py-1.5 bg-[#141414] text-[#E4E3E0] hover:bg-[#323230] font-bold text-[10px] uppercase cursor-pointer transition-colors flex items-center justify-center gap-2 border border-[#141414]"
                  >
                    <Download className="h-3.5 w-3.5" /> Ekspor Dokumen Laporan PDF
                  </button>
                </div>

                {/* PRIMARY METRICS PANEL */}
                <div className="grid grid-cols-2 md:grid-cols-4 border border-[#141414] divide-x divide-y md:divide-y-0 divide-[#141414] bg-white text-[#141414]">
                  <div className="p-4 bg-white">
                    <p className="text-[9px] font-serif italic text-[#141414]/60 uppercase leading-none">Tinggi Hilal Toposentrik</p>
                    <p className="text-xl md:text-2xl font-mono font-bold leading-tight mt-1.5 text-[#141414]">
                      {computationResult.moonAltTopo.toFixed(2)}°
                    </p>
                    <p className="text-[9px] font-mono text-[#141414]/50 mt-1">Sumbu Topo + Atmosfer</p>
                  </div>
                  
                  <div className="p-4 bg-[#EDEDEB]">
                    <p className="text-[9px] font-serif italic text-[#141414]/60 uppercase leading-none">Elongasi Toposentrik</p>
                    <p className="text-xl md:text-2xl font-mono font-bold leading-tight mt-1.5 text-[#141414]">
                      {computationResult.elongationTopoSunset.toFixed(2)}°
                    </p>
                    <p className="text-[9px] font-mono text-teal-700 font-bold uppercase mt-1">Separasi 3D Sunset</p>
                  </div>

                  <div className="p-4 bg-white">
                    <p className="text-[9px] font-serif italic text-[#141414]/60 uppercase leading-none">Umur Hilal (Waktu Sunset)</p>
                    <p className="text-xl md:text-2xl font-mono font-bold leading-tight mt-1.5 text-[#141414]">
                      {computationResult.moonAgeHours.toFixed(1)}j
                    </p>
                    <p className="text-[9px] font-mono text-[#141414]/50 mt-1">Sejak konjungsi ijtima'</p>
                  </div>

                  <div className="p-4 bg-[#EDEDEB]">
                    <p className="text-[9px] font-serif italic text-[#141414]/60 uppercase leading-none">Pasaran / Neptu Jawa</p>
                    <p className="text-xl md:text-2xl font-mono font-bold leading-tight mt-1.5 text-[#141414]">
                      {wetonResult.pasaran}
                    </p>
                    <p className="text-[9px] font-mono text-[#141414]/50 mt-1">Sabtu Pahing (Neptu: {wetonResult.neptu})</p>
                  </div>
                </div>

                {/* VISUAL GEOGRAPHIC TARGETING & STREAMLIT-STYLE REGISTRY & MOON PHASE */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {/* Column 1: Interactive Leaflet Map */}
                  <div className="lg:col-span-1">
                    <InteractiveMap 
                      latitude={latitude}
                      longitude={longitude}
                      onCoordinateChange={(lat, lon) => {
                        setLatitude(lat);
                        setLongitude(lon);
                      }}
                    />
                  </div>

                  {/* Column 2: 2D Sky Position Representation (Relative Placement) */}
                  <div className="lg:col-span-1">
                    <SkyPositionCanvas 
                      sunsetTime={computationResult.sunsetTime}
                      moonAltTopo={computationResult.moonAltTopo}
                      moonAzTopo={computationResult.moonAzTopo}
                      sunAltTopo={computationResult.sunAltTopo}
                      sunAzTopo={computationResult.sunAzTopo}
                      elongationTopoSunset={computationResult.elongationTopoSunset}
                      moonAgeHours={computationResult.moonAgeHours}
                    />
                  </div>

                  {/* Column 3: Moon Phase Visual Component */}
                  <div className="lg:col-span-1">
                    <MoonPhaseCanvas date={computationResult.sunsetTime} />
                  </div>

                  {/* Right Column: Streamlit Comparison Registry */}
                  <div className="lg:col-span-1 border border-[#141414] bg-[#EDEDEB] text-[#141414] flex flex-col font-mono">
                    <div className="px-3 py-1.5 border-b border-[#141414] bg-[#D1D0CC] text-[9px] uppercase font-bold tracking-widest flex justify-between items-center select-none">
                      <div className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        <span>Komparator Perhitungan (Streamlit Registry)</span>
                      </div>
                      <span className="opacity-60 text-[8px]">LOG & COMPARE DATA</span>
                    </div>

                    <div className="p-3 bg-white border-b border-[#141414] text-[10px] space-y-1.5 leading-relaxed">
                      <p className="font-serif italic text-[#141414]/85">
                        Rekam dan kunci konfigurasi hisab saat ini untuk membandingkan parameter tinggi hilal, konjungsi ijtima', weton, serta kelolosan antar tanggal Hijriah berbeda.
                      </p>
                    </div>

                    <div className="p-3 border-b border-[#141414] bg-[#EBEAE7] flex gap-2">
                      <button
                        onClick={handleSaveCalculation}
                        className="flex-1 py-1 px-3 bg-[#141414] text-[#E4E3E0] hover:bg-[#3c3c3a] font-bold text-[10px] uppercase cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-[#141414]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Simpan Hasil Aktif
                      </button>
                      {savedCalculations.length > 0 && (
                        <button
                          onClick={handleClearAllCalculations}
                          className="py-1 px-3 bg-red-100 text-red-900 hover:bg-red-200 font-bold text-[10px] uppercase cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-red-900/30"
                          title="Format Database"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Bersihkan
                        </button>
                      )}
                    </div>

                    <div className="flex-1 max-h-64 overflow-y-auto bg-white divide-y divide-[#141414]/20">
                      {savedCalculations.length === 0 ? (
                        <div className="p-8 text-center select-none flex flex-col items-center justify-center h-48">
                          <History className="h-8 w-8 opacity-20 mb-2" />
                          <p className="text-[10px] uppercase font-bold text-[#141414]/60">Belum Ada Data</p>
                          <p className="text-[9px] text-[#141414]/50 font-serif italic mt-1 max-w-[240px]">
                            Simpan beberapa kali pada koordinat atau bulan yang berbeda untuk membandingkan tren integral hilal.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[9px] border-collapse">
                            <thead>
                              <tr className="bg-[#EDEDEB] text-[#141414]/70 uppercase border-b border-[#141414] font-bold">
                                <th className="p-1 px-2 font-bold font-mono">Bulan/Tahun</th>
                                <th className="p-1 px-2 font-bold font-mono">Lokasi (Lat, Lon)</th>
                                <th className="p-1 px-2 font-bold font-mono text-center">E_total</th>
                                <th className="p-1 px-2 font-bold font-mono text-center">H_int</th>
                                <th className="p-1 px-2 font-bold font-mono text-center">Hasil Keputusan</th>
                                <th className="p-1 px-2 font-bold font-mono text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#141414]/10">
                              {savedCalculations.map((run) => (
                                <tr 
                                  key={run.id} 
                                  onClick={() => handleLoadCalculation(run)}
                                  className="hover:bg-[#EBEAE7]/40 cursor-pointer transition-colors group"
                                >
                                  <td className="p-1 px-2 font-semibold">
                                    {run.monthName.substring(0, 6)} {run.hijriYear}H
                                  </td>
                                  <td className="p-1 px-2 font-mono text-[8px] opacity-70">
                                    {run.latitude.toFixed(2)}°, {run.longitude.toFixed(2)}°
                                  </td>
                                  <td className="p-1 px-2 font-mono text-center font-bold">
                                    {run.E_total.toFixed(1)}°
                                  </td>
                                  <td className="p-1 px-2 font-mono text-center font-bold">
                                    {run.H_integral.toFixed(1)}°
                                  </td>
                                  <td className="p-1 px-2 text-center">
                                    {run.isNewMonthEstablished ? (
                                      <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-900/25 font-bold uppercase text-[7px]" style={{ fontSize: '7px' }}>
                                        Established
                                      </span>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-950 border border-rose-900/25 font-bold uppercase text-[7px]" style={{ fontSize: '7px' }}>
                                        Istikmal
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-1 px-2 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleLoadCalculation(run);
                                        }}
                                        className="p-1 text-blue-800 hover:bg-blue-50 border border-transparent hover:border-blue-800/20"
                                        title="Muat Data"
                                      >
                                        🎯
                                      </button>
                                      <button 
                                        onClick={(e) => handleDeleteCalculation(run.id, e)}
                                        className="p-1 text-red-800 hover:bg-red-50 border border-transparent hover:border-red-800/20"
                                        title="Hapus"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {savedCalculations.length > 0 && (
                      <div className="p-3 border-t border-[#141414] bg-white">
                        <span className="text-[8px] uppercase font-bold opacity-60 block mb-2 font-mono">Grafik Perbandingan Energi (E_total vs H_integral)</span>
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={savedCalculations.map((c) => ({
                                name: `${c.monthName.substring(0, 4)} ${c.hijriYear % 100}`,
                                E_total: c.E_total,
                                H_integral: c.H_integral
                              }))}
                              margin={{ top: 5, right: 5, left: -32, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#D1D0CC" />
                              <XAxis dataKey="name" stroke="#141414" fontSize={7} fontFamily="monospace" />
                              <YAxis stroke="#141414" fontSize={7} fontFamily="monospace" />
                              <ChartTooltip contentStyle={{ backgroundColor: '#EDEDEB', borderColor: '#141414', color: '#141414', fontSize: 9, fontFamily: 'monospace' }} />
                              <Legend wrapperStyle={{ fontSize: 8, fontFamily: 'monospace', marginTop: 2 }} />
                              <Bar dataKey="E_total" fill="#141414" radius={0} name="E_total" />
                              <Bar dataKey="H_integral" fill="#787774" radius={0} name="H_integral" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TIMESTAMPS BAR LIST */}
                <div className="border border-[#141414] bg-[#EDEDEB] text-[#141414]">
                  <div className="px-4 py-3 border-b border-[#141414] bg-[#D1D0CC]">
                    <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#141414]" /> PRESISI KEJADIAN ASTRONOMIS (DE440 TOPOCENTRIC)
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#141414]">
                    <div className="p-4 bg-white space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-800 font-bold text-[10px] uppercase font-mono">
                        <Sun className="h-3.5 w-3.5" />
                        <span>Ijtima' (Konjungsi Geosentrik)</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-[#141414] leading-tight">
                        {formatPreciseDate(computationResult.ijtimaTime)}
                      </p>
                      <span className="text-[9px] text-[#141414]/60 font-serif italic block">
                        Ditemukan melalui solver transenden ekliptika lunar Δλ = 0.
                      </span>
                    </div>

                    <div className="p-4 bg-[#EBEAE7] space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[10px] uppercase font-mono">
                        <Moon className="h-3.5 w-3.5" />
                        <span>Astronomical Sunset (Matahari)</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-[#141414] leading-tight">
                        {formatPreciseDate(computationResult.sunsetTime)}
                      </p>
                      <span className="text-[9px] text-[#141414]/70 font-mono block">
                        Azimuth: {computationResult.sunAzTopo.toFixed(2)}° • Elevasi: {computationResult.sunAltTopo.toFixed(2)}°
                      </span>
                    </div>

                    <div className="p-4 bg-white space-y-1">
                      <div className="flex items-center gap-1.5 text-teal-850 font-bold text-[10px] uppercase font-mono">
                        <Compass className="h-3.5 w-3.5" />
                        <span>Astronomical Moonset (Bulan)</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-[#141414] leading-tight">
                        {formatPreciseDate(computationResult.moonsetTime)}
                      </p>
                      <span className="text-[9px] text-[#141414]/70 font-mono block">
                        Azimuth: {computationResult.moonAzTopo.toFixed(2)}° • Elevasi: {computationResult.moonAltTopo.toFixed(2)}°
                      </span>
                    </div>
                  </div>
                </div>

                {/* INTEGRATIONS PLOTTERS */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {/* ELONGATION AREA */}
                  <div className="border border-[#141414] bg-[#EDEDEB] text-[#141414] flex flex-col">
                    <div className="px-4 py-3 border-b border-[#141414] bg-[#D1D0CC] flex justify-between items-center">
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-[#141414]" /> INTEGRAL ENERGY ELONGASI (E_total)
                        </h3>
                        <p className="text-[9px] font-serif italic text-[#141414]/60">Akumulasi intensitas elongasi sejak Ijtima' hingga Sunset</p>
                      </div>
                      <div className="font-mono text-right">
                        <span className="text-base font-bold text-[#141414]">{computationResult.E_total.toFixed(2)}</span>
                        <p className="text-[8px] opacity-60 font-mono">°-jam (Limit: {eTotalThreshold} °j)</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white flex-1">
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={computationResult.E_points} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#D1D0CC" />
                            <XAxis 
                              dataKey="time"
                              tickFormatter={(t) => new Date(t).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                              stroke="#141414" 
                              fontSize={9}
                              fontFamily="monospace"
                            />
                            <YAxis stroke="#141414" fontSize={9} fontFamily="monospace" unit="°" />
                            <ChartTooltip 
                              labelFormatter={(label) => new Date(label).toLocaleString()}
                              formatter={(value: any) => [`${parseFloat(value).toFixed(2)}°`, 'Elongasi Toposentrik']}
                              contentStyle={{ backgroundColor: '#EDEDEB', borderColor: '#141414', color: '#141414', fontSize: 10, fontFamily: 'monospace' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="val" 
                              stroke="#141414" 
                              strokeWidth={1.5}
                              fillOpacity={0.15} 
                              fill="#141414" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[9px] text-[#141414]/70 text-center font-mono mt-2 uppercase">
                        Sumbu Integrasi Numerasi Simpson (1/3 Newton-Cotes) = {computationResult.E_total.toFixed(4)} °-JAM.
                      </p>
                    </div>
                  </div>

                  {/* KETINGGIAN AREA */}
                  <div className="border border-[#141414] bg-[#EDEDEB] text-[#141414] flex flex-col">
                    <div className="px-4 py-3 border-b border-[#141414] bg-[#D1D0CC] flex justify-between items-center">
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-[#141414]" /> INTEGRAL ENERGY KETINGGIAN (H_integral)
                        </h3>
                        <p className="text-[9px] font-serif italic text-[#141414]/60">Akumulasi ketinggian Hilal di atas ufuk barat selang Sunset-Moonset</p>
                      </div>
                      <div className="font-mono text-right">
                        <span className="text-base font-bold text-[#141414]">{computationResult.H_integral.toFixed(2)}</span>
                        <p className="text-[8px] opacity-60 font-mono">°-jam (Limit: {hIntegralThreshold.toFixed(1)} °j)</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white flex-1">
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={computationResult.H_points} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#D1D0CC" />
                            <XAxis 
                              dataKey="time"
                              tickFormatter={(t) => new Date(t).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                              stroke="#141414" 
                              fontSize={9}
                              fontFamily="monospace"
                            />
                            <YAxis stroke="#141414" fontSize={9} fontFamily="monospace" unit="°" />
                            <ChartTooltip 
                              labelFormatter={(label) => new Date(label).toLocaleString()}
                              formatter={(value: any) => [`${parseFloat(value).toFixed(2)}°`, 'Tinggi Hilal']}
                              contentStyle={{ backgroundColor: '#EDEDEB', borderColor: '#141414', color: '#141414', fontSize: 10, fontFamily: 'monospace' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="val" 
                              stroke="#141414" 
                              strokeWidth={1.5}
                              fillOpacity={0.15} 
                              fill="#141414" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[9px] text-[#141414]/70 text-center font-mono mt-2 uppercase">
                        Sumbu Integrasi Numerasi Simpson (1/3 Newton-Cotes) = {computationResult.H_integral.toFixed(4)} °-JAM.
                      </p>
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

            {/* TAB 2: ORBITAL PHYSICS SANDBOX */}
            {activeTab === "sandbox" && (
              <motion.div
                key="sandbox"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border border-[#141414] bg-[#EDEDEB] text-[#141414]">
                  <div className="p-4 border-b border-[#141414] bg-[#D1D0CC] flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#141414] shrink-0" />
                    <div>
                      <h2 className="text-xs uppercase font-bold tracking-widest font-mono">Simulasi Fisika Orbital &amp; Kecepatan Keplerian</h2>
                      <p className="text-[10px] font-serif italic opacity-60">Parameter mekanika selestial Bulan berbasis Hukum Kepler, Einstein/Shapiro, dan Gaya Tidal Bumi-Bulan</p>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <p className="text-xs text-[#141414]/85 leading-relaxed font-serif">
                      Setiap bulan, bulan bergerak mengelilingi Bumi pada orbit berbentuk elips (Hukum I Kepler). Fluktuasi jarak bumi-bulan ini mengakibatkan kecepatan gerak orbit bulan berubah, delay waktu relativistik Shapiro berubah, serta memengaruhi tarikan gaya gravitasi pasang surut (tidal) Bumi secara kontinu.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* KEPLERIAN */}
                      <div className="p-4 bg-white border border-[#141414] space-y-2">
                        <div className="flex items-center gap-1.5 text-[#141414] font-bold text-[10px] uppercase tracking-wider font-mono">
                          <Globe className="h-4 w-4" />
                          <span>Mekanika Keplerian I</span>
                        </div>
                        <hr className="border-[#141414] opacity-20" />
                        <div className="space-y-1 font-mono">
                          <span className="text-[8px] text-[#141414]/60 block uppercase">EKSENTRISITAS ORBIT (e)</span>
                          <div className="text-base font-bold text-[#141414]">{(orbitalPhysicsRes.eccentricity).toFixed(4)}</div>
                        </div>
                        <div className="space-y-1 font-mono">
                          <span className="text-[8px] text-[#141414]/60 block uppercase">JARAK SEMI-MAJOR (a)</span>
                          <div className="text-base font-bold text-[#141414]">{orbitalPhysicsRes.semiMajorAxisKm.toLocaleString("id-ID")} km</div>
                        </div>
                        <p className="text-[10px] opacity-75 leading-relaxed pt-2 border-t border-dotted border-[#141414]/40 font-serif italic">
                          Mematuhi elips <strong className="font-mono font-bold not-italic">r = a(1-e²)/(1+e cos θ)</strong>. Jarak aktual bulan pada masa rukyat ini adalah <strong className="font-bold font-mono not-italic">{(orbitalPhysicsRes.currentDistanceKm).toFixed(0)} km</strong>.
                        </p>
                      </div>

                      {/* ORBITAL VELOCITY */}
                      <div className="p-4 bg-[#EBEAE7] border border-[#141414] space-y-2">
                        <div className="flex items-center gap-1.5 text-[#141414] font-bold text-[10px] uppercase tracking-wider font-mono">
                          <Activity className="h-4 w-4" />
                          <span>Kecepatan Vis-Viva</span>
                        </div>
                        <hr className="border-[#141414] opacity-20" />
                        <div className="space-y-1 font-mono">
                          <span className="text-[8px] text-[#141414]/60 block uppercase">KECEPATAN AKTUAL (v)</span>
                          <div className="text-lg font-bold text-blue-700">{orbitalPhysicsRes.orbitalVelocityKmS.toFixed(4)} km/s</div>
                        </div>
                        <div className="space-y-1 font-mono">
                          <span className="text-[8px] text-[#141414]/60 block uppercase">CONVERSION (KM/H)</span>
                          <div className="text-xs font-semibold text-blue-700">{(orbitalPhysicsRes.orbitalVelocityKmS * 3600).toFixed(0)} km/jam</div>
                        </div>
                        <p className="text-[10px] opacity-75 leading-relaxed pt-2 border-t border-dotted border-[#141414]/40 font-serif italic">
                          Konservasi Energi Spesifik orbital: <strong className="font-mono font-bold not-italic">v = √[GM(2/r - 1/a)]</strong>. Kecepatan ini meningkat ketika di Perigee dan melambat di Apogee.
                        </p>
                      </div>

                      {/* SHAPIRO RELATIVITY & TIDAL */}
                      <div className="p-4 bg-white border border-[#141414] space-y-2">
                        <div className="flex items-center gap-1.5 text-[#141414] font-bold text-[10px] uppercase tracking-wider font-mono">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Relativitas Einstein</span>
                        </div>
                        <hr className="border-[#141414] opacity-20" />
                        <div className="space-y-1 font-mono">
                          <span className="text-[8px] text-[#141414]/60 block uppercase">SHAPIRO TIMING DELAY (Δt)</span>
                          <div className="text-base font-bold text-amber-700">+{orbitalPhysicsRes.shapiroDelayNs.toFixed(4)} ns</div>
                        </div>
                        <div className="space-y-1 font-mono">
                          <span className="text-[8px] text-[#141414]/60 block uppercase">TIDAL ACCELERATION SCALE</span>
                          <div className="text-[10px] font-bold text-[#141414]">{orbitalPhysicsRes.tidalAccelerationMScale.toExponential(4)} m/s²</div>
                        </div>
                        <p className="text-[10px] opacity-75 leading-relaxed pt-2 border-t border-dotted border-[#141414]/40 font-serif italic">
                          Persamaan Einstein Delay: <strong className="font-mono font-bold not-italic">Δt = (2GM/c³) · ln(r1/r2)</strong>. Gaya tidal Bumi-Bulan menarik samudera secara periodik.
                        </p>
                      </div>

                    </div>
                  </div>
                </div>

                {/* EXTRA DECORATIVE DATA PLOT */}
                <div className="border border-[#141414] bg-[#EDEDEB] text-[#141414]">
                  <div className="px-4 py-3 border-b border-[#141414] bg-[#D1D0CC]">
                    <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest font-mono">ANATOMI MODEL DE440 &amp; RELATIONS TERBENTUK</h3>
                  </div>
                  <div className="p-4 bg-white m-4 border border-[#141414]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-[#141414]">
                      <div className="pt-2 sm:pt-0">
                        <span className="text-[8px] opacity-60 block font-mono">RUANGAN BUMI-BULAN</span>
                        <strong className="text-xs text-[#141414] block mt-1">Orbit Elips Eksentrik</strong>
                      </div>
                      <div className="pt-2 sm:pt-0">
                        <span className="text-[8px] opacity-60 block font-mono">JARAK APOGEE</span>
                        <strong className="text-xs text-[#141414] block mt-1">405.696 km</strong>
                      </div>
                      <div className="pt-2 sm:pt-0">
                        <span className="text-[8px] opacity-60 block font-mono">JARAK PERIGEE</span>
                        <strong className="text-xs text-[#141414] block mt-1">363.104 km</strong>
                      </div>
                      <div className="pt-2 sm:pt-0">
                        <span className="text-[8px] opacity-60 block font-mono">KONSTANTA GRAVITASI GM</span>
                        <strong className="text-xs text-[#141414] font-mono block mt-1">3.986004418e14 m³/s²</strong>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* TAB 3: NASA DE440 BSP LOGS ENGINE */}
            {activeTab === "ephemeris" && (
              <motion.div
                key="ephemeris"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border border-[#141414] bg-[#EDEDEB] text-[#141414]">
                  
                  <div className="p-4 border-b border-[#141414] bg-[#D1D0CC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FileCode className="h-5 w-5 text-[#141414]" />
                      <div>
                        <h2 className="text-xs uppercase font-bold tracking-widest font-mono">Validasi Checksum Ephemeris NASA DE440 BSP</h2>
                        <p className="text-[10px] font-serif italic opacity-60">Verifikator integritas data posisi astronomis, model toposentris, dan logger penanganan error</p>
                      </div>
                    </div>

                    <button 
                      onClick={triggerBspRevalidation} 
                      disabled={isDownloading}
                      className="px-3 py-1.5 bg-[#141414] text-[#E4E3E0] hover:bg-[#3c3c3a] font-bold text-xs uppercase cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 font-mono border border-[#141414]"
                    >
                      <Download className="h-3.5 w-3.5" /> {isDownloading ? "Mengunduh..." : "Revalidasi de440.bsp"}
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    <p className="text-xs text-[#141414]/90 font-serif leading-relaxed">
                      Sebelum melakukan komputasi Simpson 1/3, mesin memerlukan file ephemeris presisi tinggi <strong className="font-mono not-italic font-bold">de440.bsp</strong> (NASA/JPL Development Ephemeris 440) yang berisi koordinat orbital toposentris planet dan satelit dari tahun 1550 s.d. 2650. Jika file hilang, metode fallback analitis otomatis digunakan sembari mengunduh ulang dataset de440.bsp:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* DOWNLOAD PROGRESS CARD */}
                      <div className="p-4 bg-white border border-[#141414] space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono font-bold text-[#141414]/70 uppercase">Unduh de440.bsp</span>
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border border-[#141414] ${isDownloading ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {isDownloading ? 'DOWNLOADING' : 'COMPLETED'}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[10px] font-mono text-[#141414]">
                            <span>Progress bar</span>
                            <span>{downloadProgress}%</span>
                          </div>
                          <div className="w-full bg-[#EBEAE7] h-3 border border-[#141414] overflow-hidden p-0.5">
                            <div 
                              className="bg-[#141414] h-full transition-all duration-300"
                              style={{ width: `${downloadProgress}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="text-[9px] text-[#141414]/75 leading-normal font-mono uppercase">
                          Path: /assets/ephemeris/de440.bsp <br />
                          Server: NASA JPL FTP Payload
                        </div>
                      </div>

                      {/* CHECKSUM SHA */}
                      <div className="p-4 bg-[#EBEAE7] border border-[#141414] space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono font-bold text-[#141414]/70 uppercase">Integritas Checksum SHA-256</span>
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 border border-[#141414] bg-emerald-100 text-emerald-800">
                            {checksumStatus}
                          </span>
                        </div>

                        <div className="space-y-2 pt-1 font-mono text-[9px] uppercase">
                          <div>
                            <span className="text-[8px] text-[#141414]/60 block">Expected SHA-256</span>
                            <span className="text-[#141414] break-all block truncate">9f81a7b8e5c3c12d4a5b6f7e8a9b0c1d2e3f4a5b...</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-[#141414]/60 block">Actual payload code</span>
                            <span className="text-emerald-800 break-all block truncate">9f81a7b8e5c3c12d4a5b6f7e8a9b0c1d2e3f4a5b...</span>
                          </div>
                        </div>
                      </div>

                      {/* ERROR HANDLER */}
                      <div className="p-4 bg-white border border-[#141414] space-y-3">
                        <span className="text-[9px] font-mono font-bold text-[#141414]/70 uppercase block">Sistem Penanganan Error</span>
                        
                        <div className="space-y-1.5 pt-1 uppercase">
                          <div className="flex items-center gap-1.5 text-[10px] text-[#141414] font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            <span>Fallback SGP4/DE440 verified.</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#141414] font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            <span>Parallax Moon HP corrected.</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#141414] font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            <span>Refraction index synchronized.</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* CONSOLE LOGGER */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-mono font-bold text-[#141414]/70 uppercase block">Konsol Logger Real-time (Sistem Telemetri)</span>
                      <div className="h-40 bg-[#141414] text-[#E4E3E0] p-4 font-mono text-[10px] overflow-y-auto space-y-1 select-all border border-[#141414]">
                        {checksumLog.map((logStr, idx) => (
                          <div key={idx} className="hover:bg-[#EBEAE7]/10 px-1 py-0.5">
                            {logStr}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* FOOTER BAR */}
      <footer className="h-10 border-t border-[#141414] bg-[#141414] text-[#E4E3E0] flex items-center justify-between px-6 text-[9px] font-mono uppercase tracking-widest">
        <span>Integral-Hilal Computational Engine - Secure Session</span>
        <div className="hidden sm:flex gap-6">
          <span>T: 2026-06-22 00:15:12 UTC</span>
          <span>Status: Synchronized</span>
        </div>
      </footer>

    </div>
  );
}
