import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Mail, Lock, User, Phone, Truck, Building2, Eye, EyeOff, Loader2 } from "lucide-react";

export default function AuthScreen({ onBack, onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("driver"); // driver | employer
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
    setLoading(false);
    onAuthSuccess(data.user, profileData);
  };

  const handleSignup = async () => {
    if (!fullName.trim()) {
      setError("Ad Soyad gerekli");
      return;
    }
    if (!phone.trim()) {
      setError("Telefon numarası gerekli");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // Insert profile
    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: role,
        },
      ]);
      if (profileError) {
        console.error("Profile insert error:", profileError);
        setError("Hesap oluşturuldu fakat profil kaydedilemedi: " + profileError.message);
        setLoading(false);
        return;
      }
      // If email confirmation is required
      if (data.session) {
        // Auto-confirmed, proceed
        const profile = { id: data.user.id, full_name: fullName.trim(), phone: phone.trim(), role };
        setLoading(false);
        onAuthSuccess(data.user, profile);
      } else {
        // Email confirmation needed
        setLoading(false);
        setSuccess("Hesabınız oluşturuldu! Lütfen e-posta adresinizi doğrulayın.");
        setMode("login");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("E-posta ve şifre gerekli");
      return;
    }
    if (mode === "login") handleLogin();
    else handleSignup();
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all text-slate-300 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 transform -scale-x-100">
            <Truck size={22} className="fill-current" />
          </span>
          <span className="text-white font-extrabold text-lg tracking-tight">YükCep</span>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 p-5 pb-20 overflow-y-auto">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
            <span className="text-4xl">{mode === "login" ? "🔑" : "✨"}</span>
          </div>
          <h2 className="text-white text-2xl font-black tracking-tight">
            {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {mode === "login"
              ? "Hesabınıza giriş yapın"
              : "Ücretsiz hesabınızı oluşturun"}
          </p>
        </div>

        {/* Error / Success Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-bold flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold flex items-center gap-2">
            ✅ {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name (signup only) */}
          {mode === "signup" && (
            <div>
              <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">
                👤 Ad Soyad
              </label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Adınız Soyadınız"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full py-4 pl-12 pr-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-bold placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">
              ✉️ E-posta
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-4 pl-12 pr-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-bold placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">
              🔒 Şifre
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-4 pl-12 pr-12 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-bold placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Phone (signup only) */}
          {mode === "signup" && (
            <div>
              <label className="text-slate-400 text-xs font-bold mb-1.5 block ml-1 uppercase">
                📱 Telefon
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  placeholder="05XX XXX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full py-4 pl-12 pr-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-bold placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Role Selector (signup only) */}
          {mode === "signup" && (
            <div>
              <label className="text-slate-400 text-xs font-bold mb-2 block ml-1 uppercase">
                🎯 Rolünüz
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("driver")}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                    role === "driver"
                      ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      role === "driver"
                        ? "bg-blue-500 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    <Truck size={24} />
                  </div>
                  <span
                    className={`font-bold text-sm ${
                      role === "driver" ? "text-blue-400" : "text-slate-400"
                    }`}
                  >
                    Şoför
                  </span>
                  <span className="text-slate-500 text-[10px]">Yük taşıyorum</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("employer")}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                    role === "employer"
                      ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      role === "employer"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    <Building2 size={24} />
                  </div>
                  <span
                    className={`font-bold text-sm ${
                      role === "employer" ? "text-orange-400" : "text-slate-400"
                    }`}
                  >
                    İşveren
                  </span>
                  <span className="text-slate-500 text-[10px]">Yük göndereceğim</span>
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 rounded-2xl text-white font-black text-xl active:scale-[0.98] transition-all relative overflow-hidden shadow-xl disabled:opacity-50"
            style={{
              background:
                mode === "login"
                  ? "linear-gradient(180deg,#60a5fa,#2563eb)"
                  : "linear-gradient(180deg,#34d399,#059669)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
            <span className="relative flex items-center justify-center gap-2">
              {loading && <Loader2 size={22} className="animate-spin" />}
              {mode === "login" ? "GİRİŞ YAP" : "KAYIT OL"}
            </span>
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            {mode === "login" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}
          </p>
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setSuccess(null);
            }}
            className="mt-1 text-blue-400 font-bold text-sm hover:text-blue-300 transition-colors"
          >
            {mode === "login" ? "Ücretsiz Hesap Oluştur →" : "← Giriş Yap"}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30 text-center">
          <p className="text-slate-500 text-xs leading-relaxed">
            🛡️ <span className="text-slate-300 font-bold">Güvenli Giriş</span> · Verileriniz
            şifrelenerek korunur
          </p>
        </div>
      </div>
    </div>
  );
}
