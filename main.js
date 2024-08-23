const { app, net, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const notifier = require("node-notifier");
const unzipper = require("unzipper");
const os = require("os");
const {
  initializePluginsDir,
  loadPlugins,
  getPluginCommand,
} = require("./loadPlugins");

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

const RPC = require("discord-rpc");
const { dir } = require("console");
const clientId = "673178875014021169"; // Replace this with your actual Discord application client ID
RPC.register(clientId);

// Create a new RPC client
const rpc = new RPC.Client({ transport: "ipc" });

function updateDiscordRPC(details = "Using Statify Terminal", state = "Idle") {
  rpc.setActivity({
    details,
    state,
    startTimestamp: new Date(),
    largeImageKey: "mainicon", // Replace with your image key
    largeImageText: "Statify Terminal",
    smallImageKey: "your_small_image_key", // Replace with your image key
    smallImageText: "Electron App",
    instance: true,
    buttons: [
      {
        label: "View Repo", // Text displayed on the button
        url: "https://git.vmgware.dev/vmgware/statify-terminal/-/tree/master", // Replace with your repository URL
      },
      {
        label: "Get Statify Terminal", // Text displayed on the button
        url: "https://git.vmgware.dev/vmgware/statify-terminal/-/releases", // Replace with your repository URL
      },
    ],
  });
}

// Constants and Paths
const CHECK_UPDATE_URL = "https://git.vmgware.dev/api/v4/projects/94/releases";
// Define the base directory in the user's "Documents" folder
let documentsDir;

switch (os.platform()) {
  case "win32": // Windows
    documentsDir = path.join(app.getPath("documents"), "Statify-DB");
    break;
  case "darwin": // macOS
    documentsDir = path.join(app.getPath("home"), "Documents", "Statify-DB");
    break;
  case "linux": // Linux
    documentsDir = path.join(app.getPath("home"), "Documents", "Statify-DB");
    break;
  default:
    throw new Error("Unsupported platform: " + os.platform());
}

// Ensure the directory exists
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDirExists(documentsDir);

// Ensure the directory exists, or create it if it doesn't
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Define paths for your data files in the new directory
const dbPath = path.join(documentsDir, "window-state.json");
const historyPath = path.join(documentsDir, "terminal-history.json");
const LAST_CHECK_FILE = path.join(documentsDir, "last-update-check.json");

// Initialize data files if they don't exist
function initializeDataFiles() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ window_state: [] }));
  }
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, JSON.stringify([]));
  }
  if (!fs.existsSync(LAST_CHECK_FILE)) {
    fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify({ lastCheck: null }));
  }
}

// Call this function when your app starts
initializeDataFiles();

// Check for updates if 24 hours have passed since the last check
function shouldCheckForUpdates() {
  if (fs.existsSync(LAST_CHECK_FILE)) {
    const lastCheckTime = JSON.parse(
      fs.readFileSync(LAST_CHECK_FILE, "utf8")
    ).timestamp;
    const currentTime = Date.now();
    const timeDifference = currentTime - lastCheckTime;
    return timeDifference > 1000 * 60 * 60 * 24; // 24 hours in milliseconds
  } else {
    // If the file doesn't exist, create it with the current timestamp
    updateLastCheckTime();
    return true;
  }
}
// Update the last check time
function updateLastCheckTime() {
  const data = { timestamp: Date.now() };
  fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify(data), "utf8");
}

let splashWindow;
let mainWindow;
let editorWindow;
let isFullScreen = false; // Track fullscreen state

// Initialize data files if they don't exist
function initializeDataFiles() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ window_state: [] }));
  }
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, JSON.stringify([]));
  }
}

// Load data from JSON files
// function loadData(callback) {
//     fs.readFile(dbPath, 'utf8', (err, data) => {
//         const windowState = err ? [] : JSON.parse(data).window_state;
//         fs.readFile(historyPath, 'utf8', (err, historyData) => {
//             const terminalHistory = err ? [] : JSON.parse(historyData);
//             callback(windowState, terminalHistory);
//         });
//     });
// }

// Save data to JSON files
// function saveData(windowState, terminalHistory) {
//     fs.writeFileSync(dbPath, JSON.stringify({ window_state: windowState }), 'utf8');
//     fs.writeFileSync(historyPath, JSON.stringify(terminalHistory), 'utf8');
// }

// Save terminal history
// function saveTerminalHistory(text, type) {
//     loadData((windowState, terminalHistory) => {
//         terminalHistory.push({ text, type, timestamp: new Date().toISOString() });
//         saveData(windowState, terminalHistory);
//     });
// }

// Notify the user with a message
function notifyUser(title, message) {
  notifier.notify({
    title,
    message,
    icon: path.join(__dirname, "icon.png"), // Optional: path to an icon image
    sound: true,
    wait: true,
    timeout: 10, // Optional: auto-dismiss after 10 seconds
  });
}

// Function to check for updates
async function checkForUpdates() {
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.error("Error checking for updates:", error);
  }
}

// Download update
function downloadUpdate(url, version) {
  const updateFile = path.join(
    app.getPath("userData"),
    `update-${version}.zip`
  );
  const file = fs.createWriteStream(updateFile);
  const request = net.request(url);

  request.on("response", (response) => {
    response.pipe(file);
    file.on("finish", () => {
      file.close(() => applyUpdate(updateFile));
    });
  });

  request.on("error", console.error);
  request.end();
}

// Download update
function downloadUpdate(url, version) {
  const updateFile = path.join(
    app.getPath("userData"),
    `update-${version}.zip`
  );
  const file = fs.createWriteStream(updateFile);
  const request = net.request(url);

  request.on("response", (response) => {
    response.pipe(file);
    file.on("finish", () => {
      file.close(() => applyUpdate(updateFile));
    });
  });

  request.on("error", console.error);
  request.end();
}

function applyUpdate(updateFile) {
  const appPath = app.getAppPath(); // Get the current application path
  const backupPath = path.join(app.getPath("userData"), "backup");

  try {
    // Step 1: Backup existing files (optional but recommended)
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
    fs.mkdirSync(backupPath);
    fs.copyFileSync(appPath, backupPath);

    // Step 2: Extract the update file
    fs.createReadStream(updateFile)
      .pipe(unzipper.Extract({ path: appPath }))
      .on("close", () => {
        console.log("Update extracted successfully.");

        // Step 3: Clean up update file after extraction
        fs.unlinkSync(updateFile);

        // Step 4: Restart the application to apply the update
        notifyUser(
          "Update Applied",
          "The update was successfully applied. The app will restart."
        );
        app.relaunch();
        app.exit();
      })
      .on("error", (err) => {
        console.error("Failed to extract update:", err);
        restoreBackup();
      });
  } catch (err) {
    console.error("Failed to apply update:", err);
    restoreBackup();
  }

  // Restore the backup if anything goes wrong
  function restoreBackup() {
    console.error("Restoring backup due to error...");
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, appPath, { recursive: true });
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      notifyUser(
        "Update Failed",
        "Update failed. Restored the previous version."
      );
    } catch (restoreErr) {
      console.error("Failed to restore backup:", restoreErr);
      notifyUser(
        "Critical Error",
        "Failed to restore the backup. Manual intervention required."
      );
    }
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 700,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile("src/load.html");
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

// Create the main application window
function createWindow() {
  // Load data if you want to use it later
  // loadData((windowState, terminalHistory) => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowOptions = {
    width: 1000,
    height: 700,
    x: (width - 1000) / 2,
    y: (height - 700) / 2,
  };

  isFullScreen = false; // Reset fullscreen state

  mainWindow = new BrowserWindow({
    ...windowOptions,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
    title: "Statify Terminal",
    frame: false,
    transparent: true,
    backgroundColor: "#282a36",
  });

  mainWindow.loadFile("src/index.html");
  setInterval(checkForUpdates, 1000 * 60 * 60); // Check every hour

  function setupDiscordRPC() {
    rpc.on("ready", () => {
      updateDiscordRPC(); // Initialize with default state
      console.log("Discord RPC is ready.");
    });

    rpc.login({ clientId }).catch(console.error);
  }

  setupDiscordRPC();

  if (isFullScreen) mainWindow.setFullScreen(true);

  mainWindow.on("close", () => {
    /* Do nothing for now */
  });
  mainWindow.on("resize", () => {
    /* Do nothing for now */
  });
  mainWindow.on("move", () => {
    /* Do nothing for now */
  });

  // mainWindow.webContents.once('did-finish-load', () => {
  //     mainWindow.webContents.send('load-terminal-history', terminalHistory);
  // });
  // });
}

// Create the editor window
function createEditorWindow() {
  if (editorWindow) {
    editorWindow.focus();
    return;
  }

  editorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "editor-preload.js"), // Preload script if needed
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false,
    title: "Statify Terminal",
    transparent: true,
    backgroundColor: "#282a36",
  });

  editorWindow.loadFile("src/editor.html");

  updateDiscordRPC("Opened Stato Editor", "Doing some coding...");

  editorWindow.on("closed", () => {
    editorWindow = null;
  });
}

// Save the current window state
// function saveWindowState() {
//     if (!isFullScreen) {
//         const bounds = mainWindow.getBounds();
//         loadData((windowState, terminalHistory) => {
//             windowState.push({ ...bounds, is_fullscreen: isFullScreen });
//             saveData(windowState, terminalHistory);
//         });
//     }
// }

let currentWorkingDirectory = process.cwd(); // Initialize with the current working directory

ipcMain.handle("execute-command-with-logging", async (event, command) => {
  try {
    const commandParts = command.split(" ").filter(Boolean); // Split and remove empty strings
    const cmd = commandParts[0];
    const args = commandParts.slice(2);

    if (cmd && cmd.toLowerCase() === "cd") {
      const newDir = path.resolve(currentWorkingDirectory, args.join(" "));
      currentWorkingDirectory = newDir;

      updateDiscordRPC("Changed directory:", currentWorkingDirectory); // Optional: Update external state

      event.sender.send("log-output", {
        text: `Changed directory to: ${currentWorkingDirectory}`,
        type: "output",
      });
      return [];
    }

    // Check if the command is a plugin command
    const pluginCommand = getPluginCommand(command);
    if (pluginCommand) {
      try {
        const result = await pluginCommand.execute(args);
        event.sender.send("log-output", result);
        return [result];
      } catch (err) {
        const errorResult = {
          text: `Error executing plugin command: ${err.message}`,
          type: "error",
        };
        event.sender.send("log-output", errorResult);
        return [errorResult];
      }
    }

    // If not a plugin command, run it as a shell command
    const child = spawn(cmd, args, {
      cwd: currentWorkingDirectory,
      shell: true,
    });

    const output = [];

    console.log(output);

    const logOutput = (data, type) => {
      const text = data.toString();
      output.push({ text, type });
      event.sender.send("log-output", { text, type });
    };

    child.stdout.on("data", (data) => logOutput(data, "output"));
    child.stderr.on("data", (data) => logOutput(data, "error"));

    return new Promise((resolve) => {
      child.on("close", (code) => {
        if (code !== 0) {
          const errorMessage = `Process exited with code ${code}`;
          logOutput(Buffer.from(errorMessage), "error");
        }
        resolve(output);
      });
    });
  } catch (error) {
    const errorResult = {
      text: `Unexpected error: ${error.message}`,
      type: "error",
    };
    event.sender.send("log-output", errorResult);
    return [errorResult];
  }
});

// IPC handlers for window actions
ipcMain.on("minimize-window", () => mainWindow.minimize());
ipcMain.on("close-window", () => mainWindow.close());
ipcMain.on("toggle-fullscreen", toggleFullscreen);
ipcMain.on("download-update", (event, version) => {
  const updateUrl = `ttps://git.vmgware.dev/vmgware/statify-terminal/-/raw/${version}/Files/Statify_Terminal-1.0.0-win.zip`;
  downloadUpdate(updateUrl, version);
});

// Handle reading file content
ipcMain.handle("read-file-content", async (event, filename) => {
  try {
    const content = fs.readFileSync(
      path.join(currentWorkingDirectory, filename),
      "utf-8"
    );
    // Open the editor window if it's not already open
    if (!editorWindow || editorWindow.isDestroyed()) {
      createEditorWindow();
    }
    // Wait until the editor window is ready to receive the content
    editorWindow.webContents.once("did-finish-load", () => {
      editorWindow.webContents.send("load-file", content, filename);
    });
    return content;
  } catch (error) {
    console.error(`Failed to read file ${filename}:`, error);
    return `Error: Could not read file ${filename}`;
  }
});

// Handle saving file content
ipcMain.handle("save-file-content", async (event, filename, content) => {
  try {
    fs.writeFileSync(path.join(__dirname, filename), content, "utf-8");
    return true;
  } catch (error) {
    console.error(`Failed to save file ${filename}:`, error);
    return false;
  }
});

ipcMain.handle("close-editor", () => {
  if (editorWindow) {
    editorWindow.close();
    updateDiscordRPC("Using Statify Terminal", "Idle");
    return true;
  }
  return false;
});

ipcMain.on("open-editor-window", createEditorWindow);

// Toggle fullscreen state
function toggleFullscreen() {
  isFullScreen = !isFullScreen;
  mainWindow.setFullScreen(isFullScreen);
  // saveWindowState(); // Disable state saving
}

// Electron app lifecycle events
app.whenReady().then(async () => {
  try {
    await initializeDataFiles(); // Wait for data files to initialize
    await checkForUpdates(); // Wait for updates check
    createSplashWindow(); // Create the splash window
    ensureDirExists(path.join(app.getPath("documents"), "MyApp")); // Ensure the directory exists
    initializePluginsDir(path.join(app.getPath("documents"), "MyApp"));

    // Wait for the splash window to finish loading or other conditions
    splashWindow.webContents.on("did-finish-load", () => {
      setTimeout(() => {
        splashWindow.close(); // Close splash screen
        createWindow(); // Open the main window
        loadPlugins();
      }, 3000);
    });

    // Handle IPC messages
    ipcMain.on("get-update-status", (event) => {
      event.sender.send("update-status", autoUpdater.getStatus());
    });

    autoUpdater.on("update-available", () => {
      splashWindow.webContents.send("update-status", "Checking for update...");
    });

    autoUpdater.on("download-progress", (progress) => {
      const percent = Math.round(progress.percent);
      splashWindow.webContents.send("update-status", `Updating ${percent}%`);
    });

    autoUpdater.on("update-downloaded", () => {
      splashWindow.webContents.send(
        "update-status",
        "Update downloaded. Restarting..."
      );
      setTimeout(() => {
        autoUpdater.quitAndInstall();
      }, 3000); // Optional delay before quitting
    });

    autoUpdater.on("error", (error) => {
      splashWindow.webContents.send(
        "update-status",
        "Error checking for updates."
      );
    });
  } catch (error) {
    console.error("Error during app startup:", error);
    app.quit(); // Exit the application if there's an error
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
