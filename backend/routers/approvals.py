from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from typing import List, Dict, Any, Optional
import pyodbc
from pydantic import BaseModel
from datetime import datetime
from utils.db import get_db  #  adjust this import as necessary
from fastapi import Request
from typing import Callable
from functools import wraps
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import status
from routers.auth import verify_token, verify_manager

router = APIRouter()
security = HTTPBearer() #Assumes you are using HTTP Bearer


class RejectTimesheetRequest(BaseModel):
    rejectionReason: str


@router.get("/history")
async def get_approval_history(
    request: Request,  #  Include the request object
    user: Dict[str, Any] = Depends(verify_token),
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    print("enter history")
    
    """
    Retrieves the approval history for a specific employee.

    Args:
        request: The FastAPI Request object.
        user: The user information (including employee ID) extracted from the token.
        db: The database connection.

    Returns:
        A JSON response containing the approval history.

    Raises:
        HTTPException: 500 for database errors.
    """
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            SELECT 
                r.Week_No AS weekNo,
                DATEADD(day, 
                        (8 - DATEPART(weekday, MIN(r.Date))), 
                        MIN(r.Date)) AS weekEnding,
                SUM(r.Time_Spent) AS totalHours,
                MAX(r.Status) AS status,
                MAX(r.RejectionReason) AS rejectionReason,
                MAX(r.ApprovedBy) AS approvedBy,
                MAX(r.ApprovedDate) AS approvedDate
            FROM Resolved r
            WHERE r.EmployeeID = ?
            GROUP BY r.Week_No
            ORDER BY r.Week_No DESC
            """,
            user["empId"],  # Access the employee ID from the user dictionary
        )
        results = cursor.fetchall()

        history = []
        for row in results:
            approved_date = row.approvedDate.isoformat() if row.approvedDate else None
            history.append({
                "weekNo": row.weekNo,
                "weekEnding": row.weekEnding.strftime("%Y-%m-%d"),  # Format date
                "totalHours": float(row.totalHours), # Ensure float for consistency
                "status": row.status,
                "rejectionReason": row.rejectionReason,
                "approvedBy": row.approvedBy,
                "approvedDate": approved_date,
            })

        return {"success": True, "history": history}

    except pyodbc.Error as e:
        print(f"Error fetching timesheet history: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch history",
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error",
        )



@router.get("/pending")
async def get_pending_timesheets(
    request: Request,  #  Include the request object
    manager: Dict[str, Any] = Depends(verify_manager),
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Retrieves pending timesheets for approval.  Requires a valid token and manager role.

    Args:
        request: The FastAPI Request object.
        manager: The manager user data (from token), verified by verify_manager dependency.
        db: The database connection.

    Returns:
        A JSON response containing the pending timesheets.

    Raises:
        HTTPException: 500 for database errors.
    """
    try:
        cursor = db.cursor()
        cursor.execute(
            """
            SELECT 
                e.Emp_Name AS EmployeeName,
                r.EmployeeID,
                r.Week_No,
                DATEADD(day, 
                        (8 - DATEPART(weekday, MIN(r.Date))), 
                        MIN(r.Date)) AS WeekEndingDate,
                SUM(r.Time_Spent) AS TotalHours
            FROM Resolved r
            JOIN [USER] e ON r.EmployeeID = e.Emp_ID
            WHERE r.Status = 'submitted'
            GROUP BY r.EmployeeID, e.Emp_Name, r.Week_No
            ORDER BY r.Week_No DESC
            """
        )
        results = cursor.fetchall()

        timesheets = []
        for row in results:
            timesheets.append(
                {
                    "id": f"{row.EmployeeID}-{row.Week_No}",  # Unique composite ID
                    "employeeName": row.EmployeeName,
                    "weekNo": row.Week_No,
                    "weekEnding": row.WeekEndingDate.strftime("%Y-%m-%d"),
                    "totalHours": float(row.TotalHours),
                }
            )

        return {"success": True, "timesheets": timesheets}

    except pyodbc.Error as e:
        print(f"Error fetching pending timesheets: {e}")
        raise HTTPException(
            status_code=500, detail="Server error"
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(
            status_code=500, detail="Internal server error"
        )


@router.post("/approve/{employeeId}/{weekNo}")
async def approve_timesheet(
    request: Request,  # Include the request
    employeeId: int = Path(..., title="Employee ID", ge=1),
    weekNo: int = Path(..., title="Week Number", ge=1),
    manager: Dict[str, Any] = Depends(verify_manager),
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Approves a submitted timesheet for a given employee and week.

    Args:
        request: The FastAPI Request object.
        employeeId: The ID of the employee whose timesheet is being approved.
        weekNo: The week number of the timesheet being approved.
        manager: The manager user data (from token), verified by verify_manager dependency.
        db: The database connection.

    Returns:
        A JSON response indicating the approval status.

    Raises:
        HTTPException: 400 for invalid input, 404 for no pending timesheets, 500 for server errors.
    """
    try:
        cursor = db.cursor()

        # Verify existence before update
        cursor.execute(
            """
            SELECT COUNT(*) AS count 
            FROM Resolved 
            WHERE EmployeeID = ? 
                AND Week_No = ?
                AND Status = 'submitted'
            """,
            employeeId,
            weekNo,
        )
        check_result = cursor.fetchone()

        if check_result.count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pending timesheets found for this week",
            )

        # Perform approval
        approved_by = manager["name"]  # Get the manager's name from the token
        cursor.execute(
            """
            UPDATE Resolved
            SET 
                Status = 'approved',
                ApprovedBy = ?,
                ApprovedDate = GETDATE()
            WHERE EmployeeID = ?
                AND Week_No = ?
                AND Status = 'submitted'
            """,
            approved_by,
            employeeId,
            weekNo,
        )
        db.commit()  # Commit the transaction

        return {
            "success": True,
            "message": f"Approved {check_result.count} timesheet entries",
        }

    except HTTPException as http_exc:
        raise http_exc  # Re-raise HTTPExceptions
    except pyodbc.Error as e:
        print(f"Error approving timesheet: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error",
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post("/reject/{employeeId}/{weekNo}")
async def reject_timesheet(
    request: Request,
    employeeId: int = Path(..., title="Employee ID", ge=1),
    weekNo: int = Path(..., title="Week Number", ge=1),
    rejection_data: RejectTimesheetRequest = Body(...),
    manager: Dict[str, Any] = Depends(verify_manager),
    db: pyodbc.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Rejects a submitted timesheet for a given employee and week.

    Args:
        request: The FastAPI Request object.
        employeeId: The ID of the employee whose timesheet is being rejected.
        weekNo: The week number of the timesheet being rejected.
        rejection_data: The rejection reason from the request body.
        manager: The manager user data (from token).
        db: The database connection.

    Returns:
        A JSON response indicating the rejection status.

    Raises:
        HTTPException: 400 for invalid input, 500 for server errors.
    """
    try:
        cursor = db.cursor()
        rejection_reason = rejection_data.rejectionReason

        # Verify existence of the timesheet to reject
        cursor.execute(
            """
            SELECT COUNT(*) AS count
            FROM Resolved
            WHERE EmployeeID = ?
              AND Week_No = ?
              AND Status = 'submitted'
            """,
            employeeId,
            weekNo,
        )
        check_result = cursor.fetchone()

        if check_result.count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pending timesheets found for this week"
            )

        # Update the timesheet status to 'rejected'
        rejected_by = manager["name"]
        cursor.execute(
            """
            UPDATE Resolved
            SET
                Status = 'rejected',
                RejectionReason = ?,
                RejectedBy = ?,
                RejectedDate = GETDATE()
            WHERE EmployeeID = ?
              AND Week_No = ?
              AND Status = 'submitted'
            """,
            rejection_reason,
            rejected_by,
            employeeId,
            weekNo,
        )
        db.commit()

        return {"success": True, "message": "Timesheet rejected successfully"}

    except HTTPException as http_exc:
        raise http_exc
    except pyodbc.Error as e:
        print(f"Error rejecting timesheet: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error",
        )
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )
