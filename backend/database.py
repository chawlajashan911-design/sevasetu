import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Supabase PostgreSQL (required — no SQLite fallback in production)
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip('"').strip("'")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Set it to your Supabase PostgreSQL connection string."
    )

# Supabase uses PostgreSQL — no special connect_args needed
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # Handles dropped connections from Supabase pooler
    pool_recycle=300,          # Recycle connections every 5 min
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
