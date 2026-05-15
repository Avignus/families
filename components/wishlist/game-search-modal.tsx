"use client";

import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/context";

type SearchResult = {
  appId: number;
  name: string;
  headerImage: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (result: SearchResult) => void;
  title?: string;
};

function useDebounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function GameSearchModal({ open, onOpenChange, onSelect, title }: Props) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t.gameSearch.defaultTitle;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    // Manual debounce
    const id = setTimeout(() => search(q), 300);
    return () => clearTimeout(id);
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setQuery("");
    setResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t.gameSearch.placeholder}
              value={query}
              onChange={handleChange}
              autoFocus
            />
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t.gameSearch.noResults}
              </p>
            )}
            {results.map((r) => (
              <button
                key={r.appId}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors text-left"
              >
                <img
                  src={r.headerImage}
                  alt={r.name}
                  className="w-16 h-9 object-cover rounded flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                />
                <span className="text-sm font-medium">{r.name}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
