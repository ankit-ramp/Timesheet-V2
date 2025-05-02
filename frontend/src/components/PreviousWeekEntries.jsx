import React from 'react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function PreviousWeekEntries({ previousEntries = [], onApplyEntry, onApplyAll, weekInfo }) {
  if (previousEntries.length === 0) return null;

  // 👉 Functions should be defined here, outside of return
  const getLastWeekDates = () => {
    if (weekInfo?.start && weekInfo?.end) {
      const start = dayjs(weekInfo.start).tz('Asia/Kolkata');
      return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
    }
    return [];
  };

  const handleApplyAll = () => {
    onApplyAll(previousEntries);
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold underline text-gray-700 text-center m-4">
        Previous Week's Entries (Week {weekInfo?.number})
      </h3>

      {weekInfo && (
        <div className="text-sm text-blue-600 mb-4 p-2 bg-blue-50 rounded-lg text-center">
          Previous week of selected week: {dayjs(weekInfo.start).format('DD MMM')} -{' '}
          {dayjs(weekInfo.end).format('DD MMM')} (Week {weekInfo.number})
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleApplyAll}
          className="px-3 py-1 bg-blue-600 text-white rounded-sm text-xs shadow hover:bg-blue-700 m-2"
        >
          Apply All
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="rounded-lg shadow bg-white p-2">
          <table className="min-w-full table-fixed border-collapse text-xs md:text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-1 w-[120px] font-medium align-middle">Entity</th>
                <th className="p-1 w-[110px] font-medium align-middle">Project</th>
                <th className="p-1 w-[110px] font-medium align-middle">Activity</th>
                {getLastWeekDates().map((date, index) => (
                  <th key={index} className="px-1 py-2 w-[50px] font-medium align-middle">
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-[0.7rem]">{date.format('ddd')}</span>
                      <div className="text-xs flex items-center gap-1">
                        <span>{date.format('DD')}</span>
                        <span className="text-[0.6rem] text-gray-500">
                          {date.format('MMM')}
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="p-1 w-[120px] font-medium align-middle">Remarks</th>
                <th className="p-1 w-[50px] font-medium align-middle">Total</th>
                <th className="p-1 w-[40px] font-medium align-middle">Action</th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {previousEntries.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50 align-middle">
                  <td className="p-1 text-center">{entry.entityId}</td>
                  <td className="p-1 text-center">{entry.projectId}</td>
                  <td className="p-1 text-center">{entry.activityId}</td>

                  {entry.hours.map((hour, dayIndex) => (
                    <td key={dayIndex} className="p-1 text-center">
                      {hour}
                    </td>
                  ))}

                  <td className="p-1 text-center">{entry.remarks}</td>

                  <td className="p-1 text-center font-medium text-xs">
                    {entry.hours.reduce((acc, h) => acc + Number(h || 0), 0)}
                  </td>

                  <td className="p-1 text-center">
                    <button
                      onClick={() => onApplyEntry(entry)}
                      className="px-2 py-1 bg-green-600 text-white rounded-sm text-xs shadow hover:bg-green-700"
                    >
                      Apply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
}
