from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Dict, Any, Optional, Tuple
import pyodbc
from datetime import datetime, date, timedelta
import os
from dotenv import load_dotenv
from uuid import uuid4
import pytz  # For timezone handling
from pydantic import BaseModel

load_dotenv()

# Assuming your database connection function is in utils/db.py
from utils.db import get_db  # Make sure this function yields a database connection

router = APIRouter()

# Constants
INDIA_TIMEZONE = pytz.timezone('Asia/Kolkata')

def get_indian_time():
    """Gets the current time in India (Asia/Kolkata)"""
    return datetime.now(INDIA_TIMEZONE)

def get_week_bounds(date_param: datetime) -> Tuple[date, date]:
    """
    Calculates the start and end dates of the ISO week for a given date.

    Args:
        date_param: The date for which to calculate the week bounds.

    Returns:
        A tuple containing the start and end dates (as date objects).
    """
    # Use isocalendar() which returns (year, week, day of week)
    year, week, _ = date_param.isocalendar()
    # Find the Monday of that week
    start = datetime.fromisocalendar(year, week, 1)
    end = start + timedelta(days=6)
    return start.date(), end.date()



# Pydantic model for request body validation
class TimesheetEntry(BaseModel):
    projectId: Optional[str] = None
    activity: str
    date: date  # Use date, not datetime
    hours: float
    remarks: Optional[str] = ""
    week: int
    employeeId: int
    entityId: str
    status: str



@router.post("/")
async def post_timesheet_entries(
    entries: List[TimesheetEntry] = Body(...), db: pyodbc.Connection = Depends(get_db)
) -> Dict[str, str]:
    """
    Posts or updates timesheet entries.  Handles both insertions and updates.

    Args:
        entries: A list of timesheet entries to process.
        db: The database connection (provided by FastAPI's dependency injection).

    Returns:
        A JSON response indicating the success of the operation.

    Raises:
        HTTPException: 500 for database errors.
    """
    try:
        cursor = db.cursor()

        for entry in entries:
            # Check if the entry already exists
            cursor.execute(
                """
                SELECT 1
                FROM Resolved
                WHERE EmployeeID = ? AND ActivtyID = ? AND Date = ? AND EntityID = ? AND Week_No = ? AND ProjectID = ?
                """,
                entry.employeeId,
                entry.activity,
                entry.date,
                entry.entityId,
                entry.week,
                entry.projectId,
            )
            exists = cursor.fetchone()

            if exists:
                # Update existing entry
                cursor.execute(
                    """
                    UPDATE Resolved
                    SET Time_Spent = ?, Remarks = ?, Status = ?
                    WHERE EmployeeID = ? AND ActivtyID = ? AND Date = ? AND EntityID = ? AND Week_No = ? AND ProjectID = ?
                    """,
                    entry.hours,
                    entry.remarks,
                    entry.status,
                    entry.employeeId,
                    entry.activity,
                    entry.date,
                    entry.entityId,
                    entry.week,
                    entry.projectId,
                )
            else:
                # Insert new entry
                guid = uuid4()
                cursor.execute(
                    """
                    INSERT INTO Resolved (ProjectID, guid, EmployeeID, ActivtyID, Date, Time_Spent, Remarks, Week_No, EntityID, Status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    entry.projectId,
                    guid,
                    entry.employeeId,
                    entry.activity,
                    entry.date,
                    entry.hours,
                    entry.remarks,
                    entry.week,
                    entry.entityId,
                    entry.status,
                )
        db.commit()  # Commit the transaction after processing all entries
        return {"message": "Timesheet entries processed successfully!"}

    except pyodbc.Error as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to process timesheet entries: {e}"
        )



@router.get("/previous-entries")
async def get_previous_entries(
    employeeId: int = Query(...),
    currentDate: str = Query(...),
    weeksBack: int = Query(1),
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Retrieves timesheet entries from a specified number of weeks in the past.

    Args:
        employeeId: The ID of the employee.
        currentDate: The reference date (string in YYYY-MM-DD format).
        weeksBack: The number of weeks to go back (default: 1).
        db: The database connection.

    Returns:
        A JSON response containing the previous week's entries.

    Raises:
        HTTPException: 400 for invalid input, 500 for database errors.
    """
    try:

        try:
            # Parse the date string, explicitly setting the timezone
            reference_date = INDIA_TIMEZONE.localize(datetime.strptime(currentDate, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid currentDate format.  Use YYYY-MM-DD"
            )

        # Calculate target week
        target_week_start, target_week_end = get_week_bounds(reference_date - timedelta(weeks=weeksBack))


        cursor = db.cursor()
        cursor.execute(
            """
            SELECT 
                EntityID AS entityId,
                ProjectID AS projectId,
                ActivtyID AS activityId, 
                Remarks AS remarks,
                Status AS status,
                DATEPART(WEEKDAY, Date) AS sqlDayOfWeek,
                Time_Spent AS hours,
                Date
            FROM Resolved
            WHERE EmployeeID = ? AND Date >= ? AND Date <= ?
            ORDER BY Date ASC
            """,
            employeeId,
            target_week_start,
            target_week_end,
        )
        results = cursor.fetchall()

        entries_map = {}
        for row in results:
            key = f"{row.entityId}-{row.projectId}-{row.activityId}"
            if key not in entries_map:
                entries_map[key] = {
                    "entityId": row.entityId,
                    "projectId": row.projectId,
                    "activityId": row.activityId,
                    "remarks": row.remarks or "",
                    "status": row.status or "",
                    "hours": [0.0] * 7,  # Initialize with 7 zeros as floats
                }
            # Convert SQL Server weekday (1=Sunday) to Python weekday (0=Monday)
            js_day_of_week = (row.sqlDayOfWeek + 5) % 7
            entries_map[key]["hours"][js_day_of_week] = float(row.hours)  # Ensure float

        entries = list(entries_map.values())

        return {
            "success": True,
            "count": len(entries),
            "week": {
                "number": target_week_start.isocalendar()[1],
                "year": target_week_start.isocalendar()[0],
                "start": target_week_start.strftime("%Y-%m-%d"),
                "end": target_week_end.strftime("%Y-%m-%d"),
                "offset": weeksBack,
            },
            "entries": entries,
        }

    except pyodbc.Error as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Server error: {e}"
        )



@router.get("/entries")
async def get_employee_entries(
    employeeId: int = Query(...),
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Retrieves timesheet entries grouped by week for a given employee.

    Args:
        employeeId: The ID of the employee.
        db: The database connection.

    Returns:
        A JSON response containing the timesheet entries grouped by week.

    Raises:
        HTTPException: 500 for database errors.
    """
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            SET DATEFIRST 1;  -- Monday as the first day of the week

            SELECT
                DATEADD(DAY, 7 - DATEPART(WEEKDAY, CAST(Date AS DATE)), CAST(Date AS DATE)) AS weekEnding,
                DATEADD(DAY, -6, DATEADD(DAY, 7 - DATEPART(WEEKDAY, CAST(Date AS DATE)), CAST(Date AS DATE))) AS weekStart,
                CASE
                    WHEN SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) > 0 THEN 'approved'
                    WHEN SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) > 0 THEN 'rejected'
                    WHEN SUM(CASE WHEN Status = 'submitted' THEN 1 ELSE 0 END) > 0 THEN 'submitted'
                    ELSE 'draft'
                END AS status
            FROM Resolved
            WHERE EmployeeID = ?
            GROUP BY
                DATEADD(DAY, 7 - DATEPART(WEEKDAY, CAST(Date AS DATE)), CAST(Date AS DATE)),
                DATEADD(DAY, -6, DATEADD(DAY, 7 - DATEPART(WEEKDAY, CAST(Date AS DATE)), CAST(Date AS DATE)))
            ORDER BY weekEnding DESC
            """,
            employeeId,
        )
        results = cursor.fetchall()

        entries = [
            {
                "weekEnding": row.weekEnding.strftime("%Y-%m-%d"),  # Convert to string
                "weekStart": row.weekStart.strftime("%Y-%m-%d"),    # Convert to string
                "status": row.status,
            }
            for row in results
        ]
        return {"success": True, "entries": entries}

    except pyodbc.Error as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Server error: {e}"
        )



@router.get("/week-entries")
async def get_week_entries(
    employeeId: int = Query(...),
    weekStart: date = Query(...),  # Use date type
    weekEnd: date = Query(...),    # Use date type
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Retrieves timesheet entries for a specific week.
    """
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            SELECT
                EntityID AS entityId,
                ProjectID AS projectId,
                ActivtyID AS activityId,
                Remarks AS remarks,
                Status AS status,
                Date,
                Time_Spent AS hours
            FROM Resolved
            WHERE EmployeeID = ? AND Date >= ? AND Date <= ?
            ORDER BY Date ASC
            """,
            employeeId,
            weekStart,
            weekEnd,
        )
        results = cursor.fetchall()

        entries_map = {}
        for row in results:
            key = f"{row.entityId}-{row.projectId}-{row.activityId}"
            if key not in entries_map:
                entries_map[key] = {
                    "entityId": row.entityId,
                    "projectId": row.projectId,
                    "activityId": row.activityId,
                    "remarks": row.remarks,
                    "status": row.status,
                    "hours": [0.0] * 7,  # Initialize with 7 zeros
                }
            try:
                if row.Date is None:
                    print(f"Error: row.Date is None for row: {row}")
                    day_index = 0  # Or some other default value, or skip this entry
                else:
                    # Ensure both are datetime.date for the subtraction.
                    if isinstance(row.Date, datetime):
                        row_date = row.Date.date()  # Extract the date part
                    elif isinstance(row.Date, date):
                        row_date = row.Date
                    else:
                        print(f"Unexpected type for row.Date: {type(row.Date)}, value: {row.Date}")
                        raise ValueError("row.Date is not a date or datetime")

                    day_index = (row_date - weekStart).days
                entries_map[key]["hours"][day_index] = float(row.hours)
            except Exception as e:
                print(f"Error processing row: {row}")
                print(f"Error calculating day_index: row.Date={row.Date}, weekStart={weekStart}")
                raise  # Re-raise the exception to see the full traceback

        res_entries = list(entries_map.values())
        return {"success": True, "entries": res_entries}

    except pyodbc.Error as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Server error: {e}"
        )
