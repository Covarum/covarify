import { BriefcaseBusiness, CalendarHeart, ChartNoAxesCombined, CircleDollarSign, HandCoins, HeartHandshake, Home, Landmark, PiggyBank, ShieldCheck, Sparkles, UsersRound, WalletCards } from "lucide-react";

export const intentionOptions = [
  "Understand where my money goes",
  "Get out of debt",
  "Save more",
  "Feel more in control",
  "Organize household finances",
  "Own a business",
  "Planning a major life event",
  "Curious about my financial health",
  "Something else",
];

export const lifeOptions = [
  "Own a home",
  "Rent",
  "Own a business",
  "Self-employed",
  "Have children",
  "Share finances",
  "Own rental property",
  "Planning a major life event",
];

export const analysisAreas = [
  { label: "Income", icon: CircleDollarSign },
  { label: "Spending", icon: WalletCards },
  { label: "Debt", icon: Landmark },
  { label: "Cash Flow", icon: ChartNoAxesCombined },
  { label: "Financial Trends", icon: Sparkles },
  { label: "Personalized Insights", icon: ShieldCheck },
];

export const trustStatements = ["Read-only access", "Encrypted", "Never sold", "Disconnect anytime"];

export const analysisQuestions = [
  {
    prompt: "What's your biggest financial goal over the next 12 months?",
    options: ["Build savings", "Pay down debt", "Buy a home", "Create breathing room"],
    icon: PiggyBank,
  },
  {
    prompt: "How involved do you want Covarify to be?",
    options: ["Quiet guidance", "Regular check-ins", "Proactive coaching", "Only key moments"],
    icon: HeartHandshake,
  },
  {
    prompt: "How detailed do you like your finances?",
    options: ["Simple summary", "Helpful context", "Detailed view", "Everything, organized"],
    icon: BriefcaseBusiness,
  },
];

export const lifeIcons = [Home, Home, BriefcaseBusiness, HandCoins, UsersRound, HeartHandshake, Landmark, CalendarHeart];
