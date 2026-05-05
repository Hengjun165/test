"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSignTypedData, useAccount } from "wagmi";
import "leaflet/dist/leaflet.css";

export default function FriendMapDashboard({ basePrice, txHash }: { basePrice: number, txHash: string }) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  
  // Core states
  const [activeStation, setActiveStation] = useState("s1");
  const [activeBuyer, setActiveBuyer] = useState("b1"); 
  const [loadSlider, setLoadSlider] = useState(50);
  const [priceData, setPriceData] = useState<any>(null);

  // --- Timeslot logic ---
  const TIMESLOTS = [
    "08:00 - 10:00 (Peak)", 
    "10:00 - 12:00 (Peak)", 
    "14:00 - 16:00 (Normal)", 
    "22:00 - 02:00 (Off-peak)"
  ];
  const [selectedTimeslot, setSelectedTimeslot] = useState(TIMESLOTS[0]);
  
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<any>(null);

  // 1. Fetch data (with selectedTimeslot dependency)
  useEffect(() => {
    // If the backend supports the timeslot parameter, you can append: &timeslot=${selectedTimeslot}
    fetch(`https://energy-backend-w2rj.onrender.com/calculate-final-price?stationId=${activeStation}&buyerId=${activeBuyer}&load=${loadSlider}&admmPrice=${basePrice}`)
      .then(res => res.json())
      .then(data => setPriceData(data))
      .catch(err => console.error("Fetch error:", err));
  }, [activeStation, activeBuyer, loadSlider, basePrice, selectedTimeslot]);

  // 2. Initialize map
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      if ((containerRef.current as any)._leaflet_id) return;

      const map = L.map(containerRef.current).setView([54.0, -2.5], 6);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 3. Update markers and polylines
  useEffect(() => {
    if (!priceData || !mapRef.current || !layerGroupRef.current) return;
    
    const updateMapVisuals = async () => {
      const L = (window as any).L || (await import("leaflet")).default;
      const layerGroup = layerGroupRef.current;
      layerGroup.clearLayers();

      const createIcon = (emoji: string, label: string, color: string) => L.divIcon({
        html: `
          <div style="display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:30px; filter:drop-shadow(0 0 10px ${color})">${emoji}</div>
            <div style="background:#005c9c; color:white; font-size:10px; padding:2px 8px; border-radius:10px; white-space:nowrap; margin-top:5px; font-weight:bold; border:2px solid white;">${label}</div>
          </div>`,
        className: 'custom-div-icon',
        iconSize: [50, 50]
      });

      L.marker(priceData.sellerPos, { icon: createIcon(activeStation === 's1' ? '☀️' : '🌬️', priceData.sellerName, '#fbbf24') }).addTo(layerGroup);
      L.marker(priceData.buyerPos, { icon: createIcon('🏭', priceData.buyerName, '#3b82f6') }).addTo(layerGroup);

      const polyline = L.polyline([priceData.sellerPos, priceData.buyerPos], {
        color: activeStation === 's1' ? '#f59e0b' : '#2563eb',
        weight: 5,
        dashArray: '10, 15',
        className: 'animate-dash'
      }).addTo(layerGroup);

      mapRef.current.fitBounds(polyline.getBounds(), { padding: [100, 100] });
    };

    updateMapVisuals();
  }, [priceData, activeStation]);

  const handleLock = async () => {
    try {
      const domain = { name: "EnergyExchange", version: "1", chainId: 11155111, verifyingContract: "0x67Ef5633426F88405E5c6492aE45A4a68a74be7c" as `0x${string}` };
      const types = { Settlement: [{ name: "entity", type: "string" }, { name: "price", type: "uint256" }, { name: "amount", type: "uint256" }] };
      const value = { entity: activeBuyer, price: BigInt(Math.floor(parseFloat(priceData.finalPrice) * 100)), amount: BigInt(loadSlider * 100) };
      await signTypedDataAsync({ domain, types, primaryType: "Settlement", message: value });
      alert("Settlement Confirmed!");
    } catch (e) { alert("Rejected"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden">
      <style>{`
        .animate-dash { stroke-dashoffset: 1000; animation: dash 5s linear infinite; }
        @keyframes dash { to { stroke-dashoffset: 0; } }
        .leaflet-container { width: 100%; height: 100%; z-index: 1; }
        .custom-div-icon { background: transparent !important; border: none !important; }
      `}</style>

      {/* Top Header */}
      <div className="h-24 bg-[#005c9c] flex justify-between items-center px-12 shadow-2xl border-b-4 border-[#004a7c] shrink-0 z-10">
        <div>
           <h2 className="text-3xl font-black tracking-tighter text-white italic">UK NATIONAL DISPATCH</h2>
           <p className="text-xs text-blue-100 font-mono opacity-80 uppercase tracking-widest mt-1">Status: SECURE_TRANSMISSION // TX: {txHash.slice(0,20)}...</p>
        </div>
        <div className="flex gap-12 text-white">
           {/* --- Time Display --- */}
           <div className="text-right border-r border-white/10 pr-12">
              <span className="text-[10px] font-bold text-blue-200 uppercase">Active Period</span>
              <p className="text-4xl font-black font-mono tracking-tighter text-orange-400">
                {selectedTimeslot.split(' ')[0]}
              </p>
           </div>
           <div className="text-right">
              <span className="text-[10px] font-bold text-blue-200 uppercase">Clearing Price</span>
              <p className="text-4xl font-black font-mono tracking-tighter">£{basePrice.toFixed(2)}</p>
           </div>
           <div className="text-right border-l border-white/20 pl-12">
              <span className="text-[10px] font-bold text-blue-200 uppercase">Local Load</span>
              <p className="text-4xl font-black font-mono tracking-tighter text-emerald-400">{loadSlider}%</p>
           </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Map Section */}
        <div className="flex-1 relative bg-slate-100" ref={containerRef}>
            <div className="absolute top-6 left-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-xl border-2 border-[#005c9c] shadow-xl">
                <p className="text-[10px] font-black text-[#005c9c] uppercase mb-1">Live Grid Topology</p>
                <p className="text-[9px] text-slate-500 font-mono">Routing Path: Active</p>
            </div>
        </div>

        {/* Right Console Section */}
        <div className="w-[450px] bg-white p-10 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-10 shrink-0 overflow-y-auto">
           
           {/* --- Timeslot Selector --- */}
           <div className="mb-8">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-4">Market Schedule</label>
              <select 
                value={selectedTimeslot}
                onChange={(e) => setSelectedTimeslot(e.target.value)}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-[#005c9c] transition-all cursor-pointer"
              >
                {TIMESLOTS.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
           </div>

           {/* 1. Sellers */}
           <div className="mb-10">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-4">1. Energy Source Selection</label>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setActiveStation('s1')} className={`py-5 rounded-2xl font-black text-[11px] transition-all border-2 ${activeStation==='s1'?'bg-slate-900 text-white border-slate-900 shadow-xl':'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>SOLAR STATION</button>
                 <button onClick={() => setActiveStation('s2')} className={`py-5 rounded-2xl font-black text-[11px] transition-all border-2 ${activeStation==='s2'?'bg-slate-900 text-white border-slate-900 shadow-xl':'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>WIND FARM</button>
              </div>
           </div>

           {/* 2. Buyer Identity */}
           <div className="mb-10">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-4">2. Select Your Identity</label>
              <div className="flex flex-col gap-3">
                 {[
                   {id: 'b1', name: 'LARGE STEEL PLANT'},
                   {id: 'b2', name: 'BUS CHARGING STATION'},
                   {id: 'b3', name: 'CITY HOSPITAL'}
                 ].map(buyer => (
                   <button 
                     key={buyer.id}
                     onClick={() => setActiveBuyer(buyer.id)} 
                     className={`w-full py-5 rounded-2xl font-black text-[11px] text-left px-8 border-2 transition-all ${activeBuyer===buyer.id?'bg-[#005c9c] text-white border-[#005c9c] shadow-lg scale-[1.02]':'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'}`}
                   >
                     {buyer.name}
                   </button>
                 ))}
              </div>
           </div>

           {priceData && (
             <div className="flex-1 flex flex-col">
                <div className="bg-slate-50 rounded-3xl p-8 border-2 border-slate-100 mb-8">
                   <div className="space-y-5">
                      <div className="flex justify-between items-center">
                         <span className="text-[11px] font-bold text-slate-400 uppercase">Physical Route</span>
                         <span className="font-mono font-bold text-blue-600 text-lg">{priceData.distance} KM</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[11px] font-bold text-slate-400 uppercase">Transmission Fee</span>
                         <span className="font-mono font-bold text-orange-600">+£{priceData.transmissionFee}</span>
                      </div>
                      <div className="pt-6 border-t-2 border-dashed border-slate-200 flex flex-col">
                         <span className="text-[10px] font-black text-[#005c9c] uppercase tracking-widest mb-1 text-center">Settlement Total</span>
                         <span className="text-5xl font-black text-slate-900 text-center font-mono tracking-tighter">£{priceData.finalPrice}</span>
                      </div>
                   </div>
                </div>

                <div className="mb-10">
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-[11px] font-black text-slate-400 uppercase">Adjust Grid Load</span>
                      <span className="text-sm font-bold text-[#005c9c]">{loadSlider}%</span>
                   </div>
                   <input type="range" className="w-full h-2 bg-slate-200 rounded-lg accent-[#005c9c] cursor-pointer" value={loadSlider} onChange={e=>setLoadSlider(Number(e.target.value))} />
                </div>

                <button 
                  onClick={handleLock}
                  className="w-full bg-emerald-600 text-white py-6 rounded-2xl font-black hover:bg-emerald-500 transition-all shadow-xl uppercase tracking-widest text-xs"
                >
                  Confirm & Anchor Transaction
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
