import { Injectable, Logger } from '@nestjs/common';

/**
 * Dynamically classifies blockchain addresses by calling the FREE Etherscan API.
 *
 * Classification strategy (no hardcoded addresses):
 * 1. Check if address has bytecode (is a smart contract vs plain wallet)
 * 2. Fetch verified contract source code from Etherscan
 * 3. Inspect the contract name + ABI function names to classify the type
 * 4. In-memory LRU cache so each address is only looked up once per session
 */
@Injectable()
export class AddressClassifierService {
  private readonly logger = new Logger(AddressClassifierService.name);

  // Simple in-memory cache: address → result. Prevents hammering the API.
  private readonly cache = new Map<string, { type: string; label: string }>();

  // Etherscan free API key (5 req/sec, no monthly limit for basic calls)
  private readonly etherscanKey =
    process.env.ETHERSCAN_API_KEY || 'FZRYRUQ3CS59SREXG3G6F9HCY5DNWMYZPY';

  /**
   * Classify an Ethereum address. Returns { type, label } where type is one of:
   * 'suspect' | 'exchange' | 'vasp' | 'mixer' | 'bridge' | 'dex' | 'miner' | 'high_risk' | 'wallet'
   */
  async classify(
    address: string,
    riskScore?: number,
  ): Promise<{ type: string; label: string }> {
    if (!address) return { type: 'wallet', label: 'Unknown' };

    const lower = address.toLowerCase();

    // Serve from cache if available
    if (this.cache.has(lower)) return this.cache.get(lower)!;

    try {
      // Step 1: Check if it is a contract (has bytecode) or a plain EOA wallet
      const isContract = await this.isSmartContract(address);

      if (!isContract) {
        // Plain EOA wallet — use risk score to determine if HIGH RISK
        const type = riskScore && riskScore > 75 ? 'high_risk' : 'wallet';
        const label =
          riskScore && riskScore > 75
            ? `High-Risk Wallet (Score: ${riskScore})`
            : `${address.slice(0, 6)}...${address.slice(-4)}`;
        const result = { type, label };
        this.cache.set(lower, result);
        return result;
      }

      // Step 2: Fetch verified contract source from Etherscan (FREE endpoint)
      const result = await this.classifyByContractSource(address);
      this.cache.set(lower, result);
      return result;
    } catch (err: any) {
      this.logger.debug(`Classifier fallback for ${address}: ${err.message}`);
      // On any network error, fall back to wallet
      const fallback = { type: 'wallet', label: `${address.slice(0, 6)}...${address.slice(-4)}` };
      this.cache.set(lower, fallback);
      return fallback;
    }
  }

  /**
   * Uses eth_getCode to check whether the address has deployed bytecode.
   * If it has code, it is a smart contract. If not, it is a plain EOA wallet.
   */
  private async isSmartContract(address: string): Promise<boolean> {
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getCode&address=${address}&tag=latest&apikey=${this.etherscanKey}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await resp.json() as any;
      // eth_getCode returns '0x' for EOA, '0x...' (with bytes) for contracts
      return typeof data.result === 'string' && data.result.startsWith('0x') && data.result.length > 2;
    } catch {
      return false;
    }
  }

  /**
   * Calls Etherscan's free contract source endpoint.
   * Analyses the contract name and ABI function names to classify the type.
   */
  private async classifyByContractSource(
    address: string,
  ): Promise<{ type: string; label: string }> {
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${this.etherscanKey}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await resp.json() as any;

      if (data.status !== '1' || !data.result || !data.result[0]) {
        // Unverified contract — source code not published to Etherscan.
        // This is common for proxies, internal contracts, etc. NOT necessarily criminal.
        // Return 'contract' type (cyan) so the graph shows it differently from wallets.
        return {
          type: 'contract',
          label: `Contract ${address.slice(0, 6)}...${address.slice(-4)}`,
        };
      }

      let source = data.result[0];

      // If this is an upgradeable proxy (e.g. Lido, USDC, Stargate, Bridges), resolve the real implementation!
      if (source.Proxy === '1' && source.Implementation && source.Implementation.toLowerCase() !== address.toLowerCase()) {
        try {
          const implUrl = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${source.Implementation}&apikey=${this.etherscanKey}`;
          const implResp = await fetch(implUrl, { signal: AbortSignal.timeout(4000) });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const implData = await implResp.json() as any;
          if (implData.status === '1' && implData.result?.[0]?.ContractName) {
            source = implData.result[0];
          }
        } catch {
          // fallback to proxy source if implementation lookup fails
        }
      }

      const contractName: string = (source.ContractName || '').toLowerCase();
      const abiRaw: string = source.ABI || '[]';

      // Parse ABI to extract all function names
      let functionNames: string[] = [];
      try {
        const abi = JSON.parse(abiRaw);
        functionNames = abi
          .filter((item: any) => item.type === 'function')
          .map((item: any) => (item.name || '').toLowerCase());
      } catch {
        functionNames = [];
      }

      // Join name + functions for keyword scanning
      const searchSpace = [contractName, ...functionNames].join(' ');

      // ── Score-based classification to prevent false matches ──────────────
      // We score each category. The category with the highest score wins.
      // This prevents deposit/withdraw from incorrectly tagging Lido as a mixer.

      const scores: Record<string, number> = {
        mixer: 0, dex: 0, bridge: 0, infra: 0, exchange: 0, vasp: 0,
      };

      // MIXER — MUST have zk/privacy specific terms, not just deposit/withdraw
      if (this.hasAny(searchSpace, ['nullifier', 'commitment', 'merkle', 'zkproof', 'snark', 'anonymiz', 'tornado', 'mixer', 'privacy'])) scores.mixer += 10;
      if (this.hasAny(functionNames.join(' '), ['deposit', 'withdraw']) && scores.mixer > 0) scores.mixer += 3;

      // DEX — swap functions are very specific to DEXes
      if (this.hasAny(searchSpace, ['swap', 'exactinput', 'exactoutput', 'exactinputsingle', 'exactoutputsingle'])) scores.dex += 10;
      if (this.hasAny(searchSpace, ['addliquidity', 'removeliquidity', 'getamountout', 'getamountin', 'getreserves'])) scores.dex += 5;
      if (this.hasAny(searchSpace, ['pair', 'pool', 'token0', 'token1', 'router', 'factory'])) scores.dex += 3;
      if (this.hasAny(contractName, ['uniswap', 'sushi', 'curve', 'balancer', '1inch', 'dex', 'swap', 'pancake'])) scores.dex += 8;

      // BRIDGE — cross-chain relay is very specific
      if (this.hasAny(searchSpace, ['bridge', 'crosschain', 'cross_chain', 'sendtokens', 'relayerreward', 'attestation', 'wormhole', 'layerzero', 'stargate', 'teleport', 'portal', 'origingate', 'sendmessage', 'receivemessage'])) scores.bridge += 10;
      if (this.hasAny(contractName, ['bridge', 'relay', 'wormhole', 'stargate', 'layerzero', 'portal', 'teleport', 'thorchain', 'hop', 'celer', 'synapse', 'across', 'omni'])) scores.bridge += 8;

      // INFRA (Miner/Validator/Staking) — staking-specific terms
      if (this.hasAny(searchSpace, ['validator', 'slash', 'epoch', 'attestation', 'beacon', 'steth', 'wsteth', 'reth', 'cbeth', 'frxeth'])) scores.infra += 10;
      if (this.hasAny(searchSpace, ['stake', 'unstake', 'delegate', 'undelegate', 'claimreward', 'getstake'])) scores.infra += 5;
      if (this.hasAny(contractName, ['lido', 'rocketpool', 'frax', 'stakefish', 'staked', 'validator', 'beacon', 'etherfi', 'mevboost', 'ankr', 'eigenlayer'])) scores.infra += 8;
      if (this.hasAny(functionNames.join(' '), ['deposit', 'withdraw']) && scores.infra > 0) scores.infra += 2;

      // EXCHANGE — centralized exchange specific
      if (this.hasAny(contractName, ['exchange', 'binance', 'coinbase', 'kraken', 'okx', 'bybit', 'kucoin', 'huobi', 'gemini', 'bitfinex', 'bitstamp', 'mexc', 'gateio'])) scores.exchange += 12;
      if (this.hasAny(searchSpace, ['orderbook', 'custody', 'fiat', 'clearing', 'settlement', 'custodian'])) scores.exchange += 6;

      // VASP — custodial services, payment processors, regulated crypto asset providers
      if (this.hasAny(contractName, ['vasp', 'custodial', 'fireblocks', 'bitgo', 'circle', 'tether', 'anchorage', 'paxos', 'checkout', 'moonpay', 'ramp', 'transak'])) scores.vasp += 12;
      if (this.hasAny(searchSpace, ['kyc', 'aml', 'merchant', 'compliance', 'travelrule', 'whitelist'])) scores.vasp += 6;

      // Find winner
      const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

      if (winner[1] >= 5) {
        const typeLabels: Record<string, string> = {
          mixer: 'Mixer',
          dex: 'DEX',
          bridge: 'Bridge',
          infra: 'Staking / Validator',
          exchange: 'Exchange',
          vasp: 'VASP',
        };
        return {
          type: winner[0] as any,
          label: `${this.toTitle(source.ContractName)} (${typeLabels[winner[0]]})`,
        };
      }

      // Verified contract but no strong category match — token, multisig, NFT, etc.
      return {
        type: 'contract',
        label: `${this.toTitle(source.ContractName)}`,
      };

    } catch (err: any) {
      this.logger.debug(`classifyByContractSource failed: ${err.message}`);
      return {
        type: 'contract',
        label: `Contract ${address.slice(0, 6)}...${address.slice(-4)}`,
      };
    }
  }

  /** Check if any keyword is present in the search space string */
  private hasAny(haystack: string, keywords: string[]): boolean {
    return keywords.some((kw) => haystack.includes(kw));
  }

  /** Convert snake_case/camelCase contract name to Title Case */
  private toTitle(name: string): string {
    if (!name) return 'Contract';
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Clear the in-memory cache (e.g., for tests) */
  clearCache(): void {
    this.cache.clear();
  }
}
