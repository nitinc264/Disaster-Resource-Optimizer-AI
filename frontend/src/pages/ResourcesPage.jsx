import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Truck,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
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

  const getStatusClass = (percentage) => {
    if (percentage >= 70) return "good";
    if (percentage >= 40) return "warning";
    return "critical";
  };

  return (
    <div className="resources-page">
      <div className="resources-container">
        {/* Header */}
        <div className="resources-header">
          <div className="resources-header-content">
            <div>
              <h1>Resource Management</h1>
              <p>Monitor and manage all disaster response resources</p>
            </div>
            <button className="btn-refresh">
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {/* Resource Availability Section */}
        <section>
          <h2 className="section-title">
            <Activity size={24} />
            Resource Availability
          </h2>

          <div className="resources-grid">
            {/* Fleet Vehicles Card */}
            <div className="resource-card">
              <div className="resource-card-header">
                <div className="resource-card-icon-group">
                  <div className="resource-card-icon blue">
                    <Truck size={24} />
                  </div>
                  <div>
                    <h3 className="resource-card-title">Fleet Vehicles</h3>
                    <p className="resource-card-subtitle">All vehicle types</p>
                  </div>
                </div>
                <div className="resource-card-stats">
                  <div className="resource-card-count">
                    {stats.fleet.available}
                    <span>/{stats.fleet.total}</span>
                  </div>
                  <div className={`resource-card-percentage ${getStatusClass(
                    getAvailabilityPercentage(stats.fleet.available, stats.fleet.total)
                  )}`}>
                    {getAvailabilityPercentage(stats.fleet.available, stats.fleet.total)}% Available
                  </div>
                </div>
              </div>

              <div className="resource-items-list">
                {resources.fleet.map((vehicle) => {
                  const percentage = getAvailabilityPercentage(vehicle.available, vehicle.total);
                  return (
                    <div key={vehicle.id} className="resource-item">
                      <span className="resource-item-name">{vehicle.type}</span>
                      <div className="resource-item-stats">
                        <div className="resource-item-count">
                          <strong>{vehicle.available}</strong>
                          <span>/{vehicle.total}</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill ${getStatusClass(percentage)}`}
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
            <div className="resource-card">
              <div className="resource-card-header">
                <div className="resource-card-icon-group">
                  <div className="resource-card-icon purple">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="resource-card-title">Personnel</h3>
                    <p className="resource-card-subtitle">All roles</p>
                  </div>
                </div>
                <div className="resource-card-stats">
                  <div className="resource-card-count">
                    {stats.personnel.available}
                    <span>/{stats.personnel.total}</span>
                  </div>
                  <div className={`resource-card-percentage ${getStatusClass(
                    getAvailabilityPercentage(stats.personnel.available, stats.personnel.total)
                  )}`}>
                    {getAvailabilityPercentage(stats.personnel.available, stats.personnel.total)}% Available
                  </div>
                </div>
              </div>

              <div className="resource-items-list">
                {resources.personnel.map((person) => {
                  const percentage = getAvailabilityPercentage(person.available, person.total);
                  return (
                    <div key={person.id} className="resource-item">
                      <span className="resource-item-name">{person.role}</span>
                      <div className="resource-item-stats">
                        <div className="resource-item-count">
                          <strong>{person.available}</strong>
                          <span>/{person.total}</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill ${getStatusClass(percentage)}`}
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
        <section className="inventory-section">
          <h2 className="section-title">
            <Package size={24} />
            Resource Inventory
          </h2>

          <div className="inventory-card">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Available Stock</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryList.map((item) => {
                  const isLowStock = item.available < 10;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-item-name">
                          <Package size={16} />
                          {item.name}
                        </div>
                      </td>
                      <td>
                        <span className={`inventory-stock ${isLowStock ? 'low' : 'normal'}`}>
                          {item.available}
                        </span>
                      </td>
                      <td>
                        <span className="inventory-unit">{item.unit}</span>
                      </td>
                      <td>
                        {isLowStock ? (
                          <span className="status-badge low-stock">
                            <AlertTriangle size={14} />
                            Low Stock
                          </span>
                        ) : (
                          <span className="status-badge in-stock">
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
        </section>
      </div>
    </div>
  );
}
