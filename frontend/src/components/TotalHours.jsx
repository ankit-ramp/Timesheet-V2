import React from "react";

export default function TotalHours({ total }) {
    return (
      <div className="mt-4 text-right font-medium text-lg">
        Total Hours: <span className="text-blue-600">{total}</span>
      </div>
    );
  }
  