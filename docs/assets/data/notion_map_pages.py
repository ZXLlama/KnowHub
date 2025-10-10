# rename_trim_after_space.py
# -*- coding: utf-8 -*-
"""
功能：
- 以 GUI 介面選擇資料夾
- 將資料夾內的「所有檔案」重新命名：
  只保留第一個空格（或全形空格）之前的文字 + 原始附檔名
  並刪除第一個空格（含空格）之後的全部字元
- 先預覽，再執行；自動處理重名衝突（加 _1, _2, ...）

需求：
- Python 3（內建 tkinter）
使用：
  python rename_trim_after_space.py
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import os

FULLWIDTH_SPACE = "　"  # 全形空格

def split_at_first_space(stem: str):
    """
    回傳 (prefix, has_space)
    - 以半形空格 ' ' 為主；如無，嘗試全形空格 '　'
    - 沒有空格就回傳原字串、has_space=False
    """
    if not stem:
        return stem, False
    idx = stem.find(" ")
    if idx == -1:
        idx = stem.find(FULLWIDTH_SPACE)
    if idx == -1:
        return stem, False
    prefix = stem[:idx]
    return prefix, True

def make_unique(target: Path):
    """
    若 target 已存在，於檔名（副檔名前）加 _1, _2, ... 直到不衝突
    """
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

class RenamerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("批次重新命名（保留第一個空格前 + 附檔名）")
        self.geometry("900x520")
        self.minsize(820, 480)

        self.selected_dir: Path | None = None
        self.include_subdirs = tk.BooleanVar(value=False)
        self.rows = []  # [(src_path, new_name, status)]

        self._build_ui()

    def _build_ui(self):
        topbar = ttk.Frame(self, padding=8)
        topbar.pack(side=tk.TOP, fill=tk.X)

        self.dir_label_var = tk.StringVar(value="尚未選擇資料夾")
        ttk.Button(topbar, text="選擇資料夾…", command=self.on_choose_dir).pack(side=tk.LEFT)
        ttk.Checkbutton(topbar, text="包含子資料夾", variable=self.include_subdirs).pack(side=tk.LEFT, padx=(10,0))
        ttk.Label(topbar, textvariable=self.dir_label_var).pack(side=tk.LEFT, padx=10)

        btnbar = ttk.Frame(self, padding=(8,0))
        btnbar.pack(side=tk.TOP, fill=tk.X)
        ttk.Button(btnbar, text="預覽", command=self.on_preview).pack(side=tk.LEFT)
        ttk.Button(btnbar, text="執行重新命名", command=self.on_rename).pack(side=tk.LEFT, padx=(8,0))
        ttk.Button(btnbar, text="清空列表", command=self.clear_table).pack(side=tk.LEFT, padx=(8,0))

        # 表格
        cols = ("old", "new", "status")
        self.tree = ttk.Treeview(self, columns=cols, show="headings", height=18)
        self.tree.heading("old", text="原檔名")
        self.tree.heading("new", text="新檔名")
        self.tree.heading("status", text="狀態")
        self.tree.column("old", width=380, anchor="w")
        self.tree.column("new", width=320, anchor="w")
        self.tree.column("status", width=140, anchor="w")
        self.tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=8, pady=8)

        # 狀態列
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

    def _scan_files(self):
        """
        回傳清單：Path（檔案），只取檔案（略過資料夾）
        """
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
            if not had_space:
                # 沒有空格：不需改名
                self._add_row(src, src.name, "略過（無空格）")
                continue
            if not prefix.strip():
                self._add_row(src, src.name, "跳過：前綴為空")
                continue
            new_name = f"{prefix}{src.suffix}"
            self._add_row(src, new_name, "待處理")

        self.status_var.set(f"預覽完成，共 {len(self.rows)} 筆。")

    def _add_row(self, src_path: Path, new_name: str, status: str):
        self.rows.append((src_path, new_name, status))
        self.tree.insert("", tk.END, values=(src_path.name, new_name, status))

    def on_rename(self):
        if not self.rows:
            messagebox.showinfo("資訊", "沒有可處理的項目，請先點『預覽』。")
            return
        todo = [r for r in self.rows if r[2].startswith("待處理")]
        if not todo:
            messagebox.showinfo("資訊", "沒有需要重新命名的檔案。")
            return
        if not messagebox.askyesno("確認", f"將重新命名 {len(todo)} 個檔案，確定執行？"):
            return

        # 執行
        success = 0
        for idx, (src, new_name, status) in enumerate(self.rows):
            if not status.startswith("待處理"):
                continue
            target = src.with_name(new_name)
            # 若目標存在且不是同一個檔，改出唯一名
            if target.exists() and target.resolve() != src.resolve():
                target = make_unique(target)
            try:
                os.rename(src, target)
                self.rows[idx] = (target, target.name, "已重新命名")
                success += 1
            except Exception as e:
                self.rows[idx] = (src, new_name, f"失敗：{e}")

        # 更新表格顯示
        for i in self.tree.get_children():
            self.tree.delete(i)
        for src, new_name, st in self.rows:
            # 注意：這裡 src 可能已變成「新路徑」
            self.tree.insert("", tk.END, values=(src.name, new_name, st))

        self.status_var.set(f"處理完成：成功 {success} 筆，失敗 {len(todo)-success} 筆。")

def main():
    app = RenamerApp()
    app.mainloop()

if __name__ == "__main__":
    main()
