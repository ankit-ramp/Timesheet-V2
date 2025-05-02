import pyodbc
import os
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

SERVER = os.getenv("DB_SERVER")
DATABASE = os.getenv("DB_DATABASE")
UID = os.getenv("DB_USER")
PWD = os.getenv("DB_PASSWORD")
DRIVER = "{ODBC Driver 17 for SQL Server}"  # Adjust if needed

def get_db():
    """
    Provides a database connection using a generator (yield).
    This is suitable for FastAPI's dependency injection.
    """
    try:
        connection_string = f"DRIVER={DRIVER};SERVER={SERVER};DATABASE={DATABASE};UID={UID};PWD={PWD}"
        conn = pyodbc.connect(connection_string)
        yield conn  # Yield the connection
    except pyodbc.Error as e:
        # Raise an HTTPException if a database connection error occurs
        raise HTTPException(status_code=500, detail=f"Failed to connect to database: {e}")
    finally:
        if conn:
            conn.close()  # Ensure the connection is closed after use
