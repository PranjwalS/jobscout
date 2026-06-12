/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { WizardFormState } from "../../types/dashboard";
import { X, ChevronRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type LocationVote = "include" | "neutral" | "exclude";

interface Country {
  name: string;
  cities: string[];
}

interface Props {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void;
}

export default function Step4Locations({ form, update }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [locationVotes, setLocationVotes] = useState<Record<string, LocationVote>>({});
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyResults, setCompanyResults] = useState<{ name: string }[]>([]);
  const [companyVotes, setCompanyVotes] = useState<Record<string, LocationVote>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/meta/locations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        // Expect: [{name: "Canada", cities: ["Toronto", ...]}, ...]
        if (Array.isArray(data)) setCountries(data);
      })
      .catch(() => setCountries([]))
      .finally(() => setLoading(false));
  }, []);

  // Company search debounce
  useEffect(() => {
    if (companySearch.length < 2) { setCompanyResults([]); return; }
    const token = localStorage.getItem("token");
    const t = setTimeout(() => {
      fetch(`${API}/meta/companies?search=${encodeURIComponent(companySearch)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then(setCompanyResults)
        .catch(() => setCompanyResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [companySearch]);

  const setLocVote = (loc: string, vote: LocationVote) => {
    const prev = locationVotes[loc] ?? "neutral";
    const newVote = prev === vote ? "neutral" : vote;
    setLocationVotes((v) => ({ ...v, [loc]: newVote }));
    syncLocationToForm({ ...locationVotes, [loc]: newVote });
  };

  const syncLocationToForm = (votes: Record<string, LocationVote>) => {
    const includes = Object.entries(votes).filter(([, v]) => v === "include").map(([k]) => k);
    const excludes = Object.entries(votes).filter(([, v]) => v === "exclude").map(([k]) => k);
    update("include_locations", includes);
    update("exclude_locations", excludes);
  };

  const setCompVote = (company: string, vote: LocationVote) => {
    const prev = companyVotes[company] ?? "neutral";
    const newVote = prev === vote ? "neutral" : vote;
    setCompanyVotes((v) => ({ ...v, [company]: newVote }));
    syncCompanyToForm({ ...companyVotes, [company]: newVote });
  };

  const syncCompanyToForm = (votes: Record<string, LocationVote>) => {
    const includes = Object.entries(votes).filter(([, v]) => v === "include").map(([k]) => k);
    const excludes = Object.entries(votes).filter(([, v]) => v === "exclude").map(([k]) => k);
    update("include_companies", includes);
    update("exclude_companies", excludes);
  };

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const selectedCountryData = countries.find((c) => c.name === selectedCountry);
  const filteredCities = (selectedCountryData?.cities ?? []).filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const allVotedLocations = Object.entries(locationVotes).filter(([, v]) => v !== "neutral");
  const allVotedCompanies = Object.entries(companyVotes).filter(([, v]) => v !== "neutral");

  const VoteButtons = ({
    item,
    votes,
    onVote,
  }: {
    item: string;
    votes: Record<string, LocationVote>;
    onVote: (item: string, vote: LocationVote) => void;
  }) => {
    const vote = votes[item] ?? "neutral";
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onVote(item, "include")}
          className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${
            vote === "include" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-emerald-100 hover:text-emerald-700"
          }`}
        >+</button>
        <button
          onClick={() => onVote(item, "neutral")}
          className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${
            vote === "neutral" ? "bg-zinc-300 text-zinc-700" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
          }`}
        >·</button>
        <button
          onClick={() => onVote(item, "exclude")}
          className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${
            vote === "exclude" ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-red-100 hover:text-red-600"
          }`}
        >−</button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">

      {/* ── LOCATIONS ── */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Locations</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Pick countries or drill into cities. Use +/·/− to include, stay neutral, or exclude.</p>
        </div>

        {/* Location mode */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
          <div className="flex-1">
            <p className="text-xs font-semibold text-zinc-700">How should included locations be treated?</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              <strong>Preference</strong> = boosts score. <strong>Hard</strong> = only jobs in these locations appear.
            </p>
          </div>
          <div className="flex rounded-md border border-zinc-200 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => update("location_mode", "preference")}
              className={`px-3 py-1.5 transition-colors ${form.location_mode === "preference" ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
            >Preference</button>
            <button
              onClick={() => update("location_mode", "hard")}
              className={`px-3 py-1.5 transition-colors border-l border-zinc-200 ${form.location_mode === "hard" ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
            >Hard filter</button>
          </div>
        </div>

        {/* Country + city explorer */}
        <div className="flex gap-3 border border-zinc-100 rounded-lg overflow-hidden bg-white" style={{ height: 280 }}>
          {/* Countries */}
          <div className="flex flex-col w-1/2 border-r border-zinc-100">
            <div className="p-2 border-b border-zinc-100">
              <input
                placeholder="Search countries..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-zinc-400">Loading...</div>
              ) : (
                filteredCountries.map((c) => {
                  const vote = locationVotes[c.name] ?? "neutral";
                  return (
                    <div
                      key={c.name}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedCountry === c.name ? "bg-zinc-50" : ""} ${vote === "include" ? "border-l-2 border-emerald-500" : vote === "exclude" ? "border-l-2 border-red-400" : "border-l-2 border-transparent"}`}
                      onClick={() => { setSelectedCountry(c.name); setCitySearch(""); }}
                    >
                      <span className="text-xs font-medium text-zinc-700 truncate">{c.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <VoteButtons item={c.name} votes={locationVotes} onVote={setLocVote} />
                        {c.cities.length > 0 && <ChevronRight size={12} className="text-zinc-300 ml-1" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cities */}
          <div className="flex flex-col w-1/2">
            {selectedCountry ? (
              <>
                <div className="p-2 border-b border-zinc-100">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{selectedCountry}</p>
                  <input
                    placeholder="Search cities..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="w-full text-xs border border-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredCities.map((city) => {
                    const vote = locationVotes[city] ?? "neutral";
                    return (
                      <div
                        key={city}
                        className={`flex items-center justify-between px-3 py-2 ${vote === "include" ? "border-l-2 border-emerald-500" : vote === "exclude" ? "border-l-2 border-red-400" : "border-l-2 border-transparent"}`}
                      >
                        <span className="text-xs text-zinc-600 truncate">{city}</span>
                        <VoteButtons item={city} votes={locationVotes} onVote={setLocVote} />
                      </div>
                    );
                  })}
                  {filteredCities.length === 0 && (
                    <p className="text-xs text-zinc-400 p-3">No cities listed.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-zinc-400">
                Select a country to see cities
              </div>
            )}
          </div>
        </div>

        {/* Voted locations summary */}
        {allVotedLocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allVotedLocations.map(([loc, vote]) => (
              <span key={loc} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${vote === "include" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {vote === "include" ? "+" : "−"} {loc}
                <button onClick={() => setLocVote(loc, "neutral")} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── COMPANIES ── */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Companies</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Search and vote on companies. Same +/·/− logic applies.</p>
        </div>

        {/* Company mode */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
          <div className="flex-1">
            <p className="text-xs font-semibold text-zinc-700">How should included companies be treated?</p>
          </div>
          <div className="flex rounded-md border border-zinc-200 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => update("company_mode", "preference")}
              className={`px-3 py-1.5 transition-colors ${form.company_mode === "preference" ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
            >Preference</button>
            <button
              onClick={() => update("company_mode", "hard")}
              className={`px-3 py-1.5 transition-colors border-l border-zinc-200 ${form.company_mode === "hard" ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
            >Hard filter</button>
          </div>
        </div>

        <input
          placeholder="Search companies..."
          value={companySearch}
          onChange={(e) => setCompanySearch(e.target.value)}
          className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
        />

        {companyResults.length > 0 && (
          <div className="flex flex-col border border-zinc-100 rounded-lg overflow-hidden">
            {companyResults.map((c) => (
              <div key={c.name} className={`flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-50 last:border-0 ${companyVotes[c.name] === "include" ? "bg-emerald-50" : companyVotes[c.name] === "exclude" ? "bg-red-50" : "bg-white"}`}>
                <span className="text-sm text-zinc-700">{c.name}</span>
                <VoteButtons item={c.name} votes={companyVotes} onVote={setCompVote} />
              </div>
            ))}
          </div>
        )}

        {allVotedCompanies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allVotedCompanies.map(([co, vote]) => (
              <span key={co} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${vote === "include" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {vote === "include" ? "+" : "−"} {co}
                <button onClick={() => setCompVote(co, "neutral")} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {(form.include_locations.length > 0 || form.exclude_locations.length > 0 || form.include_companies.length > 0 || form.exclude_companies.length > 0) && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">What this means</p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {form.include_locations.length > 0 && (
              <>Locations <span className="font-semibold text-zinc-900">{form.include_locations.slice(0, 3).join(", ")}</span> are {form.location_mode === "hard" ? "required — only jobs in these areas will appear" : "preferred — jobs in these areas score higher"}. </>
            )}
            {form.exclude_locations.length > 0 && (
              <><span className="font-semibold text-zinc-900">{form.exclude_locations.join(", ")}</span> are fully blocked. </>
            )}
            {form.include_companies.length > 0 && (
              <>Companies <span className="font-semibold text-zinc-900">{form.include_companies.slice(0, 3).join(", ")}</span> are {form.company_mode === "hard" ? "required" : "preferred"}. </>
            )}
            {form.exclude_companies.length > 0 && (
              <><span className="font-semibold text-zinc-900">{form.exclude_companies.join(", ")}</span> are excluded entirely.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}