"use client";

import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import styled from "styled-components";
import Markdown from "react-markdown";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { builderStylesSchema, proposalSchema } from "../lib/schemas";
import { calculateRecipe } from "../lib/calculations";
import { normalizeRecipeIds } from "../lib/recipe";
import type { BuilderRequest } from "../lib/recipe-builder";
import type { InventoryItem, Recipe, Supplier } from "../lib/types";
import * as Ui from "./ui";

type Style = NonNullable<BuilderRequest["style"]>;
type Proposal = { recipe: Recipe; explanation: string; sourcing?: { status: string; stockist?: string } };

const BuilderDialog = styled(Ui.Dialog)`
  width: min(720px, calc(100vw - 24px));
  overscroll-behavior: contain;
  h2, h3, p, label { overflow-wrap: anywhere; }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { font-size: 12px; font-weight: 600; margin-bottom: 10px; }
  input[type="checkbox"], input[type="radio"] {
    width: 16px; height: 16px; flex-shrink: 0; accent-color: ${({ theme }) => theme.colors.accent};
  }
`;
const Steps = styled.ol`
  display: flex; gap: 16px; list-style: none; padding: 16px 24px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin: 0; font: 11px ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.muted};
  li[aria-current="step"] { color: ${({ theme }) => theme.colors.accent}; font-weight: 700; }
  @media (max-width: 420px) { gap: 10px; padding: 14px 16px; font-size: 10px; }
`;
const Choice = styled.label`
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 0;
  cursor: pointer; font-size: 12px; line-height: 1.5;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  input { margin-top: 2px; }
  strong, small { display: block; }
  small { color: ${({ theme }) => theme.colors.muted}; font-size: 11px; margin-top: 4px; }
  &:has(input:checked) strong { color: ${({ theme }) => theme.colors.accent}; }
`;
const Stack = styled.div`
  display: grid; gap: 20px; min-width: 0;
  h3 { font-size: 16px; }
  ul { padding-left: 20px; font-size: 12px; line-height: 1.8; }
  .recipe-notes { font-size: 12px; line-height: 1.8; }
  .recipe-notes h1, .recipe-notes h2, .recipe-notes h3 { font-size: 13px; margin: 12px 0 6px; }
  .recipe-notes p { margin: 8px 0; }
`;
const Actions = styled(Ui.Row)`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: 16px; justify-content: space-between; flex-wrap: wrap;
`;

function sourcesAvailable(mode: BuilderRequest["mode"], inventory: boolean, stockists: number, catalog: boolean) {
  if (mode === "inventory") return inventory;
  if (!stockists) return false;
  return catalog || (mode === "mixed" && inventory);
}

function PlainLink({ children }: Readonly<{ children?: ReactNode }>) {
  return <span>{children}</span>;
}

export default function RecipeBuilder({ recipe, inventory, suppliers, units, ready, online, onApply, onClose, onStockists }: Readonly<{
  recipe: Recipe; inventory: InventoryItem[]; suppliers: Supplier[]; units: "metric" | "imperial";
  ready: boolean; online: boolean; onApply: (recipe: Recipe, explanation: string) => void;
  onClose: () => void; onStockists: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [step, setStep] = useState<"brief" | "styles" | "preview">("brief");
  const [mode, setMode] = useState<BuilderRequest["mode"]>("inventory");
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [brief, setBrief] = useState("");
  const [batchLiters, setBatchLiters] = useState(recipe.batchLiters);
  const [styles, setStyles] = useState<Style[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<Style | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<"styles" | "recipe" | null>(null);
  const [error, setError] = useState("");
  const volumeFactor = units === "imperial" ? 3.78541 : 1;
  const availableStock = inventory.some((item) => item.quantity > 0);
  const selectedStockists = suppliers.filter((supplier) => supplierIds.includes(supplier.id));
  const availableCatalog = selectedStockists.some((supplier) => supplier.products.some((product) => product.stock > 0));
  const validSources = sourcesAvailable(mode, availableStock, selectedStockists.length, availableCatalog);

  useEffect(() => {
    dialog.current?.showModal();
    return () => { pending.current?.abort(); };
  }, []);

  function cancelRequest() {
    pending.current?.abort();
    pending.current = null;
    setBusy(null);
    setError("");
  }

  async function request(action: BuilderRequest["action"], style?: Style, excludedStyles: string[] = []) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/ai/builder", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action, mode, supplierIds: mode === "inventory" ? [] : supplierIds, brief, recipe: { ...recipe, batchLiters }, style, excludedStyles }),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "The recipe builder is unavailable. Please try again.");
      if (action === "styles") {
        const next = builderStylesSchema.parse(result).styles;
        setStyles((current) => excludedStyles.length ? [...current, ...next].slice(-5) : next);
        setHistory((current) => [...(excludedStyles.length ? current : []), ...next.map((item) => item.style)].slice(-40));
        setProposal(null);
        setSelected(null);
        setStep("styles");
      } else {
        const parsed = proposalSchema.parse(result);
        setProposal({ ...parsed, recipe: normalizeRecipeIds(parsed.recipe), sourcing: result.sourcing ? {
          status: result.sourcing.status, stockist: result.sourcing.options?.[0]?.supplier?.name,
        } : undefined });
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "The recipe builder is unavailable. Please try again.");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(null); }
    }
  }

  function submitBrief(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready && online && validSources && !busy) void request("styles");
  }

  function chooseStyle(style: Style) {
    setSelected(style);
    setProposal(null);
    setStep("preview");
    void request("recipe", style);
  }

  const stats = calculateRecipe(proposal?.recipe ?? recipe);

  return (
    <BuilderDialog ref={dialog} aria-labelledby="builder-title" onCancel={onClose} onClose={onClose}>
      <Ui.SectionHead>
        <Ui.Row><Sparkles size={17} /><h2 id="builder-title">Create new recipe</h2></Ui.Row>
        <Ui.IconButton onClick={onClose} aria-label="Close recipe builder" title="Close"><X size={17} /></Ui.IconButton>
      </Ui.SectionHead>
      <Steps aria-label="Recipe builder progress">
        <li aria-current={step === "brief" ? "step" : undefined}>01 Brief</li>
        <li aria-current={step === "styles" ? "step" : undefined}>02 Styles</li>
        <li aria-current={step === "preview" ? "step" : undefined}>03 Recipe</li>
      </Steps>
      <Ui.DialogBody>
        <Stack>
          {!ready && <output>AI is not connected. <a href="/profile#ai">Connect your AI provider</a></output>}
          {!online && <Ui.ErrorText as="output">You are offline. Reconnect to generate a recipe.</Ui.ErrorText>}
          {step === "brief" && <form onSubmit={submitBrief}>
            <fieldset disabled={!!busy}>
              <legend>Ingredient sources</legend>
              {([
                ["inventory", "Current inventory only"],
                ["mixed", "Current inventory and purchases from stockists"],
                ["stockists", "Stockists only"],
              ] as const).map(([value, label]) => <Choice key={value}>
                <input type="radio" name="source-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                <strong>{label}</strong>
              </Choice>)}
            </fieldset>
            {mode !== "inventory" && <fieldset disabled={!!busy}>
              <legend>Select stockists</legend>
              {suppliers.length ? suppliers.map((supplier) => <Choice key={supplier.id}>
                <input type="checkbox" checked={supplierIds.includes(supplier.id)} onChange={(event) => setSupplierIds((current) => event.target.checked ? [...current, supplier.id] : current.filter((id) => id !== supplier.id))} />
                <span><strong>{supplier.name}</strong><small>{supplier.products.filter((product) => product.stock > 0).length} stocked products</small></span>
              </Choice>) : <p>No stockists added yet.</p>}
              <Ui.Button type="button" $small onClick={onStockists} style={{ marginTop: 12 }}>Manage stockists <ArrowRight size={13} /></Ui.Button>
            </fieldset>}
            {mode === "inventory" && !availableStock && <output>Your inventory has no stocked ingredients.</output>}
            {mode !== "inventory" && selectedStockists.length > 0 && !availableCatalog && <output>Selected stockists have no stocked catalog products.{mode === "mixed" && availableStock ? " Only inventory can be used." : " Add catalog products or select another stockist."}</output>}
            <Ui.Field>Batch volume ({units === "imperial" ? "gal" : "L"})
              <input type="number" required min={1 / volumeFactor} max={1000 / volumeFactor} step="any" disabled={!!busy} value={Number((batchLiters / volumeFactor).toFixed(3))} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) setBatchLiters(event.target.valueAsNumber * volumeFactor); }} />
            </Ui.Field>
            <Ui.Field><span>Recipe brief (optional)</span>
              <textarea maxLength={3000} value={brief} disabled={!!busy} onChange={(event) => setBrief(event.target.value)} placeholder="I want an easy drinking summer beer, or I need to use this specific yeast..." />
            </Ui.Field>
            <Ui.Row $between $wrap><Ui.Mono>{batchLiters.toFixed(1)} L / {recipe.efficiency}% efficiency / {recipe.boilMinutes} min boil</Ui.Mono><Ui.Muted>{brief.length}/3000</Ui.Muted></Ui.Row>
            <Actions><Ui.Button type="button" onClick={onClose}>Cancel</Ui.Button><Ui.Button type="submit" $primary disabled={!ready || !online || !validSources || !!busy}>
              {busy ? <LoaderCircle size={14} /> : <Sparkles size={14} />}{busy ? "Suggesting styles..." : "Suggest styles"}
            </Ui.Button></Actions>
          </form>}

          {step === "styles" && <>
            <fieldset disabled={!!busy || !online || !ready}>
              <legend>Suggested styles</legend>
              {styles.map((style) => <Choice key={style.style}>
                <input type="radio" name="suggested-style" value={style.style} checked={false} onChange={() => chooseStyle(style)} />
                <span><strong>{style.style}</strong><small>{style.overview}</small></span>
              </Choice>)}
            </fieldset>
            <Actions>
              <Ui.Button onClick={() => { cancelRequest(); setStep("brief"); }}><ArrowLeft size={14} />Back</Ui.Button>
              <Ui.Button onClick={() => void request("styles", undefined, history)} disabled={!!busy || !online || !ready} title={styles.length === 5 ? "Replace the oldest suggestion with another style" : "Add another style suggestion"}>
                {busy ? <LoaderCircle size={14} /> : <Plus size={14} />}{busy ? "Suggesting..." : "Add another"}
              </Ui.Button>
            </Actions>
          </>}

          {step === "preview" && selected && <>
            <div><Ui.Eyebrow>{selected.style}</Ui.Eyebrow><h3 style={{ marginTop: 8 }}>{proposal?.recipe.name || selected.style}</h3><p>{selected.overview}</p></div>
            {busy && <Ui.Row as="output" aria-live="polite"><LoaderCircle size={16} /><Ui.Mono>Building your recipe...</Ui.Mono></Ui.Row>}
            {proposal && <>
              <Ui.Row $wrap $gap={10}>
                <Ui.Badge $tone="accent">{proposal.recipe.batchLiters.toFixed(1)} L</Ui.Badge>
                <Ui.Badge>{stats.abv.toFixed(1)}% ABV</Ui.Badge><Ui.Badge>{Math.round(stats.ibu)} IBU</Ui.Badge>
                <Ui.Badge>OG {stats.og.toFixed(3)}</Ui.Badge><Ui.Badge>FG {stats.fg.toFixed(3)}</Ui.Badge>
              </Ui.Row>
              <div className="recipe-notes"><Markdown skipHtml disallowedElements={["img"]} components={{ a: PlainLink }}>{proposal.explanation}</Markdown></div>
              <div><h3>Ingredients</h3><ul>
                {proposal.recipe.grains.map((grain) => <li key={grain.id}>{grain.kg} kg {grain.name}</li>)}
                {proposal.recipe.hops.map((hop) => <li key={hop.id}>{hop.grams} g {hop.name} / {hop.use}, {hop.minutes} min</li>)}
                <li>{proposal.recipe.yeast}</li>
                {proposal.recipe.water.gypsum > 0 && <li>{proposal.recipe.water.gypsum} g gypsum</li>}
                {proposal.recipe.water.calciumChloride > 0 && <li>{proposal.recipe.water.calciumChloride} g calcium chloride</li>}
              </ul><p>Mash {proposal.recipe.mashC} C / Boil {proposal.recipe.boilMinutes} min</p></div>
              {proposal.sourcing && <Ui.Row $wrap><Check size={15} /><Ui.Mono>{proposal.sourcing.status === "in-stock" ? "Covered by current inventory" : `Purchases from ${proposal.sourcing.stockist || "selected stockist"}`}</Ui.Mono></Ui.Row>}
            </>}
            <Actions>
              <Ui.Button onClick={() => { cancelRequest(); setStep("styles"); }}><ArrowLeft size={14} />Styles</Ui.Button>
              {proposal ? <Ui.Button $primary disabled={!!busy} onClick={() => onApply(proposal.recipe, proposal.explanation)}><Check size={14} />Apply this recipe</Ui.Button>
                : <Ui.Button onClick={() => void request("recipe", selected)} disabled={!!busy || !online || !ready}><RefreshCw size={14} />Try again</Ui.Button>}
            </Actions>
          </>}
          {error && <Ui.ErrorText role="alert">{error}</Ui.ErrorText>}
          {busy === "styles" && <Ui.Mono as="output" aria-live="polite">Finding styles for your ingredients and brief...</Ui.Mono>}
        </Stack>
      </Ui.DialogBody>
    </BuilderDialog>
  );
}