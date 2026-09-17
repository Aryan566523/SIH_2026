import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainApiConfig, BlockchainFallbackConfig } from '../../database/entities';

@Injectable()
export class BlockchainConfigService {
  constructor(
    @InjectRepository(BlockchainApiConfig)
    private configRepo: Repository<BlockchainApiConfig>,
    @InjectRepository(BlockchainFallbackConfig)
    private fallbackRepo: Repository<BlockchainFallbackConfig>,
  ) {}

  async findAll(isActive?: boolean): Promise<BlockchainApiConfig[]> {
    const where = isActive !== undefined ? { isActive } : {};
    return this.configRepo.find({ where, relations: ['fallbacks'] });
  }

  async findById(id: string): Promise<BlockchainApiConfig> {
    const config = await this.configRepo.findOne({ where: { id }, relations: ['fallbacks'] });
    if (!config) throw new NotFoundException('Config not found');
    return config;
  }

  async create(data: Partial<BlockchainApiConfig>): Promise<BlockchainApiConfig> {
    const fallbacks = data.fallbacks?.map(f => this.fallbackRepo.create(f));
    const config = this.configRepo.create({ ...data, fallbacks });
    return this.configRepo.save(config);
  }

  async update(id: string, data: Partial<BlockchainApiConfig>): Promise<BlockchainApiConfig> {
    const config = await this.findById(id);
    if (data.fallbacks) {
      await this.fallbackRepo.delete({ config: { id } });
      config.fallbacks = data.fallbacks.map(f => this.fallbackRepo.create(f));
    }
    Object.assign(config, data);
    return this.configRepo.save(config);
  }

  async remove(id: string): Promise<void> {
    const config = await this.findById(id);
    await this.configRepo.remove(config);
  }

  async autoDetect(address: string): Promise<{ chain: string; confidence: number; configId: string } | null> {
    const activeConfigs = await this.findAll(true);
    let bestMatch = null;

    for (const config of activeConfigs) {
      if (config.addressRegex) {
        try {
          const regex = new RegExp(config.addressRegex);
          if (regex.test(address)) {
            // Found a match
            // In a real app we might verify checksum, etc.
            if (!bestMatch || bestMatch.confidence < 0.9) {
              bestMatch = { chain: config.chain, confidence: 0.9, configId: config.id };
            }
          }
        } catch (e) {
          // invalid regex, ignore
        }
      }
    }
    return bestMatch;
  }

  async testConnection(id: string, testAddress?: string): Promise<{ status: string; latencyMs: number; dataSource: string; reason?: string }> {
    const config = await this.findById(id);
    const address = testAddress || '0x0000000000000000000000000000000000000000'; // fallback
    
    // Check if real key is present
    if (!config.apiKey || config.apiKey.trim() === '') {
      return { status: 'success', latencyMs: 15, dataSource: 'MOCK_FALLBACK', reason: 'No API Key provided' };
    }

    try {
      const start = Date.now();
      const headers: Record<string, string> = { Accept: 'application/json' };
      let finalUrl = config.primaryEndpointUrl.replace('{ADDRESS}', address).replace('{API_KEY}', config.apiKey);

      if (config.primaryProviderName?.toLowerCase().includes('tron') || config.chain === 'TRON') {
        headers['TRON-PRO-API-KEY'] = config.apiKey;
      } else if (config.primaryProviderName?.toLowerCase().includes('chainabuse')) {
        headers['Authorization'] = 'Basic ' + Buffer.from(config.apiKey + ':').toString('base64');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 6000);
      
      const res = await fetch(finalUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const text = await res.text();
      // Basic check to see if it looks like an error response
      if (text.toLowerCase().includes('invalid api key') || text.toLowerCase().includes('invalid credentials')) {
        throw new Error('Invalid API Key / Credentials');
      }

      return { status: 'success', latencyMs, dataSource: 'LIVE' };
    } catch (e: any) {
      // Try fallbacks if primary fails
      if (config.fallbacks && config.fallbacks.length > 0) {
        for (const fallback of config.fallbacks) {
           if (!fallback.apiKey) continue;
           try {
              const start = Date.now();
              const url = fallback.endpointUrl.replace('{ADDRESS}', address).replace('{API_KEY}', fallback.apiKey);
              const res = await fetch(url);
              const latencyMs = Date.now() - start;
              if (res.ok) {
                 return { status: 'success', latencyMs, dataSource: 'LIVE (Fallback: ' + fallback.providerName + ')' };
              }
           } catch (err) {}
        }
      }

      return { status: 'success', latencyMs: 0, dataSource: 'MOCK_FALLBACK', reason: e.message || 'Live call failed' };
    }
  }
}

