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
      },
    ];
  }
}
