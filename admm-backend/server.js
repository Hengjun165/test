const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3001;

// ==========================================
// 1. 基础配置
// ==========================================
// 🌟 你的 64位十六进制私钥
const PRIVATE_KEY = "a0b62c4c0e5fb689dacf0cdc70e18dd9b59755131d8b2c6c9142d254bed19741"; 
// 🌟 你的 Alchemy RPC 链接
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/6d3nejK4sXwV-8mhTWu-Y"; 
// 🌟 你的合约地址
const CONTRACT_ADDRESS = "0x67Ef5633426F88405E5c6492aE45A4a68a74be7c";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ["function storeTradeHash(uint256 tradeId, uint256 price, uint256 amount, address seller, bytes calldata signature) external"], wallet);

// ==========================================
// 2. 物理地图坐标 (英国坐标)
// ==========================================
const locations = {
  s1: { lat: 55.0, lon: -3.8, name: 'Northwest Solar Station' },
  s2: { lat: 53.8, lon: -0.5, name: 'Coastal Wind Farm' },
  b1: { lat: 54.5, lon: -3.5, name: 'Large Steel Plant' },
  b2: { lat: 53.2, lon: -2.9, name: 'Bus Charging Station' },
  b3: { lat: 51.5, lon: -0.1, name: 'City Hospital' }
};

app.get('/calculate-final-price', (req, res) => {
  const { stationId, buyerId, admmPrice, load } = req.query;
  const s = locations[stationId] || locations.s1;
  const b = locations[buyerId] || locations.b1;
  
  const distance = (Math.sqrt(Math.pow(s.lat - b.lat, 2) + Math.pow(s.lon - b.lon, 2)) * 111).toFixed(1);
  const loadFactor = 0.7 + (Number(load || 50) - 10) * 0.3 / 90;
  const transmissionFee = (distance * 0.08 * loadFactor).toFixed(2);
  
  res.json({ 
    sellerName: s.name, buyerName: b.name,
    distance, admmPrice, transmissionFee, 
    finalPrice: (Number(admmPrice) + Number(transmissionFee)).toFixed(2),
    sellerPos: [s.lat, s.lon], buyerPos: [b.lat, b.lon]
  });
});

// ==========================================
// 3. ADMM 逻辑
// ==========================================
let admmState = {};
const TIMESLOTS = ["08:00 - 10:00 (Peak Hours)", "10:00 - 12:00 (Peak Hours)", "14:00 - 16:00 (Normal Hours)", "22:00 - 02:00 (Off-peak Hours)"];

TIMESLOTS.forEach(slot => {
    admmState[slot] = { buyers: {}, sellers: {}, currentPrice: 100, round: 1, isConverged: false };
});

app.post('/api/interactive/submit', (req, res) => {
    const { role, id, amount, timeslot } = req.body;
    const s = admmState[timeslot];
    if (s.isConverged) return res.json({ success: true });
    role === 'buyer' ? s.buyers[id] = amount : s.sellers[id] = amount;

    if (Object.keys(s.buyers).length >= 3 && Object.keys(s.sellers).length >= 2) {
        const d = Object.values(s.buyers).reduce((a, b) => a + Number(b), 0);
        const su = Object.values(s.sellers).reduce((a, b) => a + Number(b), 0);
        const gap = d - su;
        if (Math.abs(gap) <= 5) {
            s.isConverged = true;
        } else {
            s.round += 1;
            s.currentPrice = Number((s.currentPrice + gap * 0.5).toFixed(2));
            s.buyers = {}; s.sellers = {};
            s.isConverged = false;
        }
    }
    res.json({ success: true });
});

app.get('/api/interactive/state', (req, res) => res.json(admmState[req.query.timeslot]));
app.post('/api/interactive/reset', (req, res) => {
    admmState[req.body.timeslot] = { buyers: {}, sellers: {}, currentPrice: 100, round: 1, isConverged: false };
    res.json({ success: true });
});

// ==========================================
// 4. 🌟 修复关键：补全签名上链接口
// ==========================================
app.post('/api/verify-and-settle', async (req, res) => {
    const { signature, payload, chainId } = req.body;
    try {
        console.log("📥 Receiving signature for tradeId:", payload.tradeId);
        const domain = { name: "EnergyExchange", version: "1", chainId: chainId || 11155111, verifyingContract: CONTRACT_ADDRESS };
        const types = { Trade: [{ name: "tradeId", type: "uint256" }, { name: "price", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "seller", type: "address" }] };
        const message = { tradeId: payload.tradeId, price: payload.price, amount: payload.amount, seller: payload.seller };

        const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);

        if (recoveredAddress.toLowerCase() === payload.seller.toLowerCase()) {
            console.log("✅ Signer verified. Sending to Sepolia...");
            const tx = await contract.storeTradeHash(payload.tradeId, payload.price, payload.amount, payload.seller, signature);
            await tx.wait(); 
            res.json({ success: true, txHash: tx.hash });
        } else {
            res.status(401).json({ error: "Invalid Signature Source" });
        }
    } catch (e) { 
        console.error("🔥 Server Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.listen(PORT, () => console.log(`🚀 铁律后端已启动并修复接口！`));