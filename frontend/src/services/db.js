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

// Version 2: Add synced index to relayReports
db.version(2).stores({
  pendingVerifications: "++id, taskId",
  offlineReports: "id, timestamp",
  relayReports: "relayId, timestamp, synced",
  mapTiles: "key",
});

// Version 3: Add imageBlob support to offlineReports and relayReports
db.version(3).stores({
  pendingVerifications: "++id, taskId",
  offlineReports: "id, timestamp, hasImage",
  relayReports: "relayId, timestamp, synced, hasImage",
  mapTiles: "key",
});

// Version 4: Remove deprecated relayReports store
db.version(4)
  .stores({
    pendingVerifications: "++id, taskId",
    offlineReports: "id, timestamp, hasImage",
    mapTiles: "key",
    relayReports: null,
  })
  .upgrade(async (tx) => {
    try {
      await tx.table("relayReports").clear();
    } catch (error) {
      // Table may already be removed; ignore failures to maintain compatibility
    }
  });

// Version 5: Add offlineQueue store for generic offline request queuing
db.version(5).stores({
  pendingVerifications: "++id, taskId",
  offlineReports: "id, timestamp, hasImage",
  mapTiles: "key",
  offlineQueue: "++id, status, createdAt",
});
