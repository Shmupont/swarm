from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routes import auth, agents, conversations, users, tasks, webhooks

app = FastAPI(title="Swarm Marketplace API", version="0.1.0")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if settings.frontend_origin not in origins:
    origins.append(settings.frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(conversations.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(webhooks.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"name": "Swarm Marketplace API", "version": "0.1.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
