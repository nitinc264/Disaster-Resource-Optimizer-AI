import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getResourceStations, updateResourceAvailability } from "../services";
import {
  Package,
  Droplets,
  Pill,
  Shirt,
  UtensilsCrossed,
  Plus,
  Minus,
  Save,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Building2,
} from "lucide-react";
import "./ResourceInventory.css";

// Supply categories with icons
const SUPPLY_CATEGORIES = {
  water: { icon: Droplets, label: "Water (L)", color: "#3b82f6", unit: "L" },
  medical: {
    icon: Pill,
    label: "Medical Kits",
    color: "#ef4444",
    unit: "kits",
  },
  blankets: { icon: Shirt, label: "Blankets", color: "#8b5cf6", unit: "pcs" },
  food: {
    icon: UtensilsCrossed,
    label: "Food Packets",
    color: "#f59e0b",
    unit: "pkts",
  },
};

/**
 * Resource Inventory Management Component
 */
export default function ResourceInventory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingStation, setEditingStation] = useState(null);
  const [editedValues, setEditedValues] = useState({});

  const {
    data: inventory = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await getResourceStations()) || [],
    refetchInterval: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ stationId, supplyType, newValue }) =>
      updateResourceAvailability(stationId, { [supplyType]: newValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditingStation(null);
      setEditedValues({});
    },
  });

  // Calculate alerts for low stock
  const alerts = useMemo(() => {
    const lowStock = [];
    inventory.forEach((station) => {
      if (!station.supplies) return;
      Object.entries(station.supplies).forEach(([type, data]) => {
        if (data?.current < data?.minimum) {
          lowStock.push({
            stationId: station.id,
            stationName: station.name,
            supplyType: type,
            current: data.current,
            minimum: data.minimum,
            deficit: (data.minimum || 0) - (data.current || 0),
          });
        }
      });
    });
    return lowStock;
  }, [inventory]);

  // Get stock level status
  const getStockLevel = (current, minimum, maximum) => {
    const percentage = (current / maximum) * 100;
    if (current < minimum) return "critical";
    if (percentage < 30) return "low";
    if (percentage < 60) return "medium";
    return "good";
  };

  // Handle editing
  const startEditing = (stationId) => {
    const station = inventory.find((s) => s.id === stationId);
    if (station && station.supplies) {
      const values = {};
      Object.entries(station.supplies).forEach(([type, data]) => {
        values[type] = data.current;
      });
      setEditedValues(values);
      setEditingStation(stationId);
    }
  };

  const handleValueChange = (type, delta) => {
    setEditedValues((prev) => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) + delta),
    }));
  };

  const saveChanges = () => {
    if (!editingStation) return;

    Object.entries(editedValues).forEach(([type, value]) => {
      updateMutation.mutate({
        stationId: editingStation,
        supplyType: type,
        newValue: value,
      });
    });
  };

  if (isLoading) {
    return (
      <div className="inventory-loading">
        <Package size={24} className="pulse" />
        <span>{t("resources.loading")}</span>
      </div>
    );
  }

  return (
    <div className="resource-inventory">
      {/* Header */}
      <div className="inventory-header">
        <div className="inventory-title">
          <Package size={24} />
          <h2>{t("resources.inventory")}</h2>
        </div>
        <button
          className="inventory-refresh"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={18} className={isFetching ? "spin" : ""} />
          {isFetching ? t("resources.syncing") : t("resources.refresh")}
        </button>
      </div>

      {/* Low Stock Alerts */}
      {alerts.length > 0 && (
        <div className="inventory-alerts">
          <div className="alert-header">
            <AlertTriangle size={18} />
            <span>
              {alerts.length}{" "}
              {alerts.length > 1
                ? t("resources.lowStockAlerts")
                : t("resources.lowStockAlert")}
            </span>
          </div>
          <div className="alert-list">
            {alerts.slice(0, 3).map((alert, idx) => {
              const category = SUPPLY_CATEGORIES[alert.supplyType];
              return (
                <div key={idx} className="alert-item">
                  <category.icon size={16} style={{ color: category.color }} />
                  <span>
                    <strong>{alert.stationName}</strong>: {category.label} (
                    {alert.current}/{alert.minimum} {category.unit})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Station Cards */}
      <div className="inventory-grid">
        {inventory.map((station) => (
          <div key={station.id} className="inventory-card">
            <div className="card-header">
              <div className="station-info">
                <Building2 size={20} />
                <div>
                  <h3>{station.name}</h3>
                  <span className="station-type">{station.type}</span>
                </div>
              </div>
              {editingStation === station.id ? (
                <button className="save-btn" onClick={saveChanges}>
                  <Save size={16} />
                  {t("common.save")}
                </button>
              ) : (
                <button
                  className="edit-btn"
                  onClick={() => startEditing(station.id)}
                >
                  {t("common.edit")}
                </button>
              )}
            </div>

            <div className="supplies-list">
              {Object.entries(station.supplies || {}).map(([type, data]) => {
                const category = SUPPLY_CATEGORIES[type];
                const Icon = category.icon;
                const level = getStockLevel(
                  data.current,
                  data.minimum,
                  data.maximum
                );
                const isEditing = editingStation === station.id;
                const displayValue = isEditing
                  ? editedValues[type]
                  : data.current;
                const percentage = (displayValue / data.maximum) * 100;

                return (
                  <div key={type} className={`supply-row ${level}`}>
                    <div className="supply-info">
                      <Icon size={18} style={{ color: category.color }} />
                      <span className="supply-name">{category.label}</span>
                    </div>

                    {isEditing ? (
                      <div className="supply-editor">
                        <button
                          className="qty-btn"
                          onClick={() => handleValueChange(type, -10)}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="qty-value">{displayValue}</span>
                        <button
                          className="qty-btn"
                          onClick={() => handleValueChange(type, 10)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="supply-stats">
                        <div className="supply-bar-container">
                          <div
                            className={`supply-bar ${level}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="supply-value">
                          {displayValue}
                          <span className="supply-max">/{data.maximum}</span>
                        </span>
                      </div>
                    )}

                    {level === "critical" && !isEditing && (
                      <AlertTriangle size={16} className="warning-icon" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="card-footer">
              <span className="last-restock">
                {t("resources.lastRestocked")}{" "}
                {new Date(station.lastRestocked).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
