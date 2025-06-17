'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function HomeSearchForm() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    console.log(`Search query: "${trimmedQuery}", length: ${trimmedQuery.length}`);
    
    if (trimmedQuery.length >= 2) {
      // Allow 2-character searches (e.g., "U2")
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    } else if (trimmedQuery.length === 1) {
      console.log('Search rejected: single character query');
      toast({
        title: "Search term too short",
        description: "Please enter at least 2 characters to search.",
        variant: "destructive"
      });
    } else if (trimmedQuery.length === 0) {
      console.log('Search rejected: empty query');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-16">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search for an artist..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-16 text-lg pl-6 pr-16 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-green-400 focus:ring-green-400"
        />
        <Button
          type="submit"
          size="lg"
          className="absolute right-2 top-2 h-12 px-6 bg-green-500 hover:bg-green-600 text-black font-semibold"
        >
          <Search className="w-5 h-5 mr-2" />
          Search
        </Button>
      </div>
    </form>
  );
}
