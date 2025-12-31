import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Home } from "lucide-react";
import { sheltersAPI } from "../services/apiService";
import { AddShelterForm } from "../components/ShelterManagement";
import "./AddShelterPage.css";

export default function AddShelterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => sheltersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["shelters"]);
      navigate("/dashboard", { replace: true });
    },
    onError: (err) => {
      console.error("Error registering shelter:", err);
      const message = err?.response?.data?.message || t("shelter.errorRegister");
      alert(message || "Failed to register shelter");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (data) => {
    setIsSubmitting(true);
    createMutation.mutate(data);
  };

  const handleCancel = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div className="add-shelter-page">
      <div className="page-container">
        <header className="page-header">
          <button className="btn-back" onClick={handleCancel}>
            <ArrowLeft size={20} />
            <span>{t("common.back", "Back")}</span>
          </button>
          <div className="header-title">
            <Home size={24} />
            <h1>{t("shelter.registerShelter")}</h1>
          </div>
        </header>

        <main className="page-content">
          <div className="form-container">
            <AddShelterForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              currentLocation={null}
              isSubmitting={isSubmitting}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
