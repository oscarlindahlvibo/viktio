
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Recipe } from '@/lib/types';
import { formatPoints } from '@/lib/points';
import { Search, Link2, Clock, Users, Flame, X, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link, useRouter } from '@/lib/navigation';
import { callFunction } from '@/lib/api';

const FILTERS = [
  { key: 'all', label: 'Alla' },
  { key: 'breakfast', label: 'Frukost' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Middag' },
  { key: 'snack', label: 'Mellanmål' },
  { key: 'hogprotein', label: 'Högprotein' },
  { key: 'vegetarisk', label: 'Vegetariskt' },
  { key: 'vegan', label: 'Veganskt' },
  { key: 'snabb', label: 'Snabbt' },
  { key: 'laggpoints', label: 'Låga points' },
  { key: 'familjevanlig', label: 'Familjevänligt' },
];

const SORTS = [
  { key: 'points_asc', label: 'Lägst points' },
  { key: 'protein_desc', label: 'Högst protein' },
  { key: 'time_asc', label: 'Kortast tid' },
  { key: 'name_asc', label: 'A–Ö' },
];

export default function RecipesPage() {
  const { push: navigate } = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('points_asc');
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'url' | 'search'>('search');
  const [searchResults, setSearchResults] = useState<{ name: string; url: string; source: string }[]>([]);
  const [recipeSearching, setRecipeSearching] = useState(false);

  useEffect(() => {
    supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecipes((data as Recipe[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let result = [...recipes];

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (activeFilter !== 'all') {
      result = result.filter((r) => {
        if (['breakfast', 'lunch', 'dinner', 'snack'].includes(activeFilter)) {
          return r.meal_type === activeFilter;
        }
        return r.tags?.includes(activeFilter);
      });
    }

    switch (activeSort) {
      case 'points_asc':
        result.sort((a, b) => (a.total_points / a.servings) - (b.total_points / b.servings));
        break;
      case 'protein_desc':
        result.sort((a, b) => b.protein_per_serving - a.protein_per_serving);
        break;
      case 'time_asc':
        result.sort((a, b) => ((a.prep_time_min || 0) + (a.cook_time_min || 0)) - ((b.prep_time_min || 0) + (b.cook_time_min || 0)));
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
        break;
    }

    return result;
  }, [recipes, query, activeFilter, activeSort]);

  const handleImport = async (url: string) => {
    setImporting(true);
    try {
      const data = await callFunction<{ id: string; name: string }>('import-recipe', { url });
      toast.success('Recept importerat!');
      setShowImport(false);
      setImportUrl('');
      setSearchResults([]);
      navigate(`/app/recept/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte importera recept');
    } finally {
      setImporting(false);
    }
  };

  const handleRecipeSearch = async () => {
    if (!importUrl || importUrl.length < 2) return;
    setRecipeSearching(true);
    setSearchResults([]);
    try {
      const data = await callFunction<{ searchResults?: typeof searchResults }>('import-recipe', { query: importUrl });
      setSearchResults(data.searchResults || []);
      if ((data.searchResults || []).length === 0) {
        toast.info('Inga recept hittades. Prova ett annat sökord.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte söka recept');
    } finally {
      setRecipeSearching(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Recept</h1>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium tap-scale"
        >
          <Link2 className="h-4 w-4" />
          Importera
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök recept"
          className="h-12 rounded-xl pl-10"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all ${
              activeFilter === f.key
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSort(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              activeSort === s.key
                ? 'bg-primary-lighter text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Recipe cards */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Laddar recept...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Inga recept hittades
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((recipe) => {
            const pointsPerServing = recipe.total_points / recipe.servings;
            const totalTime = (recipe.prep_time_min || 0) + (recipe.cook_time_min || 0);
            return (
              <Link
                key={recipe.id}
                href={`/app/recept/${recipe.id}`}
                className="block rounded-2xl bg-card border border-border overflow-hidden tap-scale hover:border-primary/30 transition-all"
              >
                <div className="flex">
                  <div className="flex h-24 w-24 items-center justify-center bg-muted flex-shrink-0">
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-4xl">🍽️</span>
                    )}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{recipe.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {totalTime} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {recipe.servings} port
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        {Math.round(recipe.kcal_per_serving)} kcal
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-full bg-primary-lighter text-primary text-xs font-bold">
                        {formatPoints(pointsPerServing)} points/port
                      </span>
                      {recipe.source_name && recipe.source_name !== 'Viktio' && (
                        <span className="text-xs text-muted-foreground">{recipe.source_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center animate-fade-in">
          <div className="w-full max-w-md bg-background rounded-t-3xl p-5 animate-slide-up pb-28 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Importera recept</h2>
              <button onClick={() => { setShowImport(false); setSearchResults([]); }} className="p-2 rounded-xl hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4 p-1 bg-muted rounded-xl">
              <button
                onClick={() => { setImportMode('search'); setSearchResults([]); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${importMode === 'search' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                Sök recept
              </button>
              <button
                onClick={() => { setImportMode('url'); setSearchResults([]); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${importMode === 'url' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                Klistra in URL
              </button>
            </div>

            {importMode === 'search' ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">Sök efter recept från Köket.se och fler.</p>
                <div className="flex gap-2">
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRecipeSearch()}
                    placeholder="t.ex. flygande jakob"
                    className="flex-1 h-12 rounded-xl"
                  />
                  <Button onClick={handleRecipeSearch} disabled={recipeSearching || importUrl.length < 2} className="h-12 rounded-xl">
                    {recipeSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sök'}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleImport(r.url)}
                        disabled={importing}
                        className="w-full text-left p-3 rounded-xl border border-border hover:bg-primary-lighter/50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.source}</p>
                        </div>
                        {importing ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Klistra in en länk till ett recept från en svensk receptsida.
                </p>
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://www.ica.se/recept/..."
                  className="h-12 rounded-xl mb-3"
                  autoFocus
                />
                <Button
                  onClick={() => handleImport(importUrl)}
                  disabled={importing || !importUrl}
                  className="w-full h-12 rounded-xl"
                >
                  {importing ? 'Importerar...' : 'Importera recept'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
