from pathlib import Path

from app.config import BASE_DIR

_FILE_ATTRIBUTE_HIDDEN = 0x02
_FILE_ATTRIBUTE_SYSTEM = 0x04


def _is_hidden(path: Path) -> bool:
    """回傳 True 表示該項目應被過濾（系統隱藏檔）。
    Windows：讀取 HIDDEN 或 SYSTEM 屬性；其他平台：以 . 開頭視為隱藏。"""
    try:
        import ctypes
        attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))  # type: ignore[attr-defined]
        if attrs == -1:
            return False
        return bool(attrs & (_FILE_ATTRIBUTE_HIDDEN | _FILE_ATTRIBUTE_SYSTEM))
    except AttributeError:
        return path.name.startswith(".")


def _resolve(path: str) -> Path:
    """將相對路徑解析為絕對路徑，並確認不超出 BASE_DIR 範圍。"""
    resolved = (BASE_DIR / path).resolve()
    if not str(resolved).startswith(str(BASE_DIR.resolve())):
        raise PermissionError("不允許存取 BASE_DIR 以外的路徑")
    return resolved


def list_dir(path: str, show_hidden: bool = False) -> dict:
    target = _resolve(path)
    if not target.is_dir():
        raise NotADirectoryError(f"{path} 不是目錄")
    entries = [
        {
            "name": entry.name,
            "type": "dir" if entry.is_dir() else "file",
            "size": entry.stat().st_size if entry.is_file() else None,
        }
        for entry in sorted(target.iterdir(), key=lambda e: (e.is_file(), e.name))
        if show_hidden or not _is_hidden(entry)
    ]
    return {"path": path, "entries": entries}


def read_file(path: str) -> str:
    target = _resolve(path)
    if not target.is_file():
        raise FileNotFoundError(f"{path} 不存在或不是檔案")
    return target.read_text(encoding="utf-8")


def write_file(path: str, content: str) -> None:
    target = _resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def delete_path(path: str) -> None:
    target = _resolve(path)
    if target.is_dir():
        target.rmdir()
    else:
        target.unlink()
