
# -*- coding: utf-8 -*-
"""
Notion/筆記 檔名正規化 + 內容分群標準化（GUI）
------------------------------------------------
功能
- 以 GUI 選資料夾，批次重新命名：保留第一個空格（含全形空格）之前的文字 + 原始附檔名
- 可選：處理內容（.md / .html），將章節標題正規化為「錨點」以利前端分群
- 支援：包含子資料夾、先預覽後執行、自動避免重名（_1, _2, ...）、自動備份 .bak

正規化錨點（Canonical anchors, 依序）
- 快速重點
- 解釋/定義（同義詞：解釋、定義）
- 詳細說明（同義詞：說明、內容）
- 常見考點/易錯點（同義詞：常見考點、易錯點）
- 舉例說明（同義詞：例子、範例）

標題偵測規則
- Markdown：偵測 H1/H2/H3 -> 統一改成 H2，並把標題文字正規化成上列錨點（若命中）
- Markdown：若整份沒有任何標題，則在最前面插入「## 詳細說明」
- Markdown：若出現獨立一行的錨點文字（可能帶冒號），也會轉為「## <錨點>」
- HTML：將 <h1>/<h2>/<h3> 統一替換為 <h2>，並正規化錨點。若完全沒有標題，則在最前方插入 <h2>詳細說明</h2>

內容清理
- 移除單獨一行的 '---'
- 移除「建立時間：」「科目：」等中繼資料行（開頭比對，支援全形冒號）
- 其餘內容不變

使用
  python notion_map_pages.py

需求
  - Python 3（內建 tkinter）
"""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import os
import re
from typing import Tuple, List

FULLWIDTH_SPACE = "　"  # 全形空格

# ========== Canonical anchors & normalization ==========
CANON_ORDER = ["快速重點","解釋/定義","詳細說明","常見考點/易錯點","舉例說明"]

SYNONYMS = {
    "快速重點": {"快速重點","重點"},
    "解釋/定義": {"解釋/定義","解釋","定義"},
    "詳細說明": {"詳細說明","說明","內容"},
    "常見考點/易錯點": {"常見考點/易錯點","常見考點","易錯點"},
    "舉例說明": {"舉例說明","範例","例子"},
}

def normalize_anchor(text: str) -> str | None:
    t = (text or "").strip()
    # 去除所有空白、全形／->半形/
    t_comp = re.sub(r"\s+", "", t)
    t_comp = t_comp.replace("／","/")
    # 逐一比對
    for canon, alts in SYNONYMS.items():
        if t in alts or t_comp in {a.replace("／","/") for a in alts}:
            return canon
    return None

# ========== File name helpers ==========
def split_at_first_space(stem: str) -> Tuple[str, bool]:
    if not stem:
        return stem, False
    idx = stem.find(" ")
    if idx == -1:
        idx = stem.find(FULLWIDTH_SPACE)
    if idx == -1:
        return stem, False
    prefix = stem[:idx]
    return prefix, True

def make_unique(target: Path) -> Path:
    if not target.exists():
        return target
    base = target.stem
    suffix = target.suffix
    parent = target.parent
    i = 1
    while True:
        cand = parent / f"{base}_{i}{suffix}"
        if not cand.exists():
            return cand
        i += 1

# ========== Content processors ==========
META_LINE_RE = re.compile(r"^\s*(建立時間|科目)\s*[:：]")
HR_LINE_RE = re.compile(r"^\s*-{3,}\s*$")

def cleanup_common_lines(text: str) -> str:
    lines = text.splitlines()
    out: List[str] = []
    for ln in lines:
        if HR_LINE_RE.match(ln):
            continue
        if META_LINE_RE.match(ln):
            continue
        out.append(ln)
    return "\n".join(out).strip() + "\n"

# ---- Markdown ----
MD_H_RE = re.compile(r"^(\s{0,3})(#{1,3})\s+(.+?)\s*$")
MD_BARE_ANCHOR_RE = re.compile(r"^\s*(快速重點|解釋/?定義|解釋|定義|詳細說明|說明|內容|常見考點/?易錯點|常見考點|易錯點|舉例說明|範例|例子)\s*[：:：]?\s*$")

def process_markdown(text: str, page_title: str = "") -> str:
    text = cleanup_common_lines(text)

    lines = text.splitlines()
    out: List[str] = []
    saw_any_heading = False

    for i, ln in enumerate(lines):
        m = MD_H_RE.match(ln)
        if m:
            indent, hashes, title = m.groups()
            canon = normalize_anchor(title)
            saw_any_heading = True
            if canon:
                out.append(f"## {canon}")
            else:
                # 移除與頁面標題重複的 H1/H2/H3
                if page_title and title.strip() == page_title.strip():
                    continue
                # 統一轉 H2
                out.append(f"## {title.strip()}")
            continue

        # 沒有 # 的裸錨點（單獨一行）
        bm = MD_BARE_ANCHOR_RE.match(ln)
        if bm:
            canon = normalize_anchor(bm.group(1).replace("/","/"))
            if canon:
                saw_any_heading = True
                out.append(f"## {canon}")
                continue

        out.append(ln)

    if not saw_any_heading:
        # 整份沒有任何標題：在最前面插入「詳細說明」
        body = "\n".join(out).strip()
        if body:
            return f"## 詳細說明\n\n{body}\n"
        else:
            return body

    return "\n".join(out).strip() + "\n"

# ---- HTML ----
HTML_H_RE = re.compile(r"<\s*h([1-3])\s*>\s*(.*?)\s*<\s*/\s*h[1-3]\s*>", flags=re.IGNORECASE | re.DOTALL)

def strip_html_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s).strip()

def process_html(html: str, page_title: str = "") -> str:
    text = cleanup_common_lines(html)

    def repl(m: re.Match) -> str:
        _level = m.group(1)
        inner = m.group(2)
        plain = strip_html_tags(inner)
        canon = normalize_anchor(plain)
        if canon:
            return f"<h2>{canon}</h2>"
        else:
            if page_title and plain == page_title:
                return ""  # 刪除與頁面標題相同的 heading
            return f"<h2>{plain}</h2>"

    new = HTML_H_RE.sub(repl, text)

    # 若完全沒有任何 h1/h2/h3，補一個「詳細說明」在最前
    if not re.search(r"<\s*h[1-3]\b", new, flags=re.IGNORECASE):
        new = "<h2>詳細說明</h2>\n" + new
    return new

# ========== GUI App ==========
class RenamerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("批次重新命名 + 內容分群標準化")
        self.geometry("1024x620")
        self.minsize(920, 560)

        self.selected_dir: Path | None = None
        self.include_subdirs = tk.BooleanVar(value=False)
        self.do_content = tk.BooleanVar(value=True)
        self.do_backup = tk.BooleanVar(value=True)
        self.rows = []  # [(src_path, suggested_new_name, status)]

        self._build_ui()

    def _build_ui(self):
        topbar = ttk.Frame(self, padding=8)
        topbar.pack(side=tk.TOP, fill=tk.X)

        self.dir_label_var = tk.StringVar(value="尚未選擇資料夾")
        ttk.Button(topbar, text="選擇資料夾…", command=self.on_choose_dir).pack(side=tk.LEFT)
        ttk.Checkbutton(topbar, text="包含子資料夾", variable=self.include_subdirs).pack(side=tk.LEFT, padx=(10,0))
        ttk.Checkbutton(topbar, text="處理內容（.md/.html）", variable=self.do_content).pack(side=tk.LEFT, padx=(10,0))
        ttk.Checkbutton(topbar, text="建立 .bak 備份", variable=self.do_backup).pack(side=tk.LEFT, padx=(10,0))
        ttk.Label(topbar, textvariable=self.dir_label_var).pack(side=tk.LEFT, padx=10)

        btnbar = ttk.Frame(self, padding=(8,0))
        btnbar.pack(side=tk.TOP, fill=tk.X)
        ttk.Button(btnbar, text="預覽", command=self.on_preview).pack(side=tk.LEFT)
        ttk.Button(btnbar, text="執行", command=self.on_run).pack(side=tk.LEFT, padx=(8,0))
        ttk.Button(btnbar, text="清空列表", command=self.clear_table).pack(side=tk.LEFT, padx=(8,0))

        cols = ("old", "new", "status")
        self.tree = ttk.Treeview(self, columns=cols, show="headings", height=18)
        self.tree.heading("old", text="原檔名")
        self.tree.heading("new", text="新檔名（預覽）")
        self.tree.heading("status", text="狀態")
        self.tree.column("old", width=420, anchor="w")
        self.tree.column("new", width=360, anchor="w")
        self.tree.column("status", width=200, anchor="w")
        self.tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=8, pady=8)

        self.status_var = tk.StringVar(value="就緒")
        status = ttk.Label(self, textvariable=self.status_var, anchor="w", relief=tk.SUNKEN)
        status.pack(side=tk.BOTTOM, fill=tk.X)

    def on_choose_dir(self):
        d = filedialog.askdirectory(title="選擇要處理的資料夾")
        if not d:
            return
        self.selected_dir = Path(d)
        self.dir_label_var.set(str(self.selected_dir))
        self.status_var.set("已選擇資料夾，請按『預覽』。")

    def clear_table(self):
        for i in self.tree.get_children():
            self.tree.delete(i)
        self.rows.clear()
        self.status_var.set("已清空列表。")

    def _scan_files(self) -> list[Path]:
        files = []
        if not self.selected_dir:
            return files
        if self.include_subdirs.get():
            for p in self.selected_dir.rglob("*"):
                if p.is_file():
                    files.append(p)
        else:
            for p in self.selected_dir.iterdir():
                if p.is_file():
                    files.append(p)
        return files

    def on_preview(self):
        if not self.selected_dir:
            messagebox.showwarning("提醒", "請先選擇資料夾。")
            return
        self.clear_table()
        files = self._scan_files()
        if not files:
            self.status_var.set("資料夾內沒有檔案。")
            return

        for src in files:
            stem = src.stem
            prefix, had_space = split_at_first_space(stem)
            if had_space and prefix.strip():
                new_name = f"{prefix}{src.suffix}"
                status = "待處理"
            else:
                new_name = src.name
                status = "略過（無空格）"

            self.rows.append((src, new_name, status))
            self.tree.insert("", tk.END, values=(src.name, new_name, status))

        self.status_var.set(f"預覽完成，共 {len(self.rows)} 筆。")

    def on_run(self):
        if not self.rows:
            messagebox.showinfo("資訊", "沒有可處理的項目，請先點『預覽』。")
            return
        todo = [r for r in self.rows if r[2].startswith("待處理") or r[2].startswith("略過（無空格）")]
        if not todo:
            messagebox.showinfo("資訊", "沒有需要處理的檔案。")
            return
        if not messagebox.askyesno("確認", f"將處理 {len(todo)} 個檔案（含內容標準化），確定執行？"):
            return

        success = 0
        for idx, (src, new_name, status) in enumerate(self.rows):
            # 1) 重新命名（若必要）
            target = src if new_name == src.name else src.with_name(new_name)
            if target != src:
                if target.exists() and target.resolve() != src.resolve():
                    target = make_unique(target)
                try:
                    os.rename(src, target)
                except Exception as e:
                    self.rows[idx] = (src, new_name, f"重新命名失敗：{e}")
                    continue  # 下一個
            else:
                # 不需改名
                target = src

            # 2) 內容標準化（可選）
            try:
                if self.do_content.get() and target.suffix.lower() in {".md",".html"}:
                    if self.do_backup.get():
                        bak = target.with_suffix(target.suffix + ".bak")
                        if not bak.exists():
                            bak.write_bytes(target.read_bytes())

                    data = target.read_text(encoding="utf-8", errors="ignore")
                    page_title = target.stem  # 以檔名（去副檔名）作為頁標題
                    if target.suffix.lower() == ".md":
                        new_data = process_markdown(data, page_title=page_title)
                    else:
                        new_data = process_html(data, page_title=page_title)
                    target.write_text(new_data, encoding="utf-8")
                    self.rows[idx] = (target, target.name, "已重新命名 + 內容已正規化")
                else:
                    self.rows[idx] = (target, target.name, "已重新命名" if target != src else "略過（無變更）")
                success += 1
            except Exception as e:
                self.rows[idx] = (target, target.name, f"內容處理失敗：{e}")

        # 更新表格
        for i in self.tree.get_children():
            self.tree.delete(i)
        for src, new_name, st in self.rows:
            self.tree.insert("", tk.END, values=(src.name, new_name, st))

        self.status_var.set(f"完成：成功 {success} 筆。")

def main():
    app = RenamerApp()
    app.mainloop()

if __name__ == "__main__":
    main()
