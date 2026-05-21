from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth

settings = get_settings()

# we run this once on startup, once on shutdown. This is where you initialize and clean up resources
@asynccontextmanager
async def lifespan(app:FastAPI):
    # everything before yield runs on startup 
    print("Price Intel API is starting")
    print(f"Environment: {settings.env}")
    print(f"Debug Mode: {settings.debug}")

    yield

    # everthing after yield runs on shutdown 
    print("Price Intel API is shutting down....")


# App creation -- This is the fast API application instance
app = FastAPI(
    title="Price Intel API",
    description="Competitive price intelligence engine for e-commerce sellers",
    version="0.1.0",
    docs_url="/docs", # swagger ui at localhost:8000/docs
    redoc_url="/redoc", # redoc ui at localhost:8000/redoc
    lifespan=lifespan,

)

# cors middleware -- Cross Origin Resource Sharing 
# Browsers have a security feature that stops a website from talking to a different server 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # you are explicitly telling the server "Trust the frontend running on my laptop"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)

# Root endpoint the one test point for now 
@app.get("/")
async def root():
    return {
        "status":"Price Intel is running",
        "version": "0.1.0",
        "environment":settings.env
    }

@app.get("/health") # this is the heartbeat endpoint. In production, load balancers hit this every few seconds to make sure 
# your server hasn't crashed
async def health_check():
    return {"status":"healthy"}

