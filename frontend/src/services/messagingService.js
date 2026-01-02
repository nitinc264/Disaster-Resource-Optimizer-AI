import { apiClient } from "./api";

/**
 * Send a message to another user
 */
export const sendMessage = async (receiverId, text) => {
  const response = await apiClient.post("/messages/send", {
    receiverId,
    text,
  });
  return response.data;
};

/**
 * Get all conversations for the current user
 */
export const getConversations = async () => {
  const response = await apiClient.get("/messages/conversations");
  return response.data;
};

/**
 * Get conversation with a specific user
 */
export const getConversation = async (partnerId) => {
  const response = await apiClient.get(`/messages/conversation/${partnerId}`);
  return response.data;
};

/**
 * Get unread message count
 */
export const getUnreadCount = async () => {
  const response = await apiClient.get("/messages/unread-count");
  return response.data;
};

/**
 * Mark messages from a user as read
 */
export const markAsRead = async (partnerId) => {
  const response = await apiClient.put(`/messages/read/${partnerId}`);
  return response.data;
};

/**
 * Get list of managers (for volunteers to message)
 */
export const getManagersList = async () => {
  const response = await apiClient.get("/messages/managers");
  return response.data;
};
