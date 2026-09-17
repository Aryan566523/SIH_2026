import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatAmount(amount: string | number, decimals: number = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';

  // For very small crypto amounts (e.g. 0.000045 ETH), dynamic precision prevents showing 0.00
  let maxDecimals = decimals;
  if (Math.abs(num) < 0.0001) {
    maxDecimals = 8;
  } else if (Math.abs(num) < 0.01) {
    maxDecimals = 6;
  } else if (Math.abs(num) < 1) {
    maxDecimals = 4;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(num);
}


export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function getRiskColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'HIGH': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'MEDIUM': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'LOW': return 'text-green-400 bg-green-500/10 border-green-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'INFO': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

export const BLOCKCHAIN_COLORS: Record<string, string> = {
  ETHEREUM: '#627EEA',
  BITCOIN: '#F7931A',
  TRON: '#FF0013',
  POLYGON: '#8247E5',
  BNB_CHAIN: '#F3BA2F',
  SOLANA: '#9945FF',
  ARBITRUM: '#28A0F0',
  OPTIMISM: '#FF0420',
};

export const FRAUD_TYPE_LABELS: Record<string, string> = {
  INVESTMENT_SCAM: 'Investment Scam',
  TASK_FRAUD: 'Task Fraud',
  RANSOMWARE: 'Ransomware',
  PHISHING: 'Phishing',
  SEXTORTION: 'Sextortion',
  DARKNET: 'Darknet Activity',
  IMPERSONATION: 'Impersonation',
  ORGANIZED_FINANCIAL_CRIME: 'Organized Financial Crime',
  OTHER: 'Other',
};
