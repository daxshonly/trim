import React, { useState, useEffect, useMemo } from "react";
import {
  Mail,
  ArrowRight,
  Scissors,
  ShieldCheck,
  Eye,
  ExternalLink,
  Music2,
  Cloud,
  Tv,
  Gamepad2,
  BookOpen,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import "./style.css";

// ---------------------------------------------------------------------------
// MOCK DATA
// This whole file is a front-end prototype. "Connecting Gmail" and "Sign in
// with Google" are simulated — there is no real OAuth or inbox scanning here.
// See the notes in chat for what a real backend needs (OAuth, Gmail API, a
// database, a receipt-parsing job, etc).
// ---------------------------------------------------------------------------

const SUBSCRIPTIONS = [
  {
    id: "ytp",
    name: "YouTube Premium",
    category: "Video",
    icon: Tv,
    price: 149,
    cycle: "month",
    lastUsed: "Today",
    daysSinceUse: 0,
    cancelUrl: "https://www.youtube.com/paid_memberships",
  },
  {
    id: "netflix",
    name: "Netflix",
    category: "Video",
    icon: Tv,
    price: 199,
    cycle: "month",
    lastUsed: "2 days ago",
    daysSinceUse: 2,
    cancelUrl: "https://www.netflix.com/youraccount",
  },
  {
    id: "hotstar",
    name: "Disney+ Hotstar",
    category: "Video",
    icon: Tv,
    price: 899,
    cycle: "year",
    lastUsed: "71 days ago",
    daysSinceUse: 71,
    cancelUrl: "https://www.hotstar.com/in/subscription",
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "Music",
    icon: Music2,
    price: 119,
    cycle: "month",
    lastUsed: "Today",
    daysSinceUse: 0,
    cancelUrl: "https://www.spotify.com/account/subscription/",
  },
  {
    id: "ytmusic",
    name: "YouTube Music",
    category: "Music",
    icon: Music2,
    price: 99,
    cycle: "month",
    lastUsed: "38 days ago",
    daysSinceUse: 38,
    cancelUrl: "https://www.youtube.com/paid_memberships",
  },
  {
    id: "applemusic",
    name: "Apple Music",
    category: "Music",
    icon: Music2,
    price: 99,
    cycle: "month",
    lastUsed: "54 days ago",
    daysSinceUse: 54,
    cancelUrl: "https://apps.apple.com/account/subscriptions",
  },
  {
    id: "icloud",
    name: "iCloud+ 200GB",
    category: "Storage",
    icon: Cloud,
    price: 75,
    cycle: "month",
    lastUsed: "Today",
    daysSinceUse: 0,
    cancelUrl: "https://www.icloud.com/settings/",
  },
  {
    id: "gamepass",
    name: "Xbox Game Pass",
    category: "Gaming",
    icon: Gamepad2,
    price: 489,
    cycle: "month",
    lastUsed: "46 days ago",
    daysSinceUse: 46,
    cancelUrl: "https://account.microsoft.com/services",
  },
  {
    id: "kindle",
    name: "Kindle Unlimited",
    category: "Reading",
    icon: BookOpen,
    price: 169,
    cycle: "month",
    lastUsed: "12 days ago",
    daysSinceUse: 12,
    cancelUrl: "https://www.amazon.in/kindle-dbs/subscribe/kucoupon",
  },
];

const monthlyCost = (s) => (s.cycle === "year" ? s.price / 12 : s.price);

function currency(n) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// VERDICT ENGINE
// Very simple heuristic used only to make the "deep dive" section feel real:
//   - unused for 45+ days  -> lean cancel
//   - 2nd+ subscription in the same category -> lean cancel (duplicate)
//   - otherwise, near/over budget nudges the cheapest "review" items to cancel
// ---------------------------------------------------------------------------
function buildVerdicts(subs, budget) {
  const byCategory = {};
  subs.forEach((s) => {
    byCategory[s.category] = byCategory[s.category] || [];
    byCategory[s.category].push(s);
  });

  const scored = subs.map((s) => {
    let reasons = [];
    let score = 100 - s.daysSinceUse; // higher = keep more

    const dup = byCategory[s.category].length > 1;
    if (dup) {
      const isLeastUsed =
        s.daysSinceUse ===
        Math.max(...byCategory[s.category].map((x) => x.daysSinceUse));
      if (isLeastUsed) {
        score -= 40;
        reasons.push(
          `overlaps with ${byCategory[s.category].length - 1} other ${s.category.toLowerCase()} app${
            byCategory[s.category].length > 2 ? "s" : ""
          }`
        );
      }
    }

    if (s.daysSinceUse >= 45) {
      score -= 50;
      reasons.push(`not opened in ${s.daysSinceUse} days`);
    } else if (s.daysSinceUse === 0) {
      reasons.push("used today");
    }

    return { ...s, score, reasons, dup };
  });

  scored.sort((a, b) => a.score - b.score);

  const total = subs.reduce((sum, s) => sum + monthlyCost(s), 0);
  let running = total;
  const verdicts = {};

  scored.forEach((s) => {
    let verdict = "keep";
    if (s.reasons.length > 0 && s.score < 40) {
      verdict = "cancel";
    } else if (s.reasons.length > 0 && s.score < 70) {
      verdict = "review";
    }
    // if still over budget, push weakest "review"/"keep" items toward cancel
    if (running > budget && verdict !== "cancel") {
      verdict = verdict === "keep" ? "review" : "cancel";
    }
    if (verdict === "cancel") running -= monthlyCost(s);
    verdicts[s.id] = { verdict, reasons: s.reasons, score: s.score };
  });

  return { verdicts, total };
}

const VERDICT_STYLE = {
  keep: { label: "Keep", color: "#4F7A5D", Icon: ShieldCheck },
  review: { label: "Review", color: "#C99A3B", Icon: Eye },
  cancel: { label: "Cut it", color: "#D6432E", Icon: Scissors },
};

export default function SubscriptionTracker() {
  const [view, setView] = useState("login"); // login -> connecting -> dashboard
  const [authName, setAuthName] = useState("");
  const [scanPct, setScanPct] = useState(0);
  const [budget, setBudget] = useState(1200);

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  useEffect(() => {
    if (view !== "connecting") return;
    setScanPct(0);
    const start = Date.now();
    const duration = 2200;
    const tick = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100);
      setScanPct(pct);
      if (pct >= 100) {
        clearInterval(tick);
        setTimeout(() => setView("dashboard"), 350);
      }
    }, 40);
    return () => clearInterval(tick);
  }, [view]);

  const { verdicts, total } = useMemo(
    () => buildVerdicts(SUBSCRIPTIONS, budget),
    [budget]
  );

  const potentialSavings = SUBSCRIPTIONS.reduce((sum, s) => {
    return verdicts[s.id]?.verdict === "cancel" ? sum + monthlyCost(s) : sum;
  }, 0);

  return (
    <div style={{ background: "#14171F", minHeight: "100vh" }}>
      <div className="st-root">
        {view === "login" && (
          <LoginView
            authName={authName}
            setAuthName={setAuthName}
            onContinue={() => setView("connecting")}
          />
        )}
        {view === "connecting" && <ConnectingView pct={scanPct} />}
        {view === "dashboard" && (
          <Dashboard
            budget={budget}
            setBudget={setBudget}
            verdicts={verdicts}
            total={total}
            potentialSavings={potentialSavings}
          />
        )}
      </div>
    </div>
  );
}

function LoginView({ authName, setAuthName, onContinue }) {
  const [mode, setMode] = useState("signin");
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }} className="st-fade">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            className="st-mono"
            style={{
              color: "#C99A3B",
              fontSize: 12,
              letterSpacing: "0.2em",
              marginBottom: 8,
            }}
          >
            LEDGER
          </div>
          <h1
            className="st-display"
            style={{ color: "#F3EFE4", fontSize: 28, fontWeight: 600, margin: 0 }}
          >
            Know what you're paying for.
          </h1>
        </div>

        <div className="st-card" style={{ padding: "28px 24px 24px" }}>
          <div
            style={{
              display: "flex",
              gap: 4,
              background: "#EAE4D4",
              borderRadius: 6,
              padding: 4,
              marginBottom: 20,
            }}
          >
            {["signin", "create"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  background: mode === m ? "#14171F" : "transparent",
                  color: mode === m ? "#F3EFE4" : "#5A5647",
                }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <button
            className="st-google-btn"
            onClick={onContinue}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "11px 0",
              borderRadius: 6,
              border: "1.5px solid #23262E",
              background: "#F3EFE4",
              color: "#23262E",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 18,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#23262E",
                color: "#F3EFE4",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              G
            </span>
            Continue with Google
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "16px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#D9D2BE" }} />
            <span className="st-mono" style={{ fontSize: 10, color: "#8A8470" }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: "#D9D2BE" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="st-input"
              placeholder={mode === "signin" ? "Username" : "Choose a username"}
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              style={inputStyle}
            />
            <input
              className="st-input"
              placeholder="Password"
              type="password"
              style={inputStyle}
            />
            <button
              onClick={onContinue}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "11px 0",
                borderRadius: 6,
                border: "none",
                background: "#23262E",
                color: "#F3EFE4",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <p
          className="st-mono"
          style={{
            textAlign: "center",
            color: "#5A5F6E",
            fontSize: 11,
            marginTop: 16,
          }}
        >
          demo prototype — no real account is created
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1.5px solid #D9D2BE",
  background: "#FBF9F3",
  fontSize: 14,
  color: "#23262E",
};

function ConnectingView({ pct }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }} className="st-fade">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#1C202B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Mail size={24} color="#C99A3B" />
        </div>
        <h2 className="st-display" style={{ color: "#F3EFE4", fontSize: 20, marginBottom: 6 }}>
          {pct < 100 ? "Scanning your inbox…" : "Done."}
        </h2>
        <p className="st-mono" style={{ color: "#8A8FA3", fontSize: 12, marginBottom: 20 }}>
          {pct < 40
            ? "looking for billing receipts"
            : pct < 80
            ? "matching known subscription senders"
            : "totaling monthly cost"}
        </p>
        <div
          style={{
            height: 6,
            background: "#1C202B",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "#C99A3B",
              transition: "width 0.05s linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Dashboard({ budget, setBudget, verdicts, total, potentialSavings }) {
  const grouped = useMemo(() => {
    const g = {};
    SUBSCRIPTIONS.forEach((s) => {
      g[s.category] = g[s.category] || [];
      g[s.category].push(s);
    });
    return g;
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 96px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }} className="st-fade">
        <div
          className="st-mono"
          style={{ color: "#C99A3B", fontSize: 12, letterSpacing: "0.2em", marginBottom: 8 }}
        >
          YOUR LEDGER
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <h1 className="st-display" style={{ color: "#F3EFE4", fontSize: 30, fontWeight: 600, margin: 0 }}>
            {SUBSCRIPTIONS.length} subscriptions found
          </h1>
          <div style={{ textAlign: "right" }}>
            <div className="st-mono" style={{ color: "#F3EFE4", fontSize: 26, fontWeight: 600 }}>
              {currency(Math.round(total))}
              <span style={{ fontSize: 13, color: "#8A8FA3" }}>/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt card */}
      <div className="st-card st-fade" style={{ padding: "24px 22px 18px", marginBottom: 12 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div
              className="st-mono"
              style={{ fontSize: 10, letterSpacing: "0.12em", color: "#8A8470", marginBottom: 6 }}
            >
              {cat.toUpperCase()}
            </div>
            {items.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="st-line"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "#23262E",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} color="#F3EFE4" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#23262E", fontWeight: 600, fontSize: 14 }}>
                      {s.name}
                    </div>
                    <div className="st-mono" style={{ color: "#8A8470", fontSize: 11 }}>
                      last used {s.lastUsed.toLowerCase()}
                    </div>
                  </div>
                  <div className="st-mono" style={{ color: "#23262E", fontSize: 14, textAlign: "right", whiteSpace: "nowrap" }}>
                    {currency(s.price)}
                    <span style={{ fontSize: 10, color: "#8A8470" }}>/{s.cycle}</span>
                  </div>
                  <a
                    href={s.cancelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-cancel-btn"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1.5px solid #D6432E",
                      color: "#D6432E",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Cancel <ExternalLink size={11} />
                  </a>
                </div>
              );
            })}
          </div>
        ))}
        <div
          style={{
            borderTop: "2px solid #23262E",
            paddingTop: 12,
            marginTop: 4,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span className="st-mono" style={{ fontSize: 12, fontWeight: 600, color: "#23262E" }}>
            TOTAL / MONTH
          </span>
          <span className="st-mono" style={{ fontSize: 12, fontWeight: 600, color: "#23262E" }}>
            {currency(Math.round(total))}
          </span>
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "40px 0 24px" }}>
        <ChevronDown
          size={20}
          color="#5A5F6E"
          style={{ animation: "st-fade 1.4s ease-in-out infinite alternate" }}
        />
        <div className="st-mono" style={{ color: "#5A5F6E", fontSize: 11, marginTop: 4 }}>
          scroll for the deep dive
        </div>
      </div>

      {/* Deep dive */}
      <div className="st-fade">
        <div
          className="st-mono"
          style={{ color: "#C99A3B", fontSize: 12, letterSpacing: "0.2em", marginBottom: 8 }}
        >
          DEEP DIVE
        </div>
        <h2 className="st-display" style={{ color: "#F3EFE4", fontSize: 24, marginBottom: 18 }}>
          Set a monthly budget, see what to cut.
        </h2>

        <div style={{ background: "#1C202B", borderRadius: 8, padding: "20px 20px 22px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="st-mono" style={{ color: "#8A8FA3", fontSize: 12 }}>
              BUDGET
            </span>
            <span className="st-mono" style={{ color: "#F3EFE4", fontSize: 16, fontWeight: 600 }}>
              {currency(budget)}/mo
            </span>
          </div>
          <input
            type="range"
            min={300}
            max={2500}
            step={50}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="st-slider"
            style={{
              width: "100%",
              accentColor: "#C99A3B",
              height: 4,
              background: "#2A2F3B",
              borderRadius: 2,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12 }} className="st-mono">
            <span style={{ color: total > budget ? "#D6432E" : "#4F7A5D" }}>
              current: {currency(Math.round(total))} ({total > budget ? "over" : "under"} by {currency(Math.round(Math.abs(total - budget)))})
            </span>
            <span style={{ color: "#C99A3B" }}>
              cut {currency(Math.round(potentialSavings))}/mo → save {currency(Math.round(potentialSavings * 12))}/yr
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SUBSCRIPTIONS.slice()
            .sort((a, b) => verdicts[a.id].score - verdicts[b.id].score)
            .map((s) => {
              const v = verdicts[s.id];
              const style = VERDICT_STYLE[v.verdict];
              const VIcon = style.Icon;
              return (
                <div
                  key={s.id}
                  style={{
                    background: "#1C202B",
                    borderRadius: 8,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    borderLeft: `3px solid ${style.color}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#F3EFE4", fontWeight: 600, fontSize: 14 }}>
                        {s.name}
                      </span>
                      <span className="st-mono" style={{ color: "#5A5F6E", fontSize: 11 }}>
                        {currency(Math.round(monthlyCost(s)))}/mo
                      </span>
                    </div>
                    <div style={{ color: "#8A8FA3", fontSize: 12, marginTop: 2 }}>
                      {v.reasons.length > 0
                        ? v.reasons.join(" · ")
                        : "regularly used, no overlap"}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 5,
                      background: `${style.color}22`,
                      color: style.color,
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    <VIcon size={12} />
                    {style.label}
                  </div>
                </div>
              );
            })}
        </div>

        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            borderRadius: 8,
            background: "#1C202B",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Sparkles size={16} color="#C99A3B" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ color: "#8A8FA3", fontSize: 12.5, lineHeight: 1.5 }}>
            Ranking mixes two signals: how long it's been since you last opened
            the app, and whether another subscription already covers the same
            job (three music apps, three video apps). It's a starting point,
            not a verdict — nothing cancels itself.
          </div>
        </div>
      </div>
    </div>
  );
}
