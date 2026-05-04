"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignTypedData } from "wagmi";

/**
 * Entity definitions (3 Demand Nodes, 2 Supply Nodes) 
 */
const ENTITY_NAMES: Record<string, string> = {
  b1: "Large Steel Plant", b2: "Bus Charging Station", b3: "City Hospital",
  s1: "Northwest Solar", s2: "Coastal Wind"
};

/**
 * Pre-defined trading windows for scheduling
 */
const TIMESLOTS = [
  "08:00 - 10:00 (Peak Hours)",
  "10:00 - 12:00 (Peak Hours)",
  "14:00 - 16:00 (Normal Hours)",
  "22:00 - 02:00 (Off-peak Hours)"
];

export default function MultiAgentADMM() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  // Navigation and Identity States
  const [userRole, setUserRole] = useState<"none" | "buyer" | "seller">("none");
  const [myEntityId, setMyEntityId] = useState<string>("");
  const [myEntityName, setMyEntityName] = useState<string>("");
  const [selectedTimeslot, setSelectedTimeslot] = useState<string>("");
  const [isFloorActive, setIsFloorActive] = useState(false);

  // Market Engine States
  const [state, setState] = useState<any>(null);
  const [bInputs, setBInputs] = useState({ b1: "", b2: "", b3: "" });
  const [sInputs, setSInputs] = useState({ s1: "", s2: "" });

  // Tracks which entities have submitted their values and are currently locked
  const [locked, setLocked] = useState<Record<string, boolean>>({});

  // ⚠️ CRITICAL: Ensure this matches your active Ngrok HTTPS URL
  const BACKEND_URL = "http://localhost:3001";

  /**
   * Fetches the current ADMM state from the backend.
   */
  const fetchState = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/interactive/state`, {
        cache: 'no-store',
        headers: { "Bypass-Tunnel-Reminder": "true" }
      });
      if (!res.ok) throw new Error("Server not responding");
      const data = await res.json();
      setState(data);
    } catch (e) {
      console.error("Fetch error. Ensure backend is running.");
    }
  };

  // Auto-refresh the market state every 2 seconds
  useEffect(() => {
    fetchState();
    const timer = setInterval(fetchState, 2000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Selects an entity to control for the current session.
   * Identity restrictions have been removed to allow single-player testing.
   */
  const handleClaimSeat = async (id: string) => {
    if (!address) return;
    setMyEntityId(id);
    setMyEntityName(ENTITY_NAMES[id]);
    setUserRole(id.startsWith('b') ? 'buyer' : 'seller');
  };

  /**
   * Submits the bid/offer for the active entity.
   */
  const handleSubmit = async (role: "buyer" | "seller", id: string) => {
    const val = role === "buyer" ? (bInputs as any)[id] : (sInputs as any)[id];
    if (!val) return alert("Please enter a value");
    
    try {
      await fetch(`${BACKEND_URL}/api/interactive/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Bypass-Tunnel-Reminder": "true" },
        body: JSON.stringify({ 
          role, id, amount: parseFloat(val),
          timeslot: selectedTimeslot 
        }),
      });

      // Mark this specific entity as locked upon successful submission
      setLocked(prev => ({ ...prev, [id]: true }));
      fetchState();
    } catch (error) {
      alert("Submission failed. Check backend console.");
    }
  };

  /**
   * Unlocks the entity to allow editing of previous submissions.
   */
  const handleEdit = (id: string) => {
    setLocked(prev => ({ ...prev, [id]: false }));
  };

  /**
   * Completely resets the backend market state and local UI states.
   */
  const handleReset = async () => {
    if(confirm("Reset entire market?")) {
      await fetch(`${BACKEND_URL}/api/interactive/reset`, { 
        method: "POST", headers: { "Bypass-Tunnel-Reminder": "true" } 
      });
      setIsFloorActive(false);
      setUserRole("none"); // Return to role selection screen
      setMyEntityId("");
      setSelectedTimeslot("");
      setBInputs({ b1: "", b2: "", b3: "" });
      setSInputs({ s1: "", s2: "" });
      setLocked({}); // Clear all locks
      fetchState();
    }
  };

  /**
   * Navigates back to the role selection screen to change the active entity.
   */
  const handleSwitchIdentity = () => {
    setIsFloorActive(false);
    setUserRole("none");
  };

  // Reusable Tailwind CSS button classes
  const primaryBtn = "bg-[#3665f3] hover:bg-[#2b51c2] text-white font-semibold py-3 px-6 rounded text-sm w-full transition-all shadow-sm";
  const secondaryBtn = "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded text-sm w-full transition-all";

  // VIEW 0: Connect Wallet
  if (!address) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center font-sans text-gray-900">
        <div className="bg-white p-12 border border-gray-200 text-center rounded-lg shadow-md">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold mb-4">Identity Verification</h2>
          <p className="text-gray-500 mb-6">Connect your Web3 wallet to enter the marketplace.</p>
          <div className="p-3 bg-blue-50 text-blue-700 rounded text-sm font-bold animate-pulse">Waiting for wallet...</div>
        </div>
      </div>
    );
  }

  // VIEW 1: Claim Role (Role Selection)
  if (userRole === "none") {
    return (
      <div className="min-h-screen bg-[#f7f7f7] p-8 font-sans text-gray-900">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Step 1: Choose Your Role</h1>
          <p className="text-gray-500 mt-2 font-medium">Select any seat to test the market interactions.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Demand Side */}
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-black mb-6 text-gray-400 uppercase tracking-[0.2em] text-[10px]">Buyers (Demand)</h3>
            {['b1', 'b2', 'b3'].map(id => (
              <button key={id} onClick={() => handleClaimSeat(id)}
                className="mb-4 block w-full text-left p-5 border rounded-xl font-bold transition-all bg-white text-gray-900 border-gray-200 hover:border-blue-500 hover:shadow-md">
                {ENTITY_NAMES[id]} 
                {state?.buyers?.[id] !== null && state?.buyers?.[id] !== undefined ? ` (Submitted: ${state.buyers[id]})` : ""}
              </button>
            ))}
          </div>
          {/* Supply Side */}
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-black mb-6 text-gray-400 uppercase tracking-[0.2em] text-[10px]">Sellers (Supply)</h3>
            {['s1', 's2'].map(id => (
              <button key={id} onClick={() => handleClaimSeat(id)}
                className="mb-4 block w-full text-left p-5 border rounded-xl font-bold transition-all bg-white text-gray-900 border-gray-200 hover:border-blue-500 hover:shadow-md">
                {ENTITY_NAMES[id]}
                {state?.sellers?.[id] !== null && state?.sellers?.[id] !== undefined ? ` (Submitted: ${state.sellers[id]})` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: Select Timeslot
  if (!isFloorActive) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center font-sans text-gray-900">
        <div className="bg-white p-10 border border-gray-200 rounded-2xl shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-black mb-1 text-blue-600 tracking-tighter">Step 2: Schedule</h2>
          <p className="text-sm text-gray-400 mb-8 font-bold uppercase tracking-widest">Active ID: {myEntityName}</p>
          
          <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-[0.2em]">Trading Window</label>
          <select value={selectedTimeslot} onChange={e => setSelectedTimeslot(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-xl mb-8 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-gray-900 bg-white font-bold appearance-none cursor-pointer">
            <option value="" className="bg-white text-gray-400">Select Segment...</option>
            {TIMESLOTS.map(t => <option key={t} value={t} className="bg-white text-gray-900">{t}</option>)}
          </select>

          <div className="flex gap-4">
             <button onClick={() => setUserRole("none")} className={secondaryBtn}>Back</button>
             <button onClick={() => setIsFloorActive(true)} disabled={!selectedTimeslot} 
               className={selectedTimeslot ? primaryBtn : "bg-gray-100 text-gray-300 py-3 px-6 rounded text-sm w-full cursor-not-allowed font-bold"}>
               Open Floor
             </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 3: Bidding Floor
  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans text-gray-900">
      <header className="bg-white border-b p-5 flex justify-between items-center shadow-sm">
        <div className="flex gap-5 items-center">
          <span className="font-black text-blue-600 text-xl tracking-tighter italic">EnergyExchange™</span>
          <div className="h-4 w-[1px] bg-gray-200"></div>
          <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{selectedTimeslot}</span>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className="text-[10px] font-black text-gray-300 uppercase leading-none">Acting as</p>
                <p className="font-bold text-gray-900 leading-tight">{myEntityName}</p>
            </div>
            <button onClick={handleSwitchIdentity} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors">Switch Identity</button>
            <button onClick={handleReset} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors">Reset Market</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-6">
        {/* Market Status Card */}
        <div className="bg-white p-10 rounded-2xl border border-gray-200 mb-10 flex flex-col md:row justify-between items-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
          <div>
             <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Market Clearing Price</h2>
             <div className="text-7xl font-black text-gray-900 tracking-tighter">${(state?.currentPrice || 0).toFixed(2)}</div>
          </div>
          <div className="text-center mt-6 md:mt-0 p-5 bg-gray-50 rounded-xl border border-gray-100">
            <div className={`text-xs font-black uppercase tracking-[0.2em] mb-1 ${state?.isConverged ? 'text-green-600' : 'text-blue-600'}`}>
              {state?.isConverged ? '✓ Consensus Reached' : `Protocol Round ${state?.round}`}
            </div>
            <p className="text-[10px] text-gray-400 font-bold">Smart-Grid ADMM Protocol v1.0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Buyers Side Panel */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 p-4 border-b font-black text-[10px] uppercase tracking-widest text-gray-400">Demand Nodes</div>
            {['b1', 'b2', 'b3'].map(id => (
              <div key={id} className={`p-6 border-b flex justify-between items-center transition-colors ${id === myEntityId ? 'bg-blue-50/30' : ''}`}>
                <span className="font-bold text-gray-700">{ENTITY_NAMES[id]}</span>
                
                {/* Logic: Show active inputs/edit options if this is the currently selected entity. Otherwise, show its locked state. */}
                {id === myEntityId ? (
                  locked[id] ? (
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-green-600 italic">✓ {(bInputs as any)[id]} kWh Locked</span>
                      <button onClick={() => handleEdit(id)} className="text-[10px] font-bold text-gray-400 underline hover:text-gray-700">
                        Return / Edit
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <input type="number" 
                        className="w-28 border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:border-blue-500 transition-all" 
                        placeholder="Quantity" 
                        value={(bInputs as any)[id]} 
                        onChange={e => setBInputs({...bInputs, [id]: e.target.value})}/>
                      <button onClick={() => handleSubmit("buyer", id)} className="bg-gray-900 text-white px-5 py-3 rounded-xl text-xs font-black uppercase hover:bg-blue-600 transition-all">Submit</button>
                    </div>
                  )
                ) : (
                  state?.buyers?.[id] !== null && state?.buyers?.[id] !== undefined ? (
                    <span className="text-green-600 font-black text-xs uppercase italic tracking-tighter">✓ Locked ({state.buyers[id]})</span>
                  ) : (
                    <span className="text-xs text-gray-300 font-bold uppercase tracking-widest">Awaiting...</span>
                  )
                )}
              </div>
            ))}
          </div>

          {/* Sellers Side Panel */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 p-4 border-b font-black text-[10px] uppercase tracking-widest text-gray-400">Supply Nodes</div>
            {['s1', 's2'].map(id => (
              <div key={id} className={`p-6 border-b flex justify-between items-center transition-colors ${id === myEntityId ? 'bg-blue-50/30' : ''}`}>
                <span className="font-bold text-gray-700">{ENTITY_NAMES[id]}</span>
                
                {/* Logic: Same conditional rendering as buyers but for sellers */}
                {id === myEntityId ? (
                  locked[id] ? (
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-green-600 italic">✓ {(sInputs as any)[id]} kWh Locked</span>
                      <button onClick={() => handleEdit(id)} className="text-[10px] font-bold text-gray-400 underline hover:text-gray-700">
                        Return / Edit
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <input type="number" 
                        className="w-28 border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:border-blue-500 transition-all" 
                        placeholder="Quantity" 
                        value={(sInputs as any)[id]} 
                        onChange={e => setSInputs({...sInputs, [id]: e.target.value})}/>
                      <button onClick={() => handleSubmit("seller", id)} className="bg-gray-900 text-white px-5 py-3 rounded-xl text-xs font-black uppercase hover:bg-blue-600 transition-all">Submit</button>
                    </div>
                  )
                ) : (
                  state?.sellers?.[id] !== null && state?.sellers?.[id] !== undefined ? (
                    <span className="text-green-600 font-black text-xs uppercase italic tracking-tighter">✓ Locked ({state.sellers[id]})</span>
                  ) : (
                    <span className="text-xs text-gray-300 font-bold uppercase tracking-widest">Awaiting...</span>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}