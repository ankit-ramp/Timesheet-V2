import React, { useEffect, useState } from "react";
import dayjs from 'dayjs';
import { Toaster, toast } from 'react-hot-toast';

export default function TimesheetTable({
  entries,
  onEntryChange,
  onAddRow,
  onRemoveRow,
  weekDates,
  projects,
  onSubmitTimesheet,
  entities,
  currentDate,
  isViewMode,
  isEditMode
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEntries, setPreviewEntries] = useState([...entries]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDataString = localStorage.getItem('user');
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const allActivities = userData?.projectActivities?.flatMap(project => 
    project.activityIds.map((id, index) => ({
      id: id,
      name: project.activityNames[index]
    }))
  );
  const uniqueActivities = allActivities?.filter(
    (activity, index, self) =>
      index === self.findIndex(a => a.id === activity.id)
  );

  const isCurrentWeek = dayjs().isSame(currentDate, 'week');

  const handleChange = (index, field, value) => {
    const updated = { 
      ...entries[index], 
      [field]: value,
      ...(field === "projectId" && { isProjectTouched: true })
    };
    onEntryChange(index, updated);
  };

  const handleHourChange = (index, dayIndex, value) => {
    const updatedHours = [...entries[index].hours];
    updatedHours[dayIndex] = value;
    const updated = { ...entries[index], hours: updatedHours };
    onEntryChange(index, updated);
  };

  const handleSave = async (status) => {
    if (status === 'saved') {
      setIsSavingDraft(true);
    } else {
      setIsSubmitting(true);
    }

    try {
      previewEntries.forEach((entry, index) => {
        onEntryChange(index, entry);
      });
      await onSubmitTimesheet(previewEntries, status);
    } catch (error) {
      console.error("Error saving timesheet:", error);
    } finally {
      setIsSavingDraft(false);
      setIsSubmitting(false);
      setIsPreviewOpen(false);
    }
  };

  const openPreview = () => {
    setPreviewEntries([...entries]);
    setIsPreviewOpen(true);
  };

  useEffect(() => {
    entries.forEach((entry, index) => {
      const newEntry = { ...entry };

      if (typeof newEntry.projectId === 'number') {
        newEntry.projectId = String(newEntry.projectId);
      }

      if (entities.length === 1) {
        newEntry.entityId = entities[0].EntityID;
      }

      if (projects.length === 1 && 
          !newEntry.isProjectTouched && 
          !newEntry.projectId) {
          newEntry.projectId = String(projects[0].id);
      }

      if (uniqueActivities?.length === 1) {
        newEntry.activityId = uniqueActivities[0].id;
      }

      if (JSON.stringify(newEntry) !== JSON.stringify(entry)) {
        onEntryChange(index, newEntry);
      }
    });
  }, [entities, projects, uniqueActivities]);

  return (
    <div className="overflow-x-auto mb-8">
      <Toaster position="top-center" containerStyle={{ top: 80 }} toastOptions={{ duration: 3000 }} />
      <div className="rounded-lg shadow bg-white p-2">
        <table className="min-w-full table-fixed border-collapse text-xs md:text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-1 w-[120px] font-medium">Entity</th>
              <th className="p-1 w-[110px] font-medium">Project</th>
              <th className="p-1 w-[110px] font-medium">Activity</th>
              {weekDates.map((isoDate) => (
                <th key={isoDate} className="px-1 py-2 w-[50px] font-medium">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[0.7rem]">{dayjs(isoDate).format('ddd')}</span>
                    <div className="text-xs flex items-center gap-1">
                      <span>{dayjs(isoDate).format('DD')}</span>
                      <span className="text-[0.6rem] text-gray-500">
                        {dayjs(isoDate).format('MMM')}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
              <th className="p-1 w-[120px] font-medium">Remarks</th>
              <th className="p-1 w-[50px] font-medium">Total</th>
              <th className="p-1 w-[40px] font-medium"></th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {entries.map((entry, index) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="p-1">
                  <select
                    value={entry.entityId || ''}
                    disabled={isViewMode}
                    onChange={(e) => handleChange(index, "entityId", e.target.value)}
                    className="w-full p-1 border border-gray-200 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {entities.length > 1 && <option value="">Select Entity</option>}
                    {entities.map((entity) => (
                      <option key={entity.EntityID} value={entity.EntityID}>
                        {entity.EntityName.substring(0, 15)}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-1">
                  <input
                    disabled={isViewMode}
                    type="text"
                    value={String(entry.projectId || '')} 
                    onChange={(e) => handleChange(index, "projectId", e.target.value)}
                    className="w-full p-1 border border-gray-200 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Project ID"
                  />
                </td>

                <td className="p-1">
                  <select
                    value={entry.activityId || ''}
                    disabled={isViewMode}
                    onChange={(e) => handleChange(index, "activityId", e.target.value)}
                    className="w-full p-1 border border-gray-200 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {uniqueActivities?.length > 1 && <option value="">Select Activity</option>}
                    {uniqueActivities?.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name.substring(0, 15)}
                      </option>
                    ))}
                  </select>
                </td>

                {entry.hours.map((hour, dayIndex) => (
                  <td key={dayIndex} className="p-1">
                    <input
                      disabled={isViewMode}
                      type="number"
                      min="0"
                      value={hour === 0 ? "" : hour}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleHourChange(index, dayIndex, value === "" ? 0 : Number(value));
                      }}
                      className="w-full px-1 py-0.5 border rounded-sm text-center text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                ))}

                <td className="p-1">
                  <input
                    disabled={isViewMode}
                    type="text"
                    value={entry.remarks}
                    onChange={(e) => handleChange(index, "remarks", e.target.value)}
                    className="w-full p-1 border border-gray-200 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="p-1 text-center font-medium text-xs">
                  {entry.hours.reduce((acc, h) => acc + Number(h || 0), 0)}
                </td>
                <td className="p-1 text-center">
                  <button
                    onClick={() => onRemoveRow(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isViewMode && (
          <div className="flex justify-between mt-2">
            <button
              onClick={onAddRow}
              className="px-2 py-1 bg-blue-600 text-white rounded-sm text-xs shadow hover:bg-blue-700"
            >
              + Add Row
            </button>
            <button
              onClick={openPreview}
              className="px-2 py-1 bg-green-600 text-white rounded-sm text-xs shadow hover:bg-green-700"
            >
              Preview & Submit
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl min-w-[1200px] max-h-[85vh] overflow-auto">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Timesheet Preview</h2>
          <button
            onClick={() => setIsPreviewOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="p-2 text-left w-[120px]">Entity</th>
                <th className="p-2 text-left w-[110px]">Project</th>
                <th className="p-2 text-left w-[110px]">Activity</th>
                {weekDates.map((date) => (
                  <th key={date} className="p-2 text-center w-[50px]">
                    <div className="flex flex-col items-center">
                      <span className="text-xs">{dayjs(date).format('ddd')}</span>
                      <span className="text-xs">{dayjs(date).format('DD')}</span>
                    </div>
                  </th>
                ))}
                <th className="p-2 text-left w-[120px]">Remarks</th>
                <th className="p-2 text-center w-[50px]">Total</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {previewEntries.map((entry, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    {entities.find(e => e.EntityID.toString() === entry.entityId?.toString())?.EntityName || 'N/A'}
                  </td>
                  <td className="p-2">
                    {projects.find(p => p.id.toString() === entry.projectId?.toString())?.name || entry.projectId}
                  </td>
                  <td className="p-2">
                    {uniqueActivities?.find(a => a.id.toString() === entry.activityId?.toString())?.name || entry.activityId}
                  </td>
                  {entry.hours.map((hour, dayIndex) => (
                    <td key={dayIndex} className="p-2 text-center">
                      {hour || '0'}
                    </td>
                  ))}
                  <td className="p-2">{entry.remarks}</td>
                  <td className="p-2 text-center font-semibold">
                    {entry.hours.reduce((sum, h) => sum + Number(h || 0), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={() => setIsPreviewOpen(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave('saved')}
            disabled={isSavingDraft}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSavingDraft ? 'Saving Draft...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave('submitted')}
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Timesheet'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}


