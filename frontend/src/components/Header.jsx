import React, { useEffect, useState } from "react";
import logo from "../assets/logo.jpg";
import { FaUserCircle } from "react-icons/fa";
import { IoChevronDown } from "react-icons/io5";
import { toast } from "react-toastify"; // <-- Import toast

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser?.empName) {
      setUserName(storedUser.empName);
    } else {
      setUserName("Guest");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    toast.success("Logged out successfully 👋", {
      position: "top-right",
      autoClose: 2000,
    });
    // Optionally redirect after logout
    setTimeout(() => window.location.href = "/login", 2000);
  };

  return (
    <header className="bg-white text-gray-800 p-2 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src={logo} alt="Ramp Logo" className="h-10 w-auto" />
        </div>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 focus:outline-none cursor-pointer hover:text-black"
          >
            <FaUserCircle size={26} className="text-gray-700" />
            <span className="font-medium">{userName}</span>
            <IoChevronDown size={18} className="text-gray-600" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
