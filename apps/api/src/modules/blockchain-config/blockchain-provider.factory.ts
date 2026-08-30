import { Injectable } from '@nestjs/common';
import { BlockchainConfigService } from './blockchain-config.service';
import { MockBlockchainProvider } from './mock-blockchain.provider';

@Injectable()
export class BlockchainProviderFactory {
  constructor(
    private readonly configService: BlockchainConfigService,
    private readonly mockProvider: MockBlockchainProvider,
  ) {}

  async fetchTransactions(address: string) {
    const trimmedAddress = address.trim();
    const detectResult = await this.configService.autoDetect(trimmedAddress);
    
    // Determine target chain
    let chain = detectResult?.chain || 'ETHEREUM';
    if (!detectResult) {
      if (/^T[a-zA-Z0-9]{33}$/.test(trimmedAddress)) chain = 'TRON';
      else if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/i.test(trimmedAddress)) chain = 'BITCOIN';
    }

    const start = Date.now();

    // 1. BITCOIN LIVE FETCH (Mempool.space / Blockchain.info)
    if (chain === 'BITCOIN' || /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/i.test(trimmedAddress)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        
        // Try mempool.space public API
        const mempoolRes = await fetch(`https://mempool.space/api/address/${trimmedAddress}/txs`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (mempoolRes.ok) {
          const btcTxs = await mempoolRes.json();
          if (Array.isArray(btcTxs) && btcTxs.length > 0) {
            const normalized = this.normalizeBitcoinMempool(btcTxs, trimmedAddress);
            if (normalized.length > 0) {
              return {
                dataSource: 'LIVE (Mempool.space)',
                providerName: 'Mempool.space BTC Engine',
                latencyMs: Date.now() - start,
                transactions: normalized,
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Live Bitcoin fetch failed for ${trimmedAddress}:`, (err as any).message);
      }
    }

    // 2. TRON LIVE FETCH (TronGrid)
    if (chain === 'TRON' || /^T[a-zA-Z0-9]{33}$/.test(trimmedAddress)) {
      try {
        const config = detectResult ? await this.configService.findById(detectResult.configId).catch(() => null) : null;
        const apiKey = config?.apiKey || 'a20c9225-33d8-4bab-a7e5-f01664db040e';
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`https://api.trongrid.io/v1/accounts/${trimmedAddress}/transactions?limit=25`, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const normalizedTxs = this.normalizeLiveResponse(data, 'TronGrid', trimmedAddress);
          if (normalizedTxs.length > 0) {
            return {
              dataSource: 'LIVE (TronGrid)',
              providerName: 'TronGrid Mainnet',
              latencyMs: Date.now() - start,
              transactions: normalizedTxs,
            };
          }
        }
      } catch (err) {
        console.warn(`Live TRON fetch failed for ${trimmedAddress}:`, (err as any).message);
      }
    }

    // 3. ETHEREUM / EVM LIVE FETCH
    if (chain === 'ETHEREUM' || /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      try {
        const config = detectResult ? await this.configService.findById(detectResult.configId).catch(() => null) : null;
        if (config?.apiKey) {
          const url = config.primaryEndpointUrl.replace('{ADDRESS}', trimmedAddress).replace('{API_KEY}', config.apiKey);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const normalizedTxs = this.normalizeLiveResponse(data, 'Etherscan', trimmedAddress);
            if (normalizedTxs.length > 0) {
              return {
                dataSource: 'LIVE (Etherscan)',
                providerName: 'Etherscan Mainnet',
                latencyMs: Date.now() - start,
                transactions: normalizedTxs,
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Live EVM fetch failed for ${trimmedAddress}:`, (err as any).message);
      }
    }

    // Fallback to contextual simulated trace
    return this.mockProvider.getTransactions(chain as any, trimmedAddress);
  }

  private normalizeBitcoinMempool(txs: any[], address: string) {
    const results: any[] = [];
    for (const tx of txs) {
      const isSender = tx.vin?.some((v: any) => v.prevout?.scriptpubkey_address === address);
      const fromAddr = isSender ? address : (tx.vin?.[0]?.prevout?.scriptpubkey_address || 'External BTC Wallet');
      
      // Find counterparties in outputs
      const outCounterparty = tx.vout?.find((o: any) => o.scriptpubkey_address && o.scriptpubkey_address !== address);
      const toAddr = isSender ? (outCounterparty?.scriptpubkey_address || 'BTC Collector / Exchange') : address;
      const sats = outCounterparty?.value || tx.vout?.[0]?.value || 0;
      const btcVal = (sats / 1e8).toString();

      results.push({
        hash: tx.txid,
        timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : Date.now(),
        from: fromAddr,
        to: toAddr,
        value: btcVal,
        tokenSymbol: 'BTC',
      });
    }
    return results;
  }
  
  private normalizeLiveResponse(data: any, providerName: string, address: string) {
    const isTron = providerName.toLowerCase().includes('tron');
    
    if (isTron) {
      // TronGrid format
      const txs = data.data || [];
      return txs.map((tx: any) => {
        const contract = tx.raw_data?.contract?.[0]?.parameter?.value || {};
        const amountSun = contract.amount || 0;
        const trxAmount = (amountSun / 1e6).toString();
        return {
          hash: tx.txID || tx.hash,
          timestamp: tx.block_timestamp || Date.now(),
          from: contract.owner_address || tx.ownerAddress || address,
          to: contract.to_address || tx.toAddress || 'WazirX TRON Deposit',
          value: trxAmount,
          tokenSymbol: 'TRX',
        };
      });
    } else {
      // Etherscan format
      const txs = data.result || [];
      if (!Array.isArray(txs)) return [];
      return txs.map((tx: any) => ({
        hash: tx.hash,
        timestamp: tx.timeStamp ? parseInt(tx.timeStamp) * 1000 : Date.now(),
        from: tx.from,
        to: tx.to,
        value: (parseFloat(tx.value || '0') / 1e18).toString(),
        tokenSymbol: 'ETH',
      }));
    }
  }
}
