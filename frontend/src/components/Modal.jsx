import { useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import "./Modal.css";

/**
 * Reusable Modal Component
 * - Centered full-page modal with backdrop
 * - Max width ~900px on desktop, full width on mobile
 * - Scrollable content area
 * - Closes on ESC key, backdrop click, or close button
 * - High z-index to appear above all UI
 * - Accessibility: focus trap, focus first field on open, role="dialog", aria-modal
 */
function Modal({ isOpen, onClose, title, children, hideFooter = false }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle ESC key to close modal
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
        return;
      }

      // Focus trap - Tab key
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open and manage focus
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";

      // Focus first focusable element in modal after a short delay
      setTimeout(() => {
        if (modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'input, select, textarea, button:not(.modal-close-btn):not(.modal-cancel-btn), [tabindex]:not([tabindex="-1"])'
          );
          const firstInput = Array.from(focusableElements).find(
            (el) => el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA"
          );
          if (firstInput) {
            firstInput.focus();
          } else if (focusableElements[0]) {
            focusableElements[0].focus();
          }
        }
      }, 50);
    } else {
      document.body.style.overflow = "";
      // Restore focus to previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={modalRef}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            <X size={24} />
          </button>
        </div>
        <div className="modal-content">{children}</div>
        {!hideFooter && (
          <div className="modal-footer">
            <button
              className="modal-cancel-btn"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
