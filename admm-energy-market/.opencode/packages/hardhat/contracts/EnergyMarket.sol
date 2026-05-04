// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title LibElectricityOrder
 * @dev 借鉴 0x 协议的订单结构，支持高并发和过期作废
 */
library LibElectricityOrder {
    struct Order {
        address maker;      // 发起人（买家或卖家）
        uint256 volume;     // 电量 (例如：瓦时)
        uint256 price;      // ADMM 撮合出的最终单价
        uint256 timeslot;   // 交易时间段 (Unix时间戳)
        uint256 salt;       // 随机盐值，支持同一用户并发挂单
        uint256 expiry;     // 订单过期时间，防止历史签名被盗用
    }

    // EIP-712 TypeHash
    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,uint256 volume,uint256 price,uint256 timeslot,uint256 salt,uint256 expiry)"
    );

    function getStructHash(Order memory order) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.maker,
                order.volume,
                order.price,
                order.timeslot,
                order.salt,
                order.expiry
            )
        );
    }
}

/**
 * @title EnergyMarket
 * @dev 核心结算与验签合约
 */
contract EnergyMarket is EIP712 {
    using ECDSA for bytes32;

    // 记录已经使用或取消的 salt，彻底杜绝重放攻击 (双花)
    mapping(address => mapping(uint256 => bool)) public cancelledOrFilledSalts;

    // 初始化 EIP-712 的 Domain Separator (名字: EnergyMarket, 版本: 1.0.0)
    constructor() EIP712("EnergyMarket", "1.0.0") {}

    /**
     * @dev 核心验签函数：验证链下 ADMM 协商后的订单签名是否有效
     */
    function validateOrderSignature(
        LibElectricityOrder.Order calldata order,
        bytes calldata signature
    ) public view returns (bool, address) {
        
        // 1. 检查订单是否已过期
        require(block.timestamp <= order.expiry, "EnergyMarket: Order has expired");

        // 2. 检查订单是否已经被执行 (防重放)
        require(!cancelledOrFilledSalts[order.maker][order.salt], "EnergyMarket: Order already filled");

        // 3. 计算 EIP-712 最终摘要 (Digest)
        bytes32 structHash = LibElectricityOrder.getStructHash(order);
        bytes32 digest = _hashTypedDataV4(structHash);

        // 4. 恢复签名者地址
        address signer = ECDSA.recover(digest, signature);
        
        // 返回验证结果和解析出的地址（方便前端调试）
        return (signer == order.maker, signer);
    }

    /**
     * @dev 模拟结算接口 (后续 Sprint 中我们会加入 ERC20 转账和动态电网费逻辑)
     */
    function settleTrade(
        LibElectricityOrder.Order calldata order,
        bytes calldata signature
    ) external {
        (bool isValid, ) = validateOrderSignature(order, signature);
        require(isValid, "EnergyMarket: Invalid signature");

        // 标记该订单已完成，不可再次使用
        cancelledOrFilledSalts[order.maker][order.salt] = true;

        // TODO: 在这里执行资金与能源代币的划转...
    }
}