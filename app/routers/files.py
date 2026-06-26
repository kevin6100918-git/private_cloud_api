from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.services import filesystem

router = APIRouter(prefix="/files", tags=["files"])


class WriteBody(BaseModel):
    content: str


@router.get("/")
async def list_root(show_hidden: bool = Query(False)):
    """列出根目錄（BASE_DIR）的內容。"""
    try:
        return filesystem.list_dir("", show_hidden=show_hidden)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{path:path}")
async def get_path(path: str, show_hidden: bool = Query(False)):
    """若路徑為目錄則列出其內容；若為檔案則回傳其文字內容。"""
    try:
        target = filesystem._resolve(path)
        if target.is_dir():
            return filesystem.list_dir(path, show_hidden=show_hidden)
        return {"path": path, "content": filesystem.read_file(path)}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except (FileNotFoundError, NotADirectoryError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _do_upload(dir_path: str, files: List[UploadFile]):
    try:
        target_dir = filesystem._resolve(dir_path)
        if not target_dir.is_dir():
            raise HTTPException(status_code=400, detail="目標路徑不是目錄")
        results = []
        for file in files:
            safe_name = Path(file.filename or "unnamed").name
            rel = f"{dir_path}/{safe_name}" if dir_path else safe_name
            dest = filesystem._resolve(rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                while chunk := await file.read(1024 * 1024):
                    f.write(chunk)
            results.append({"name": safe_name, "path": rel})
        return {"uploaded": results}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def upload_to_root(files: List[UploadFile] = File(...)):
    """上傳檔案至根目錄（BASE_DIR）。"""
    return await _do_upload("", files)


@router.post("/{path:path}")
async def upload_to_path(path: str, files: List[UploadFile] = File(...)):
    """上傳檔案至指定目錄。"""
    return await _do_upload(path, files)


@router.put("/{path:path}")
async def write_file(path: str, body: WriteBody):
    """建立或覆寫指定路徑的檔案（文字內容）。"""
    try:
        filesystem.write_file(path, body.content)
        return {"message": "ok", "path": path}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{path:path}")
async def delete_path(path: str):
    """刪除指定路徑的檔案或（空）目錄。"""
    try:
        filesystem.delete_path(path)
        return {"message": "ok", "path": path}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except (FileNotFoundError, NotADirectoryError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
