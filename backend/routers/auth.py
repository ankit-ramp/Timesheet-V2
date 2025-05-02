from fastapi import APIRouter, Depends, HTTPException, Body, Request
from typing import Annotated, List, Dict, Any, Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta
import pyodbc
import os
from dotenv import load_dotenv
import re  # Import the regular expression module
from pydantic import BaseModel, ValidationError

load_dotenv()

# Assuming your database connection function is in utils/db.py
from utils.db import get_db  # Make sure this function yields a database connection

# Replace with your actual secret key and algorithm
SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
DEFAULT_EXPIRE_MINUTES = 60 * 24  # Default 1 day (in minutes)


def parse_expiration_string(expiration_str: str) -> int:
    """
    Parses an expiration string (e.g., '1d', '2h', '30m') and returns the expiration time in minutes.
    If the string is just a number, it's assumed to be in minutes.
    If the string is invalid, returns the default value.
    """
    if not expiration_str:
        return DEFAULT_EXPIRE_MINUTES

    match = re.match(r"(\d+)([dhms])", expiration_str)
    if match:
        value = int(match.group(1))
        unit = match.group(2)
        if unit == "d":
            return value * 24 * 60
        elif unit == "h":
            return value * 60
        elif unit == "m":
            return value
        elif unit == "s":
            return value / 60
    try:
        return int(expiration_str)  # Try converting directly to int
    except ValueError:
        return DEFAULT_EXPIRE_MINUTES  # Return default on error


ACCESS_TOKEN_EXPIRE_MINUTES = parse_expiration_string(os.getenv("JWT_EXPIRES_IN"))


router = APIRouter()


async def create_access_token(
    data: dict, expires_delta: timedelta | None = None
) -> str:
    """
    Generates a JWT access token.

    Args:
        data: The payload to include in the token.
        expires_delta: Optional timedelta for token expiration.  If None, uses the default.

    Returns:
        The encoded JWT string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_user_from_token(request: Request) -> Dict[str, Any]:
    """
    Verifies the JWT token from the request header and returns the decoded user data.

    Args:
        request: The FastAPI Request object.

    Returns:
        The decoded user data (a dictionary).

    Raises:
        HTTPException: 401 Unauthorized if the token is missing or invalid.
    """
    authorization_header: Optional[str] = request.headers.get("Authorization")
    if not authorization_header:
        raise HTTPException(
            status_code=401,
            detail="Authorization required",
        )

    try:
        token = authorization_header.split(" ")[1]
    except IndexError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload["exp"] < datetime.utcnow().timestamp():
            raise JWTError("Token has expired")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")



def verify_token(user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """
    Dependency to verify that a valid token is present in the request.
    """
    return user


def verify_manager(user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """
    Dependency to verify that the user has the 'manager' role.
    """
    if user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return user


class UserLogin(BaseModel):
    """
    Pydantic model for validating the login request body.
    """

    email: str
    password: str


@router.post("/login")
async def login(
    user_login: UserLogin = Body(...), db: pyodbc.Connection = Depends(get_db)
):
    """
    Handles user login and returns a JWT access token.  Expects JSON in the request body.

    Args:
        user_login: The email and password from the request body, validated by Pydantic.
        db: The database connection (provided by FastAPI's dependency injection).

    Returns:
        A JSON response containing the access token and user information.

    Raises:
        HTTPException: For invalid credentials or database errors.
    """
    email = user_login.email
    password = user_login.password
    try:
        cursor = db.cursor()
        # Step 1: Validate user
        cursor.execute("SELECT mail_id, Pass, Emp_ID FROM Cred WHERE mail_id = ?", email)
        user_result = cursor.fetchone()

        if not user_result:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        db_email, db_password, emp_id = user_result

        if password != db_password:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Step 2: Get employee details
        cursor.execute("SELECT Emp_Name, Department FROM [USER] WHERE Emp_ID = ?", emp_id)
        user_details_result = cursor.fetchone()

        emp_name = user_details_result[0] if user_details_result else "Name not found"
        department = (
            user_details_result[1] if user_details_result else "Department not found"
        )

        role = "manager" if department == "Director" else "employee"

        access_token_data = {
            "empId": emp_id,
            "email": db_email,
            "role": role,
            "name": emp_name,
        }
        access_token = await create_access_token(access_token_data)

        # Step 3: Get Entity and Project IDs from Mapping
        cursor.execute(
            "SELECT DISTINCT Entity_ID, PID, Activity_ID FROM Mapping WHERE Emp_ID = ?",
            emp_id,
        )
        mapping_results = cursor.fetchall()

        entity_ids = list(
            set(row.Entity_ID for row in mapping_results if row.Entity_ID is not None)
        )
        project_ids = list(
            set(row.PID for row in mapping_results if row.PID is not None)
        )
        activity_ids = list(
            set(row.Activity_ID for row in mapping_results if row.Activity_ID is not None)
        )

        # Step 4: Fetch Entity Names using IN
        entity_names: List[str] = []
        if entity_ids:
            placeholders = ",".join("?" * len(entity_ids))
            cursor.execute(
                f"SELECT Entity_ID, Entity_Name FROM Entity WHERE Entity_ID IN ({placeholders})",
                entity_ids,
            )
            entity_name_results = cursor.fetchall()
            entity_names = [row.Entity_Name for row in entity_name_results]

        # Step 5: Fetch Activity Names using IN
        activity_map: dict[int, str] = {}
        if activity_ids:
            placeholders = ",".join("?" * len(activity_ids))
            cursor.execute(
                f"SELECT Activity_ID, activity_name FROM Activity WHERE Activity_ID IN ({placeholders})",
                activity_ids,
            )
            activity_results = cursor.fetchall()
            for row in activity_results:
                activity_map[row.Activity_ID] = row.activity_name

        # Step 6: Group activities by project
        project_activities = []
        for project_id in project_ids:
            activities_for_project = [
                row for row in mapping_results if row.PID == project_id
            ]
            activity_ids_for_project = list(
                set(
                    r.Activity_ID
                    for r in activities_for_project
                    if r.Activity_ID is not None
                )
            )

            # Ensure activity_ids_for_project are integers
            activity_ids_for_project = [
                int(id) if id is not None else None for id in activity_ids_for_project
            ]

            # Ensure keys in activity_map are integers
            activity_map_int_keys = {
                int(k): v for k, v in activity_map.items()
            }  # Create a new dict with int keys

            activity_names_for_project = [
                activity_map_int_keys.get(id, "Activity name not found")
                for id in activity_ids_for_project
            ]

            project_activities.append(
                {
                    "projectId": project_id,
                    "activityIds": activity_ids_for_project
                    if activity_ids_for_project
                    else "No activity IDs found",
                    "activityNames": activity_names_for_project
                    if activity_names_for_project
                    else "No activity names found",
                }
            )

        # Final Response
        return {
            "success": True,
            "message": "Login successful",
            "token": access_token,
            "token_type": "bearer",
            "user": {
                "email": db_email,
                "empId": emp_id,
                "empName": emp_name,
                "department": department,
                "entityIds": entity_ids if entity_ids else "No entity IDs found",
                "entityNames": entity_names,
                "projectIds": project_ids if project_ids else "No project IDs found",
                "projectActivities": project_activities,
            },
        }

    except HTTPException as http_exc:
        raise http_exc
    except pyodbc.Error as db_exc:
        print("Login database error:", db_exc)
        raise HTTPException(
            status_code=500, detail=f"Database error during login: {db_exc}"
        )
    except Exception as e:
        print("Login error:", e)
        raise HTTPException(
            status_code=500, detail=f"Error during login: {e}"
        )

