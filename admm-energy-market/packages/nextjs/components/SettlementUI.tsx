import React from 'react';

export default function SettlementMap({ mapData, txHash }: { mapData: any, txHash: string }) {
  if (!mapData) return <div className="text-center p-20 font-bold animate-pulse text-blue-500">Calculating Regional Grid Fees...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in zoom-in duration-700">
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-blue-500">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-800">🌍 Regional Energy Dispatch Map</h2>
            <p className="text-slate-500 text-sm mt-1">Blockchain Hash: <span className="font-mono text-blue-600">{txHash.slice(0,20)}...</span></p>
          </div>
          <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border border-emerald-100">Verified & Anchored</span>
        </header>

        {/* 🌟 你朋友设计的地图 UI */}
        <div className="relative w-full h-[550px] bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl">
          
          {/* Station S1 */}
          <div className="absolute transition-all hover:scale-105" style={{ left: `${mapData.s1.x}%`, top: `${mapData.s1.y}%` }}>
             <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-emerald-500/50 w-60 shadow-2xl">
                <p className="text-emerald-400 font-bold text-sm mb-2 flex items-center gap-2">☀️ {mapData.s1.name}</p>
                <div className="text-[10px] text-slate-300 font-mono space-y-1">
                   <p className="flex justify-between">Distance: <span>{mapData.s1.distance} km</span></p>
                   <p className="flex justify-between">Base Price: <span>¥{mapData.s1.admmPrice}</span></p>
                   <p className="flex justify-between text-orange-400">Grid Fee: <span>+¥{mapData.s1.transmissionFee}</span></p>
                   <div className="border-t border-slate-700 mt-2 pt-2 text-white font-bold flex justify-between text-xs">
                      <span>Final Price:</span> <span className="text-emerald-400 font-black">¥{mapData.s1.finalPrice}</span>
                   </div>
                </div>
             </div>
          </div>

          {/* Station S2 */}
          <div className="absolute transition-all hover:scale-105" style={{ left: `${mapData.s2.x}%`, top: `${mapData.s2.y}%` }}>
             <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-blue-500/50 w-60 shadow-2xl">
                <p className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2">🌬️ {mapData.s2.name}</p>
                <div className="text-[10px] text-slate-300 font-mono space-y-1">
                   <p className="flex justify-between">Distance: <span>{mapData.s2.distance} km</span></p>
                   <p className="flex justify-between">Base Price: <span>¥{mapData.s2.admmPrice}</span></p>
                   <p className="flex justify-between text-orange-400">Grid Fee: <span>+¥{mapData.s2.transmissionFee}</span></p>
                   <div className="border-t border-slate-700 mt-2 pt-2 text-white font-bold flex justify-between text-xs">
                      <span>Final Price:</span> <span className="text-blue-400 font-black">¥{mapData.s2.finalPrice}</span>
                   </div>
                </div>
             </div>
          </div>

          {/* 城市中心买家 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
             <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center border-8 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                <span className="text-4xl">🏙️</span>
                <span className="text-[10px] font-black text-slate-800 mt-1 uppercase tracking-tighter">City Center</span>
             </div>
          </div>

          {/* 动态连线 */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
             <line x1={`${mapData.s1.x + 5}%`} y1={`${mapData.s1.y + 5}%`} x2="50%" y2="50%" stroke="#10b981" strokeWidth="2" strokeDasharray="10,10" className="animate-[dash_3s_linear_infinite]" />
             <line x1={`${mapData.s2.x + 5}%`} y1={`${mapData.s2.y + 5}%`} x2="50%" y2="50%" stroke="#3b82f6" strokeWidth="2" strokeDasharray="10,10" className="animate-[dash_3s_linear_infinite]" />
             <style>{`@keyframes dash { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }`}</style>
          </svg>
        </div>
      </div>
    </div>
  );
}