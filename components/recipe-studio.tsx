"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Beaker,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Cloud,
  Droplets,
  FlaskConical,
  FolderOpen,
  Hop,
  LoaderCircle,
  LogIn,
  LogOut,
  Moon,
  Package,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  ShoppingBasket,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Wheat,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useBrewStore, hasStorageFailure } from "@/lib/store";
import { calculateRecipe } from "@/lib/calculations";
import { optimizeSingleSupplier, requirementsFor } from "@/lib/optimizer";
import { grainCatalog, hopCatalog } from "@/lib/seed";
import { inventorySchema, recipeSchema, supplierSchema } from "@/lib/schemas";
import { downloadFile, exportBeerXML, toBrewfather } from "@/lib/export";
import type {
  Grain,
  Hop as HopIngredient,
  InventoryItem,
  Recipe,
} from "@/lib/types";
import * as UI from "./ui";

type View = "studio" | "inventory" | "sourcing" | "recipes";
type Modal =
  | "grain"
  | "hop"
  | "equipment"
  | "sync"
  | "login"
  | "export"
  | "supplier"
  | "inventory"
  | "cart"
  | "help"
  | null;
const money = (value: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
const id = () => crypto.randomUUID();

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      value={Number(value.toFixed(3))}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        if (event.target.value === "") return;
        const value = event.target.valueAsNumber;
        if (Number.isFinite(value))
          onChange(Math.min(max, Math.max(min, value)));
      }}
    />
  );
}

export default function RecipeStudio() {
  const store = useBrewStore();
  const { recipe, inventory, suppliers, dark, units } = store;
  const stats = calculateRecipe(recipe);
  const requirements = requirementsFor(recipe);
  const [allowSubs, setAllowSubs] = useState(true);
  const sourcing = optimizeSingleSupplier(
    requirements,
    inventory,
    suppliers,
    allowSubs,
  );
  const best = sourcing.options[0];
  const [supplierChoice, setSupplierChoice] = useState("");
  const selectedCart =
    sourcing.options.find((option) => option.supplier.id === supplierChoice) ??
    best;
  const coverage = requirements.length
    ? Math.round(
        (requirements.reduce((total, required) => {
          const available = inventory
            .filter(
              (item) =>
                item.name.toLowerCase() === required.name.toLowerCase() &&
                item.unit === required.unit &&
                item.kind === required.kind,
            )
            .reduce((sum, item) => sum + item.quantity, 0);
          return total + Math.min(1, available / required.quantity);
        }, 0) /
          requirements.length) *
          100,
      )
    : 0;
  const [view, setView] = useState<View>("studio");
  const [modal, setModal] = useState<Modal>(null);
  const [manual, setManual] = useState(false);
  const [activeTab, setActiveTab] = useState("grains");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [online, setOnline] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [previous, setPrevious] = useState<Recipe | null>(null);
  const [search, setSearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    let cancelled = false;
    async function loadSession() {
      try {
        const session = await api("/api/session");
        if (cancelled) return;
        setUser(session.user);
        setAuthConfigured(session.configured);
        setAiConfigured(session.aiConfigured);
        await useBrewStore.persist.rehydrate();
        if (cancelled) return;
        const current = useBrewStore.getState();
        if (session.user) {
          current.clearAccountData(session.user.id);
          const data = await api("/api/workspace");
          if (cancelled) return;
          if (data.inventory) {
            current.setInventory(
              inventorySchema.parse(data.inventory),
              data.inventorySource === "brewfather" ? "brewfather" : "manual",
            );
            useBrewStore.setState({ lastSync: data.lastSync });
          }
          if (data.suppliers?.length)
            current.setSuppliers(supplierSchema.array().parse(data.suppliers));
          if (data.recipes?.length) {
            const cloudRecipes = data.recipes.filter(
              (item: { recipe: unknown }) =>
                recipeSchema.safeParse(item.recipe).success,
            );
            useBrewStore.setState((state) => ({
              savedRecipes: [
                ...cloudRecipes,
                ...state.savedRecipes.filter(
                  (local) =>
                    !cloudRecipes.some(
                      (cloud: { id: string }) => cloud.id === local.id,
                    ),
                ),
              ].slice(0, 100),
            }));
          }
        } else if (current.accountId) current.clearAccountData(null);
      } catch (cause) {
        if (!cancelled && navigator.onLine)
          setToast(
            cause instanceof Error
              ? cause.message
              : "Cloud workspace is unavailable.",
          );
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [store.messages.length]);

  function openModal(next: Modal) {
    setError("");
    setModal(next);
  }
  function applyRecipe(next: Recipe) {
    setPrevious(structuredClone(recipe));
    store.setRecipe(next);
    setToast("Recipe updated. Brewing metrics recalculated.");
  }
  function stockFor(name: string, kind: InventoryItem["kind"]) {
    const required = requirements.find(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() && item.kind === kind,
    );
    const available = inventory
      .filter(
        (item) =>
          item.name.toLowerCase() === name.toLowerCase() &&
          item.kind === kind &&
          item.unit === required?.unit,
      )
      .reduce((total, item) => total + item.quantity, 0);
    return {
      enough: available >= (required?.quantity ?? 0),
      available,
      unit: required?.unit ?? "",
    };
  }
  function Stock({
    name,
    kind,
  }: {
    name: string;
    kind: InventoryItem["kind"];
  }) {
    const stock = stockFor(name, kind);
    return (
      <UI.Badge $tone={stock.enough ? "green" : "accent"}>
        {stock.enough ? <Check size={10} /> : <ShoppingBasket size={10} />}
        {stock.enough ? "In cellar" : "Source"} ·{" "}
        {Number(stock.available.toFixed(2))}
        {stock.unit}
      </UI.Badge>
    );
  }
  function updateGrain(grainId: string, updates: Partial<Grain>) {
    store.updateRecipe({
      grains: recipe.grains.map((grain) =>
        grain.id === grainId ? { ...grain, ...updates } : grain,
      ),
    });
  }
  function updateHop(hopId: string, updates: Partial<HopIngredient>) {
    store.updateRecipe({
      hops: recipe.hops.map((hop) =>
        hop.id === hopId ? { ...hop, ...updates } : hop,
      ),
    });
  }
  async function saveRecipe() {
    store.saveRecipe();
    if (hasStorageFailure()) {
      setToast(
        "Device storage unavailable. Export your recipe to keep a copy.",
      );
      return;
    }
    setToast("Recipe saved on this device.");
    if (user && online) {
      try {
        await api("/api/recipes", "POST", {
          id: useBrewStore.getState().savedRecipes[0].id,
          recipe,
        });
        setToast("Recipe saved to your account and this device.");
      } catch (cause) {
        setToast(
          `Saved locally. ${cause instanceof Error ? cause.message : "Cloud save failed."}`,
        );
      }
    }
  }
  async function saveInventory() {
    try {
      await api("/api/workspace", "PUT", inventory);
      setToast("Inventory saved to your account.");
    } catch (cause) {
      setToast(
        cause instanceof Error ? cause.message : "Inventory save failed.",
      );
    }
  }
  async function refreshSupplier(supplierId: string) {
    try {
      const result = await api("/api/suppliers/refresh", "POST", {
        id: supplierId,
      });
      const supplier = supplierSchema.parse(result.supplier);
      store.setSuppliers(
        suppliers.map((item) => (item.id === supplier.id ? supplier : item)),
      );
      setToast("Supplier catalog refreshed.");
    } catch (cause) {
      setToast(
        cause instanceof Error ? cause.message : "Catalog refresh failed.",
      );
    }
  }
  async function deleteSavedRecipe(recipeId: string) {
    try {
      if (user) await api(`/api/recipes?id=${encodeURIComponent(recipeId)}`, "DELETE");
      store.removeSavedRecipe(recipeId);
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Could not delete recipe.");
    }
  }
  async function sendPrompt(text = prompt) {
    if (!text.trim() || busy) return;
    const messages = [
      ...store.messages.map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: text.trim() },
    ].slice(-12);
    store.addMessage({ id: id(), role: "user", content: text.trim() });
    setPrompt("");
    setBusy(true);
    try {
      const result = await api("/api/ai", "POST", { recipe, messages });
      store.addMessage({
        id: id(),
        role: "assistant",
        content: result.explanation,
        proposal: recipeSchema.parse(result.recipe),
      });
    } catch (cause) {
      store.addMessage({
        id: id(),
        role: "assistant",
        content:
          cause instanceof Error
            ? cause.message
            : "The co-brewer is unavailable.",
      });
    } finally {
      setBusy(false);
    }
  }
  function exportCart() {
    if (!selectedCart) return;
    const rows = [
      [
        "Supplier",
        "Requested ingredient",
        "Product",
        "Missing",
        "Unit",
        "Packages",
        "Purchased",
        "Cost",
        "Currency",
      ],
      ...selectedCart.lines.map((line) => [
        selectedCart.supplier.name,
        line.name,
        line.product,
        line.quantity,
        line.unit,
        line.packages,
        line.purchased,
        line.cost.toFixed(2),
        selectedCart.supplier.currency,
      ]),
      [
        "Shipping",
        "",
        "",
        "",
        "",
        "",
        "",
        selectedCart.supplier.shipping.toFixed(2),
        selectedCart.supplier.currency,
      ],
      [
        "Total",
        "",
        "",
        "",
        "",
        "",
        "",
        selectedCart.total.toFixed(2),
        selectedCart.supplier.currency,
      ],
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    downloadFile("brewlab-ai-shopping-list.csv", csv, "text/csv");
    setToast("Shopping list exported.");
  }
  function scrollTo(section: string) {
    setActiveTab(section);
    document
      .getElementById(section)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const weightFactor = units === "imperial" ? 2.20462 : 1;
  const hopFactor = units === "imperial" ? 0.035274 : 1;
  const grainUnit = units === "imperial" ? "lb" : "kg";
  const hopUnit = units === "imperial" ? "oz" : "g";
  const isSample = store.inventorySource === "sample";
  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (inventoryFilter === "all" || item.kind === inventoryFilter),
  );
  const title =
    modal === "grain"
      ? "Add fermentable"
      : modal === "hop"
        ? "Add hop addition"
        : modal === "sync"
          ? "Connect Brewfather"
          : modal === "equipment"
            ? "Recipe & equipment"
            : modal === "export"
              ? "Export recipe"
              : modal === "supplier"
                ? "Add stockist"
                : modal === "inventory"
                  ? "Add inventory item"
                  : modal === "cart"
                    ? "Single-supplier basket"
                    : modal === "help"
                      ? "BrewLab.ai / About"
                      : "Your brewing account";

  async function handleForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "");
    const numeric = (key: string) => Number(data.get(key));
    try {
      if (modal === "grain") {
        const grain = grainCatalog.find((item) => item.name === text("name"))!;
        store.updateRecipe({
          grains: [
            ...recipe.grains,
            { ...grain, id: id(), kg: numeric("quantity") / weightFactor },
          ],
        });
      } else if (modal === "hop") {
        const hop = hopCatalog.find((item) => item.name === text("name"))!;
        store.updateRecipe({
          hops: [
            ...recipe.hops,
            {
              ...hop,
              id: id(),
              grams: numeric("quantity") / hopFactor,
              minutes: numeric("minutes"),
              use: text("use") as HopIngredient["use"],
              ageMonths: numeric("age"),
            },
          ],
        });
      } else if (modal === "equipment") {
        store.setRecipe(
          recipeSchema.parse({
            ...recipe,
            name: text("name"),
            style: text("style"),
            batchLiters:
              numeric("volume") * (units === "imperial" ? 3.78541 : 1),
            efficiency: numeric("efficiency"),
            mashTunLiters: numeric("mashTun"),
            boilOff: numeric("boilOff"),
            boilMinutes: numeric("boilMinutes"),
            water: {
              ...recipe.water,
              calcium: numeric("calcium"),
              sulfate: numeric("sulfate"),
              chloride: numeric("chloride"),
            },
          }),
        );
      } else if (modal === "inventory") {
        const kind = text("kind") as InventoryItem["kind"];
        const unit = kind === "grain" ? "kg" : kind === "yeast" ? "pack" : "g";
        store.setInventory(
          inventorySchema.parse([
            ...inventory,
            {
              id: id(),
              name: text("name"),
              kind,
              unit,
              quantity: numeric("quantity"),
            },
          ]),
          "manual",
        );
      } else if (modal === "supplier") {
        const supplier = supplierSchema.parse({
          id: id(),
          name: text("name"),
          url: text("url"),
          currency: text("currency"),
          shipping: numeric("shipping"),
          products: JSON.parse(text("products")),
        });
        if (user) await api("/api/suppliers", "POST", supplier);
        store.setSuppliers([...suppliers, supplier]);
      } else if (modal === "sync") {
        const result = await api("/api/brewfather/sync", "POST", {
          userId: text("userId"),
          apiKey: text("apiKey"),
          version: text("version"),
        });
        store.setInventory(
          inventorySchema.parse(result.inventory),
          "brewfather",
        );
        setToast(
          `Synced ${result.inventory.length} inventory items from Brewfather.`,
        );
      }
      setModal(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Please check your inputs.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <UI.Header>
        <UI.HeaderInner>
          <UI.Brand>
            <UI.Mark>
              <Wheat size={23} strokeWidth={1.6} />
            </UI.Mark>
            <div>
              <strong>
                BrewLab.ai
                <span style={{ fontWeight: 400, opacity: 0.35 }}> /</span>
              </strong>
              <small>THE FORMULATION STUDIO</small>
            </div>
          </UI.Brand>
          <UI.Nav aria-label="Main navigation">
            {(
              [
                { key: "studio", label: "Recipe studio", icon: FlaskConical },
                { key: "inventory", label: "My inventory", icon: Package },
                { key: "sourcing", label: "Stockists", icon: ShoppingBasket },
                { key: "recipes", label: "Recipe library", icon: BookOpen },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <UI.NavButton
                key={key}
                $active={view === key}
                onClick={() => setView(key)}
              >
                <Icon size={14} />
                {label}
              </UI.NavButton>
            ))}
          </UI.Nav>
          <UI.Row $gap={12}>
            <UI.Badge $tone={online ? "green" : undefined}>
              {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              {online ? "Online" : "Offline"}
            </UI.Badge>
            <UI.IconButton
              onClick={store.toggleDark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </UI.IconButton>
            <UI.IconButton
              onClick={() => openModal("login")}
              aria-label="Account"
              title={user?.email || "Sign in"}
            >
              <UI.Avatar>
                {user ? (
                  user.email.slice(0, 2).toUpperCase()
                ) : (
                  <LogIn size={14} />
                )}
              </UI.Avatar>
            </UI.IconButton>
          </UI.Row>
        </UI.HeaderInner>
      </UI.Header>

      {view === "studio" ? (
        <UI.Fade>
          <UI.Identity>
            <div>
              <UI.Eyebrow style={{ marginBottom: 9 }}>
                WORKSPACE <ChevronRight size={10} /> RECIPE STUDIO{" "}
                <ChevronRight size={10} /> DRAFT
              </UI.Eyebrow>
              <UI.Row $gap={12} $wrap>
                <h1>{recipe.name}</h1>
                <UI.Badge $tone="accent">ALL GRAIN</UI.Badge>
              </UI.Row>
              <UI.Subtitle>
                <span>{recipe.style}</span>
                <span>·</span>
                <span>
                  {(
                    recipe.batchLiters / (units === "imperial" ? 3.78541 : 1)
                  ).toFixed(1)}{" "}
                  {units === "imperial" ? "gal" : "L"} batch
                </span>
                <span>·</span>
                <span>{recipe.boilMinutes} min boil</span>
                <UI.Badge $tone="green">
                  <DotIcon />
                  {recipe.efficiency}% efficiency
                </UI.Badge>
              </UI.Subtitle>
            </div>
            <UI.Row $gap={8} $wrap>
              <UI.IconButton
                onClick={() => openModal("equipment")}
                title="Recipe and equipment settings"
                aria-label="Recipe and equipment settings"
              >
                <Settings2 size={17} />
              </UI.IconButton>
              <UI.Button onClick={() => openModal("export")}>
                <ArrowDownToLine size={14} />
                Export
              </UI.Button>
              <UI.Button $primary onClick={saveRecipe}>
                <Save size={14} />
                Save recipe
              </UI.Button>
            </UI.Row>
          </UI.Identity>

          <UI.MetricBand>
            <UI.Metrics aria-label="Live brewing metrics" aria-live="polite">
              <UI.Metric>
                <h3>Original gravity</h3>
                <strong>{stats.og.toFixed(3)}</strong> <small>SG</small>
                <UI.Track $percent={(stats.og - 1) * 1000} />
                <small>Estimated extract</small>
              </UI.Metric>
              <UI.Metric>
                <h3>Final gravity</h3>
                <strong>{stats.fg.toFixed(3)}</strong> <small>SG</small>
                <UI.Track $percent={recipe.attenuation} $color="#9aa7ad" />
                <small>{recipe.attenuation}% attenuation</small>
              </UI.Metric>
              <UI.Metric>
                <h3>Alcohol</h3>
                <strong style={{ color: "#b65c3b" }}>
                  {stats.abv.toFixed(1)}
                  <small> %</small>
                </strong>
                <UI.Track $percent={stats.abv * 10} $color="#b65c3b" />
                <small>ABV · estimated</small>
              </UI.Metric>
              <UI.Metric>
                <h3>Bitterness</h3>
                <strong>{stats.ibu.toFixed(0)}</strong> <small>IBU</small>
                <UI.Track $percent={stats.ibu} />
                <small>Tinseth · age adjusted</small>
              </UI.Metric>
              <UI.Metric>
                <h3>Beer color</h3>
                <UI.ColorSwatch $color={stats.color} />
                <strong>{stats.srm.toFixed(1)}</strong> <small>SRM</small>
                <UI.Track $percent={stats.srm * 8} $color={stats.color} />
                <small>{stats.ebc.toFixed(1)} EBC · Morey</small>
              </UI.Metric>
              <UI.Metric>
                <h3>Water profile</h3>
                <strong style={{ fontSize: 23 }}>
                  {stats.ratio?.toFixed(1) ?? "—"}
                  <small> : 1</small>
                </strong>
                <UI.Track
                  $percent={Math.min(100, (stats.ratio ?? 0) * 50)}
                  $color="#7290b0"
                />
                <small>SO₄ : Cl · {stats.calcium.toFixed(0)} ppm Ca</small>
              </UI.Metric>
              <UI.Metric>
                <h3>Cellar coverage</h3>
                <strong style={{ color: "#35745a" }}>
                  {coverage}
                  <small> %</small>
                </strong>
                <UI.Track $percent={coverage} />
                <small>{sourcing.missing.length} items to source</small>
              </UI.Metric>
            </UI.Metrics>
          </UI.MetricBand>

          <UI.Width>
            <UI.WorkspaceHead>
              <UI.Row $gap={8}>
                <UI.Eyebrow>FORMULATION WORKBENCH</UI.Eyebrow>
                <UI.Badge>
                  {isSample
                    ? "Sample cellar"
                    : store.inventorySource === "brewfather"
                      ? "Brewfather cellar"
                      : "Local cellar"}
                </UI.Badge>
              </UI.Row>
              <UI.Row $gap={12}>
                <UI.IconButton
                  title="Undo last applied suggestion"
                  aria-label="Undo last applied suggestion"
                  disabled={!previous}
                  onClick={() => {
                    if (previous) {
                      store.setRecipe(previous);
                      setPrevious(null);
                      setToast("Previous recipe restored.");
                    }
                  }}
                >
                  <Undo2 size={15} />
                </UI.IconButton>
                <UI.Segment aria-label="Builder mode">
                  <UI.SegmentButton
                    $active={!manual}
                    onClick={() => setManual(false)}
                  >
                    <Sparkles size={13} />
                    AI assisted
                  </UI.SegmentButton>
                  <UI.SegmentButton
                    $active={manual}
                    onClick={() => setManual(true)}
                  >
                    <Settings2 size={13} />
                    Manual
                  </UI.SegmentButton>
                </UI.Segment>
              </UI.Row>
            </UI.WorkspaceHead>
            <UI.Workspace $manual={manual}>
              {!manual && (
                <UI.Assistant>
                  <UI.AssistantHead>
                    <UI.Row $gap={10}>
                      <UI.Mark
                        style={{
                          width: 32,
                          height: 32,
                          background: "transparent",
                          color: "#b65c3b",
                          border: "1px solid #b65c3b30",
                        }}
                      >
                        <Sparkles size={17} />
                      </UI.Mark>
                      <div>
                        <h2>Your AI co-brewer</h2>
                        <small>Inventory-first formulation</small>
                      </div>
                    </UI.Row>
                    <UI.Badge
                      $tone={aiConfigured && user ? "green" : undefined}
                    >
                      <UI.Dot />
                      {aiConfigured && user ? "Connected" : "Not connected"}
                    </UI.Badge>
                  </UI.AssistantHead>
                  <UI.AssistantBody>
                    <UI.AssistantIntro>
                      <UI.Eyebrow>RECIPE NOTES / 001</UI.Eyebrow>
                      <h3>
                        Citra, Mosaic,
                        <br />
                        and a softer finish.
                      </h3>
                      <p>
                        A tropical hop pairing with a pillowy oat backbone.
                        Here’s where your current formulation stands.
                      </p>
                    </UI.AssistantIntro>
                    <UI.Insight>
                      <h3>
                        <Package size={14} color="#35745a" />
                        Cellar match{" "}
                        <UI.Badge $tone="green">{coverage}%</UI.Badge>
                      </h3>
                      {recipe.grains.slice(0, 3).map((grain) => (
                        <UI.MatchLine key={grain.id}>
                          <span>{grain.name}</span>
                          <span>
                            {stockFor(grain.name, "grain").enough ? (
                              <Check size={11} />
                            ) : (
                              <ShoppingBasket size={11} />
                            )}{" "}
                            {(grain.kg * weightFactor).toFixed(2)} {grainUnit}
                          </span>
                        </UI.MatchLine>
                      ))}
                      <p style={{ marginTop: 12 }}>
                        {sourcing.missing.length ? (
                          <>
                            <strong>
                              {sourcing.missing.length} ingredients need topping
                              up.
                            </strong>{" "}
                            {sourcing.missing
                              .map((item) => item.name)
                              .join(" and ")}{" "}
                            are short in your {isSample ? "sample" : "current"}{" "}
                            cellar.
                          </>
                        ) : (
                          <strong>Everything is already in your cellar.</strong>
                        )}
                      </p>
                    </UI.Insight>
                    <UI.Insight>
                      <h3>
                        <Droplets size={14} color="#516d92" />
                        Water & mouthfeel
                      </h3>
                      <p>
                        <strong>
                          {stats.chloride.toFixed(0)} ppm chloride /{" "}
                          {stats.sulfate.toFixed(0)} ppm sulfate.
                        </strong>{" "}
                        {stats.chloride > stats.sulfate
                          ? "A chloride-led profile supports a rounder, softer perception."
                          : "A sulfate-led profile supports a crisper bitterness."}
                      </p>
                      <UI.Row style={{ marginTop: 11 }}>
                        <UI.Badge>Ca {stats.calcium.toFixed(0)}</UI.Badge>
                        <UI.Badge>
                          SO₄:Cl {stats.ratio?.toFixed(2) ?? "N/A"}
                        </UI.Badge>
                        <UI.Badge>{recipe.mashC}°C mash</UI.Badge>
                      </UI.Row>
                    </UI.Insight>
                    <UI.Insight>
                      <h3>
                        <ShoppingBasket size={14} color="#b65c3b" />
                        One supplier. One delivery.
                      </h3>
                      {best ? (
                        <>
                          <p>
                            <strong>{best.supplier.name}</strong> covers all{" "}
                            {sourcing.missing.length} shortages for{" "}
                            <strong>
                              {money(best.total, best.supplier.currency)}
                            </strong>
                            , including delivery.
                          </p>
                          <UI.Button
                            $small
                            onClick={() => openModal("cart")}
                            style={{ marginTop: 13 }}
                          >
                            Review basket
                            <ArrowRight size={12} />
                          </UI.Button>
                        </>
                      ) : (
                        <p>
                          {sourcing.status === "in-stock"
                            ? "No shopping needed for this recipe."
                            : "No single stockist covers every shortage. Update supplier catalogs or enable substitutions."}
                        </p>
                      )}
                    </UI.Insight>
                    {store.messages.map((message) => (
                      <UI.Message
                        key={message.id}
                        $user={message.role === "user"}
                      >
                        <h4>
                          {message.role === "user" ? (
                            <Beaker size={12} />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          {message.role === "user" ? "YOU" : "CO-BREWER"}
                        </h4>
                        <p>{message.content}</p>
                        {message.proposal && (
                          <UI.Button
                            $small
                            $primary
                            onClick={() => applyRecipe(message.proposal!)}
                            style={{ marginTop: 12 }}
                          >
                            <CheckCheck size={13} />
                            Apply recipe changes
                          </UI.Button>
                        )}
                      </UI.Message>
                    ))}
                    {busy && !modal && (
                      <UI.Message>
                        <UI.Row>
                          <LoaderCircle size={14} />
                          <UI.Mono>Formulating…</UI.Mono>
                        </UI.Row>
                      </UI.Message>
                    )}
                    <div ref={chatEnd} />
                  </UI.AssistantBody>
                  <UI.Composer
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendPrompt();
                    }}
                  >
                    <textarea
                      aria-label="Message to AI co-brewer"
                      placeholder="A little more tropical. A little less bitter…"
                      value={prompt}
                      maxLength={4000}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendPrompt();
                        }
                      }}
                    />
                    <UI.Row $between>
                      <UI.Mono style={{ color: "#74808b", fontSize: 9 }}>
                        {!user
                          ? "Sign in to connect your co-brewer"
                          : !aiConfigured
                            ? "AI provider not configured"
                            : "OpenAI · recipe tools"}
                      </UI.Mono>
                      <UI.Button
                        $small
                        $primary
                        type="submit"
                        disabled={busy || !prompt.trim() || !online}
                        aria-label="Send message"
                        title="Send message"
                      >
                        <Send size={13} />
                      </UI.Button>
                    </UI.Row>
                  </UI.Composer>
                </UI.Assistant>
              )}
              <UI.Canvas>
                <UI.Tabs role="tablist" aria-label="Recipe sections">
                  {[
                    { key: "grains", label: "Fermentables", icon: Wheat },
                    { key: "hops", label: "Hops & additions", icon: Hop },
                    { key: "yeast", label: "Yeast & mash", icon: FlaskConical },
                    { key: "water", label: "Water", icon: Droplets },
                  ].map(({ key, label, icon: Icon }) => (
                    <UI.Tab
                      key={key}
                      role="tab"
                      aria-selected={activeTab === key}
                      $active={activeTab === key}
                      onClick={() => scrollTo(key)}
                    >
                      <Icon size={13} />
                      {label}
                    </UI.Tab>
                  ))}
                </UI.Tabs>
                <UI.Section id="grains">
                  <UI.SectionHead>
                    <UI.Row $gap={10}>
                      <UI.SectionNumber>01</UI.SectionNumber>
                      <div>
                        <h2>Fermentables & grain</h2>
                        <p>
                          THE FOUNDATION / {stats.grainKg.toFixed(2)} KG TOTAL
                        </p>
                      </div>
                    </UI.Row>
                    <UI.Button
                      $small
                      onClick={() => openModal("grain")}
                      disabled={recipe.grains.length >= 40}
                    >
                      <Plus size={13} />
                      Add grain
                    </UI.Button>
                  </UI.SectionHead>
                  <UI.TableScroll>
                    <UI.Table>
                      <thead>
                        <tr>
                          <th>Fermentable</th>
                          <th>Weight ({grainUnit})</th>
                          <th>Bill</th>
                          <th>°L</th>
                          <th>Availability</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.grains.map((grain) => (
                          <tr key={grain.id}>
                            <td>
                              <strong>{grain.name}</strong>
                              <small>{grain.ppg} PPG · Grain</small>
                            </td>
                            <td>
                              <Numeric
                                label={`${grain.name} weight`}
                                value={grain.kg * weightFactor}
                                max={1000 * weightFactor}
                                step={0.1}
                                onChange={(value) =>
                                  updateGrain(grain.id, {
                                    kg: value / weightFactor,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <UI.Mono>
                                {stats.grainKg
                                  ? ((grain.kg / stats.grainKg) * 100).toFixed(
                                      1,
                                    )
                                  : "0"}
                                %
                              </UI.Mono>
                            </td>
                            <td>
                              <Numeric
                                label={`${grain.name} Lovibond`}
                                value={grain.color}
                                max={600}
                                step={0.1}
                                onChange={(value) =>
                                  updateGrain(grain.id, { color: value })
                                }
                              />
                            </td>
                            <td>
                              <Stock name={grain.name} kind="grain" />
                            </td>
                            <td>
                              <UI.IconButton
                                aria-label={`Remove ${grain.name}`}
                                title={`Remove ${grain.name}`}
                                disabled={recipe.grains.length <= 1}
                                onClick={() =>
                                  store.updateRecipe({
                                    grains: recipe.grains.filter(
                                      (item) => item.id !== grain.id,
                                    ),
                                  })
                                }
                              >
                                <X size={13} />
                              </UI.IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </UI.Table>
                  </UI.TableScroll>
                  <UI.SectionFoot>
                    <span>
                      ALL GRAIN · {recipe.efficiency}% BREWHOUSE EFFICIENCY
                    </span>
                    <span>
                      TOTAL {(stats.grainKg * weightFactor).toFixed(2)}{" "}
                      {grainUnit.toUpperCase()}
                    </span>
                  </UI.SectionFoot>
                </UI.Section>
                <UI.Section id="hops">
                  <UI.SectionHead>
                    <UI.Row $gap={10}>
                      <UI.SectionNumber>02</UI.SectionNumber>
                      <div>
                        <h2>Hops & aroma</h2>
                        <p>
                          THE EXPRESSION /{" "}
                          {(stats.hopGrams * hopFactor).toFixed(0)}{" "}
                          {hopUnit.toUpperCase()} TOTAL
                        </p>
                      </div>
                    </UI.Row>
                    <UI.Button
                      $small
                      onClick={() => openModal("hop")}
                      disabled={recipe.hops.length >= 40}
                    >
                      <Plus size={13} />
                      Add hop
                    </UI.Button>
                  </UI.SectionHead>
                  <UI.TableScroll>
                    <UI.Table>
                      <thead>
                        <tr>
                          <th>Hop variety</th>
                          <th>Amount ({hopUnit})</th>
                          <th>AA %</th>
                          <th>Addition</th>
                          <th>Min</th>
                          <th>Availability</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.hops.map((hop) => (
                          <tr key={hop.id}>
                            <td>
                              <strong>{hop.name}</strong>
                              <small>
                                Pellet ·{" "}
                                {hop.ageMonths
                                  ? `${hop.ageMonths} mo stored`
                                  : "Fresh alpha"}
                              </small>
                            </td>
                            <td>
                              <Numeric
                                label={`${hop.name} ${hop.use} amount`}
                                value={hop.grams * hopFactor}
                                step={units === "imperial" ? 0.1 : 5}
                                max={50000 * hopFactor}
                                onChange={(value) =>
                                  updateHop(hop.id, {
                                    grams: value / hopFactor,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <Numeric
                                label={`${hop.name} ${hop.use} alpha acid`}
                                value={hop.alpha}
                                max={30}
                                step={0.1}
                                onChange={(value) =>
                                  updateHop(hop.id, { alpha: value })
                                }
                              />
                            </td>
                            <td>
                              <select
                                aria-label={`${hop.name} addition type`}
                                value={hop.use}
                                onChange={(event) =>
                                  updateHop(hop.id, {
                                    use: event.target
                                      .value as HopIngredient["use"],
                                  })
                                }
                              >
                                <option value="boil">Boil</option>
                                <option value="whirlpool">Whirlpool</option>
                                <option value="dry hop">Dry hop</option>
                              </select>
                            </td>
                            <td>
                              <Numeric
                                label={`${hop.name} ${hop.use} minutes`}
                                value={hop.minutes}
                                max={180}
                                onChange={(value) =>
                                  updateHop(hop.id, { minutes: value })
                                }
                              />
                            </td>
                            <td>
                              <Stock name={hop.name} kind="hop" />
                            </td>
                            <td>
                              <UI.IconButton
                                aria-label={`Remove ${hop.name} ${hop.use}`}
                                title="Remove addition"
                                onClick={() =>
                                  store.updateRecipe({
                                    hops: recipe.hops.filter(
                                      (item) => item.id !== hop.id,
                                    ),
                                  })
                                }
                              >
                                <X size={13} />
                              </UI.IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </UI.Table>
                  </UI.TableScroll>
                  {!recipe.hops.length && (
                    <UI.Empty>
                      <Hop size={25} />
                      <h3>No hop additions</h3>
                      <UI.Button $small onClick={() => openModal("hop")}>
                        <Plus size={13} />
                        Add hop
                      </UI.Button>
                    </UI.Empty>
                  )}
                  <UI.SectionFoot>
                    <span>
                      WHIRLPOOL UTILIZATION EST. 25% · STORAGE LOSS EST. 5% /
                      MONTH
                    </span>
                    <span>{stats.ibu.toFixed(1)} IBU</span>
                  </UI.SectionFoot>
                </UI.Section>
                <UI.Pair>
                  <UI.Section id="yeast">
                    <UI.SectionHead>
                      <UI.Row>
                        <UI.SectionNumber>03</UI.SectionNumber>
                        <div>
                          <h2>Yeast & mash profile</h2>
                          <p>THE TRANSFORMATION</p>
                        </div>
                      </UI.Row>
                      <FlaskConical size={15} color="#74808b" />
                    </UI.SectionHead>
                    <UI.Fields>
                      <UI.Field style={{ gridColumn: "1 / -1" }}>
                        Yeast strain
                        <select
                          value={recipe.yeast}
                          onChange={(event) => {
                            const yeast = event.target.value;
                            store.updateRecipe({
                              yeast,
                              attenuation: yeast.includes("Kveik")
                                ? 82
                                : yeast === "US-05"
                                  ? 81
                                  : 79,
                            });
                          }}
                        >
                          <option>London Ale III</option>
                          <option>US-05</option>
                          <option>Lutra Kveik</option>
                          <option>W-34/70</option>
                          {![
                            "London Ale III",
                            "US-05",
                            "Lutra Kveik",
                            "W-34/70",
                          ].includes(recipe.yeast) && (
                            <option>{recipe.yeast}</option>
                          )}
                        </select>
                      </UI.Field>
                      <UI.Field>
                        Attenuation (%)
                        <Numeric
                          label="Yeast attenuation"
                          min={1}
                          max={100}
                          value={recipe.attenuation}
                          onChange={(value) =>
                            store.updateRecipe({ attenuation: value })
                          }
                        />
                      </UI.Field>
                      <UI.Field>
                        Mash temperature (°C)
                        <Numeric
                          label="Mash temperature"
                          min={45}
                          max={80}
                          value={recipe.mashC}
                          step={0.5}
                          onChange={(value) =>
                            store.updateRecipe({ mashC: value })
                          }
                        />
                      </UI.Field>
                    </UI.Fields>
                    <UI.SectionFoot>
                      <span>SINGLE INFUSION · 60 MIN</span>
                      <span>{stats.fg.toFixed(3)} EST. FG</span>
                    </UI.SectionFoot>
                  </UI.Section>
                  <UI.Section id="water">
                    <UI.SectionHead>
                      <UI.Row>
                        <UI.SectionNumber>04</UI.SectionNumber>
                        <div>
                          <h2>Water chemistry</h2>
                          <p>THE BALANCE / DIHYDRATE CaCl₂</p>
                        </div>
                      </UI.Row>
                      <Droplets size={15} color="#74808b" />
                    </UI.SectionHead>
                    <UI.Fields>
                      <UI.Field>
                        Gypsum (g)
                        <Numeric
                          label="Gypsum grams"
                          value={recipe.water.gypsum}
                          max={500}
                          step={0.1}
                          onChange={(value) =>
                            store.updateRecipe({
                              water: { ...recipe.water, gypsum: value },
                            })
                          }
                        />
                      </UI.Field>
                      <UI.Field>
                        Calcium chloride (g)
                        <Numeric
                          label="Calcium chloride grams"
                          value={recipe.water.calciumChloride}
                          max={500}
                          step={0.1}
                          onChange={(value) =>
                            store.updateRecipe({
                              water: {
                                ...recipe.water,
                                calciumChloride: value,
                              },
                            })
                          }
                        />
                      </UI.Field>
                    </UI.Fields>
                    <UI.WaterStats>
                      <div>
                        <strong>{stats.calcium.toFixed(0)}</strong>
                        <small>Ca · ppm</small>
                      </div>
                      <div>
                        <strong>{stats.sulfate.toFixed(0)}</strong>
                        <small>SO₄ · ppm</small>
                      </div>
                      <div>
                        <strong>{stats.chloride.toFixed(0)}</strong>
                        <small>Cl · ppm</small>
                      </div>
                    </UI.WaterStats>
                    <UI.SectionFoot>
                      <span>
                        BASE: Ca {recipe.water.calcium} · SO₄{" "}
                        {recipe.water.sulfate} · Cl {recipe.water.chloride}
                      </span>
                      <UI.IconButton
                        style={{ height: 18, width: 20 }}
                        aria-label="Edit source water"
                        title="Edit source water"
                        onClick={() => openModal("equipment")}
                      >
                        <Settings2 size={12} />
                      </UI.IconButton>
                    </UI.SectionFoot>
                  </UI.Section>
                </UI.Pair>
                <UI.Sourcing>
                  <UI.Row $gap={12}>
                    <ShoppingBasket size={23} strokeWidth={1.5} />
                    <div>
                      <h3>
                        {sourcing.status === "in-stock"
                          ? "Your cellar has you covered."
                          : best
                            ? "Everything else, from one stockist."
                            : "A few ingredients still need sourcing."}
                      </h3>
                      <p>
                        {best
                          ? `${best.supplier.name} · ${sourcing.missing.length} items · ${money(best.total, best.supplier.currency)} delivered`
                          : sourcing.status === "in-stock"
                            ? "No extra ingredients needed."
                            : "No complete single-supplier match in your catalogs."}
                      </p>
                    </div>
                  </UI.Row>
                  <UI.Button
                    $small
                    onClick={() =>
                      best ? openModal("cart") : setView("sourcing")
                    }
                  >
                    {best ? "Review basket" : "View stockists"}
                    <ArrowRight size={13} />
                  </UI.Button>
                </UI.Sourcing>
                <UI.Row $between $wrap>
                  <UI.Mono style={{ color: "#74808b", fontSize: 9 }}>
                    <Cloud size={12} />{" "}
                    {hasStorageFailure()
                      ? "DEVICE STORAGE UNAVAILABLE"
                      : "LOCAL DRAFT · STORED ON THIS DEVICE"}
                  </UI.Mono>
                  <UI.Row>
                    <UI.Mono style={{ color: "#74808b", fontSize: 9 }}>
                      UNITS
                    </UI.Mono>
                    <UI.Segment>
                      <UI.SegmentButton
                        $active={units === "metric"}
                        onClick={() => store.setUnits("metric")}
                      >
                        Metric
                      </UI.SegmentButton>
                      <UI.SegmentButton
                        $active={units === "imperial"}
                        onClick={() => store.setUnits("imperial")}
                      >
                        Imperial
                      </UI.SegmentButton>
                    </UI.Segment>
                  </UI.Row>
                </UI.Row>
              </UI.Canvas>
            </UI.Workspace>
          </UI.Width>
        </UI.Fade>
      ) : (
        <UI.Width>
          <UI.Fade>
            <UI.ViewTitle>
              <UI.Row $between $wrap>
                <div>
                  <UI.Eyebrow style={{ marginBottom: 7 }}>
                    BrewLab.ai /{" "}
                    {view === "inventory"
                      ? "THE CELLAR"
                      : view === "sourcing"
                        ? "THE SUPPLY CHAIN"
                        : "THE NOTEBOOK"}
                  </UI.Eyebrow>
                  <h1>
                    {view === "inventory"
                      ? "My inventory"
                      : view === "sourcing"
                        ? "Your stockists"
                        : "Recipe library"}
                  </h1>
                  <p>
                    {view === "inventory"
                      ? `${inventory.length} ingredients · ${isSample ? "Sample inventory" : store.inventorySource === "brewfather" ? "Brewfather inventory" : "Local inventory"}`
                      : view === "sourcing"
                        ? `${suppliers.length} saved stockists · Catalog prices, not live quotes`
                        : `${store.savedRecipes.length} locally saved recipes`}
                  </p>
                </div>
                <UI.Row $wrap>
                  {view === "inventory" ? (
                    <>
                      {user && <UI.Button onClick={saveInventory} disabled={!online}>
                        <Save size={14} />Save inventory
                      </UI.Button>}
                      <UI.Button onClick={() => openModal("inventory")}>
                        <Plus size={14} />
                        Add ingredient
                      </UI.Button>
                      <UI.Button $primary onClick={() => openModal("sync")}>
                        <RefreshCw size={14} />
                        Sync Brewfather
                      </UI.Button>
                    </>
                  ) : view === "sourcing" ? (
                    <UI.Button $primary onClick={() => openModal("supplier")}>
                      <Plus size={14} />
                      Add stockist
                    </UI.Button>
                  ) : (
                    <>
                      <UI.Button onClick={() => importInput.current?.click()}>
                        <Upload size={14} />
                        Import JSON
                      </UI.Button>
                      <UI.Button
                        $primary
                        onClick={() => {
                          store.setRecipe({
                            ...recipe,
                            name: "Untitled recipe",
                            grains: [{ id: id(), name: "Pilsner Malt", kg: 4.5, color: 1.7, ppg: 37 }],
                            hops: [],
                          });
                          setView("studio");
                        }}
                      >
                        <Plus size={14} />
                        New draft
                      </UI.Button>
                    </>
                  )}
                </UI.Row>
              </UI.Row>
            </UI.ViewTitle>
            {view === "inventory" && (
              <>
                <UI.Row $between $wrap style={{ marginBottom: 20 }}>
                  <input
                    aria-label="Search inventory"
                    placeholder="Search ingredients…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <UI.Row $wrap>
                    {["all", "grain", "hop", "yeast", "salt"].map((filter) => (
                      <UI.Button
                        $small
                        $primary={inventoryFilter === filter}
                        key={filter}
                        onClick={() => setInventoryFilter(filter)}
                      >
                        {filter === "all"
                          ? "All ingredients"
                          : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </UI.Button>
                    ))}
                  </UI.Row>
                </UI.Row>
                <UI.Section>
                  <UI.TableScroll>
                    <UI.Table>
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Unit</th>
                          <th>Lot / AA</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.name}</strong>
                            </td>
                            <td>{item.kind}</td>
                            <td>
                              <Numeric
                                label={`${item.name} inventory quantity`}
                                value={item.quantity}
                                max={1000000}
                                step={item.unit === "kg" ? 0.1 : 1}
                                onChange={(quantity) =>
                                  store.setInventory(
                                    inventory.map((stock) =>
                                      stock.id === item.id
                                        ? { ...stock, quantity }
                                        : stock,
                                    ),
                                    "manual",
                                  )
                                }
                              />
                            </td>
                            <td>{item.unit}</td>
                            <td>
                              {item.alpha
                                ? `${item.alpha}% AA`
                                : item.lot || "—"}
                            </td>
                            <td>
                              <UI.IconButton
                                title="Remove inventory item"
                                aria-label={`Remove ${item.name} from inventory`}
                                onClick={() =>
                                  store.setInventory(
                                    inventory.filter(
                                      (stock) => stock.id !== item.id,
                                    ),
                                    "manual",
                                  )
                                }
                              >
                                <Trash2 size={13} />
                              </UI.IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </UI.Table>
                  </UI.TableScroll>
                  {!filteredInventory.length && (
                    <UI.Empty>
                      <Package size={28} />
                      <h3>No ingredients found</h3>
                      <p>
                        {search
                          ? "No matches in this cellar."
                          : "Your cellar is empty."}
                      </p>
                      <UI.Button onClick={() => openModal("inventory")}>
                        <Plus size={14} />
                        Add ingredient
                      </UI.Button>
                    </UI.Empty>
                  )}
                </UI.Section>
              </>
            )}
            {view === "sourcing" && (
              <>
                <UI.Row $between $wrap>
                  <UI.Badge $tone="green">
                    <Package size={12} />
                    {coverage}% from your cellar
                  </UI.Badge>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allowSubs}
                      onChange={(event) => setAllowSubs(event.target.checked)}
                    />
                    Allow catalog substitutions
                  </label>
                </UI.Row>
                <UI.SupplierList>
                  {suppliers.map((supplier) => {
                    const match = sourcing.options.find(
                      (option) => option.supplier.id === supplier.id,
                    );
                    return (
                      <UI.SupplierItem key={supplier.id}>
                        <UI.Row $between>
                          <ShoppingBasket size={21} color="#b65c3b" />
                          <UI.Badge $tone={match ? "green" : undefined}>
                            {match
                              ? "Complete match"
                              : sourcing.status === "in-stock"
                                ? "No purchase needed"
                                : "Incomplete basket"}
                          </UI.Badge>
                        </UI.Row>
                        <h3>{supplier.name}</h3>
                        <p>
                          {supplier.products.length} catalog products ·{" "}
                          {money(supplier.shipping, supplier.currency)} delivery
                        </p>
                        <UI.Row $between $wrap>
                          <a
                            href={supplier.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <UI.Mono>
                              Visit stockist <ArrowUpRight size={12} />
                            </UI.Mono>
                          </a>
                          <UI.Row>
                            {user && <UI.IconButton
                              aria-label={`Refresh ${supplier.name} catalog`}
                              title="Refresh approved API feed"
                              disabled={!online}
                              onClick={() => refreshSupplier(supplier.id)}
                            ><RefreshCw size={13} /></UI.IconButton>}
                            <UI.IconButton
                              aria-label={`Remove ${supplier.name}`}
                              title="Remove stockist"
                              onClick={async () => {
                                try {
                                  if (user)
                                    await api(
                                      `/api/suppliers?id=${encodeURIComponent(supplier.id)}`,
                                      "DELETE",
                                    );
                                  store.setSuppliers(
                                    suppliers.filter(
                                      (item) => item.id !== supplier.id,
                                    ),
                                  );
                                } catch (cause) {
                                  setToast(
                                    cause instanceof Error
                                      ? cause.message
                                      : "Could not remove stockist.",
                                  );
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </UI.IconButton>
                            {match && (
                              <UI.Button
                                $small
                                onClick={() => {
                                  setSupplierChoice(supplier.id);
                                  openModal("cart");
                                }}
                              >
                                {money(match.total, supplier.currency)}
                                <ArrowRight size={12} />
                              </UI.Button>
                            )}
                          </UI.Row>
                        </UI.Row>
                      </UI.SupplierItem>
                    );
                  })}
                </UI.SupplierList>
                {!suppliers.length && (
                  <UI.Empty>
                    <ShoppingBasket size={28} />
                    <h3>No saved stockists</h3>
                    <UI.Button onClick={() => openModal("supplier")}>
                      <Plus size={14} />
                      Add stockist
                    </UI.Button>
                  </UI.Empty>
                )}
                <UI.Sourcing>
                  <div>
                    <h3>
                      {sourcing.status === "in-stock"
                        ? "No shopping required."
                        : best
                          ? `Best complete basket: ${best.supplier.name}`
                          : "No single-supplier match yet."}
                    </h3>
                    <p>
                      {best
                        ? `${money(best.total, best.supplier.currency)} including delivery · ${best.lines.length} ingredients`
                        : "Every missing ingredient must be available from the same stockist."}
                    </p>
                  </div>
                  {best && (
                    <UI.Button
                      onClick={() => {
                        setSupplierChoice(best.supplier.id);
                        openModal("cart");
                      }}
                    >
                      Review basket
                      <ArrowRight size={13} />
                    </UI.Button>
                  )}
                </UI.Sourcing>
              </>
            )}
            {view === "recipes" && (
              <>
                {store.savedRecipes.length ? (
                  <UI.SupplierList>
                    {store.savedRecipes.map((saved) => {
                      const metrics = calculateRecipe(saved.recipe);
                      return (
                        <UI.SupplierItem key={saved.id}>
                          <UI.Row $between>
                            <UI.Badge>{saved.recipe.style}</UI.Badge>
                            <UI.IconButton
                              title="Delete saved recipe"
                              aria-label={`Delete ${saved.recipe.name}`}
                              onClick={() => deleteSavedRecipe(saved.id)}
                            >
                              <Trash2 size={13} />
                            </UI.IconButton>
                          </UI.Row>
                          <h3>{saved.recipe.name}</h3>
                          <p>
                            {metrics.abv.toFixed(1)}% ABV ·{" "}
                            {metrics.ibu.toFixed(0)} IBU ·{" "}
                            {saved.recipe.batchLiters} L ·{" "}
                            {new Date(saved.date).toLocaleDateString()}
                          </p>
                          <UI.Button
                            $small
                            onClick={() => {
                              applyRecipe(saved.recipe);
                              setView("studio");
                            }}
                          >
                            <FolderOpen size={13} />
                            Open recipe
                          </UI.Button>
                        </UI.SupplierItem>
                      );
                    })}
                  </UI.SupplierList>
                ) : (
                  <UI.Empty>
                    <BookOpen size={32} strokeWidth={1} />
                    <h3>Your notebook is open.</h3>
                    <p>No saved recipes yet.</p>
                    <UI.Button onClick={() => setView("studio")}>
                      <FlaskConical size={14} />
                      Back to recipe studio
                    </UI.Button>
                  </UI.Empty>
                )}
              </>
            )}
          </UI.Fade>
        </UI.Width>
      )}

      <UI.Footer style={{ marginTop: view === "studio" ? 0 : 40 }}>
        <UI.Width>
          <UI.Row $between $wrap>
            <UI.Row $gap={8}>
              <Wheat size={13} />
              <span>BrewLab.ai / MADE FOR THE NEXT GOOD BATCH.</span>
            </UI.Row>
            <UI.Row $gap={14}>
              <span>{isSample ? "SAMPLE DATA" : "PERSONAL WORKSPACE"}</span>
              <UI.IconButton
                style={{ width: 22, height: 22 }}
                aria-label="About BrewLab.ai"
                title="About BrewLab.ai"
                onClick={() => openModal("help")}
              >
                <CircleHelp size={13} />
              </UI.IconButton>
            </UI.Row>
          </UI.Row>
        </UI.Width>
      </UI.Footer>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 100000)
              throw new Error("Recipe files must be smaller than 100 KB.");
            const recipe = recipeSchema.parse(JSON.parse(await file.text()));
            applyRecipe(recipe);
            setView("studio");
          } catch {
            setToast(
              "Import failed. Choose a BrewLab.ai recipe JSON file under 100 KB.",
            );
          }
          event.target.value = "";
        }}
      />
      <UI.Dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClose={() => setModal(null)}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const bounds = dialog.current.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              setModal(null);
          }
        }}
        aria-labelledby="dialog-title"
      >
        <UI.SectionHead>
          <h2 id="dialog-title">{title}</h2>
          <UI.IconButton
            aria-label="Close dialog"
            title="Close"
            onClick={() => setModal(null)}
          >
            <X size={17} />
          </UI.IconButton>
        </UI.SectionHead>
        <UI.DialogBody>
          {(modal === "grain" || modal === "hop") && (
            <form onSubmit={handleForm}>
              <UI.Field>
                {modal === "grain" ? "Fermentable" : "Hop variety"}
                <select name="name">
                  {(modal === "grain" ? grainCatalog : hopCatalog).map(
                    (item) => (
                      <option key={item.name}>{item.name}</option>
                    ),
                  )}
                </select>
              </UI.Field>
              <UI.Field>
                Amount ({modal === "grain" ? grainUnit : hopUnit})
                <input
                  name="quantity"
                  type="number"
                  required
                  min="0.01"
                  max={modal === "grain" ? 1000 : 50000}
                  step="0.01"
                  defaultValue={modal === "grain" ? 0.5 : 25}
                />
              </UI.Field>
              {modal === "hop" && (
                <>
                  <UI.Field>
                    Addition
                    <select name="use">
                      <option value="boil">Boil</option>
                      <option value="whirlpool">Whirlpool</option>
                      <option value="dry hop">Dry hop</option>
                    </select>
                  </UI.Field>
                  <UI.Field>
                    Contact time (minutes)
                    <input
                      name="minutes"
                      required
                      type="number"
                      min="0"
                      max="180"
                      defaultValue="20"
                    />
                  </UI.Field>
                  <UI.Field>
                    Age in storage (months)
                    <input
                      name="age"
                      required
                      type="number"
                      min="0"
                      max="120"
                      defaultValue="0"
                    />
                  </UI.Field>
                </>
              )}
              <UI.Button $primary disabled={busy}>
                <Plus size={14} />
                Add to recipe
              </UI.Button>
            </form>
          )}
          {modal === "equipment" && (
            <form onSubmit={handleForm}>
              <UI.Field>
                Recipe name
                <input
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={recipe.name}
                />
              </UI.Field>
              <UI.Field>
                BJCP style
                <select name="style" defaultValue={recipe.style}>
                  {[
                    ...new Set([
                      recipe.style,
                      "21C · Hazy IPA",
                      "22A · Double IPA",
                      "21A · American IPA",
                      "3D · Czech Dark Lager",
                      "1D · American Wheat Beer",
                      "20B · American Stout",
                      "5D · German Pils",
                    ]),
                  ].map((style) => (
                    <option key={style}>{style}</option>
                  ))}
                </select>
              </UI.Field>
              <UI.Fields style={{ padding: 0 }}>
                {[
                  {
                    name: "volume",
                    label: `Batch volume (${units === "imperial" ? "gal" : "L"})`,
                    value:
                      recipe.batchLiters / (units === "imperial" ? 3.78541 : 1),
                    min: 1,
                    max: 1000,
                  },
                  {
                    name: "efficiency",
                    label: "Efficiency (%)",
                    value: recipe.efficiency,
                    min: 1,
                    max: 100,
                  },
                  {
                    name: "mashTun",
                    label: "Mash tun volume (L)",
                    value: recipe.mashTunLiters,
                    min: 1,
                    max: 2000,
                  },
                  {
                    name: "boilOff",
                    label: "Boil-off rate (L/hr)",
                    value: recipe.boilOff,
                    min: 0,
                    max: 20,
                  },
                  {
                    name: "boilMinutes",
                    label: "Boil duration (min)",
                    value: recipe.boilMinutes,
                    min: 0,
                    max: 180,
                  },
                  {
                    name: "calcium",
                    label: "Source water Ca (ppm)",
                    value: recipe.water.calcium,
                    min: 0,
                    max: 500,
                  },
                  {
                    name: "sulfate",
                    label: "Source water SO₄ (ppm)",
                    value: recipe.water.sulfate,
                    min: 0,
                    max: 1000,
                  },
                  {
                    name: "chloride",
                    label: "Source water Cl (ppm)",
                    value: recipe.water.chloride,
                    min: 0,
                    max: 1000,
                  },
                ].map((field) => (
                  <UI.Field key={field.name}>
                    {field.label}
                    <input
                      name={field.name}
                      required
                      type="number"
                      min={field.min}
                      max={field.max}
                      step="0.1"
                      defaultValue={Number(field.value.toFixed(2))}
                    />
                  </UI.Field>
                ))}
              </UI.Fields>
              <UI.Button $primary>
                <Check size={14} />
                Apply settings
              </UI.Button>
            </form>
          )}
          {modal === "inventory" && (
            <form onSubmit={handleForm}>
              <UI.Field>
                Ingredient name
                <input
                  name="name"
                  required
                  maxLength={160}
                  list="ingredient-names"
                />
                <datalist id="ingredient-names">
                  {[
                    ...grainCatalog,
                    ...hopCatalog,
                    { name: "London Ale III" },
                    { name: "Gypsum" },
                    { name: "Calcium chloride" },
                  ].map((item) => (
                    <option key={item.name} value={item.name} />
                  ))}
                </datalist>
              </UI.Field>
              <UI.Field>
                Category
                <select name="kind">
                  <option value="grain">Grain (kg)</option>
                  <option value="hop">Hop (g)</option>
                  <option value="yeast">Yeast (packs)</option>
                  <option value="salt">Water salt (g)</option>
                </select>
              </UI.Field>
              <UI.Field>
                Quantity
                <input
                  name="quantity"
                  required
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  defaultValue="1"
                />
              </UI.Field>
              <UI.Button $primary>
                <Plus size={14} />
                Add to cellar
              </UI.Button>
            </form>
          )}
          {modal === "supplier" && (
            <form onSubmit={handleForm}>
              <UI.Field>
                Stockist name
                <input name="name" required maxLength={160} />
              </UI.Field>
              <UI.Field>
                Website
                <input name="url" type="url" placeholder="https://" required />
              </UI.Field>
              <UI.Fields style={{ padding: 0 }}>
                <UI.Field>
                  Currency
                  <select name="currency">
                    {["GBP", "USD", "EUR", "AUD", "NZD", "CAD"].map(
                      (currency) => (
                        <option key={currency}>{currency}</option>
                      ),
                    )}
                  </select>
                </UI.Field>
                <UI.Field>
                  Delivery charge
                  <input
                    name="shipping"
                    type="number"
                    min="0"
                    max="1000"
                    step="0.01"
                    defaultValue="5.99"
                    required
                  />
                </UI.Field>
              </UI.Fields>
              <UI.Field>
                Product catalog (JSON)
                <textarea
                  name="products"
                  required
                  defaultValue={JSON.stringify(
                    [
                      {
                        ingredient: "Citra",
                        kind: "hop",
                        packageSize: 100,
                        price: 7.25,
                        stock: 10,
                        substitutes: [],
                      },
                    ],
                    null,
                    2,
                  )}
                />
              </UI.Field>
              <UI.Button $primary disabled={busy}>
                <Plus size={14} />
                Save stockist
              </UI.Button>
            </form>
          )}
          {modal === "sync" && (
            <form onSubmit={handleForm}>
              <UI.Badge $tone={user ? "green" : "accent"}>
                {user ? "Account connected" : "Google sign-in required"}
              </UI.Badge>
              <UI.Field>
                Brewfather user ID
                <input
                  name="userId"
                  required
                  autoComplete="off"
                  maxLength={160}
                />
              </UI.Field>
              <UI.Field>
                Brewfather API key
                <input
                  name="apiKey"
                  type="password"
                  required
                  autoComplete="off"
                  maxLength={256}
                />
              </UI.Field>
              <UI.Field>
                API version
                <select name="version" defaultValue="v1">
                  <option value="v1">v1 (legacy)</option>
                  <option value="v2">v2 (recommended)</option>
                </select>
              </UI.Field>
              <UI.Button $primary disabled={busy || !user || !online}>
                {busy ? <LoaderCircle size={14} /> : <RefreshCw size={14} />}
                Sync inventory
              </UI.Button>
              {!user && (
                <UI.Button type="button" onClick={() => openModal("login")}>
                  <LogIn size={14} />
                  Sign in
                </UI.Button>
              )}
            </form>
          )}
          {modal === "login" && (
            <div style={{ display: "grid", gap: 20 }}>
              <UI.Mark style={{ width: 46, height: 46 }}>
                <Wheat size={28} />
              </UI.Mark>
              <h3 style={{ fontSize: 21 }}>
                {user
                  ? "Welcome to BrewLab.ai."
                  : "Good beer. Your recipes."}
              </h3>
              {user ? (
                <>
                  <p>{user.email}</p>
                  <UI.Button
                    onClick={async () => {
                      try {
                        await api("/api/auth/signout", "POST");
                        store.clearAccountData(null);
                        setUser(null);
                        setModal(null);
                        setToast(
                          "Signed out. Account data cleared from this device.",
                        );
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Sign-out failed.",
                        );
                      }
                    }}
                  >
                    <LogOut size={14} />
                    Sign out
                  </UI.Button>
                </>
              ) : (
                <>
                  <UI.Button
                    as="a"
                    $primary
                    href={authConfigured && online ? "/auth/login" : undefined}
                    aria-disabled={!authConfigured || !online}
                  >
                    <LogIn size={15} />
                    Continue with Google
                  </UI.Button>
                  {!authConfigured && (
                    <UI.Badge $tone="accent">
                      Supabase is not configured
                    </UI.Badge>
                  )}
                </>
              )}
            </div>
          )}
          {modal === "export" && (
            <div style={{ display: "grid", gap: 12 }}>
              {[
                {
                  label: "BeerXML",
                  extension: "xml",
                  content: () => exportBeerXML(recipe),
                  type: "application/xml",
                },
                {
                  label: "Brewfather JSON",
                  extension: "brewfather.json",
                  content: () => JSON.stringify(toBrewfather(recipe), null, 2),
                  type: "application/json",
                },
                {
                  label: "BrewLab.ai JSON",
                  extension: "json",
                  content: () => JSON.stringify(recipe, null, 2),
                  type: "application/json",
                },
              ].map((format) => (
                <UI.Button
                  key={format.label}
                  onClick={() => {
                    downloadFile(
                      `recipe.${format.extension}`,
                      format.content(),
                      format.type,
                    );
                    setToast(`${format.label} exported.`);
                  }}
                >
                  <ArrowDownToLine size={15} />
                  {format.label}
                </UI.Button>
              ))}
            </div>
          )}
          {modal === "cart" &&
            (selectedCart ? (
              <>
                <UI.Row $between $wrap style={{ marginBottom: 20 }}>
                  <div>
                    <h3>{selectedCart.supplier.name}</h3>
                    <UI.Mono>
                      {selectedCart.lines.length} items · One delivery
                    </UI.Mono>
                  </div>
                  <UI.Badge $tone="green">Complete match</UI.Badge>
                </UI.Row>
                <UI.TableScroll>
                  <UI.Table>
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Shortfall</th>
                        <th>Packages</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCart.lines.map((line) => (
                        <tr key={line.name}>
                          <td>
                            <strong>{line.product}</strong>
                            {line.substituted && <small>For {line.name}</small>}
                          </td>
                          <td>
                            {Number(line.quantity.toFixed(2))} {line.unit}
                          </td>
                          <td>
                            {line.packages} · {line.purchased}
                            {line.unit}
                          </td>
                          <td>
                            {money(line.cost, selectedCart.supplier.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </UI.Table>
                </UI.TableScroll>
                <UI.Row $between style={{ padding: "15px 0" }}>
                  <UI.Muted>Delivery</UI.Muted>
                  <UI.Mono>
                    {money(
                      selectedCart.supplier.shipping,
                      selectedCart.supplier.currency,
                    )}
                  </UI.Mono>
                </UI.Row>
                <UI.Row $between style={{ paddingBottom: 22 }}>
                  <strong>Total</strong>
                  <strong>
                    {money(selectedCart.total, selectedCart.supplier.currency)}
                  </strong>
                </UI.Row>
                <UI.Button $primary onClick={exportCart}>
                  <ArrowDownToLine size={14} />
                  Export shopping list
                </UI.Button>
                <p style={{ marginTop: 15 }}>
                  Catalog estimate. Confirm current prices and availability with
                  the stockist.
                </p>
              </>
            ) : (
              <UI.Empty>
                <ShoppingBasket size={28} />
                <h3>No basket needed</h3>
              </UI.Empty>
            ))}
          {modal === "help" && (
            <div style={{ display: "grid", gap: 18 }}>
              <h3>BrewLab.ai / Recipe Studio</h3>
              <p>
                Formulation estimates use brewcalc with Tinseth bitterness and
                Morey color. Whirlpool utilization is estimated at 25%; hop
                alpha loss is estimated at 5% per month. Actual brewhouse
                results will vary.
              </p>
              <p>
                Source water values and salt additions are concentration
                estimates, not a mash pH prediction. Starter inventory and
                stockist prices are sample data.
              </p>
              <UI.Button
                onClick={() => {
                  setModal(null);
                  setView("studio");
                }}
              >
                <ArrowRight size={14} />
                Back to the studio
              </UI.Button>
            </div>
          )}
          {error && <UI.ErrorText role="alert">{error}</UI.ErrorText>}
        </UI.DialogBody>
      </UI.Dialog>
      {toast && <UI.Toast role="status">{toast}</UI.Toast>}
    </>
  );
}

function DotIcon() {
  return (
    <span
      style={{
        width: 4,
        height: 4,
        borderRadius: "50%",
        background: "currentColor",
      }}
    />
  );
}
