import {
  BadgeEuro,
  Box,
  Check,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Heart,
  Info,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type {
  CommunityCategory,
  CommunityListing,
  CommunityListingDraft,
} from "../types";

type CommunityBrowserProps = {
  listings: CommunityListing[];
  categories: CommunityCategory[];
  commerceEnabled: boolean;
  selectedObjectName: string | null;
  canCreateDraft: boolean;
  busy: boolean;
  onCreateDraft: (draft: CommunityListingDraft) => Promise<void>;
  onDeleteDraft: (listingId: string) => void;
};

type PriceFilter = "all" | "free" | "paid";

function formatPrice(listing: CommunityListing): string {
  if (listing.price_cents === 0) return "Free";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: listing.currency,
    maximumFractionDigits: 0,
  }).format(listing.price_cents / 100);
}

function modelVariant(category: CommunityCategory): string {
  return category.toLowerCase();
}

export function CommunityBrowser({
  listings,
  categories,
  commerceEnabled,
  selectedObjectName,
  canCreateDraft,
  busy,
  onCreateDraft,
  onDeleteDraft,
}: CommunityBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CommunityCategory | "all">("all");
  const [price, setPrice] = useState<PriceFilter>("all");
  const [maximum, setMaximum] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const filtered = useMemo(() => {
    const maxCents = maximum === "all" ? null : Number(maximum) * 100;
    const normalized = query.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesQuery = !normalized ||
        `${listing.name} ${listing.creator} ${listing.description} ${listing.tags.join(" ")}`
          .toLowerCase()
          .includes(normalized);
      const matchesCategory = category === "all" || listing.category === category;
      const matchesPrice = price === "all" ||
        (price === "free" ? listing.price_cents === 0 : listing.price_cents > 0);
      const matchesMaximum = maxCents === null || listing.price_cents <= maxCents;
      return matchesQuery && matchesCategory && matchesPrice && matchesMaximum;
    });
  }, [category, listings, maximum, price, query]);
  const selected = listings.find((listing) => listing.id === selectedId) ?? null;

  return (
    <main className={`community-browser ${selected ? "details-open" : ""}`}>
      <section className="community-content">
        <header className="community-hero">
          <div className="community-eyebrow"><Sparkles size={12} /> MARUL3D COMMUNITY</div>
          <div className="community-hero-row">
            <div>
              <h1>Build less from zero.</h1>
              <p>Discover production-ready CAD models from designers, engineers, and makers.</p>
            </div>
            <button className="primary-button sell-model-button" type="button" disabled={!canCreateDraft || busy} onClick={() => setSellOpen(true)}>
              <Upload size={14} /> Sell your model
            </button>
          </div>
          <label className="community-search">
            <Search size={17} />
            <input aria-label="Search community models" placeholder="Search models, creators, or tags" value={query} onChange={(event) => setQuery(event.target.value)} />
            <kbd>⌘ K</kbd>
          </label>
        </header>

        <section className="community-commerce-note">
          <Info size={15} />
          <div><strong>Marketplace preview</strong><span>Catalog browsing and local seller drafts are active. Checkout, publishing, and protected file delivery need the hosted community service.</span></div>
          <span>LOCAL MVP</span>
        </section>

        <section className="community-filterbar" aria-label="Community filters">
          <div className="filter-label"><Filter size={13} /> Filters</div>
          <label><span>Category</span><select aria-label="Community category" value={category} onChange={(event) => setCategory(event.target.value as CommunityCategory | "all")}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <div className="price-toggle" role="group" aria-label="Price type">
            {(["all", "free", "paid"] as PriceFilter[]).map((item) => <button className={price === item ? "selected" : ""} type="button" key={item} onClick={() => setPrice(item)}>{item === "all" ? "All" : item === "free" ? "Free" : "Paid"}</button>)}
          </div>
          <label><span>Max price</span><select aria-label="Maximum price" value={maximum} onChange={(event) => setMaximum(event.target.value)}><option value="all">Any price</option><option value="10">€10</option><option value="20">€20</option><option value="50">€50</option></select></label>
          <small>{filtered.length} models</small>
        </section>

        <div className="community-section-heading"><div><strong>Community models</strong><span>Curated files for editing and fabrication</span></div><button type="button">Newest <ChevronRight size={12} /></button></div>
        <section className="community-grid" aria-label="Community CAD models">
          {filtered.map((listing) => (
            <article className="community-card" key={listing.id} onClick={() => setSelectedId(listing.id)}>
              <div className={`community-model-preview ${modelVariant(listing.category)}`}>
                <div className="model-shape"><i /><i /><i /></div>
                <div className="model-grid-floor" />
                {listing.featured && <span className="featured-pill"><Sparkles size={9} /> Featured</span>}
                {listing.status === "draft" && <span className="draft-pill">Local draft</span>}
                <button type="button" aria-label={`Save ${listing.name}`} onClick={(event) => event.stopPropagation()}><Heart size={14} /></button>
                <span className={`price-pill ${listing.price_cents === 0 ? "free" : ""}`}>{formatPrice(listing)}</span>
              </div>
              <div className="community-card-body">
                <div className="community-card-meta"><span>{listing.category}</span><span><Star size={10} /> {listing.rating || "New"}{listing.review_count > 0 && <em>({listing.review_count})</em>}</span></div>
                <h2>{listing.name}</h2>
                <p>by <strong>{listing.creator}</strong></p>
                <footer><div>{listing.formats.map((format) => <span key={format}>{format}</span>)}</div><ChevronRight size={14} /></footer>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <div className="community-empty"><Search size={24} /><strong>No models found</strong><span>Try removing a filter or using a broader search.</span></div>}
        </section>
      </section>

      {selected && (
        <aside className="community-details">
          <header><span>{selected.status === "draft" ? "SELLER DRAFT" : "MODEL DETAILS"}</span><button className="icon-button" type="button" aria-label="Close model details" onClick={() => setSelectedId(null)}><X size={15} /></button></header>
          <div className={`community-detail-preview ${modelVariant(selected.category)}`}><div className="model-shape"><i /><i /><i /></div><div className="model-grid-floor" /></div>
          <div className="community-detail-copy">
            <div className="community-detail-category">{selected.category}</div>
            <h2>{selected.name}</h2>
            <p className="community-detail-creator">by <strong>{selected.creator}</strong> {selected.status === "published" && <><Star size={10} /> {selected.rating} ({selected.review_count})</>}</p>
            <p className="community-detail-description">{selected.description}</p>
            <div className="community-detail-tags">{selected.tags.map((tag) => <span key={tag}><Tag size={9} /> {tag}</span>)}</div>
            <div className="community-purchase-box">
              <div><small>{selected.price_cents === 0 ? "COMMUNITY LICENSE" : "ONE-TIME PRICE"}</small><strong>{formatPrice(selected)}</strong></div>
              {selected.status === "draft" ? (
                <button className="danger-button" type="button" onClick={() => { onDeleteDraft(selected.id); setSelectedId(null); }}><Trash2 size={13} /> Delete draft</button>
              ) : (
                <button className="primary-button" type="button" disabled={!commerceEnabled} title="Hosted checkout and file delivery are not configured yet"><ShoppingBag size={14} /> {selected.price_cents === 0 ? "Get model" : "Buy model"}</button>
              )}
            </div>
            {!commerceEnabled && selected.status === "published" && <p className="commerce-boundary"><ShieldCheck size={13} /> Checkout is intentionally disabled until seller verification, payments, licensing, and secure CAD delivery are connected.</p>}
            {selected.status === "draft" && <p className="commerce-boundary"><Check size={13} /> Linked to local object “{selected.source_object_name}”. No CAD file has left this Mac.</p>}
            <section className="community-specs">
              <div><Box size={13} /><span>Formats</span><strong>{selected.formats.join(", ")}</strong></div>
              <div><ShieldCheck size={13} /><span>License</span><strong>{selected.license}</strong></div>
              <div><BadgeEuro size={13} /><span>Price</span><strong>{formatPrice(selected)}</strong></div>
            </section>
          </div>
        </aside>
      )}

      {sellOpen && (
        <SellModelDialog
          categories={categories}
          objectName={selectedObjectName ?? "No object selected"}
          busy={busy}
          onClose={() => setSellOpen(false)}
          onSubmit={async (draft) => {
            await onCreateDraft(draft);
            setSellOpen(false);
          }}
        />
      )}
    </main>
  );
}

function SellModelDialog({ categories, objectName, busy, onClose, onSubmit }: {
  categories: CommunityCategory[];
  objectName: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: CommunityListingDraft) => Promise<void>;
}) {
  const [name, setName] = useState(objectName);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CommunityCategory>(categories[0] ?? "Mechanical");
  const [priceType, setPriceType] = useState<"free" | "paid">("paid");
  const [price, setPrice] = useState("12");
  const [license, setLicense] = useState<"personal" | "commercial" | "open">("personal");
  const [tags, setTags] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      category,
      price_cents: priceType === "free" ? 0 : Math.max(0, Math.round(Number(price) * 100)),
      currency: "EUR",
      license,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
    });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sell-dialog" role="dialog" aria-modal="true" aria-labelledby="sell-model-title">
        <header><div className="entity-dialog-heading"><span className="dialog-entity-icon"><Store size={18} /></span><div><span className="dialog-kicker">COMMUNITY SELLER</span><h2 id="sell-model-title">List your CAD model</h2></div></div><button className="icon-button" type="button" aria-label="Close sell model dialog" onClick={onClose}><X size={16} /></button></header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="sell-source"><Box size={15} /><div><span>Source CAD object</span><strong>{objectName}</strong></div><small>LOCAL</small></div>
          <label className="feature-form-field"><span>Listing title</span><input aria-label="Listing title" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="feature-form-field"><span>Description</span><textarea aria-label="Listing description" required minLength={10} maxLength={2000} placeholder="Explain what the model contains and how buyers can use it…" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="feature-field-row"><label className="feature-form-field"><span>Category</span><select aria-label="Listing category" value={category} onChange={(event) => setCategory(event.target.value as CommunityCategory)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="feature-form-field"><span>License</span><select aria-label="Listing license" value={license} onChange={(event) => setLicense(event.target.value as typeof license)}><option value="personal">Personal use</option><option value="commercial">Commercial use</option><option value="open">Open license</option></select></label></div>
          <label className="feature-form-field"><span>Tags</span><input aria-label="Listing tags" placeholder="mount, bracket, robotics" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
          <div className="sell-price-row"><div className="price-type"><button className={priceType === "free" ? "selected" : ""} type="button" onClick={() => setPriceType("free")}><Sparkles size={12} /> Free</button><button className={priceType === "paid" ? "selected" : ""} type="button" onClick={() => setPriceType("paid")}><CircleDollarSign size={12} /> Paid</button></div>{priceType === "paid" && <label><span>Price</span><div><em>€</em><input aria-label="Listing price" type="number" min="1" max="100000" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} /></div></label>}</div>
          <p className="sell-draft-note"><Info size={13} /> This saves a private local draft. Publishing and payments will activate after the hosted marketplace is configured.</p>
          <footer><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy || name.trim().length < 2 || description.trim().length < 10}><Store size={13} /> Save seller draft</button></footer>
        </form>
      </section>
    </div>
  );
}
