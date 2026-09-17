import { Injectable } from '@nestjs/common';

@Injectable()
export class FraudCampaignsService {
  async getCampaigns(isMock: boolean = false) {
    return [
      {
        id: 'fc-001',
        name: 'Task-Based & Investment Fraud Syndicate (Southeast Asia / Cambodia)',
        type: 'Investment Scam / Task Fraud',
        status: 'Active',
        identifiedDate: '2026-01-15T00:00:00.000Z',
        associatedWallets: 48,
        estimatedTotalValue: 12500000,
        riskScore: 98,
        targetDemographic: 'Indian Retail Investors (WhatsApp / Telegram Part-time Job Ads)',
        modusOperandi: 'Lures victims with part-time rating tasks. Profits are shown in rigged dashboards before demanding large recharge deposits in USDT/TRX, subsequently routed through Southeast Asian laundering syndicates.',
        primarySuspect: 'TXn3HVukEbHYyr31yPcYD7ajAVmuEXu1ab',
        sampleWallets: [
          'TXn3HVukEbHYyr31yPcYD7ajAVmuEXu1ab',
          'TFCtxPUgKPLcrf6pwj8zoy6via8MBcRm5D',
          '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0',
        ],
      },
      {
        id: 'fc-002',
        name: 'OFAC Sanctioned Ransomware & Identity Theft Hub (SecondEye / IRGC)',
        type: 'Sanction Evasion & Ransomware',
        status: 'Active',
        identifiedDate: '2026-02-10T00:00:00.000Z',
        associatedWallets: 24,
        estimatedTotalValue: 8400000,
        riskScore: 99,
        targetDemographic: 'Corporate Infrastructure & High Net-Worth Individuals',
        modusOperandi: 'State-sponsored cyber group deploying LockBit variants and purchasing fraudulent KYC credentials. Ransoms collected in BTC/USDT and funneled into unhosted mixing pools.',
        primarySuspect: '1NE2NiGhhbkFPSEyNWwj7hKGhGDedBtSrQ',
        sampleWallets: [
          '1NE2NiGhhbkFPSEyNWwj7hKGhGDedBtSrQ',
          '19D8phBJzh29us1UpZ4m3SvyQQff8Ufg9o',
          '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF',
        ],
      },
      {
        id: 'fc-003',
        name: 'Fake Cryptocurrency Exchange & Liquidity Pool Drainer',
        type: 'Phishing / Fake DEX',
        status: 'Investigating',
        identifiedDate: '2026-03-01T00:00:00.000Z',
        associatedWallets: 36,
        estimatedTotalValue: 4200000,
        riskScore: 91,
        targetDemographic: 'DeFi & Web3 Wallet Users (USDT / TRX Approvals)',
        modusOperandi: 'Victims are directed to counterfeit Uniswap/PancakeSwap landing pages that request unlimited Permit2 / ERC-20 approvals. Assets are swept within 2 blocks via automated relay contracts.',
        primarySuspect: '0x28C6c06298d514Db089934071355E5743bf21d60',
        sampleWallets: [
          '0x28C6c06298d514Db089934071355E5743bf21d60',
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        ],
      },
      {
        id: 'fc-004',
        name: 'Sextortion & Digital Arrest Coercion Ring',
        type: 'Extortion / Blackmail',
        status: 'Active',
        identifiedDate: '2026-04-18T00:00:00.000Z',
        associatedWallets: 19,
        estimatedTotalValue: 1850000,
        riskScore: 95,
        targetDemographic: 'Citizens targeted via fake Police / Enforcement video calls',
        modusOperandi: 'Impersonators posing as CBI / Narcotics Bureau officers initiate Skype video interrogations accusing victims of parcel seizures, forcing emergency bail payments directly to mule unhosted crypto addresses.',
        primarySuspect: 'TERXBDrkqVQ8w4tXGMoBrqh2WwGt8oqREK',
        sampleWallets: [
          'TERXBDrkqVQ8w4tXGMoBrqh2WwGt8oqREK',
          'TN3w4H6rK2ce4vX9ynfQhWkEnnhjoxByZ7',
        ],
      },
    ];
  }
}
