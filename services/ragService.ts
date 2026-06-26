// ============================================================
// RAG SERVICE - Retrieval-Augmented Generation
// ============================================================

export interface RagDocument {
  id: string;
  content: string;
  metadata: any;
  timestamp: Date;
}

class RagService {
  private documents: RagDocument[] = [];
  private readonly STORAGE_KEY = 'chico_rag_docs';

  constructor() {
    this.loadFromStorage();
  }

  addDocument(content: string, metadata: any = {}) {
    const doc: RagDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      metadata,
      timestamp: new Date()
    };
    this.documents.push(doc);
    this.saveToStorage();
    return doc;
  }

  search(query: string, limit: number = 5): RagDocument[] {
    if (!query) return [];
    
    // Simple keyword-based search for now
    const keywords = query.toLowerCase().split(/\s+/);
    return this.documents
      .filter(doc => {
        const content = doc.content.toLowerCase();
        return keywords.some(k => content.includes(k));
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  buildContext(query: string): string {
    const docs = this.search(query);
    if (docs.length === 0) return '';
    
    return "Contexto relevante encontrado:\n" + 
      docs.map(d => `--- Documento (${d.timestamp.toLocaleDateString()}): ${d.content}`).join('\n');
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.documents.slice(-100)));
    } catch {}
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.documents = parsed.map((d: any) => ({
          ...d,
          timestamp: new Date(d.timestamp)
        }));
      }
    } catch {}
  }
}

export const ragService = new RagService();
