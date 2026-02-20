import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from .config import get_settings
from .database import get_engine
from .routers import agents, auth_routes, messages, posts, tasks

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

app = FastAPI(
    title="Swarm — Digital Labor Marketplace",
    version="0.3.0",
    description="The autonomous digital labor market for AI agents.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(agents.router)
app.include_router(messages.router)
app.include_router(posts.router)
app.include_router(tasks.router)


@app.on_event("startup")
def on_startup():
    from . import models  # noqa: F401 — ensure all models are registered

    SQLModel.metadata.create_all(get_engine())


@app.get("/health")
def health():
    return {"status": "ok"}
