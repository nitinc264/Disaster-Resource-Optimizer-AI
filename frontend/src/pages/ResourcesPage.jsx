import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Truck,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import "./ResourcesPage.css";

export default function ResourcesPage() {
  const { t } = useTranslation();
  
  // Mock data for resources
  const [resources] = useState({
    fleet: [
      { id: 1, type: "Ambulance", total: 15, available: 12, inUse: 3 },
      { id: 2, type: "Fire Truck", total: 8, available: 6, inUse: 2 },
      { id: 3, type: "Supply Truck", total: 20, available: 14, inUse: 6 },
      { id: 4, type: "Rescue Helicopter", total: 4, available: 2, inUse: 2 },
      { id: 5, type: "Mobile Command Unit", total: 3, available: 3, inUse: 0 },
    ],
    personnel: [
      { id: 1, role: "Paramedics", total: 45, available: 32, deployed: 13 },
      { id: 2, role: "Firefighters", total: 60, available: 48, deployed: 12 },
      { id: 3, role: "Search & Rescue", total: 35, available: 22, deployed: 13 },
      { id: 4, role: "Medical Doctors", total: 18, available: 14, deployed: 4 },
      { id: 5, role: "Logistics Staff", total: 25, available: 20, deployed: 5 },
    ],
    inventory: {
      medical: [
        { id: 1, name: "First Aid Kits", available: 450, unit: "kits" },
        { id: 2, name: "Oxygen Tanks", available: 85, unit: "tanks" },
        { id: 3, name: "IV Fluids", available: 320, unit: "bags" },
        { id: 4, name: "Bandages", available: 8, unit: "boxes" },
        { id: 5, name: "Emergency Medications", available: 150, unit: "doses" },
      ],
      supplies: [
        { id: 6, name: "Water Bottles", available: 5, unit: "cases" },
        { id: 7, name: "Food Rations", available: 680, unit: "packs" },
        { id: 8, name: "Blankets", available: 340, unit: "units" },
        { id: 9, name: "Tents", available: 45, unit: "units" },
        { id: 10, name: "Flashlights", available: 7, unit: "units" },
      ],
    },
  });

  // Compute availability stats for Fleet and Personnel
  const getAvailabilityStats = () => {
    const fleetStats = resources.fleet.reduce(
      (acc, item) => ({
        total: acc.total + item.total,
        available: acc.available + item.available,
      }),
      { total: 0, available: 0 }
    );

    const personnelStats = resources.personnel.reduce(
      (acc, item) => ({
        total: acc.total + item.total,
        available: acc.available + item.available,
      }),
      { total: 0, available: 0 }
    );

    return { fleet: fleetStats, personnel: personnelStats };
  };

  // Get inventory list with available stock
  const getInventoryList = () => {
    const allItems = [
      ...resources.inventory.medical,
      ...resources.inventory.supplies,
    ];
    return allItems;
  };

  const stats = useMemo(() => getAvailabilityStats(), [resources]);
  const inventoryList = useMemo(() => getInventoryList(), [resources]);

  const getAvailabilityPercentage = (available, total) => {
    return Math.round((available / total) * 100);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 70) return "text-green-400";
    if (percentage >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Resource Management
              </h1>
              <p className="text-slate-400">
                Monitor and manage all disaster response resources
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {/* Resource Availability Section */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={24} className="text-blue-400" />
            Resource Availability
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fleet Vehicles Card */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Truck size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Fleet Vehicles
                    </h3>
                    <p className="text-sm text-slate-400">All vehicle types</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {stats.fleet.available}
                    <span className="text-slate-400 text-lg">
                      /{stats.fleet.total}
                    </span>
                  </div>
                  <div
                    className={`text-sm font-medium ${getStatusColor(
                      getAvailabilityPercentage(
                        stats.fleet.available,
                        stats.fleet.total
                      )
                    )}`}
                  >
                    {getAvailabilityPercentage(
                      stats.fleet.available,
                      stats.fleet.total
                    )}
                    % Available
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {resources.fleet.map((vehicle) => {
                  const percentage = getAvailabilityPercentage(
                    vehicle.available,
                    vehicle.total
                  );
                  return (
                    <div
                      key={vehicle.id}
                      className="flex items-center justify-between p-3 bg-slate-900 rounded-lg"
                    >
                      <span className="text-slate-300">{vehicle.type}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <span className="text-white font-medium">
                            {vehicle.available}
                          </span>
                          <span className="text-slate-400">
                            /{vehicle.total}
                          </span>
                        </div>
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              percentage >= 70
                                ? "bg-green-500"
                                : percentage >= 40
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personnel Card */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Users size={24} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Personnel
                    </h3>
                    <p className="text-sm text-slate-400">All roles</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">
                    {stats.personnel.available}
                    <span className="text-slate-400 text-lg">
                      /{stats.personnel.total}
                    </span>
                  </div>
                  <div
                    className={`text-sm font-medium ${getStatusColor(
                      getAvailabilityPercentage(
                        stats.personnel.available,
                        stats.personnel.total
                      )
                    )}`}
                  >
                    {getAvailabilityPercentage(
                      stats.personnel.available,
                      stats.personnel.total
                    )}
                    % Available
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {resources.personnel.map((person) => {
                  const percentage = getAvailabilityPercentage(
                    person.available,
                    person.total
                  );
                  return (
                    <div
                      key={person.id}
                      className="flex items-center justify-between p-3 bg-slate-900 rounded-lg"
                    >
                      <span className="text-slate-300">{person.role}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <span className="text-white font-medium">
                            {person.available}
                          </span>
                          <span className="text-slate-400">
                            /{person.total}
                          </span>
                        </div>
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              percentage >= 70
                                ? "bg-green-500"
                                : percentage >= 40
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Resource Inventory Section */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <Package size={24} className="text-green-400" />
            Resource Inventory
          </h2>

          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Item Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Available Stock
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Unit
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {inventoryList.map((item) => {
                    const isLowStock = item.available < 10;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-750 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-slate-400" />
                            <span className="text-white font-medium">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-lg font-semibold ${
                              isLowStock ? "text-red-400" : "text-white"
                            }`}
                          >
                            {item.available}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400">{item.unit}</span>
                        </td>
                        <td className="px-6 py-4">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm font-medium">
                              <AlertTriangle size={14} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-medium">
                              <TrendingUp size={14} />
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
