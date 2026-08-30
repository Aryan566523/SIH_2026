import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private warnedOffline = false;

  // In-memory graph fallback
  private inMemoryNodes = new Map<string, any>();
  private inMemoryEdges: any[] = [];

  constructor(private driver: any) {}

  async onModuleDestroy() {
    try {
      if (this.driver && typeof this.driver.close === 'function') {
        await this.driver.close();
      }
    } catch {
      // ignore
    }
  }

  async runQuery(cypher: string, params: Record<string, any> = {}): Promise<any[]> {
    if (!this.driver || typeof this.driver.session !== 'function') {
      return [];
    }
    let session: any;
    try {
      session = this.driver.session();
      const result = await session.run(cypher, params);
      return result.records.map((record: any) => {
        const obj: any = {};
        record.keys.forEach((key: string) => {
          obj[key] = record.get(key);
        });
        return obj;
      });
    } catch (error: any) {
      if (!this.warnedOffline) {
        this.logger.warn(`Neo4j offline/unreachable (${error.message}). Using built-in graph engine.`);
        this.warnedOffline = true;
      }
      return [];
    } finally {
      if (session) {
        try {
          await session.close();
        } catch {
          // ignore
        }
      }
    }
  }

  async createNode(label: string, properties: Record<string, any>): Promise<void> {
    const id = properties.address || properties.id || `node_${Date.now()}_${Math.random()}`;
    this.inMemoryNodes.set(id, { id, label, properties: { ...properties } });

    const propStr = Object.keys(properties)
      .map((k) => `${k}: $${k}`)
      .join(', ');
    await this.runQuery(`CREATE (n:${label} {${propStr}})`, properties).catch(() => {});
  }

  async createRelationship(
    fromLabel: string, fromKey: string, fromVal: string,
    toLabel: string, toKey: string, toVal: string,
    relType: string, properties: Record<string, any> = {},
  ): Promise<void> {
    this.inMemoryEdges.push({
      id: properties.txHash || `${fromVal}-${toVal}`,
      source: fromVal,
      target: toVal,
      type: relType,
      ...properties,
    });

    const propStr = Object.keys(properties).length
      ? ` {${Object.keys(properties).map((k) => `${k}: $${k}`).join(', ')}}`
      : '';

    await this.runQuery(
      `MATCH (a:${fromLabel} {${fromKey}: $fromVal}), (b:${toLabel} {${toKey}: $toVal})
       CREATE (a)-[:${relType}${propStr}]->(b)`,
      { fromVal, toVal, ...properties },
    ).catch(() => {});
  }

  async getNeighbors(address: string, depth: number = 2): Promise<any[]> {
    const result = await this.runQuery(
      `MATCH (w {address: $address})-[r*1..${depth}]-(neighbor)
       RETURN DISTINCT w, r, neighbor LIMIT 500`,
      { address },
    );
    if (result.length > 0) return result;

    const neighbors: any[] = [];
    for (const edge of this.inMemoryEdges) {
      if (edge.source === address || edge.target === address) {
        neighbors.push({ w: { address }, r: edge, neighbor: { address: edge.source === address ? edge.target : edge.source } });
      }
    }
    return neighbors;
  }

  async getShortestPath(fromAddress: string, toAddress: string): Promise<any> {
    const result = await this.runQuery(
      `MATCH (start {address: $from}), (end {address: $to}),
       path = shortestPath((start)-[*]-(end))
       RETURN path LIMIT 1`,
      { from: fromAddress, to: toAddress },
    );
    return result[0] || null;
  }

  async getNodeByAddress(address: string): Promise<any> {
    const result = await this.runQuery(
      'MATCH (n {address: $address}) RETURN n LIMIT 1',
      { address },
    );
    if (result.length > 0 && result[0]?.n) return result[0].n;
    return this.inMemoryNodes.get(address)?.properties || null;
  }

  async getNodeCount(): Promise<number> {
    const result = await this.runQuery('MATCH (n) RETURN count(n) as count');
    const count = result[0]?.count?.low ?? result[0]?.count;
    if (count !== undefined && count !== null && !isNaN(Number(count))) return Number(count);
    return this.inMemoryNodes.size;
  }

  async getEdgeCount(): Promise<number> {
    const result = await this.runQuery('MATCH ()-[r]->() RETURN count(r) as count');
    const count = result[0]?.count?.low ?? result[0]?.count;
    if (count !== undefined && count !== null && !isNaN(Number(count))) return Number(count);
    return this.inMemoryEdges.length;
  }

  async getCaseGraph(caseId: string): Promise<{ nodes: any[]; edges: any[] }> {
    const nodesResult = await this.runQuery(
      `MATCH (n)-[r]->(m) WHERE n.caseId = $caseId OR m.caseId = $caseId
       RETURN DISTINCT n, m`,
      { caseId },
    );

    const edgesResult = await this.runQuery(
      `MATCH (a)-[r]->(b) WHERE a.caseId = $caseId OR b.caseId = $caseId
       RETURN a, r, b`,
      { caseId },
    );

    if (nodesResult.length > 0 || edgesResult.length > 0) {
      const nodeMap = new Map();
      const edges: any[] = [];

      for (const record of edgesResult) {
        const a = record.a?.properties || record.a;
        const b = record.b?.properties || record.b;
        const r = record.r?.properties || record.r;

        if (a?.address && !nodeMap.has(a.address)) nodeMap.set(a.address, { id: a.address, ...a });
        if (b?.address && !nodeMap.has(b.address)) nodeMap.set(b.address, { id: b.address, ...b });

        edges.push({
          id: r.txHash || `${a?.address}-${b?.address}`,
          source: a?.address,
          target: b?.address,
          ...r,
        });
      }
      return { nodes: Array.from(nodeMap.values()), edges };
    }

    const matchingEdges = this.inMemoryEdges;
    const nodeMap = new Map();
    for (const edge of matchingEdges) {
      if (!nodeMap.has(edge.source)) nodeMap.set(edge.source, { id: edge.source, address: edge.source, label: edge.source.slice(0, 8) });
      if (!nodeMap.has(edge.target)) nodeMap.set(edge.target, { id: edge.target, address: edge.target, label: edge.target.slice(0, 8) });
    }
    return { nodes: Array.from(nodeMap.values()), edges: matchingEdges };
  }
}
