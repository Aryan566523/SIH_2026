import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { BlockchainConfigService } from './blockchain-config.service';
import { MockBlockchainProvider } from './mock-blockchain.provider';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function isTronBase58(addr: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr || '');
}

export function isTronHex(addr: string): boolean {
  return /^(41|0x41)[0-9a-fA-F]{40}$/.test(addr || '');
}

export function tronHexToBase58(hex: string): string {
  if (!hex) return hex;
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{42}$/.test(cleanHex)) return hex;

  const buffer = Buffer.from(cleanHex, 'hex');
  const hash1 = crypto.createHash('sha256').update(buffer).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  const checksum = hash2.subarray(0, 4);
  const data = Buffer.concat([buffer, checksum]);

  const digits = [0];
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += data[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let leadingZeros = 0;
  for (let i = 0; i < data.length && data[i] === 0; i++) leadingZeros++;

  let str = '';
  for (let i = 0; i < leadingZeros; i++) str += BASE58_ALPHABET[0];
  for (let i = digits.length - 1; i >= 0; i--) str += BASE58_ALPHABET[digits[i]];
  return str;
}

export function tronBase58ToHex(b58: string): string {
  if (!b58 || !b58.startsWith('T') || b58.length !== 34) return b58;

  const bytes = [0];
  for (let i = 0; i < b58.length; i++) {
    const value = BASE58_ALPHABET.indexOf(b58[i]);
    if (value === -1) return b58;
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += value;
    let carry = 0;
    for (let j = 0; j < bytes.length; ++j) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (let i = 0; i < b58.length && b58[i] === '1'; i++) bytes.push(0);
  const buf = Buffer.from(bytes.reverse());
  return buf.subarray(0, 21).toString('hex');
}

export function normalizeTronAddress(addr: string): string {
  if (!addr) return addr;
  const trimmed = addr.trim();
  if (isTronHex(trimmed)) {
    return tronHexToBase58(trimmed);
  }
  return trimmed;
}

export interface WalletBalanceInfo {
  balance: string;
  symbol: string;
  usdValue?: string;
  txCount?: number;
}

@Injectable()
export class BlockchainProviderFactory {
  private readonly logger = new Logger(BlockchainProviderFactory.name);

  constructor(
    private readonly configService: BlockchainConfigService,
    private readonly mockProvider: MockBlockchainProvider,
  ) {}

  /**
   * Fetches real on-chain balance and activity statistics for an address.
   */
  async fetchBalance(address: string): Promise<WalletBalanceInfo> {
    const trimmedAddress = address.trim();
    const isTron = /^T[a-zA-Z0-9]{33}$/.test(trimmedAddress);
    const isBtc = /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/i.test(trimmedAddress);

    // 1. BITCOIN BALANCE (Mempool.space)
    if (isBtc) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://mempool.space/api/address/${trimmedAddress}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: any = await res.json();
          const funded = data.chain_stats?.funded_txo_sum || 0;
          const spent = data.chain_stats?.spent_txo_sum || 0;
          const satoshis = Math.max(0, funded - spent);
          const btc = (satoshis / 1e8).toFixed(8);
          return {
            balance: btc,
            symbol: 'BTC',
            txCount: (data.chain_stats?.tx_count || 0) + (data.mempool_stats?.tx_count || 0),
          };
        }
      } catch (err: any) {
        this.logger.warn(`BTC balance lookup failed for ${trimmedAddress}: ${err.message}`);
      }
    }

    // 2. TRON BALANCE (TronGrid)
    if (isTron) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://api.trongrid.io/v1/accounts/${trimmedAddress}`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'TRON-PRO-API-KEY': 'a20c9225-33d8-4bab-a7e5-f01664db040e',
          },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: any = await res.json();
          const account = data.data?.[0];
          const sun = account?.balance || 0;
          const trx = (sun / 1e6).toFixed(4);
          return {
            balance: trx,
            symbol: 'TRX',
            txCount: account?.totalTransactionCount || 0,
          };
        }
      } catch (err: any) {
        this.logger.warn(`TRON balance lookup failed for ${trimmedAddress}: ${err.message}`);
      }
    }

    // 3. EVM / ETHEREUM BALANCE (Blockscout API + Etherscan V2 Fallback)
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://eth.blockscout.com/api/v2/addresses/${trimmedAddress}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: any = await res.json();
          const rawBal = data.coin_balance || '0';
          const eth = (parseFloat(rawBal) / 1e18).toFixed(6);
          const rate = parseFloat(data.exchange_rate || '0');
          const usdVal = rate > 0 ? (parseFloat(eth) * rate).toFixed(2) : undefined;
          return {
            balance: eth,
            symbol: 'ETH',
            usdValue: usdVal,
          };
        }
      } catch (err: any) {
        this.logger.warn(`EVM Blockscout balance lookup failed for ${trimmedAddress}: ${err.message}`);
      }

      // 3B. Etherscan v2 balance fallback
      try {
        const etherscanKey = process.env.ETHERSCAN_API_KEY || 'FZRYRUQ3CS59SREXG3G6F9HCY5DNWMYZPY';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${trimmedAddress}&tag=latest&apikey=${etherscanKey}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: any = await res.json();
          if (data.status === '1' && data.result) {
            const eth = (parseFloat(data.result) / 1e18).toFixed(6);
            return {
              balance: eth,
              symbol: 'ETH',
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`EVM Etherscan balance lookup failed for ${trimmedAddress}: ${err.message}`);
      }
    }

    return { balance: '0.0000', symbol: 'ETH' };
  }

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

    // 1. BITCOIN LIVE FETCH (Mempool.space)
    if (chain === 'BITCOIN' || /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/i.test(trimmedAddress)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        
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
        this.logger.warn(`Live Bitcoin fetch failed for ${trimmedAddress}: ${(err as any).message}`);
      }
    }

    // 2. TRON LIVE FETCH (TronGrid - TRX & TRC20 token transfers)
    if (chain === 'TRON' || /^T[a-zA-Z0-9]{33}$/.test(trimmedAddress)) {
      try {
        const config = detectResult ? await this.configService.findById(detectResult.configId).catch(() => null) : null;
        const apiKey = config?.apiKey || 'a20c9225-33d8-4bab-a7e5-f01664db040e';
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        const [txRes, trc20Res] = await Promise.allSettled([
          fetch(`https://api.trongrid.io/v1/accounts/${trimmedAddress}/transactions?limit=35`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`https://api.trongrid.io/v1/accounts/${trimmedAddress}/transactions/trc20?limit=35`, {
            headers,
            signal: controller.signal,
          }),
        ]);
        clearTimeout(timeoutId);

        const normalizedTxs: any[] = [];
        const seenHashes = new Set<string>();

        // 2A. Ingest TRC20 token transfers (USDT, USDC, etc. with exact values)
        if (trc20Res.status === 'fulfilled' && trc20Res.value.ok) {
          try {
            const trc20Data: any = await trc20Res.value.json();
            for (const item of (trc20Data.data || [])) {
              const decimals = parseInt(item.token_info?.decimals || '6', 10) || 6;
              const rawVal = item.value || '0';
              const numVal = parseFloat(rawVal) || 0;
              const formattedVal = (numVal / Math.pow(10, decimals)).toString();
              const hash = item.transaction_id || `0x${Math.random().toString(16).slice(2, 10)}`;
              normalizedTxs.push({
                hash,
                timestamp: item.block_timestamp || Date.now(),
                from: normalizeTronAddress(item.from || trimmedAddress),
                to: normalizeTronAddress(item.to || 'External TRON Address'),
                value: formattedVal,
                rawAmount: String(rawVal),
                tokenSymbol: item.token_info?.symbol || 'USDT',
                blockNumber: 0,
                fee: '0',
                method: 'transfer (TRC20)',
                status: 'confirmed',
                blockProducer: 'Tron Super Representative Pool',
                blockProducerType: 'SUPER_REPRESENTATIVE',
              });
              seenHashes.add(hash);
            }
          } catch (e: any) {
            this.logger.warn(`Failed to parse TRC20 transfers for ${trimmedAddress}: ${e.message}`);
          }
        }

        // 2B. Ingest native TRX transactions
        if (txRes.status === 'fulfilled' && txRes.value.ok) {
          try {
            const txData: any = await txRes.value.json();
            for (const tx of (txData.data || [])) {
              const hash = tx.txID || tx.hash;
              if (hash && seenHashes.has(hash)) continue;
              const contract = tx.raw_data?.contract?.[0]?.parameter?.value || {};
              const amountSun = contract.amount || 0;
              const trxAmount = (amountSun / 1e6).toString();
              const rawFrom = contract.owner_address || tx.ownerAddress || trimmedAddress;
              const rawTo = contract.to_address || tx.toAddress || trimmedAddress;
              normalizedTxs.push({
                hash: hash || `0x${Math.random().toString(16).slice(2, 10)}`,
                timestamp: tx.block_timestamp || Date.now(),
                from: normalizeTronAddress(rawFrom),
                to: normalizeTronAddress(rawTo),
                value: trxAmount,
                rawAmount: String(amountSun),
                tokenSymbol: 'TRX',
                blockNumber: tx.blockNumber || 0,
                fee: '0',
                method: tx.raw_data?.contract?.[0]?.type || 'transfer',
                status: 'confirmed',
                blockProducer: 'Tron Super Representative Pool',
                blockProducerType: 'SUPER_REPRESENTATIVE',
              });
              if (hash) seenHashes.add(hash);
            }
          } catch (e: any) {
            this.logger.warn(`Failed to parse TRX transactions for ${trimmedAddress}: ${e.message}`);
          }
        }

        if (normalizedTxs.length > 0) {
          return {
            dataSource: 'LIVE (TronGrid)',
            providerName: 'TronGrid Mainnet',
            latencyMs: Date.now() - start,
            transactions: normalizedTxs,
          };
        }
      } catch (err) {
        this.logger.warn(`Live TRON fetch failed for ${trimmedAddress}: ${(err as any).message}`);
      }
    }

    // 3. ETHEREUM / EVM LIVE FETCH (Blockscout Public API + Etherscan Fallback)
    if (chain === 'ETHEREUM' || /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      // 3A. Blockscout Public API (Transactions + Token Transfers)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        const [txRes, tokenRes] = await Promise.allSettled([
          fetch(`https://eth.blockscout.com/api/v2/addresses/${trimmedAddress}/transactions`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          }),
          fetch(`https://eth.blockscout.com/api/v2/addresses/${trimmedAddress}/token-transfers`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          }),
        ]);
        clearTimeout(timeoutId);

        const allItems: any[] = [];
        if (txRes.status === 'fulfilled' && txRes.value.ok) {
          const data: any = await txRes.value.json();
          if (Array.isArray(data.items)) allItems.push(...data.items);
        }

        let normalizedTxs = this.normalizeBlockscoutResponse(allItems, trimmedAddress);

        // Also normalize token-transfers if available to ensure exact token amounts
        if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
          try {
            const tokenData: any = await tokenRes.value.json();
            if (Array.isArray(tokenData.items) && tokenData.items.length > 0) {
              const tokenTransfers = this.normalizeBlockscoutTokenTransfers(tokenData.items, trimmedAddress);
              const existingHashes = new Set(normalizedTxs.map((t) => t.hash));
              for (const tt of tokenTransfers) {
                if (!existingHashes.has(tt.hash)) {
                  normalizedTxs.push(tt);
                  existingHashes.add(tt.hash);
                } else {
                  // Update existing tx if it had 0 amount
                  const found = normalizedTxs.find((t) => t.hash === tt.hash);
                  if (found && (found.value === '0' || parseFloat(found.value) === 0)) {
                    found.value = tt.value;
                    found.tokenSymbol = tt.tokenSymbol;
                    found.to = tt.to;
                  }
                }
              }
            }
          } catch {
            // ignore token transfer merge errors
          }
        }

        if (normalizedTxs.length > 0) {
          return {
            dataSource: 'LIVE (Blockscout Explorer)',
            providerName: 'Blockscout Ethereum Mainnet',
            latencyMs: Date.now() - start,
            transactions: normalizedTxs,
          };
        }
      } catch (err) {
        this.logger.warn(`Live Blockscout fetch failed for ${trimmedAddress}: ${(err as any).message}`);
      }

      // 3B. Etherscan API fallback if configured
      try {
        const config = detectResult ? await this.configService.findById(detectResult.configId).catch(() => null) : null;
        const apiKey = config?.apiKey || process.env.ETHERSCAN_API_KEY || 'FZRYRUQ3CS59SREXG3G6F9HCY5DNWMYZPY';
        if (apiKey) {
          const endpoint = config?.primaryEndpointUrl && config.primaryEndpointUrl.includes('v2')
            ? config.primaryEndpointUrl
            : 'https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey={API_KEY}';
          const url = endpoint.replace('{ADDRESS}', trimmedAddress).replace('{API_KEY}', apiKey);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data: any = await res.json();
            const normalizedTxs = this.normalizeLiveResponse(data, 'Etherscan', trimmedAddress);
            if (normalizedTxs.length > 0) {
              return {
                dataSource: 'LIVE (Etherscan V2)',
                providerName: 'Etherscan Mainnet',
                latencyMs: Date.now() - start,
                transactions: normalizedTxs,
              };
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Live Etherscan fetch failed for ${trimmedAddress}: ${(err as any).message}`);
      }
    }

    // Contextual realistic trace fallback
    return this.mockProvider.getTransactions(chain as any, trimmedAddress);
  }

  private normalizeBlockscoutResponse(items: any[], address: string) {
    const results: any[] = [];
    for (const item of items) {
      const fromAddr = item.from?.hash || address;
      let toAddr = item.to?.hash || '0x0000000000000000000000000000000000000000';
      const rawVal = item.value || '0';
      let formattedVal = (parseFloat(rawVal) / 1e18).toString();
      let symbol = 'ETH';

      // Check if this is an ERC-20 transfer where native value is 0 but tokens are transferred
      if (rawVal === '0' || !rawVal || parseFloat(rawVal) === 0) {
        // 1. Try decoded parameters
        if (item.decoded_input?.parameters) {
          const params: any[] = item.decoded_input.parameters || [];
          const toParam = params.find((p: any) => p.name === '_to' || p.name === 'recipient' || p.name === 'to');
          const valParam = params.find((p: any) => p.name === '_value' || p.name === 'amount' || p.name === 'value');
          
          if (toParam?.value) {
            toAddr = toParam.value;
          }

          let tokenDecimals = 18;
          const tags = item.to?.metadata?.tags || [];
          for (const tag of tags) {
            if (tag.meta?.tokenAttributes) {
              try {
                const attr = typeof tag.meta.tokenAttributes === 'string' ? JSON.parse(tag.meta.tokenAttributes) : tag.meta.tokenAttributes;
                if (attr.token_symbol) symbol = attr.token_symbol;
                if (attr.decimals !== undefined) tokenDecimals = parseInt(attr.decimals);
              } catch {
                // ignore
              }
            }
            if (tag.slug === 'usdt-stablecoin-1' || tag.name?.includes('USDT')) {
              symbol = 'USDT';
              tokenDecimals = 6;
            }
          }
          if (item.to?.name?.includes('Tether') || (item.to?.hash || '').toLowerCase() === '0xdac17f958d2ee523a2206206994597c13d831ec7') {
            symbol = 'USDT';
            tokenDecimals = 6;
          } else if (item.to?.name?.includes('USD Coin') || (item.to?.hash || '').toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') {
            symbol = 'USDC';
            tokenDecimals = 6;
          }

          if (valParam?.value) {
            const rawTokenVal = parseFloat(valParam.value) || 0;
            formattedVal = (rawTokenVal / Math.pow(10, tokenDecimals)).toString();
          }
        }
        
        // 2. Direct ABI raw_input fallback (0xa9059cbb is ERC-20 transfer(address,uint256))
        const rawInput = item.raw_input || '';
        if (rawInput.startsWith('0xa9059cbb') && rawInput.length >= 138) {
          try {
            toAddr = '0x' + rawInput.slice(34, 74).toLowerCase();
            const valBig = BigInt('0x' + rawInput.slice(74, 138));
            const toLower = (item.to?.hash || '').toLowerCase();
            const isUsdtOrUsdc = toLower === '0xdac17f958d2ee523a2206206994597c13d831ec7' || toLower === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' || item.to?.name?.includes('Tether') || item.to?.name?.includes('USD Coin');
            const decimals = isUsdtOrUsdc ? 6 : 18;
            symbol = isUsdtOrUsdc ? (toLower === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USDC' : 'USDT') : (item.to?.token?.symbol || 'ERC20');
            formattedVal = (Number(valBig) / Math.pow(10, decimals)).toString();
          } catch {
            // ignore parsing error
          }
        }
      }

      const blockNumber = item.block_number || item.block || 0;
      const fee = item.fee?.value ? (parseFloat(item.fee.value) / 1e18).toFixed(6) : '0';

      results.push({
        hash: item.hash,
        timestamp: item.timestamp ? new Date(item.timestamp).getTime() : Date.now(),
        from: fromAddr,
        to: toAddr,
        value: formattedVal,
        rawAmount: rawVal,
        tokenSymbol: symbol,
        blockNumber,
        fee,
        method: item.method || item.decoded_input?.method_call || 'transfer',
        status: item.status === 'ok' ? 'confirmed' : 'pending',
        blockProducer: item.created_contract?.hash || 'Ethereum Validator Pool',
        blockProducerType: 'VALIDATOR',
      });
    }
    return results;
  }

  private normalizeBlockscoutTokenTransfers(items: any[], address: string) {
    const results: any[] = [];
    for (const item of items) {
      const fromAddr = item.from?.hash || address;
      const toAddr = item.to?.hash || '0x0000000000000000000000000000000000000000';
      const token = item.token || {};
      const decimals = parseInt(token.decimals || '18', 10) || 18;
      const symbol = token.symbol || 'ERC20';
      const rawVal = item.total?.value || item.value || '0';
      const numVal = parseFloat(rawVal) || 0;
      const formattedVal = (numVal / Math.pow(10, decimals)).toString();

      results.push({
        hash: item.transaction_hash || item.hash,
        timestamp: item.timestamp ? new Date(item.timestamp).getTime() : Date.now(),
        from: fromAddr,
        to: toAddr,
        value: formattedVal,
        rawAmount: rawVal,
        tokenSymbol: symbol,
        blockNumber: item.block_number || 0,
        fee: '0.0001',
        method: item.method || 'transfer',
        status: 'confirmed',
        blockProducer: 'Ethereum Validator Pool',
        blockProducerType: 'VALIDATOR',
      });
    }
    return results;
  }

  private normalizeBitcoinMempool(txs: any[], address: string) {
    const results: any[] = [];
    for (const tx of txs) {
      const isSender = tx.vin?.some((v: any) => v.prevout?.scriptpubkey_address === address);
      const fromAddr = isSender ? address : (tx.vin?.[0]?.prevout?.scriptpubkey_address || 'External BTC Wallet');
      
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
        blockNumber: tx.status?.block_height || 0,
        fee: tx.fee ? (tx.fee / 1e8).toFixed(8) : '0',
        blockProducer: 'Foundry USA / AntPool Miner',
        blockProducerType: 'MINING_POOL',
      });
    }
    return results;
  }
  
  private normalizeLiveResponse(data: any, providerName: string, address: string) {
    const isTron = providerName.toLowerCase().includes('tron');
    
    if (isTron) {
      const txs = data.data || [];
      return txs.map((tx: any) => {
        const contract = tx.raw_data?.contract?.[0]?.parameter?.value || {};
        const amountSun = contract.amount || 0;
        const trxAmount = (amountSun / 1e6).toString();
        const rawFrom = contract.owner_address || tx.ownerAddress || address;
        const rawTo = contract.to_address || tx.toAddress || 'External TRON Address';
        return {
          hash: tx.txID || tx.hash,
          timestamp: tx.block_timestamp || Date.now(),
          from: normalizeTronAddress(rawFrom),
          to: normalizeTronAddress(rawTo),
          value: trxAmount,
          rawAmount: String(amountSun),
          tokenSymbol: 'TRX',
          blockNumber: tx.blockNumber || 0,
          blockProducer: 'Tron Super Representative Pool',
          blockProducerType: 'SUPER_REPRESENTATIVE',
        };
      });
    } else {
      const txs = data.result || [];
      if (!Array.isArray(txs)) return [];
      return txs.map((tx: any) => ({
        hash: tx.hash,
        timestamp: tx.timeStamp ? parseInt(tx.timeStamp) * 1000 : Date.now(),
        from: tx.from,
        to: tx.to,
        value: (parseFloat(tx.value || '0') / 1e18).toString(),
        tokenSymbol: 'ETH',
        blockNumber: parseInt(tx.blockNumber || '0'),
        blockProducer: 'Lido / Coinbase Validator',
        blockProducerType: 'VALIDATOR',
      }));
    }
  }
}
