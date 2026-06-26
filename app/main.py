from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routers import files, raw

app = FastAPI(title="Private Cloud API")

app.include_router(files.router, prefix="/api")
app.include_router(raw.router, prefix="/api")

app.mount("/static", StaticFiles(directory="app/frontend"), name="frontend")


@app.get("/")
async def index():
    return FileResponse("app/frontend/index.html")
