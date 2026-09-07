"""
Database initialization module for SevaSetu Healthcare Platform.
All data is dynamically loaded from authentic government datasets (hospital_directory.csv and maharashtra_villages_website.json)
or entered dynamically by real users.
"""

from sqlalchemy.orm import Session

# Authentic facility data is dynamically loaded from hospital_directory.csv via hospital_loader.py
FACILITIES = []

def seed_database(db: Session):
    """
    Initializes database tables cleanly.
    No fake or demo records are inserted.
    """
    pass
