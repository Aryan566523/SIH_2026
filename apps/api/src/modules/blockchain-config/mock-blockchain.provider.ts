import { Injectable } from '@nestjs/common';
import { BlockchainType } from '@chainsentinel/types';

@Injectable()
export class MockBlockchainProvider {
  
  async getTransactions(chain: BlockchainType, address: string) {
    // Primary Demo Wallet: 0x1234567890abcdef1234567890abcdef12345678
    // Requires: Intermediaries -> Mixer -> DEX swap -> Bridge to TRON -> WazirX hot wallet
    
    // Secondary Demo Wallet: 0xabcdef1234567890abcdef1234567890abcdef12
    // Requires: 25k USDT -> 4 intermediaries -> Rapid forwarding -> Uniswap -> Binance
    
    const now = Date.now();
    const mockTxs = [];
    const _30d = 30 * 24 * 60 * 60 * 1000;
    
    if (address.toLowerCase() === '0x1234567890abcdef1234567890abcdef12345678') {
      // Return specific demo trace 1
      return {
        dataSource: 'MOCK',
        providerName: 'MockProvider',
        latencyMs: 12,
        transactions: this.generateDemoTrace1(now, chain)
      };
    } else if (address.toLowerCase() === '0xabcdef1234567890abcdef1234567890abcdef12') {
      // Return specific demo trace 2
      return {
        dataSource: 'MOCK',
        providerName: 'MockProvider',
        latencyMs: 15,
        transactions: this.generateDemoTrace2(now, chain)
      };
    } else {
      // Generic fallback
      return {
        dataSource: 'MOCK',
        providerName: 'MockProvider',
        latencyMs: 8,
        transactions: this.generateGenericTrace(address, now, chain)
      };
    }
  }
  
  private generateDemoTrace1(now: number, chain: string) {
    const start = now - (5 * 24 * 60 * 60 * 1000); // 5 days ago
    return [
       { hash: '0xabc1', timestamp: start, from: '0x1234567890abcdef1234567890abcdef12345678', to: '0xInt1', value: '50000000000000000000', tokenSymbol: 'ETH' },
       { hash: '0xabc2', timestamp: start + 300000, from: '0xInt1', to: '0xInt2', value: '25000000000000000000', tokenSymbol: 'ETH' },
       { hash: '0xabc3', timestamp: start + 600000, from: '0xInt1', to: '0xInt3', value: '25000000000000000000', tokenSymbol: 'ETH' },
       { hash: '0xabc4', timestamp: start + 900000, from: '0xInt2', to: '0xTornadoCash', value: '25000000000000000000', tokenSymbol: 'ETH' },
       { hash: '0xabc5', timestamp: start + 950000, from: '0xInt3', to: '0xUniswapV3', value: '25000000000000000000', tokenSymbol: 'ETH' },
       { hash: '0xabc6', timestamp: start + 960000, from: '0xUniswapV3', to: '0xThorChainBridge', value: '83750000000', tokenSymbol: 'USDT' },
    ];
  }
  
  private generateDemoTrace2(now: number, chain: string) {
    const start = now - (2 * 24 * 60 * 60 * 1000);
    return [
       { hash: '0xdef1', timestamp: start, from: '0xabcdef1234567890abcdef1234567890abcdef12', to: '0xIntA', value: '25000000000', tokenSymbol: 'USDT' },
       { hash: '0xdef2', timestamp: start + 120000, from: '0xIntA', to: '0xIntB', value: '25000000000', tokenSymbol: 'USDT' },
       { hash: '0xdef3', timestamp: start + 240000, from: '0xIntB', to: '0xIntC', value: '25000000000', tokenSymbol: 'USDT' },
       { hash: '0xdef4', timestamp: start + 360000, from: '0xIntC', to: '0xIntD', value: '25000000000', tokenSymbol: 'USDT' },
       { hash: '0xdef5', timestamp: start + 480000, from: '0xIntD', to: '0xBinanceHotWallet', value: '25000000000', tokenSymbol: 'USDT' },
    ];
  }

  private generateGenericTrace(address: string, now: number, chain: string) {
    const start = now - (1 * 24 * 60 * 60 * 1000);
    const isTron = chain === 'TRON' || address.startsWith('T');
    const isBtc = chain === 'BITCOIN' || address.startsWith('1') || address.startsWith('3') || address.startsWith('bc1');

    if (isTron) {
      return [
        { hash: '0x' + Math.random().toString(16).slice(2, 10), timestamp: start, from: address, to: 'TXN3hVukebhyYR31YPCYd7aJAvmUeXu1ab', value: '15000', tokenSymbol: 'TRX' },
        { hash: '0x' + Math.random().toString(16).slice(2, 10), timestamp: start + 300000, from: 'TXN3hVukebhyYR31YPCYd7aJAvmUeXu1ab', to: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxbyZ7', value: '14850', tokenSymbol: 'TRX' },
      ];
    } else if (isBtc) {
      return [
        { hash: '0x' + Math.random().toString(16).slice(2, 10), timestamp: start, from: address, to: '19D8PHBjZH29uS1uPZ4m3sVyqqfF8UFG9o', value: '1.25', tokenSymbol: 'BTC' },
        { hash: '0x' + Math.random().toString(16).slice(2, 10), timestamp: start + 300000, from: '19D8PHBjZH29uS1uPZ4m3sVyqqfF8UFG9o', to: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', value: '1.24', tokenSymbol: 'BTC' },
      ];
    }

    return [
      { hash: '0x' + Math.random().toString(16).slice(2, 10), timestamp: start, from: address, to: '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', value: '2.500', tokenSymbol: 'ETH' },
      { hash: '0x' + Math.random().toString(16).slice(2, 10), timestamp: start + 300000, from: '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', to: '0x28C6c06298d514Db089934071355E5743bf21d60', value: '2.485', tokenSymbol: 'ETH' },
    ];
  }
}
