import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import Header from "../components/Header";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

export default function LandingPage() {
  const [timesheets, setTimesheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchTimesheets = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(
          `http://localhost:5000/entries?employeeId=${user.empId}`
        );
        const data = await response.json();
        
        if (data.success) {
          const processed = data.entries.map(entry => ({
            ...entry,
            weekEnding: dayjs.utc(entry.weekEnding)
              .tz('Asia/Kolkata')
              .format('YYYY-MM-DD'), // Convert to Asia/Kolkata time
            weekStart: dayjs.utc(entry.weekStart)
              .tz('Asia/Kolkata')
              .format('YYYY-MM-DD')
          }));
          
          setTimesheets(processed);
        }
      } catch (error) {
        console.error('Error fetching timesheets:', error);
        toast.error('Failed to load timesheet history');
      }finally{
        setIsLoading(false);
      }
    };
    fetchTimesheets();
  }, [user.empId]);

  const handleViewTimesheet = (sheet) => {
    navigate(`/timesheet?view=true&weekStart=${sheet.weekStart}&weekEnd=${sheet.weekEnding}`);
  };
  
  const handleEditTimesheet = (sheet) => {
    if (sheet.status.toLowerCase() === 'approved') return;
    navigate(`/timesheet?edit=true&weekStart=${sheet.weekStart}&weekEnd=${sheet.weekEnding}`);
  };

  const getStatusStyle = (status) => {
    const base = "px-3 py-1 rounded-full text-sm font-medium";
    switch (status.toLowerCase()) {
      case 'approved': return `${base} bg-green-100 text-green-800`;
      case 'rejected': return `${base} bg-red-100 text-red-800`;
      case 'submitted': return `${base} bg-blue-100 text-blue-800`;
      default: return `${base} bg-gray-100 text-gray-800`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Timesheet Management</h1>
          <div className="flex space-x-4">
            <Link 
              to="/timesheet" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Timesheet
            </Link>
            <Link 
              to="/timesheet-history" 
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              History
            </Link>
            {
              user?.department === 'Director' && (
                <Link 
                  to="/approval" 
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Timesheets
                </Link>
              )
            }
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week Ending</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
        {timesheets.map((sheet) => {
          const isApproved = sheet.status.toLowerCase() === 'approved';
          
          return (
            <tr key={sheet.weekEnding}>
              <td className="px-6 py-4 whitespace-nowrap">
                <button
                  onClick={() => handleViewTimesheet(sheet)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {dayjs(sheet.weekEnding).format('MMM DD, YYYY')}
                </button>
              </td>
              
              <td className="px-7 py-7 whitespace-nowrap">
                <span className={getStatusStyle(sheet.status)}>
                {sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1).toLowerCase()}
                </span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                {!isApproved && (
                  <button
                    onClick={() => handleEditTimesheet(sheet)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
          </table>
          {
            timesheets.length === 0 && !isLoading && (
              <div className='text-center py-8 text-gray-500'>
                No timesheets found
                </div>
            )
          }
        </div>
        )}
      </div>
    </div>
  );
}