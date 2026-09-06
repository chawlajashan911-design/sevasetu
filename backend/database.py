import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Configurable database URL: supports MySQL if available, falls back to SQLite
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./rural_healthcare.db"
)

# For SQLite, ensure check_same_thread is False
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
except Exception:
    # Fallback to local SQLite if MySQL URL is unreachable
    DATABASE_URL = "sqlite:///./rural_healthcare.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
