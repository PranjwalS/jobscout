import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/create_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Signup failed");
        return;
      }

      localStorage.setItem("token", data.token);
      navigate("/dashboard");
    } catch {
      setError("Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-['DM_Sans',sans-serif] flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 flex-col justify-between p-12">
        <Link to="/" className="text-sm font-bold tracking-widest uppercase text-white">
          JobScout
        </Link>
        <div>
          <h2 className="text-[clamp(2.5rem,5vw,5rem)] font-black leading-[0.9] uppercase tracking-tight text-white mb-6">
            Land your
            <br />
            dream
            <br />
            co-op.
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed max-w-[35ch]">
            Set up your Career Twin, configure your dashboards, and let JobScout match you to the right roles automatically.
          </p>
        </div>
        <p className="text-zinc-600 text-xs">© 2026 JobScout</p>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16">
        <div className="w-full max-w-sm mx-auto">

          {/* Mobile logo */}
          <Link to="/" className="lg:hidden block text-sm font-bold tracking-widest uppercase text-zinc-900 mb-12">
            JobScout
          </Link>

          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Create your account</h1>
          <p className="text-zinc-500 text-sm mb-8">
            Already have one?{" "}
            <Link to="/login" className="text-zinc-900 font-semibold underline underline-offset-2">
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Smith"
                className="w-full border border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full border border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min. 6 characters"
                className="w-full border border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white text-sm font-semibold py-3 rounded-md hover:bg-zinc-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Creating account..." : "Create account →"}
            </button>
          </form>

          <p className="text-zinc-400 text-xs mt-6 leading-relaxed">
            By creating an account you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>

    </div>
  );
}
