from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Import CORSMiddleware
from utils.db import get_db
from routers import auth
from routers import timesheet
from routers import approvals


app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


get_db()

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(timesheet.router, prefix="", tags=["Timesheet"]) 
app.include_router(approvals.router, prefix="", tags=["Authentication"])



@app.get("/health")
def health_check():
    return {"health is fine"}
