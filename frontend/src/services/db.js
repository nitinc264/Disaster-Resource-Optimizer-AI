import Dexie from "dexie";

// Create a new Dexie database named 'auraDB'
export const db = new Dexie("auraDB");

// Define the database schema
db.version(1).stores({
  // pendingVerifications: auto-incrementing primary key 'id', indexed 'taskId'
  pendingVerifications: "++id, taskId",
  // offlineReports: key-value store for offline audio reports
  offlineReports: "id, timestamp",
  // relayReports: key-value store for relayed reports
  relayReports: "relayId, timestamp",
  // mapTiles: key-value store for offline map tiles
  mapTiles: "key",
});
