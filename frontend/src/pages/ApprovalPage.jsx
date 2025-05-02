import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Link } from 'react-router-dom';

dayjs.extend(utc);
dayjs.extend(timezone);

const ApprovalPage = () => {
  const [timesheets, setTimesheets] = useState([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const handleApiError = (error, response) => {
    if (response?.status === 401) {
      localStorage.removeItem('token');
      navigate('/login');
      return 'Session expired. Please login again.';
    }
    return error.message || 'Something went wrong. Please try again.';
  };

  useEffect(() => {
    const fetchPendingTimesheets = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        const response = await fetch('http://localhost:5000/pending', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch timesheets');
        }

        // Process timesheets with proper type conversion
        const processedTimesheets = data.timesheets.map(ts => {
          const [employeeIdStr, weekNoStr] = ts.id.split('-');
          return {
            ...ts,
            employeeId: parseInt(employeeIdStr, 10),
            weekNo: parseInt(weekNoStr, 10),
          };
        });

        setTimesheets(processedTimesheets);
      } catch (error) {
        const errorMessage = handleApiError(error, error.response);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingTimesheets();
  }, []);

  const handleApprove = async (employeeId, weekNo) => {
    try {
      const compositeId = `${employeeId}-${weekNo}`;
      setProcessingId(compositeId);
      
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/approve/${employeeId}/${weekNo}`, 
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Approval failed');
      }

      setTimesheets(prev => prev.filter(ts => 
        !(ts.employeeId === employeeId && ts.weekNo === weekNo)
      ));
      
      toast.success('Timesheet approved successfully!');
    } catch (error) {
      const errorMessage = handleApiError(error, error.response);
      toast.error(errorMessage);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
  
    try {
      const { employeeId, weekNo } = selectedTimesheet;
      const compositeId = `${employeeId}-${weekNo}`;
      
      setProcessingId(compositeId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `http://localhost:5000/reject/${employeeId}/${weekNo}`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            rejectionReason: rejectionReason 
          })
        }
      );
  
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Rejection failed');
      }
  
      setTimesheets(prev => prev.filter(ts => 
        !(ts.employeeId === employeeId && ts.weekNo === weekNo)
      ));
      
      toast.success('Timesheet rejected successfully!');
      setIsModalOpen(false);
      setRejectionReason('');
  
    } catch (error) {
      const errorMessage = handleApiError(error, error.response);
      toast.error(errorMessage);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Timesheet Approvals</h1>
        
        {loading ? (
          <div className="text-center p-8 text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading timesheets...</p>
          </div>
        ) : timesheets.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            No pending timesheet approvals
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Week Ending</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Hours</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {timesheets.map((sheet, index) => {
                  const weekEndingDate = dayjs(sheet.weekEnding);
                  const weekStartDate = weekEndingDate.subtract(6,'day').format('YYYY-MM-DD');
                  const weekEndDate = weekEndingDate.format('YYYY-MM-DD');
                  return (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sheet.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/timesheet?view=true&employeeId=${sheet.employeeId}&weekStart=${sheet.weekStart}&weekEnd=${sheet.weekEnding}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {dayjs(sheet.weekEnding).format('MMM DD, YYYY')}
                        </Link>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {parseFloat(sheet.totalHours).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleApprove(sheet.employeeId, sheet.weekNo)}
                          disabled={processingId === `${sheet.employeeId}-${sheet.weekNo}`}
                          className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {processingId === `${sheet.employeeId}-${sheet.weekNo}` ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTimesheet(sheet); 
                            setIsModalOpen(true);
                          }}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rejection Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-96">
              <h2 className="text-xl font-bold mb-4">Rejection Reason</h2>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows="4"
                placeholder="Enter reason for rejection..."
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingId === selectedTimesheet?.id}
                  className={`px-4 py-2 text-white rounded transition-colors ${
                    processingId === selectedTimesheet?.id 
                      ? 'bg-red-400 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processingId === selectedTimesheet?.id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalPage;


