import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TimesheetHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log(token);
        
        const response = await fetch('http://localhost:5000/history', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();
        console.log(data);
        
        
        if (!response.ok) throw new Error(data.message || 'Failed to fetch history');
        
        setHistory(data.history.map(entry => ({
          ...entry,
          weekEnding: dayjs(entry.weekEnding).format('DD MMM YYYY'),
        })));
        
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const getStatusBadge = (status) => {
    const statusClasses = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-sm ${statusClasses[status.toLowerCase()]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Timesheet History</h1>
        
        {loading ? (
          <div className="text-center p-8 text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            No timesheet history found
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week Ending</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((entry) => (
                  <tr key={entry.weekNo}>
                    <td className="px-6 py-4 whitespace-nowrap">{entry.weekEnding}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{entry.totalHours}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="px-6 py-4">
                      {entry.status === 'rejected' && (
                        <div className="text-red-600">
                          <span className="cursor-help border-b border-dashed border-red-400" 
                                title={entry.rejectionReason}>
                            Rejection Reason
                          </span>
                        </div>
                      )}
                      {entry.status === 'approved' && (
                        <div className="text-sm text-gray-500">
                          Approved by {entry.approvedBy}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimesheetHistory;