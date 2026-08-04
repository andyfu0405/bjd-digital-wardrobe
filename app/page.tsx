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
type ThemeId = "cobalt" | "berry" | "cloud" | "mint";

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
  purchaseChannel?: string;
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
  accessoryTypeOther?: string;
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
  purchaseChannel: string;
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
  accessoryTypeOther: string;
};

type WardrobeBackup = {
  format: "bjd-digital-wardrobe";
  version: 1;
  exportedAt: string;
  items: Item[];
  draft?: FormState;
  sizeTags: string[];
  styleTags: string[];
  deletedSizeTags: string[];
  deletedStyleTags: string[];
  theme: ThemeId;
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

const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: "cobalt", label: "雾蓝", description: "清透蓝白" },
  { id: "berry", label: "莓果", description: "柔和莓粉" },
  { id: "cloud", label: "云灰", description: "冷静灰调" },
  { id: "mint", label: "薄荷", description: "清爽薄荷" },
];

const emptyForm = (category: Category = "clothing", status: Status = "received"): FormState => ({
  name: "",
  category,
  status,
  images: [],
  coverImageId: undefined,
  price: "",
  sizeTags: [],
  styleTags: [],
  purchaseChannel: "",
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
  accessoryTypeOther: "",
});

const toForm = (item: Item): FormState => ({
  ...emptyForm(item.category, item.status),
  name: item.name,
  images: item.images,
  coverImageId: item.coverImageId,
  price: item.price?.toString() ?? "",
  sizeTags: item.sizeTags,
  styleTags: item.styleTags,
  purchaseChannel: item.purchaseChannel ?? "",
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
  accessoryTypeOther: item.accessoryTypeOther ?? "",
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
  const [nameError, setNameError] = useState("");
  const [trialGuideVisible, setTrialGuideVisible] = useState(true);
  const [theme, setTheme] = useState<ThemeId>("cobalt");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [sizeTagInput, setSizeTagInput] = useState("");
  const [styleTagInput, setStyleTagInput] = useState("");
  const [customSizeTags, setCustomSizeTags] = useState<string[]>([]);
  const [customStyleTags, setCustomStyleTags] = useState<string[]>([]);
  const [deletedSizeTags, setDeletedSizeTags] = useState<string[]>([]);
  const [deletedStyleTags, setDeletedStyleTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sort, setSort] = useState("created");
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    Promise.all([
      readLocal<Item[]>("items"),
      readLocal<FormState>("draft"),
      readLocal<string[]>("size-tags"),
      readLocal<string[]>("style-tags"),
      readLocal<string[]>("deleted-size-tags"),
      readLocal<string[]>("deleted-style-tags"),
      readLocal<ThemeId>("theme"),
      readLocal<boolean>("trial-guide-dismissed"),
    ])
      .then(([savedItems, draft, sizes, styles, deletedSizes, deletedStyles, savedTheme, trialGuideDismissed]) => {
        const initial = savedItems ?? sampleItems();
        setItems(initial);
        if (!savedItems) writeLocal("items", initial);
        if (draft) {
          setForm({ ...emptyForm(draft.category, draft.status), ...draft });
          setDraftDirty(true);
          setDraftRestored(true);
        }
        setCustomSizeTags(sizes ?? []);
        setCustomStyleTags(styles ?? []);
        setDeletedSizeTags(deletedSizes ?? []);
        setDeletedStyleTags(deletedStyles ?? []);
        if (savedTheme && THEMES.some((item) => item.id === savedTheme)) setTheme(savedTheme);
        setTrialGuideVisible(!trialGuideDismissed);
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
    if (key === "name" && String(value).trim()) setNameError("");
    if (!editingId) setDraftDirty(true);
  }

  function dismissTrialGuide() {
    setTrialGuideVisible(false);
    writeLocal("trial-guide-dismissed", true);
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
      if (source.category !== "body" && source.category !== "head") copied.brandOrShop = source.brandOrShop ?? "";
      copied.clothingMode = source.clothingMode ?? "single";
      copied.setCount = source.setCount?.toString() ?? "";
      copied.setDescription = source.setDescription ?? "";
      copied.maker = source.maker ?? "";
      copied.model = source.model ?? "";
      copied.sculptName = source.sculptName ?? "";
      copied.skinTone = source.skinTone ?? "";
      copied.accessoryType = source.accessoryType ?? "";
      copied.accessoryTypeOther = source.accessoryTypeOther ?? "";
      setForm(copied);
      setDraftDirty(true);
    } else if (!options?.preserve) {
      setForm(emptyForm(form.category, form.status));
      setDraftDirty(false);
    }
    setEditingId(undefined);
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: Item) {
    setForm(toForm(item));
    setEditingId(item.id);
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

  function createTag(type: "size" | "style", input: string) {
    const clean = input.trim();
    if (!clean) return;
    const known = type === "size" ? [...SIZE_TAGS, ...customSizeTags] : [...STYLE_TAGS, ...customStyleTags];
    const existing = known.find((tag) => tag.toLocaleLowerCase() === clean.toLocaleLowerCase());
    const value = existing ?? clean;
    if (existing && type === "size" && deletedSizeTags.some((tag) => tag.toLocaleLowerCase() === existing.toLocaleLowerCase())) {
      const next = deletedSizeTags.filter((tag) => tag.toLocaleLowerCase() !== existing.toLocaleLowerCase());
      setDeletedSizeTags(next);
      writeLocal("deleted-size-tags", next);
    }
    if (existing && type === "style" && deletedStyleTags.some((tag) => tag.toLocaleLowerCase() === existing.toLocaleLowerCase())) {
      const next = deletedStyleTags.filter((tag) => tag.toLocaleLowerCase() !== existing.toLocaleLowerCase());
      setDeletedStyleTags(next);
      writeLocal("deleted-style-tags", next);
    }
    if (!existing) {
      if (type === "size") {
        const next = [clean, ...customSizeTags];
        setCustomSizeTags(next);
        writeLocal("size-tags", next);
      } else {
        const next = [clean, ...customStyleTags];
        setCustomStyleTags(next);
        writeLocal("style-tags", next);
      }
    }
    toggleTag(type, value);
    if (type === "size") setSizeTagInput("");
    else setStyleTagInput("");
  }

  function deleteTag(type: "size" | "style", tag: string) {
    if (type === "size") {
      if (customSizeTags.includes(tag)) {
        const next = customSizeTags.filter((value) => value !== tag);
        setCustomSizeTags(next);
        writeLocal("size-tags", next);
      } else {
        const next = Array.from(new Set([tag, ...deletedSizeTags]));
        setDeletedSizeTags(next);
        writeLocal("deleted-size-tags", next);
      }
      update("sizeTags", form.sizeTags.filter((value) => value !== tag));
    } else {
      if (customStyleTags.includes(tag)) {
        const next = customStyleTags.filter((value) => value !== tag);
        setCustomStyleTags(next);
        writeLocal("style-tags", next);
      } else {
        const next = Array.from(new Set([tag, ...deletedStyleTags]));
        setDeletedStyleTags(next);
        writeLocal("deleted-style-tags", next);
      }
      update("styleTags", form.styleTags.filter((value) => value !== tag));
    }
    setToast(`已删除标签“${tag}”`);
  }

  function selectTheme(next: ThemeId) {
    setTheme(next);
    setThemeMenuOpen(false);
    writeLocal("theme", next);
  }

  function saveItem(continueAdding = false) {
    if (!form.name.trim()) {
      setNameError("请填写名称后再保存");
      setToast("名称是必填项");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const now = new Date().toISOString();
    const existing = editingId ? items.find((item) => item.id === editingId) : undefined;
    const name = form.name.trim();
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
      purchaseChannel: form.purchaseChannel || undefined,
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
      accessoryTypeOther: form.accessoryTypeOther.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setItems((current) => existing ? current.map((value) => value.id === item.id ? item : value) : [item, ...current]);
    if (!editingId) writeLocal("draft", undefined);
    if (!editingId) dismissTrialGuide();
    setDraftDirty(false);
    setDraftRestored(false);
    setToast(existing ? "修改已保存" : "物品已加入衣橱");
    if (continueAdding) {
      const next = emptyForm(form.category, form.status);
      next.sizeTags = form.sizeTags;
      next.styleTags = form.styleTags;
      setForm(next);
      setEditingId(undefined);
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

  function exportWardrobe() {
    const backup: WardrobeBackup = {
      format: "bjd-digital-wardrobe",
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
      draft: draftDirty && !editingId ? form : undefined,
      sizeTags: customSizeTags,
      styleTags: customStyleTags,
      deletedSizeTags,
      deletedStyleTags,
      theme,
    };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `BJD衣橱备份-${new Date().toLocaleDateString("zh-CN").replaceAll("/", "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("衣橱备份已导出");
  }

  async function importWardrobe(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<WardrobeBackup>;
      if (parsed.format !== "bjd-digital-wardrobe" || parsed.version !== 1 || !Array.isArray(parsed.items)) {
        throw new Error("invalid backup");
      }
      if (items.length && !window.confirm(`导入将替换当前的 ${items.length} 件藏品，确认继续吗？`)) return;
      const nextTheme = THEMES.some((item) => item.id === parsed.theme) ? parsed.theme! : "cobalt";
      const nextDraft = parsed.draft;
      setItems(parsed.items);
      setCustomSizeTags(parsed.sizeTags ?? []);
      setCustomStyleTags(parsed.styleTags ?? []);
      setDeletedSizeTags(parsed.deletedSizeTags ?? []);
      setDeletedStyleTags(parsed.deletedStyleTags ?? []);
      setTheme(nextTheme);
      if (nextDraft) {
        setForm({ ...emptyForm(nextDraft.category, nextDraft.status), ...nextDraft });
        setDraftDirty(true);
      } else {
        setForm(emptyForm());
        setDraftDirty(false);
      }
      await Promise.all([
        writeLocal("items", parsed.items),
        writeLocal("draft", nextDraft),
        writeLocal("size-tags", parsed.sizeTags ?? []),
        writeLocal("style-tags", parsed.styleTags ?? []),
        writeLocal("deleted-size-tags", parsed.deletedSizeTags ?? []),
        writeLocal("deleted-style-tags", parsed.deletedStyleTags ?? []),
        writeLocal("theme", nextTheme),
      ]);
      setSelectedId(undefined);
      setEditingId(undefined);
      setView("home");
      setToast(`已导入 ${parsed.items.length} 件藏品`);
    } catch {
      setToast("无法导入：请选择本应用导出的备份文件");
    }
  }

  const sizeOptions = [...customSizeTags, ...SIZE_TAGS].filter((tag) => !deletedSizeTags.includes(tag));
  const styleOptions = [...customStyleTags, ...STYLE_TAGS].filter((tag) => !deletedStyleTags.includes(tag));
  const priceOnlyField = <label className="text-field compact-date"><span>价格 <small>人民币</small></span><div className="price-input"><b>¥</b><input type="number" min="0" inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0.00" /></div></label>;
  const sizeFields = <>
    <TagSelector title="尺寸" mode="size" form={form} options={sizeOptions} onToggle={toggleTag} onDelete={deleteTag} />
    <TagCreateField label="添加尺寸标签" value={sizeTagInput} onChange={setSizeTagInput} onCreate={() => createTag("size", sizeTagInput)} />
  </>;
  const styleFields = <>
    <TagSelector title="风格" mode="style" form={form} options={styleOptions} onToggle={toggleTag} onDelete={deleteTag} />
    <TagCreateField label="输入自己的风格" value={styleTagInput} onChange={setStyleTagInput} onCreate={() => createTag("style", styleTagInput)} emphasized />
  </>;

  if (!hydrated) {
    return <main className="loading-screen"><div className="loading-mark"><img src="/app-icon.svg" alt="" /></div><p>正在打开你的数字衣橱…</p></main>;
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="返回首页">
          <span className="brand-mark"><img src="/app-icon.svg" alt="" /></span>
          <span><strong>BJD Wardrobe</strong><small>数字衣橱</small></span>
        </button>
        <nav className="desktop-nav" aria-label="主导航">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>首页</button>
          <button className={view === "items" ? "active" : ""} onClick={() => showList()}>全部物品</button>
        </nav>
        <div className="theme-menu">
          <button className="theme-trigger" type="button" aria-expanded={themeMenuOpen} onClick={() => setThemeMenuOpen((value) => !value)}>
            <span className={`theme-dot theme-dot-${theme}`}></span><span>配色</span>
          </button>
          {themeMenuOpen && <div className="theme-popover" aria-label="选择主题配色">
            <strong>主题配色</strong>
            {THEMES.map((item) => <button key={item.id} type="button" className={theme === item.id ? "selected" : ""} onClick={() => selectTheme(item.id)}><span className={`theme-preview theme-preview-${item.id}`}><i></i><i></i><i></i></span><span><b>{item.label}</b><small>{item.description}</small></span>{theme === item.id && <em>已选</em>}</button>)}
          </div>}
        </div>
        <button className="header-add" onClick={() => startNew({ preserve: draftDirty })}>＋ 添加物品</button>
      </header>

      {view === "home" && (
        <div className="page home-page">
          <section className="hero">
            <div>
              <p className="eyebrow">MY COLLECTION · 本机保存</p>
              <h1>把喜欢的，<br /><em>好好收藏。</em></h1>
              <p className="hero-copy"><span>一个安静、轻盈的 BJD 数字衣橱。</span><span>随手记下新到的衣物、娃体、娃头与配件。</span></p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => startNew({ preserve: draftDirty })}>添加一件物品 <span>→</span></button>
                {draftDirty && <button className="text-button" onClick={() => startNew({ preserve: true })}>继续编辑草稿</button>}
              </div>
            </div>
            <div className="collection-stamp" aria-label={`共收藏 ${items.length} 件`}>
              <span>COLLECTION</span><strong>{String(items.length).padStart(2, "0")}</strong><small>件藏品</small>
            </div>
          </section>

          {trialGuideVisible && items.some((item) => item.id.startsWith("sample-")) && (
            <div className="sample-note"><div><span>试用提示</span><p>已放入 4 件示例藏品，你可以直接编辑或删除它们。</p></div><button type="button" onClick={dismissTrialGuide}>知道了</button></div>
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

          <section className="section-block data-transfer-section">
            <div className="data-transfer-copy"><p>数据与迁移</p><h2>把衣橱带到新网址</h2><span>备份文件包含藏品、图片、标签和未完成草稿，只保存在你选择的位置。</span></div>
            <div className="data-transfer-actions">
              <button type="button" className="secondary-button" onClick={exportWardrobe}>导出衣橱</button>
              <button type="button" className="primary-button" onClick={() => backupFileRef.current?.click()}>导入衣橱</button>
              <input ref={backupFileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importWardrobe} />
            </div>
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
            <span>填写名称，再选择分类和状态。其他内容都可以以后再补。</span>
          </div>

          {draftRestored && !editingId && <div className="draft-banner"><div><strong>已恢复上次的草稿</strong><span>你可以从离开的位置继续填写。</span></div><button onClick={() => { setForm(emptyForm()); setDraftDirty(false); setDraftRestored(false); writeLocal("draft", undefined); }}>舍弃草稿</button></div>}

          <div className="form-card">
            <div className="form-section-title"><div><h2>必要信息</h2><p>三项填完即可保存</p></div><i>必填</i></div>
            <div className="field-group required-name-field">
              <label className="field-label" htmlFor="item-name">名称 <b>必填</b></label>
              <input id="item-name" className={nameError ? "field-error" : ""} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：雾蓝学院套装" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "item-name-error" : undefined} />
              {nameError && <small id="item-name-error" className="field-error-message">{nameError}</small>}
            </div>
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
              {form.status === "balance_due" && <div className="balance-quick"><div className="balance-quick-heading"><strong>补款与出货</strong><span>全部选填，留空也可以保存</span></div><div className="two-columns"><label className="text-field"><span>需补尾款 <small>选填</small></span><div className="price-input"><b>¥</b><input type="number" min="0" inputMode="decimal" value={form.balanceAmount} onChange={(event) => update("balanceAmount", event.target.value)} placeholder="0.00" /></div></label><label className="text-field"><span>补款截止日期 <small>选填</small></span><input type="date" value={form.balanceDueDate} onChange={(event) => update("balanceDueDate", event.target.value)} /></label></div><label className="text-field shipping-field"><span>预计出货时间 <small>选填</small></span><input value={form.estimatedShipping} onChange={(event) => update("estimatedShipping", event.target.value)} placeholder="例如：2026 年 9 月 / 秋季" /></label></div>}
              {(form.status === "paid_waiting_receipt" || form.status === "waiting_for_balance_notice") && <div className="balance-quick shipping-quick"><div className="balance-quick-heading"><strong>出货信息</strong><span>选填，之后也可以补充</span></div><label className="text-field shipping-field"><span>预计出货时间 <small>选填</small></span><input value={form.estimatedShipping} onChange={(event) => update("estimatedShipping", event.target.value)} placeholder="例如：2026 年 9 月 / 秋季" /></label></div>}
            </div>
          </div>

          <div className="form-card quick-card">
            <div className="form-section-title"><div><h2>常用信息</h2><p>想填就填，之后也能补充</p></div><i>选填</i></div>
            <div className="image-picker">
              <div className="image-picker-heading"><label className="field-label">图片</label><small>第一张自动成为封面</small></div>
              <div className="image-strip">
                {form.images.map((image) => <div key={image.id} className={`image-thumb ${form.coverImageId === image.id ? "cover" : ""}`}><img src={image.dataUrl} alt="待保存物品" /><button className="set-cover" onClick={() => update("coverImageId", image.id)}>{form.coverImageId === image.id ? "封面" : "设为封面"}</button><button className="remove-image" aria-label="删除图片" onClick={() => { const next = form.images.filter((value) => value.id !== image.id); update("images", next); if (form.coverImageId === image.id) update("coverImageId", next[0]?.id); }}>×</button></div>)}
                <button className="add-image" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}><strong>{uploading ? "…" : "+"}</strong><span>{uploading ? "正在压缩" : "相册 / 拍照"}</span><small>支持多选</small></button>
              </div>
              <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" capture={undefined} multiple onChange={handleImages} />
            </div>
            {form.category === "clothing" && <>
              {priceOnlyField}
              {sizeFields}
              {styleFields}
              <section className="category-fields"><h3>衣物组成</h3><p>先记单件或套装，需要时再补充内容。</p><div className="segmented"><button type="button" className={form.clothingMode === "single" ? "selected" : ""} onClick={() => update("clothingMode", "single")}>单件</button><button type="button" className={form.clothingMode === "set" ? "selected" : ""} onClick={() => update("clothingMode", "set")}>套装</button></div>{form.clothingMode === "set" && <><label className="text-field"><span>套装点数 <small>选填</small></span><input type="number" min="0" value={form.setCount} onChange={(event) => update("setCount", event.target.value)} placeholder="例如：5" /></label><label className="text-field"><span>套装内容 <small>选填</small></span><textarea value={form.setDescription} onChange={(event) => update("setDescription", event.target.value)} placeholder="例如：衬衫、半裙、领结、袜子" /></label></>}</section>
            </>}
            {form.category === "body" && <>
              <section className="category-fields category-fields-first"><h3>先确认娃体身份</h3><p>娃社、型号和肤色通常比物品名称更容易回想。</p><div className="two-columns"><label className="text-field"><span>娃社 <small>选填</small></span><input value={form.maker} onChange={(event) => update("maker", event.target.value)} placeholder="例如：龙魂" /></label><label className="text-field"><span>型号 <small>选填</small></span><input value={form.model} onChange={(event) => update("model", event.target.value)} /></label></div><label className="text-field"><span>肤色 <small>选填</small></span><input value={form.skinTone} onChange={(event) => update("skinTone", event.target.value)} /></label></section>
              {sizeFields}
              {priceOnlyField}
            </>}
            {form.category === "head" && <>
              <section className="category-fields category-fields-first"><h3>先确认娃头身份</h3><p>娃社、名称和肤色放在一起，查找与搭配都更直接。</p><div className="two-columns"><label className="text-field"><span>娃社 <small>选填</small></span><input value={form.maker} onChange={(event) => update("maker", event.target.value)} /></label><label className="text-field"><span>名称 <small>选填</small></span><input value={form.sculptName} onChange={(event) => update("sculptName", event.target.value)} /></label></div><label className="text-field"><span>肤色 <small>选填</small></span><input value={form.skinTone} onChange={(event) => update("skinTone", event.target.value)} /></label></section>
              {sizeFields}
              {priceOnlyField}
            </>}
            {form.category === "accessory" && <>
              <section className="category-fields category-fields-first"><h3>先确认配件类型</h3><p>按用途记录，之后找眼珠、假发或鞋会更快。</p><label className="text-field"><span>配件类型 <small>选填</small></span><select value={form.accessoryType} onChange={(event) => update("accessoryType", event.target.value)}><option value="">请选择</option>{["假发", "眼珠", "鞋", "首饰", "道具", "包", "其他"].map((value) => <option key={value}>{value}</option>)}</select></label>{form.accessoryType === "其他" && <label className="text-field"><span>具体是什么 <small>选填</small></span><input value={form.accessoryTypeOther} onChange={(event) => update("accessoryTypeOther", event.target.value)} placeholder="例如：支架、家具、收纳包" /></label>}</section>
              {sizeFields}
              {styleFields}
              {priceOnlyField}
            </>}
            <section className="common-details">
              <h3>购买与备注</h3><p>最后补充购买线索，不影响快速保存。</p>
              <div className={`purchase-fields ${(form.category === "body" || form.category === "head") ? "identity-purchase" : ""}`}><label className="text-field"><span>购买渠道 <small>选填</small></span><select value={form.purchaseChannel} onChange={(event) => update("purchaseChannel", event.target.value)}><option value="">请选择</option>{["淘宝", "微店", "小红书", "闲鱼"].map((value) => <option key={value}>{value}</option>)}</select></label>{form.category !== "body" && form.category !== "head" && <label className="text-field"><span>品牌或店铺 <small>选填</small></span><input value={form.brandOrShop} onChange={(event) => update("brandOrShop", event.target.value)} placeholder="工作室或店铺" /></label>}</div>
              {form.status === "received" && <label className="text-field compact-date"><span>收货日期 <small>选填</small></span><input type="date" value={form.receivedDate} onChange={(event) => update("receivedDate", event.target.value)} /></label>}
              <label className="text-field"><span>备注 <small>选填</small></span><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="任何想记下的内容" /></label>
            </section>
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
              <div className="detail-tags">{selected.sizeTags.map((tag) => <span key={tag}>{tag}</span>)}{(selected.category === "clothing" || selected.category === "accessory") && selected.styleTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              {selected.price !== undefined && <div className="detail-price"><small>购入价格</small><strong>¥ {selected.price.toLocaleString("zh-CN")}</strong></div>}
              <dl className="detail-list">
                {selected.purchaseChannel && <><dt>购买渠道</dt><dd>{selected.purchaseChannel}</dd></>}
                {selected.brandOrShop && selected.category !== "body" && selected.category !== "head" && <><dt>品牌 / 店铺</dt><dd>{selected.brandOrShop}</dd></>}
                {selected.maker && <><dt>娃社</dt><dd>{selected.maker}</dd></>}
                {selected.model && selected.model !== selected.name && <><dt>型号</dt><dd>{selected.model}</dd></>}
                {selected.sculptName && selected.sculptName !== selected.name && <><dt>名称</dt><dd>{selected.sculptName}</dd></>}
                {selected.skinTone && <><dt>肤色</dt><dd>{selected.skinTone}</dd></>}
                {selected.accessoryType && <><dt>配件类型</dt><dd>{selected.accessoryType === "其他" && selected.accessoryTypeOther ? selected.accessoryTypeOther : selected.accessoryType}</dd></>}
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

function TagSelector({ title, mode, form, options, onToggle, onDelete }: { title: string; mode: "size" | "style"; form: FormState; options: string[]; onToggle: (type: "size" | "style", tag: string) => void; onDelete: (type: "size" | "style", tag: string) => void }) {
  const selected = mode === "size" ? form.sizeTags : form.styleTags;
  return <div className="tag-field"><div className="tag-heading"><label className="field-label">{title}</label><small>可多选，点 × 删除标签</small></div><div className="tag-list">{Array.from(new Set(options)).map((tag) => <div className={`tag-chip ${selected.includes(tag) ? "selected" : ""}`} key={tag}><button className="tag-toggle" type="button" onClick={() => onToggle(mode, tag)}>{selected.includes(tag) ? "✓ " : ""}{tag}</button><button className="tag-delete" type="button" aria-label={`删除${title}标签“${tag}”`} onClick={() => onDelete(mode, tag)}>×</button></div>)}</div></div>;
}

function TagCreateField({ label, value, onChange, onCreate, emphasized = false }: { label: string; value: string; onChange: (value: string) => void; onCreate: () => void; emphasized?: boolean }) {
  return <div className={`tag-create-row ${emphasized ? "emphasized" : ""}`}><span>{label}</span><div><input value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreate(); } }} placeholder={emphasized ? "例如：森系、蒸汽朋克、洛丽塔" : "输入标签名称"} aria-label={label} /><button type="button" onClick={onCreate} disabled={!value.trim()}>添加</button></div></div>;
}

function ItemGrid({ items, onOpen }: { items: Item[]; onOpen: (item: Item) => void }) {
  return <div className="item-grid">{items.map((item) => {
    const cover = item.images.find((image) => image.id === item.coverImageId) ?? item.images[0];
    return <button className="item-card" key={item.id} onClick={() => onOpen(item)}><div className={`card-image category-bg-${item.category}`}>{cover ? <img src={cover.dataUrl} alt={item.name} /> : <><span>{CATEGORY[item.category].short}</span><small>WARDROBE ARCHIVE</small></>}<i>{CATEGORY[item.category].label}</i></div><div className="card-content"><div className="card-meta"><span>{STATUS[item.status]}</span>{item.status === "balance_due" && getBalanceCountdown(item.balanceDueDate) && <b>{getBalanceCountdown(item.balanceDueDate)}</b>}</div><h3>{item.name}</h3><div className="card-tags">{item.sizeTags.slice(0, 1).map((tag) => <span key={tag}>{tag}</span>)}{(item.category === "clothing" || item.category === "accessory") && item.styleTags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></div></button>;
  })}</div>;
}
