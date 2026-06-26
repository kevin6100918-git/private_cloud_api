from fastapi import APIRouter, HTTPException, Query
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


@router.put("/{path:path}")
async def write_file(path: str, body: WriteBody):
    """建立或覆寫指定路徑的檔案。"""
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
