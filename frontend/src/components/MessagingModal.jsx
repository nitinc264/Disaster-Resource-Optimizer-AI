import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Send,
  Loader2,
  Check,
  CheckCheck,
  User,
  Users,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Modal from "./Modal";
import {
  sendMessage,
  getConversations,
  getConversation,
  markAsRead,
  getUnreadCount,
} from "../services/messagingService";
import { getVolunteers } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import "./MessagingModal.css";

const POLL_INTERVAL = 5000; // Poll every 5 seconds

export default function MessagingModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { user, isManager } = useAuth();
  const [view, setView] = useState("conversations"); // "conversations" | "chat" | "new"
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState([]);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const result = await getConversations();
      if (result.success) {
        setConversations(result.data);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!selectedPartner) return;
    try {
      const result = await getConversation(selectedPartner._id);
      if (result.success) {
        setMessages(result.data);
        // Mark messages as read
        await markAsRead(selectedPartner._id);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [selectedPartner]);

  // Fetch contacts (volunteers for managers, managers for volunteers)
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      if (isManager) {
        const result = await getVolunteers();
        if (result.success) {
          setContacts(result.data.filter((v) => v.isActive));
        }
      } else {
        // For volunteers, we'll get managers from conversations or start new
        const result = await getConversations();
        if (result.success && result.data.length > 0) {
          // Use existing conversation partners (managers)
          const managers = result.data
            .filter((c) => c.partner?.role === "manager")
            .map((c) => c.partner);
          setContacts(managers);
        }
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  // Initial load and polling
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
      if (view === "new") {
        fetchContacts();
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, view, fetchConversations, fetchContacts]);

  // Poll for new messages in chat view
  useEffect(() => {
    if (isOpen && view === "chat" && selectedPartner) {
      fetchMessages();
      pollIntervalRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, view, selectedPartner, fetchMessages]);

  // Handle opening a conversation
  const handleOpenConversation = async (partner) => {
    setSelectedPartner(partner);
    setView("chat");
    setLoading(true);
    try {
      const result = await getConversation(partner._id);
      if (result.success) {
        setMessages(result.data);
        await markAsRead(partner._id);
        fetchConversations(); // Refresh to update unread counts
      }
    } catch (err) {
      console.error("Error opening conversation:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle starting new conversation
  const handleStartNewConversation = (contact) => {
    setSelectedPartner(contact);
    setMessages([]);
    setView("chat");
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPartner) return;

    setSending(true);
    try {
      const result = await sendMessage(selectedPartner._id, newMessage.trim());
      if (result.success) {
        setMessages((prev) => [...prev, result.data]);
        setNewMessage("");
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  // Handle key press in input
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Back to conversations
  const handleBack = () => {
    setView("conversations");
    setSelectedPartner(null);
    setMessages([]);
    fetchConversations();
  };

  // Handle close
  const handleClose = () => {
    setView("conversations");
    setSelectedPartner(null);
    setMessages([]);
    onClose();
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return t("messaging.yesterday") || "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // Render conversations list
  const renderConversations = () => (
    <div className="messaging-conversations">
      <div className="messaging-actions">
        <button
          className="btn-new-message"
          onClick={() => {
            setView("new");
            fetchContacts();
          }}
        >
          <MessageSquare size={16} />
          {t("messaging.newMessage") || "New Message"}
        </button>
        <button className="btn-refresh" onClick={fetchConversations}>
          <RefreshCw size={16} />
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-conversations">
          <MessageSquare size={48} />
          <p>{t("messaging.noConversations") || "No conversations yet"}</p>
          <p className="hint">
            {isManager
              ? t("messaging.startConvoHintManager") ||
                "Send a message to a volunteer to start a conversation"
              : t("messaging.startConvoHintVolunteer") ||
                "Send a message to a manager to start a conversation"}
          </p>
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div
              key={conv.partner?._id}
              className={`conversation-item ${conv.unreadCount > 0 ? "unread" : ""}`}
              onClick={() => handleOpenConversation(conv.partner)}
            >
              <div className="conversation-avatar">
                {getInitials(conv.partner?.name)}
              </div>
              <div className="conversation-info">
                <div className="conversation-header">
                  <span className="conversation-name">{conv.partner?.name}</span>
                  <span className="conversation-time">
                    {formatTime(conv.lastMessage?.createdAt)}
                  </span>
                </div>
                <div className="conversation-preview">
                  <span className="preview-text">
                    {conv.lastMessage?.senderId === user?._id && (
                      <span className="you-prefix">{t("messaging.you") || "You"}: </span>
                    )}
                    {conv.lastMessage?.text?.substring(0, 50)}
                    {conv.lastMessage?.text?.length > 50 && "..."}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="unread-badge">{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render chat view
  const renderChat = () => (
    <div className="messaging-chat">
      <div className="chat-header">
        <button className="btn-back" onClick={handleBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="chat-partner-avatar">{getInitials(selectedPartner?.name)}</div>
        <div className="chat-partner-info">
          <span className="partner-name">{selectedPartner?.name}</span>
          <span className="partner-role">
            {selectedPartner?.role === "manager"
              ? t("roles.manager") || "Manager"
              : t("roles.volunteer") || "Volunteer"}
          </span>
        </div>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading">
            <Loader2 size={24} className="spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-chat">
            <p>{t("messaging.startTyping") || "Start the conversation by sending a message"}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isSent = msg.senderId?._id === user?._id || msg.senderId === user?._id;
              const senderRole = msg.senderRole || (msg.senderId?.role) || "volunteer";
              return (
                <div
                  key={msg._id}
                  className={`chat-message ${isSent ? "sent" : "received"} role-${senderRole}`}
                >
                  <div className="message-bubble">
                    {!isSent && (
                      <span className={`sender-role-label ${senderRole}`}>
                        {senderRole === "manager" ? t("roles.manager") || "Manager" : t("roles.volunteer") || "Volunteer"}
                      </span>
                    )}
                    <p className="message-text">{msg.text}</p>
                    <div className="message-meta">
                      <span className="message-time">
                        {formatTime(msg.createdAt)}
                      </span>
                      {isSent && (
                        <span className="message-status">
                          {msg.isRead ? (
                            <CheckCheck size={14} className="read" />
                          ) : (
                          <Check size={14} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t("messaging.typeMessage") || "Type a message..."}
          rows={1}
          disabled={sending}
        />
        <button
          className="btn-send"
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );

  // Render new conversation (contact selection)
  const renderNewConversation = () => (
    <div className="messaging-new">
      <div className="new-header">
        <button className="btn-back" onClick={handleBack}>
          <ArrowLeft size={20} />
        </button>
        <h3>
          {isManager
            ? t("messaging.selectVolunteer") || "Select a Volunteer"
            : t("messaging.selectManager") || "Select a Manager"}
        </h3>
      </div>

      {loading ? (
        <div className="contacts-loading">
          <Loader2 size={24} className="spin" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="no-contacts">
          <Users size={48} />
          <p>
            {isManager
              ? t("messaging.noVolunteers") || "No volunteers available"
              : t("messaging.noManagers") || "No managers available"}
          </p>
        </div>
      ) : (
        <div className="contacts-list">
          {contacts.map((contact) => (
            <div
              key={contact._id}
              className="contact-item"
              onClick={() => handleStartNewConversation(contact)}
            >
              <div className="contact-avatar">{getInitials(contact.name)}</div>
              <div className="contact-info">
                <span className="contact-name">{contact.name}</span>
                {contact.phone && <span className="contact-phone">{contact.phone}</span>}
              </div>
              <MessageSquare size={18} className="contact-action" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getTitle = () => {
    switch (view) {
      case "chat":
        return t("messaging.chat") || "Chat";
      case "new":
        return t("messaging.newConversation") || "New Conversation";
      default:
        return t("messaging.messages") || "Messages";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getTitle()} hideFooter>
      <div className="messaging-modal">
        {view === "conversations" && renderConversations()}
        {view === "chat" && renderChat()}
        {view === "new" && renderNewConversation()}
      </div>
    </Modal>
  );
}
