"use client";
import { useState, useEffect } from "react";
import StaffCard from "./staff/StaffCard";
import StaffDetailsModal from "./staff/StaffDetailsModal";

export default function SimpleStaffCards() {
  const [staffCards, setStaffCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [activeStaff, setActiveStaff] = useState<any | null>(null);

  useEffect(() => {
    // Simple timeout to simulate loading and then show mock data
    const timer = setTimeout(() => {
      const mockData = [
        {
          user_id: "1",
          name: "Abdullah",
          email: "abdullah@adeersolutions.com",
          role: "hr",
          avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        },
        {
          user_id: "2", 
          name: "Reema Al-kuwari",
          email: "eo@adeersolutions.com",
          role: "ceo",
          avatar_url: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
        },
        {
          user_id: "3",
          name: "Mossa",
          email: "hr@test.com", 
          role: "hr",
          avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        }
      ];
      
      setStaffCards(mockData);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-sm opacity-70">Loading staff cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Staff Cards ({staffCards.length})</h2>
        <button 
          onClick={() => window.location.reload()} 
          className="text-xs text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>
      
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {staffCards.map((staff) => (
          <li key={staff.user_id}>
            <StaffCard
              staff={{
                id: staff.user_id,
                full_name: staff.name,
                title: null,
                team: null,
                avatar_url: staff.avatar_url,
                role: staff.role,
                status: "—",
                today_check_in: null,
                today_check_out: null,
                warnings_count: 0,
              }}
              onShowMore={(id) => {
                setActiveStaff({ 
                  id, 
                  full_name: staff.name, 
                  title: null, 
                  team: null, 
                  avatar_url: staff.avatar_url 
                });
                setOpenModal(true);
              }}
            />
          </li>
        ))}
      </ul>

      <StaffDetailsModal 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        staff={activeStaff} 
      />
    </div>
  );
}
