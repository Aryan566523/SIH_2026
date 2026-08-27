import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);

  constructor(private driver: any) {}

  async onModuleDestroy() {
    await this.driver.close();
  }

  async runQuery(cypher: string, params: Record<string, any> = {}): Promise<any[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((record: any) => {
        const obj: any = {};
        record.keys.forEach((key: string) => {
          obj[key] = record.get(key);
        });
        return obj;
      });
    } catch (error: any) {
      this.logger.error(`Neo4j query failed: ${error.message}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createNode(label: string, properties: Record<string, any>): Promise<void> {
    const propStr = Object.keys(properties)
      .map((k) => `${k}: $${k}`)
      .join(', ');
    await this.runQuery(`CREATE (n:${label} {${propStr}})`, properties);
  }

  async createRelationship(
    fromLabel: string, fromKey: string, fromVal: string,
    toLabel: string, toKey: string, toVal: string,
    relType: string, properties: Record<string, any> = {},
  ): Promise<void> {
    const propStr = Object.keys(properties).length
      ? ` {${Object.keys(properties).map((k) => `${k}: $${k}`).join(', ')}}`
      : '';

    await this.runQuery(
      `MATCH (a:${fromLabel} {${fromKey}: $fromVal}), (b:${toLabel} {${toKey}: $toVal})
       CREATE (a)-[:${relType}${propStr}]->(b)`,
      { fromVal, toVal, ...properties },
    );
  }

  async getNeighbors(address: string, depth: number = 2): Promise<any[]> {
    const result = await this.runQuery(
      `MATCH (w {address: $address})-[r*1..${depth}]-(neighbor)
       RETURN DISTINCT w, r, neighbor LIMIT 500`,
      { address },
    );
    return result;
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
    return result[0]?.n || null;
  }

  async getNodeCount(): Promise<number> {
    const result = await this.runQuery('MATCH (n) RETURN count(n) as count');
    return result[0]?.count?.low || 0;
  }

  async getEdgeCount(): Promise<number> {
    const result = await this.runQuery('MATCH ()-[r]->() RETURN count(r) as count');
    return result[0]?.count?.low || 0;
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
}
