import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Header from "../components/Header";
import TimesheetTable from "../components/TimesheetTable";
import TotalHours from "../components/TotalHours";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import PreviousWeekEntries from '../components/PreviousWeekEntries';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.tz.setDefault('Asia/Kolkata');

export default function TimesheetPage() {
  const [entries, setEntries] = useState([]);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [weekDates, setWeekDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previousEntries, setPreviousEntries] = useState([]);
  const [weekInfo, setWeekInfo] = useState(null);
  const user = JSON.parse(localStorage.getItem("user"));
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const navigate = useNavigate();

  // Main useEffect for initial load and URL parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const employeeIdParam = queryParams.get('employeeId');
    const weekStartParam = queryParams.get('weekStart');
    const weekEndParam = queryParams.get('weekEnd');
    const viewMode = queryParams.get('view');
    const editMode = queryParams.get('edit');

    // Calculate week dates
    const calculateWeekDates = (baseDate) => {
      return Array.from({ length: 7 }, (_, i) =>
        baseDate.startOf('isoWeek').add(i, 'day').format('YYYY-MM-DD')
      );
    };

    // Set initial dates
    let baseDate = dayjs().tz('Asia/Kolkata');
    if (weekStartParam) {
      baseDate = dayjs.tz(weekStartParam, 'YYYY-MM-DD', 'Asia/Kolkata');
    }
    
    const newWeekDates = calculateWeekDates(baseDate);
    setCurrentDate(baseDate);
    setWeekDates(newWeekDates);

    //   entries if in view/edit mode
    const fetchEntries = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/week-entries?employeeId=${employeeIdParam|| user.empId}&weekStart=${weekStartParam}&weekEnd=${weekEndParam}`
        );
        const data = await response.json();
        if (data.success) setEntries(data.entries);
      } catch (error) {
        toast.error(`Failed to load entries: ${error.message}`);
      }
    };

    if (viewMode || editMode) {
      setIsViewMode(!!viewMode);
      setIsEditMode(!!editMode);
      fetchEntries();
    }
  }, [user.empId, navigate]);

  // Fetch previous entries
useEffect(() => {
  const fetchPreviousEntries = async () => {
    try {
      // Calculate reference date based on selected week minus 1 week
      const referenceDate = currentDate.startOf('isoWeek').subtract(1, 'week');
      const response = await fetch(
        `http://localhost:5000/previous-entries?employeeId=${user.empId}&currentDate=${referenceDate.format('YYYY-MM-DD')}&weeksBack=0`
      );
      const data = await response.json();
      if (data.success) {
        setPreviousEntries(data.entries);
        setWeekInfo(data.week);
      }
    } catch (error) {
      toast.error(`Failed to load previous entries: ${error.message}`);
    }
  };

  if (!isViewMode && !isEditMode) fetchPreviousEntries();
}, [isViewMode, isEditMode, user.empId, currentDate]); // Add currentDate to dependencies

  // Entry handling functions
  const handleEntryChange = (index, updatedEntry) => {
    const updated = [...entries];
    updated[index] = updatedEntry;
    setEntries(updated);
  };

  const handleAddRow = () => {
    setEntries(prev => [
      ...prev,
      {
        id: Date.now(),
        entityId: '',
        projectId: '',
        activityId: '',
        hours: new Array(7).fill(0),
        remarks: '',
        isProjectTouched: false
      }
    ]);
  };

  const handleRemoveRow = (index) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  // Save handler
  const handleSave = async (entriesToSubmit,status) => {
    setLoading(true);
    
    try {
      const statusMap = {
        saved: 'Draft',
        submitted: 'Submitted'
      };
      const backendStatus = statusMap[status];
      const payload = entries.flatMap(entry => 
        entry.hours.map((hour, index) => ({
          projectId: entry.projectId,
          activity: entry.activityId,
          date: weekDates[index],
          hours: Number(hour),
          remarks: entry.remarks,
          week: currentDate.isoWeek(),
          employeeId: user.empId,
          entityId: entry.entityId,
          status: backendStatus
        })).filter(h => h.hours > 0)
      );

      const response = await fetch('http://localhost:5000/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save timesheet');
      
      toast.success(status === 'saved' ? 'Draft saved!' : 'Timesheet submitted!');
      if (isEditMode) navigate('/landing');
    } finally {
      setLoading(false);
    }
  };

  // Date picker handler
  const handleWeekChange = (date) => {
    if (isViewMode || isEditMode) return;
    const newDate = dayjs(date).tz('Asia/Kolkata');
    setCurrentDate(newDate);
    setWeekDates(Array.from({ length: 7 }, (_, i) => 
      newDate.startOf('isoWeek').add(i, 'day').format('YYYY-MM-DD')
    ));
  };

  // Memoized data
  const entities = useMemo(() => 
    user?.entityIds?.map((id, index) => ({
      EntityID: id,
      EntityName: user?.entityNames?.[index] || ''
    })) || [], [user]);

  const projects = useMemo(() => 
    user?.projectIds?.map((id, index) => ({
      id,
      name: user?.projectName?.[index] || ''
    })) || [], [user]);

  const activities = useMemo(() => 
    user?.projectActivities?.flatMap(project => 
      project?.activityIds?.map((id, index) => ({
        id,
        name: project?.activityNames?.[index] || ''
      })) || []
    ) || [], [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-6 px-4 py-2 bg-white rounded-xl shadow-md">
          <DatePicker
            selected={currentDate.toDate()}
            onChange={handleWeekChange}
            disabled={isViewMode || isEditMode}
            showWeekNumbers
            customInput={
              <div className="flex items-center cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="ml-2 text-gray-700 font-medium">
                  Week {currentDate.isoWeek()} (
                  {currentDate.startOf('isoWeek').format('DD MMM')} - 
                  {currentDate.endOf('isoWeek').format('DD MMM')})
                </span>
              </div>
            }
            calendarClassName="shadow-lg rounded-lg border border-gray-200 p-3"
            renderCustomHeader={({ 
              date,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            }) => (
              <div className="flex items-center justify-between px-4 py-3 mb-2">
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100">
                  ◀
                </button>
                <span className="text-gray-700 font-semibold text-lg">
                  {dayjs(date).format('MMMM YYYY')}
                </span>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100">
                  ▶
                </button>
              </div>
            )}
            calendarStartDay={1}
          />
        </div>

        <TimesheetTable
          entries={entries}
          weekDates={weekDates}
          onEntryChange={handleEntryChange}
          onAddRow={isViewMode ? undefined : handleAddRow}
          onRemoveRow={isViewMode ? undefined : handleRemoveRow}
          projects={projects}
          activities={activities}
          entities={entities}
          onSubmitTimesheet={(entries, status) => handleSave(entries, status)}
          isViewMode={isViewMode}
          isEditMode={isEditMode}
        />

        <TotalHours total={entries.reduce((acc, entry) => 
          acc + entry.hours.reduce((sum, h) => sum + Number(h), 0), 0)} 
        />

        {!isViewMode && !isEditMode && previousEntries.length > 0 && (
          <PreviousWeekEntries 
            previousEntries={previousEntries}
            onApplyEntry={(entry) => setEntries(prev => [...prev, {...entry, id: Date.now()}])}
            onApplyAll={() => setEntries(prev => [...prev, ...previousEntries.map(e => ({...e, id: Date.now()}))])}
            weekInfo={weekInfo}
          />
        )}
      </div>
    </div>
  );
}
