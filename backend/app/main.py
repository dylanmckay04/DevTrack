from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.routers import auth, applications, documents, reminders, websocket
import time
import sqlalchemy

def wait_for_db(retries=10, delay=3):
    for attempt in range(retries):
        try:
            with engine.connect():
                print("Database is ready")
                return
        except sqlalchemy.exc.OperationalError:
            print(f"Database not ready, retrying in {delay}s... (attempt {attempt + 1}/{retries})")
            time.sleep(delay)
    raise Exception("Could not connect to database after multiple retries")

wait_for_db()

app = FastAPI(title="DevTrack")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://devtrack-production-5644.up.railway.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"}
    )

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(documents.router, prefix="/applications", tags=["documents"])
app.include_router(reminders.router, prefix="/reminders", tags=["reminders"])
app.include_router(websocket.router, tags=["websocket"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
