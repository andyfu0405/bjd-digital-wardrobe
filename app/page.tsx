"use client";
/* eslint-disable @next/next/no-img-element -- user-selected IndexedDB data URLs are rendered directly */

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { changeStatusPreserving, getBalanceCountdown } from "@/lib/domain";

type Category = "clothing" | "body" | "head" | "accessory";
type Status =
  | "waiting_for_balance_notice"
  | "balance_due"
  | "paid_waiting_receipt"
  | "received";
type View = "home" | "items" | "form" | "detail";

type ItemImage = { id: string; dataUrl: string };

type Item = {
  id: string;
  name: string;
  category: Category;
  status: Status;
  images: ItemImage[];
  coverImageId?: string;
  price?: number;
  sizeTags: string[];
  styleTags: string[];
  brandOrShop?: string;
  notes?: string;
  balanceAmount?: number;
  balanceDueDate?: string;
  estimatedShipping?: string;
  receivedDate?: string;
  clothingMode?: "single" | "set";
  setCount?: number;
  setDescription?: string;
  maker?: string;
  model?: string;
  sculptName?: string;
  skinTone?: string;
  accessoryType?: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  category: Category;
  status: Status;
  images: ItemImage[];
  coverImageId?: string;
  price: string;
  sizeTags: string[];
  styleTags: string[];
  brandOrShop: string;
  notes: string;
  balanceAmount: string;
  balanceDueDate: string;
  estimatedShipping: string;
  receivedDate: string;
  clothingMode: "single" | "set";
  setCount: string;
  setDescription: string;
  maker: string;
  model: string;
  sculptName: string;
  skinTone: string;
  accessoryType: string;
};

const CATEGORY: Record<Category, { label: string; short: string }> = {
  clothing: { label: "衣物", short: "衣" },
  body: { label: "娃体", short: "体" },
  head: { label: "娃头", short: "头" },
  accessory: { label: "配件", short: "配" },
};

const STATUS: Record<Status, string> = {
  waiting_for_balance_notice: "等待补款通知",
  balance_due: "待补尾款",
  paid_waiting_receipt: "已付款待收货",
  received: "已收到",
};

const SIZE_TAGS = ["三分", "四分", "六分", "叔体", "幼体", "70cm"];
const STYLE_TAGS = ["日常", "学院", "古典", "优雅", "亚文化", "暗黑", "华丽"];

const emptyForm = (category: Category = "clothing", status: Status = "received"): FormState => ({
  name: "",
  category,
  status,
  images: [],
  coverImageId: undefined,
  price: "",
  sizeTags: [],
  styleTags: [],
  brandOrShop: "",
  notes: "",
  balanceAmount: "",
  balanceDueDate: "",
  estimatedShipping: "",
  receivedDate: "",
  clothingMode: "single",
  setCount: "",
  setDescription: "",
  maker: "",
  model: "",
  sculptName: "",
  skinTone: "",
  accessoryType: "",
});

const toForm = (item: Item): FormState => ({
  ...emptyForm(item.category, item.status),
  name: item.name,
  images: item.images,
  coverImageId: item.coverImageId,
  price: item.price?.toString() ?? "",
  sizeTags: item.sizeTags,
  styleTags: item.styleTags,
  brandOrShop: item.brandOrShop ?? "",
  notes: item.notes ?? "",
  balanceAmount: item.balanceAmount?.toString() ?? "",
  balanceDueDate: item.balanceDueDate ?? "",
  estimatedShipping: item.estimatedShipping ?? "",
  receivedDate: item.receivedDate ?? "",
  clothingMode: item.clothingMode ?? "single",
  setCount: item.setCount?.toString() ?? "",
  setDescription: item.setDescription ?? "",
  maker: item.maker ?? "",
  model: item.model ?? "",
  sculptName: item.sculptName ?? "",
  skinTone: item.skinTone ?? "",
  accessoryType: item.accessoryType ?? "",
});

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bjd-digital-wardrobe", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("kv")) {
        request.result.createObjectStore("kv", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLocal<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("kv", "readonly").objectStore("kv").get(key);
    request.onsuccess = () => resolve(request.result?.value as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeLocal(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sampleItems(): Item[] {
  const now = new Date().toISOString();
  return [
    {
      id: "sample-1",
      name: "雾蓝学院套装",
      category: "clothing",
      status: "received",
      images: [],
      price: 368,
      sizeTags: ["四分"],
      styleTags: ["学院", "日常"],
      brandOrShop: "NORD Doll",
      clothingMode: "set",
      setCount: 5,
      setDescription: "衬衫、背心、半裙、领结、袜子",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sample-2",
      name: "MDD 女体",
      category: "body",
      status: "paid_waiting_receipt",
      images: [],
      sizeTags: ["四分"],
      styleTags: [],
      maker: "Volks",
      model: "MDD 2.0",
      skinTone: "普肌",
      estimatedShipping: "预计九月",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sample-3",
      name: "冬日限定头雕",
      category: "head",
      status: "balance_due",
      images: [],
      balanceAmount: 1200,
      balanceDueDate: isoDateOffset(5),
      sizeTags: ["三分"],
      styleTags: ["古典"],
      maker: "Lune Atelier",
      sculptName: "Noël",
      skinTone: "白肌",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sample-4",
      name: "琥珀色 16mm 眼珠",
      category: "accessory",
      status: "waiting_for_balance_notice",
      images: [],
      price: 160,
      sizeTags: ["16mm"],
      styleTags: ["日常"],
      accessoryType: "眼珠",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function compressImage(file: File): Promise<ItemImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/jpeg", 0.82) };
}

function numberValue(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showOptional, setShowOptional] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagMode, setTagMode] = useState<"size" | "style">("size");
  const [customSizeTags, setCustomSizeTags] = useState<string[]>([]);
  const [customStyleTags, setCustomStyleTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sort, setSort] = useState("created");
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    Promise.all([
      readLocal<Item[]>("items"),
      readLocal<FormState>("draft"),
      readLocal<string[]>("size-tags"),
      readLocal<string[]>("style-tags"),
    ])
      .then(([savedItems, draft, sizes, styles]) => {
        const initial = savedItems ?? sampleItems();
        setItems(initial);
        if (!savedItems) writeLocal("items", initial);
        if (draft) {
          setForm(draft);
          setDraftDirty(true);
          setDraftRestored(true);
        }
        setCustomSizeTags(sizes ?? []);
        setCustomStyleTags(styles ?? []);
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal("items", items);
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated || !draftDirty || editingId) return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      writeLocal("draft", form).then(() => {
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1400);
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [form, draftDirty, hydrated, editingId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selected = items.find((item) => item.id === selectedId);
  const counts = useMemo(() => {
    const byCategory = { clothing: 0, body: 0, head: 0, accessory: 0 };
    const byStatus = {
      waiting_for_balance_notice: 0,
      balance_due: 0,
      paid_waiting_receipt: 0,
      received: 0,
    };
    items.forEach((item) => {
      byCategory[item.category] += 1;
      byStatus[item.status] += 1;
    });
    return { byCategory, byStatus };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const matchesSearch = !query || [item.name, item.brandOrShop, item.notes].some((value) => value?.toLowerCase().includes(query));
        return matchesSearch && (categoryFilter === "all" || item.category === categoryFilter) && (statusFilter === "all" || item.status === statusFilter);
      })
      .sort((a, b) => {
        if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
        if (sort === "price-asc") return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
        if (sort === "price-desc") return (b.price ?? -1) - (a.price ?? -1);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [items, search, categoryFilter, statusFilter, sort]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (!editingId) setDraftDirty(true);
  }

  function changeStatus(status: Status) {
    setForm((current) => changeStatusPreserving(current, status));
    if (!editingId) setDraftDirty(true);
  }

  function startNew(options?: { preserve?: boolean; copy?: Item }) {
    if (options?.copy) {
      const source = options.copy;
      const copied = emptyForm(source.category, "received");
      copied.sizeTags = source.sizeTags;
      copied.styleTags = source.styleTags;
      copied.brandOrShop = source.brandOrShop ?? "";
      copied.clothingMode = source.clothingMode ?? "single";
      copied.setCount = source.setCount?.toString() ?? "";
      copied.setDescription = source.setDescription ?? "";
      copied.maker = source.maker ?? "";
      copied.model = source.model ?? "";
      copied.sculptName = source.sculptName ?? "";
      copied.skinTone = source.skinTone ?? "";
      copied.accessoryType = source.accessoryType ?? "";
      setForm(copied);
      setDraftDirty(true);
    } else if (!options?.preserve) {
      setForm(emptyForm(form.category, form.status));
      setDraftDirty(false);
    }
    setEditingId(undefined);
    setShowOptional(false);
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: Item) {
    setForm(toForm(item));
    setEditingId(item.id);
    setShowOptional(false);
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const compressed = await Promise.all(files.map(compressImage));
      const next = [...form.images, ...compressed];
      update("images", next);
      if (!form.coverImageId && next[0]) update("coverImageId", next[0].id);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function toggleTag(type: "size" | "style", tag: string) {
    const key = type === "size" ? "sizeTags" : "styleTags";
    const values = form[key];
    update(key, values.includes(tag) ? values.filter((value) => value !== tag) : [...values, tag]);
  }

  function createTag() {
    const clean = tagInput.trim();
    if (!clean) return;
    const known = tagMode === "size" ? [...SIZE_TAGS, ...customSizeTags] : [...STYLE_TAGS, ...customStyleTags];
    const existing = known.find((tag) => tag.toLocaleLowerCase() === clean.toLocaleLowerCase());
    const value = existing ?? clean;
    if (!existing) {
      if (tagMode === "size") {
        const next = [clean, ...customSizeTags];
        setCustomSizeTags(next);
        writeLocal("size-tags", next);
      } else {
        const next = [clean, ...customStyleTags];
        setCustomStyleTags(next);
        writeLocal("style-tags", next);
      }
    }
    toggleTag(tagMode, value);
    setTagInput("");
  }

  function saveItem(continueAdding = false) {
    const now = new Date().toISOString();
    const existing = editingId ? items.find((item) => item.id === editingId) : undefined;
    const unnamedCount = items.filter((item) => item.category === form.category && item.name.startsWith(`未命名${CATEGORY[form.category].label}`)).length + 1;
    const name = form.name.trim() || `未命名${CATEGORY[form.category].label} ${String(unnamedCount).padStart(2, "0")}`;
    const item: Item = {
      id: editingId ?? crypto.randomUUID(),
      name,
      category: form.category,
      status: form.status,
      images: form.images,
      coverImageId: form.coverImageId,
      price: numberValue(form.price),
      sizeTags: form.sizeTags,
      styleTags: form.styleTags,
      brandOrShop: form.brandOrShop.trim() || undefined,
      notes: form.notes.trim() || undefined,
      balanceAmount: numberValue(form.balanceAmount),
      balanceDueDate: form.balanceDueDate || undefined,
      estimatedShipping: form.estimatedShipping.trim() || undefined,
      receivedDate: form.receivedDate || undefined,
      clothingMode: form.clothingMode,
      setCount: numberValue(form.setCount),
      setDescription: form.setDescription.trim() || undefined,
      maker: form.maker.trim() || undefined,
      model: form.model.trim() || undefined,
      sculptName: form.sculptName.trim() || undefined,
      skinTone: form.skinTone.trim() || undefined,
      accessoryType: form.accessoryType || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setItems((current) => existing ? current.map((value) => value.id === item.id ? item : value) : [item, ...current]);
    if (!editingId) writeLocal("draft", undefined);
    setDraftDirty(false);
    setDraftRestored(false);
    setToast(existing ? "修改已保存" : "物品已加入衣橱");
    if (continueAdding) {
      const next = emptyForm(form.category, form.status);
      next.sizeTags = form.sizeTags;
      next.styleTags = form.styleTags;
      setForm(next);
      setEditingId(undefined);
      setShowOptional(false);
      setView("form");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSelectedId(item.id);
      setEditingId(undefined);
      setView("detail");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function deleteItem(item: Item) {
    if (!window.confirm(`确认删除“${item.name}”吗？此操作无法撤销。`)) return;
    setItems((current) => current.filter((value) => value.id !== item.id));
    setSelectedId(undefined);
    setView("items");
    setToast("物品已删除");
  }

  function showList(category: Category | "all" = "all", status: Status | "all" = "all") {
    setCategoryFilter(category);
    setStatusFilter(status);
    setView("items");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!hydrated) {
    return <main className="loading-screen"><div className="loading-mark">W</div><p>正在打开你的数字衣橱…</p></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="返回首页">
          <span className="brand-mark">W</span>
          <span><strong>BJD Wardrobe</strong><small>数字衣橱</small></span>
        </button>
        <nav className="desktop-nav" aria-label="主导航">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>首页</button>
          <button className={view === "items" ? "active" : ""} onClick={() => showList()}>全部物品</button>
        </nav>
        <button className="header-add" onClick={() => startNew({ preserve: draftDirty })}>＋ 添加物品</button>
      </header>

      {view === "home" && (
        <div className="page home-page">
          <section className="hero">
            <div>
              <p className="eyebrow">MY COLLECTION · 本机保存</p>
              <h1>把喜欢的，<br /><em>好好收藏。</em></h1>
              <p className="hero-copy">一个安静、轻盈的 BJD 数字衣橱。随手记下新到的衣物、娃体、娃头与配件。</p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => startNew({ preserve: draftDirty })}>添加一件物品 <span>→</span></button>
                {draftDirty && <button className="text-button" onClick={() => startNew({ preserve: true })}>继续编辑草稿</button>}
              </div>
            </div>
            <div className="collection-stamp" aria-label={`共收藏 ${items.length} 件`}>
              <span>COLLECTION</span><strong>{String(items.length).padStart(2, "0")}</strong><small>件藏品</small>
            </div>
          </section>

          {items.some((item) => item.id.startsWith("sample-")) && (
            <div className="sample-note"><span>试用提示</span> 已放入 4 件示例藏品，你可以直接编辑或删除它们。</div>
          )}

          <section className="section-block">
            <div className="section-heading"><div><p>浏览衣橱</p><h2>按类别整理</h2></div><button onClick={() => showList()}>查看全部 {items.length} 件 →</button></div>
            <div className="category-grid">
              {(Object.keys(CATEGORY) as Category[]).map((category, index) => (
                <button key={category} className={`category-tile tone-${index + 1}`} onClick={() => showList(category)}>
                  <span className="category-number">0{index + 1}</span>
                  <span className="category-letter">{CATEGORY[category].short}</span>
                  <span><strong>{CATEGORY[category].label}</strong><small>{counts.byCategory[category]} 件</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className="section-block status-section">
            <div className="section-heading"><div><p>购买进度</p><h2>正在等待的</h2></div></div>
            <div className="status-row">
              {(Object.keys(STATUS) as Status[]).slice(0, 3).map((status) => (
                <button key={status} onClick={() => showList("all", status)}>
                  <strong>{counts.byStatus[status]}</strong><span>{STATUS[status]}</span><i>→</i>
                </button>
              ))}
            </div>
          </section>

          <section className="section-block recent-section">
            <div className="section-heading"><div><p>RECENTLY ADDED</p><h2>最近添加</h2></div><button onClick={() => showList()}>查看全部 →</button></div>
            <ItemGrid items={items.slice(0, 4)} onOpen={(item) => { setSelectedId(item.id); setView("detail"); }} />
          </section>
        </div>
      )}

      {view === "items" && (
        <div className="page items-page">
          <section className="list-title"><p>MY ARCHIVE</p><h1>全部藏品</h1><span>{filteredItems.length} 件结果</span></section>
          <section className="filter-bar">
            <label className="search-field"><span>搜索</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="名称、品牌或备注" /></label>
            <label><span>分类</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as Category | "all")}><option value="all">全部分类</option>{(Object.keys(CATEGORY) as Category[]).map((key) => <option key={key} value={key}>{CATEGORY[key].label}</option>)}</select></label>
            <label><span>状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "all")}><option value="all">全部状态</option>{(Object.keys(STATUS) as Status[]).map((key) => <option key={key} value={key}>{STATUS[key]}</option>)}</select></label>
            <label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="created">最近添加</option><option value="updated">最近修改</option><option value="price-asc">价格从低到高</option><option value="price-desc">价格从高到低</option></select></label>
            {(categoryFilter !== "all" || statusFilter !== "all" || search) && <button className="clear-filter" onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); }}>清除筛选</button>}
          </section>
          {filteredItems.length ? <ItemGrid items={filteredItems} onOpen={(item) => { setSelectedId(item.id); setView("detail"); }} /> : <div className="empty-state"><span>空</span><h2>没有找到相符的物品</h2><p>试试清除筛选，或添加一件新物品。</p><button className="primary-button" onClick={() => startNew()}>添加物品</button></div>}
        </div>
      )}

      {view === "form" && (
        <div className="page form-page">
          <div className="form-intro">
            <button className="back-button" onClick={() => setView(editingId ? "detail" : "home")}>← 返回</button>
            <p>{editingId ? "EDIT ITEM" : "QUICK ADD"}</p>
            <h1>{editingId ? "编辑藏品" : "添加一件物品"}</h1>
            <span>只需要选择分类和状态。其他内容都可以以后再补。</span>
          </div>

          {draftRestored && !editingId && <div className="draft-banner"><div><strong>已恢复上次的草稿</strong><span>你可以从离开的位置继续填写。</span></div><button onClick={() => { setForm(emptyForm()); setDraftDirty(false); setDraftRestored(false); writeLocal("draft", undefined); }}>舍弃草稿</button></div>}

          <div className="form-card">
            <div className="form-section-title"><span>01</span><div><p>必要信息</p><h2>两步即可保存</h2></div><i>必填</i></div>
            <div className="field-group">
              <label className="field-label">分类 <b>必填</b></label>
              <div className="choice-grid category-choices">
                {(Object.keys(CATEGORY) as Category[]).map((category) => <button key={category} type="button" className={form.category === category ? "selected" : ""} onClick={() => update("category", category)}><span>{CATEGORY[category].short}</span>{CATEGORY[category].label}</button>)}
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">状态 <b>必填</b></label>
              <div className="status-choices">
                {(Object.keys(STATUS) as Status[]).map((status) => <button key={status} type="button" className={form.status === status ? "selected" : ""} onClick={() => changeStatus(status)}><span></span>{STATUS[status]}</button>)}
              </div>
              {form.status === "balance_due" && <p className="field-hint">尾款金额和截止日期为选填，可在下方“选择性信息”中补充。</p>}
            </div>
          </div>

          <div className="form-card quick-card">
            <div className="form-section-title"><span>02</span><div><p>顺手填写</p><h2>常用，但都可留空</h2></div><i>选填</i></div>
            <div className="image-picker">
              <div className="image-picker-heading"><label className="field-label">图片</label><small>第一张自动成为封面</small></div>
              <div className="image-strip">
                {form.images.map((image) => <div key={image.id} className={`image-thumb ${form.coverImageId === image.id ? "cover" : ""}`}><img src={image.dataUrl} alt="待保存物品" /><button className="set-cover" onClick={() => update("coverImageId", image.id)}>{form.coverImageId === image.id ? "封面" : "设为封面"}</button><button className="remove-image" aria-label="删除图片" onClick={() => { const next = form.images.filter((value) => value.id !== image.id); update("images", next); if (form.coverImageId === image.id) update("coverImageId", next[0]?.id); }}>×</button></div>)}
                <button className="add-image" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}><strong>{uploading ? "…" : "+"}</strong><span>{uploading ? "正在压缩" : "相册 / 拍照"}</span><small>支持多选</small></button>
              </div>
              <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" capture={undefined} multiple onChange={handleImages} />
            </div>
            <div className="two-columns">
              <label className="text-field"><span>名称 <small>留空自动命名</small></span><input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder={`例如：雾蓝学院套装`} /></label>
              <label className="text-field"><span>价格 <small>人民币</small></span><div className="price-input"><b>¥</b><input type="number" min="0" inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0.00" /></div></label>
            </div>
            <TagSelector title="尺寸" mode="size" form={form} options={[...customSizeTags, ...SIZE_TAGS]} onToggle={toggleTag} onOpen={() => setTagMode("size")} />
            <TagSelector title="风格" mode="style" form={form} options={[...customStyleTags, ...STYLE_TAGS]} onToggle={toggleTag} onOpen={() => setTagMode("style")} />
            <div className="tag-create-row">
              <span>没有合适的{tagMode === "size" ? "尺寸" : "风格"}？</span>
              <div><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createTag(); } }} placeholder={`新建${tagMode === "size" ? "尺寸" : "风格"}标签`} /><button type="button" onClick={createTag}>创建并选中</button></div>
            </div>
          </div>

          <div className={`form-card optional-card ${showOptional ? "open" : ""}`}>
            <button className="optional-toggle" onClick={() => setShowOptional((value) => !value)} aria-expanded={showOptional}><div className="form-section-title"><span>03</span><div><p>选择性信息</p><h2>品牌、备注与详细资料</h2></div></div><strong>{showOptional ? "收起 −" : "展开 ＋"}</strong></button>
            {showOptional && (
              <div className="optional-content">
                {form.status === "balance_due" && <div className="conditional-panel"><h3>补款信息</h3><p>均为选填，切换状态后仍会保留。</p><div className="two-columns"><label className="text-field"><span>需补尾款</span><div className="price-input"><b>¥</b><input type="number" min="0" value={form.balanceAmount} onChange={(event) => update("balanceAmount", event.target.value)} placeholder="0.00" /></div></label><label className="text-field"><span>补款截止日期</span><input type="date" value={form.balanceDueDate} onChange={(event) => update("balanceDueDate", event.target.value)} /></label></div><label className="text-field"><span>预计出货时间</span><input value={form.estimatedShipping} onChange={(event) => update("estimatedShipping", event.target.value)} placeholder="例如：2026 年 9 月 / 秋季" /></label></div>}
                {form.status !== "balance_due" && form.status !== "received" && <div className="conditional-panel"><h3>购买进度</h3><label className="text-field"><span>预计出货时间</span><input value={form.estimatedShipping} onChange={(event) => update("estimatedShipping", event.target.value)} placeholder="例如：2026 年 9 月 / 秋季" /></label></div>}
                {form.status === "received" && <div className="conditional-panel"><h3>收货信息</h3><label className="text-field"><span>收货日期</span><input type="date" value={form.receivedDate} onChange={(event) => update("receivedDate", event.target.value)} /></label></div>}
                {form.category === "clothing" && <div className="conditional-panel"><h3>衣物资料</h3><div className="segmented"><button className={form.clothingMode === "single" ? "selected" : ""} onClick={() => update("clothingMode", "single")}>单件</button><button className={form.clothingMode === "set" ? "selected" : ""} onClick={() => update("clothingMode", "set")}>套装</button></div>{form.clothingMode === "set" && <><label className="text-field"><span>套装点数</span><input type="number" min="0" value={form.setCount} onChange={(event) => update("setCount", event.target.value)} placeholder="例如：5" /></label><label className="text-field"><span>套装内容</span><textarea value={form.setDescription} onChange={(event) => update("setDescription", event.target.value)} placeholder="例如：衬衫、半裙、领结、袜子" /></label></>}</div>}
                {form.category === "body" && <div className="conditional-panel"><h3>娃体资料</h3><div className="two-columns"><label className="text-field"><span>娃社</span><input value={form.maker} onChange={(event) => update("maker", event.target.value)} /></label><label className="text-field"><span>型号</span><input value={form.model} onChange={(event) => update("model", event.target.value)} /></label></div><label className="text-field"><span>肤色</span><input value={form.skinTone} onChange={(event) => update("skinTone", event.target.value)} /></label></div>}
                {form.category === "head" && <div className="conditional-panel"><h3>娃头资料</h3><div className="two-columns"><label className="text-field"><span>娃社</span><input value={form.maker} onChange={(event) => update("maker", event.target.value)} /></label><label className="text-field"><span>头雕名称</span><input value={form.sculptName} onChange={(event) => update("sculptName", event.target.value)} /></label></div><label className="text-field"><span>肤色</span><input value={form.skinTone} onChange={(event) => update("skinTone", event.target.value)} /></label></div>}
                {form.category === "accessory" && <div className="conditional-panel"><h3>配件资料</h3><label className="text-field"><span>配件类型</span><select value={form.accessoryType} onChange={(event) => update("accessoryType", event.target.value)}><option value="">请选择</option>{["假发", "眼珠", "鞋", "首饰", "道具", "包", "其他"].map((value) => <option key={value}>{value}</option>)}</select></label></div>}
                <div className="two-columns"><label className="text-field"><span>品牌或店铺</span><input value={form.brandOrShop} onChange={(event) => update("brandOrShop", event.target.value)} placeholder="娃社、工作室或店铺" /></label><label className="text-field"><span>备注</span><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="任何想记下的内容" /></label></div>
              </div>
            )}
          </div>
          <div className="form-bottom-space"></div>
          <div className="sticky-save"><div className="autosave-indicator"><span className={saveState}></span>{editingId ? "编辑模式" : saveState === "saving" ? "正在保存草稿…" : saveState === "saved" ? "草稿已保存" : "离开后可恢复草稿"}</div><div><button className="secondary-button" onClick={() => saveItem(true)}>保存并继续添加</button><button className="primary-button" onClick={() => saveItem(false)}>保存</button></div></div>
        </div>
      )}

      {view === "detail" && selected && (
        <div className="page detail-page">
          <button className="back-button" onClick={() => showList()}>← 返回列表</button>
          <div className="detail-layout">
            <div className={`detail-image category-bg-${selected.category}`}>
              {selected.images.length ? <img src={(selected.images.find((image) => image.id === selected.coverImageId) ?? selected.images[0]).dataUrl} alt={selected.name} /> : <><span>{CATEGORY[selected.category].short}</span><small>NO IMAGE</small></>}
              <div className="image-count">{selected.images.length ? `${selected.images.length} 张图片` : "尚未添加图片"}</div>
            </div>
            <div className="detail-info">
              <div className="detail-kicker"><span>{CATEGORY[selected.category].label}</span><i>·</i><span>{STATUS[selected.status]}</span></div>
              <h1>{selected.name}</h1>
              {selected.status === "balance_due" && getBalanceCountdown(selected.balanceDueDate) && <div className="detail-countdown">{getBalanceCountdown(selected.balanceDueDate)}</div>}
              <div className="detail-tags">{selected.sizeTags.map((tag) => <span key={tag}>{tag}</span>)}{selected.styleTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              {selected.price !== undefined && <div className="detail-price"><small>购入价格</small><strong>¥ {selected.price.toLocaleString("zh-CN")}</strong></div>}
              <dl className="detail-list">
                {selected.brandOrShop && <><dt>品牌 / 店铺</dt><dd>{selected.brandOrShop}</dd></>}
                {selected.maker && <><dt>娃社</dt><dd>{selected.maker}</dd></>}
                {selected.model && <><dt>型号</dt><dd>{selected.model}</dd></>}
                {selected.sculptName && <><dt>头雕名称</dt><dd>{selected.sculptName}</dd></>}
                {selected.skinTone && <><dt>肤色</dt><dd>{selected.skinTone}</dd></>}
                {selected.accessoryType && <><dt>配件类型</dt><dd>{selected.accessoryType}</dd></>}
                {selected.balanceAmount !== undefined && <><dt>需补尾款</dt><dd>¥ {selected.balanceAmount.toLocaleString("zh-CN")}</dd></>}
                {selected.balanceDueDate && <><dt>补款截止</dt><dd>{selected.balanceDueDate}</dd></>}
                {selected.estimatedShipping && <><dt>预计出货</dt><dd>{selected.estimatedShipping}</dd></>}
                {selected.receivedDate && <><dt>收货日期</dt><dd>{selected.receivedDate}</dd></>}
                {selected.setCount !== undefined && selected.clothingMode === "set" && <><dt>套装点数</dt><dd>{selected.setCount} 点</dd></>}
                {selected.setDescription && <><dt>套装内容</dt><dd>{selected.setDescription}</dd></>}
                {selected.notes && <><dt>备注</dt><dd>{selected.notes}</dd></>}
              </dl>
              <div className="detail-actions"><button className="primary-button" onClick={() => startEdit(selected)}>编辑</button><button className="secondary-button" onClick={() => startNew({ copy: selected })}>复制并新建</button><button className="danger-button" onClick={() => deleteItem(selected)}>删除</button></div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
      <nav className="mobile-nav"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span>首页</button><button className={view === "items" ? "active" : ""} onClick={() => showList()}><span>□</span>衣橱</button><button className="mobile-add" onClick={() => startNew({ preserve: draftDirty })}><span>＋</span>添加</button></nav>
    </main>
  );
}

function TagSelector({ title, mode, form, options, onToggle, onOpen }: { title: string; mode: "size" | "style"; form: FormState; options: string[]; onToggle: (type: "size" | "style", tag: string) => void; onOpen: () => void }) {
  const selected = mode === "size" ? form.sizeTags : form.styleTags;
  return <div className="tag-field" onClick={onOpen}><div className="tag-heading"><label className="field-label">{title}</label><small>可多选</small></div><div className="tag-list">{Array.from(new Set(options)).map((tag) => <button type="button" key={tag} className={selected.includes(tag) ? "selected" : ""} onClick={() => onToggle(mode, tag)}>{selected.includes(tag) ? "✓ " : ""}{tag}</button>)}</div></div>;
}

function ItemGrid({ items, onOpen }: { items: Item[]; onOpen: (item: Item) => void }) {
  return <div className="item-grid">{items.map((item) => {
    const cover = item.images.find((image) => image.id === item.coverImageId) ?? item.images[0];
    return <button className="item-card" key={item.id} onClick={() => onOpen(item)}><div className={`card-image category-bg-${item.category}`}>{cover ? <img src={cover.dataUrl} alt={item.name} /> : <><span>{CATEGORY[item.category].short}</span><small>WARDROBE ARCHIVE</small></>}<i>{CATEGORY[item.category].label}</i></div><div className="card-content"><div className="card-meta"><span>{STATUS[item.status]}</span>{item.status === "balance_due" && getBalanceCountdown(item.balanceDueDate) && <b>{getBalanceCountdown(item.balanceDueDate)}</b>}</div><h3>{item.name}</h3><div className="card-tags">{item.sizeTags.slice(0, 1).map((tag) => <span key={tag}>{tag}</span>)}{item.styleTags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></div></button>;
  })}</div>;
}
