'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomeSearchForm() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
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
