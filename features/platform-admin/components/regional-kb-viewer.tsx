'use client';
import { useState, useEffect } from 'react';
import { Globe, Search, MapPin } from 'lucide-react';
import { Button, Input, Card, Empty } from '@/components/ui';
import {
  getAllRegionsAction,
  getRegionStatsAction,
  searchRegionalKbAction,
  searchUniversalKbAction,
} from '../actions';

interface RegionOption {
  id: string;
  region_name: string;
  jurisdiction: string;
  building_count: number;
  document_count: number;
}

interface RegionStats {
  region_name: string;
  jurisdiction: string;
  building_count: number;
  document_count: number;
  chunk_count: number;
  legal_chunk_count: number;
  last_updated: string | null;
}

interface SearchResult {
  chunk_id: string;
  document_id: string | null;
  document_title: string;
  region_name?: string;
  building_name: string;
  content: string;
  chunk_type: string;
  relevance_score: number;
}

export function RegionalKbViewer() {
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedRegionStats, setSelectedRegionStats] = useState<RegionStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMode, setSearchMode] = useState<'regional' | 'universal'>('regional');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Load regions on mount
  useEffect(() => {
    (async () => {
      const result = await getAllRegionsAction();
      if (result.ok) {
        setRegions(result.regions);
        if (result.regions.length > 0) {
          setSelectedRegionId(result.regions[0].id);
          loadRegionStats(result.regions[0].id);
        }
      }
    })();
  }, []);

  const loadRegionStats = async (regionId: string) => {
    const result = await getRegionStatsAction({ regionId });
    if (result.ok) {
      setSelectedRegionStats(result.stats);
    }
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    setSearchResults([]);
    loadRegionStats(regionId);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setError('');
    setBusy(true);

    try {
      const result =
        searchMode === 'regional' && selectedRegionId
          ? await searchRegionalKbAction({
              regionId: selectedRegionId,
              query: searchQuery,
              limit: 20,
            })
          : await searchUniversalKbAction({
              query: searchQuery,
              limit: 20,
            });

      if (result.ok) {
        setSearchResults(result.results);
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="regional-kb-viewer">
      <div className="kb-header">
        <h2>
          <Globe size={20} />
          Regional Knowledge Bases
        </h2>
        <p>Search building documents and legal corpus by region.</p>
      </div>

      {/* Region Selector */}
      <Card className="region-selector">
        <label>Select Region</label>
        <select
          value={selectedRegionId || ''}
          onChange={(e) => handleRegionChange(e.target.value)}
        >
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.region_name} ({r.jurisdiction}) · {r.building_count} buildings
            </option>
          ))}
        </select>

        {selectedRegionStats && (
          <div className="region-stats grid" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
            <div className="stat-card">
              <dt>Buildings</dt>
              <dd>{selectedRegionStats.building_count}</dd>
            </div>
            <div className="stat-card">
              <dt>Documents</dt>
              <dd>{selectedRegionStats.document_count}</dd>
            </div>
            <div className="stat-card">
              <dt>Passages</dt>
              <dd>{selectedRegionStats.chunk_count + selectedRegionStats.legal_chunk_count}</dd>
            </div>
            <div className="stat-card">
              <dt>Updated</dt>
              <dd>{selectedRegionStats.last_updated ? new Date(selectedRegionStats.last_updated).toLocaleDateString() : 'N/A'}</dd>
            </div>
          </div>
        )}
      </Card>

      {/* Search Box */}
      <Card className="search-controls">
        <div className="search-input-group">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search regional knowledge base..."
            prefix={<Search size={16} />}
          />
          <Button onClick={handleSearch} busy={busy}>
            Search
          </Button>
        </div>

        <div className="search-mode">
          <label>
            <input
              type="radio"
              checked={searchMode === 'regional'}
              onChange={() => setSearchMode('regional')}
            />
            Regional (this region only)
          </label>
          <label>
            <input
              type="radio"
              checked={searchMode === 'universal'}
              onChange={() => setSearchMode('universal')}
            />
            Universal (all regions)
          </label>
        </div>
      </Card>

      {error && <p className="form-error">{error}</p>}

      {/* Search Results */}
      <div className="search-results">
        {searchResults.length === 0 && searchQuery ? (
          <Empty
            icon={<Search />}
            title="No results"
            description="Try a different search term."
          />
        ) : (
          searchResults.map((result, i) => (
            <Card key={i} className="result-card">
              <div className="result-header">
                <h4>{result.document_title}</h4>
                <span className="chunk-type">{result.chunk_type}</span>
              </div>
              <div className="result-meta">
                <span>
                  <MapPin size={14} />
                  {result.region_name || result.building_name}
                </span>
                <span className="relevance">Match: {(result.relevance_score * 100).toFixed(0)}%</span>
              </div>
              <p className="result-content">{result.content.substring(0, 200)}...</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
