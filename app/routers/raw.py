import mimetypes

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services import filesystem

router = APIRouter(prefix="/raw", tags=["raw"])


@router.get("/{path:path}")
async def serve_raw(path: str):
    """串流提供原始檔案，供媒體播放器、PDF 檢視器或下載使用。"""
    try:
        target = filesystem._resolve(path)
        if not target.is_file():
            raise HTTPException(status_code=404, detail="不是檔案")
        mime_type, _ = mimetypes.guess_type(str(target))
        return FileResponse(
            str(target),
            media_type=mime_type or "application/octet-stream",
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except (FileNotFoundError, NotADirectoryError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
