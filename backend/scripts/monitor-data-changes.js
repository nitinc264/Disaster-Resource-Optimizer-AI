/**
 * Data Change Monitor Script for Aegis AI
 * ----------------------------------------
 * This script monitors MongoDB for:
 * 1. New incoming data (reports, needs, missions)
 * 2. Agent processing changes (Sentinel, Oracle, Logistics)
 * 3. Status transitions throughout the pipeline
 *
 * It presents all changes in a clear, organized format.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

// Configuration
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/DisasterResponseDB";
const POLL_INTERVAL = parseInt(process.env.MONITOR_POLL_INTERVAL) || 2000; // 2 seconds

// State tracking for change detection
const lastSeenState = {
  reports: new Map(), // reportId -> { status, sentinelData, oracleData, etc }
  needs: new Map(),   // needId -> { status, etc }
  missions: new Map() // missionId -> { status, etc }
};

// Change log storage
const changeLog = [];
const MAX_CHANGE_LOG = 100;

// Report Schema (inline to avoid import issues)
const reportSchema = new mongoose.Schema({
  reportId: String,
  source: String,
  text: String,
  imageUrl: String,
  audioUrl: String,
  location: {
    lat: Number,
    lng: Number
  },
  status: String,
  sentinelData: {
    tag: String,
    confidence: Number
  },
  oracleData: {
    severity: Number,
    needs: [String],
    summary: String
  },
  audioData: {
    transcription: String
  },
  emergencyStatus: String,
  emergencyAlertId: String,
  assignedStation: {
    stationId: mongoose.Schema.Types.ObjectId,
    stationName: String,
    stationType: String,
    assignedAt: Date,
    dispatchedAt: Date,
    rejectedAt: Date,
    rejectionReason: String
  },
  timestamp: Date
}, { timestamps: true, strict: false });

// Need Schema
const needSchema = new mongoose.Schema({
  from: String,
  text: String,
  triageData: mongoose.Schema.Types.Mixed,
  location: {
    lat: Number,
    lng: Number
  },
  status: String,
  severity: Number,
  dispatch_status: String
}, { timestamps: true, strict: false });

// Mission Schema
const missionSchema = new mongoose.Schema({
  routes: mongoose.Schema.Types.Mixed,
  vehicle_id: Number,
  reports: [mongoose.Schema.Types.ObjectId],
  stationType: String,
  stationName: String,
  status: String
}, { timestamps: true, strict: false });

let Report, Need, Mission;

/**
 * Format timestamp
 */
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get status color
 */
function getStatusColor(status) {
  const statusColors = {
    'Pending': chalk.gray,
    'Processing_Audio': chalk.blue,
    'Pending_Transcription': chalk.blue,
    'Processing_Visual': chalk.cyan,
    'Analyzed_Visual': chalk.yellow,
    'Processing_Oracle': chalk.magenta,
    'Analyzed_Full': chalk.green,
    'Analyzed': chalk.green,
    'Clustered': chalk.greenBright,
    'Resolved': chalk.white,
    'Error': chalk.red
  };
  return statusColors[status] || chalk.white;
}

/**
 * Get agent indicator
 */
function getAgentFromStatus(oldStatus, newStatus) {
  if (newStatus === 'Processing_Visual' || newStatus === 'Analyzed_Visual') {
    return { agent: 'Sentinel', emoji: '👁️' };
  }
  if (newStatus === 'Processing_Oracle' || newStatus === 'Analyzed_Full') {
    return { agent: 'Oracle', emoji: '🔮' };
  }
  if (newStatus === 'Processing_Audio' || newStatus === 'Pending_Transcription') {
    return { agent: 'Audio', emoji: '🎤' };
  }
  if (newStatus === 'Clustered') {
    return { agent: 'Logistics', emoji: '🚚' };
  }
  return { agent: 'System', emoji: '⚙️' };
}

/**
 * Log a change event
 */
function logChange(change) {
  changeLog.unshift(change);
  if (changeLog.length > MAX_CHANGE_LOG) {
    changeLog.pop();
  }
}

/**
 * Print section header
 */
function printHeader(title) {
  const line = '═'.repeat(60);
  console.log(chalk.cyan(`\n╔${line}╗`));
  console.log(chalk.cyan(`║`) + chalk.bold.white(` ${title}`.padEnd(60)) + chalk.cyan(`║`));
  console.log(chalk.cyan(`╚${line}╝`));
}

/**
 * Print a new data entry
 */
function printNewEntry(type, data) {
  const time = formatTime(new Date());
  console.log(chalk.green(`\n🆕 [${time}] NEW ${type.toUpperCase()} DETECTED`));
  console.log(chalk.gray('─'.repeat(50)));

  if (type === 'report') {
    console.log(chalk.white(`   ID:       `) + chalk.yellow(data.reportId || data._id));
    console.log(chalk.white(`   Source:   `) + chalk.cyan(data.source || 'N/A'));
    console.log(chalk.white(`   Status:   `) + getStatusColor(data.status)(data.status));
    if (data.text) {
      const shortText = data.text.length > 50 ? data.text.substring(0, 50) + '...' : data.text;
      console.log(chalk.white(`   Text:     `) + chalk.gray(`"${shortText}"`));
    }
    if (data.location) {
      console.log(chalk.white(`   Location: `) + chalk.gray(`(${data.location.lat?.toFixed(4)}, ${data.location.lng?.toFixed(4)})`));
    }
    if (data.imageUrl) {
      console.log(chalk.white(`   Image:    `) + chalk.blue('✓ Has image'));
    }
  } else if (type === 'need') {
    console.log(chalk.white(`   ID:       `) + chalk.yellow(data._id));
    console.log(chalk.white(`   From:     `) + chalk.cyan(data.from || 'N/A'));
    console.log(chalk.white(`   Severity: `) + chalk.red(data.severity || 'N/A'));
    if (data.text) {
      const shortText = data.text.length > 50 ? data.text.substring(0, 50) + '...' : data.text;
      console.log(chalk.white(`   Text:     `) + chalk.gray(`"${shortText}"`));
    }
  } else if (type === 'mission') {
    console.log(chalk.white(`   ID:       `) + chalk.yellow(data._id));
    console.log(chalk.white(`   Station:  `) + chalk.cyan(data.stationName || 'N/A'));
    console.log(chalk.white(`   Type:     `) + chalk.magenta(data.stationType || 'N/A'));
    console.log(chalk.white(`   Reports:  `) + chalk.gray(data.reports?.length || 0));
  }
}

/**
 * Print a status change
 */
function printStatusChange(type, id, oldStatus, newStatus, data) {
  const time = formatTime(new Date());
  const { agent, emoji } = getAgentFromStatus(oldStatus, newStatus);
  
  console.log(chalk.yellow(`\n${emoji} [${time}] ${agent.toUpperCase()} PROCESSED - ${type.toUpperCase()}`));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`   ID:        `) + chalk.yellow(id));
  console.log(chalk.white(`   Transition: `) + getStatusColor(oldStatus)(oldStatus) + chalk.white(' → ') + getStatusColor(newStatus)(newStatus));
  
  // Show agent-specific data
  if (newStatus === 'Analyzed_Visual' && data.sentinelData) {
    console.log(chalk.cyan(`   [Sentinel Analysis]`));
    console.log(chalk.white(`     Tag:        `) + chalk.green(data.sentinelData.tag || 'N/A'));
    console.log(chalk.white(`     Confidence: `) + chalk.green(`${((data.sentinelData.confidence || 0) * 100).toFixed(1)}%`));
  }
  
  if (newStatus === 'Analyzed_Full' && data.oracleData) {
    console.log(chalk.magenta(`   [Oracle Analysis]`));
    console.log(chalk.white(`     Severity: `) + chalk.red.bold(data.oracleData.severity || 'N/A'));
    if (data.oracleData.needs?.length > 0) {
      console.log(chalk.white(`     Needs:    `) + chalk.yellow(data.oracleData.needs.join(', ')));
    }
    if (data.oracleData.summary) {
      const shortSummary = data.oracleData.summary.length > 60 
        ? data.oracleData.summary.substring(0, 60) + '...' 
        : data.oracleData.summary;
      console.log(chalk.white(`     Summary:  `) + chalk.gray(`"${shortSummary}"`));
    }
  }
}

/**
 * Print data change (non-status)
 */
function printDataChange(type, id, field, oldValue, newValue) {
  const time = formatTime(new Date());
  console.log(chalk.blue(`\n📝 [${time}] DATA UPDATE - ${type.toUpperCase()}`));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`   ID:    `) + chalk.yellow(id));
  console.log(chalk.white(`   Field: `) + chalk.cyan(field));
  console.log(chalk.white(`   Old:   `) + chalk.red(JSON.stringify(oldValue)));
  console.log(chalk.white(`   New:   `) + chalk.green(JSON.stringify(newValue)));
}

/**
 * Compare and detect changes in a document
 */
function detectChanges(type, id, oldData, newData) {
  const changes = [];
  
  // Check status change
  if (oldData?.status !== newData.status) {
    changes.push({
      type: 'status',
      field: 'status',
      oldValue: oldData?.status || 'NEW',
      newValue: newData.status
    });
  }
  
  // Check sentinel data changes
  if (type === 'report') {
    const oldSentinel = JSON.stringify(oldData?.sentinelData || {});
    const newSentinel = JSON.stringify(newData.sentinelData || {});
    if (oldSentinel !== newSentinel && newData.sentinelData?.tag) {
      changes.push({
        type: 'agent_data',
        agent: 'Sentinel',
        field: 'sentinelData',
        oldValue: oldData?.sentinelData,
        newValue: newData.sentinelData
      });
    }
    
    // Check oracle data changes
    const oldOracle = JSON.stringify(oldData?.oracleData || {});
    const newOracle = JSON.stringify(newData.oracleData || {});
    if (oldOracle !== newOracle && newData.oracleData?.severity) {
      changes.push({
        type: 'agent_data',
        agent: 'Oracle',
        field: 'oracleData',
        oldValue: oldData?.oracleData,
        newValue: newData.oracleData
      });
    }
    
    // Check emergency status changes
    if (oldData?.emergencyStatus !== newData.emergencyStatus) {
      changes.push({
        type: 'data',
        field: 'emergencyStatus',
        oldValue: oldData?.emergencyStatus,
        newValue: newData.emergencyStatus
      });
    }
  }
  
  return changes;
}

/**
 * Monitor reports collection
 */
async function monitorReports() {
  const reports = await Report.find({}).lean();
  
  for (const report of reports) {
    const id = report.reportId || report._id.toString();
    const oldData = lastSeenState.reports.get(id);
    
    if (!oldData) {
      // New report detected
      printNewEntry('report', report);
      logChange({
        timestamp: new Date(),
        type: 'new_report',
        id,
        data: report
      });
    } else {
      // Check for changes
      const changes = detectChanges('report', id, oldData, report);
      for (const change of changes) {
        if (change.type === 'status') {
          printStatusChange('report', id, change.oldValue, change.newValue, report);
          logChange({
            timestamp: new Date(),
            type: 'status_change',
            collection: 'report',
            id,
            oldStatus: change.oldValue,
            newStatus: change.newValue,
            data: report
          });
        } else if (change.type === 'agent_data') {
          // Agent data printed along with status change
        } else {
          printDataChange('report', id, change.field, change.oldValue, change.newValue);
          logChange({
            timestamp: new Date(),
            type: 'data_change',
            collection: 'report',
            id,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue
          });
        }
      }
    }
    
    // Update cached state
    lastSeenState.reports.set(id, { ...report });
  }
}

/**
 * Monitor needs collection
 */
async function monitorNeeds() {
  const needs = await Need.find({}).lean();
  
  for (const need of needs) {
    const id = need._id.toString();
    const oldData = lastSeenState.needs.get(id);
    
    if (!oldData) {
      printNewEntry('need', need);
      logChange({
        timestamp: new Date(),
        type: 'new_need',
        id,
        data: need
      });
    } else {
      // Check for changes
      if (oldData.status !== need.status) {
        printStatusChange('need', id, oldData.status, need.status, need);
        logChange({
          timestamp: new Date(),
          type: 'status_change',
          collection: 'need',
          id,
          oldStatus: oldData.status,
          newStatus: need.status,
          data: need
        });
      }
      
      if (oldData.dispatch_status !== need.dispatch_status) {
        printDataChange('need', id, 'dispatch_status', oldData.dispatch_status, need.dispatch_status);
      }
    }
    
    lastSeenState.needs.set(id, { ...need });
  }
}

/**
 * Monitor missions collection
 */
async function monitorMissions() {
  const missions = await Mission.find({}).lean();
  
  for (const mission of missions) {
    const id = mission._id.toString();
    const oldData = lastSeenState.missions.get(id);
    
    if (!oldData) {
      printNewEntry('mission', mission);
      logChange({
        timestamp: new Date(),
        type: 'new_mission',
        id,
        data: mission
      });
    } else {
      if (oldData.status !== mission.status) {
        printStatusChange('mission', id, oldData.status, mission.status, mission);
        logChange({
          timestamp: new Date(),
          type: 'status_change',
          collection: 'mission',
          id,
          oldStatus: oldData.status,
          newStatus: mission.status,
          data: mission
        });
      }
    }
    
    lastSeenState.missions.set(id, { ...mission });
  }
}

/**
 * Print summary statistics
 */
function printSummary() {
  const reportStats = {
    total: lastSeenState.reports.size,
    byStatus: {}
  };
  
  for (const [, report] of lastSeenState.reports) {
    const status = report.status || 'Unknown';
    reportStats.byStatus[status] = (reportStats.byStatus[status] || 0) + 1;
  }
  
  console.log(chalk.gray('\n' + '─'.repeat(60)));
  console.log(chalk.white.bold('📊 Current State Summary:'));
  console.log(chalk.white(`   Reports: ${reportStats.total} | `) + 
    Object.entries(reportStats.byStatus)
      .map(([status, count]) => getStatusColor(status)(`${status}: ${count}`))
      .join(' | '));
  console.log(chalk.white(`   Needs: ${lastSeenState.needs.size} | Missions: ${lastSeenState.missions.size}`));
  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Print change history
 */
function printRecentChanges() {
  if (changeLog.length === 0) {
    return;
  }
  
  printHeader('📜 Recent Changes (Last 10)');
  
  const recent = changeLog.slice(0, 10);
  for (const change of recent) {
    const time = formatTime(change.timestamp);
    let line = `[${time}] `;
    
    switch (change.type) {
      case 'new_report':
        line += chalk.green(`NEW Report: ${change.id}`);
        break;
      case 'new_need':
        line += chalk.green(`NEW Need: ${change.id}`);
        break;
      case 'new_mission':
        line += chalk.green(`NEW Mission: ${change.id}`);
        break;
      case 'status_change':
        line += chalk.yellow(`${change.collection}: ${change.oldStatus} → ${change.newStatus}`);
        break;
      case 'data_change':
        line += chalk.blue(`${change.collection}.${change.field} updated`);
        break;
      default:
        line += chalk.gray(`Unknown change type: ${change.type}`);
    }
    
    console.log(`   ${line}`);
  }
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(chalk.green(`✅ MongoDB Connected: ${mongoose.connection.host}`));
    
    // Initialize models
    Report = mongoose.model('Report', reportSchema);
    Need = mongoose.model('Need', needSchema);
    Mission = mongoose.model('Mission', missionSchema);
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ MongoDB Connection Error: ${error.message}`));
    return false;
  }
}

/**
 * Main polling loop
 */
async function pollForChanges() {
  try {
    await monitorReports();
    await monitorNeeds();
    await monitorMissions();
  } catch (error) {
    console.error(chalk.red(`❌ Error polling for changes: ${error.message}`));
  }
}

/**
 * Clear console and show header
 */
function showWelcome() {
  console.clear();
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════════╗
║          🔍 AEGIS AI - DATA CHANGE MONITOR                   ║
║──────────────────────────────────────────────────────────────║
║  Monitoring for:                                             ║
║   • New incoming reports, needs, and missions                ║
║   • Agent processing (Sentinel 👁️, Oracle 🔮, Logistics 🚚)   ║
║   • Status transitions and data updates                      ║
╚══════════════════════════════════════════════════════════════╝
  `));
  console.log(chalk.gray(`  Poll Interval: ${POLL_INTERVAL / 1000}s | MongoDB: ${MONGO_URI}`));
  console.log(chalk.gray(`  Press Ctrl+C to stop monitoring\n`));
}

/**
 * Interactive commands handler
 */
function setupCommandListener() {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (input) => {
    const command = input.trim().toLowerCase();
    
    switch (command) {
      case 's':
      case 'summary':
        printSummary();
        break;
      case 'h':
      case 'history':
        printRecentChanges();
        break;
      case 'c':
      case 'clear':
        showWelcome();
        console.log(chalk.yellow('🔄 Waiting for data changes...\n'));
        break;
      case 'help':
        console.log(chalk.cyan('\n📖 Commands:'));
        console.log('   s, summary  - Show current state summary');
        console.log('   h, history  - Show recent changes');
        console.log('   c, clear    - Clear screen');
        console.log('   help        - Show this help\n');
        break;
    }
  });
}

/**
 * Start the monitor
 */
async function startMonitor() {
  showWelcome();
  
  const connected = await connectDB();
  if (!connected) {
    console.error(chalk.red('Failed to connect to MongoDB. Exiting...'));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Initial data snapshot captured'));
  console.log(chalk.yellow('🔄 Waiting for data changes...\n'));
  console.log(chalk.gray('Type "help" for available commands\n'));
  
  // Initial poll to capture existing state
  await pollForChanges();
  printSummary();
  
  // Start recurring polling
  setInterval(pollForChanges, POLL_INTERVAL);
  
  // Setup interactive commands
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    setupCommandListener();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n👋 Shutting down monitor...'));
  printRecentChanges();
  await mongoose.connection.close();
  console.log(chalk.green('✅ Disconnected from MongoDB. Goodbye!'));
  process.exit(0);
});

// Start the monitor
startMonitor().catch((error) => {
  console.error(chalk.red(`Failed to start monitor: ${error.message}`));
  process.exit(1);
});
