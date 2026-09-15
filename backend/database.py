import os
from dotenv import load_dotenv, find_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from nearest .env (root or backend)
load_dotenv(find_dotenv())

# Supabase PostgreSQL (or connection string from environment)
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip('"').strip("'")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Set it to your Supabase PostgreSQL connection string."
    )

# Fix for SQLAlchemy 2.0 which requires postgresql:// or postgresql+psycopg:// instead of postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    import psycopg2
except ImportError:
    # If psycopg3 is installed, use postgresql+psycopg
    try:
        import psycopg
        if DATABASE_URL.startswith("postgresql://"):
            DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    except ImportError:
        pass

engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False,
}

if "sqlite" in DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_recycle"] = 300  # Recycle Supabase pooler connections every 5 min

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
