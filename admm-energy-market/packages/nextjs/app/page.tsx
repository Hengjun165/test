"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignTypedData, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit"; 
import dynamic from 'next/dynamic';

// Modification: Added dynamic import and initialTimeslot property
const FriendMapDashboard = dynamic(
  () => import('../components/FriendMapDashboard'),
  { ssr: false } 
);

const ENTITY_NAMES: Record<string, string> = { 
  b1: "Large Steel Plant", 
  b2: "Bus Charging Station", 
  b3: "City Hospital", 
  s1: "Northwest Solar", 
  s2: "Coastal Wind" 
};

const TIMESLOTS = [
  "08:00 - 10:00 (Peak Hours)", 
  "10:00 - 12:00 (Peak Hours)", 
  "14:00 - 16:00 (Normal Hours)", 
  "22:00 - 02:00 (Off-peak Hours)"
];

const BACKEND_URL = "https://energy-backend-w2rj.onrender.com";
const VERIFYING_CONTRACT = "0x67Ef5633426F88405E5c6492aE45A4a68a74be7c";

export default function MultiAgentADMM() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const activeChainId = useChainId();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [currentStep, setCurrentStep] = useState(1); 
  const [historyResults, setHistoryResults] = useState<{slot: string, price: number}[]>([]);
  const [txHash, setTxHash] = useState("");

  const [userRole, setUserRole] = useState<"none" | "buyer" | "seller">("none");
  const [myEntityId, setMyEntityId] = useState("");
  const [myEntityName, setMyEntityName] = useState("");
  const [selectedTimeslot, setSelectedTimeslot] = useState("");
  const [isFloorActive, setIsFloorActive] = useState(false);
  
  const [state, setState] = useState<any>({ currentPrice: 100, round: 1, isConverged: false });
  const [bInputs, setBInputs] = useState({ b1: "", b2: "", b3: "" });
  const [sInputs, setSInputs] = useState({ s1: "", s2: "" });
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [currentRound, setCurrentRound] = useState(1);

  const fetchState = async () => {
    if (!selectedTimeslot || currentStep !== 1) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/interactive/state?timeslot=${encodeURIComponent(selectedTimeslot)}`);
      if (!res.ok) throw new Error("Server Response Error");
      setState(await res.json());
    } catch (e) { console.error("API Error:", e); }
  };

  useEffect(() => {
    let timer: any;
    if (isFloorActive) { 
      fetchState(); 
      timer = setInterval(fetchState, 2000); 
    }
    return () => clearInterval(timer);
  }, [selectedTimeslot, isFloorActive]);

  useEffect(() => {
    if (state && state.round > currentRound) { 
      setCurrentRound(state.round); 
      setLocked({}); 
    }
  }, [state?.round, currentRound]);

  const handleSubmit = async (role: "buyer" | "seller", id: string) => {
    const val = role === "buyer" ? (bInputs as any)[id] : (sInputs as any)[id];
    if (!val || Number(val) <= 0) return alert("Please enter a valid amount.");
    
    await fetch(`${BACKEND_URL}/api/interactive/submit`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, id, amount: parseFloat(val), timeslot: selectedTimeslot }),
    });
    setLocked(prev => ({ ...prev, [id]: true }));
    fetchState();
  };

  const handleConfirmSegment = async () => {
    const newHistory = [...historyResults, { slot: selectedTimeslot, price: state.currentPrice }];
    setHistoryResults(newHistory);
    
    // Execute on-chain settlement if the 4-timeslot negotiation is complete
    if (newHistory.length >= 4) {
      try {
        const avgPrice = newHistory.reduce((a, b) => a + b.price, 0) / 4;
        const tradeId = Date.now();
        const domain = { 
          name: "EnergyExchange", 
          version: "1", 
          chainId: activeChainId, 
          verifyingContract: VERIFYING_CONTRACT as `0x${string}` 
        };
        const types = { 
          Trade: [
            { name: "tradeId", type: "uint256" }, 
            { name: "price", type: "uint256" }, 
            { name: "amount", type: "uint256" }, 
            { name: "seller", type: "address" }
          ] 
        };
        const message = { 
          tradeId: BigInt(tradeId), 
          price: BigInt(Math.floor(avgPrice * 100)), 
          amount: BigInt(1000), 
          seller: address as `0x${string}` 
        };

        const signature = await signTypedDataAsync({ domain, types, primaryType: "Trade", message });
        
        const res = await fetch(`${BACKEND_URL}/api/verify-and-settle`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            signature, 
            chainId: activeChainId, 
            payload: { 
              tradeId: Number(message.tradeId), 
              price: Number(message.price), 
              amount: 1000, 
              seller: address 
            } 
          })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Backend Error: ${errorText.includes('<!DOCTYPE') ? '404 API Not Found' : errorText}`);
        }

        const data = await res.json();
        if (data.success) { 
          setTxHash(data.txHash); 
          setCurrentStep(2); 
        }
      } catch (e: any) { 
          console.error("Error Detail:", e);
          if (e.message.includes("User rejected")) alert("Signature rejected by user.");
          else alert(`System Error: ${e.message}`);
      }
    } else { 
      // If fewer than 4 slots are completed, reset state for the next timeslot
      setIsFloorActive(false); 
      setSelectedTimeslot(""); 
      setLocked({}); 
      setCurrentRound(1); 
    }
  };

  if (!mounted) return null;

  if (!address) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-100">
            <h1 className="text-3xl font-black mb-8 text-slate-800 italic">ENERGY EXCHANGE</h1>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      {currentStep === 1 && (
        <div className="max-w-6xl mx-auto">
          {userRole === "none" ? (
            <div className="py-20 animate-in fade-in zoom-in-95">
              <h1 className="text-4xl font-black text-center mb-12 tracking-tight uppercase italic">Select Your Identity</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><span>↓</span> Buyers (Demand)</h3>
                  <div className="grid gap-3">
                    {['b1', 'b2', 'b3'].map(id => (
                      <button key={id} onClick={() => { setMyEntityId(id); setMyEntityName(ENTITY_NAMES[id]); setUserRole('buyer'); }} className="p-5 border-2 border-slate-100 rounded-2xl font-bold text-left hover:border-blue-500 hover:bg-blue-50 transition-all">{ENTITY_NAMES[id]}</button>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><span>↑</span> Sellers (Supply)</h3>
                  <div className="grid gap-3">
                    {['s1', 's2'].map(id => (
                      <button key={id} onClick={() => { setMyEntityId(id); setMyEntityName(ENTITY_NAMES[id]); setUserRole('seller'); }} className="p-5 border-2 border-slate-100 rounded-2xl font-bold text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all">{ENTITY_NAMES[id]}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : !isFloorActive ? (
            <div className="flex flex-col items-center py-32 animate-in slide-in-from-bottom-8">
              <div className="bg-white p-12 rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg">
                  <h2 className="text-2xl font-black mb-2 italic">CONFIGURE TIMESLOT</h2>
                  <p className="text-sm text-slate-500 mb-8">Operator: <span className="font-bold text-slate-800">{myEntityName}</span></p>
                  <select value={selectedTimeslot} onChange={e => setSelectedTimeslot(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl mb-8 outline-none font-bold">
                    <option value="" disabled>-- Select a timeslot --</option>
                    {TIMESLOTS.map(t => <option key={t} value={t} disabled={historyResults.some(h => h.slot === t)}>{t}</option>)}
                  </select>
                  <div className="flex gap-4">
                    <button onClick={() => setUserRole("none")} className="flex-1 py-4 bg-white border-2 border-slate-200 rounded-xl font-bold">Back</button>
                    <button onClick={() => setIsFloorActive(true)} disabled={!selectedTimeslot} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black disabled:opacity-40">Enter Floor →</button>
                  </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in">
              <header className="flex justify-between items-center mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 italic">NEGOTIATION FLOOR</h2>
                    <p className="text-sm text-slate-500 mt-2 font-medium">{selectedTimeslot} (Slot {historyResults.length + 1}/4)</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <ConnectButton showBalance={false} /> 
                    <button onClick={() => { setIsFloorActive(false); setUserRole("none"); }} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm">Switch Role</button>
                  </div>
              </header>

              <div className="bg-slate-900 p-10 rounded-3xl text-white flex justify-between items-center mb-10 shadow-2xl border border-slate-800">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Current Clearing Price</p>
                  <p className="text-6xl font-black font-mono tracking-tighter">¥{(state?.currentPrice || 100).toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-end gap-4">
                  {!state.isConverged && (
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg">
                       <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                       <span className="text-[10px] font-black text-orange-400 uppercase">Wait for Consensus</span>
                    </div>
                  )}
                  <button 
                    disabled={!state.isConverged} 
                    onClick={handleConfirmSegment} 
                    className={`px-10 py-5 rounded-2xl font-black text-sm tracking-wider transition-all ${
                      state.isConverged 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg scale-105' 
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {historyResults.length === 3 ? 'FINAL SIGN & ANCHOR' : 'CONFIRM & PROCEED'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 text-sm font-black uppercase tracking-widest text-slate-500">Demand Nodes (Buyers)</div>
                    <div className="divide-y divide-slate-50">
                      {['b1', 'b2', 'b3'].map(id => (
                        <div key={id} className={`p-8 flex justify-between items-center ${id === myEntityId ? 'bg-blue-50/30' : ''}`}>
                          <span className="font-bold text-slate-700 text-lg">{ENTITY_NAMES[id]}</span>
                          {id === myEntityId ? (
                             locked[id] ? (<span className="text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-xl text-sm">✓ Committed</span>) : (
                               <div className="flex gap-2">
                                 <input type="number" className="w-24 bg-white border-2 border-slate-200 p-3 rounded-xl font-bold" value={(bInputs as any)[id]} onChange={e=>setBInputs({...bInputs, [id]: e.target.value})}/>
                                 <button onClick={()=>handleSubmit("buyer", id)} className="bg-blue-600 text-white px-5 rounded-xl font-black text-sm">SEND</button>
                               </div>
                             )
                          ) : (
                             <span className="text-slate-400 font-bold">{state?.buyers?.[id] ? `${state.buyers[id]} kWh` : 'Pending...'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                 </div>

                 <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 text-sm font-black uppercase tracking-widest text-slate-500">Supply Nodes (Sellers)</div>
                    <div className="divide-y divide-slate-50">
                      {['s1', 's2'].map(id => (
                        <div key={id} className={`p-8 flex justify-between items-center ${id === myEntityId ? 'bg-emerald-50/30' : ''}`}>
                          <span className="font-bold text-slate-700 text-lg">{ENTITY_NAMES[id]}</span>
                          {id === myEntityId ? (
                             locked[id] ? (<span className="text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-xl text-sm">✓ Committed</span>) : (
                               <div className="flex gap-2">
                                 <input type="number" className="w-24 bg-white border-2 border-slate-200 p-3 rounded-xl font-bold" value={(sInputs as any)[id]} onChange={e=>setSInputs({...sInputs, [id]: e.target.value})}/>
                                 <button onClick={()=>handleSubmit("seller", id)} className="bg-slate-800 text-white px-5 rounded-xl font-black text-sm">SEND</button>
                               </div>
                             )
                          ) : (
                             <span className="text-slate-400 font-bold">{state?.sellers?.[id] ? `${state.sellers[id]} kWh` : 'Pending...'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <FriendMapDashboard 
           basePrice={historyResults} 
           txHash={txHash}
           initialTimeslot={selectedTimeslot}
        />
      )}
    </div>
  );
}
