import React, { useState, useEffect } from 'react';

// 注意：在本地 VS Code 环境中，请确保运行了 `npm install ethers`
// 为了确保在预览环境中正常运行，我们从 window 对象获取 ethers
const ABI = [
  "function getSellers() public view returns (address[] memory, tuple(string name, uint256 x, uint256 y, string role, bool isActive)[] memory)",
  "function nodes(address) public view returns (string name, uint256 x, uint256 y, string role, bool isActive)"
];

const CONTRACT_ADDRESS = "0x9b04CB9524ddBbf9eA0e361858E5d5155ce681c2"; // 👈 填入你在 Remix 部署的地址

export default function App() {
  const [load, setLoad] = useState(55);
  const [sellers, setSellers] = useState([]);
  const [myPos, setMyPos] = useState({ x: 50, y: 50, name: "我的工厂" });
  const [loading, setLoading] = useState(false);
  const [libLoaded, setLibLoaded] = useState(false);

  const BASE_PRICE = 200.00;
  const GRID_FEE_UNIT = 0.5;

  // 动态加载 ethers 库以修复编译错误
  useEffect(() => {
    if (window.ethers) {
      setLibLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js";
    script.async = true;
    script.onload = () => setLibLoaded(true);
    document.head.appendChild(script);
  }, []);

  // 计算负载系数
  const getLoadFactor = (l) => {
    if (l < 35) return 0.75;
    if (l > 85) return 1.65;
    return 1.0;
  };

  // 从链上同步数据
  const syncChainData = async () => {
    if (!window.ethers || !window.ethereum) {
      console.log("正在等待钱包连接或库加载...");
      return;
    }
    setLoading(true);
    try {
      const { ethers } = window;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      
      // 1. 获取所有卖家
      const [addrs, sellerNodes] = await contract.getSellers();
      // 将 Proxy 转换为普通数组以便渲染
      setSellers([...sellerNodes]);

      // 2. 获取当前登录者位置
      const signer = await provider.getSigner();
      const myData = await contract.nodes(await signer.getAddress());
      if (myData.isActive) {
        setMyPos({ x: Number(myData.x), y: Number(myData.y), name: myData.name });
      }
    } catch (err) {
      console.error("同步失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (libLoaded) {
      syncChainData();
    }
  }, [libLoaded]);

  const factor = getLoadFactor(load);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
            模块二：地理感知与负载清算
          </h1>
          <p className="text-slate-400 text-sm">基于物理测距与电网拥堵系数的动态定价</p>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center gap-6 w-full md:w-auto">
          <div className="text-right min-w-[100px]">
            <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">电网负载状态</span>
            <span className={`text-2xl font-mono font-black ${load > 85 ? 'text-red-500' : 'text-blue-400'}`}>
              {load}%
            </span>
          </div>
          <input 
            type="range" min="10" max="100" value={load} 
            onChange={(e) => setLoad(Number(e.target.value))}
            className="flex-1 md:w-32 accent-blue-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧：雷达可视化 */}
        <div className="lg:col-span-8 bg-slate-800/50 rounded-3xl border border-white/5 relative h-[500px] lg:h-[650px] overflow-hidden shadow-inner flex items-center justify-center">
          {/* 雷达网格 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            {[100, 200, 300, 400, 500, 600].map(size => (
              <div key={size} className="absolute border border-blue-400 rounded-full" style={{width: size, height: size}} />
            ))}
            <div className="absolute w-full h-[1px] bg-blue-400" />
            <div className="absolute h-full w-[1px] bg-blue-400" />
          </div>

          {/* 渲染买家节点 */}
          <div 
            className="absolute w-5 h-5 bg-red-500 rounded-full shadow-[0_0_25px_rgba(239,68,68,0.9)] transition-all duration-700 ease-in-out z-20"
            style={{ left: `${myPos.x}%`, top: `${myPos.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-black/80 px-2 py-1 rounded-md border border-red-500/30 font-bold">
              📍 我 ({myPos.name})
            </div>
          </div>

          {/* 渲染卖家节点 */}
          {sellers.map((s, i) => (
            <div 
              key={i}
              className="absolute w-4 h-4 bg-green-400 rounded-full shadow-[0_0_20px_rgba(74,222,128,0.7)] transition-all duration-500 z-10"
              style={{ left: `${Number(s.x)}%`, top: `${Number(s.y)}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-300 bg-slate-900/60 px-2 py-1 rounded">
                ⚡ {s.name}
              </div>
            </div>
          ))}

          {/* 扫描线动画 */}
          <div className="absolute w-full h-full pointer-events-none origin-center animate-[spin_4s_linear_infinite]" 
               style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(59, 130, 246, 0.1) 90deg, transparent 90deg)' }}>
          </div>
        </div>

        {/* 右侧：清算货架 */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto max-h-[650px] pr-2 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="flex justify-between items-center sticky top-0 bg-slate-900 py-2 z-30">
            <h2 className="text-xl font-bold flex items-center gap-2">🛒 绿电交易清单</h2>
            <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full font-bold">
              {sellers.length} 个可用节点
            </span>
          </div>
          
          {loading && <div className="text-blue-400 animate-pulse text-center py-10">📡 正在同步链上状态...</div>}
          {!loading && sellers.length === 0 && (
            <div className="bg-slate-800/40 border border-dashed border-slate-700 p-10 rounded-3xl text-center">
              <p className="text-slate-500 text-sm">未检测到链上卖家节点</p>
              <p className="text-[10px] text-slate-600 mt-2">请确认合约地址并在 Sepolia 登记数据</p>
            </div>
          )}

          {sellers.map((s, i) => {
            const dist = Math.sqrt(Math.pow(Number(s.x) - myPos.x, 2) + Math.pow(Number(s.y) - myPos.y, 2)).toFixed(1);
            const gridFee = (dist * GRID_FEE_UNIT * factor).toFixed(2);
            const total = (BASE_PRICE + parseFloat(gridFee)).toFixed(2);

            return (
              <div key={i} className="bg-slate-800 p-6 rounded-2xl border border-white/5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group relative overflow-hidden">
                {/* 装饰性背景 */}
                <div className="absolute top-0 right-0 p-8 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                
                <div className="flex justify-between items-start mb-4 relative">
                  <span className="font-bold text-lg group-hover:text-blue-400 transition-colors">{s.name}</span>
                  <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md border border-blue-400/20">{dist} km</span>
                </div>
                
                <div className="space-y-3 text-sm text-slate-400 mb-6 pb-4 border-b border-white/5 relative">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2">博弈均衡价 <i className="text-[10px] text-slate-600">(M1)</i></span>
                    <span className="text-white font-mono">¥{BASE_PRICE.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">动态过网费 <i className="text-[10px] text-slate-600">(M2)</i></span>
                    <div className="text-right">
                      <span className={`font-mono font-bold ${factor > 1 ? 'text-red-400' : 'text-green-400'}`}>+ ¥{gridFee}</span>
                      <p className="text-[9px] text-slate-600 font-mono">系数: {factor.toFixed(2)}x</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-baseline relative">
                  <span className="text-xs font-black text-green-500 uppercase tracking-widest">最终结算价</span>
                  <div className="text-2xl font-black font-mono tracking-tighter">
                    ¥{total} <small className="text-[10px] text-slate-500">/MWh</small>
                  </div>
                </div>

                <button 
                  onClick={() => console.log(`已向 ${s.name} 发送结算请求`)}
                  className="w-full mt-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] relative"
                >
                  签署结算指令
                </button>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 uppercase tracking-widest">
         <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 实时清算引擎 v2.5</span>
            <span>|</span>
            <span>合约: <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-400">{CONTRACT_ADDRESS.substring(0,12)}...</code></span>
         </div>
         <div className="flex items-center gap-4">
           {!window.ethereum && <span className="text-red-500">⚠ 未检测到钱包</span>}
           <button onClick={syncChainData} className="hover:text-blue-400 flex items-center gap-1 transition-colors">
             <i className="fa-solid fa-rotate"></i> 强制刷新链上状态
           </button>
         </div>
      </div>
    </div>
  );
}