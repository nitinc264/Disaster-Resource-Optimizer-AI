import React from "react";
import { AlertTriangle } from "lucide-react";
import i18next from "i18next";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            margin: "20px",
            backgroundColor: "#fee",
            border: "2px solid #c33",
            borderRadius: "8px",
          }}
        >
          <h1
            style={{
              color: "#c33",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <AlertTriangle size={32} /> {i18next.t("error.somethingWentWrong")}
          </h1>
          <details style={{ whiteSpace: "pre-wrap", marginTop: "20px" }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
              {i18next.t("error.clickForDetails")}
            </summary>
            <p style={{ marginTop: "10px" }}>
              <strong>{i18next.t("error.errorLabel")}:</strong>{" "}
              {this.state.error?.toString()}
            </p>
            <p>
              <strong>{i18next.t("error.stackLabel")}:</strong>
            </p>
            <pre style={{ fontSize: "12px", overflow: "auto" }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              backgroundColor: "#c33",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {i18next.t("error.reloadPage")}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
