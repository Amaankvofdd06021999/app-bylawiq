export interface FirmKnowledgeResult {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  content: string;
  rank: number;
  kind: 'template' | 'policy' | 'precedent' | 'research' | 'guide';
  title: string;
}

export interface FirmKnowledgeStats {
  documentId: string;
  title: string;
  kind: 'template' | 'policy' | 'precedent' | 'research' | 'guide';
  views: number;
  uses: number;
  lastViewedAt: Date | null;
  lastUsedAt: Date | null;
}

export interface FirmDocument {
  id: string;
  title: string;
  description: string | null;
  kind: 'template' | 'policy' | 'precedent' | 'research' | 'guide';
  createdBy: string;
  createdAt: Date;
  publishedAt: Date | null;
  viewCount: number;
  usedCount: number;
}
